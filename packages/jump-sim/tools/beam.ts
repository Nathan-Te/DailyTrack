import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SAW_SMALL_RADIUS,
  UNITS_PER_TILE,
  isSolidTile,
  isSpikeTile,
  stepAttempt,
  type AttemptState,
  type JumpParams,
  type Level,
} from "../src/index";

// Le solveur des morceaux (lot 4), **hors de la simulation** : il ne fait que l'appeler. Repris du chercheur du lot 2
// (`test/solver.ts`) : recherche par faisceau sur des actions grossières — une direction tenue × un motif du bouton de saut (relâché, tenu,
// relâché un pas puis réappuyé), pendant `chunk` pas. Toutes les branches d'une couche ont joué le même nombre de pas ; deux états proches
// sont confondus, le meilleur reste. Ce qui change depuis le lot 2 :
//   - plus de points de passage écrits à la main : la recherche est guidée par une **carte de distances** (parcours en largeur sur les
//     tuiles libres, depuis l'arrivée), qui sait qu'une cheminée se monte et qu'un détour se fait ;
//   - le but est un prédicat vérifié **à chaque pas** (pour les morceaux, lot 6 : la sortie canonique, `canonicalExit`) ; `dead` écarte
//     une branche qui ne peut plus l'atteindre (la sortie franchie hors de la course propre) ; une arrivée sans le but est écartée ;
//   - on part de n'importe quel état (entrée à l'arrêt ou lancée) ;
//   - dans la couche où le but est atteint, on garde le pas exact le plus tôt.

/**
 * Une action : une direction tenue tout le paquet × un motif du bouton de saut ; plus (lot 8c) le **bref relâchement** : un pas sans rien,
 * puis droite (`tap`) — il remet l'élan à zéro sans presque rien coûter, d'où l'état canonique « course » au bord d'un palier.
 */
const DIRS = [INPUT_RIGHT, 0, INPUT_LEFT];
const PATTERNS = ["off", "on", "repress"] as const;
type Pattern = (typeof PATTERNS)[number];
export const ACTIONS: readonly { dir: number; jump: Pattern; tap?: true }[] = [
  ...DIRS.flatMap((dir) => PATTERNS.map((jump) => ({ dir, jump }))),
  { dir: INPUT_RIGHT, jump: "off", tap: true },
];

export function bitsAt(action: number, k: number): number {
  const a = ACTIONS[action]!;
  if (a.tap && k === 0) return 0;
  const j = a.jump === "on" || (a.jump === "repress" && k > 0) ? INPUT_JUMP : 0;
  return a.dir | j;
}

const T = UNITS_PER_TILE;

/** Carte des distances (en tuiles, 4-voisinage) de chaque tuile libre à l'arrivée ; −1 : injoignable ou pleine. */
export function distanceField(level: Level): Int32Array {
  const W = level.width;
  const H = level.height;
  const dist = new Int32Array(W * H).fill(-1);
  const blocked = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (isSolidTile(level.tiles[i]!) || isSpikeTile(level.tiles[i]!)) blocked[i] = 1;
  // Les scies fixes bouchent les tuiles dont le centre est dans leur disque (les mobiles passent partout : on les ignore ici).
  for (const saw of level.saws) {
    if (saw.cycle !== 0) continue;
    const r = saw.radius + SAW_SMALL_RADIUS;
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        const dx = col * T + T / 2 - saw.nodes[0]!.x;
        const dy = row * T + T / 2 - saw.nodes[0]!.y;
        if (dx * dx + dy * dy < r * r) blocked[row * W + col] = 1;
      }
    }
  }
  const queue: number[] = [level.finish.row * W + level.finish.col];
  dist[queue[0]!] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const c = i % W;
    const r = (i - c) / W;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
      const j = nr * W + nc;
      if (blocked[j] || dist[j]! >= 0) continue;
      dist[j] = dist[i]! + 1;
      queue.push(j);
    }
  }
  return dist;
}

