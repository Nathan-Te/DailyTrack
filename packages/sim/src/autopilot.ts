import { TICK_RATE } from "./constants";
import { COLLIDER_RADIUS, DEFAULT_CAR_PARAMS, makeInput, steerLimit, type CarInput, type CarParams } from "./car";
import { HALF_PI, clamp, cos, sin } from "./math";
import { createRace, stepRace, type RaceState } from "./race";
import { ReplayRecorder, type Replay } from "./replay";
import { trackJumps, type JumpInfo } from "./jump";
import { BANK_SLOPE_TIGHT, BANK_SLOPE_WIDE, CELL, blockHalfWidth, blockPoint, blockSlope, curveCenter, dirX, dirZ, isCurve, isWide, turnsLeft, type Block, type Track } from "./track";
import { SURFACES } from "./world";

// Pilote automatique (lot 7) : il sert à valider un circuit généré (« est-il finissable ? ») et donne le temps de
// l'auteur. Il conduit comme un bon joueur :
// 1. une trajectoire de course : la ligne médiane, relâchée dans la largeur de la route (corde des virages,
//    sorties larges) en lissant sa courbure ;
// 2. un profil de vitesse : vitesse de passage de chaque point selon la courbure (adhérence × `grip`), puis
//    points de freinage par une passe arrière (on doit pouvoir freiner à temps pour le point suivant) ; sur glace la
//    vitesse de passage est celle de la roue libre (le pilote lâche l'accélérateur pour tourner) ;
// 3. une conduite : poursuite d'un point devant soi pour la direction, gaz / frein tout-ou-rien pour la vitesse.
// Il n'utilise que les opérations déterministes de la simulation : mêmes décisions partout.

export interface AutopilotOptions {
  /** Fraction de l'adhérence utilisée dans les virages (1 = à la limite). */
  grip?: number;
  /** Anticipation du point visé : `5 + look × vitesse` mètres. */
  look?: number;
  /** Réglages de la voiture (ceux de la course). */
  params?: Readonly<CarParams>;
}

/** Trajectoire de course : points tous les ~2 m, distance cumulée et vitesse visée en chaque point. */
export interface RacingLine {
  x: number[];
  z: number[];
  /** Distance cumulée depuis le départ (m). */
  s: number[];
  /** Vitesse visée (m/s). */
  speed: number[];
  /** Pente du relevé en chaque point (0 hors virage relevé). */
  bank: number[];
  /** Part de glace sous chaque point (0 = aucune, 1 = glace) : le pilote lâche l'accélérateur pour tourner dessus. */
  slick: number[];
}

const SPACING = 2;
/** Marge aux rebords en plus (m) sur une section sans rebords : sortir de la route, c'est tomber. */
const OPEN_EXTRA_MARGIN = 1;
/** Réglage de la gravité sur pente de la voiture (m/s² par unité de pente), pour le freinage du pilote. */
const SLOPE_GRAVITY = DEFAULT_CAR_PARAMS.slopeGravity;
const SMOOTH_ITERATIONS = 400;
/** Écart latéral permis (m) du pilote en virage relevé. */
const BANKED_ROOM = 1.5;
/** Marge aux rebords (m) : demi-largeur de la voiture et un peu d'air. */
const WALL_MARGIN = COLLIDER_RADIUS + 2.6;

interface Centerline {
  x: number[];
  z: number[];
  /** Normale vers la gauche. */
  nx: number[];
  nz: number[];
  /** Écart latéral permis de part et d'autre. */
  room: number[];
  /** Bloc de chaque point. */
  blk: number[];
  /** Pente de la route (montée par mètre, dans le sens de la marche). */
  slope: number[];
}

