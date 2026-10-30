// Moteur A — le monde : corps rigides (tétrominos = boîtes soudées), diffusion large, contacts, solveur à impulsions séquentielles à nombre d'itérations FIXE,
// frottement de Coulomb, mise en sommeil par îlots. Virgule fixe Q16 sur entiers (fixe.ts) ; trigonométrie par table (trig.ts) ; aucun flottant dans l'état.
import type { Box8 } from "../pieces";
import { type Contact, collideBoxes, newContact } from "./collision";
import { ONE, abs, div, idiv, isqrt, mul, mulDiv } from "./fixe";
import { BRAD_PER_RAD_NUM, cos, sin, wrap } from "./trig";

// ---- réglages internes (entiers Q16 ou ticks) ----
export interface TuningA {
  /** Facteur de correction de pénétration (Baumgarte), Q16 : 0,2. */
  biasFactor: number;
  /** Pénétration tolérée, Q16 : 0,01 m. */
  allowedPenetration: number;
  /** Vitesse de correction maximale, Q16 : 2 m/s. */
  maxBias: number;
  /** Vitesse sous laquelle un corps est « au repos » (|vx|+|vy|), Q16 : 0,06 m/s. */
  sleepLinear: number;
  /** Idem pour la rotation, Q16 rad/s : 0,10. */
  sleepAngular: number;
  /** Nombre de pas de repos avant de s'endormir (30 = 0,5 s à 60 Hz). */
  sleepTicks: number;
  /** Vitesse d'arrivée minimale (Q16 m/s) pour qu'un rebond s'applique. */
  restitutionThreshold: number;
}
export const DEFAULT_TUNING_A: TuningA = {
  biasFactor: 13107,
  allowedPenetration: 655,
  maxBias: 2 * ONE,
  sleepLinear: 3932,
  sleepAngular: 6554,
  sleepTicks: 30,
  restitutionThreshold: 1 * ONE,
};

const MAX_V = 80 * ONE;
const MAX_W = 60 * ONE;

