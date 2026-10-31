// Lot 56 — ce qu'une ambiance de thème est, avant d'être jouée : un lit continu, une couche liée au décor, des flux d'événements espacés, des réactions. Pur (aucun accès à Web Audio) :
// `index.ts` le joue, les recettes de `themes/` le fabriquent, les tests le lisent.
import type { Banque } from "./kit";

/** Les huit thèmes de Track (l'ambiance suit le thème, pas la palette : le Néon prend celle de la Nuit). */
export type ThemeAmbiance = "stade" | "rallye" | "banquise" | "campagne" | "canyon" | "col" | "ville" | "nuit";

export const THEMES_AMBIANCE: readonly ThemeAmbiance[] = ["stade", "rallye", "banquise", "campagne", "canyon", "col", "ville", "nuit"];

/** Le thème d'ambiance d'une palette de Track (les noms de `PaletteName` de `@cdj/sim`, écrits ici en texte : ce module n'importe rien de la simulation). */
export function themeAmbianceDe(palette: string): ThemeAmbiance {
  switch (palette) {
    case "stade":
      return "stade";
    case "desert":
    case "rallye":
      return "rallye";
    case "neige":
    case "banquise":
      return "banquise";
    case "alpin":
    case "col":
      return "col";
    case "canyon":
      return "canyon";
    case "campagne":
      return "campagne";
    case "ville":
      return "ville";
    default:
      return "nuit"; // nuit, neon
  }
}

/** Les moments de la course auxquels une ambiance peut réagir (au Stade, la foule). */
export type Reaction = "checkpoint" | "finish";

/** Un flux d'événements : une variante de la banque jouée à intervalles aléatoires, à un endroit et à une hauteur tirés. */
export interface FluxDef {
  /** Nom du groupe de variantes dans la banque. */
  nom: string;
  /** Écart (s) entre deux événements : tiré entre les deux. */
  ecart: readonly [number, number];
  /** Délai (s) avant le premier événement : tiré entre les deux (les flux rares ne doivent pas attendre une minute pour qu'on les entende). */
  premier: readonly [number, number];
  /** Volume relatif (tiré entre les deux). */
  gain: readonly [number, number];
  /** Position stéréo fixe, tirée entre les deux (−1 gauche, 1 droite). */
  pan: readonly [number, number];
  /** Pour une source qui passe (une voiture) : le pan va de `de` à `a` pendant l'événement (le sens est tiré au hasard). */
  balayage?: readonly [number, number];
  /** Hauteur de lecture (1 = telle que rendue) : tirée entre les deux. */
  hauteur: readonly [number, number];
  /** Passe-bas de la distance (Hz). */
  coupure: number;
}

export interface DonneesAmbiance {
  theme: ThemeAmbiance;
  /** Gain de l'ambiance entière : le lit est rendu à 0,05 d'écart-type, ce gain le ramène sous le moteur au ralenti (≈ 0,03). */
  niveau: number;
  /** Le lit : deux canaux, sans couture. */
  lit: Float32Array[];
  /** Un lit joué à une seconde hauteur (≈ 0,87) pour que la boucle ne se retrouve jamais : faux pour un son tonal que ce changement fausserait. */
  deuxLectures: boolean;
  /** La couche liée au décor (tribune, lampadaires…) : toujours là un peu (`base`), plus forte quand le décor est proche. */
  local?: { canaux: Float32Array[]; base: number };
  banque: Banque;
  flux: FluxDef[];
  /** Les réactions : le nom du groupe de variantes de la banque et son volume. */
  reactions: Partial<Record<Reaction, { nom: string; gain: number }>>;
}

/** Ce que l'ambiance lit de la course : la vitesse, « en course », la position du décor. Rien d'autre. */
export interface EntreeAmbiance {
  /** Vitesse de la voiture (m/s). */
  vitesse: number;
  /** La course tourne (pas en pause, pas à l'arrivée, fenêtre fermée) : sinon l'ambiance se tait. */
  actif: boolean;
  /** Le décor qui chante (tribune, lampadaires…) : de quel côté (−1 gauche, 1 droite) et à quelle proximité (0 loin, 1 tout près). */
  decor?: { cote: number; proche: number } | null;
  /** Instant (s) où régler les paramètres : par défaut l'horloge du contexte ; un rendu hors ligne donne le sien. */
  t?: number;
}

/** Les fonctions de mixage : une ambiance discrète que la vitesse couvre peu à peu (le vent de la course prend le relais). */
export const VITESSE_PLEINE = 60;

const lisse = (x: number): number => {
  const u = x < 0 ? 0 : x > 1 ? 1 : x;
  return u * u * (3 - 2 * u);
};

/** Part de l'ambiance qui reste selon la vitesse : 1 à l'arrêt, `PLANCHER` à partir de `VITESSE_PLEINE`. */
export const PLANCHER = 0.22;
export function niveauSelonVitesse(v: number): number {
  return 1 - (1 - PLANCHER) * lisse(v / VITESSE_PLEINE);
}

/** Coupure passe-bas (Hz) de l'ambiance : large à l'arrêt, plus sourde en vitesse (ce qui est lointain disparaît d'abord). */
export function coupureSelonVitesse(v: number): number {
  return 9000 - 6200 * lisse(v / VITESSE_PLEINE);
}

/** Part des réactions (foule) qui reste selon la vitesse : elles doivent s'entendre en course, on les couvre moins. */
export function niveauReaction(v: number): number {
  return 1 - 0.4 * lisse(v / VITESSE_PLEINE);
}
