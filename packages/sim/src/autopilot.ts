import { TICK_RATE } from "./constants";
import { AXIS_MAX, COLLIDER_RADIUS, DEFAULT_CAR_PARAMS, makeInput, steerLimit, type CarInput, type CarParams, type CarState } from "./car";
import { HALF_PI, clamp, cos, sin } from "./math";
import { createRace, stepRace, type RaceState } from "./race";
import { ReplayRecorder, type Replay } from "./replay";
import { trackJumps, type JumpInfo } from "./jump";
import { BANK_SLOPE_TIGHT, BANK_SLOPE_WIDE, CELL, CUVE_LEFT, SHOULDER_EDGE, CUVE_RAMP_ARC, CUVE_RATIO, blockHalfWidth, blockPoint, blockSlope, curveCenter, curveSize, dirX, dirZ, isCurve, isWide, turnsLeft, type Block, type Track } from "./track";
import { cuveAmplitude } from "./cuve";
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
  /** Virages en cuve (lot 18) : monter sur la paroi extérieure, ou (par défaut) rester sur le fond comme sur un virage ordinaire. `bestPilotRun` essaie les deux. */
  wall?: boolean;
  /**
   * Coupe (lot 21, mesure) : mètres de plus vers l'intérieur d'un virage bordé d'un bas-côté (au-delà de la marge de la route) (0 = reste sur la route, le
   * défaut). Le profil de vitesse tient compte du revêtement du bas-côté là où la voiture y passe. Le pilote d'auteur ne coupe pas.
   */
  cut?: number;
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
const SMOOTH_ITERATIONS_CUVE = 4000;
/** Blocs de part et d'autre d'une cuve où la trajectoire est relaxée plus longtemps. */
const CUVE_NEAR = 4;
/** Écart latéral permis (m) du pilote en virage relevé. */
const BANKED_ROOM = 1.5;
/** Marge aux rebords (m) : demi-largeur de la voiture et un peu d'air. */
const WALL_MARGIN = COLLIDER_RADIUS + 2.6;
/**
 * Marge au bord de la route (m) quand il est bordé d'un bas-côté (lot 21) : pas de rebord à craindre, la voiture peut mordre sur le
 * vibreur (roues extérieures juste au bord). Plus petite que `WALL_MARGIN` : la corde s'ouvre.
 */
const SHOULDER_MARGIN = COLLIDER_RADIUS + 0.1;
/** Demi-voie (m) : une roue est sur le bas-côté dès que le centre de la voiture est à moins de ça du bord. */
const WHEEL_REACH = 0.85;
/**
 * Virage en cuve (lot 18) : le pilote monte sur la paroi extérieure, à cette distance (m) du pied de la paroi verticale selon la taille
 * du virage. Serré : tout en haut (c'est la paroi qui permet la vitesse) ; large et ample : à mi-pente (le trajet reste court, l'entrée et la sortie douces).
 */
const CUVE_INSET = [0, 1, 1.5, 1.5] as const;
/** Cuve droite (lot 18b) : le pilote monte presque en haut du quart de cercle (distance en m au pied de la paroi verticale) et y reste : la paroi est une voie rapide. */
const CUVE_INSET_STRAIGHT = 0.8;
/** Largeur de la rampe d'entrée et de sortie d'une paroi sur une droite (m) : sur la sortie le pilote ne freine pas, la voiture redescend. */
const STRAIGHT_RAMP = 16;
/** Part de la série de droites où le pilote monte, et où il redescend (le reste : il longe la paroi). */
const STRAIGHT_UP = 0.4;
const STRAIGHT_DOWN = 0.4;
/** Part de la série (à chaque bout) où la trajectoire n'est pas imposée. */
const STRAIGHT_FREE = 0.1;
/** 0 → 1 en lissage cubique, borné. */
function smooth01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
/** Inset (m) du pilote sur la paroi d'un bloc de cuve, selon que c'est un virage ou une droite. */
function cuveInset(b: Block): number {
  return isCurve(b.kind) ? CUVE_INSET[curveSize(b.kind)]! : CUVE_INSET_STRAIGHT;
}
/** Part de l'amplitude de la paroi à partir de laquelle la trajectoire est clouée à la paroi (avant : libre, elle rejoint ce point). */
const CUVE_PIN_FROM = 0.4;
/** Entonnoir (m) avant et après un virage en cuve, et distance (m) au rebord qu'il garde sur les routes ordinaires. */
const CUVE_FUNNEL = 80;
const FUNNEL_RIM = 1.5;