function denseCenterline(track: Track): Centerline {
  const out: Centerline = { x: [], z: [], nx: [], nz: [], room: [], blk: [], slope: [] };
  const pt = { x: 0, z: 0 };
  const push = (p: number, q: number, b: Block, room: number) => {
    blockPoint(b, p, q, pt);
    out.x.push(pt.x);
    out.z.push(pt.z);
    out.room.push(room);
    out.blk.push(b.index);
    out.slope.push(isCurve(b.kind) ? 0 : blockSlope(b, q));
  };
  // Écart latéral permis : la demi-largeur de la route (qui varie d'un bloc à l'autre, et dans une transition) moins la marge.
  // Sur une route large, la trajectoire peut donc prendre une corde plus ouverte : c'est la relaxation ci-dessous qui s'en sert.
  for (const b of track.blocks) {
    const first = b.index === 0 ? 0 : 1; // le premier point d'un bloc est le dernier du précédent
    // Sur un tremplin, une rampe de saut, un vide et la réception qui suit, on reste au milieu : en l'air, on ne tourne pas.
    const prev = track.blocks[b.index - 1];
    const calm = b.kind === "jump" || b.kind === "kick" || b.kind === "gap" || prev?.kind === "jump" || prev?.kind === "gap";
    const open = b.open ? OPEN_EXTRA_MARGIN : 0;
    if (isCurve(b.kind)) {
      const { cp, r } = curveCenter(b.kind);
      const side = turnsLeft(b.kind) ? -1 : 1;
      const n = Math.round((HALF_PI * r) / SPACING);
      for (let i = first; i <= n; i++) {
        const a = (HALF_PI * i) / n;
        // Virage relevé : le bord intérieur est en contrebas et la rampe d'entrée y est raide ; on reste près de l'axe.
        push(cp + side * r * cos(a), r * sin(a), b, b.banked ? BANKED_ROOM : b.w0 / 2 - WALL_MARGIN - open);
      }
    } else {
      const n = Math.round(CELL / SPACING);
      for (let i = first; i <= n; i++) {
        const q = (CELL * i) / n;
        push(CELL / 2, q, b, calm ? 0.5 : blockHalfWidth(b, q) - WALL_MARGIN - open);
      }
    }
  }
  // Normales (vers la gauche) par différence centrée.
  const n = out.x.length;
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : 0;
    const c = i < n - 1 ? i + 1 : n - 1;
    const tx = out.x[c]! - out.x[a]!;
    const tz = out.z[c]! - out.z[a]!;
    const len = Math.sqrt(tx * tx + tz * tz);
    out.nx.push(tz / len);
    out.nz.push(-tx / len);
  }
  return out;
}

/** Tracé de la trajectoire (indépendant des réglages), calculé une fois par circuit. */
interface Path {
  x: number[];
  z: number[];
  s: number[];
  /** Revêtement sous chaque point : adhérence, motricité, roulement. */
  grip: number[];
  traction: number[];
  rolling: number[];
  /** Pente du relevé en chaque point (0 hors virage relevé). */
  bank: number[];
  slick: number[];
  /** Pente de la route en chaque point (montée par mètre). */
  slope: number[];
  /** Vrai là où la voiture est (ou peut être) en l'air à cause d'un saut : on n'y freine pas, la vitesse doit être bonne avant. */
  airborne: boolean[];
}
const paths = new WeakMap<Track, Path>();

