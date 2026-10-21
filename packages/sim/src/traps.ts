import { TICK_RATE } from "./constants";
import { AXIS_MAX, DEFAULT_CAR_PARAMS, type CarInput } from "./car";
import { createAutopilot, needsFreeze, type PilotRun } from "./autopilot";
import { createRace, stepRace } from "./race";
import { CELL, blockSlope, cellKey, isCurve, type Block, type Track } from "./track";
import { SURFACES, type WallHit } from "./world";
import { FAST_APPROACH, MIN_BRAKE } from "./braking";

// Virages-pièges (lot 34) : mesure seule, pour `npm run measure:generator` et les tests du générateur. Rien ici ne joue une course classée.
//
// Retour des amis : après une plaque ou un super turbo (66 à 88 m/s), un virage serré bordé d'un mur ne se freine plus à temps et l'on finit
// contre le mur trois fois sur quatre. Pour chaque virage du circuit, on mesure sur la course du pilote d'auteur :
// - le point libre : la fin de la dernière poussée (plaque, super turbo) depuis le virage précédent — tant qu'une poussée agit, le frein ne
//   gagne presque rien (frein 40 contre plaque 30, contre turbo 42) — ou la sortie du virage précédent s'il n'y en a pas ;
// - la vitesse d'arrivée possible : plein gaz depuis ce point jusqu'à l'entrée du virage (même direction que le pilote) ;
// - la vitesse de passage : la plus basse du pilote d'auteur dans le virage ;
// - la distance de freinage nécessaire (frein du pilote : 0,8 × 40 × motricité du revêtement, plus le roulement et la pente) comparée à la
//   distance disponible ; la **marge** est le temps qu'on peut attendre, plein gaz après le point libre, avant de devoir freiner.
// Un **virage-piège** : une approche rapide (après une plaque, un super turbo, ou au-delà de `FAST_APPROACH` = 52,8 m/s : une portion rapide),
// un vrai freinage (au moins `MIN_BRAKE` = 8 m/s à perdre), une marge sous `TRAP_SLACK` (0,3 s, un temps de réaction) **et un mur à
// l'extérieur** (ni bas-côté, ni cuve). Les marges courtes des enchaînements techniques sous la pointe du plat (un large puis un serré) ne sont
// pas des pièges : la mesure les compte à part (`fast` faux). Un virage
// sans rebords (le vide) n'est pas compté : en sortir, c'est tomber, pas toucher un mur.

/** Marge (s) sous laquelle un virage bordé d'un mur est un piège : le temps de réagir à la fin d'une poussée. */
export const TRAP_SLACK = 0.3;

export interface TurnReport {
  /** Indice du bloc du virage. */
  block: number;
  /** Vrai si une plaque ou un super turbo a poussé la voiture entre le virage précédent et celui-ci. */
  boosted: boolean;
  /** Vitesse (m/s) au point libre, à l'entrée du virage plein gaz depuis le point libre, et la plus basse du pilote dans le virage. */
  free: number;
  arrive: number;
  turn: number;
  /** Distance de freinage nécessaire depuis le point libre et distance disponible jusqu'au virage (m). */
  needed: number;
  available: number;
  /** Temps (s) qu'on peut rouler plein gaz après le point libre avant de devoir freiner (négatif : trop tard dès la fin de la poussée). */
  slack: number;
  /** Mur à l'extérieur : ni bas-côté, ni vide, ni cuve. */
  wall: boolean;
  /** Approche après une poussée ou à plus de `FAST_APPROACH`. */
  fast: boolean;
  /** Virage-piège (voir plus haut). */
  trap: boolean;
}

interface Tick {
  block: number;
  v: number;
  s: number;
  pushed: boolean;
}

const blockAt = (track: Track, x: number, z: number): Block | undefined => track.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));

