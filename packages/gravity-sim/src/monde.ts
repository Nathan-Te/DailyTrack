import * as K from "./constantes";
const { CASE, CLIGNOTANT_ALLUME, CLIGNOTANT_CYCLE, ALTERNE_BATTEMENT, LARGEUR_MORCEAU, LASER_ALLUME, LASER_ANNONCE, LASER_CYCLE, LIGNES } = K;
import { FACTEUR_LENT, FACTEUR_V1, FACTEUR_V2, FACTEUR_V3, MODE_AVION, MODE_GRAVITE, MODE_ONDE, MODE_RESSORT, type ModeDeVol } from "./constantes";
import type { Regles } from "./regles";
import type { ThemeGravity } from "./themes";

// Le monde : des colonnes de 12 cases, groupées en morceaux de 16 colonnes. Une case est un code entier. **Un morceau est une donnée** (cases, objets, chemin sûr) ; le terrain (`Terrain`) en donne le morceau
// numéro k, tiré de la graine du jour par le générateur (`generateur.ts`) ou écrit à la main par un test.

/** Les types de case. 1 à 4, 8 : solides en permanence ; 10 : le sol fragile (solide tant qu'il n'est pas tombé) ; 5, 6, 7 : solides selon le pas (`solide`) ; 2 : un pique (jamais solide, mortel dans sa boîte réduite) ; 9 : le vent (jamais solide). */
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
/** Lot GR7 : un sol fragile (solide, craque au premier contact et tombe `FRAGILE_DELAI` pas plus tard : l'état est dans la partie, `Partie.fragiles`). Toujours posé sur **une seule rangée** : dessous, le vide. */
export const FRAGILE = 10;
export type TypeCase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Un objet à ramasser, au centre `(x, y)` en unités (le morceau les écrit en coordonnées du monde). */
export interface Objet {
  x: number;
  y: number;
}
/**
 * Lot GR7 — **une scie** : un disque rouge qui va et vient sur un rail droit, du point `(x0, y0)` au point `(x1, y1)` (le centre du disque, en unités du monde) en `periode` pas, puis retour ; `decalage` : la phase (pas) ; calée par
 * le générateur sur l'arrivée du joueur. La position ne dépend que du pas (`positionScie`) : pure, comme tout le niveau. La collision est ronde (`SCIE_RAYON`, un peu réduite).
 */
export interface Scie {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  periode: number;
  decalage: number;
}
/**
 * Lot GR7 — **un laser** : un rayon rouge vertical dans la colonne `c` du morceau, des rangées `r0` à `r1` (incluses ; une case solide est l'émetteur à son bout). Il s'allume en rythme (`etatLaser`) : un mince trait pâle
 * 0,5 s avant, puis il brûle une durée fixe. `decalage` : la phase du cycle (pas), calée par le générateur sur l'arrivée du joueur.
 */
