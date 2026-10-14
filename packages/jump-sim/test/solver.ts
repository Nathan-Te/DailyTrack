import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  UNITS_PER_TILE,
  initialAttempt,
  stepAttempt,
  type AttemptState,
  type JumpParams,
  type Level,
} from "../src/index";

// Petit chercheur de solution, **hors de la simulation** (il ne fait que l'appeler) : recherche par faisceau sur des actions grossières
// (direction tenue × saut tenu, pendant `chunk` pas), guidée par une suite de points de passage écrite à la main. Toutes les branches d'une
// même couche ont joué le même nombre de pas : deux états proches (position, vitesse, blocs friables, sections) sont confondus, le meilleur
// reste. La première couche où une branche touche l'arrivée donne la solution. Sert à `SOLVE=1 npx vitest run …/essai-solution.test.ts`.

export interface Waypoint {
  /** Centre visé, en tuiles. */
  x: number;
  y: number;
  /** Rayon (Chebyshev) dans lequel le point est atteint, en tuiles. */
  r: number;
}

interface Node {
  state: AttemptState;
  wp: number;
  parent: Node | null;
  action: number;
}

/** Une action = une direction tenue tout le paquet × un motif du bouton de saut : relâché, tenu, ou relâché un pas puis réappuyé. */
const DIRS = [INPUT_RIGHT, 0, INPUT_LEFT];
const PATTERNS = ["off", "on", "repress"] as const;
type Pattern = (typeof PATTERNS)[number];
const ACTIONS: { dir: number; jump: Pattern }[] = DIRS.flatMap((dir) => PATTERNS.map((jump) => ({ dir, jump })));

function bitsAt(action: { dir: number; jump: Pattern }, k: number): number {
  const j = action.jump === "on" || (action.jump === "repress" && k > 0) ? INPUT_JUMP : 0;
  return action.dir | j;
}

export interface SolveOptions {
  chunk?: number;
  beam?: number;
  maxTicks?: number;
  perCell?: number;
  /** État de départ (par défaut : le départ du niveau). */
  start?: AttemptState;
  /** Pour mettre au point : chaque couche gardée. */
  dump?: (tick: number, states: AttemptState[]) => void;
  log?: (line: string) => void;
}

const T = UNITS_PER_TILE;

function center(s: AttemptState): { x: number; y: number } {
  return { x: (s.player.x + PLAYER_WIDTH / 2) / T, y: (s.player.y + PLAYER_HEIGHT / 2) / T };
}

function advanceWp(s: AttemptState, wp: number, wps: readonly Waypoint[]): number {
  while (wp < wps.length) {
    const c = center(s);
    const w = wps[wp]!;
    if (Math.abs(c.x - w.x) <= w.r && Math.abs(c.y - w.y) <= w.r) wp++;
    else break;
  }
  return wp;
}

function score(n: Node, wps: readonly Waypoint[]): number {
  if (n.wp >= wps.length) return n.wp * 1e6;
  const c = center(n.state);
  const w = wps[n.wp]!;
  return n.wp * 1e6 - (Math.abs(c.x - w.x) + Math.abs(c.y - w.y)) * 100;
}

function key(n: Node): string {
  const p = n.state.player;
  return [n.wp, p.x >> 8, p.y >> 8, p.vx >> 4, p.vy >> 4, p.ground, p.held, p.wallSide, Math.min(p.wallAir, 8), n.state.crumbles.join(""), n.state.sections.join(",")].join("|");
}

/** Cherche une suite de commandes qui mène du départ à l'arrivée en passant par `wps`. Rend les commandes (une par pas), ou `null`. */
export function solve(level: Level, params: Readonly<JumpParams>, wps: readonly Waypoint[], options: SolveOptions = {}): number[] | null {
  const chunk = options.chunk ?? 4;
  const beam = options.beam ?? 1500;
  const maxTicks = options.maxTicks ?? 120 * 60;
  const perCell = options.perCell ?? 2;
  let layer: Node[] = [{ state: options.start ?? initialAttempt(level), wp: 0, parent: null, action: -1 }];
  for (let t = 0; t < maxTicks; t += chunk) {
    const seen = new Map<string, Node>();
    for (const node of layer) {
      for (let action = 0; action < ACTIONS.length; action++) {
        let s = node.state;
        let done = false;
        for (let k = 0; k < chunk && !done; k++) {
          s = stepAttempt(s, bitsAt(ACTIONS[action]!, k), level, params);
          if (s.status === ATTEMPT_DEAD) done = true;
          if (s.status === ATTEMPT_FINISHED) done = true;
        }
        if (s.status === ATTEMPT_DEAD) continue;
        const child: Node = { state: s, wp: advanceWp(s, node.wp, wps), parent: node, action };
        if (s.status === ATTEMPT_FINISHED) return unwind(child, chunk, level, params);
        const k = key(child);
        const prev = seen.get(k);
        if (!prev || score(child, wps) > score(prev, wps)) seen.set(k, child);
      }
    }
    // Diversité : au plus `perCell` branches par quart de tuile (et par vitesse horizontale, par point visé, sol ou air, montée ou descente, contre un mur ou non, bouton
    // tenu ou non), puis les meilleures : sans cela, les branches collées à un mur (moins bien placées) disparaissent avant leur saut mural.
    const sorted = [...seen.values()].sort((a, b) => score(b, wps) - score(a, wps));
    const cells = new Map<string, number>();
    layer = [];
    for (const n of sorted) {
      const p = n.state.player;
      const cell = `${n.wp}|${p.x >> 10}|${p.y >> 10}|${p.vx >> 7}|${p.ground}|${p.vy < 0 ? 1 : 0}|${p.wallAir === 0 ? p.wallSide : 0}|${p.held}`;
      const used = cells.get(cell) ?? 0;
      if (used >= perCell) continue;
      cells.set(cell, used + 1);
      layer.push(n);
      if (layer.length >= beam) break;
    }
    options.dump?.(t + chunk, layer.map((n) => n.state));
    if (layer.length === 0) {
      options.log?.(`aucune branche vivante au pas ${t + chunk}`);
      return null;
    }
    if (options.log && (t / chunk) % 50 === 0) {
      const best = layer[0]!;
      const c = center(best.state);
      options.log(`pas ${t + chunk} : point ${best.wp}/${wps.length}, centre (${c.x.toFixed(1)}, ${c.y.toFixed(1)}), ${layer.length} branches`);
    }
  }
  return null;
}

/** Remonte les actions jusqu'au départ, puis coupe la dernière série au pas exact de l'arrivée. */
function unwind(end: Node, chunk: number, level: Level, params: Readonly<JumpParams>): number[] {
  const actions: number[] = [];
  for (let n: Node | null = end; n && n.action >= 0; n = n.parent) actions.push(n.action);
  actions.reverse();
  const inputs: number[] = [];
  let s = initialAttempt(level);
  for (const a of actions) {
    for (let k = 0; k < chunk; k++) {
      const bits = bitsAt(ACTIONS[a]!, k);
      inputs.push(bits);
      s = stepAttempt(s, bits, level, params);
      if (s.status === ATTEMPT_FINISHED) return inputs;
    }
  }
  return inputs;
}
