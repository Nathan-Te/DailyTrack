import { DT } from "./constants";
import { AXIS_MAX, steerLimit, type CarInput, type CarParams, type CarState } from "./car";
import { HALF_PI, PI, TWO_PI, clamp, cos, sin } from "./math";
import { BOUCLE_LARGEUR, BOUCLE_RAYON, CELL, FX_BROKEN, FX_CRUISE, FX_NO_BRAKE, FX_NO_STEER, blockPoint, canonP, canonQ, curveCenter, isCurve, turnsLeft, type Block } from "./track";

// Lot 58b — la boucle (bloc `O` sur une droite, `/O` sur un virage large : la boucle qui tourne en même temps). Le modèle ordinaire (champ de hauteurs,
// ressorts verticaux, cap + pentes) ne sait pas rouler à l'envers : dans la boucle, la voiture roule sur un **ruban** décrit par une table (une fois par
// bloc : points, tangente T, gauche L, haut U vers le centre de la boucle, courbure), et son état est l'abscisse `loopS`, la vitesse `loopV`, l'écart en
// travers `loopW` et le cap sur le ruban `loopPsi` (0 = dans l'axe, positif = vers la gauche). **Elle n'est pas guidée** (retour de Nathan) : le volant fait
// tourner le cap, les pneus ne tiennent qu'en proportion de l'appui (peu de vitesse en haut, peu d'adhérence), le ruban n'a pas de garde-corps (au-delà
// du bord, on tombe) et l'on décroche si l'appui devient négatif. Le ruban se vrille d'une largeur (on entre d'un côté, on sort de l'autre : les deux
// moitiés de la boucle ne se croisent jamais). Polynômes, racines, `sin`/`cos` de math.ts : déterministe.
// Aucun circuit d'avant n'a de boucle : `stepRace` n'appelle ce module que pour un circuit qui en a une (`Track.boucles`).

/** Points de la table d'une boucle. */
const N = 192;
/** Marge (m) au bord du ruban : au-delà de `BOUCLE_LARGEUR / 2 − BORD`, une roue est dans le vide et la voiture tombe. */
const BORD = 0.9;
/** Adhérence des pneus sur le ruban, en multiple de l'appui (l'accélération normale) : la force latérale ne dépasse jamais `ADHERENCE × appui`. */
const ADHERENCE = 1.6;
/** Empattement (m), comme car.ts. */
const EMPATTEMENT = 2.6;
/**
 * La vrille (le ruban passe d'une moitié de la route à l'autre) ne se fait qu'entre φ = `VRILLE` et 2π − `VRILLE`, en haut de la boucle : là où ses deux
 * branches se croisent vues de côté (φ ≈ 1,2 à 1,3), elles sont encore écartées d'une largeur entière — jamais l'une dans l'autre.
 */
const VRILLE = 1.4;
/** Boucle qui fait virage : la base avance vite en bas et lentement en haut (`φ + ALLONGE sin φ`) ; la boucle reste ronde au sommet, plus longue en bas. */
const ALLONGE = 0.8;

/**
 * Une boucle décrite par sa table : la longueur du ruban, l'abscisse de chaque point et, par point, `PB` nombres (`PB_*` : position, tangente T, gauche
 * L, haut U vers le centre de la boucle, courbure vers U et courbure en travers vers L — le ruban qui tourne sous la voiture, la boucle qui fait virage).
 */
export interface TableBoucle {
  longueur: number;
  s: Float64Array;
  d: Float64Array;
  /** Cap de la route à l'entrée et à la sortie (rad, comme `CarState.yaw`) ; côté de l'entrée (+1 : la moitié gauche de la route). */
  capEntree: number;
  capSortie: number;
  cote: number;
}

/** Un point du ruban (`pointBoucle`) : x, y, z, puis T, L, U (3 nombres chacun), puis les courbures k et kg. */
export type PointBoucle = Float64Array;
export const PB = 14;
export const PB_T = 3;
export const PB_L = 6;
export const PB_U = 9;
export const createPointBoucle = (): PointBoucle => new Float64Array(PB);

const CAPS = [0, HALF_PI, PI, -HALF_PI] as const;
const tables = new WeakMap<Block, TableBoucle>();
const pt = { x: 0, z: 0 };
const norme = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z) || 1;

