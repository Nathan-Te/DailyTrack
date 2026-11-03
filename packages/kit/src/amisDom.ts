import { clientAmis, ProfileClient, type ApiResult, type FiltreAmis } from "@cdj/profile";
import { el, type Jeu } from "@cdj/ui";
import { classementAmisVide, feuilleJoueur, messageErreur, selecteurAmis, textesAmis, type ResultatAction, type TraducteurAmis } from "@cdj/ui/src/amis";
import { adresseClassementFiltre, adresseDuFiltre, filtreDeLAdresse, lireClassementAmis, ouvreUneFeuille, sansAmi, type ClassementAmis, type LigneAmis, type LigneTouchable } from "./amis";

// Lot K4c — **la colle des amis et du groupe d'un jeu neuf, partie DOM**. Modèle : `apps/tower/src/amisClassement.ts` (lot F2), rendue générique : le jeu donne son code de routes, les noms de ses colonnes de classement,
// la façon de dessiner une ligne et son traducteur ; les composants (sélecteur « Tous · N / Amis · N / Mon groupe », feuille d'un joueur) sont ceux de `@cdj/ui/src/amis` (aucun appel réseau dans le socle : on lui
// donne des callbacks). Le classement « Amis » ou « Mon groupe » est lu **seulement au choix** du filtre (ou si l'adresse porte `?filtre=`) ; le compteur « Amis · N » une seule fois par ouverture ; une erreur ramène à
// « Tous » avec une ligne discrète ; un pseudo est une donnée (`textContent`, règle R7). **À la demande** : un `import()` du dialogue du classement du jeu, jamais le premier chargement.
// **Non joué hors navigateur** : le premier usage réel est celui du premier jeu neuf ; ce que les tests du kit vérifient est la partie pure (`amis.ts`).

/** D'où lire le contexte des amis ; `base` ou `id()` vides : pas de sélecteur (le dialogue est celui d'avant). */
export interface SourceAmis {
  base: string;
  id(): string | null;
  /** Le jour dont le classement est montré (`AAAA-MM-JJ`). */
  date: string;
}
export type EtatClassement = "ok" | "chargement" | "indisponible";

/** Les morceaux de l'écran que la colle habille (le sélecteur, les lignes touchables, le bloc du bas) ; une ligne touchable porte `data-ref` et un `.rang__nom`. */
export interface HoteAmis {
  tete: HTMLElement;
  sous: HTMLElement;
  message: HTMLElement;
  liste: HTMLElement;
  /** Redessine « Tous » (le dialogue sait le faire seul). */
  rendreTous(): void;
  /** Dessine une ligne du classement filtré (la même que celle de « Tous ») et l'en-tête du dialogue. */
  ligne(l: LigneAmis, moi: boolean): HTMLElement;
  classes(n: number): string;
  amis?: SourceAmis;
  /** Le filtre choisi, posé par la colle : « Amis » prend la liste, le dialogue ne redessine plus « Tous ». */
  filtre?: FiltreAmis;
  controle?: Promise<ControleAmis>;
}
export interface ControleAmis {
  ouverture(): void;
  tous(classement: { participants: number } | null, etat: EtatClassement): void;
}

export interface OptionsColle {
  /** Le jeu (couleurs du sélecteur et de la feuille) : celui de la fiche. */
  jeu: Jeu;
  /** Le code des routes de la plateforme (`/api/<code>/…`). */
  codeJeu: string;
  /** Les noms des colonnes de classement de la fiche. */
  colonnes: readonly string[];
  /** Le traducteur (commun + `CATALOGUE_AMIS` + le catalogue du jeu), à la langue courante. */
  traducteur(): Promise<TraducteurAmis>;
  /** Où mène « Inviter un ami » quand on n'a pas d'ami (défaut : `../amis/`). */
  hrefAmis?: string;
}

class LectureAmis extends ProfileClient {
  classement(codeJeu: string, date: string, playerId: string, filtre: "amis" | "groupe"): Promise<ApiResult<unknown>> {
    return this.call<unknown>("GET", adresseClassementFiltre(codeJeu, date, filtre), undefined, { "X-Player-Id": playerId });
  }
}

const resultat = <T>(r: ApiResult<T>): ResultatAction => (r.ok ? { ok: true } : { ok: false, code: r.code ?? "network" });

interface Contexte {
  base: string;
  playerId: string;
  date: string;
}
const contexteDe = (s: SourceAmis | undefined): Contexte | null => {
  const playerId = s?.id() ?? null;
  return s?.base && playerId && s.date ? { base: s.base, playerId, date: s.date } : null;
};

/** Appelé par le dialogue à chaque ouverture (`neuve` : il vient de s'ouvrir) : monte le sélecteur une fois, puis met à jour. Sans contexte (pas d'identité ou de serveur), rien ne change. */
export async function surOuverture(o: OptionsColle, h: HoteAmis, neuve: boolean, classement: { participants: number } | null, etat: EtatClassement): Promise<void> {
  if (!contexteDe(h.amis)) return;
  const c = await (h.controle ??= brancher(o, h, () => contexteDe(h.amis)));
  if (neuve) c.ouverture();
  c.tous(classement, etat);
}

