// Socle de la scène par paliers (lot 39) : **la seule construction de la scène de Track**. Le jeu (course, accueil, Salon, spectateur, revoir le meilleur
// tour), les miniatures et la vitrine passent tous par `composer` ; `buildTrackScene` en est le nom court du palier par défaut.
//
// - **Les paliers** (`Palier`) : depuis le lot 43, **le palier 1 (« P1 ») est la scène de tout le monde** (`composerP1.ts`, dans le premier chargement) ;
//   « existant » est la scène d'avant (lot 37), **chargée à la demande** (`existant.ts`) pour la vitrine et `?palier=existant` (recette et aperçus) ;
//   « P2 » et « P3 » sont ceux de la vitrine (`src/scene/`, `docs/lots/lot-38-direction-scene/direction.md`), pas encore branchés dans le jeu. Un palier
//   chargé à la demande se branche en enregistrant son composeur (`brancherComposeur`) quand son module est chargé.
// - **Les modules des pas se chargent à la demande** (`chargerPas`, `import()`), jamais dans le premier chargement, et **la scène ne se reconstruit jamais
//   pendant une course** (`creerReconstructeur` : à l'accueil, à la pause, à l'arrivée, au podium du Salon).
// - **Un palier ne change jamais la simulation** : seul le rendu varie (même circuit, même route sous la voiture, mêmes rediffusions).
import type { PaletteName, Track } from "@cdj/sim";
import type { TrackScene, TrackSceneOptions } from "../trackMesh";
import { composerP1 } from "./composerP1";

/** Les paliers de qualité de la scène. « P1 » est la scène du jeu (lot 43) ; « existant » se charge à la demande ; « P2 » et « P3 » sont ceux de la vitrine. */
export type Palier = "existant" | "P1" | "P2" | "P3";
export const PALIER_EXISTANT: Palier = "existant";
/** Le palier de la scène du jeu, par défaut (lot 43). */
export const PALIER_DEFAUT: Palier = "P1";

/** Construit la scène d'un circuit à un palier (ses options sont celles de `buildTrackScene`). */
export type Composeur = (track: Track, palette: PaletteName, options: TrackSceneOptions) => TrackScene;

const COMPOSEURS: Partial<Record<Palier, Composeur>> = { P1: composerP1 };

/** Branche le composeur d'un palier : appelé par le module de ses pas, une fois chargé (`undefined` le débranche : les essais). */
export function brancherComposeur(palier: Palier, composeur: Composeur | undefined) {
  COMPOSEURS[palier] = composeur;
}

export const palierBranche = (palier: Palier): boolean => !!COMPOSEURS[palier];

/** **La** construction de la scène d'un circuit au palier demandé ; un palier pas encore branché est une erreur (on charge ses pas d'abord : `chargerPas`). */
export function composer(track: Track, palette: PaletteName, palier: Palier = PALIER_DEFAUT, options: TrackSceneOptions = {}): TrackScene {
  const composeur = COMPOSEURS[palier];
  if (!composeur) throw new Error(`palier « ${palier} » pas branché : charger ses pas d'abord`);
  return composeur(track, palette, options);
}

/** La scène du jeu (palier 1, lot 43) : la piste, ses éléments et sa lumière, le décor d'aujourd'hui. */
export const buildTrackScene = (track: Track, palette: PaletteName = "desert", options: TrackSceneOptions = {}): TrackScene => composer(track, palette, PALIER_DEFAUT, options);

// --- Les modules des pas, à la demande ---------------------------------------------------------------------------------------

/** Un chargeur de module de pas : un `import()`. Rien n'est chargé avant qu'un palier ne le demande. */
export type Chargeur = () => Promise<unknown>;
export type Registre = Record<string, Chargeur>;