interface Centerline {
  x: number[];
  z: number[];
  /** Normale vers la gauche. */
  nx: number[];
  nz: number[];
  /** Écart latéral permis de part et d'autre (à gauche, à droite). */
  room: number[];
  roomR: number[];
  /** Demi-largeur de la route en chaque point (m). */
  half: number[];
  /** Bloc de chaque point. */
  blk: number[];
  /** Pente de la route (montée par mètre, dans le sens de la marche). */
  slope: number[];
  /** Écart latéral imposé (m, positif à gauche) sur la paroi d'un virage en cuve, ou NaN : la trajectoire y est clouée. */
  pin: number[];
  /** Pente de la paroi à l'endroit visé (montée par mètre en travers) : elle aide le virage comme un relevé (g × pente). */
  wall: number[];
  /** Vrai sur la rampe de sortie d'un virage en cuve : la paroi s'efface sous la voiture, qui ne freine plus. */
  wallExit: boolean[];
}

/** Pente de la paroi d'une cuve de demi-largeur `W` au point visé (à `inset` du pied de la paroi verticale) : tangente de son angle. */
function cuveWallSlope(W: number, inset: number): number {
  const R = CUVE_RATIO * W;
  const dx = R - inset;
  return dx / Math.sqrt(R * R - dx * dx);
}

