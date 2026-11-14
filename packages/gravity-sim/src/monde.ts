import { CASE, CLIGNOTANT_ALLUME, CLIGNOTANT_CYCLE, ALTERNE_BATTEMENT, LARGEUR_MORCEAU, LIGNES } from "./constantes";
import type { ThemeGravity } from "./themes";

// Le monde : des colonnes de 12 cases, groupées en morceaux de 16 colonnes. Une case est un code entier. **Un morceau est une donnée** (cases, objets, chemin sûr) ; le terrain (`Terrain`) en donne le morceau
// numéro k, tiré de la graine du jour par le générateur (`generateur.ts`) ou écrit à la main par un test.

/** Les types de case. 1 à 4, 8 : solides en permanence ; 5, 6, 7 : solides selon le pas (`solide`) ; 2 : un pique (jamais solide, mortel dans sa boîte réduite) ; 9 : le vent (jamais solide). */
export const VIDE = 0;
export const BLOC = 1;
export const PIQUE = 2;
export const TAPIS = 3;
export const GLACE = 4;
export const CLIGNOTANT = 5;
export const ALTERNE_A = 6;
export const ALTERNE_B = 7;
export const INVERSEUR = 8;
export const VENT = 9;
export type TypeCase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Un objet à ramasser, au centre `(x, y)` en unités (le morceau les écrit en coordonnées du monde). */
export interface Objet {
  x: number;
  y: number;
}
export type TypeBonus = "bouclier" | "aimant";
export interface Bonus extends Objet {
  type: TypeBonus;
}

/**
 * Une étape du chemin sûr : le joueur se tient sur la rangée `y` (la rangée de sa boîte) de la colonne `c0` incluse à `c1` exclue (colonnes du morceau, 0 à 16), la gravité vaut `g` (+1 : il est posé sur la case
 * du dessous, −1 : il est accroché à celle du dessus). C'est la suite des surfaces et des gravités que le générateur sait franchissable (le robot du lot GR2 la suivra) ; les pièces du morceau sont posées dessus.
 */
export interface Etape {
  c0: number;
  c1: number;
  y: number;
  g: 1 | -1;
}

export type Motif = "calme" | "trouBas" | "trouHaut" | "zigzag" | "pilier" | "pics" | "milieu" | "escalier" | "etages" | "inverseur" | "ilots" | "special";

export interface Morceau {
  /** Le numéro du morceau (0, 1, 2…). */
  m: number;
  theme: ThemeGravity;
  motif: Motif;
  /** Les cases, colonne par colonne : `cases[c * LIGNES + rangée]`, c de 0 à 15. */
  cases: Uint8Array;
  /** Les pièces, les gemmes et les bonus, au centre, en unités du monde (x absolu). Les pièces sont dans l'ordre où le chemin les croise. */
  pieces: readonly Objet[];
  gemmes: readonly Objet[];
  bonus: readonly Bonus[];
  /** Le chemin sûr (voir `Etape`). */
  chemin: readonly Etape[];
  /** Le décalage du battement des cases qui battent de ce morceau (clignotants et alternées, en pas) : le générateur l'aligne sur l'arrivée attendue du joueur, pour que la traversée prévue soit possible. 0 pour les autres. */
  decalage: number;
  /** La gravité du chemin sûr à l'arrivée dans le morceau (celle de la sortie du précédent ; +1 au départ) et à sa sortie. */
  entree: 1 | -1;
  sortie: 1 | -1;
}

/** Un terrain : les morceaux, à la demande. Le même numéro rend toujours le même morceau. */
export interface Terrain {
  morceau(k: number): Morceau;
}

/** La case (colonne absolue `cx` ≥ 0, rangée `cy`) d'un morceau : `VIDE` hors de l'écran. */
export function caseDe(terrain: Terrain, cx: number, cy: number): number {
  if (cy < 0 || cy >= LIGNES || cx < 0) return VIDE;
  const k = (cx / LARGEUR_MORCEAU) | 0;
  return terrain.morceau(k).cases[(cx - k * LARGEUR_MORCEAU) * LIGNES + cy]!;
}

/** La case est-elle solide au pas `tick` ? `decalage` : celui de son morceau (cases qui battent). */
export function solide(type: number, tick: number, decalage = 0): boolean {
  switch (type) {
    case BLOC:
    case TAPIS:
    case GLACE:
    case INVERSEUR:
      return true;
    case CLIGNOTANT:
      return (tick + decalage) % CLIGNOTANT_CYCLE < CLIGNOTANT_ALLUME;
    case ALTERNE_A:
      return (((tick + decalage) / ALTERNE_BATTEMENT) | 0) % 2 === 0;
    case ALTERNE_B:
      return (((tick + decalage) / ALTERNE_BATTEMENT) | 0) % 2 === 1;
    default:
      return false;
  }
}

/** La colonne absolue, en unités, du bord gauche d'une colonne. */
export const xDeColonne = (cx: number): number => cx * CASE;

/** Un terrain écrit à la main (les tests) : une grille de texte par morceau. Une ligne par rangée (12 lignes), 16 caractères : `.` vide, `#` bloc, `^` pique, `>` tapis, `~` glace, `c` clignotant, `a` / `b` alterné, `i` inverseur, `v` vent. */
export function terrainDeTest(grilles: readonly (readonly string[])[], objets: { pieces?: readonly Objet[]; gemmes?: readonly Objet[]; bonus?: readonly Bonus[] } = {}): Terrain {
  const CODES: Record<string, number> = { ".": VIDE, "#": BLOC, "^": PIQUE, ">": TAPIS, "~": GLACE, c: CLIGNOTANT, a: ALTERNE_A, b: ALTERNE_B, i: INVERSEUR, v: VENT };
  const couloir = Array.from({ length: LIGNES }, (_, r) => (r < 2 || r >= LIGNES - 2 ? "#".repeat(LARGEUR_MORCEAU) : ".".repeat(LARGEUR_MORCEAU)));
  const morceaux = new Map<number, Morceau>();
  const faire = (k: number): Morceau => {
    const g = grilles[k] ?? couloir;
    const cases = new Uint8Array(LARGEUR_MORCEAU * LIGNES);
    for (let r = 0; r < LIGNES; r++) for (let c = 0; c < LARGEUR_MORCEAU; c++) cases[c * LIGNES + r] = CODES[g[r]![c]!] ?? VIDE;
    return { m: k, theme: "foret", motif: "calme", cases, pieces: k === 0 ? (objets.pieces ?? []) : [], gemmes: k === 0 ? (objets.gemmes ?? []) : [], bonus: k === 0 ? (objets.bonus ?? []) : [], chemin: [], decalage: 0, entree: 1, sortie: 1 };
  };
  return {
    morceau(k) {
      let m = morceaux.get(k);
      if (!m) morceaux.set(k, (m = faire(k)));
      return m;
    },
  };
}