/** Course du pilote (mêmes réglages que `run`), pas à pas, avec à partir du pas `fullFrom` l'accélérateur à fond et sans frein (sauf pour figer en vol). */
function trace(track: Track, run: Pick<PilotRun, "grip" | "wall" | "cut">, fullFrom = Infinity, until?: (t: Tick) => boolean): Tick[] {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  const out: Tick[] = [];
  let s = 0;
  for (let i = 0; race.finishMs < 0 && race.respawns === 0 && i < 120 * TICK_RATE; i++) {
    const car = race.car;
    const v = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
    const t: Tick = { block: blockAt(track, car.x, car.z)?.index ?? -1, v, s, pushed: car.boost > 0 || car.turbo > 0 };
    out.push(t);
    if (until?.(t)) break;
    let input: CarInput = drive(race);
    if (i >= fullFrom) input = { steer: input.steer, throttle: AXIS_MAX, brake: needsFreeze(car) ? AXIS_MAX : 0, respawn: 0 };
    const px = car.x;
    const pz = car.z;
    stepRace(race, input);
    s += Math.sqrt((race.car.x - px) * (race.car.x - px) + (race.car.z - pz) * (race.car.z - pz));
  }
  return out;
}

/** Ralentissement (m/s²) que le frein du pilote obtient sur ce bloc : 0,8 × frein × motricité, plus le roulement, plus la pente (montée). */
function decelOn(b: Block): number {
  const m = SURFACES[b.surface];
  const slope = isCurve(b.kind) ? 0 : blockSlope(b, CELL / 2);
  return Math.max(4, 0.8 * DEFAULT_CAR_PARAMS.brake * m.traction + m.rolling + DEFAULT_CAR_PARAMS.slopeGravity * slope);
}

/** Les virages du circuit (hors virages en cuve), avec leur freinage d'après la course `run` du pilote d'auteur. */
export function turnReports(track: Track, run: Pick<PilotRun, "grip" | "wall" | "cut">): TurnReport[] {
  const base = trace(track, run);
  const reports: TurnReport[] = [];
  let prevEnd = 0; // dernier pas passé dans le virage précédent
  let i = 0;
  while (i < base.length) {
    const b = track.blocks[base[i]!.block];
    if (!b || !isCurve(b.kind)) {
      i++;
      continue;
    }
    const entry = i;
    let end = i;
    while (end + 1 < base.length && base[end + 1]!.block === b.index) end++;
    let free = prevEnd;
    for (let k = prevEnd; k < entry; k++) if (base[k]!.pushed) free = k + 1;
    const boosted = free > prevEnd;
    let turn = Infinity;
    for (let k = entry; k <= end; k++) turn = Math.min(turn, base[k]!.v);
    if (!b.cuve) {
      // Plein gaz depuis le point libre jusqu'à l'entrée du virage.
      const full = trace(track, run, free, (t) => t.block === b.index);
      const at = full[full.length - 1]!;
      const decel = decelOn(track.blocks[base[Math.max(free, entry - 1)]!.block] ?? b);
      let latest = -1;
      for (let k = free; k < full.length - 1; k++) {
        const t = full[k]!;
        if (at.s - t.s >= (t.v * t.v - turn * turn) / (2 * decel)) latest = k;
      }
      const f = full[free] ?? at;
      const needed = Math.max(0, (f.v * f.v - turn * turn) / (2 * decel));
      const available = at.s - f.s;
      const slack = latest >= 0 ? (latest - free) / TICK_RATE : (available - needed) / Math.max(f.v, 1);
      const wall = !b.shoulder && !b.open;
      const peak = Math.max(f.v, ...full.slice(free).map((t) => t.v));
      const fast = boosted || peak > FAST_APPROACH;
      reports.push({ block: b.index, boosted, free: f.v, arrive: at.v, turn, needed, available, slack, wall, fast, trap: fast && wall && slack < TRAP_SLACK && peak - turn >= MIN_BRAKE });
    }
    prevEnd = end;
    i = end + 1;
  }
  return reports;
}

