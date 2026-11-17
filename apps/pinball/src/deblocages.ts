import { NORME, UNITE, type Partie, type Table } from "@cdj/pinball-sim";

// Les déblocages vus du rendu (lot PBG3) : la porte, le poteau sauveur et l'aiguillage. **La simulation décide** (`Partie.passageOuvert`, `lampes`, `aiguillageVers`) ; ce fichier ne fait que dire où les dessiner et dans quel état, **en
// fonction du seul pas** — les deux rendus (three.js et à plat) lisent les mêmes fonctions, comme `rails.ts`. Rien ici n'est importé par la simulation, rien ne décide quoi que ce soit.

const px = (u: number): number => u / UNITE;
/** La montée de la porte (elle s'ouvre, elle se referme) dure 30 pas (0,05 s) ; le poteau sort en 24 pas et rentre en 30. */
export const PAS_PORTE = 30;
export const PAS_POTEAU_SORT = 24;
export const PAS_POTEAU_RENTRE = 30;
/** Les couleurs de l'aiguillage : vers le verrou (le halo du verrou), vers l'élément du thème (le halo du jackpot). */
export const COULEUR_VERS_VERROU = "#B8F6FF";
export const COULEUR_VERS_ELEMENT = "#FFF3A8";

export interface GeoPorte {
  /** Le milieu du battant, la direction du passage (de l'entrée vers la sortie : vecteur unitaire), sa perpendiculaire, la demi-largeur (px). */
  x: number;
  y: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  demi: number;
  /** Les deux bouts du battant fermé : `a` est le pivot, autour duquel il s'ouvre ; `b` son bout libre. */
  a: { x: number; y: number };
  b: { x: number; y: number };
  /** Les deux murs du passage (de leur bout sur le battant à leur fond). */
  murs: readonly { x0: number; y0: number; x1: number; y1: number }[];
  /** La flèche de la porte : devant son entrée (côté d'où la bille arrive), tournée dans le sens du passage. */
  fleche: { x: number; y: number; a: number };
}

/** La géométrie de la porte d'une table, en px (null : le plan d'essai n'en a pas). */
export function geoPorte(t: Table): GeoPorte | null {
  const g = t.passage;
  if (!g) return null;
  const ux = g.ux / NORME;
  const uy = g.uy / NORME;
  const nx = g.nx / NORME;
  const ny = g.ny / NORME;
  const prof = px(g.profondeur);
  const [[ax, ay], [bx, by]] = g.bouts;
  const murs = [[ax, ay], [bx, by]].map(([x, y]) => ({ x0: px(x!), y0: px(y!), x1: px(x!) - ux * prof, y1: px(y!) - uy * prof }));
  return {
    x: px(g.x),
    y: px(g.y),
    ux,
    uy,
    nx,
    ny,
    demi: px(g.l),
    a: { x: px(ax), y: px(ay) },
    b: { x: px(bx), y: px(by) },
    murs,
    // dans le passage, à mi-profondeur : la flèche qui monte vers le battant
    fleche: { x: px(g.x) - ux * prof * 0.5, y: px(g.y) - uy * prof * 0.5, a: Math.atan2(uy, ux) },
  };
}

const borne = (v: number): number => Math.max(0, Math.min(1, v));

/** L'ouverture de la porte, de 0 (fermée) à 1 (grande ouverte) : elle monte pendant `PAS_PORTE` pas depuis l'ouverture et redescend pendant les `PAS_PORTE` derniers pas. `?essai=porte` (ouverte pour de bon) : 1. */
export function ouverturePorte(p: Pick<Partie, "passageOuvert" | "reglages">): number {
  if (p.passageOuvert <= 0) return 0;
  const depuis = p.reglages.porteDuree - p.passageOuvert;
  const monte = depuis < 0 ? 1 : borne(depuis / PAS_PORTE);
  return Math.min(monte, borne(p.passageOuvert / PAS_PORTE));
}

/** Le bout libre du battant à l'ouverture `k` (0 à 1) : il pivote de 80° autour de son pivot et se rabat contre le mur. En px. */
export function boutLibre(g: GeoPorte, k: number): { x: number; y: number } {
  const a = k * 1.4;
  const dx = g.b.x - g.a.x;
  const dy = g.b.y - g.a.y;
  // il se rabat dans le passage, contre le mur du pivot (de la perpendiculaire vers l'arrière de l'axe du passage)
  const s = Math.sin(a);
  const c = Math.cos(a);
  return { x: g.a.x + dx * c - dy * s, y: g.a.y + dx * s + dy * c };
}

/** La sortie du poteau sauveur, de 0 (rentré) à 1 (sorti) : armé, il sort en `PAS_POTEAU_SORT` pas ; il rentre en `PAS_POTEAU_RENTRE` pas après son sauvetage. */
export function sortiePoteau(p: Pick<Partie, "lampes" | "sauveurTick" | "tick">): number {
  const arme = p.lampes[0] && p.lampes[1];
  const depuis = p.tick - p.sauveurTick;
  return arme ? borne(depuis / PAS_POTEAU_SORT) : borne(1 - depuis / PAS_POTEAU_RENTRE);
}

export interface GeoAiguillage {
  x: number;
  y: number;
  /** Les angles de la lame (radians, y vers le bas) : par défaut le long de la rampe, vers le verrou, vers l'élément du thème (`null` : pas de trajet). */
  defaut: number;
  versVerrou: number | null;
  versElement: number | null;
  /** La flèche de la bouche de la rampe : celle qui change de couleur. */
  rail: number;
}
export function geoAiguillage(t: Table): GeoAiguillage | null {
  const a = t.aiguillage;
  if (!a) return null;
  const rl = t.rails[a.rail]!;
  let k = 0;
  while (k < rl.ux.length - 1 && rl.cum[k + 1]! <= a.s) k++;
  const vers = (v: { x: number; y: number } | null): number | null => (v ? Math.atan2(v.y - a.y, v.x - a.x) : null);
  return { x: px(a.x), y: px(a.y), defaut: Math.atan2(rl.uy[k]!, rl.ux[k]!), versVerrou: vers(a.versVerrou), versElement: vers(a.versElement), rail: a.rail };
}
/** L'angle visé par la lame de l'aiguillage dans l'état courant de la partie (0 : le bout de la rampe, 1 : le verrou, 2 : l'élément du thème). */
export function angleVise(g: GeoAiguillage, vers: 0 | 1 | 2): number {
  return (vers === 1 ? g.versVerrou : vers === 2 ? g.versElement : null) ?? g.defaut;
}
/** Un angle qui se rapproche de sa cible, par le plus court chemin, de `pas` radians au plus. */
export function rapprocher(a: number, cible: number, pas: number): number {
  let d = cible - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= pas ? cible : a + Math.sign(d) * pas;
}
/** La couleur de la flèche de la rampe de l'aiguillage selon ce qu'il mène (`null` : le bout de la rampe, la flèche reste blanche). */
export const couleurAiguillage = (vers: 0 | 1 | 2): string | null => (vers === 1 ? COULEUR_VERS_VERROU : vers === 2 ? COULEUR_VERS_ELEMENT : null);
