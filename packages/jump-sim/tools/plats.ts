import { PRESS_HEIGHT_TILES, TILE_CRUMBLE, TILE_SOLID, UNITS_PER_TILE, circleHitsBox, isSolidTile, isSpikeTile, sawCenter, stalactiteFloorRow, stalactiteZone, type BuiltModule, type Level } from "../src/index";

// La **règle des plats** (lot 7), hors de la simulation : dans un morceau, un plat de plus de `FLAT_MAX` tuiles **sans défi** est interdit,
// sauf si l'élan est le défi lui-même (métadonnée `elan: oui`, `saut-long`) : alors `ELAN_FLAT_MAX` tuiles au plus.
//
// Un **plat sans défi** = des colonnes consécutives **du morceau** (sa grille, pas ses paliers) qui ont un sol à la même rangée — un bloc
// plein ou friable (un ressort lance : ce n'est pas un plat), la tuile au-dessus vide — et **aucun danger** dans les `FLAT_CLEARANCE` rangées
// au-dessus de ce sol : ni pic, ni scie (fixe ou mobile, sur tout son cycle), ni presse (lot 22 : toute sa course est un danger). Un plafond bas sans pics n'est pas un défi (un tunnel est un
// plat). Mesure géométrique, sur chaque variante construite (mutateurs compris), indépendante de la solution.

export const FLAT_MAX = 6;
export const ELAN_FLAT_MAX = 9;
/** Rangées au-dessus du sol où un danger fait du plat un défi (un saut normal y passe). */
export const FLAT_CLEARANCE = 3;

export interface Flat {
  /** Colonne de début (dans le niveau construit), longueur (tuiles), rangée du sol. */
  col: number;
  length: number;
  row: number;
}

/** Les tuiles « dangereuses » d'un niveau : pics, toute tuile qu'une scie touche sur son cycle, et (lot 22) toute la course d'une presse. `danger[r * w + c]`. */
function dangerMap(level: Level): Uint8Array {
  const W = level.width;
  const T = UNITS_PER_TILE;
  const d = new Uint8Array(W * level.height);
  for (let i = 0; i < d.length; i++) if (isSpikeTile(level.tiles[i]!)) d[i] = 1;
  for (const saw of level.saws) {
    const n = saw.cycle === 0 ? 1 : saw.cycle;
    for (let t = 0; t < n; t++) {
      const p = sawCenter(saw, t);
      const c0 = Math.max(0, Math.floor((p.x - saw.radius) / T));
      const c1 = Math.min(W - 1, Math.floor((p.x + saw.radius) / T));
      const r0 = Math.max(0, Math.floor((p.y - saw.radius) / T));
      const r1 = Math.min(level.height - 1, Math.floor((p.y + saw.radius) / T));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) if (!d[r * W + c] && circleHitsBox(p.x, p.y, saw.radius, { x: c * T, y: r * T, w: T, h: T })) d[r * W + c] = 1;
      }
    }
  }
  // Lot 22 : toute la course d'une presse (colonnes × rangées de sa position haute à sa position basse) est un danger.
  for (const p of level.presses) {
    for (let r = p.row; r < p.row + p.travel + PRESS_HEIGHT_TILES; r++) for (let c = p.col; c < p.col + p.width; c++) d[r * W + c] = 1;
  }
  // Lot 23 : un champignon est un défi (on rebondit en y entrant) : la tuile où il pousse n'est jamais un plat sans défi.
  for (const m of level.mushrooms) d[m.row * W + m.col] = 1;
  // Lot 24 : une stalactite est un défi sur toute sa colonne (de son corps jusqu'au bloc plein où elle se brise) et sur toute sa zone de déclenchement (le sol de
  // chaque colonne de la zone : on y court sous la menace, on ne peut pas s'y arrêter).
  for (const s of level.stalactites) {
    const floor = stalactiteFloorRow(level, s);
    for (let r = s.row; r < (floor < 0 ? level.height : floor); r++) d[r * W + s.col] = 1;
    const [z0, z1] = stalactiteZone(s);
    for (let c = Math.max(0, z0); c <= Math.min(W - 1, z1); c++) {
      for (let r = s.row + 2; r < level.height; r++) {
        if (isSolidTile(level.tiles[r * W + c]!)) {
          d[(r - 1) * W + c] = 1;
          break;
        }
      }
    }
  }
  return d;
}

/** Les plats sans défi d'un morceau construit (dans ses colonnes), du plus long au plus court. */
export function flatsOf(m: BuiltModule): Flat[] {
  const L = m.level;
  const W = L.width;
  const danger = dangerMap(L);
  const tile = (c: number, r: number) => L.tiles[r * W + c]!;
  const calmFloor = (c: number, r: number) => {
    const t = tile(c, r);
    if (t !== TILE_SOLID && t !== TILE_CRUMBLE) return false;
    if (tile(c, r - 1) === TILE_SOLID || tile(c, r - 1) === TILE_CRUMBLE || tile(c, r - 1) > TILE_CRUMBLE) return false;
    for (let k = 1; k <= FLAT_CLEARANCE && r - k >= 0; k++) if (danger[(r - k) * W + c]) return false;
    return true;
  };
  const out: Flat[] = [];
  for (let r = 1; r < L.height; r++) {
    let start = -1;
    for (let c = m.lead; c <= m.lead + m.width; c++) {
      const ok = c < m.lead + m.width && calmFloor(c, r);
      if (ok && start < 0) start = c;
      if (!ok && start >= 0) {
        out.push({ col: start, length: c - start, row: r });
        start = -1;
      }
    }
  }
  return out.sort((a, b) => b.length - a.length || a.col - b.col);
}

/** Le plus long plat sans défi d'un morceau construit (longueur 0 s'il n'y en a pas). */
export function longestFlat(m: BuiltModule): Flat {
  return flatsOf(m)[0] ?? { col: -1, length: 0, row: -1 };
}

/** Plus long plat permis pour ce morceau. */
export function flatLimit(elan: boolean): number {
  return elan ? ELAN_FLAT_MAX : FLAT_MAX;
}
