import { UNITS_PER_TILE } from "./constants";
import { isSolidTile, isSpikeTile, tileAt, type Level } from "./level";

// Lot 31 — **la place autour de la lame**. Retour de Nathan : en forêt, une cheminée étroite avec une scie qui monte et descend sur un rail au milieu tuait beaucoup de joueurs sans solution de
// rechange (le personnage glissait contre la paroi à 1 tuile de la lame). **Règle** (pure, entière, sur le texte du niveau — aucun fichier à tenir à jour) : dans un couloir ou une cheminée qu'on doit
// traverser, l'enveloppe balayée par une scie mobile (tous les points de sa course, rayon mortel compris : `bladeEnvelopes`) laisse **au moins `BLADE_ROOM_TILES` tuiles libres entre la lame et une
// paroi**, sur toute sa course : on peut sauter autour de la lame, pas seulement la croiser au bon moment.
//
// **Ce qui est un couloir** (`tightestLine`) : une ligne de la course (une rangée pour un rail plus haut que large — la cheminée —, une colonne pour un rail plus large que haut — le tunnel) flanquée d'un
// bloc ou d'un pic de chaque côté, dont la tuile du rail est libre (la scie n'est pas dans le sol) et, pour une cheminée, où l'on marche (un sol sous au moins une colonne : une fosse que la scie traverse
// d'un bord à l'autre n'est pas un couloir). **Ce qui n'en est pas** : une scie à l'air libre, une fosse, et **une porte** — une scie qui barre un puits d'une paroi à l'autre (`ressort-scie`, `traverse` ;
// `chute-pics` v2) : on la passe au bon moment, on ne la contourne pas ; la règle ne la lit pas (décision à confirmer par Nathan, README du lot 31).

/** Place libre exigée entre la lame (enveloppe de sa course) et une paroi, en tuiles. */
export const BLADE_ROOM_TILES = 2;

export interface BladeEnvelope {
  /** Identifiant de la scie. */
  id: string;
  /** Rectangle balayé (rayon mortel compris), en unités : x0 < x1, y0 < y1. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Les rectangles balayés par les scies **mobiles** d'un niveau (une scie fixe n'a pas de course : elle est dans le dessin du morceau). */
export function bladeEnvelopes(level: Pick<Level, "saws">): BladeEnvelope[] {
  const out: BladeEnvelope[] = [];
  for (const saw of level.saws) {
    if (saw.mode === "fixe") continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of saw.nodes) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    out.push({ id: saw.id, x0: x0 - saw.radius, x1: x1 + saw.radius, y0: y0 - saw.radius, y1: y1 + saw.radius });
  }
  return out;
}

const blocks = (t: number): boolean => isSolidTile(t) || isSpikeTile(t);
const standable = (t: number): boolean => isSolidTile(t);

/** Un côté de l'enveloppe, sur l'axe lu : dans un couloir vertical (cheminée) les parois sont à gauche et à droite, dans un couloir horizontal (tunnel) au plafond et au sol. */
type Axis = "x" | "y";

/** Vrai quand la lame fait plus que sa largeur dans le sens du couloir : une scie sur un rail vertical (plus haute que large) lit les parois de gauche et de droite. */
export function bladeAxis(env: BladeEnvelope): Axis {
  return env.y1 - env.y0 >= env.x1 - env.x0 ? "x" : "y";
}

/** La tuile à `along` (le long du couloir) et `across` (en travers : vers les parois). */
const tileOn = (level: Level, axis: Axis, along: number, across: number): number => (axis === "x" ? tileAt(level, across, along) : tileAt(level, along, across));

/**
 * Un couloir vertical est un passage **où l'on monte ou descend en marchant** : un trou sans sol (une fosse que la scie traverse d'un bord à l'autre, sans qu'on y entre) n'en est pas un. Pour une rangée
 * flanquée de deux parois, il faut qu'au moins une colonne de l'intervalle libre ait **en dessous** un bloc où se poser (le premier bloc rencontré, avant tout pic) ; sinon c'est une fosse.
 */
function hasFloor(level: Level, row: number, from: number, to: number): boolean {
  for (let col = from; col <= to; col++) {
    for (let r = row + 1; r < level.height; r++) {
      const t = tileAt(level, col, r);
      if (t === 0) continue;
      if (standable(t)) return true;
      if (isSpikeTile(t)) break;
    }
  }
  return false;
}

export interface BladeRoom {
  id: string;
  axis: Axis;
  /** Rangée (couloir vertical) ou colonne (couloir horizontal) la plus étroite de la course. */
  at: number;
  /** Place libre côté bas/gauche, puis haut/droite, en unités. */
  before: number;
  after: number;
  /** La plus grande des deux, en unités. */
  room: number;
}

/**
 * La ligne (rangée ou colonne) de la course qui laisse le moins de place entre l'enveloppe et une paroi, parmi celles qui sont **dans un couloir** : flanquées d'un bloc de chaque côté, la tuile du
 * rail libre (la scie n'est pas dans le sol), et un passage où l'on marche (`hasFloor`). `null` : aucune ligne balayée n'est dans un couloir (la lame est à l'air libre, dans une fosse ou barre le passage
 * en travers : une porte qu'on passe au bon moment n'est pas une lame à contourner).
 */
export function tightestLine(level: Level, env: BladeEnvelope, axis: Axis = bladeAxis(env)): BladeRoom | null {
  const T = UNITS_PER_TILE;
  const [a0, a1, c0, c1, aMax, cMax] = axis === "x" ? [env.y0, env.y1, env.x0, env.x1, level.height, level.width] : [env.x0, env.x1, env.y0, env.y1, level.width, level.height];
  const first = Math.max(0, Math.floor(a0 / T));
  const last = Math.min(aMax - 1, Math.floor((a1 - 1) / T));
  const mid = Math.floor((c0 + c1) / 2 / T);
  let worst: BladeRoom | null = null;
  for (let along = first; along <= last; along++) {
    if (blocks(tileOn(level, axis, along, mid))) continue;
    let lo = Math.floor(c0 / T) - 1;
    while (lo >= 0 && !blocks(tileOn(level, axis, along, lo))) lo--;
    let hi = Math.ceil(c1 / T);
    while (hi < cMax && !blocks(tileOn(level, axis, along, hi))) hi++;
    if (lo < 0 || hi >= cMax) continue;
    if (axis === "x" && !hasFloor(level, along, lo + 1, hi - 1)) continue;
    const before = c0 - (lo + 1) * T;
    const after = hi * T - c1;
    const room = Math.max(before, after);
    if (worst === null || room < worst.room) worst = { id: env.id, axis, at: along, before, after, room };
  }
  return worst;
}

/**
 * Ce qui ne va pas dans un niveau (morceau seul ou jour) pour la règle de la place autour de la lame : une ligne par scie mobile dont **une** ligne balayée, dans un couloir, laisse moins de
 * `BLADE_ROOM_TILES` tuiles entre la lame et la paroi la plus éloignée de l'enveloppe. Vide : la règle est tenue (ou il n'y a pas de couloir).
 */
export function bladeRoomProblems(level: Level): string[] {
  const out: string[] = [];
  const need = BLADE_ROOM_TILES * UNITS_PER_TILE;
  for (const env of bladeEnvelopes(level)) {
    const t = tightestLine(level, env);
    if (t !== null && t.room < need) out.push(`scie ${env.id} : ${(t.room / UNITS_PER_TILE).toFixed(2)} tuile libre ${t.axis === "x" ? "à la rangée" : "à la colonne"} ${t.at} (il en faut ${BLADE_ROOM_TILES})`);
  }
  return out;
}