/** Note d'un état : moins il reste de chemin jusqu'à l'arrivée, mieux c'est (en unités, avec la progression dans la tuile). */
export function guideScore(level: Level, dist: Int32Array, s: AttemptState): number {
  const W = level.width;
  const cx = s.player.x + PLAYER_WIDTH / 2;
  const cy = s.player.y + PLAYER_HEIGHT / 2;
  const c = Math.floor(cx / T);
  const r = Math.floor(cy / T);
  if (c < 0 || r < 0 || c >= W || r >= level.height) return -1e12;
  const d = dist[r * W + c]!;
  if (d < 0) return -1e9 - Math.abs(c - level.finish.col) * T;
  // Progression dans la tuile, vers un voisin plus proche de l'arrivée.
  let progress = 0;
  const near = (nc: number, nr: number) => nc >= 0 && nr >= 0 && nc < W && nr < level.height && dist[nr * W + nc] === d - 1;
  if (near(c + 1, r)) progress = cx - c * T;
  else if (near(c, r - 1)) progress = (r + 1) * T - cy;
  else if (near(c - 1, r)) progress = (c + 1) * T - cx;
  else if (near(c, r + 1)) progress = cy - r * T;
  return -(d * T - progress);
}

export interface BeamOptions {
  start: AttemptState;
  /** But atteint dans cet état (vérifié à chaque pas ; une arrivée qui ne le remplit pas est écartée). */
  goal(s: AttemptState): boolean;
  /** Branche perdue dans cet état (en plus de la mort et d'une arrivée sans le but). */
  lost?(s: AttemptState): boolean;
  chunk?: number;
  beam?: number;
  maxTicks?: number;
  perCell?: number;
  /**
   * Pénalité (unités de la note) par changement d'action le long d'une branche : à progression égale, la suite de commandes la plus
   * simple l'emporte (moins de changements, donc moins de prises à la gigue). 0 par défaut.
   */
  changePenalty?: number;
  /**
   * Lot 8c, **recherche robuste au raccord** : d'autres départs (le même état d'entrée, décalé dans le pas) joués avec les mêmes commandes.
   * Une branche est perdue dès que l'un d'eux meurt, arrive, ou remplit `companionLost` ; un compagnon qui remplit `companionDone` (sa sortie
   * canonique) est mis de côté ; la note est celle du plus en retard. Le but reste celui du départ principal.
   */
  companions?: readonly AttemptState[];
  /** Réglages de la simulation (les défauts ; `NO_SPRINT_PARAMS` pour la mesure « sans élan » du lot 8c, `measure-elan.ts`). */
  params?: Readonly<JumpParams>;
  companionDone?(s: AttemptState): boolean;
  companionLost?(s: AttemptState): boolean;
}

interface Node {
  state: AttemptState;
  /** Les compagnons (recherche robuste), null une fois sortis. */
  others: readonly (AttemptState | null)[];
  parent: Node | null;
  action: number;
  score: number;
  /** Changements d'action depuis le départ. */
  changes: number;
}

function key(s: AttemptState): string {
  const p = s.player;
  return `${p.x >> 8}|${p.y >> 8}|${p.vx >> 4}|${p.vy >> 4}|${p.ground}|${p.held}|${p.wallSide}|${Math.min(p.wallAir, 8)}|${p.jumping}|${p.sprint}|${s.crumbles.join("")}|${s.springCell}`;
}