/** La table de la boucle du bloc `b` (calculée une fois). */
export function tableBoucle(b: Block): TableBoucle {
  const deja = tables.get(b);
  if (deja) return deja;
  const gauche = turnsLeft(b.kind);
  const c = isCurve(b.kind) ? curveCenter(b.kind) : null;
  // Côté de l'entrée : la moitié gauche sur une droite ; sur un virage, l'extérieur (on finit à l'intérieur).
  const cote = c && gauche ? -1 : 1;
  const longueurBase = c ? HALF_PI * c.r : CELL;
  const d = new Float64Array(PB * (N + 1));
  const s = new Float64Array(N + 1);
  for (let i = 0, o = 0; i <= N; i++, o += PB) {
    const phi = (TWO_PI * i) / N;
    const sp = sin(phi);
    const avance = (longueurBase * (phi + (c ? ALLONGE * sp : 0))) / TWO_PI;
    const v = clamp((phi - VRILLE) / (TWO_PI - 2 * VRILLE), 0, 1);
    const ecart = cote * (BOUCLE_LARGEUR / 2) * (1 - 2 * v * v * (3 - 2 * v)); // la vrille : d'un côté à l'autre, en haut de la boucle
    // Sur un virage, l'arc (comme `curveRows`) : la gauche de la route est vers le centre pour un virage à gauche ; la base avance le long de (tp, tq).
    const a = c ? avance / c.r : 0;
    const r = c ? c.r - (gauche ? ecart : -ecart) : 0;
    const tp = c ? (gauche ? sin(a) : -sin(a)) : 0;
    const tq = c ? cos(a) : 1;
    const p = (c ? c.cp + (gauche ? -r : r) * cos(a) : CELL / 2 + ecart) + tp * BOUCLE_RAYON * sp;
    const q = (c ? r * sin(a) : avance) + tq * BOUCLE_RAYON * sp;
    blockPoint(b, p, q, pt);
    d[o] = pt.x;
    d[o + 1] = b.y0 + BOUCLE_RAYON * (1 - cos(phi));
    d[o + 2] = pt.z;
    // La direction horizontale de la base, dans le monde, gardée un temps à la place de U.
    blockPoint(b, p + tp, q + tq, pt);
    const hn = norme(pt.x - d[o]!, 0, pt.z - d[o + 2]!);
    d[o + PB_U] = (pt.x - d[o]!) / hn;
    d[o + PB_U + 2] = (pt.z - d[o + 2]!) / hn;
    if (i) s[i] = s[i - 1]! + norme(d[o]! - d[o - PB]!, d[o + 1]! - d[o - PB + 1]!, d[o + 2]! - d[o - PB + 2]!);
  }
  // Différence centrée de la composante j (sur les points voisins de i).
  const dif = (i: number, j: number) => d[PB * (i < N ? i + 1 : N) + j]! - d[PB * (i > 0 ? i - 1 : 0) + j]!;
  for (let i = 0, o = 0; i <= N; i++, o += PB) {
    const tn = norme(dif(i, 0), dif(i, 1), dif(i, 2));
    const tx = dif(i, 0) / tn;
    const ty = dif(i, 1) / tn;
    const tz = dif(i, 2) / tn;
    // Le haut : vers le centre du cercle vertical de la boucle (−sin φ selon la base, cos φ en hauteur), redressé contre la tangente.
    const sp = -sin((TWO_PI * i) / N);
    let ux = sp * d[o + PB_U]!;
    let uy = cos((TWO_PI * i) / N);
    let uz = sp * d[o + PB_U + 2]!;
    const dot = ux * tx + uy * ty + uz * tz;
    ux -= dot * tx;
    uy -= dot * ty;
    uz -= dot * tz;
    const un = norme(ux, uy, uz);
    ux /= un;
    uy /= un;
    uz /= un;
    // T, gauche = haut × avant, U.
    d.set([tx, ty, tz, uy * tz - uz * ty, uz * tx - ux * tz, ux * ty - uy * tx, ux, uy, uz], o + PB_T);
  }
  for (let i = 0, o = 0; i <= N; i++, o += PB) {
    const ds = s[i < N ? i + 1 : N]! - s[i > 0 ? i - 1 : 0]! || 1;
    for (let j = 0; j < 3; j++) {
      d[o + 12] = d[o + 12]! + (dif(i, PB_T + j) * d[o + PB_U + j]!) / ds;
      d[o + 13] = d[o + 13]! + (dif(i, PB_T + j) * d[o + PB_L + j]!) / ds;
    }
  }
  const capEntree = CAPS[b.dir];
  const table: TableBoucle = { longueur: s[N]!, s, d, capEntree, capSortie: c ? CAPS[(b.dir + (gauche ? 1 : 3)) & 3]! : capEntree, cote };
  tables.set(b, table);
  return table;
}