/**
 * Les modules à la demande du jeu, un chargeur chacun. Lot 43 : l'ancienne scène (`existant`, pour `?palier=existant` : recette et aperçus seulement),
 * enregistrée par `main.ts` (`PAS_DU_JEU.existant = () => import(…)` : l'`import()` vit dans le module principal, le socle n'y ajoute pas d'aide au
 * préchargement) ; les lots suivants y ajoutent les leurs (`finition`, `matiere`, `reflets`, `lumiere3`, `vie`, `post`, le décor du palier 1…).
 */
export const PAS_DU_JEU: Registre = {};

/** Les modules que demande chaque palier. Le palier 1 est dans le premier chargement : il n'en demande aucun. */
export const PAS_DU_PALIER: Record<Palier, readonly string[]> = { existant: ["existant"], P1: [], P2: [], P3: [] };

const charges = new WeakMap<Registre, Map<string, Promise<unknown>>>();

/** Charge les modules demandés (une seule fois chacun, par registre). Un pas inconnu est une erreur. */
export function chargerPas(ids: readonly string[], registre: Registre = PAS_DU_JEU): Promise<unknown[]> {
  let deja = charges.get(registre);
  if (!deja) charges.set(registre, (deja = new Map()));
  return Promise.all(
    ids.map((id) => {
      const chargeur = registre[id];
      if (!chargeur) return Promise.reject(new Error(`pas inconnu : ${id}`));
      let p = deja!.get(id);
      if (!p) deja!.set(id, (p = chargeur()));
      return p;
    }),
  );
}

// --- Reconstruire hors course ------------------------------------------------------------------------------------------------

export interface Reconstructeur {
  /** Le palier de la scène courante. */
  palier(): Palier;
  /** Le palier voulu (la règle automatique, le réglage du joueur) : on commence à charger ses pas, la scène ne change pas encore. */
  demander(palier: Palier): void;
  /** Vrai s'il y a une reconstruction en attente. */
  enAttente(): boolean;
  /** Reconstruit la scène si un palier est demandé, que ses pas sont chargés et que le jeu n'est pas en course ; rend vrai si elle a changé. */
  essayer(): Promise<boolean>;
}

export interface OptionsReconstructeur {
  palier?: Palier;
  /** Vrai à l'accueil, à la pause, à l'arrivée et au podium du Salon ; **faux pendant une course**. Relu après chaque attente. */
  peutReconstruire(): boolean;
  /** Construit la scène du circuit courant au palier donné (`composer`), ou `null` s'il n'y en a pas (arène plate). */
  construire(palier: Palier): TrackScene | null;
  /** Prend la nouvelle scène (la voiture, les fantômes et les effets y passent, l'ancienne est libérée). */
  adopter(scene: TrackScene, palier: Palier): void;
  pas?: Record<Palier, readonly string[]>;
  registre?: Registre;
}

export function creerReconstructeur(o: OptionsReconstructeur): Reconstructeur {
  let courant: Palier = o.palier ?? PALIER_DEFAUT;
  let voulu: Palier | null = null;
  let prets: Promise<unknown> = Promise.resolve();
  let enCours = false;
  return {
    palier: () => courant,
    demander(palier) {
      if (palier === courant) {
        voulu = null;
        return;
      }
      voulu = palier;
      prets = chargerPas((o.pas ?? PAS_DU_PALIER)[palier], o.registre);
      prets.catch(() => (voulu = null)); // des pas qui ne chargent pas : on reste sur la scène courante
    },
    enAttente: () => voulu !== null,
    async essayer() {
      if (voulu === null || enCours || !o.peutReconstruire()) return false;
      enCours = true;
      try {
        const palier = voulu;
        await prets;
        if (voulu !== palier || !o.peutReconstruire()) return false; // la course a commencé pendant le chargement : on attend le prochain arrêt
        const scene = o.construire(palier);
        if (!scene) return false;
        o.adopter(scene, palier);
        courant = palier;
        voulu = null;
        return true;
      } catch {
        voulu = null;
        return false;
      } finally {
        enCours = false;
      }
    },
  };
}