/** Cherche une suite de commandes qui mène de `start` au but. Rend les commandes (une par pas, la dernière atteint le but), ou null. */
export function beamSolve(level: Level, options: BeamOptions): number[] | null {
  const chunk = options.chunk ?? 4;
  const beam = options.beam ?? 800;
  const maxTicks = options.maxTicks ?? 960;
  const perCell = options.perCell ?? 2;
  const penalty = options.changePenalty ?? 0;
  const dist = distanceField(level);
  const P = options.params ?? DEFAULT_JUMP_PARAMS;
  const companions = options.companions ?? [];
  let layer: Node[] = [{ state: options.start, others: companions, parent: null, action: -1, score: 0, changes: 0 }];
  for (let t = 0; t < maxTicks; t += chunk) {
    const seen = new Map<string, Node>();
    let best: { node: Node; tick: number } | null = null;
    for (const node of layer) {
      for (let action = 0; action < ACTIONS.length; action++) {
        let s = node.state;
        const others = node.others.slice();
        let at = -1;
        let lost = false;
        for (let k = 0; k < chunk && !lost; k++) {
          const bits = bitsAt(action, k);
          s = stepAttempt(s, bits, level, P);
          for (let i = 0; i < others.length; i++) {
            const o = others[i];
            if (!o) continue;
            const n = stepAttempt(o, bits, level, P);
            if (options.companionDone?.(n)) others[i] = null;
            else if (n.status === ATTEMPT_DEAD || n.status === ATTEMPT_FINISHED || options.companionLost?.(n)) lost = true;
            else others[i] = n;
          }
          if (lost) break;
          if (options.goal(s)) {
            at = k + 1;
            break;
          }
          if (s.status === ATTEMPT_DEAD || s.status === ATTEMPT_FINISHED || options.lost?.(s)) {
            lost = true;
            break;
          }
        }
        if (lost) continue;
        const changes = node.changes + (action !== node.action ? 1 : 0) + (ACTIONS[action]!.jump === "repress" || ACTIONS[action]!.tap ? 1 : 0);
        const child: Node = { state: s, others, parent: node, action, score: 0, changes };
        if (at > 0) {
          if (!best || at < best.tick) best = { node: child, tick: at };
          continue;
        }
        let score = guideScore(level, dist, s);
        for (const o of others) if (o) score = Math.min(score, guideScore(level, dist, o));
        child.score = score - penalty * changes;
        let k = key(s);
        for (const o of others) k += o ? `|${o.player.x >> 9},${o.player.y >> 9}` : "|-";
        const prev = seen.get(k);
        if (!prev || child.score > prev.score) seen.set(k, child);
      }
    }
    if (best) return unwind(best.node, chunk, best.tick);
    // Diversité : au plus `perCell` branches par case (quart de tuile, vitesse, sol ou air, montée, mur, bouton), puis les meilleures.
    const sorted = [...seen.values()].sort((a, b) => b.score - a.score);
    const cells = new Map<string, number>();
    layer = [];
    for (const n of sorted) {
      const p = n.state.player;
      const cell = `${p.x >> 10}|${p.y >> 10}|${p.vx >> 7}|${p.ground}|${p.vy < 0 ? 1 : 0}|${p.wallAir === 0 ? p.wallSide : 0}|${p.held}|${p.sprint >= P.sprintDelay ? 2 : p.sprint > 0 ? 1 : 0}`;
      const used = cells.get(cell) ?? 0;
      if (used >= perCell) continue;
      cells.set(cell, used + 1);
      layer.push(n);
      if (layer.length >= beam) break;
    }
    if (layer.length === 0) return null;
  }
  return null;
}

/** Remonte les actions ; la dernière série s'arrête au pas exact du but. */
function unwind(end: Node, chunk: number, lastTicks: number): number[] {
  const actions: number[] = [];
  for (let n: Node | null = end; n && n.action >= 0; n = n.parent) actions.push(n.action);
  actions.reverse();
  const inputs: number[] = [];
  actions.forEach((a, i) => {
    const n = i === actions.length - 1 ? lastTicks : chunk;
    for (let k = 0; k < n; k++) inputs.push(bitsAt(a, k));
  });
  return inputs;
}

export interface RunOutcome {
  finished: boolean;
  died: boolean;
  /** Pas joués jusqu'à l'arrivée (ou la mort, ou la fin). */
  ticks: number;
  final: AttemptState;
}

/**
 * Joue des commandes depuis un état ; une fois les commandes épuisées, garde la dernière (« on continue de courir ») pendant `extra`
 * pas au plus. S'arrête à l'arrivée ou à la première mort.
 */
export function play(level: Level, start: AttemptState, inputs: readonly number[], extra = 0): RunOutcome {
  let s = start;
  const last = inputs[inputs.length - 1] ?? INPUT_RIGHT;
  const total = inputs.length + extra;
  for (let t = 0; t < total; t++) {
    s = stepAttempt(s, t < inputs.length ? inputs[t]! : last, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_FINISHED) return { finished: true, died: false, ticks: t + 1, final: s };
    if (s.status === ATTEMPT_DEAD) return { finished: false, died: true, ticks: t + 1, final: s };
  }
  return { finished: false, died: false, ticks: total, final: s };
}

