import { PINBALL_GENERATOR_VERSION, UNITE, Partie, type Contenu, type Module, type Reglages, REGLAGES } from "../src/index";

// Des aides pour les tests de règles : une table écrite à la main (les six modules, dans l'ordre des emplacements) et une bille posée où l'on veut, en pixels.
export const JOUR_ESSAI = 20800;
export const contenuDe = (modules: readonly Module[] = ["spinner", "bumpers", "cibles", "cibles", "trou", "mini"]): Contenu => ({ jour: JOUR_ESSAI, g: PINBALL_GENERATOR_VERSION, theme: "foire", modules: [...modules] });
/** Une partie dont les six emplacements portent ce `module` (ou la liste donnée). */
export const partieDe = (modules?: readonly Module[], reglages: Reglages = REGLAGES): Partie => new Partie(contenuDe(modules), reglages);
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
