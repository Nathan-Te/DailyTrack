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
  SINGLE_CLOCK_VERSION,
  UNITS_PER_TILE,
  isDynamicTile,
  isSolidTile,
  isSpikeTile,
  sectionPhases,
  stepAttempt,
  type AttemptState,
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

/** Une action : une direction tenue tout le paquet × un motif du bouton de saut. */
const DIRS = [INPUT_RIGHT, 0, INPUT_LEFT];
const PATTERNS = ["off", "on", "repress"] as const;
type Pattern = (typeof PATTERNS)[number];
export const ACTIONS: readonly { dir: number; jump: Pattern }[] = DIRS.flatMap((dir) => PATTERNS.map((jump) => ({ dir, jump })));

export function bitsAt(action: number, k: number): number {
  const a = ACTIONS[action]!;
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
  // Lot 12 : un bloc clignotant ou alterné est tantôt plein, tantôt absent : pour le guidage il ne bouche rien (on cherche un chemin optimiste).
  for (let i = 0; i < W * H; i++) if ((isSolidTile(level.tiles[i]!) && !isDynamicTile(level.tiles[i]!)) || isSpikeTile(level.tiles[i]!)) blocked[i] = 1;
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
  /** Lot 11 : durée minimale d'un appui de saut et d'un relâchement entre deux appuis (pas), 0 = aucune règle (`PRESS_MIN`, `RELEASE_MIN`). */
  pressMin?: number;
  releaseMin?: number;
}

interface Node {
  state: AttemptState;
  parent: Node | null;
  action: number;
  score: number;
  /** Changements d'action depuis le départ. */
  changes: number;
  /** Lot 11 : pas d'appui de saut en cours (0 : bouton relâché) et pas relâchés depuis le dernier appui (−1 : aucun appui avant). */
  on: number;
  off: number;
}

/**
 * Lot 13 : les horloges d'un niveau, section par section — le cycle des clignotants (lot 12) et ceux des rafales de ses zones de vent ; vide
 * pour une section sans horloge. Deux états à des phases différentes d'une même horloge n'ont pas le même avenir.
 */
export function sectionClocks(level: Level): number[][] {
  return level.sections.map((_, i) => [
    ...(level.blinkCycles[i] ? [level.blinkCycles[i]!.cycle] : []),
    ...level.winds.filter((w) => w.section === i && w.gust !== null).map((w) => w.gust!.cycle),
    // Lot 20 : une plateforme mobile a son cycle (la phase d'une plateforme décide où elle sera au prochain saut).
    ...level.platforms.filter((q) => q.section === i).map((q) => q.cycle),
    // Lot 22 : une presse a son cycle (la phase d'une presse décide du moment où il faut passer).
    ...level.presses.filter((q) => q.section === i).map((q) => q.cycle),
  ]);
}

/** Lot 13 : vrai si le niveau a quelque chose qui change avec le temps ou les sauts (blocs clignotants ou alternés, rafales ; lot 15 : scies mobiles en v4). */
export function isDynamicLevel(level: Level): boolean {
  // Lot 15 : à une seule horloge (v4), une scie mobile n'attend plus le joueur : il faut parfois attendre qu'elle passe.
  return level.blinks.length > 0 || level.alts.length > 0 || level.winds.some((w) => w.gust !== null) || level.platforms.length > 0 || level.presses.length > 0 || level.stalactites.length > 0 || (level.simVersion >= SINGLE_CLOCK_VERSION && level.saws.some((s) => s.cycle > 0));
}

/** Les phases de chaque section modulo chacune de ses horloges (`shift` : grain, en puissance de 2). */
function clockKey(level: Level, clocks: readonly (readonly number[])[], s: AttemptState, shift: number): string {
  return sectionPhases(level, s)
    .map((ph, i) => clocks[i]!.map((c) => (ph % c) >> shift).join(":"))
    .join(",");
}

function key(level: Level, clocks: readonly (readonly number[])[], s: AttemptState, on: number, off: number): string {
  const p = s.player;
  let dyn = "";
  if (isDynamicLevel(level)) {
    // Lot 12 : deux états qui ne diffèrent que par la phase des clignotants ou la parité des alternés n'ont pas le même avenir. La phase de
    // chaque section (modulo ses horloges : clignotants, et rafales depuis le lot 13) et l'état des blocs (un bloc qui attend la sortie du
    // personnage compte) les distinguent.
    const phases = clockKey(level, clocks, s, 0);
    let codes = "";
    for (const b of level.blinks) codes += s.tiles[b.row * level.width + b.col]! === 11 ? "1" : "0";
    for (const a of level.alts) codes += s.tiles[a.row * level.width + a.col]! === 13 ? "1" : "0";
    dyn = `|${s.alt ?? 0}|${phases}|${codes}`;
  }
  // Lot 20 : la plateforme qui porte le personnage compte (deux états au même endroit, l'un porté et l'autre non, n'ont pas le même avenir).
  return `${on}|${off}|${p.x >> 8}|${p.y >> 8}|${p.vx >> 4}|${p.vy >> 4}|${p.ground}|${p.held}|${p.wallSide}|${Math.min(p.wallAir, 8)}|${p.jumping}|${s.crumbles.join("")}|${s.springCell}|${s.ride ?? ""}${s.stalactites ? `|${s.stalactites.join(",")}` : ""}${dyn}`;
}

