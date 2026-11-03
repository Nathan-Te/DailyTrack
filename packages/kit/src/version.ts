import { call, estOngletPerime, versionsDeReponse, versionsDifferent, type LireVersions, type Versions } from "@cdj/profile";
import type { Langue } from "@cdj/ui";
import { bandeauVersionPerimee } from "@cdj/ui/src/versionPerimee";

// Lot D2 — **l'onglet périmé.** Un onglet resté ouvert pendant une mise en production envoie une partie que le serveur refuse (`version`, `sim_version`, `track_mismatch`) : le joueur voyait un refus
// incompréhensible. Cette brique compare la version du jeu à celle du serveur (`info` ou `health`, déjà lus par le jeu) **avant la partie** — au chargement, au retour sur l'onglet
// (`visibilitychange`, `focus`) — et, **après un refus** de ces trois codes, montre « Nouvelle version en ligne — recharger » avec son bouton. **Jamais pendant une partie** (règle du message en
// direct) : tant que `enPartie()` est vrai, rien n'est affiché ni demandé au réseau ; le bandeau disparaît quand la partie commence et revient à son arrêt. Une lecture au plus toutes les 30 s.
// **À la demande** : un `import()` du jeu, jamais dans son premier chargement. Le cœur (`creerVersion`) est pur (réseau, bandeau, écoute et minuterie injectés : testé sans DOM).

/** Entre deux lectures des versions du serveur (le retour sur l'onglet peut se répéter). */
export const VERIFICATION_MIN_MS = 30_000;
/** Tant que l'onglet est périmé, on regarde ce délai si une partie commence ou finit (le bandeau suit). */
export const SUIVI_MS = 500;

export interface BandeauVersion {
  montrer(): void;
  cacher(): void;
}

export interface OptionsVersion {
  /** Les versions de ce jeu : `{ simVersion, generatorVersion }`. */
  locales: Versions;
  /** Lit les versions du serveur (`null` : hors ligne ou muet — on ne dit rien). */
  lire: LireVersions;
  /** Une partie (ou un carnage, une rediffusion) tourne : plus de bandeau ni de réseau. */
  enPartie(): boolean;
  bandeau: BandeauVersion;
  /** S'abonne au retour sur l'onglet ; rend de quoi se désabonner. */
  ecoute(rappel: () => void): () => void;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(h: unknown): void;
}

export interface Version {
  /** Vrai si le serveur a une autre version (ou si un refus l'a dit). */
  readonly perime: boolean;
  /** Compare avec le serveur (au plus toutes les 30 s ; jamais en partie). */
  verifier(): Promise<boolean>;
  /** Un refus du serveur : si c'est un des trois codes de l'onglet périmé, le bandeau s'allume. Rend vrai dans ce cas. */
  noterRefus(code: string | undefined): boolean;
  /** Remet le bandeau d'accord avec l'état (partie en cours ou non). */
  actualiser(): void;
  etat(): { perime: boolean; affiche: boolean; lectures: number };
  arreter(): void;
}

