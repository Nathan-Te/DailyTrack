// Lot 38 — ce qu'est une direction de la scène : des fonctions de construction par élément (portique de départ, arrivée, porte de contrôle,
// plaques, panneaux, rebords, décor), paramétrées par thème, et une ambiance (ciel, lumière, brume) par thème. La vitrine (`/track/vitrine/`) les
// compare à l'existant ; les lots de mise en œuvre les reprendront telles quelles dans `trackMesh.ts` (voir le README du lot 38).
import type { BufferGeometry, Mesh, PerspectiveCamera, Scene, Texture, Vector3 } from "three";
import type { Block, PaletteName, Track } from "@cdj/sim";
import type { Builder, V3 } from "../meshKit";
import type { SignSpec } from "../signage";
import type { Look, Palette } from "../trackMesh";
import type { StyleRoute } from "./route";
import type { Affiches } from "./outils";
import type { Drapeaux } from "./drapeaux";
import type { Reglages } from "./paliers";
import type { PoseLog } from "../decorPose";
import type { Repere } from "./outils";
import type { Sol, Terrain } from "./decor/commun";

/** O : l'existant réécrit en direction (base et contrôle) ; A, B : les directions ; M : le mélange recommandé. C est un traitement de la lumière et des
 * matières (`directionC.ts`), appliqué à une scène déjà construite. */
export type DirectionId = "O" | "A" | "B" | "M";

/**
 * Les calques d'une scène : chacun est **un maillage fusionné** (un appel de rendu), quel que soit le nombre de pièces.
 * `route` éclairée (reçoit les ombres) ; `solide` éclairé qui projette une ombre (portiques, panneaux) ; `lumineux` sans éclairage, lisible
 * de jour comme de nuit (plaques de panneaux, bandeaux, néons, vibreurs) ; `decor` éclairé (reçoit, ne projette pas : lot 23) ;
 * `decorLumineux` (fenêtres, lampes) ; `bandeaux` : textes sur une texture (DÉPART, ARRIVÉE), un maillage chacun.
 */
export interface Calques {
  route: Builder;
  solide: Builder;
  lumineux: Builder;
  decor: Builder;
  decorLumineux: Builder;
  /** Décor dense (qualité 2) : comme `decor`, masqué en dessous. */
  dense: Builder;
  /** Voile translucide (porte de contrôle de l'existant) : seul calque transparent. */
  rideau: Builder;
  /** Affiches texturées par l'atlas de la direction (sponsors fictifs) : un maillage. */
  affiches: Affiches;
  bandeaux: Mesh[];
  /** Vue aérienne (miniatures) : pas de bandeaux de texte. */
  aerien: boolean;
  /** Retouche 38b : les rebords à part (ils projettent l'ombre de contact sur la piste ; la route, non). Absent : dans `route` (lot 38). */
  rebords?: Builder;
  /** Retouche 38b : drapeaux et banderoles souples (palier 2 : figés dans `solide` ; palier 3 : animés, un maillage). */
  drapeaux?: Drapeaux;
  /** Retouche 38b : écrans à diodes (palier 3, pas « écrans ») — quadrilatères dans le ruban des écrans (`vie.ts`). */
  ecrans?: Affiches;
  /** Retouche 38b : le chronomètre à diodes du portique de départ (palier 3, pas « écrans ») — sa propre texture, mise à jour en course. */
  chrono?: Affiches;
  /** Retouche 38b : spectateurs des tribunes (palier 3, pas « foule ») — position (pied), cap, couleur du maillot. */
  foule?: { x: number; y: number; z: number; cap: number; couleur: number }[];
  /**
   * Lot 43 : les feux de départ du portique, dans le calque `lumineux` ; le compositeur du jeu les allume pendant le décompte (`FeuxDepart`, palier1.ts).
   * Absent : feux rouges fixes (vitrine).
   */
  feux?: { poser(lumineux: Builder, run: () => void, colonne: number): void };
}

/** Lot 43 : les textes peints sur la scène (bandeaux des portiques), tirés du catalogue de la langue du joueur par le jeu. */
export interface TextesScene {
  depart: string;
  arrivee: string;
}