function racingPath(track: Track): Path {
  const cached = paths.get(track);
  if (cached) return cached;
  const c = denseCenterline(track);
  const n = c.x.length;
  const x = c.x.slice();
  const z = c.z.slice();
  // Relaxation (Gauss-Seidel) : chaque point va vers le milieu de ses voisins, sans sortir de la route.
  for (let it = 0; it < SMOOTH_ITERATIONS; it++) {
    for (let i = 1; i < n - 1; i++) {
      const mx = (x[i - 1]! + x[i + 1]!) / 2;
      const mz = (z[i - 1]! + z[i + 1]!) / 2;
      const o = clamp((mx - c.x[i]!) * c.nx[i]! + (mz - c.z[i]!) * c.nz[i]!, -c.room[i]!, c.room[i]!);
      x[i] = c.x[i]! + o * c.nx[i]!;
      z[i] = c.z[i]! + o * c.nz[i]!;
    }
  }
  const s = [0];
  for (let i = 1; i < n; i++) {
    const dx = x[i]! - x[i - 1]!;
    const dz = z[i]! - z[i - 1]!;
    s.push(s[i - 1]! + Math.sqrt(dx * dx + dz * dz));
  }
  const grip: number[] = [];
  const traction: number[] = [];
  const rolling: number[] = [];
  const bank: number[] = [];
  const slick: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = track.blocks[c.blk[i]!]!;
    const m = SURFACES[b.surface];
    grip.push(m.grip);
    traction.push(m.traction);
    rolling.push(m.rolling);
    slick.push(m.slick);
    bank.push(b.banked ? (isWide(b.kind) ? BANK_SLOPE_WIDE : BANK_SLOPE_TIGHT) : 0);
  }
  // Zone de saut : de la rampe à la fin du bloc qui suit la réception. Elle commence au bloc `K` et finit un bloc après la réception.
  const zone = new Set<number>();
  for (const j of trackJumps(track)) for (let i = j.kick; i <= j.landing + 1; i++) zone.add(i);
  const airborne = c.blk.map((b) => zone.has(b));
  const path = { x, z, s, grip, traction, rolling, bank, slick, slope: c.slope, airborne };
  paths.set(track, path);
  return path;
}

/**
 * Trajectoire de course du circuit et profil de vitesse pour une adhérence latérale `gripAccel` (m/s², sur route) :
 * chaque point la module par son revêtement et par son relevé (`gravity` × pente), et le freinage par la motricité
 * du revêtement (plus le roulement, qui aide à ralentir).
 */
export function racingLine(
  track: Track,
  gripAccel: number,
  brakeAccel: number,
  topSpeed: number,
  gravity = 24.6,
  iceCoastGrip = DEFAULT_CAR_PARAMS.iceCoastGrip,
  slopeGravity = SLOPE_GRAVITY,
): RacingLine {
  const { x, z, s, grip, traction, rolling, bank, slick, slope, airborne } = racingPath(track);
  const n = x.length;
  // Vitesse de passage : courbure sur une corde de ±2 points (≈ 8 m), v = √(adhérence / courbure).
  const speed = new Array<number>(n).fill(topSpeed);
  const K = 2;
  for (let i = K; i < n - K; i++) {
    const ax = x[i]! - x[i - K]!;
    const az = z[i]! - z[i - K]!;
    const bx = x[i + K]! - x[i]!;
    const bz = z[i + K]! - z[i]!;
    const cx = x[i + K]! - x[i - K]!;
    const cz = z[i + K]! - z[i - K]!;
    const cross = ax * bz - az * bx;
    const den = Math.sqrt((ax * ax + az * az) * (bx * bx + bz * bz) * (cx * cx + cz * cz));
    const k = den > 0 ? (2 * (cross < 0 ? -cross : cross)) / den : 0;
    if (k > 1e-6) speed[i] = Math.min(topSpeed, Math.sqrt((gripAccel * (slick[i]! > 0 ? grip[i]! + slick[i]! * (iceCoastGrip - grip[i]!) : grip[i]!) + gravity * bank[i]!) / k));
  }
  // Points de freinage : en remontant, on doit pouvoir freiner à temps pour la vitesse du point suivant.
  // Pas de freinage en l'air : sur la zone d'un saut, la vitesse visée ne peut pas baisser, donc elle doit être bonne avant.
  // La pente aide ou gêne le freinage : en descente, la pesanteur pousse (`slopeGravity` × pente), en montée elle freine.
  for (let i = n - 2; i >= 0; i--) {
    if (airborne[i]! && speed[i + 1]! < speed[i]!) {
      speed[i] = speed[i + 1]!;
      continue;
    }
    const ds = s[i + 1]! - s[i]!;
    const decel = brakeAccel * traction[i]! + rolling[i]! + slopeGravity * slope[i]!;
    const reach = Math.sqrt(speed[i + 1]! * speed[i + 1]! + 2 * (decel > 2 ? decel : 2) * ds);
    if (reach < speed[i]!) speed[i] = reach;
  }
  return { x, z, s, speed, bank, slick };
}