function denseCenterline(track: Track, wall: boolean, cut = 0): Centerline {
  const out: Centerline = { x: [], z: [], nx: [], nz: [], room: [], roomR: [], half: [], blk: [], slope: [], pin: [], wall: [], wallExit: [] };
  const pt = { x: 0, z: 0 };
  const push = (p: number, q: number, b: Block, room: number, roomR = room, half = 0) => {
    blockPoint(b, p, q, pt);
    out.x.push(pt.x);
    out.z.push(pt.z);
    out.room.push(room);
    out.roomR.push(roomR);
    out.half.push(half);
    out.blk.push(b.index);
    out.slope.push(isCurve(b.kind) ? 0 : blockSlope(b, q));
    // Virage en cuve : la paroi extérieure est la ligne du pilote ; elle monte en rampe comme la paroi elle-même.
    if (wall && b.cuve) {
      const bit = isCurve(b.kind) ? b.cuve : b.cuve & CUVE_LEFT ? CUVE_LEFT : b.cuve;
      const a = cuveAmplitude(b, bit, p, q);
      out.pin.push(NaN); // le cloutage se fait plus bas, une fois les normales connues
      out.wall.push(a * cuveWallSlope(b.w0 / 2, cuveInset(b)));
      if (isCurve(b.kind)) {
        const adp = Math.abs(p - curveCenter(b.kind).cp);
        out.wallExit.push(!(b.cuveOut & bit) && q / (q + adp + 1e-9) > 1 - CUVE_RAMP_ARC);
      } else out.wallExit.push(!(b.cuveOut & bit) && q > CELL - STRAIGHT_RAMP);
    } else {
      out.pin.push(NaN);
      out.wall.push(0);
      out.wallExit.push(false);
    }
  };
  // Écart latéral permis : la demi-largeur de la route (qui varie d'un bloc à l'autre, et dans une transition) moins la marge.
  // Sur une route large, la trajectoire peut donc prendre une corde plus ouverte : c'est la relaxation ci-dessous qui s'en sert.
  for (const b of track.blocks) {
    const first = b.index === 0 ? 0 : 1; // le premier point d'un bloc est le dernier du précédent
    // Sur un tremplin, une rampe de saut, un vide et la réception qui suit, on reste au milieu : en l'air, on ne tourne pas.
    const prev = track.blocks[b.index - 1];
    const calm = b.kind === "jump" || b.kind === "kick" || b.kind === "gap" || prev?.kind === "jump" || prev?.kind === "gap";
    const open = b.open ? OPEN_EXTRA_MARGIN : 0;
    // Bas-côtés (lot 21) : le bord de la route n'est pas un mur, la marge est plus petite.
    const margin = b.shoulder ? SHOULDER_MARGIN : WALL_MARGIN;
    if (isCurve(b.kind)) {
      const { cp, r } = curveCenter(b.kind);
      const side = turnsLeft(b.kind) ? -1 : 1;
      const n = Math.round((HALF_PI * r) / SPACING);
      const room = b.banked ? BANKED_ROOM : b.w0 / 2 - margin - open;
      // Coupe (mesure) : côté intérieur, la trajectoire peut mordre de `cut` m sur le bas-côté (sans approcher son rebord).
      const inner = b.shoulder && cut > 0 && !b.banked ? Math.min(room + cut, SHOULDER_EDGE - WALL_MARGIN) : room;
      for (let i = first; i <= n; i++) {
        const a = (HALF_PI * i) / n;
        // Virage relevé : le bord intérieur est en contrebas et la rampe d'entrée y est raide ; on reste près de l'axe.
        // L'intérieur d'un virage à gauche est à gauche (normale positive).
        push(cp + side * r * cos(a), r * sin(a), b, side < 0 ? inner : room, side < 0 ? room : inner, b.w0 / 2);
      }
    } else {
      const n = Math.round(CELL / SPACING);
      for (let i = first; i <= n; i++) {
        const q = (CELL * i) / n;
        // Cuve droite : le pilote reste sur le fond (la paroi n'a pas d'intérêt en ligne droite).
        const floor = b.cuve && !wall ? b.w0 / 2 - (b.w0 / 2) * CUVE_RATIO - 0.3 : Infinity;
        const room = calm ? 0.5 : Math.min(floor, blockHalfWidth(b, q) - margin - open);
        push(CELL / 2, q, b, room, room, blockHalfWidth(b, q));
      }
    }
  }
  // Normales (vers la gauche) par différence centrée.
  const n = out.x.length;
  // Virage en cuve : la trajectoire est clouée à la paroi, et un entonnoir de `CUVE_FUNNEL` mètres de part et d'autre l'y amène (et l'en ramène)
  // en douceur, par un lissage cubique de l'écart latéral. Aucune liberté dans cette zone : la courbure y est faible par construction.
  // Cuve droite (lot 18b) : la série de blocs est une seule cuve, que le pilote « pompe » : il monte sur la paroi, la longe, puis redescend
  // vers l'axe avant la fin (la descente pousse, voir `shellDescent`). Le profil en travers est lissé sur la série entière.
  for (const b of wall ? track.blocks : []) {
    if (!b.cuve || isCurve(b.kind) || (b.cuveIn & b.cuve) !== 0) continue; // début d'une série de droites
    const bit = b.cuve & CUVE_LEFT ? CUVE_LEFT : b.cuve;
    const sign = bit === CUVE_LEFT ? 1 : -1;
    const chain = [b.index];
    for (let k = b.index + 1; k < track.blocks.length; k++) {
      const nb = track.blocks[k]!;
      if (!nb.cuve || isCurve(nb.kind) || (nb.cuveIn & bit) === 0) break;
      chain.push(k);
    }
    let first = -1;
    let last = -1;
    for (let i = 0; i < n; i++) {
      if (!chain.includes(out.blk[i]!)) continue;
      if (first < 0) first = i;
      last = i;
    }
    if (first < 0) continue;
    const target = b.w0 / 2 - cuveInset(b);
    // Les deux bouts restent libres (la relaxation y raccorde la trajectoire aux blocs voisins sans cassure de courbure).
    for (let i = first; i <= last; i++) {
      const f = ((i - first) / (last - first) - STRAIGHT_FREE) / (1 - 2 * STRAIGHT_FREE);
      if (f <= 0 || f >= 1) continue;
      const up = smooth01(f / STRAIGHT_UP);
      const down = smooth01((1 - f) / STRAIGHT_DOWN);
      out.pin[i] = sign * target * Math.min(up, down);
    }
  }
  for (const b of wall ? track.blocks : []) {
    if (!b.cuve || !isCurve(b.kind)) continue;
    const sign = b.cuve === CUVE_LEFT ? 1 : -1;
    const target = b.w0 / 2 - cuveInset(b);
    let first = -1;
    let last = -1;
    for (let i = 0; i < n; i++) {
      if (out.blk[i] !== b.index) continue;
      if (first < 0) first = i;
      last = i;
    }
    if (first < 0) continue;
    const reach = Math.min(target, b.w0 / 2 - FUNNEL_RIM);
    const funnel = CUVE_FUNNEL / SPACING;
    const set = (i: number, off: number) => {
      if (i < 0 || i >= n || out.room[i]! < 1) return; // pas de décalage sur une rampe de saut ou sa réception
      const cur = out.pin[i]!;
      const v = sign * off;
      if (cur !== cur || Math.abs(v) > Math.abs(cur)) out.pin[i] = v;
    };
    for (let i = first; i <= last; i++) {
      const a = out.wall[i]! / cuveWallSlope(b.w0 / 2, cuveInset(b)); // amplitude de la paroi en ce point
      set(i, a >= CUVE_PIN_FROM ? target : reach + (target - reach) * (a / CUVE_PIN_FROM));
    }
    for (let k = 1; k <= funnel; k++) {
      const t = 1 - k / funnel;
      const off = reach * t * t * (3 - 2 * t);
      set(first - k, off);
      set(last + k, off);
    }
  }
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
const pathCaches = new Map<string, WeakMap<Track, Path>>();

function racingPath(track: Track, wall = false, cut = 0): Path {
  const key = `${wall ? 1 : 0}:${cut}`;
  let cache = pathCaches.get(key);
  if (!cache) pathCaches.set(key, (cache = new WeakMap()));
  const cached = cache.get(track);
  if (cached) return cached;
  const c = denseCenterline(track, wall, cut);
  const n = c.x.length;
  const x = c.x.slice();
  const z = c.z.slice();
  // Relaxation (Gauss-Seidel) : chaque point va vers le milieu de ses voisins, sans sortir de la route.
  // Une cuve demande une trajectoire clouée à la paroi et un entonnoir : autour d'elle seulement (`CUVE_NEAR` blocs de part et d'autre),
  // la relaxation converge plus loin ; le reste du circuit garde le même tracé qu'au sol.
  const relax = (from: number, to: number, count: number) => {
    for (let it = 0; it < count; it++) {
      for (let i = Math.max(1, from); i < Math.min(n - 1, to); i++) {
        const mx = (x[i - 1]! + x[i + 1]!) / 2;
        const mz = (z[i - 1]! + z[i + 1]!) / 2;
        const pinned = c.pin[i]!;
        const o = pinned === pinned ? pinned : clamp((mx - c.x[i]!) * c.nx[i]! + (mz - c.z[i]!) * c.nz[i]!, -c.roomR[i]!, c.room[i]!);
        x[i] = c.x[i]! + o * c.nx[i]!;
        z[i] = c.z[i]! + o * c.nz[i]!;
      }
    }
  };
  relax(0, n, SMOOTH_ITERATIONS);
  if (wall) {
    const cuves = track.blocks.filter((b) => b.cuve).map((b) => b.index);
    if (cuves.length > 0) {
      let from = -1;
      let to = -1;
      for (let i = 0; i < n; i++) {
        const near = cuves.some((k) => Math.abs(c.blk[i]! - k) <= CUVE_NEAR);
        if (near && from < 0) from = i;
        if (near) to = i + 1;
      }
      relax(from, to, SMOOTH_ITERATIONS_CUVE - SMOOTH_ITERATIONS);
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
    // Sur un bas-côté (coupe), le revêtement des roues qui y passent : mélange selon la part de la voiture hors de la route.
    const off = b.shoulder ? (x[i]! - c.x[i]!) * c.nx[i]! + (z[i]! - c.z[i]!) * c.nz[i]! : 0;
    const out = b.shoulder ? clamp(((off < 0 ? -off : off) + WHEEL_REACH - c.half[i]!) / (2 * WHEEL_REACH), 0, 1) : 0;
    if (out > 0) {
      const sh = SURFACES[b.shoulder!];
      grip.push(m.grip + out * (sh.grip - m.grip));
      traction.push(m.traction + out * (sh.traction - m.traction));
      rolling.push(m.rolling + out * (sh.rolling - m.rolling));
    } else {
      grip.push(m.grip);
      traction.push(m.traction);
      rolling.push(m.rolling);
    }
    slick.push(m.slick);
    bank.push(b.banked ? (isWide(b.kind) ? BANK_SLOPE_WIDE : BANK_SLOPE_TIGHT) : c.wall[i]!);
  }
  // Zone de saut : de la rampe à la fin du bloc qui suit la réception. Elle commence au bloc `K` et finit un bloc après la réception.
  const zone = new Set<number>();
  for (const j of trackJumps(track)) for (let i = j.kick; i <= j.landing + 1; i++) zone.add(i);
  const airborne = c.blk.map((b, i) => zone.has(b) || c.wallExit[i]!);
  const path = { x, z, s, grip, traction, rolling, bank, slick, slope: c.slope, airborne };
  cache.set(track, path);
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
  wall = false,
  cut = 0,
): RacingLine {
  const { x, z, s, grip, traction, rolling, bank, slick, slope, airborne } = racingPath(track, wall, cut);
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
/** Le pilote fige la caisse en l'air (frein) dès qu'elle tourne plus vite que ça (pente/s ou rad/s) et que le vol dure depuis `AIR_FREEZE_AFTER` sous-pas. */
const AIR_SPIN = 0.12;
const AIR_FREEZE_AFTER = 6;

/** Vrai si la voiture est en vol et que sa caisse tourne : le frein la figerait (ce que fait le pilote, et ce que fait un bon joueur). */
export function needsFreeze(car: Readonly<CarState>): boolean {
  return (
    !car.grounded &&
    car.air >= AIR_FREEZE_AFTER &&
    (car.pitchRate > AIR_SPIN || car.pitchRate < -AIR_SPIN || car.rollRate > AIR_SPIN || car.rollRate < -AIR_SPIN || car.yawRate > AIR_SPIN || car.yawRate < -AIR_SPIN)
  );
}

export function createAutopilot(track: Track, opts: AutopilotOptions = {}) {
  const params = opts.params ?? DEFAULT_CAR_PARAMS;
  const grip = opts.grip ?? 0.9;
  const look = opts.look ?? 0.3;
  const lateral = ((params.gripFront + params.gripRear) / 2) * 0.85 * grip;
  const line = racingLine(track, lateral, params.brake * 0.8, params.turboMaxSpeed, params.gravity, params.iceCoastGrip, params.slopeGravity, opts.wall ?? false, opts.cut ?? 0);
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
    // Lot 19 : en l'air, la caisse garde la rotation de son décollage ; tant qu'elle tourne, le frein la fige (il ne ralentit pas la voiture).
    const brake = (tooFast && steer < 0.5 && steer > -0.5 && car.grounded) || needsFreeze(car);
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
  /** Lot 20 (mesure seule) : pas passés à plein gaz sans frein et moteur en marche (un moteur coupé n'est pas à plein gaz), et nombre de freinages ou relâchements (au moins 0,1 s sans plein gaz, au-delà de 10 m/s). */
  fullThrottleTicks: number;
  liftEvents: number;
  /**
   * Lot 21 (mesure des moments de choix) : freinages au sol (au-delà de 10 m/s ; les coups de frein à moins de 0,5 s d'intervalle comptent
   * pour un), passages en roue libre (au moins 0,1 s sans gaz ni frein, au-delà de 10 m/s) et vols d'au moins 0,25 s où le frein a figé la caisse.
   */
  brakeEvents: number;
  coastEvents: number;
  freezeEvents: number;
  /** Vitesse du pilote au bord de chaque rampe de saut (lot 17), avec la fenêtre du saut. */
  jumps: JumpPass[];
  /** Vrai si chaque saut a été pris dans sa fenêtre de vitesse avec la marge `JUMP_ENTRY_MARGIN` (aucun saut = vrai). */
  jumpsOk: boolean;
  /** Vrai si les virages en cuve ont été pris sur la paroi (réglage `wall`), faux sur le fond. */
  wall: boolean;
  /** Fraction d'adhérence de ce pilote (voir `PILOT_GRIPS`). */
  grip: number;
  /** Coupe par le bas-côté (lot 21, voir `AutopilotOptions.cut`) : 0 si le pilote reste sur la route. */
  cut: number;
}

export interface JumpPass {
  jump: JumpInfo;
  /** Vitesse au passage du bord de la rampe (m/s), ou 0 si le pilote n'y est pas arrivé. */
  speed: number;
}

/** Le pilote doit aborder chaque saut avec cette marge au-dessus de la vitesse minimale de sa fenêtre (un joueur correct doit pouvoir faire de même). */
export const JUMP_ENTRY_MARGIN = 1.08;

/** Deux coups de frein séparés de moins de ça (pas) font un seul freinage ; un vol plus court que ça (pas) n'est pas un saut. */
const BRAKE_GAP = 60;
const FREEZE_FLIGHT = 30;

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
  let fullThrottleTicks = 0;
  let liftEvents = 0;
  let offRun = 0;
  let brakeEvents = 0;
  let coastEvents = 0;
  let freezeEvents = 0;
  let sinceBrake = Infinity;
  let coastRun = 0;
  let frozeThisFlight = false;
  let flight = 0;
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
    {
      const c = race.car;
      const sp2 = c.vx * c.vx + c.vz * c.vz;
      if (input.brake > 0 && c.grounded === 1 && sp2 > 100) {
        if (sinceBrake > BRAKE_GAP) brakeEvents++;
        sinceBrake = 0;
      } else sinceBrake++;
      if (input.throttle === 0 && input.brake === 0 && c.grounded === 1 && sp2 > 100) {
        if (++coastRun === 12) coastEvents++;
      } else coastRun = 0;
      if (c.grounded === 1) {
        if (frozeThisFlight && flight >= FREEZE_FLIGHT) freezeEvents++;
        frozeThisFlight = false;
        flight = 0;
      } else {
        flight++;
        if (input.brake > 0) frozeThisFlight = true;
      }
    }
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
    if (input.throttle >= AXIS_MAX && input.brake === 0 && !race.car.cut) {
      fullThrottleTicks++;
      offRun = 0;
    } else if (v2 > 100 && ++offRun === 12) liftEvents++;
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
    fullThrottleTicks,
    liftEvents,
    brakeEvents,
    coastEvents,
    freezeEvents,
    jumps,
    jumpsOk: jumps.every(({ jump, speed }) => speed >= jump.minSpeed * JUMP_ENTRY_MARGIN && speed <= jump.maxSpeed),
    wall: opts.wall ?? false,
    grip: opts.grip ?? 0.9,
    cut: opts.cut ?? 0,
  };
}

/** Fractions d'adhérence essayées : le temps de l'auteur est celui de la meilleure course valide. */
export const PILOT_GRIPS = [1.08, 1, 0.9, 0.78] as const;

/**
 * Coupe essayée par le pilote d'auteur (lot 21) : 0,5 m de plus vers l'intérieur des virages bordés d'un bas-côté, les roues intérieures
 * à 25 cm dessus. Mesuré (`npm run measure:generator`) : plus rapide sur un circuit à bas-côtés sur trois environ, plus lent au-delà d'1 m.
 */
export const PILOT_CUT = 0.5;

/**
 * La meilleure course valide parmi plusieurs réglages du pilote, ou `null` si aucun ne finit le circuit. Sur un circuit dont un virage est
 * bordé d'un bas-côté, le meilleur réglage est refait en coupant (`PILOT_CUT`) : la coupe n'est gardée que si elle est plus rapide.
 */
export function bestPilotRun(track: Track): PilotRun | null {
  let best: PilotRun | null = null;
  // Avec un virage en cuve, on essaie aussi de le prendre sur le fond : la paroi n'est utile que si elle fait gagner du temps.
  const walls = track.blocks.some((b) => b.cuve) ? [false, true] : [false];
  for (const wall of walls) {
    for (const grip of PILOT_GRIPS) {
      const run = runPilot(track, { grip, wall });
      if (run.valid && run.jumpsOk && (!best || run.finishMs < best.finishMs)) best = run;
    }
  }
  if (best && track.blocks.some((b) => b.shoulder && isCurve(b.kind))) {
    const run = runPilot(track, { grip: best.grip, wall: best.wall, cut: PILOT_CUT });
    if (run.valid && run.jumpsOk && run.finishMs < best.finishMs) best = run;
  }
  return best;
}