export interface BoxQ {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

export interface Body {
  id: number;
  isStatic: boolean;
  invM: number;
  invI: number;
  x: number;
  y: number;
  angle: number;
  c: number;
  s: number;
  vx: number;
  vy: number;
  w: number;
  boxes: BoxQ[];
  radius: number;
  sleepTime: number;
  asleep: boolean;
  lost: boolean;
}

interface Arbiter {
  a: Body;
  b: Body;
  ia: number;
  ib: number;
  key: number;
  contacts: Contact[];
  n: number;
  stamp: number;
}

export interface WorldA {
  tick: number;
  dt: number; // Q16 s
  gdt: number; // Q16 m/s par pas
  invDt: number; // Q16 1/s
  friction: number;
  restitution: number;
  iterations: number;
  sleep: boolean;
  tuning: TuningA;
  bodies: Body[]; // [0] = la plateforme
  arbiters: Map<number, Arbiter>;
  stamp: number;
}

const toQ = (eighths: number): number => eighths * 8192; // 1/8 de case = 2^13 en Q16 (1 case = 1 m)

export function createWorldA(cfg: { hz: number; gravityCm: number; frictionPct: number; restitutionPct: number; iterations: number; sleep: boolean; platformHalf8: number }, tuning: TuningA = DEFAULT_TUNING_A): WorldA {
  const dt = idiv(ONE, cfg.hz);
  const g = idiv(cfg.gravityCm * ONE, 100);
  const w: WorldA = {
    tick: 0,
    dt,
    gdt: mul(g, dt),
    invDt: cfg.hz * ONE,
    friction: idiv(cfg.frictionPct * ONE, 100),
    restitution: idiv(cfg.restitutionPct * ONE, 100),
    iterations: cfg.iterations,
    sleep: cfg.sleep,
    tuning,
    bodies: [],
    arbiters: new Map(),
    stamp: 0,
  };
  const hw = toQ(cfg.platformHalf8);
  w.bodies.push({
    id: 0, isStatic: true, invM: 0, invI: 0, x: 0, y: -ONE / 2, angle: 0, c: ONE, s: 0, vx: 0, vy: 0, w: 0,
    boxes: [{ cx: 0, cy: 0, hw, hh: ONE / 2 }], radius: isqrt(hw * hw + (ONE / 2) * (ONE / 2)), sleepTime: 0, asleep: true, lost: false,
  });
  return w;
}

export function addPieceA(w: WorldA, boxes8: Box8[], x8: number, y8: number, vx8: number, vy8: number): number {
  const boxes: BoxQ[] = boxes8.map((b) => ({ cx: toQ(b.cx), cy: toQ(b.cy), hw: toQ(b.hw), hh: toQ(b.hh) }));
  // Masse : aire en cases (densité 1) ; inertie autour du centre de masse = somme de m(l²+h²)/12 + m·d². Les boîtes sont en huitièmes de case : aire8 = (2hw)(2hh) / 64 cases.
  let massQ = 0;
  let inertiaQ = 0;
  let radius = 0;
  for (const b of boxes8) {
    const w8 = 2 * b.hw;
    const h8 = 2 * b.hh;
    const area8 = w8 * h8; // en huitièmes de case au carré (64 = 1 case)
    massQ += area8 * 1024; // area8/64 cases × 65 536
    inertiaQ += mulDiv(area8 * (w8 * w8 + h8 * h8), ONE, 4096 * 12); // m(w²+h²)/12 en cases² : area8/64 × (w8²+h8²)/64 /12
    inertiaQ += mulDiv(area8 * (b.cx * b.cx + b.cy * b.cy), ONE, 4096);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const px = toQ(b.cx + sx * b.hw);
      const py = toQ(b.cy + sy * b.hh);
      const r = isqrt(px * px + py * py);
      if (r > radius) radius = r;
    }
  }
  const body: Body = {
    id: w.bodies.length, isStatic: false, invM: idiv(ONE * ONE, massQ), invI: idiv(ONE * ONE, inertiaQ),
    x: toQ(x8), y: toQ(y8), angle: 0, c: ONE, s: 0, vx: toQ(vx8), vy: toQ(vy8), w: 0, boxes, radius, sleepTime: 0, asleep: false, lost: false,
  };
  w.bodies.push(body);
  return body.id - 1;
}

const scratch: Contact[] = [newContact(), newContact()];

function boxWorld(b: Body, k: BoxQ): [number, number] {
  return [b.x + mul(b.c, k.cx) - mul(b.s, k.cy), b.y + mul(b.s, k.cx) + mul(b.c, k.cy)];
}

function inactive(b: Body): boolean {
  return b.isStatic || b.asleep || b.lost;
}

function updateArbiter(arb: Arbiter, fresh: Contact[], n: number): void {
  // On garde les impulsions des contacts qui portent la même « feature » (démarrage à chaud).
  const old = arb.contacts;
  const oldN = arb.n;
  const merged: Contact[] = [];
  for (let i = 0; i < n; i++) {
    const c = newContact();
    Object.assign(c, fresh[i]);
    c.pn = 0;
    c.pt = 0;
    for (let j = 0; j < oldN; j++) {
      if (old[j]!.feature === c.feature) {
        c.pn = old[j]!.pn;
        c.pt = old[j]!.pt;
        break;
      }
    }
    merged.push(c);
  }
  arb.contacts = merged;
  arb.n = n;
}