async function brancher(o: OptionsColle, h: HoteAmis, contexte: () => Contexte | null): Promise<ControleAmis> {
  const t = await o.traducteur();
  const textes = textesAmis(t);
  let filtre: FiltreAmis = filtreDeLAdresse(location.search);
  h.filtre = filtre;
  let tousEtat: EtatClassement = "ok";
  let envoi = 0; // la dernière demande « Amis » : une réponse plus ancienne est ignorée
  let comptage = 0; // idem pour le compteur
  let sale = false; // une amitié a changé pendant que « Amis » était affiché

  const selecteur = selecteurAmis({ t, filtre, total: null, amis: null, jeu: o.jeu, onChange: (f) => choisir(f) });
  h.tete.after(selecteur.racine);
  const extras = el("div", { classe: "amis-extras" });
  h.liste.after(extras);
  const client = (c: Contexte) => clientAmis({ base: c.base, playerId: c.playerId });

  function habiller(): void {
    for (const li of Array.from(h.liste.children) as HTMLElement[]) {
      const nom = li.querySelector<HTMLElement>(".rang__nom");
      const l: LigneTouchable = { ref: li.dataset.ref, pseudo: nom?.textContent ?? "", moi: li.classList.contains("rang--moi") };
      if (!nom || nom.tagName === "BUTTON" || !ouvreUneFeuille(l)) continue;
      const b = el("button", { classe: "rang__nom rang__bouton", attrs: { type: "button", "aria-haspopup": "dialog" }, texte: l.pseudo });
      b.addEventListener("click", () => ouvrirFeuille(l));
      nom.replaceWith(b);
    }
  }

  function ouvrirFeuille(l: LigneTouchable & { ref: string }): void {
    const c = contexte();
    if (!c) return;
    const api = client(c);
    const feuille = feuilleJoueur({
      t,
      pseudo: l.pseudo,
      jeu: o.jeu,
      onAjouter: async () => {
        const r = await api.ajouterAmi({ ref: l.ref });
        if (r.ok) {
          selecteur.maj({ amis: r.data.total });
          sale = true;
        }
        return resultat(r);
      },
      onRetirer: async () => {
        const r = await api.retirerAmi(l.ref);
        if (r.ok) {
          selecteur.maj({ amis: r.data.total });
          sale = true;
        }
        return resultat(r);
      },
      onFermer: () => {
        if (sale && filtre === "amis") void montrerAmis();
        sale = false;
      },
    });
    const charger = async (): Promise<void> => {
      feuille.chargement();
      const r = await api.ficheJoueur(l.ref, c.date);
      if (!feuille.ouverte) return;
      if (r.ok) feuille.afficher(r.data);
      else feuille.erreur(r.code ?? "network", () => void charger());
    };
    void charger();
  }

  const effacerExtras = (): void => extras.replaceChildren();

  function dessiner(c: ClassementAmis): void {
    h.sous.textContent = h.classes(c.classes);
    h.message.textContent = "";
    h.message.hidden = true;
    h.liste.replaceChildren(
      ...c.lignes.map((l) => {
        const li = h.ligne(l, l.moi);
        li.title = t.t("amis.feuille.rang", { rang: l.rangGeneral, classes: c.participants }); // le rang général au toucher et pour les lecteurs d'écran
        return li;
      }),
    );
    effacerExtras();
    if (c.absents.length > 0) {
      const titre = el("h3", { classe: "amis-absents__titre", texte: textes.absents() });
      const items = c.absents.map((a) => {
        const b = el("button", { classe: "rang__bouton", attrs: { type: "button", "aria-haspopup": "dialog" }, texte: a.pseudo });
        b.addEventListener("click", () => ouvrirFeuille({ ref: a.ref, pseudo: a.pseudo, moi: false }));
        return el("li", { classe: "amis-absent" }, b, el("span", { classe: "amis-absent__vide", texte: textes.pasJoue() }));
      });
      extras.append(titre, el("ul", { classe: "amis-absents" }, ...items));
    }
    if (filtre === "amis" && sansAmi(c)) extras.append(classementAmisVide(t, { href: o.hrefAmis ?? "../amis/" }));
    habiller();
  }

  async function montrerAmis(): Promise<void> {
    const c = contexte();
    const mon = ++envoi;
    if (!c) return retomber("network");
    h.liste.replaceChildren();
    effacerExtras();
    h.sous.textContent = "";
    h.message.textContent = t.t("amis.chargement");
    h.message.hidden = false;
    const demande = filtre === "groupe" ? "groupe" : "amis";
    const r = await new LectureAmis(c.base).classement(o.codeJeu, c.date, c.playerId, demande);
    if (mon !== envoi || filtre !== demande) return;
    const lu = r.ok ? lireClassementAmis(r.data, o.colonnes, demande) : null;
    if (!lu) return retomber(r.ok ? "network" : (r.code ?? "network"));
    dessiner(lu);
  }

  /** « Amis » n'a pas répondu : retour à « Tous », et une ligne discrète pour le dire. */
  function retomber(code: string): void {
    appliquer("tous");
    h.message.textContent = messageErreur(t, code);
    h.message.hidden = false;
  }

  function appliquer(f: FiltreAmis): void {
    filtre = f;
    h.filtre = f;
    envoi++;
    selecteur.maj({ filtre: f });
    try {
      history.replaceState(history.state, "", adresseDuFiltre(location, f));
    } catch {
      /* adresse non modifiable : le choix vaut quand même pour cette visite */
    }
    if (f === "tous") {
      effacerExtras();
      h.rendreTous();
      habiller();
    }
  }

  function choisir(f: FiltreAmis): void {
    appliquer(f);
    if (f !== "tous") void montrerAmis();
  }

  return {
    ouverture() {
      const c = contexte();
      const mon = ++comptage;
      if (c) {
        void client(c)
          .lireAmis()
          .then((r) => {
            if (r.ok && mon === comptage) selecteur.maj({ amis: r.data.total, groupe: r.data.groupe });
          });
      }
      selecteur.maj({ filtre });
      if (filtre !== "tous") void montrerAmis();
    },
    tous(classement, etat) {
      tousEtat = etat;
      selecteur.maj({ total: classement ? classement.participants : null });
      selecteur.racine.hidden = classement === null && tousEtat === "indisponible" && filtre === "tous";
      if (filtre === "tous") habiller();
    },
  };
}