/**
 * Lot 43 : ce que le pas « géométrie » du palier 2 ajoute aux éléments du palier 1 (`finition.ts`, chargé à la demande) : le palier 1, dans le premier
 * chargement, n'importe pas `finition.ts` ; le compositeur de la vitrine (et le lot du palier 2) passe ces fonctions dans le contexte.
 */
export interface FinitionElements {
  /** Socles prolongés, pneus, boulons, câble, banderole et drapeaux d'un portique. */
  portique(c: Calques, x: Contexte, b: Block, q: number, w: number, drapeau: readonly number[]): void;
  /** Semelles boulonnées et jambe de force d'un panneau de virage (`r0` : son repère, `large` : sa demi-largeur). */
  panneau(c: Calques, x: Contexte, hote: Block, r0: Repere, large: number): void;
  /** Catadioptres sur les repères de vitesse. */
  rythme(c: Calques, x: Contexte, b: Block, rapide: boolean): void;
  /** Les piliers chanfreinés (`colonneChanfreinee`). */
  colonne(g: Builder, r: Repere, g0: number, g1: number, h0: number, h1: number, a0: number, a1: number, c: number, couleur: number): void;
}

/** Le thème vu par une direction : sa palette (celle du jeu, retouchée par la direction), son nom, la graine du décor. */
export interface Contexte {
  palette: PaletteName;
  pal: Palette;
  look: Look;
  track: Track;
  floorY: number;
  /** Retouche 38b : les pas du palier allumés (absent : lot 38, aucun). Une fonction de construction lit ce dont elle a besoin. */
  reglages?: Reglages;
  /** Retouche 38b : la suite de la variété, **distincte de celle du décor** (le décor reste à sa place quand on la coupe). */
  varie?: () => number;
  /** Lot 43 : le relevé de la pose (tests, `decorPose.ts`) ; absent dans le jeu. */
  log?: PoseLog;
  /** Lot 43 : les textes des bandeaux (catalogue du jeu ; la vitrine donne les siens, en français). Absents : pas de bandeau. */
  textes?: TextesScene;
  /** Lot 43 : les pièces du pas « géométrie » (palier 2), données par le compositeur qui a chargé `finition.ts`. */
  finition?: FinitionElements;
  /** Lot 44 : la variété du décor (palier 2, `finition.ts`), donnée par le compositeur de la vitrine : chaque instance posée varie un peu. */
  varierDecor?: { marque(c: CalquesDecor): unknown; varier(c: CalquesDecor, m: unknown, x: number, sol: number, z: number): void };
}

/** Ciel et lumière d'un thème pour une direction. */
export interface Ambiance {
  look: Look;
  /** Ciel : zénith et horizon ; `bandes` : aplats nets (direction A) au lieu d'un dégradé. */
  ciel: { zenith: number; horizon: number; bandes: boolean };
  /** Disque du soleil ou de la lune : couleur, taille (m à 400 m), `net` : un disque plein sans halo (A). */
  disque: { couleur: number; taille: number; net: boolean } | null;
  etoiles: number;
  /** Lumières : hémisphérique (ciel, sol, intensité), ambiante, soleil (couleur, intensité), hauteur du soleil (0–1). */
  hemi: [ciel: number, sol: number, intensite: number];
  ambiante: [couleur: number, intensite: number];
  soleil: [couleur: number, intensite: number];
  hauteurSoleil: number;
  brume: { couleur: number; near: number; far: number };
  /** Silhouettes lointaines : corps, sommet ; `plates` (A) : deux tons sans mélange ; `forme` : ce qui fait l'horizon du thème. */
  silhouettes: { corps: number; sommet: number; plates: boolean; forme: FormeHorizon };
}

/**
 * La forme de l'horizon d'un thème, le trait d'identité le plus visible depuis la piste (le décor proche est souvent loin en contrebas) :
 * pics (existant, Col, Banquise), collines rondes (Campagne), buttes (Rallye), mesas à strates (Canyon), immeubles (Ville), l'anneau des tribunes
 * et ses mâts (Stade), collines noires et ville allumée au loin (Nuit).
 */
export type FormeHorizon = "pics" | "collines" | "buttes" | "mesas" | "ville" | "tribunes" | "nuit";

export const HORIZONS: Record<PaletteName, FormeHorizon> = { stade: "tribunes", desert: "buttes", neige: "pics", nuit: "nuit", campagne: "collines", canyon: "mesas", alpin: "pics", ville: "ville", neon: "nuit" };