function narrowPhase(w: WorldA): void {
  w.stamp++;
  const bodies = w.bodies;
  const nb = bodies.length;
  for (let i = 0; i < nb; i++) {
    const a = bodies[i]!;
    if (a.lost) continue;
    for (let j = i + 1; j < nb; j++) {
      const b = bodies[j]!;
      if (b.lost) continue;
      if (inactive(a) && inactive(b)) continue;
      const reach = a.radius + b.radius;
      if (abs(a.x - b.x) > reach || abs(a.y - b.y) > reach) continue;
      for (let ia = 0; ia < a.boxes.length; ia++) {
        const ka = a.boxes[ia]!;
        const [pax, pay] = boxWorld(a, ka);
        for (let ib = 0; ib < b.boxes.length; ib++) {
          const kb = b.boxes[ib]!;
          const [pbx, pby] = boxWorld(b, kb);
          const n = collideBoxes(scratch, pax, pay, ka.hw, ka.hh, a.c, a.s, pbx, pby, kb.hw, kb.hh, b.c, b.s);
          if (n === 0) continue;
          const key = ((i * 1024 + j) * 8 + ia) * 8 + ib;
          let arb = w.arbiters.get(key);
          if (!arb) {
            arb = { a, b, ia, ib, key, contacts: [], n: 0, stamp: 0 };
            w.arbiters.set(key, arb);
          }
          updateArbiter(arb, scratch, n);
          arb.stamp = w.stamp;
        }
      }
    }
  }
  // Les arbitres des paires traitées qui n'ont plus de contact disparaissent ; ceux des paires endormies restent (leurs impulsions servent au réveil).
  for (const [key, arb] of w.arbiters) {
    if (arb.stamp !== w.stamp && (arb.a.lost || arb.b.lost || !(inactive(arb.a) && inactive(arb.b)))) w.arbiters.delete(key);
  }
}

function preStep(w: WorldA, arb: Arbiter): void {
  const a = arb.a;
  const b = arb.b;
  const t = w.tuning;
  for (let i = 0; i < arb.n; i++) {
    const c = arb.contacts[i]!;
    c.r1x = c.px - a.x;
    c.r1y = c.py - a.y;
    c.r2x = c.px - b.x;
    c.r2y = c.py - b.y;
    const rn1 = mul(c.r1x, c.nx) + mul(c.r1y, c.ny);
    const rn2 = mul(c.r2x, c.nx) + mul(c.r2y, c.ny);
    const kNormal = a.invM + b.invM + mul(a.invI, mul(c.r1x, c.r1x) + mul(c.r1y, c.r1y) - mul(rn1, rn1)) + mul(b.invI, mul(c.r2x, c.r2x) + mul(c.r2y, c.r2y) - mul(rn2, rn2));
    c.massNormal = div(ONE, kNormal);
    const tx = c.ny;
    const ty = -c.nx;
    const rt1 = mul(c.r1x, tx) + mul(c.r1y, ty);
    const rt2 = mul(c.r2x, tx) + mul(c.r2y, ty);
    const kTangent = a.invM + b.invM + mul(a.invI, mul(c.r1x, c.r1x) + mul(c.r1y, c.r1y) - mul(rt1, rt1)) + mul(b.invI, mul(c.r2x, c.r2x) + mul(c.r2y, c.r2y) - mul(rt2, rt2));
    c.massTangent = div(ONE, kTangent);
    // Correction de pénétration (Baumgarte), plafonnée.
    const pen = c.sep + t.allowedPenetration;
    let bias = pen < 0 ? -mul(mul(t.biasFactor, w.invDt), pen) : 0;
    if (bias > t.maxBias) bias = t.maxBias;
    // Rebond : seulement si l'arrivée est assez rapide.
    if (w.restitution > 0) {
      const dvx = b.vx - mul(b.w, c.r2y) - a.vx + mul(a.w, c.r1y);
      const dvy = b.vy + mul(b.w, c.r2x) - a.vy - mul(a.w, c.r1x);
      const vn = mul(dvx, c.nx) + mul(dvy, c.ny);
      if (vn < -t.restitutionThreshold) {
        const rb = -mul(w.restitution, vn);
        if (rb > bias) bias = rb;
      }
    }
    c.bias = bias;
    // Démarrage à chaud
    const px = mul(c.pn, c.nx) + mul(c.pt, tx);
    const py = mul(c.pn, c.ny) + mul(c.pt, ty);
    applyImpulse(a, b, c, px, py);
  }
}

