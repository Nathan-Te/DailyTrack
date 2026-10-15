import { TILE_SOLID, UNITS_PER_TILE, type Level } from "@cdj/jump-sim";

// Taches de peinture (lot 3), **placement seulement** (pur, testé ; le dessin est dans `actors.ts`) : à chaque mort, une tache de la
// couleur du personnage se pose sur la ou les surfaces solides les plus proches (sol, mur ou plafond). Pas du sang : de la couleur, des
// formes rondes. Une tache est un petit groupe de disques **centrés sur une face exposée d'un bloc plein** ; au rendu, ils sont découpés par
// les blocs pleins (pochoir) : la peinture est sur le bloc, elle ne déborde jamais dans le vide.
// Tout est déterminé par la position de la mort (graine = position) : au rechargement, chaque tache revient au même endroit.

/**
 * Une tache ne se pose pas au-delà de cette distance (tuiles) de toute surface. Assez grand pour qu'une chute au fond d'un grand vide (le
 * gouffre des friables de l'essai fait 39 tuiles de large) peigne quand même le bas du mur le plus proche : chaque mort laisse sa trace.
 * La recherche s'élargit par paliers (`STAIN_STEPS`) : presque toujours, le premier suffit.
 */
export const STAIN_REACH = 48;
const STAIN_STEPS = [3, 6, 12, 24, STAIN_REACH];
/** Faces prises en plus de la plus proche : celles à moins de cette marge (tuiles) de plus — une mort dans un coin peint les deux murs. */
export const STAIN_MARGIN = 0.6;
/** Au plus ce nombre de faces peintes par mort, et de disques par tache. */
export const STAIN_FACES = 4;
export const STAIN_DISCS = 8;

/** Un disque de peinture, en tuiles (x vers la droite, **y vers le bas**, comme la grille). */
export interface StainDisc {
  x: number;
  y: number;
  r: number;
  /** Nuance (−1 à 1) autour de la couleur du personnage. */
  shade: number;
}

/** Une face exposée : le segment entre un bloc plein et une tuile non pleine, et sa normale (vers le vide). */
interface Face {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  nx: number;
  ny: number;
}

/** Petit générateur à graine (affichage seulement). */
function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const solidAt = (level: Level, col: number, row: number) => col >= 0 && row >= 0 && col < level.width && row < level.height && level.tiles[row * level.width + col] === TILE_SOLID;
/** Une tuile où la peinture peut « voler » : dans la grille et pas un bloc (plein, friable ou ressort : codes 1 à 3). */
const openAt = (level: Level, col: number, row: number) => col >= 0 && row >= 0 && col < level.width && row < level.height && !(level.tiles[row * level.width + col]! >= 1 && level.tiles[row * level.width + col]! <= 3);

/** Faces exposées des blocs pleins autour de (px, py) (tuiles), dans un carré de côté 2 × `reach` (plus une tuile de marge). */
function facesAround(level: Level, px: number, py: number, reach: number): Face[] {
  const faces: Face[] = [];
  const c0 = Math.floor(px - reach) - 1;
  const c1 = Math.floor(px + reach) + 1;
  const r0 = Math.floor(py - reach) - 1;
  const r1 = Math.floor(py + reach) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!solidAt(level, c, r)) continue;
      if (openAt(level, c, r - 1)) faces.push({ x0: c, y0: r, x1: c + 1, y1: r, nx: 0, ny: -1 }); // dessus (sol)
      if (openAt(level, c, r + 1)) faces.push({ x0: c, y0: r + 1, x1: c + 1, y1: r + 1, nx: 0, ny: 1 }); // dessous (plafond)
      if (openAt(level, c - 1, r)) faces.push({ x0: c, y0: r, x1: c, y1: r + 1, nx: -1, ny: 0 }); // côté gauche (mur)
      if (openAt(level, c + 1, r)) faces.push({ x0: c + 1, y0: r, x1: c + 1, y1: r + 1, nx: 1, ny: 0 }); // côté droit (mur)
    }
  }
  return faces;
}