export interface Laser {
  c: number;
  r0: number;
  r1: number;
  decalage: number;
}
/** L'état d'un laser au pas `tick` : 0 éteint, 1 annonce (le trait pâle), 2 il brûle. Pure. */
export function etatLaser(tick: number, decalage: number): 0 | 1 | 2 {
  const c = (((tick + decalage) % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE;
  return c >= LASER_CYCLE - LASER_ALLUME ? 2 : c >= LASER_CYCLE - LASER_ALLUME - LASER_ANNONCE ? 1 : 0;
}
/** Le centre d'une scie au pas `tick` (unités du monde). Entier : un aller-retour en triangle, `periode` pas par sens. */
export function positionScie(s: Scie, tick: number): [number, number] {
  const p2 = 2 * s.periode;
  const ph = (((tick + s.decalage) % p2) + p2) % p2;
  const u = ph < s.periode ? ph : p2 - ph;
  return [s.x0 + Math.trunc(((s.x1 - s.x0) * u) / s.periode), s.y0 + Math.trunc(((s.y1 - s.y0) * u) / s.periode)];
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

/**
 * Un portail (lot GR6) : **une colonne du morceau** que le joueur franchit (son centre dépasse le milieu de la colonne). Les portails de mode changent le mode de vol, `gravite` y revient (et la gravité retombe vers le sol) ;
 * les portails de vitesse changent le facteur de vitesse de la caméra jusqu'au portail de vitesse suivant. Un portail n'est jamais solide : il est dans le niveau (`Morceau.portails`), pas dans les cases.
 */
export type TypePortail = "avion" | "onde" | "ressort" | "gravite" | "lent" | "v1" | "v2" | "v3";
export interface Portail {
  /** La colonne du morceau (0 à 15). */
  c: number;
  type: TypePortail;
}
/** Le mode que fait entrer un portail de mode (0 : le portail de retour à la gravité). `undefined` : un portail de vitesse. */
export const MODE_DU_PORTAIL: Readonly<Record<string, ModeDeVol | undefined>> = { avion: MODE_AVION, onde: MODE_ONDE, ressort: MODE_RESSORT, gravite: MODE_GRAVITE };
/** Le facteur de vitesse (en pour cent) d'un portail de vitesse. `undefined` : un portail de mode. */
export const FACTEUR_DU_PORTAIL: Readonly<Record<string, number | undefined>> = { lent: FACTEUR_LENT, v1: FACTEUR_V1, v2: FACTEUR_V2, v3: FACTEUR_V3 };

/** Le nom du motif d'un morceau : un identifiant du catalogue (`catalogue.ts`), `trouBas` ou `trouHaut`, `special` (la case spéciale du thème), ou `avion` / `onde` / `ressort` (une section). */
export type Motif = string;

export interface Morceau {
  /** Le numéro du morceau (0, 1, 2…). */
  m: number;
  theme: ThemeGravity;
  motif: Motif;
  /** Lot GR7 : la variante du motif (0, 1, 2… : longueurs, hauteurs, côté du danger) et sa difficulté de 1 à 5 (0 : non renseignée). */
  variante?: number;
  difficulte?: number;
  /** Lot GR7 : le danger d'une section (`scies`, `lasers`) ; les morceaux d'une section après le premier. */
  danger?: string;
  suiteDeSection?: true;
  /** Les cases, colonne par colonne : `cases[c * LIGNES + rangée]`, c de 0 à 15. */
  cases: Uint8Array;
  /** Les pièces, les gemmes et les bonus, au centre, en unités du monde (x absolu). Les pièces sont dans l'ordre où le chemin les croise. */
  pieces: readonly Objet[];
  gemmes: readonly Objet[];
  bonus: readonly Bonus[];
  /** Le chemin sûr (voir `Etape`). */
  chemin: readonly Etape[];
  /** Lot GR6 : les portails de ce morceau (de mode et de vitesse), dans l'ordre des colonnes. */
  portails: readonly Portail[];
  /**
   * Lot GR6 : **l'axe du chemin sûr d'une section à mode**, le centre de la boîte du joueur (en unités du monde, `y`) au milieu de chacune des 16 colonnes : le couloir de l'avion et de l'onde, la hauteur à tenir pour le
   * ressort. Vide dans un morceau de gravité. Les pièces d'une section sont posées dessus ; le pilote du robot le suit (`robot.ts`).
   */
  axe: readonly number[];
  /** Lot GR7 : les scies et les lasers du morceau (listes vides s'il n'y en a pas). Les écraseurs, plateformes mobiles et projectiles du GR8 auront leur liste ici. */
  scies: readonly Scie[];
  lasers: readonly Laser[];
  /** Le décalage du battement des cases qui battent de ce morceau (clignotants et alternées, en pas) : le générateur l'aligne sur l'arrivée attendue du joueur, pour que la traversée prévue soit possible. 0 pour les autres. */
  decalage: number;
  /** La gravité du chemin sûr à l'arrivée dans le morceau (celle de la sortie du précédent ; +1 au départ) et à sa sortie. */
  entree: 1 | -1;
  sortie: 1 | -1;
}

/** Un terrain : les morceaux, à la demande. Le même numéro rend toujours le même morceau. */
export interface Terrain {
  morceau(k: number): Morceau;
  /** Lot GR5 : les règles sous lesquelles ce terrain se joue (la version de la simulation du jour, ses réglages d'essai). Absentes d'un terrain écrit à la main : les règles de la version courante. */
  regles?: Regles;
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

/** Un terrain écrit à la main (les tests) : une grille de texte par morceau. Une ligne par rangée (12 lignes), 16 caractères : `.` vide, `#` bloc, `^` pique, `>` tapis, `~` glace, `c` clignotant, `a` / `b` alterné, `i` inverseur, `v` vent, `f` sol fragile. */
export function terrainDeTest(grilles: readonly (readonly string[])[], objets: { pieces?: readonly Objet[]; gemmes?: readonly Objet[]; bonus?: readonly Bonus[]; portails?: readonly (Portail & { m?: number })[]; scies?: readonly Scie[]; lasers?: readonly Laser[] } = {}): Terrain {
  const CODES: Record<string, number> = { ".": VIDE, "#": BLOC, "^": PIQUE, ">": TAPIS, "~": GLACE, c: CLIGNOTANT, a: ALTERNE_A, b: ALTERNE_B, i: INVERSEUR, v: VENT, f: FRAGILE };
  const couloir = Array.from({ length: LIGNES }, (_, r) => (r < 2 || r >= LIGNES - 2 ? "#".repeat(LARGEUR_MORCEAU) : ".".repeat(LARGEUR_MORCEAU)));
  const morceaux = new Map<number, Morceau>();
  const faire = (k: number): Morceau => {
    const g = grilles[k] ?? couloir;
    const cases = new Uint8Array(LARGEUR_MORCEAU * LIGNES);
    for (let r = 0; r < LIGNES; r++) for (let c = 0; c < LARGEUR_MORCEAU; c++) cases[c * LIGNES + r] = CODES[g[r]![c]!] ?? VIDE;
    return { m: k, theme: "foret", motif: "calme", cases, pieces: k === 0 ? (objets.pieces ?? []) : [], gemmes: k === 0 ? (objets.gemmes ?? []) : [], bonus: k === 0 ? (objets.bonus ?? []) : [], chemin: [], portails: (objets.portails ?? []).filter((p) => (p.m ?? 0) === k).map(({ c, type }) => ({ c, type })), axe: [], scies: k === 0 ? (objets.scies ?? []) : [], lasers: k === 0 ? (objets.lasers ?? []) : [], decalage: 0, entree: 1, sortie: 1 };
  };
  return {
    morceau(k) {
      let m = morceaux.get(k);
      if (!m) morceaux.set(k, (m = faire(k)));
      return m;
    },
  };
}
