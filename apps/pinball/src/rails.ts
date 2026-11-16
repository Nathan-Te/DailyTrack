import { UNITE, type Rail } from "@cdj/pinball-sim";

// Les rails vus du rendu (lot PBG1) : la simulation ne connaît que le tracé à plat (`Rail`) ; **la hauteur est une affaire de rendu**, commune aux deux rendus et au test. Un rail rejoint le plateau à ses bouts : sa hauteur
// monte de 0 à `rail.hauteur` sur `LONGUEUR_PENTE` px depuis chaque bout (en lissé), reste là, puis redescend. La bille posée sur un rail (`Partie.couche === 1`, abscisse `Partie.railS`) est dessinée à cette hauteur.

/** La longueur de la montée et de la descente aux bouts d'un rail, en px de la table (réduite à un tiers de la longueur d'un rail court). */
export const LONGUEUR_PENTE = 90;

/** La hauteur (px) d'un rail à l'abscisse `s` (unités de la simulation). */
export function hauteurRail(rail: Rail, s: number): number {
  const longueur = rail.len / UNITE;
  const d = s / UNITE;
  const k = Math.min(LONGUEUR_PENTE, longueur / 3);
  const t = Math.max(0, Math.min(1, Math.min(d, longueur - d) / k));
  return rail.hauteur * t * t * (3 - 2 * t);
}

/** Un point d'un rail : sa place sur la table (px), sa hauteur (px) et la direction du tracé (vecteur unitaire, flottant : le rendu seulement). */
export interface PointRail {
  x: number;
  y: number;
  h: number;
  dx: number;
  dy: number;
  /** L'abscisse curviligne (unités), pour rattacher le point à `Partie.railS`. */
  s: number;
}

/** Le point du rail à l'abscisse `s` (unités) : la bille d'une partie y est dessinée. */
export function pointDuRail(rail: Rail, s: number): PointRail {
  const n = rail.ux.length;
  const c = Math.max(0, Math.min(rail.len, s));
  let k = 0;
  while (k < n - 1 && rail.cum[k + 1]! <= c) k++;
  const u = (c - rail.cum[k]!) / UNITE;
  const dx = rail.ux[k]! / 16384;
  const dy = rail.uy[k]! / 16384;
  return { x: rail.x[k]! / UNITE + dx * u, y: rail.y[k]! / UNITE + dy * u, h: hauteurRail(rail, c), dx, dy, s: c };
}

/** Le rail échantillonné tous les `pas` px (au moins aux deux bouts) : de quoi construire un ruban, un tube ou une bande à plat. */
export function echantillons(rail: Rail, pas = 6): PointRail[] {
  const total = rail.len / UNITE;
  const n = Math.max(2, Math.ceil(total / pas) + 1);
  return Array.from({ length: n }, (_, i) => pointDuRail(rail, (rail.len * i) / (n - 1)));
}