/** Pilote : renvoie, à chaque pas, la commande à appliquer. */
export function createAutopilot(track: Track, opts: AutopilotOptions = {}) {
  const params = opts.params ?? DEFAULT_CAR_PARAMS;
  const grip = opts.grip ?? 0.9;
  const look = opts.look ?? 0.3;
  const lateral = ((params.gripFront + params.gripRear) / 2) * 0.85 * grip;
  const line = racingLine(track, lateral, params.brake * 0.8, params.turboMaxSpeed, params.gravity, params.iceCoastGrip, params.slopeGravity);
  const n = line.x.length;
  let idx = 0;

  return function drive(race: RaceState): CarInput {
    const car = race.car;
    // Point le plus proche sur la trajectoire, en n'avançant que dans le sens du circuit.
    let best = idx;
    let bestD = Infinity;
    for (let i = idx; i < Math.min(n, idx + 30); i++) {
      const dx = line.x[i]! - car.x;
      const dz = line.z[i]! - car.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    idx = best;
    const fx = sin(car.yaw);
    const fz = cos(car.yaw);
    const speed = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
    const u = car.vx * fx + car.vz * fz;

    // Direction : poursuite d'un point à `5 + look × vitesse` mètres devant (courbure 2·latéral / distance²).
    const ahead = line.s[idx]! + 5 + look * speed;
    let j = idx;
    while (j < n - 1 && line.s[j]! < ahead) j++;
    const tx = line.x[j]! - car.x;
    const tz = line.z[j]! - car.z;
    const fwd = tx * fx + tz * fz;
    const left = tx * fz - tz * fx;
    let steer = 0;
    if (car.grounded) {
      if (fwd <= 0) steer = left > 0 ? -1 : 1;
      else {
        let curvature = (2 * left) / (fwd * fwd + left * left);
        // Virage relevé : la pesanteur fait déjà une part du travail (g × pente), le volant n'a pas à la refaire.
        const relief = (params.gravity * line.bank[idx]!) / Math.max(speed * speed, 100);
        const mag = curvature < 0 ? -curvature : curvature;
        curvature = (curvature < 0 ? -1 : 1) * Math.max(0, mag - relief);
        steer = clamp((-1.25 * curvature * 2.6) / steerLimit(u, params), -1, 1);
      }
    }

    // Vitesse : celle du profil un peu plus loin (le temps de réagir), gaz ou frein tout-ou-rien.
    let k = idx;
    const lead = line.s[idx]! + speed * 0.12;
    while (k < n - 1 && line.s[k]! < lead) k++;
    const target = line.speed[k]!;
    const tooFast = speed > target + 0.5;
    // Pas de coup de frein braqué (il déclencherait un dérapage) : on lâche seulement les gaz.
    const brake = tooFast && steer < 0.5 && steer > -0.5 && car.grounded;
    // Sur glace, l'accélérateur ôte l'adhérence : on le lâche pour tourner (roue libre), on le rend en ligne droite.
    const turning = line.slick[idx]! > 0 && (steer > 0.12 || steer < -0.12);
    const throttle = !tooFast && speed < target && !turning;
    return makeInput(steer, throttle ? 1 : 0, brake ? 1 : 0);
  };
}

export interface PilotRun {
  /** Vrai si le pilote franchit l'arrivée sans tomber ni reprendre. */
  valid: boolean;
  finishMs: number;
  ticks: number;
  respawns: number;
  replay: Replay;
  /** Vitesse horizontale maximale atteinte (m/s) et nombre de pas passés au-delà de la pointe du plat (lot 15). */
  maxSpeed: number;
  fastTicks: number;
  /** Vitesse du pilote au bord de chaque rampe de saut (lot 17), avec la fenêtre du saut. */
  jumps: JumpPass[];
  /** Vrai si chaque saut a été pris dans sa fenêtre de vitesse avec la marge `JUMP_ENTRY_MARGIN` (aucun saut = vrai). */
  jumpsOk: boolean;
}

export interface JumpPass {
  jump: JumpInfo;
  /** Vitesse au passage du bord de la rampe (m/s), ou 0 si le pilote n'y est pas arrivé. */
  speed: number;
}

/** Le pilote doit aborder chaque saut avec cette marge au-dessus de la vitesse minimale de sa fenêtre (un joueur correct doit pouvoir faire de même). */
export const JUMP_ENTRY_MARGIN = 1.08;

/** Fait rouler un pilote jusqu'à l'arrivée (ou `maxSeconds`, ou jusqu'à ce qu'il soit bloqué). */
export function runPilot(track: Track, opts: AutopilotOptions = {}, maxSeconds = 120): PilotRun {
  const race = createRace(track, opts.params);
  const drive = createAutopilot(track, opts);
  const recorder = new ReplayRecorder();
  const maxTicks = maxSeconds * TICK_RATE;
  let ticks = 0;
  let stuck = 0;
  let maxV2 = 0;
  let fastTicks = 0;
  const flatTop = (opts.params ?? DEFAULT_CAR_PARAMS).maxSpeed;
  // Bord de chaque rampe de saut : on note la vitesse au moment où la voiture franchit ce plan.
  const jumps: JumpPass[] = trackJumps(track, opts.params).map((jump) => ({ jump, speed: 0 }));
  const lips = jumps.map(({ jump }) => {
    const b = track.blocks[jump.kick]!;
    const pt = { x: 0, z: 0 };
    blockPoint(b, CELL / 2, CELL, pt);
    return { x: pt.x, z: pt.z, fx: dirX(b.dir), fz: dirZ(b.dir) };
  });
  while (race.finishMs < 0 && ticks < maxTicks && race.respawns === 0) {
    const input = drive(race);
    recorder.record(input);
    stepRace(race, input);
    ticks++;
    // Bloqué : presque à l'arrêt pendant 3 s après le départ.
    const v2 = race.car.vx * race.car.vx + race.car.vz * race.car.vz;
    for (let j = 0; j < jumps.length; j++) {
      const lip = lips[j]!;
      if (jumps[j]!.speed > 0) continue;
      const dx = race.car.x - lip.x;
      const dz = race.car.z - lip.z;
      // Le plan du bord, mais seulement près de la rampe (une autre partie du circuit peut passer du bon côté du plan).
      if (dx * dx + dz * dz < 400 && dx * lip.fx + dz * lip.fz >= 0) jumps[j]!.speed = Math.sqrt(v2);
    }
    if (v2 > maxV2) maxV2 = v2;
    if (v2 > flatTop * flatTop) fastTicks++;
    stuck = v2 < 0.25 && ticks > 2 * TICK_RATE ? stuck + 1 : 0;
    if (stuck > 3 * TICK_RATE) break;
  }
  return {
    valid: race.finishMs >= 0 && race.respawns === 0,
    finishMs: race.finishMs,
    ticks,
    respawns: race.respawns,
    replay: recorder.toReplay(track.id),
    maxSpeed: Math.sqrt(maxV2),
    fastTicks,
    jumps,
    jumpsOk: jumps.every(({ jump, speed }) => speed >= jump.minSpeed * JUMP_ENTRY_MARGIN && speed <= jump.maxSpeed),
  };
}

/** Fractions d'adhérence essayées : le temps de l'auteur est celui de la meilleure course valide. */
export const PILOT_GRIPS = [1.08, 1, 0.9, 0.78] as const;

/** La meilleure course valide parmi plusieurs réglages du pilote, ou `null` si aucun ne finit le circuit. */
export function bestPilotRun(track: Track): PilotRun | null {
  let best: PilotRun | null = null;
  for (const grip of PILOT_GRIPS) {
    const run = runPilot(track, { grip });
    if (run.valid && run.jumpsOk && (!best || run.finishMs < best.finishMs)) best = run;
  }
  return best;
}