/** Une direction : tout ce qu'elle dessine. `null` pour un élément = celui de l'existant (aucun pour l'instant). */
export interface Direction {
  id: DirectionId;
  nom: string;
  /** Palette du thème vue par la direction (couleurs retouchées ; la géométrie ne change pas). */
  palette(nom: PaletteName, base: Palette): Palette;
  ambiance(nom: PaletteName, pal: Palette, look: Look): Ambiance;
  /** Ce que la direction dessine sur la route (rebords, vibreurs, bordures, marquages), pour un thème. */
  route(nom: PaletteName): StyleRoute;
  /** Matériau des calques éclairés : `standard` (l'existant, ombrage continu) ou `toon` (A : deux ou trois tons nets, des aplats). */
  materiau: "standard" | "toon";
  portiqueDepart(c: Calques, x: Contexte, b: Block, q: number): void;
  arrivee(c: Calques, x: Contexte, b: Block, q: number): void;
  porte(c: Calques, x: Contexte, b: Block): void;
  plaque(c: Calques, x: Contexte, b: Block): void;
  turbo(c: Calques, x: Contexte, b: Block): void;
  coupure(c: Calques, x: Contexte, b: Block): void;
  panneau(c: Calques, x: Contexte, hote: Block, s: SignSpec): void;
  /** Rythme de vitesse au bord de la piste (lot 15) : poteaux, arches des portions rapides. */
  rythme(c: Calques, x: Contexte, b: Block, rapide: boolean): void;
  /** L'atlas des affiches (sponsors fictifs) : dessiné une fois au chargement ; `null` sans affiches. */
  atlas?(): Texture | null;
  /** Le décor du thème autour de la piste (graine : id du circuit et palette, comme le jeu). */
  decor(c: Calques, x: Contexte, rnd: () => number): void;
}

/** Une place de décor : un point au sol dans une cellule vide près de la piste, et la direction de la route la plus proche. */
export interface PlaceDecor {
  x: number;
  z: number;
  /** Lot 44 : la hauteur du sol (relevé) à cette place. */
  y: number;
  /** Anneau : 1 = cellule voisine d'un bloc, 2 = une cellule plus loin, 3… */
  anneau: number;
  /** Vecteur unitaire (x, z) vers le centre du bloc le plus proche (un panneau publicitaire, une tribune y font face). */
  versRoute: [number, number];
  /** Hauteur de la route du bloc le plus proche. */
  yRoute: number;
  cx: number;
  cz: number;
}

/** Lot 44 : les calques où se construit le décor (un sous-ensemble des calques d'une scène). */
export type CalquesDecor = Pick<Calques, "decor" | "decorLumineux" | "dense" | "affiches"> &
  Partial<Pick<Calques, "solide" | "drapeaux" | "ecrans" | "foule">> & {
    /** Lot 46 : la tribune du départ, si elle a été posée (`decor/commun.ts`) ; le pas « vie » y accroche ses mâts, ses drapeaux et son ruban d'écrans. */
    tribune?: TribunePosee | null;
  };

/** Un spectateur de la tribune (pas « foule », lot 46) : où il se tient (pied), son cap, la couleur de son maillot. */
export interface Spectateur {
  x: number;
  y: number;
  z: number;
  cap: number;
  couleur: number;
}

/** Lot 46 : la tribune posée : le bas de sa façade côté piste (lue de gauche à droite depuis la piste), le pied des mâts (sur le toit, au fond). */
export interface TribunePosee {
  facade: [V3, V3];
  mats: V3[];
}

/**
 * Lot 46 (lot 44 : le décor arrive à la demande) : ce que le décor posé confie au pas « vie » — sa tribune, et ses spectateurs quand la foule est animée
 * (ils ne sont alors pas dessinés dans le décor) ; `decor` : le calque du décor, où se posent les mâts (avant que son maillage soit construit).
 */
export interface DecorVie {
  tribune: TribunePosee | null;
  foule: Spectateur[] | null;
  decor: Builder;
}

