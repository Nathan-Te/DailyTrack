import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SANDBOX_LEVEL,
  UNITS_PER_TILE,
  initialPlayer,
  parseLevel,
  stepPlayer,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";

// Outils communs des tests du personnage : petits niveaux, placement, suites de commandes et « pilotes » en boucle fermée
// (ils regardent l'état pour décider : cheminée, mur isolé). Rien ici n'entre dans la simulation.

export const T = UNITS_PER_TILE;
export const P: Readonly<JumpParams> = DEFAULT_JUMP_PARAMS;
export { INPUT_JUMP as J, INPUT_LEFT as L, INPUT_RIGHT as R };

/** Niveau à partir de lignes ASCII (départ et arrivée ajoutés s'il n'y en a pas : `parseLevel` les exige). */
export function level(rows: string[]): Level {
  const text = rows.join("\n");
  return parseLevel(text);
}

/** Salle vide `w × h` (intérieur), bordée de murs, sol en bas, départ à gauche. */
export function room(w: number, h: number): Level {
  const rows = [];
  for (let r = 0; r < h; r++) rows.push(`#${".".repeat(w)}#`);
  rows[h - 1] = `#S${".".repeat(w - 2)}F#`;
  rows.push("#".repeat(w + 2));
  return level(rows);
}

/** Le personnage posé au sol dans la colonne `col` (centré), à l'arrêt, sur la rangée `row` (celle où il se tient). */
export function standAt(lv: Level, col: number, row: number): PlayerState {
  const s = initialPlayer(lv);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  return { ...s, x, y, vx: 0, vy: 0, ground: 1, air: 0 };
}

/** Le personnage en l'air à (x, y) (unités), sans coyote ni mur récent. */
export function floatAt(lv: Level, x: number, y: number, vx = 0, vy = 0): PlayerState {
  return { ...initialPlayer(lv), x, y, vx, vy, ground: 0, air: 255, wallSide: 0, wallAir: 255 };
}

/** Joue `n` pas avec la même commande. */
export function hold(s: PlayerState, input: number, n: number, lv: Level, p: Readonly<JumpParams> = P): PlayerState {
  for (let i = 0; i < n; i++) s = stepPlayer(s, input, lv, p);
  return s;
}

/** Suite de commandes en séries : [commande, nombre de pas]… → une commande par pas. */
export function expand(runs: readonly (readonly [number, number])[]): number[] {
  const out: number[] = [];
  for (const [input, n] of runs) for (let i = 0; i < n; i++) out.push(input);
  return out;
}

/** Suite de commandes → séries (pour l'écrire dans un fichier de référence). */
export function compress(inputs: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of inputs) {
    const last = out[out.length - 1];
    if (last && last[0] === i) last[1]++;
    else out.push([i, 1]);
  }
  return out;
}

/** Hauteur gagnée en tuiles (y vers le bas). */
export const risen = (from: PlayerState, to: PlayerState) => (from.y - to.y) / T;

/**
 * Pilote de cheminée, en boucle fermée : saute dès qu'il touche un mur (en relâchant d'abord le bouton s'il le tenait), pousse vers le
 * mur d'en face, tient le saut en montée. Renvoie l'état final, les commandes jouées et le pas où il a passé `topY` (−1 sinon).
 */
export function climbChimney(
  lv: Level,
  s: PlayerState,
  firstDir: number,
  topY: number,
  maxTicks: number,
  p: Readonly<JumpParams> = P,
): { state: PlayerState; inputs: number[]; reachedAt: number } {
  let toward = firstDir;
  let prevJ = 0;
  const inputs: number[] = [];
  let reachedAt = -1;
  for (let t = 0; t < maxTicks && reachedAt < 0; t++) {
    const touching = !s.ground && s.wallAir === 0 ? s.wallSide : 0;
    let j = 0;
    if (s.ground && t > 0) j = prevJ ? 0 : INPUT_JUMP;
    else if (touching !== 0) {
      if (prevJ) toward = touching; // relâcher d'abord, toujours contre le mur
      else {
        j = INPUT_JUMP;
        toward = -touching;
      }
    } else if (prevJ && s.vy < 0) j = INPUT_JUMP;
    const input = (toward > 0 ? INPUT_RIGHT : INPUT_LEFT) | j;
    s = stepPlayer(s, input, lv, p);
    inputs.push(input);
    prevJ = j ? 1 : 0;
    if (s.y + PLAYER_HEIGHT <= topY) reachedAt = t + 1;
  }
  return { state: s, inputs, reachedAt };
}

/**
 * Pilote du mur isolé : toujours poussé vers le mur (côté `wall`), il saute à chaque contact. Renvoie la meilleure hauteur atteinte
 * (pied de la boîte, unités) et les commandes.
 */
export function climbWall(
  lv: Level,
  s: PlayerState,
  wall: number,
  maxTicks: number,
  p: Readonly<JumpParams> = P,
): { best: number; state: PlayerState; inputs: number[] } {
  let prevJ = 0;
  let best = s.y;
  const inputs: number[] = [];
  const toward = wall > 0 ? INPUT_RIGHT : INPUT_LEFT;
  for (let t = 0; t < maxTicks; t++) {
    const touching = !s.ground && s.wallAir === 0 && s.wallSide === wall;
    let j = 0;
    if ((s.ground && t > 0) || touching) j = prevJ ? 0 : INPUT_JUMP;
    else if (prevJ && s.vy < 0) j = INPUT_JUMP;
    s = stepPlayer(s, toward | j, lv, p);
    inputs.push(toward | j);
    prevJ = j ? 1 : 0;
    if (s.y < best) best = s.y;
  }
  return { best, state: s, inputs };
}

export { SANDBOX_LEVEL };
