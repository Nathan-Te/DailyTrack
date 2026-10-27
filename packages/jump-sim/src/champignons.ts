import { ATTEMPT_DEAD, ATTEMPT_RUNNING, circleHitsBox, initialAttempt, mushroomBounce, playerBox, spikeBox, stepAttempt, type AttemptEvents, type AttemptState, type Box } from "./attempt";
import { boxHits, tileOf } from "./collide";
import { UNITS_PER_TILE } from "./constants";
import {
  MUSHROOM_CHARS,
  MUSHROOM_DOWN,
  MUSHROOM_LEFT,
  MUSHROOM_NAMES,
  MUSHROOM_RIGHT,
  MUSHROOM_UP,
  TILE_SOLID,
  isSpikeTile,
  mushroomPad,
  type Level,
  type Mushroom,
} from "./level";
import { DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./player";
import { pressCourse } from "./presses";

// Les règles du générateur pour les champignons (lot 23) — ce qu'un morceau ou un niveau du jour doit tenir pour qu'un champignon reste lisible et équitable.
// Fonctions pures (le générateur les applique aux morceaux à champignons, les tests à tout le catalogue) :
//   1. **Posé sur du plein** : un champignon est contre un bloc **plein** (`TILE_SOLID` : ni friable, ni clignotant, ni tapis, ni glace, ni ressort) — le sol sous un champignon
//      de sol, le plafond au-dessus d'un champignon de plafond, le mur à gauche d'un champignon `)`, le mur à droite d'un champignon `(`.
//   2. **Rien de mortel sur la trajectoire d'un rebond pendant ses 0,3 premières secondes** (`MUSHROOM_SAFE_TICKS` = 36 pas), qu'il soit simple ou renforcé : le joueur a toujours
//      le temps de réagir. La trajectoire est **simulée** (`stepAttempt`, le jeu lui-même) depuis chaque façon de toucher le chapeau (`touchStarts` : plusieurs positions de la boîte
//      sur le chapeau, y compris collée au support), avec l'élan d'avant (immobile, ou à la vitesse de course dans un sens ou l'autre pour un champignon de sol ou de plafond ;
//      immobile ou en montée pour un champignon de mur) et trois façons de piloter pendant ces 0,3 s (rien, gauche, droite). Aucune boîte du personnage ne touche, à aucun pas :
//      un pic (sa boîte mortelle), une scie (le disque d'une scie fixe ; **tout le trajet** d'une scie mobile, quelle que soit la phase de son
//      horloge), toute la course d'une presse, ni ne sort par le bas de la grille ; et le personnage n'y meurt pas.
//   3. **Aucun point de passage (ni le départ ni l'arrivée) dans la trajectoire** : les tuiles `S`, `C`, `F` ne sont recouvertes par aucune de ces boîtes.
//   4. **La trajectoire reste dans son morceau** : les boîtes restent dans les colonnes de la section du champignon (au niveau du jour, hors du morceau, il y a les paliers, les
//      points de passage et le morceau voisin : ce qu'on ne regarde pas ici).

const T = UNITS_PER_TILE;

/** Pas pendant lesquels rien de mortel ne doit se trouver sur la trajectoire d'un rebond : 0,3 s. */
export const MUSHROOM_SAFE_TICKS = 36;
/** Vitesse d'approche essayée (unités/pas) pour un champignon de sol ou de plafond (course) et vitesse verticale d'un champignon de mur (un saut qui monte). */
const APPROACH_VX = [-375, 0, 375] as const;
const APPROACH_VY = [-800, 0] as const;
/** Les façons de piloter pendant les 0,3 s : rien, gauche, droite (le saut tenu ne change rien à une trajectoire qui ne se coupe pas). */
const POLICIES = [0, INPUT_LEFT, INPUT_RIGHT] as const;

const tileCode = (level: Level, col: number, row: number): number => (col < 0 || row < 0 || col >= level.width ? TILE_SOLID : row >= level.height ? 0 : level.tiles[row * level.width + col]!);

/** La tuile qui porte un champignon : `[col, rangée]` du bloc contre lequel il est posé. */
export function mushroomSupport(m: Mushroom): [number, number] {
  switch (m.dir) {
    case MUSHROOM_UP:
      return [m.col, m.row + 1];
    case MUSHROOM_DOWN:
      return [m.col, m.row - 1];
    case MUSHROOM_RIGHT:
      return [m.col - 1, m.row];
    case MUSHROOM_LEFT:
      return [m.col + 1, m.row];
    default:
      throw new RangeError(`mushroomSupport : l'orientation ${m.dir} n'existe pas`);
  }
}

/** Les façons de toucher le chapeau (coins hauts-gauches de la boîte du personnage, unités) : sur le chapeau, au bord, au milieu, et collée au support. */
function touchStarts(level: Level, m: Mushroom): { x: number; y: number }[] {
  const pad = mushroomPad(m);
  const span = (lo: number, hi: number, flush: number | null): number[] => {
    const v = [lo, Math.trunc((lo + hi) / 2), hi];
    if (flush !== null) v.push(flush);
    return v;
  };
  const flushX = m.dir === MUSHROOM_RIGHT ? m.col * T : m.dir === MUSHROOM_LEFT ? (m.col + 1) * T - PLAYER_WIDTH : null;
  const flushY = m.dir === MUSHROOM_UP ? (m.row + 1) * T - PLAYER_HEIGHT : m.dir === MUSHROOM_DOWN ? m.row * T : null;
  const xs = span(pad.x - PLAYER_WIDTH + 1, pad.x + pad.w - 1, flushX);
  const ys = span(pad.y - PLAYER_HEIGHT + 1, pad.y + pad.h - 1, flushY);
  const out: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    for (const y of ys) {
      const key = `${x}:${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Chevauche le chapeau (strictement) sans être dans un bloc.
      if (x < pad.x + pad.w && pad.x < x + PLAYER_WIDTH && y < pad.y + pad.h && pad.y < y + PLAYER_HEIGHT && !boxHits(level, x, y, PLAYER_WIDTH, PLAYER_HEIGHT)) out.push({ x, y });
    }
  }
  return out;
}

/** La boîte englobante du trajet entier d'une scie mobile (tous les pas de son cycle), agrandie de son rayon. */
function sawReach(level: Level): Box[] {
  return level.saws.map((saw) => {
    if (saw.cycle === 0) return { x: saw.nodes[0]!.x - saw.radius, y: saw.nodes[0]!.y - saw.radius, w: 2 * saw.radius, h: 2 * saw.radius };
    const xs = saw.nodes.map((n) => n.x);
    const ys = saw.nodes.map((n) => n.y);
    const x0 = Math.min(...xs) - saw.radius;
    const y0 = Math.min(...ys) - saw.radius;
    return { x: x0, y: y0, w: Math.max(...xs) + saw.radius - x0, h: Math.max(...ys) + saw.radius - y0 };
  });
}

const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Ce qui ne va pas dans la pose des champignons d'un niveau : le support (règle 1) et, au niveau du jour, aucun point de passage ni départ dans leur section (vide : conformes). */
export function mushroomProblems(level: Level): string[] {
  const out: string[] = [];
  level.mushrooms.forEach((m) => {
    const where = `champignon ${MUSHROOM_CHARS[m.dir]} (${m.col},${m.row})`;
    const [sc, sr] = mushroomSupport(m);
    if (tileCode(level, sc, sr) !== TILE_SOLID) out.push(`${where} : pas posé sur un bloc plein (${sc},${sr})`);
    const sec = level.sections.find((s) => m.col >= s.c0 && m.col <= s.c1);
    if (sec === undefined) {
      if (level.sections.length > 0) out.push(`${where} : dans aucune section`);
      return;
    }
    for (const [name, cell] of [["départ", level.start] as const, ["arrivée", level.finish] as const, ...level.checkpoints.map((c, i) => [`point ${i + 1}`, c] as const)]) {
      if (cell.col >= sec.c0 && cell.col <= sec.c1) out.push(`${where} : le ${name} (${cell.col},${cell.row}) est dans sa section`);
    }
  });
  return out;
}

/**
 * Règles 2 à 4 : la trajectoire des 0,3 premières secondes de chaque rebond (simple et renforcé, voir l'en-tête) — vide : conformes. **Coûteux** (quelques centaines de
 * trajectoires par champignon) : le générateur ne l'applique qu'à chaque morceau du catalogue, une fois (`mushroomPieceProblems`, `daily.ts`).
 */
export function mushroomSweepProblems(level: Level): string[] {
  const out: string[] = [];
  const saws = sawReach(level);
  const presses = level.presses.map((p) => pressCourse(p));
  const marks: { name: string; box: Box }[] = [
    { name: "départ", box: { x: level.start.col * T, y: level.start.row * T, w: T, h: T } },
    { name: "arrivée", box: { x: level.finish.col * T, y: level.finish.row * T, w: T, h: T } },
    ...level.checkpoints.map((c, i) => ({ name: `point ${i + 1}`, box: { x: c.col * T, y: c.row * T, w: T, h: T } })),
  ];
  const hazard = (box: Box): string | null => {
    if (box.y + box.h > level.height * T) return "sort par le bas de la grille";
    for (let r = Math.max(0, tileOf(box.y)); r <= tileOf(box.y + box.h - 1); r++) {
      for (let c = Math.max(0, tileOf(box.x)); c <= Math.min(level.width - 1, tileOf(box.x + box.w - 1)); c++) {
        const t = level.tiles[r * level.width + c]!;
        if (isSpikeTile(t) && overlap(box, spikeBox(t, c, r))) return `touche le pic (${c},${r})`;
      }
    }
    for (const [i, saw] of level.saws.entries()) {
      if (saw.cycle === 0 ? circleHitsBox(saw.nodes[0]!.x, saw.nodes[0]!.y, saw.radius, box) : overlap(box, saws[i]!)) return `touche la scie ${saw.id}`;
    }
    for (const [i, p] of level.presses.entries()) if (overlap(box, presses[i]!)) return `touche la course de la presse ${p.id}`;
    return null;
  };
  level.mushrooms.forEach((m) => {
    const where = `champignon ${MUSHROOM_CHARS[m.dir]} (${m.col},${m.row}, ${MUSHROOM_NAMES[m.dir]})`;
    const sec = level.sections.find((s) => m.col >= s.c0 && m.col <= s.c1);
    const wall = m.dir === MUSHROOM_RIGHT || m.dir === MUSHROOM_LEFT;
    let reported = false;
    for (const start of touchStarts(level, m)) {
      for (const approach of wall ? APPROACH_VY : APPROACH_VX) {
        for (const boost of [false, true]) {
          for (const policy of POLICIES) {
            let state: AttemptState = initialAttempt(level);
            const player = mushroomBounce({ ...state.player, x: start.x, y: start.y, ground: 0, air: 255, vx: wall ? 0 : approach, vy: wall ? approach : 0, held: 1 }, m.dir, boost);
            state = { ...state, status: ATTEMPT_RUNNING, player };
            const check = (s: AttemptState, step: number): string | null => {
              const box = playerBox(s.player);
              const h = hazard(box);
              if (h !== null) return `${h} (pas ${step})`;
              if (s.status === ATTEMPT_DEAD) return `le personnage y meurt (pas ${step})`;
              if (sec !== undefined && (tileOf(box.x) < sec.c0 || tileOf(box.x + box.w - 1) > sec.c1)) return `sort de sa section (pas ${step})`;
              for (const mark of marks) if (overlap(box, mark.box)) return `passe sur le ${mark.name} (pas ${step})`;
              return null;
            };
            let why = check(state, 0);
            for (let t = 1; why === null && t <= MUSHROOM_SAFE_TICKS; t++) {
              state = stepAttempt(state, policy | INPUT_JUMP, level, DEFAULT_JUMP_PARAMS);
              why = check(state, t);
            }
            if (why !== null && !reported) {
              reported = true;
              out.push(`${where}, rebond ${boost ? "renforcé" : "simple"} depuis (${start.x},${start.y}), élan ${approach}, pilotage ${policy} : ${why}`);
            }
          }
        }
      }
    }
  });
  return out;
}

/** Un rebond d'une partie jouée : le pas (le n-ième de `inputs`, à partir de 0), le champignon (indice dans `Level.mushrooms`), son orientation et s'il est renforcé. */
export interface MushroomContact {
  step: number;
  index: number;
  dir: number;
  boost: boolean;
}

/** Les rebonds d'une suite de commandes jouée depuis `start` (outils et tests : ce que fait vraiment une solution). S'arrête à la mort ou à l'arrivée. */
export function mushroomContacts(level: Level, start: AttemptState, inputs: readonly number[]): MushroomContact[] {
  const out: MushroomContact[] = [];
  const events: AttemptEvents = { mushroom: -1, boost: 0, shake: -1, shatter: -1 };
  let s = start;
  for (let t = 0; t < inputs.length; t++) {
    s = stepAttempt(s, inputs[t]!, level, DEFAULT_JUMP_PARAMS, events);
    if (events.mushroom >= 0) out.push({ step: t, index: events.mushroom, dir: level.mushrooms[events.mushroom]!.dir, boost: events.boost === 1 });
    if (s.status !== ATTEMPT_RUNNING) break;
  }
  return out;
}
