import { PINBALL_GENERATOR_VERSION, UNITE, Partie, type Contenu, type Module, type Reglages, REGLAGES, type ThemePinball } from "../src/index";

// Des aides pour les tests de règles : une table écrite à la main (les six modules, dans l'ordre des emplacements) et une bille posée où l'on veut, en pixels.
export const JOUR_ESSAI = 20800;
/** `plan` : par défaut le plan d'essai (`classique`, la table des lots PB1 à PB4 : six emplacements, ni rampe ni orbite), pour que les tests des règles posent leurs modules aux mêmes endroits. */
export const contenuDe = (modules: readonly Module[] = ["spinner", "bumpers", "cibles", "cibles", "trou", "mini"], theme: ThemePinball = "foire", plan = "classique"): Contenu => ({ jour: JOUR_ESSAI, g: PINBALL_GENERATOR_VERSION, theme, plan, modules: [...modules] });
/** Une partie dont les six emplacements portent ce `module` (ou la liste donnée). */
export const partieDe = (modules?: readonly Module[], reglages: Reglages = REGLAGES, theme: ThemePinball = "foire"): Partie => new Partie(contenuDe(modules, theme), reglages);
export const pleine = (m: Module): Module[] => [m, m, m, m, m, m];

/** Pose la bille en jeu, en pixels de la table, avec sa vitesse en px/s. */
export function enJeu(p: Partie, x: number, y: number, vx = 0, vy = 0): Partie {
  p.dansLanceur = false;
  p.entree = p.tick;
  p.x = Math.round(x * UNITE);
  p.y = Math.round(y * UNITE);
  p.px = p.x;
  p.py = p.y;
  p.vx = Math.round(vx * UNITE);
  p.vy = Math.round(vy * UNITE);
  return p;
}
export function avancer(p: Partie, n: number): Partie {
  for (let i = 0; i < n && !p.finie; i++) p.avancer();
  return p;
}
/** Avance jusqu'à ce que `cond` soit vraie (au plus `max` pas) ; rend le nombre de pas faits, ou −1. */
export function jusqua(p: Partie, cond: (p: Partie) => boolean, max = 3000): number {
  for (let i = 0; i < max && !p.finie; i++) {
    p.avancer();
    if (cond(p)) return i + 1;
  }
  return -1;
}
export const pixels = (u: number): number => u / UNITE;
/** Un module au centre d'un emplacement (nom → rang). */
export const EMPL = { S1: 0, S2: 1, S3: 2, S4: 3, S5: 4, S6: 5 } as const;

export const PX = (u: number): number => u / UNITE;
/** La distance (px) du centre de la bille à un segment (coordonnées en unités). */
export function distanceSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey;
  let u = l2 === 0 ? 0 : ((x - ax) * ex + (y - ay) * ey) / l2;
  u = Math.max(0, Math.min(1, u));
  return PX(Math.hypot(x - (ax + ex * u), y - (ay + ey * u)));
}
/** Le centre de la bille est-il dans la table (mur gauche, arc du haut, mur droit) ? Tolérance en px. */
export function dansLaTable(x: number, y: number, marge: number): boolean {
  const X = PX(x);
  const Y = PX(y);
  if (X < 20 + marge || X > 372.5 - marge) return false;
  if (Y < 205) return Math.hypot(X - 196.25, Y - 205) <= 176.25 - marge;
  return true;
}
