import { DT } from "./constants";
import { AXIS_MAX, type CarInput, type CarParams, type CarState } from "./car";
import { TWO_PI, clamp, cos, sin } from "./math";
import { BOUCLE_Q, BOUCLE_RAYON, BOUCLE_VOIE, CELL, FX_BROKEN, FX_CRUISE, FX_NO_BRAKE, FX_NO_STEER, blockPoint, canonVecToWorld, canonP, canonQ, type Block } from "./track";

// Lot 58b — la boucle (bloc `O`, route étroite). On entre par la voie de gauche ; au pied de la boucle (`BOUCLE_Q` m dans le bloc), la voiture quitte le
// modèle ordinaire (champ de hauteurs, ressorts verticaux : il ne sait pas rouler à l'envers) et roule « sur rail » : son état est l'abscisse le long de
// la boucle (`loopS`), sa vitesse (`loopV`) et son écart en travers (`loopW`). Sur le rail : le moteur, le frein, la roue libre et la pesanteur le long
// de la boucle ; l'appui (v² ÷ R + g cos φ) doit rester positif, sinon la voiture décroche et tombe (pas assez de vitesse en haut). La boucle se vrille
// d'une voie vers la droite : on ressort, en bas, sur la voie de droite, au même endroit du bloc. Polynômes, `sin`/`cos` de math.ts : déterministe.
// Aucun circuit d'avant n'a de boucle : `stepRace` n'appelle ce module que pour un circuit qui en a une (`Track.boucles`).

export const BOUCLE_LONGUEUR = TWO_PI * BOUCLE_RAYON;
/** Marge (m) au bord de la voie, sur le rail (la voiture y est tenue par les rebords). */
const BORD = 1;
/** Dérive en travers sur le rail, par unité de braquage (fraction de la vitesse). */
const DERIVE = 0.08;

/** Centre de la voie (coordonnée canonique p) à l'abscisse `s` de la boucle : de la gauche (entrée) à la droite (sortie). */
export const voieBoucle = (s: number): number => CELL / 2 + BOUCLE_VOIE - (2 * BOUCLE_VOIE * s) / BOUCLE_LONGUEUR;

/** Un point de la boucle : sa position, la direction d'avance et le « haut » (vers le centre de la boucle), en coordonnées du monde. */
export interface PoseBoucle {
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
  ux: number;
  uy: number;
  uz: number;
}
export const createPoseBoucle = (): PoseBoucle => ({ x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 1, ux: 0, uy: 1, uz: 0 });

const pt = { x: 0, z: 0 };
const v2 = { x: 0, z: 0 };

/** La pose au point (abscisse `s`, écart `w` vers la gauche) de la boucle du bloc `b`. */
export function poseBoucle(b: Block, s: number, w: number, out: PoseBoucle): void {
  const phi = s / BOUCLE_RAYON;
  const sp = sin(phi);
  const cp = cos(phi);
  blockPoint(b, voieBoucle(s) + w, BOUCLE_Q + BOUCLE_RAYON * sp, pt);
  out.x = pt.x;
  out.z = pt.z;
  out.y = b.y0 + BOUCLE_RAYON * (1 - cp);
  // Avance : (dp, dq, dy) / ds = (−2 voie ÷ L, cos φ, sin φ), normalisée ; le haut : (0, −sin φ, cos φ).
  const dp = (-2 * BOUCLE_VOIE) / BOUCLE_LONGUEUR;
  const n = 1 / Math.sqrt(1 + dp * dp);
  canonVecToWorld(b.dir, dp * n, cp * n, v2);
  out.fx = v2.x;
  out.fz = v2.z;
  out.fy = sp * n;
  canonVecToWorld(b.dir, 0, -sp, v2);
  out.ux = v2.x;
  out.uz = v2.z;
  out.uy = cp;
}

const pose = createPoseBoucle();

/** Place la voiture sur la boucle (position, vitesse, haut) d'après son état sur le rail. */
function poser(car: CarState, b: Block): void {
  poseBoucle(b, car.loopS, car.loopW, pose);
  car.x = pose.x;
  car.y = pose.y;
  car.z = pose.z;
  car.vx = pose.fx * car.loopV;
  car.vy = pose.fy * car.loopV;
  car.vz = pose.fz * car.loopV;
  car.nx = pose.ux;
  car.ny = pose.uy;
  car.nz = pose.uz;
}

/**
 * Entre dans la boucle si la voiture vient de passer le pied (avance `BOUCLE_Q`) sur la voie de gauche, en avançant. `px`, `pz` : sa position au pas
 * d'avant. Rend vrai si elle y est entrée.
 */