function applyImpulse(a: Body, b: Body, c: Contact, px: number, py: number): void {
  a.vx -= mul(a.invM, px);
  a.vy -= mul(a.invM, py);
  a.w -= mul(a.invI, mul(c.r1x, py) - mul(c.r1y, px));
  b.vx += mul(b.invM, px);
  b.vy += mul(b.invM, py);
  b.w += mul(b.invI, mul(c.r2x, py) - mul(c.r2y, px));
}

function solve(w: WorldA, arb: Arbiter): void {
  const a = arb.a;
  const b = arb.b;
  for (let i = 0; i < arb.n; i++) {
    const c = arb.contacts[i]!;
    // normale
    let dvx = b.vx - mul(b.w, c.r2y) - a.vx + mul(a.w, c.r1y);
    let dvy = b.vy + mul(b.w, c.r2x) - a.vy - mul(a.w, c.r1x);
    const vn = mul(dvx, c.nx) + mul(dvy, c.ny);
    let dPn = mul(c.massNormal, c.bias - vn);
    const pn0 = c.pn;
    c.pn = pn0 + dPn > 0 ? pn0 + dPn : 0;
    dPn = c.pn - pn0;
    applyImpulse(a, b, c, mul(dPn, c.nx), mul(dPn, c.ny));
    // frottement
    dvx = b.vx - mul(b.w, c.r2y) - a.vx + mul(a.w, c.r1y);
    dvy = b.vy + mul(b.w, c.r2x) - a.vy - mul(a.w, c.r1x);
    const tx = c.ny;
    const ty = -c.nx;
    const vt = mul(dvx, tx) + mul(dvy, ty);
    let dPt = mul(c.massTangent, -vt);
    const maxPt = mul(w.friction, c.pn);
    const pt0 = c.pt;
    let pt = pt0 + dPt;
    if (pt > maxPt) pt = maxPt;
    else if (pt < -maxPt) pt = -maxPt;
    c.pt = pt;
    dPt = pt - pt0;
    applyImpulse(a, b, c, mul(dPt, tx), mul(dPt, ty));
  }
}

export function stepA(w: WorldA): void {
  narrowPhase(w);
  const bodies = w.bodies;
  if (w.sleep) wakeIslands(w);
  // Gravité sur les corps éveillés
  for (const b of bodies) if (!inactive(b)) b.vy -= w.gdt;
  // Les contacts qui touchent un corps éveillé sont résolus, du bas (corps les plus anciens) vers le haut.
  const live: Arbiter[] = [];
  for (const arb of w.arbiters.values()) if (arb.n > 0 && !(inactive(arb.a) && inactive(arb.b))) live.push(arb);
  live.sort((p, q) => p.key - q.key);
  for (const arb of live) preStep(w, arb);
  // Balayage alterné (du bas vers le haut, puis du haut vers le bas) : la charge se propage dans les deux sens, la tour s'affaisse moins qu'à sens unique.
  const n = live.length;
  for (let it = 0; it < w.iterations; it++) {
    if ((it & 1) === 0) for (let k = 0; k < n; k++) solve(w, live[k]!);
    else for (let k = n - 1; k >= 0; k--) solve(w, live[k]!);
  }
  // Intégration
  for (const b of bodies) {
    if (inactive(b)) continue;
    if (b.vx > MAX_V) b.vx = MAX_V; else if (b.vx < -MAX_V) b.vx = -MAX_V;
    if (b.vy > MAX_V) b.vy = MAX_V; else if (b.vy < -MAX_V) b.vy = -MAX_V;
    if (b.w > MAX_W) b.w = MAX_W; else if (b.w < -MAX_W) b.w = -MAX_W;
    b.x += mul(b.vx, w.dt);
    b.y += mul(b.vy, w.dt);
    const da = idiv(b.w * w.dt * BRAD_PER_RAD_NUM, ONE * ONE);
    if (da !== 0) {
      b.angle = wrap(b.angle + da);
      b.c = cos(b.angle);
      b.s = sin(b.angle);
    }
    if (b.y < LOST_Q) {
      b.lost = true;
      b.vx = b.vy = b.w = 0;
    }
  }
  if (w.sleep) sleepIslands(w);
  else restTimes(w);
  w.tick++;
}