export function creerVersion(o: OptionsVersion): Version {
  let perime = false;
  let affiche = false;
  let lectures = 0;
  let derniere = -Infinity;
  let enCours: Promise<boolean> | null = null;
  let suivi: unknown = null;

  const arreterSuivi = () => {
    if (suivi !== null) o.clearTimer(suivi);
    suivi = null;
  };
  const actualiser = (): void => {
    const doit = perime && !o.enPartie();
    if (doit !== affiche) {
      affiche = doit;
      if (doit) o.bandeau.montrer();
      else o.bandeau.cacher();
    }
    // Périmé : on suit la partie (elle commence, elle finit) ; sinon rien ne tourne.
    arreterSuivi();
    if (perime) {
      suivi = o.setTimer(() => {
        suivi = null;
        actualiser();
      }, SUIVI_MS);
    }
  };

  const verifier = (): Promise<boolean> => {
    if (o.enPartie()) return Promise.resolve(perime); // jamais pendant une partie
    if (perime) {
      actualiser();
      return Promise.resolve(true);
    }
    if (enCours) return enCours;
    if (o.now() - derniere < VERIFICATION_MIN_MS) return Promise.resolve(false);
    derniere = o.now();
    lectures++;
    enCours = o
      .lire()
      .then((serveur) => {
        if (versionsDifferent(o.locales, serveur)) perime = true;
        actualiser();
        return perime;
      })
      .catch(() => false)
      .finally(() => {
        enCours = null;
      });
    return enCours;
  };

  const desabonner = o.ecoute(() => void verifier());
  return {
    get perime() {
      return perime;
    },
    verifier,
    noterRefus(code) {
      if (!estOngletPerime(code)) return false;
      perime = true;
      actualiser();
      return true;
    },
    actualiser,
    etat: () => ({ perime, affiche, lectures }),
    arreter() {
      desabonner();
      arreterSuivi();
      if (affiche) o.bandeau.cacher();
      affiche = false;
    },
  };
}

export interface OptionsMonterVersion {
  locales: Versions;
  lire: LireVersions;
  enPartie(): boolean;
  /** La langue courante du jeu (relue à chaque dessin) et son abonnement au changement de langue. */
  langue(): Langue;
  surLangue?(rappel: () => void): void;
  /** Où poser le bandeau (le corps de la page par défaut). */
  hote?: HTMLElement;
  recharger?: () => void;
}

/** Monte la brique sur la page : bandeau en haut de l'écran, écoute du retour sur l'onglet, première vérification tout de suite. */
export function monterVersion(o: OptionsMonterVersion): Version {
  let bandeau: { racine: HTMLElement; maj(): void } | null = null;
  const hote = () => o.hote ?? document.body;
  const version = creerVersion({
    locales: o.locales,
    lire: o.lire,
    enPartie: o.enPartie,
    bandeau: {
      montrer() {
        bandeau ??= bandeauVersionPerimee({ langue: o.langue, recharger: o.recharger });
        bandeau.maj();
        hote().append(bandeau.racine);
      },
      cacher() {
        bandeau?.racine.remove();
      },
    },
    ecoute(rappel) {
      const surVisibilite = () => {
        if (document.visibilityState === "visible") rappel();
      };
      document.addEventListener("visibilitychange", surVisibilite);
      window.addEventListener("focus", rappel);
      return () => {
        document.removeEventListener("visibilitychange", surVisibilite);
        window.removeEventListener("focus", rappel);
      };
    },
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  o.surLangue?.(() => bandeau?.maj());
  void version.verifier();
  return version;
}

export interface OptionsBrancherVersion extends Omit<OptionsMonterVersion, "lire"> {
  /** L'adresse de l'API du jeu (celle du classement) ; `null` ou `demo` : pas de serveur, rien à comparer. */
  base: string | null;
  /** La route qui rend `simVersion` et `generatorVersion` : `/api/jump/info`, `/api/tower/info`, `/api/health` (Track). */
  chemin: string;
  /** `?debug&simuler=lent|perime` lu par le jeu (`null` en production et sans `?debug` : l'essai est fermé, règle R9). */
  simuler: "lent" | "perime" | null;
}

/**
 * Le branchement d'un jeu en une fois : lit les versions du serveur sur `chemin`, installe l'essai `?debug&simuler=` (hors production seulement, module chargé à la demande) et monte la brique.
 * `null` sans serveur. Appelé par le module du jeu, lui-même chargé à la demande.
 */
export async function brancherVersion(o: OptionsBrancherVersion): Promise<Version | null> {
  if (!o.base || o.base === "demo") return null;
  if (o.simuler) {
    const m = await import("@cdj/profile/src/simuler");
    m.installerSimulation(o.simuler);
  }
  const base = o.base;
  const lire: LireVersions = async () => versionsDeReponse(await call<Record<string, unknown>>(base, "GET", o.chemin));
  return monterVersion({ ...o, lire });
}