/** Le point d'abscisse `s` (bornée au ruban) et d'écart `w` du ruban `tb`, par interpolation linéaire de la table. */
export function pointBoucle(tb: TableBoucle, s: number, w: number, out: PointBoucle): void {
  const ss = clamp(s, 0, tb.longueur);
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tb.s[mid]! <= ss) lo = mid;
    else hi = mid;
  }
  const f = (ss - tb.s[lo]!) / (tb.s[hi]! - tb.s[lo]! || 1);
  for (let j = 0; j < PB; j++) out[j] = tb.d[PB * lo + j]! + (tb.d[PB * hi + j]! - tb.d[PB * lo + j]!) * f;
  for (let j = 0; j < 3; j++) out[j] = out[j]! + w * out[PB_L + j]!;
}

const pb = createPointBoucle();

/** Ramène un angle dans ]−π, π]. */
const angle = (a: number) => (a > PI ? a - TWO_PI : a <= -PI ? a + TWO_PI : a);

/** Place la voiture sur le ruban d'après son état (position, vitesse le long de son cap sur le ruban, haut). */
function poser(car: CarState, tb: TableBoucle): void {
  pointBoucle(tb, car.loopS, car.loopW, pb);
  const c = cos(car.loopPsi);
  const s = sin(car.loopPsi);
  car.x = pb[0]!;
  car.y = pb[1]!;
  car.z = pb[2]!;
  car.vx = car.loopV * (c * pb[PB_T]! + s * pb[PB_L]!);
  car.vy = car.loopV * (c * pb[PB_T + 1]! + s * pb[PB_L + 1]!);
  car.vz = car.loopV * (c * pb[PB_T + 2]! + s * pb[PB_L + 2]!);
  car.nx = pb[PB_U]!;
  car.ny = pb[PB_U + 1]!;
  car.nz = pb[PB_U + 2]!;
}

/**
 * Entre dans la boucle du bloc `b` si la voiture vient d'y passer l'entrée (avance de 0 à 6 m dans le bloc), du côté ouvert, en avançant. Rend vrai si
 * elle y est entrée.
 */
export function entrerBoucle(car: CarState, b: Block): boolean {
  const u = car.x - b.cx * CELL;
  const v = car.z - b.cz * CELL;
  const q = canonQ(b.dir, u, v);
  if (q < 0 || q > 6) return false;
  const tb = tableBoucle(b);
  const lat = canonP(b.dir, u, v) - CELL / 2;
  const w = lat - tb.cote * (BOUCLE_LARGEUR / 2);
  if (w > BOUCLE_LARGEUR / 2 || w < -BOUCLE_LARGEUR / 2) return false;
  const psi = angle(car.yaw - tb.capEntree);
  const vit = car.vx * sin(tb.capEntree) + car.vz * cos(tb.capEntree);
  if (vit <= 0) return false;
  car.loop = b.index + 1;
  car.loopS = q;
  car.loopV = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
  car.loopW = w;
  car.loopPsi = psi;
  car.pitch = car.roll = car.pitchRate = car.rollRate = car.yawRate = 0;
  car.grounded = 1;
  car.air = 0;
  poser(car, tb);
  return true;
}

/** Remet la voiture dans le modèle ordinaire, au bout du ruban (sortie) ou à son début (recul), cap compris. */
function quitter(car: CarState, b: Block, tb: TableBoucle, sortie: boolean): void {
  car.loopS = sortie ? tb.longueur : 0;
  poser(car, tb);
  car.y = b.y0;
  car.vy = 0;
  car.nx = 0;
  car.ny = 1;
  car.nz = 0;
  car.yaw = angle((sortie ? tb.capSortie : tb.capEntree) + car.loopPsi);
  car.loop = 0;
}

/** Décroche (trop lent, ou une roue dans le vide) : la voiture repart en vol dans le modèle ordinaire, avec sa vitesse. */
function decrocher(car: CarState): void {
  car.loop = 0;
  car.grounded = 0;
  car.air = 100;
}

