// Socle de la scène par paliers (lot 39) : **la seule construction de la scène de Track**. Le jeu (course, accueil, Salon, spectateur, revoir le meilleur
// tour), les miniatures et la vitrine passent tous par `composer` ; `buildTrackScene` en est le nom court du palier par défaut.
//
// - **Les paliers** (`Palier`) : depuis le lot 43, **le palier 1 (« P1 ») est la scène de tout le monde** (`composerP1.ts`, dans le premier chargement) ;
//   « existant » est la scène d'avant (lot 37), **chargée à la demande** (`existant.ts`) pour la vitrine et `?palier=existant` (recette et aperçus) ;
//   « P2 » et « P3 » sont, dans le jeu, le palier 1 **plus les pas de leur palier** (lot 45 : le palier 2 prend la finition ; lot 46 : le palier 3 y ajoute
//   la vie, le ciel et les ombres fines). Un palier chargé à la demande se branche en enregistrant son composeur
//   (`brancherComposeur`) quand son module est chargé ; un pas, en s'enregistrant (`brancherPas`).
// - **Les modules des pas se chargent à la demande** (`chargerPas`, `import()`), jamais dans le premier chargement, et **la scène ne se reconstruit jamais
//   pendant une course** (`creerReconstructeur` : à l'accueil, à la pause, à l'arrivée, au podium du Salon).
// - **Un palier ne change jamais la simulation** : seul le rendu varie (même circuit, même route sous la voiture, mêmes rediffusions).
import type { PaletteName, Track } from "@cdj/sim";
import type { TrackScene, TrackSceneOptions } from "../trackMesh";
import type { PasScene } from "./types";
import { composerP1 } from "./composerP1";

/** Les paliers de qualité de la scène. « P1 » est la scène par défaut (lot 43) ; « existant » se charge à la demande ; « P2 » et « P3 » : le palier 1 et leurs pas. */
export type Palier = "existant" | "P1" | "P2" | "P3";
export const PALIER_EXISTANT: Palier = "existant";
/** Le palier de la scène du jeu, par défaut (lot 43). */
export const PALIER_DEFAUT: Palier = "P1";

/** Construit la scène d'un circuit à un palier (ses options sont celles de `buildTrackScene`). */
export type Composeur = (track: Track, palette: PaletteName, options: TrackSceneOptions) => TrackScene;

// Lot 46 : les paliers 2 et 3 du jeu sont le palier 1 et leurs pas (`composer` les lui passe).
const COMPOSEURS: Partial<Record<Palier, Composeur>> = { P1: composerP1, P2: composerP1, P3: composerP1 };

/** Branche le composeur d'un palier : appelé par le module de ses pas, une fois chargé (`undefined` le débranche : les essais). */
export function brancherComposeur(palier: Palier, composeur: Composeur | undefined) {
  COMPOSEURS[palier] = composeur;
}

export const palierBranche = (palier: Palier): boolean => !!COMPOSEURS[palier];

/**
 * **La** construction de la scène d'un circuit au palier demandé, avec les pas de ce palier et ceux demandés en plus (`plus` : le groupe « vie et ciel »
 * sur le palier 2 d'un téléphone récent, `GROUPE_VIE_CIEL`). Un palier ou un pas pas encore branché est une erreur (on charge ses modules d'abord : `chargerPas`).
 */
export function composer(track: Track, palette: PaletteName, palier: Palier = PALIER_DEFAUT, options: TrackSceneOptions = {}, plus: readonly string[] = []): TrackScene {
  const composeur = COMPOSEURS[palier];
  if (!composeur) throw new Error(`palier « ${palier} » pas branché : charger ses pas d'abord`);
  if (palier === PALIER_EXISTANT) return composeur(track, palette, options);
  const pas = pasVoulus(palier, plus, options.coupes).map((id) => {
    const p = PAS_BRANCHES.get(id);
    if (!p) throw new Error(`pas « ${id} » pas branché : charger son module d'abord`);
    return p;
  });
  return composeur(track, palette, pas.length > 0 ? { ...options, pas } : options);
}

/** Lot 46 : les modules des pas d'une scène — ceux du palier et ceux demandés en plus, moins ceux coupés (`?reglages=3-ombres`). */
export function pasVoulus(palier: Palier, plus: readonly string[] = [], coupes: readonly string[] = []): string[] {
  return [...new Set([...PAS_DU_PALIER[palier], ...plus])].filter((id) => !coupes.includes(id));
}

/** Lot 46 : les pas de la scène du jeu, branchés par leur module en se chargeant. */
const PAS_BRANCHES = new Map<string, PasScene>();