export function entrerBoucle(car: CarState, b: Block, px: number, pz: number): boolean {
  const u = car.x - b.cx * CELL;
  const v = car.z - b.cz * CELL;
  const q = canonQ(b.dir, u, v);
  const q0 = canonQ(b.dir, px - b.cx * CELL, pz - b.cz * CELL);
  if (!(q0 < BOUCLE_Q && q >= BOUCLE_Q)) return false;
  const lat = canonP(b.dir, u, v) - CELL / 2;
  if (lat < 0) return false;
  canonVecToWorld(b.dir, 0, 1, v2);
  const vit = car.vx * v2.x + car.vz * v2.z;
  if (vit <= 0) return false;
  car.loop = b.index + 1;
  car.loopS = q - BOUCLE_Q;
  car.loopV = vit;
  car.loopW = clamp(lat - BOUCLE_VOIE, -(BOUCLE_VOIE - BORD), BOUCLE_VOIE - BORD);
  car.pitch = car.roll = car.pitchRate = car.rollRate = car.yawRate = 0;
  car.grounded = 1;
  car.air = 0;
  poser(car, b);
  return true;
}

/** Remet la voiture dans le modèle ordinaire, sur la route du bloc, en bas de la boucle (sortie : voie de droite ; recul : voie de gauche). */
function quitter(car: CarState, b: Block, sortie: boolean): void {
  car.loopS = sortie ? BOUCLE_LONGUEUR : 0;
  poser(car, b);
  car.y = b.y0;
  car.vy = 0;
  car.nx = 0;
  car.ny = 1;
  car.nz = 0;
  car.loop = 0;
}

/**
 * Un pas sur la boucle (rail). Moteur et frein comme sur la route plate (régulateur, freins coupés et moteur coupé compris), la pesanteur le long de la
 * boucle ; le volant fait dériver la voiture en travers (entre les rebords). Décroche si l'appui devient négatif : la voiture repart dans le modèle
 * ordinaire, en vol.
 */
export function stepBoucle(car: CarState, input: CarInput, b: Block, p: Readonly<CarParams>): void {
  const steer = car.fx === FX_NO_STEER ? 0 : clamp(input.steer, -AXIS_MAX, AXIS_MAX) / AXIS_MAX;
  const steerStep = p.steerSpeed * DT;
  car.steer += clamp(steer - car.steer, -steerStep, steerStep);
  const thr = car.cut || car.fx === FX_CRUISE ? 0 : clamp(input.throttle, 0, AXIS_MAX) / AXIS_MAX;
  const brake = car.fx === FX_NO_BRAKE || car.fx === FX_CRUISE ? 0 : clamp(input.brake, 0, AXIS_MAX) / AXIS_MAX;
  let v = car.loopV;
  const phi = car.loopS / BOUCLE_RAYON;
  let a = -p.gravity * sin(phi);
  if (car.fx === FX_CRUISE) a = clamp((car.fxSpeed - v) * p.fxCruiseGain, -p.brake, p.brake);
  else {
    if (thr > 0 && v >= 0) {
      const ratio = v / p.maxSpeed;
      a += p.accel * thr * (ratio < 1 ? 1 - ratio : 0) * (1 + p.accelCurve * ratio);
    }
    if (brake > 0 && v > 0) a -= p.brake * brake;
    else if (thr === 0 && v > 0) a -= p.coast;
  }
  v += a * DT;
  car.loopV = v;
  car.loopS += v * DT;
  car.loopW = clamp(car.loopW - car.steer * DERIVE * v * DT, -(BOUCLE_VOIE - BORD), BOUCLE_VOIE - BORD);
  if (car.fxTicks > 0 && --car.fxTicks === 0 && car.fx !== FX_BROKEN) car.fx = 0;
  car.tick += 1;
  if (car.loopS >= BOUCLE_LONGUEUR) return quitter(car, b, true);
  if (car.loopS <= 0 && v < 0) return quitter(car, b, false);
  // L'appui, par unité de masse : la force centripète moins la part de la pesanteur qui tire vers le centre.
  const appui = (v * v) / BOUCLE_RAYON + p.gravity * cos(car.loopS / BOUCLE_RAYON);
  poser(car, b);
  if (appui < 0) {
    // Décroche : elle garde sa vitesse et tombe (le modèle ordinaire la prend en vol).
    car.loop = 0;
    car.grounded = 0;
    car.air = 100;
  }
}