/** Sous ce niveau (−4 m), une pièce est perdue. */
const LOST_Q = -4 * ONE;

/** Racine de l'îlot de chaque corps : les corps dynamiques en contact (éveillés ou endormis) forment un îlot ; la plateforme n'en relie aucun. */
function islandRoots(w: WorldA): number[] {
  const parent: number[] = w.bodies.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (const arb of w.arbiters.values()) {
    if (arb.n === 0 || arb.a.isStatic || arb.b.isStatic || arb.a.lost || arb.b.lost) continue;
    const ra = find(arb.a.id);
    const rb = find(arb.b.id);
    if (ra !== rb) parent[ra] = rb;
  }
  return w.bodies.map((_, i) => find(i));
}

/** Un îlot qui contient un corps éveillé est tout éveillé (un corps qui tombe sur une tour endormie la réveille en bloc). */
function wakeIslands(w: WorldA): void {
  const roots = islandRoots(w);
  const awake = new Set<number>();
  for (const b of w.bodies) if (!b.isStatic && !b.lost && !b.asleep) awake.add(roots[b.id]!);
  for (const b of w.bodies) {
    if (b.isStatic || b.lost || !b.asleep || !awake.has(roots[b.id]!)) continue;
    b.asleep = false;
    b.sleepTime = 0;
  }
}

function restTimes(w: WorldA): void {
  const t = w.tuning;
  for (const b of w.bodies) {
    if (b.isStatic || b.lost || b.asleep) continue;
    if (abs(b.vx) + abs(b.vy) < t.sleepLinear && abs(b.w) < t.sleepAngular) b.sleepTime++;
    else b.sleepTime = 0;
  }
}

/** Un îlot dont tous les corps sont au repos depuis `sleepTicks` pas s'endort. */
function sleepIslands(w: WorldA): void {
  restTimes(w);
  const t = w.tuning;
  const roots = islandRoots(w);
  const minRest = new Map<number, number>();
  for (const b of w.bodies) {
    if (b.isStatic || b.lost) continue;
    const r = roots[b.id]!;
    const st = b.asleep ? t.sleepTicks : b.sleepTime;
    const m = minRest.get(r);
    if (m === undefined || st < m) minRest.set(r, st);
  }
  for (const b of w.bodies) {
    if (b.isStatic || b.lost || b.asleep) continue;
    if (minRest.get(roots[b.id]!)! >= t.sleepTicks) {
      b.asleep = true;
      b.vx = b.vy = b.w = 0;
    }
  }
}

export function snapshotA(w: WorldA): { x: number; y: number; angle: number; asleep: boolean; lost: boolean }[] {
  const out = [];
  for (let i = 1; i < w.bodies.length; i++) {
    const b = w.bodies[i]!;
    out.push({ x: b.x / ONE, y: b.y / ONE, angle: b.angle, asleep: b.asleep, lost: b.lost });
  }
  return out;
}

export function cloneWorldA(w: WorldA): WorldA {
  const bodies = w.bodies.map((b) => ({ ...b }));
  const arbiters = new Map<number, Arbiter>();
  for (const [k, arb] of w.arbiters) {
    arbiters.set(k, { ...arb, a: bodies[arb.a.id]!, b: bodies[arb.b.id]!, contacts: arb.contacts.map((c) => ({ ...c })) });
  }
  return { ...w, bodies, arbiters };
}

export function awakeA(w: WorldA): number {
  let n = 0;
  for (let i = 1; i < w.bodies.length; i++) if (!w.bodies[i]!.asleep && !w.bodies[i]!.lost) n++;
  return n;
}