export interface HumanRun {
  finished: boolean;
  finishMs: number;
  /** Contacts avec un rebord (une série de pas au contact ; deux contacts à moins de `CONTACT_GAP` n'en font qu'un). */
  contacts: number;
  /** Contacts au-delà de 30 m/s (ceux qui font perdre la course). */
  hardContacts: number;
  falls: number;
  /** Contacts dans les 3 s qui suivent une poussée (plaque, super turbo). */
  boostedContacts: number;
  /** Où ont eu lieu les contacts : bloc, vitesse avant le choc, plus grande vitesse des 3 s d'avant. */
  where: { block: number; v: number; peak: number }[];
}

/** Deux contacts plus rapprochés que ça (s) n'en font qu'un : le rebond qui suit le choc. */
const CONTACT_GAP = 1;

/**
 * Le pilote « humain correct » (lot 34) : le pilote d'auteur (même trajectoire, même adhérence que `run`), à une chose près — **il ne freine
 * qu'après avoir réagi** : ni pendant une poussée (plaque, super turbo), ni dans les `reaction` secondes (0,3 s, `TRAP_SLACK`) qui suivent sa
 * fin, la sortie d'un virage ou une réception ; il garde alors le plein gaz. Là où le pilote d'auteur a le temps, l'humain freine aussi bien
 * que lui ; là où il faut freiner aussitôt (le virage-piège), il freine 0,3 s trop tard. On compte ses contacts avec les rebords et ses
 * chutes (il repart du point de contrôle, comme un joueur).
 */
export function humanRun(track: Track, run: Pick<PilotRun, "grip" | "wall" | "cut">, reaction = TRAP_SLACK): HumanRun {
  const race = createRace(track);
  const world = race.world;
  let touching = false;
  race.world = {
    ...world,
    collide(x: number, z: number, y: number, radius: number, out: WallHit) {
      const hit = world.collide(x, z, y, radius, out);
      if (hit) touching = true;
      return hit;
    },
  };
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  const window = Math.round(reaction * TICK_RATE);
  let contacts = 0;
  let hardContacts = 0;
  let boostedContacts = 0;
  let falls = 0;
  let stuck = 0;
  let sinceContact = Infinity;
  let sincePush = Infinity;
  let sinceEvent = Infinity; // pas depuis la dernière chose à laquelle il faut réagir
  let wasCurve = false;
  let wasAir = false;
  const where: HumanRun["where"] = [];
  const recent: number[] = [];
  for (let i = 0; race.finishMs < 0 && i < 120 * TICK_RATE; i++) {
    const car = race.car;
    const v0 = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
    recent.push(v0);
    if (recent.length > 3 * TICK_RATE) recent.shift();
    const pushed = car.boost > 0 || car.turbo > 0;
    const b = blockAt(track, car.x, car.z);
    const curve = !!b && isCurve(b.kind);
    if (pushed || (wasCurve && !curve) || (wasAir && car.grounded === 1)) sinceEvent = 0;
    else sinceEvent++;
    wasCurve = curve;
    wasAir = car.grounded === 0;
    sincePush = pushed ? 0 : sincePush + 1;
    let input: CarInput = drive(race);
    if (input.brake > 0 && car.grounded === 1 && sinceEvent < window) input = { steer: input.steer, throttle: AXIS_MAX, brake: 0, respawn: 0 };
    const before = race.respawns;
    touching = false;
    stepRace(race, input);
    if (touching) {
      if (sinceContact > CONTACT_GAP * TICK_RATE) {
        contacts++;
        if (v0 > 30) hardContacts++;
        if (sincePush < 3 * TICK_RATE) boostedContacts++;
        where.push({ block: b?.index ?? -1, v: v0, peak: Math.max(...recent) });
      }
      sinceContact = 0;
    } else sinceContact++;
    if (race.respawns > before) falls++;
    const v = Math.sqrt(race.car.vx * race.car.vx + race.car.vz * race.car.vz);
    stuck = v < 0.5 && i > 2 * TICK_RATE ? stuck + 1 : 0;
    if (stuck > 3 * TICK_RATE) break;
  }
  return { finished: race.finishMs >= 0, finishMs: race.finishMs, contacts, hardContacts, falls, boostedContacts, where };
}