/** Branche un pas (appelé par son module, une fois chargé ; `undefined` le débranche : les essais). */
export function brancherPas(id: string, pas: PasScene | undefined) {
  if (pas) PAS_BRANCHES.set(id, pas);
  else PAS_BRANCHES.delete(id);
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
 * préchargement) ; lot 46 : `vie`, `ciel`, `ombres` ; lot 45 : `finition` (géométrie, variété, matière, traces, reflets ciblés), enregistrés de même par
 * `main.ts` ; le lot 47 y ajoutera `post`.
 */
export const PAS_DU_JEU: Registre = {};

/**
 * Les modules que demande chaque palier. Le palier 1 est dans le premier chargement : il n'en demande aucun. Lot 45 : le palier 2 prend la finition
 * (`finition` : géométrie, variété, matière sobre, traces, reflets ciblés — aucun appel de rendu de plus) ; lot 46 : le palier 3 (ordinateur) y ajoute la vie
 * (`vie` : drapeaux, foule, écrans, particules, confettis du Stade), le ciel (`ciel` : nuages, brume de profondeur) et les ombres fines (`ombres` : carte
 * 2048 posée devant la voiture).
 */
export const PAS_DU_PALIER: Record<Palier, readonly string[]> = { existant: ["existant"], P1: [], P2: ["finition"], P3: ["finition", "vie", "ciel", "ombres"] };

/**
 * Lot 46 : **le groupe « vie et ciel »** (décision du 22/10/2026) — la vie et le ciel sans aucune passe plein écran, que la règle de qualité (lot 45,
 * `qualite.ts`) ajoute au palier 2 (`reconstructeur.demander("P2", GROUPE_VIE_CIEL)`) ; `?reglages=2+vie+ciel` aussi.
 */
export const GROUPE_VIE_CIEL: readonly string[] = ["vie", "ciel"];

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
  /** Lot 46 : les pas que la scène courante prend en plus de ceux de son palier (le groupe « vie et ciel »). */
  plus(): readonly string[];
  /** Le palier voulu (la règle automatique, le réglage du joueur), et des pas en plus : on commence à charger leurs modules, la scène ne change pas encore. */
  demander(palier: Palier, plus?: readonly string[]): void;
  /** Vrai s'il y a une reconstruction en attente. */
  enAttente(): boolean;
  /** Reconstruit la scène si un palier est demandé, que ses pas sont chargés et que le jeu n'est pas en course ; rend vrai si elle a changé. */
  essayer(): Promise<boolean>;
}

export interface OptionsReconstructeur {
  palier?: Palier;
  /** Lot 46 : les pas en plus de la scène de départ. */
  plus?: readonly string[];
  /** Vrai à l'accueil, à la pause, à l'arrivée et au podium du Salon ; **faux pendant une course**. Relu après chaque attente. */
  peutReconstruire(): boolean;
  /** Construit la scène du circuit courant au palier donné (`composer`), ou `null` s'il n'y en a pas (arène plate). */
  construire(palier: Palier, plus: readonly string[]): TrackScene | null;
  /** Prend la nouvelle scène (la voiture, les fantômes et les effets y passent, l'ancienne est libérée). */
  adopter(scene: TrackScene, palier: Palier, plus: readonly string[]): void;
  pas?: Record<Palier, readonly string[]>;
  registre?: Registre;
}

export function creerReconstructeur(o: OptionsReconstructeur): Reconstructeur {
  let courant: Palier = o.palier ?? PALIER_DEFAUT;
  let courantPlus: readonly string[] = o.plus ?? [];
  let voulu: Palier | null = null;
  let vouluPlus: readonly string[] = [];
  const memes = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
  let prets: Promise<unknown> = Promise.resolve();
  let enCours = false;
  return {
    palier: () => courant,
    plus: () => courantPlus,
    demander(palier, plus = []) {
      if (palier === courant && memes(plus, courantPlus)) {
        voulu = null;
        return;
      }
      voulu = palier;
      vouluPlus = plus;
      prets = chargerPas([...(o.pas ?? PAS_DU_PALIER)[palier], ...plus], o.registre);
      prets.catch(() => (voulu = null)); // des pas qui ne chargent pas : on reste sur la scène courante
    },
    enAttente: () => voulu !== null,
    async essayer() {
      if (voulu === null || enCours || !o.peutReconstruire()) return false;
      enCours = true;
      try {
        const palier = voulu;
        const plus = vouluPlus;
        await prets;
        if (voulu !== palier || vouluPlus !== plus || !o.peutReconstruire()) return false; // la course a commencé pendant le chargement : on attend le prochain arrêt
        const scene = o.construire(palier, plus);
        if (!scene) return false;
        o.adopter(scene, palier, plus);
        courant = palier;
        courantPlus = plus;
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