/**
 * Un pas sur la boucle. Le moteur, le frein et la roue libre comme sur la route plate (effets compris) ; la pesanteur décomposée sur le ruban (dans le cap
 * et en travers) ; le volant fait tourner le cap, mais la force latérale (virage voulu et pesanteur en travers) est bornée par `ADHERENCE` × l'appui.
 */
export function stepBoucle(car: CarState, input: CarInput, b: Block, p: Readonly<CarParams>): void {
  const tb = tableBoucle(b);
  const cible = car.fx === FX_NO_STEER ? 0 : clamp(input.steer, -AXIS_MAX, AXIS_MAX) / AXIS_MAX;
  const steerStep = p.steerSpeed * DT;
  car.steer += clamp(cible - car.steer, -steerStep, steerStep);
  const thr = car.cut || car.fx === FX_CRUISE ? 0 : clamp(input.throttle, 0, AXIS_MAX) / AXIS_MAX;
  const brake = car.fx === FX_NO_BRAKE || car.fx === FX_CRUISE ? 0 : clamp(input.brake, 0, AXIS_MAX) / AXIS_MAX;
  pointBoucle(tb, car.loopS, car.loopW, pb);
  const g = p.gravity;
  const c = cos(car.loopPsi);
  const s = sin(car.loopPsi);
  // Pesanteur (0, −g, 0) le long de la tangente, de la gauche et du haut ; puis dans le cap et en travers du cap.
  const gT = -g * pb[PB_T + 1]!;
  const gL = -g * pb[PB_L + 1]!;
  const gCap = gT * c + gL * s;
  const gTravers = -gT * s + gL * c;
  let v = car.loopV;
  // L'appui (accélération normale) : la force centripète de la boucle dans le cap, moins la pesanteur qui tire vers le centre.
  const appui = v * v * pb[12]! * c * c + g * pb[PB_U + 1]!;
  if (appui < 0) {
    poser(car, tb);
    car.tick += 1;
    return decrocher(car);
  }
  let a = gCap;
  if (car.fx === FX_CRUISE) a = clamp((car.fxSpeed - v) * p.fxCruiseGain, -p.brake, p.brake);
  else {
    if (thr > 0 && v >= 0) {
      const ratio = v / p.maxSpeed;
      a += p.accel * thr * (ratio < 1 ? 1 - ratio : 0) * (1 + p.accelCurve * ratio);
    }
    if (brake > 0 && v > 0) a -= p.brake * brake;
    else if (thr === 0 && v > 0) a -= p.coast;
  }
  // Le virage voulu (roues braquées, modèle de bicyclette sans glisse) ; les pneus donnent au plus `ADHERENCE` × l'appui.
  const braquage = -car.steer * steerLimit(v, p);
  const voulu = (v * v * braquage) / EMPATTEMENT;
  const lim = ADHERENCE * appui;
  const pneus = clamp(voulu - gTravers, -lim, lim);
  const lacet = v > 1 ? (pneus + gTravers) / v : 0;
  v += a * DT;
  car.loopV = v;
  // Le cap se lit contre l'axe du ruban, qui tourne lui-même (`kg`) : qui ne braque pas part vers le bord extérieur d'une boucle qui fait virage.
  car.loopPsi = angle(car.loopPsi + (lacet - pb[13]! * car.loopV * c) * DT);
  car.loopS += v * c * DT;
  car.loopW += v * s * DT;
  if (car.fxTicks > 0 && --car.fxTicks === 0 && car.fx !== FX_BROKEN) car.fx = 0;
  car.tick += 1;
  if (car.loopS >= tb.longueur) return quitter(car, b, tb, true);
  if (car.loopS <= 0 && v < 0) return quitter(car, b, tb, false);
  poser(car, tb);
  const bord = BOUCLE_LARGEUR / 2 - BORD;
  if (car.loopW > bord || car.loopW < -bord) decrocher(car);
}

/** La consigne de volant (−1 à 1) qui suit le ruban : la courbure en travers anticipée, puis l'écart et le cap ramenés à zéro (le pilote automatique). */
export function volantBoucle(car: CarState, b: Block, p: Readonly<CarParams>): number {
  pointBoucle(tableBoucle(b), car.loopS, car.loopW, pb);
  const lim = steerLimit(car.loopV, p) || 1;
  return clamp((-pb[13]! * EMPATTEMENT) / lim + 0.35 * car.loopW + 2.2 * car.loopPsi, -1, 1);
}