/**
 * Lot 44 : le décor d'un thème (`decor/<thème>.ts`, chargé à la demande) : ses recettes, que `decor/commun.ts` pose sur le sol relevé selon les règles du lot 37.
 * `recette` : un élément à une place (anneaux 1 et 2) ; `remplissage` : un élément simple de la qualité 2 (anneaux 2 et 3) ; `plus` : ce que le thème pose à sa
 * façon (le front de rue et les lampadaires de la Ville) ; `densite` : le nombre moyen d'éléments par cellule — recettes de l'anneau 1, de l'anneau 2, remplissage
 * de l'anneau 3 et de l'anneau 2 (`DENSITE` de `commun.ts` par défaut).
 */
export interface DecorTheme {
  densite?: readonly [anneau1: number, anneau2: number, remplissage3: number, remplissage2: number];
  recette(c: CalquesDecor, x: Contexte, p: PlaceDecor, rnd: () => number): void;
  remplissage(g: Builder, x: Contexte, p: PlaceDecor, rnd: () => number): void;
  plus?(s: Sol, c: CalquesDecor, x: Contexte, near?: (cx: number, cz: number) => boolean): void;
}

/** Lot 44 : ce que rend le chargement du décor d'un thème : de quoi le construire dans des calques (le sol relevé est rendu, pour les tests). */
export interface ModuleDecor {
  theme: DecorTheme;
  construire(c: CalquesDecor, x: Contexte, near?: (cx: number, cz: number) => boolean): Terrain;
  /** La matière de C, venue avec le décor : le grain (partagé, dessiné une fois), le sol lointain d'un thème, les coordonnées « monde » d'une géométrie. */
  grain(): Texture;
  sol(palette: PaletteName): Texture;
  uvMonde(g: BufferGeometry, pas: number): void;
}

export type { V3 };

// --- Lot 46 : les pas chargés à la demande, vus par la scène du jeu (`composerP1.ts`) ----------------------------------------------------

/** La scène construite, telle qu'un pas à la demande la voit pour y poser ses maillages. */
export interface ScenePas {
  scene: Scene;
  calques: Calques;
  x: Contexte;
  /** D'où vient la lumière du soleil ou de la lune (unitaire, lot 43 : le disque est posé de ce côté). */
  soleil: Vector3;
  /** Les parties coupées (`?reglages=3-particules`). */
  coupes: ReadonlySet<string>;
  /** Sans DOM (tests) : les formes seules, sans texture dessinée. */
  sansDom: boolean;
}

/** Ce qu'un pas anime une fois posé. **Un temps d'affichage, jamais l'état de la course.** */
export interface AnimationPas {
  animer?(t: number, camera: PerspectiveCamera, hauteurPx: number): void;
  /** La voiture passe la ligne (temps d'affichage). */
  arrivee?(t: number): void;
  /** Ce qu'il tient qui n'est pas libéré avec la scène (ou ce qu'elle ne doit pas libérer : une texture partagée). */
  dispose?(): void;
  /** Ce qu'il dit de lui (`?debug` : `__cdj.render.pas`). */
  stats?(): Record<string, unknown>;
  /**
   * Lot 44 : le décor du thème se pose (à la construction s'il est déjà chargé, sinon plus tard, hors course : `poserDecor`) — ce qui s'accroche à sa tribune
   * (mâts, drapeaux, ruban, foule). Une famille reste un seul maillage : le pas refait le sien.
   */
  decor?(d: DecorVie): void;
}

/**
 * Un pas de la scène du jeu, chargé à la demande (`PAS_DU_JEU`, socle.ts) : son module l'enregistre en se chargeant (`brancherPas`). Le palier 1
 * (`composerP1.ts`, premier chargement) n'en importe aucun : il appelle ses crochets.
 */
export interface PasScene {
  id: string;
  /** Avant les maillages et les éléments posés : ses pièces dans les calques (drapeaux, écrans, caissons) ; ce qui tient au décor vient par `decor`. */
  elements?(c: Calques, x: Contexte, coupes: ReadonlySet<string>): void;
  /** La scène construite : ses maillages, son animation. */
  poser?(s: ScenePas): AnimationPas | void;
  /** Ombres fines (palier 3) : carte (px) à la qualité 2, demi-côté (m), avance devant la voiture (m), décalage normal ; le décor projette aussi. */
  ombres?: { carte: number; demi: number; avant: number; normalBias: number };
  /** Il anime les spectateurs de la tribune : ils ne sont plus dessinés dans le décor (`DecorVie.foule`). */
  foule?: boolean;
}
