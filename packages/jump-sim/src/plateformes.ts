import { circleHitsBox } from "./attempt";
import { tileOf } from "./collide";
import { UNITS_PER_TILE } from "./constants";
import { TILE_EMPTY, platformPos, sawCenter, type Level, type Platform } from "./level";
import { PLAYER_WIDTH } from "./player";

// Les règles de trajet des plateformes mobiles (lot 20) — ce qu'un morceau ou un niveau du jour doit tenir pour qu'une plateforme ne fasse jamais de mal.
// Fonctions pures (le générateur les applique à chaque niveau v5, les tests au catalogue) :
//   1. **Dégagement** : à aucun pas de son cycle, une plateforme ne passe à moins de `PLATFORM_HEADROOM_ROWS` (2) rangées d'un plafond ou d'un plein au-dessus
//      d'elle (sur toute sa largeur) : celui qu'elle porte a toujours la place de se tenir debout et de sauter.
//   2. **Jamais poussé** : la place que prend le personnage porté (la largeur de la plateforme plus ce qui dépasse de chaque bord, au-dessus d'elle) ne contient,
//      sur tout le trajet, ni mur, ni pic, ni scie (une scie sur tout son cycle) : la plateforme ne le pousse jamais contre un mur ni vers un danger. Un trajet
//      vertical n'a pas de côté à surveiller pour les murs (il ne pousse pas de côté) : seuls comptent les pleins au-dessus de lui.
//   3. **Dans son morceau** : le trajet reste à au moins une colonne des bords de sa section (on n'y monte jamais depuis un palier avant d'être entré dans la
//      section, l'horloge de la section y étant déjà celle du morceau), et deux trajets ne se recoupent pas.
// Le point de passage sûr à toute phase (le palier d'un `S` ou d'un `C` n'est jamais traversé par une plateforme) est dans `respawnProblems` (`daily.ts`) et
// `palierProblems` (`modules.ts`).

const T = UNITS_PER_TILE;

/** Rangées libres exigées au-dessus d'une plateforme, sur tout son trajet. */
export const PLATFORM_HEADROOM_ROWS = 2;

/** Les positions extrêmes que prend une plateforme (coin haut-gauche, unités) : de `a` à `b`. */
export function platformExtent(p: Platform): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: Math.min(p.a.col, p.b.col) * T,
    x1: Math.max(p.a.col, p.b.col) * T,
    y0: Math.min(p.a.row, p.b.row) * T,
    y1: Math.max(p.a.row, p.b.row) * T,
  };
}

const tileAtOrSolid = (level: Level, col: number, row: number): number => (col < 0 || row < 0 || col >= level.width ? 1 : row >= level.height ? TILE_EMPTY : level.tiles[row * level.width + col]!);

/** Ce qui ne va pas dans les plateformes d'un niveau (vide : conformes). */
export function platformProblems(level: Level): string[] {
  const out: string[] = [];
  level.platforms.forEach((p, k) => {
    const where = `plateforme ${p.id}`;
    const sec = level.sections[p.section]!;
    const e = platformExtent(p);
    const w = p.width * T;
    // 3. Dans son morceau : à au moins une colonne des bords de sa section.
    const c0 = tileOf(e.x0);
    const c1 = tileOf(e.x1) + p.width - 1;
    if (c0 < sec.c0 + 1 || c1 > sec.c1 - 1) out.push(`${where} : son trajet (colonnes ${c0}-${c1}) sort de la section ${sec.name} (${sec.c0 + 1}-${sec.c1 - 1} permis)`);
    for (let j = 0; j < k; j++) {
      const q = level.platforms[j]!;
      const f = platformExtent(q);
      const overlaps = e.x0 < f.x1 + q.width * T && f.x0 < e.x1 + w && e.y0 < f.y1 + T && f.y0 < e.y1 + T;
      if (overlaps) out.push(`${where} : son trajet recoupe celui de ${q.id}`);
    }
    // 1 et 2. Pour chaque pas du cycle : le dégagement au-dessus de la plateforme, et la place du personnage porté.
    const sidesX = p.axis === "h" ? PLAYER_WIDTH : 0;
    let blocked: string | null = null;
    const seen = new Set<string>();
    for (let t = 0; t < p.cycle && blocked === null; t++) {
      const at = platformPos(p, t);
      const key = `${at.x}:${at.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const colA = tileOf(at.x - sidesX);
      const colB = tileOf(at.x + w + sidesX - 1);
      const rowA = tileOf(at.y - PLATFORM_HEADROOM_ROWS * T);
      const rowB = tileOf(at.y - 1);
      for (let r = rowA; r <= rowB && blocked === null; r++) {
        for (let c = colA; c <= colB; c++) {
          if (tileAtOrSolid(level, c, r) !== TILE_EMPTY) {
            blocked = `à moins de ${PLATFORM_HEADROOM_ROWS} rangées d'un plein ou d'un danger (case ${c},${r}, pas ${t})`;
            break;
          }
        }
      }
    }
    if (blocked) out.push(`${where} : ${blocked}`);
    // 2 (suite). Les scies : sur leur cycle entier contre la place que le personnage porté peut prendre sur tout le trajet.
    const zone = { x: e.x0 - PLAYER_WIDTH, y: e.y0 - PLATFORM_HEADROOM_ROWS * T, w: e.x1 - e.x0 + w + 2 * PLAYER_WIDTH, h: e.y1 - e.y0 + PLATFORM_HEADROOM_ROWS * T };
    for (const saw of level.saws) {
      const steps = saw.cycle === 0 ? 1 : saw.cycle;
      for (let t = 0; t < steps; t++) {
        const s = sawCenter(saw, t);
        if (circleHitsBox(s.x, s.y, saw.radius, zone)) {
          out.push(`${where} : la scie ${saw.id} passe près de son trajet (pas ${t} de son cycle)`);
          break;
        }
      }
    }
  });
  return out;
}