/**
 * Cherche une suite de commandes qui mène de `start` au but. Rend les commandes (une par pas, la dernière atteint le but), ou null.
 * Lot 12 : dans un niveau à blocs clignotants ou alternés, si la recherche ordinaire échoue, une **seconde passe réserve la moitié du faisceau
 * aux meilleures branches posées au sol** (celles qui attendent qu'un bloc s'allume ou que la parité change ne gagnent pas de terrain : sans
 * réserve, les branches lancées dans le vide les écartaient, puis mouraient, et la couche se vidait — « aucune solution » alors qu'un morceau
 * existait). La première passe est celle d'avant : les morceaux sans attente gardent leurs solutions, bit pour bit.
 * Lot 13 : la même seconde passe sert aux rafales (attendre au bord que le vent se lève) ; la clé connaît aussi leurs horloges.
 */
export function beamSolve(level: Level, options: BeamOptions): number[] | null {
  const dynamic = isDynamicLevel(level);
  const first = beamSearch(level, options, false);
  return first ?? (dynamic ? beamSearch(level, options, true) : null);
}

function beamSearch(level: Level, options: BeamOptions, reserve: boolean): number[] | null {
  const chunk = options.chunk ?? 4;
  const beam = options.beam ?? 800;
  const maxTicks = options.maxTicks ?? 960;
  const perCell = options.perCell ?? 2;
  const penalty = options.changePenalty ?? 0;
  const dist = distanceField(level);
  const clocks = sectionClocks(level);
  const P = DEFAULT_JUMP_PARAMS;
  const pressMin = options.pressMin ?? 0;
  const releaseMin = options.releaseMin ?? 0;
  let layer: Node[] = [{ state: options.start, parent: null, action: -1, score: 0, changes: 0, on: 0, off: -1 }];
  for (let t = 0; t < maxTicks; t += chunk) {
    const seen = new Map<string, Node>();
    let best: { node: Node; tick: number } | null = null;
    for (const node of layer) {
      for (let action = 0; action < ACTIONS.length; action++) {
        let s = node.state;
        let at = -1;
        let lost = false;
        let on = node.on;
        let off = node.off;
        for (let k = 0; k < chunk; k++) {
          const bits = bitsAt(action, k);
          // Lot 11 : un doigt ne tient pas un appui plus court que `pressMin`, ni ne relâche moins de `releaseMin` entre deux appuis.
          if ((bits & INPUT_JUMP) !== 0) {
            if (on === 0 && off >= 0 && off < releaseMin) {
              lost = true;
              break;
            }
            on++;
            off = -1;
          } else {
            if (on > 0 && on < pressMin) {
              lost = true;
              break;
            }
            if (on > 0) off = 0;
            on = 0;
            if (off >= 0 && off < 99) off++;
          }
          s = stepAttempt(s, bits, level, P);
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
        const changes = node.changes + (action !== node.action ? 1 : 0) + (ACTIONS[action]!.jump === "repress" ? 1 : 0);
        const child: Node = { state: s, parent: node, action, score: 0, changes, on, off };
        if (at > 0) {
          if (!best || at < best.tick) best = { node: child, tick: at };
          continue;
        }
        child.score = guideScore(level, dist, s) - penalty * changes;
        const k = key(level, clocks, s, Math.min(on, pressMin), Math.min(off, releaseMin));
        const prev = seen.get(k);
        if (!prev || child.score > prev.score) seen.set(k, child);
      }
    }
    if (best) return unwind(best.node, chunk, best.tick);
    // Diversité : au plus `perCell` branches par case (quart de tuile, vitesse, sol ou air, montée, mur, bouton), puis les meilleures.
    const sorted = [...seen.values()].sort((a, b) => b.score - a.score);
    const cells = new Map<string, number>();
    layer = [];
    const take = (n: Node): boolean => {
      const p = n.state.player;
      // Lot 12 : avec des blocs qui clignotent ou s'alternent, deux branches à la même case mais à des phases différentes n'ont pas le même avenir.
      const dyn = reserve ? `|${n.state.alt ?? 0}|${clockKey(level, clocks, n.state, 4)}${n.state.stalactites ? `|${n.state.stalactites.map((a) => (a > 0 ? a >> 3 : a)).join(",")}` : ""}` : "";
      const cell = `${p.x >> 10}|${p.y >> 10}|${p.vx >> 7}|${p.ground}|${p.vy < 0 ? 1 : 0}|${p.wallAir === 0 ? p.wallSide : 0}|${p.held}|${Math.min(n.on, pressMin)}${dyn}`;
      const used = cells.get(cell) ?? 0;
      if (used >= perCell) return false;
      cells.set(cell, used + 1);
      layer.push(n);
      return true;
    };
    if (reserve) {
      // Lot 12 : la moitié du faisceau est réservée aux meilleures branches **posées au sol** : celles qui attendent qu'un bloc s'allume ou que
      // la parité change ne gagnent pas de terrain, et sans réserve elles étaient écartées par les branches lancées dans le vide (qui meurent
      // quelques pas plus tard : la couche se vidait, « aucune solution » alors qu'un morceau existait).
      const reserved = new Set<Node>();
      for (const n of sorted) {
        if (reserved.size >= beam / 2) break;
        if (n.state.player.ground === 1 && take(n)) reserved.add(n);
      }
      for (const n of sorted) {
        if (layer.length >= beam) break;
        if (!reserved.has(n)) take(n);
      }
    } else {
      for (const n of sorted) {
        if (!take(n)) continue;
        if (layer.length >= beam) break;
      }
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