/** Point du segment le plus proche de (px, py), et la distance. */
function nearest(f: Face, px: number, py: number): { x: number; y: number; d: number } {
  const x = Math.min(Math.max(px, Math.min(f.x0, f.x1)), Math.max(f.x0, f.x1));
  const y = Math.min(Math.max(py, Math.min(f.y0, f.y1)), Math.max(f.y0, f.y1));
  return { x, y, d: Math.hypot(px - x, py - y) };
}

/**
 * La tache d'une mort au centre (x, y) (unités de la simulation) : des disques posés sur la ou les faces de blocs pleins les plus proches,
 * tout le long de ces faces (jamais au-delà de leurs bouts : on ne peint que ce qui est solide). Vide si aucune surface n'est à portée.
 */
export function stainFor(level: Level, x: number, y: number): StainDisc[] {
  const px = x / UNITS_PER_TILE;
  const py = y / UNITS_PER_TILE;
  // Par paliers : une face à moins de `reach` est forcément dans le carré de ce palier, la plus proche trouvée est donc la plus proche.
  let candidates: { f: Face; x: number; y: number; d: number }[] = [];
  for (const reach of STAIN_STEPS) {
    candidates = facesAround(level, px, py, reach)
      .map((f) => ({ f, ...nearest(f, px, py) }))
      .filter((c) => c.d <= reach)
      .sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y);
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) return [];
  const dmin = candidates[0]!.d;
  const chosen = candidates.filter((c) => c.d <= dmin + STAIN_MARGIN).slice(0, STAIN_FACES);
  const rnd = rand(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));
  // Plus la mort est loin de la surface, plus la tache est petite (la peinture a volé), sans disparaître.
  const size = 0.5 + 0.35 * rnd();
  const discs: StainDisc[] = [];
  for (const c of chosen) {
    const fade = Math.max(0.45, 1 - (c.d - dmin) / 1.5) * Math.max(0.55, 1 - dmin / 8);
    const main = size * fade;
    discs.push({ x: c.x, y: c.y, r: main, shade: rnd() * 2 - 1 });
    // Gouttes autour, le long de la même face (et seulement dessus).
    const drops = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < drops && discs.length < STAIN_DISCS; k++) {
      const along = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.45);
      const horizontal = c.f.ny !== 0;
      const lo = horizontal ? Math.min(c.f.x0, c.f.x1) : Math.min(c.f.y0, c.f.y1);
      const hi = horizontal ? Math.max(c.f.x0, c.f.x1) : Math.max(c.f.y0, c.f.y1);
      const t = Math.min(Math.max((horizontal ? c.x : c.y) + along, lo), hi);
      discs.push({ x: horizontal ? t : c.x, y: horizontal ? c.y : t, r: main * (0.35 + 0.3 * rnd()), shade: rnd() * 2 - 1 });
    }
    if (discs.length >= STAIN_DISCS) break;
  }
  return discs.slice(0, STAIN_DISCS);
}

/** Le disque est-il centré sur une face exposée d'un bloc plein ? (Ce que vérifient les tests : la peinture repose sur du solide.) */
export function onSolidFace(level: Level, d: StainDisc): boolean {
  const eps = 1e-9;
  const onX = Math.abs(d.x - Math.round(d.x)) < eps;
  const onY = Math.abs(d.y - Math.round(d.y)) < eps;
  if (onY) {
    const row = Math.round(d.y);
    const col = Math.min(Math.floor(d.x), level.width - 1);
    for (const c of [col, Math.ceil(d.x) - 1]) {
      if (solidAt(level, c, row) && openAt(level, c, row - 1)) return true; // sol
      if (solidAt(level, c, row - 1) && openAt(level, c, row)) return true; // plafond
    }
  }
  if (onX) {
    const col = Math.round(d.x);
    const row = Math.min(Math.floor(d.y), level.height - 1);
    for (const r of [row, Math.ceil(d.y) - 1]) {
      if (solidAt(level, col, r) && openAt(level, col - 1, r)) return true; // face gauche du bloc
      if (solidAt(level, col - 1, r) && openAt(level, col, r)) return true; // face droite du bloc
    }
  }
  return false;
}
