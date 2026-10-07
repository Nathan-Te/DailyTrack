import { DT } from "./constants";
import { PI, TWO_PI, clamp, cos, sin } from "./math";
import { FLAT_WORLD, createSurface, createWallHit, surfaceAt, type World } from "./world";

// Voiture arcade « à la Trackmania » (lot 7). Trois étages, tous déterministes (+ − × ÷ et √ seulement) :
//
// 1. Plan horizontal : modèle « bicyclette » à deux essieux. Chaque essieu donne une force latérale qui dépend
//    de son glissement (vitesse latérale de l'essieu ÷ vitesse d'avance), saturée par une fonction rationnelle :
//    adhérence forte jusqu'à un seuil, puis glisse qui garde une fraction de l'adhérence. C'est l'équilibre entre
//    l'avant et l'arrière qui donne le caractère de la voiture (pivot franc, dérapage au frein, sortie propre).
// 2. Vertical : quatre roues sur ressorts amortis, posées sur `world` (hauteur et pente sous chaque roue) ; la
//    caisse a une hauteur, un tangage et un roulis (pentes, sans trigonométrie), et la charge de chaque essieu
//    module son adhérence. Butée de fin de course pour les grosses réceptions.
// 3. En l'air : balistique, pas de contrôle aérien ; l'orientation est maintenue (rotation amortie). Une
//    réception à plat garde la vitesse, une réception de travers en coûte et fait rebondir.
//
// Le pas de la course reste 1/120 s ; la voiture le découpe en SUBSTEPS sous-pas fixes (jamais variables).

/** Valeur maximale (en valeur absolue) d'un axe de commande entier. */
export const AXIS_MAX = 64;

/** Sous-pas fixes par pas de simulation (2 × 240 Hz : ressorts et adhérence restent stables). */
export const SUBSTEPS = 2;

/**
 * Commandes d'un pas de simulation, en entiers : c'est ce qu'on enregistre pour une rediffusion.
 * `steer` ∈ [-64, 64] (analogique, positif = à droite), `throttle` et `brake` ∈ [0, 64],
 * `respawn` ∈ {0, 1} (recommencer au dernier point de contrôle ; géré par la course, pas par la voiture).
 */
export interface CarInput {
  steer: number;
  throttle: number;
  brake: number;
  respawn: number;
}

/** Quantifie des axes flottants (steer ∈ [-1, 1], throttle/brake ∈ [0, 1]) en commandes entières. */
export function makeInput(steer: number, throttle: number, brake: number, respawn = false): CarInput {
  // « + 0 » transforme −0 en 0 : une commande enregistrée doit être identique à sa version décodée.
  return {
    steer: Math.round(clamp(steer, -1, 1) * AXIS_MAX) + 0,
    throttle: Math.round(clamp(throttle, 0, 1) * AXIS_MAX) + 0,
    brake: Math.round(clamp(brake, 0, 1) * AXIS_MAX) + 0,
    respawn: respawn ? 1 : 0,
  };
}

export const NO_INPUT: CarInput = { steer: 0, throttle: 0, brake: 0, respawn: 0 };

/**
 * Réglages de la voiture (mètres, secondes ; les forces sont des accélérations, la masse vaut 1).
 * Modifier une valeur par défaut change le résultat des courses : incrémenter `SIM_VERSION` et régénérer les
 * références. Le panneau `?debug&tune` du jeu les modifie en direct (courses alors jamais classées).
 */
export interface CarParams {
  /** Vitesse de pointe (m/s). */
  maxSpeed: number;
  /** Accélération à l'arrêt (m/s²). */
  accel: number;
  /** Forme de la courbe d'accélération : 0 = décroissance linéaire jusqu'à la pointe ; plus = poussée gardée plus longtemps. */
  accelCurve: number;
  /** Freinage (m/s²). */
  brake: number;
  reverseAccel: number;
  reverseMax: number;
  /** Décélération en roue libre (m/s²). */
  coast: number;
  /** Braquage maximal des roues avant à basse vitesse (rad). */
  steerMax: number;
  /** Braquage à haute vitesse, en multiple de celui qui atteint juste la limite d'adhérence (1 = pile la limite). */
  steerAtLimit: number;
  /** Vitesse du volant (1/s) : 1 / temps pour aller du centre à fond. */
  steerSpeed: number;
  /** Adhérence latérale de l'essieu avant, en m/s² (pour sa part du poids). */
  gripFront: number;
  /** Adhérence latérale de l'essieu arrière, en m/s². */
  gripRear: number;
  /** Glissement (rad) au pic d'adhérence : plus petit = adhérence plus « dure », limite plus franche. */
  slipPeak: number;
  /** Fraction de l'adhérence gardée en pleine glisse (0–1). */
  slideGrip: number;
  /** Perte de vitesse en glisse (m/s² par radian de dérive). */
  slideDrag: number;
  /** Adhérence arrière pendant un dérapage déclenché au frein (fraction). */
  driftGrip: number;
  /** Vitesse minimale pour déclencher un dérapage au frein (m/s). */
  driftMinSpeed: number;
  /** Durée de vie d'un dérapage tenu (s) : il s'éteint plus vite si on relâche la direction. */
  driftHold: number;
  /** Angle de dérive tenu en dérapage, braquage à fond (tangente : 0,32 ≈ 18°). */
  driftAngle: number;
  /** En dérapage, la vitesse est ramenée vers le nez (m/s² par unité de dérive) : on tourne plus serré qu'en grip, en perdant de la vitesse. */
  driftPull: number;
  /** Sensibilité de l'adhérence à la charge (0 = ignorée, 1 = proportionnelle). */
  loadSensitivity: number;
  /** Raideur d'un ressort de suspension (1/s², par roue). */
  suspStiffness: number;
  /** Amortissement d'une suspension (1/s, par roue). */
  suspDamping: number;
  /** Hauteur du centre de gravité (m) : transfert de charge, roulis et tangage. */
  cgHeight: number;
  /** Gravité (m/s²), un peu appuyée pour des sauts lisibles. */
  gravity: number;
  /** Ralentissement en montée / accélération en descente, par unité de pente (m/s²). */
  slopeGravity: number;
  /** Maintien de l'orientation en l'air (1/s) : amortit la rotation. */
  airDamping: number;
  /** Retour à l'horizontale en l'air (1/s²), léger. */
  airLevel: number;
  /** Écart d'orientation toléré à la réception (rad) sans perte. */
  landTolerance: number;
  /** Perte de vitesse à la réception par radian d'écart au-delà de la tolérance (fraction). */
  landLoss: number;
  /** Rebond d'une réception de travers (fraction de la vitesse d'impact). */
  landBounce: number;
  /** Rebond sur un rebord (coefficient de restitution, 0–1). */
  wallBounce: number;
  /** Frottement contre un rebord (coefficient de Coulomb) : fixe la perte d'un contact rasant. */
  wallFriction: number;
  /** Durée d'une plaque d'accélération (pas de simulation). */
  boostTicks: number;
  /** Poussée d'une plaque (m/s²). */
  boostAccel: number;
  /** Vitesse plafond sous l'effet d'une plaque (m/s). */
  boostMaxSpeed: number;
  /** Traînée au-delà de la pointe (m/s²) : `overspeedDrag × ((vitesse ÷ pointe)³ − 1)`. Pas de plafond dur : retombée progressive après une plaque ou un turbo. */
  overspeedDrag: number;
  /** Super turbo (bloc T) : durée (pas), poussée (m/s²) et vitesse plafond (m/s) — plus fort et plus long que la plaque. */
  turboTicks: number;
  turboAccel: number;
  turboMaxSpeed: number;
  /** Glace (lot 16), pour un revêtement dont `slick` vaut 1. Pointe sur glace, en multiple de la pointe du plat (traînée de roulement nulle, roue libre presque sans perte). */
  iceTop: number;
  /** Décélération en roue libre sur glace, en fraction de celle de la route. */
  iceCoast: number;
  /** Adhérence latérale en roue libre sur glace (multiplicateur de route : à l'accélérateur c'est `grip` de `SURFACES.ice`). */
  iceCoastGrip: number;
  /** Réalignement de la vitesse sur le cap en roue libre sur glace (1/s) : la vitesse latérale s'éteint à ce rythme. */
  iceRealign: number;
  /** Adhérence latérale sous le frein sur glace, en fraction de celle de l'accélérateur : la voiture part en glisse. */
  iceBrakeGrip: number;
}

export const DEFAULT_CAR_PARAMS: Readonly<CarParams> = Object.freeze({
  maxSpeed: 48,
  accel: 22,
  accelCurve: 0.6,
  brake: 40,
  reverseAccel: 14,
  reverseMax: 12,
  coast: 3,
  steerMax: 0.5,
  steerAtLimit: 1.2,
  steerSpeed: 14,
  gripFront: 44,
  gripRear: 47,
  slipPeak: 0.14,
  slideGrip: 0.82,
  slideDrag: 6,
  driftGrip: 0.6,
  driftMinSpeed: 15,
  driftHold: 3,
  driftAngle: 0.32,
  driftPull: 33,
  loadSensitivity: 0.5,
  suspStiffness: 62,
  suspDamping: 5,
  cgHeight: 0.35,
  gravity: 24.6,
  slopeGravity: 40,
  airDamping: 6,
  airLevel: 9,
  landTolerance: 0.15,
  landLoss: 1,
  landBounce: 0.4,
  wallBounce: 0.6,
  wallFriction: 0.3,
  boostTicks: 108,
  boostAccel: 30,
  boostMaxSpeed: 66,
  overspeedDrag: 2.5,
  turboTicks: 180,
  turboAccel: 42,
  turboMaxSpeed: 88,
  iceTop: 1.2,
  iceCoast: 0.3,
  iceCoastGrip: 0.75,
  iceRealign: 3,
  iceBrakeGrip: 0.5,
});

/** Vrai si `p` diffère des réglages par défaut (course alors jamais classée). */
export function isDefaultParams(p: Readonly<CarParams>): boolean {
  for (const k of Object.keys(DEFAULT_CAR_PARAMS) as (keyof CarParams)[]) if (p[k] !== DEFAULT_CAR_PARAMS[k]) return false;
  return true;
}

// Géométrie (fixe) : empattement, voie, inerties (en m², masse unité).
/** Distance du centre de gravité à l'essieu avant / arrière (m). */
export const AXLE_FRONT = 1.3;
export const AXLE_REAR = 1.3;
/** Demi-voie (m). */
export const HALF_TRACK = 0.85;
const WHEELBASE = AXLE_FRONT + AXLE_REAR;
const YAW_INERTIA = 1.6;
const PITCH_INERTIA = 1.3;
const ROLL_INERTIA = 0.45;
/** Rappel (1/s²) et amortissement (1/s) de l'angle de dérive en dérapage. */
const DRIFT_SPRING = 60;
const DRIFT_DAMPING = 14;
/** Sous cette vitesse, le glissement se calcule comme à cette vitesse (pas de division par ~0). */
const MIN_SLIP_SPEED = 3;
/** Collision avec les rebords : deux disques, à l'avant et à l'arrière de la caisse. */
export const COLLIDER_OFFSET = 1.05;
export const COLLIDER_RADIUS = 1;
/** Une marche plus haute que ça sous une roue est un mur (l'arrière d'un tremplin). */
const STEP_UP = 0.6;
/** Enfoncement maximal d'une suspension avant la butée (m). */
const BUMP_TRAVEL = 0.12;
/** Durée minimale en l'air (sous-pas) pour qu'un contact compte comme une réception. */
const LANDING_MIN_AIR = 12;

/** Roues : avant gauche, avant droite, arrière gauche, arrière droite (avance f, gauche l). */
const WHEEL_F = [AXLE_FRONT, AXLE_FRONT, -AXLE_REAR, -AXLE_REAR] as const;
const WHEEL_L = [HALF_TRACK, -HALF_TRACK, HALF_TRACK, -HALF_TRACK] as const;

export interface CarState {
  x: number;
  z: number;
  /** Cap en radians, 0 = vers +z, positif = vers la gauche (sens trigonométrique vu de dessus). */
  yaw: number;
  vx: number;
  vz: number;
  /** Vitesse de lacet (rad/s), positive = vers la gauche. */
  yawRate: number;
  /** Braquage lissé ∈ [-1, 1], positif = à droite. */
  steer: number;
  tick: number;
  /** Hauteur de la caisse (0 = au sol, suspension au repos) et vitesse verticale. */
  y: number;
  vy: number;
  /** Tangage et roulis de la caisse, en pentes (nez levé > 0 ; côté gauche levé > 0), et leurs vitesses. */
  pitch: number;
  pitchRate: number;
  roll: number;
  rollRate: number;
  /** 1 si au moins une roue touche le sol, 0 en vol. */
  grounded: number;
  /** Sous-pas passés en l'air depuis le dernier contact. */
  air: number;
  /** Pas restants d'accélération de plaque. */
  boost: number;
  /** Pas restants de super turbo. */
  turbo: number;
  /** 1 tant que le moteur est coupé (jusqu'au prochain point de contrôle) : l'accélérateur n'agit plus. */
  cut: number;
  /** Dérapage déclenché au frein, ∈ [0, 1] (0 = adhérence normale). */
  drift: number;
}

export function createCar(x = 0, z = 0, yaw = 0, y = 0): CarState {
  return {
    x, z, yaw, vx: 0, vz: 0, yawRate: 0, steer: 0, tick: 0, y, vy: 0,
    pitch: 0, pitchRate: 0, roll: 0, rollRate: 0, grounded: 1, air: 0, boost: 0, turbo: 0, cut: 0, drift: 0,
  };
}

const CAR_KEYS = Object.keys(createCar()) as (keyof CarState)[];

export function copyCar(from: CarState, to: CarState): void {
  for (const k of CAR_KEYS) to[k] = from[k];
}

/** Vitesse horizontale de la voiture, en m/s. */
export function carSpeed(car: CarState): number {
  return Math.sqrt(car.vx * car.vx + car.vz * car.vz);
}

/** Vitesse le long du cap (négative en marche arrière). */
export function forwardSpeed(car: CarState): number {
  return car.vx * sin(car.yaw) + car.vz * cos(car.yaw);
}

/**
 * Courbe d'adhérence : `t` = glissement ÷ glissement au pic. Linéaire au départ, plafonne à 1 vers t = 1
 * (saturation rationnelle t / ⁴√(1 + t⁴)), puis redescend vers `slideGrip` en pleine glisse.
 */
export function tireCurve(t: number, slideGrip: number): number {
  const t2 = t * t;
  const sat = t / Math.sqrt(Math.sqrt(1 + t2 * t2));
  const e = (t < 0 ? -t : t) - 1;
  if (e <= 0) return sat;
  const e2 = e * e;
  return sat * (1 - ((1 - slideGrip) * e2) / (1 + e2));
}

/** Braquage maximal (rad) à la vitesse `u` : réduit à haute vitesse pour rester près de la limite d'adhérence. */
export function steerLimit(u: number, p: Readonly<CarParams>): number {
  const a = u < 0 ? -u : u;
  const grip = (p.gripFront + p.gripRear) / 2;
  const atLimit = a > 1 ? (WHEELBASE * grip * p.steerAtLimit) / (a * a) : p.steerMax;
  return atLimit < p.steerMax ? atLimit : p.steerMax;
}

// Échantillons et contacts réutilisés (aucune allocation par pas).
const surface = createSurface();
const wall = createWallHit();
const gH = [0, 0, 0, 0];
const gX = [0, 0, 0, 0];
const gZ = [0, 0, 0, 0];
const gBoost = [false, false, false, false];
const gTurbo = [false, false, false, false];
const gCut = [false, false, false, false];
/** Revêtement sous chaque roue : adhérence, motricité, roulement (`surfaceAt`). */
const gGrip = [1, 1, 1, 1];
const gTraction = [1, 1, 1, 1];
const gRolling = [0, 0, 0, 0];
const gSlick = [0, 0, 0, 0];
const load = [0, 0, 0, 0];

function sampleWheels(car: CarState, world: World, fx: number, fz: number): void {
  const lx = fz;
  const lz = -fx;
  for (let i = 0; i < 4; i++) {
    world.sample(car.x + WHEEL_F[i]! * fx + WHEEL_L[i]! * lx, car.z + WHEEL_F[i]! * fz + WHEEL_L[i]! * lz, surface);
    gH[i] = surface.height;
    gX[i] = surface.gx;
    gZ[i] = surface.gz;
    gBoost[i] = surface.boost;
    gTurbo[i] = surface.turbo;
    gCut[i] = surface.cut;
    const m = surfaceAt(surface);
    gGrip[i] = m.grip;
    gTraction[i] = m.traction;
    gRolling[i] = m.rolling;
    gSlick[i] = m.slick;
  }
}

/** Avance la voiture d'un pas fixe (`DT`) dans `world`. Modifie `car` en place. */
export function stepCar(car: CarState, input: CarInput, world: World = FLAT_WORLD, params: Readonly<CarParams> = DEFAULT_CAR_PARAMS): void {
  // Volant : va vers la consigne à vitesse bornée (clavier : plein braquage en quelques centièmes).
  const target = clamp(input.steer, -AXIS_MAX, AXIS_MAX) / AXIS_MAX;
  const steerStep = params.steerSpeed * DT;
  car.steer += clamp(target - car.steer, -steerStep, steerStep);
  // Moteur coupé : l'accélérateur n'agit plus (le frein, si).
  const throttle = car.cut ? 0 : clamp(input.throttle, 0, AXIS_MAX) / AXIS_MAX;
  const brake = clamp(input.brake, 0, AXIS_MAX) / AXIS_MAX;

  // Dérapage : un coup de frein en virage rapide fait décrocher l'arrière ; on le tient à la direction.
  const fwd = forwardSpeed(car);
  if (car.grounded && brake > 0 && fwd > params.driftMinSpeed && (target > 0.5 || target < -0.5)) car.drift = 1;

  samplesValid = false; // d'autres voitures (le fantôme) partagent les tampons d'échantillons
  for (let s = 0; s < SUBSTEPS; s++) substep(car, throttle, brake, target, world, params);
  if (car.boost > 0) car.boost -= 1;
  if (car.turbo > 0) car.turbo -= 1;
  car.tick += 1;
}

const H = DT / SUBSTEPS;

/**
 * Les échantillons de sol pris en fin de sous-pas (butée) valent pour le début du suivant : même position, même cap.
 * Pure économie de calcul — les valeurs sont identiques à un nouvel échantillonnage.
 */
let samplesValid = false;
let headX = 0;
let headZ = 1;

function substep(car: CarState, throttle: number, brake: number, steerTarget: number, world: World, p: Readonly<CarParams>): void {
  const fx = samplesValid ? headX : sin(car.yaw);
  const fz = samplesValid ? headZ : cos(car.yaw);
  const lx = fz; // gauche = (cos ψ, −sin ψ)
  const lz = -fx;
  const u = car.vx * fx + car.vz * fz;
  const v = car.vx * lx + car.vz * lz;
  const r = car.yawRate;
  const g = p.gravity;

  // --- Suspension : charge de chaque roue ------------------------------------------------------
  if (!samplesValid) sampleWheels(car, world, fx, fz);
  samplesValid = false;
  const k = p.suspStiffness;
  const rest = g / (4 * k); // affaissement statique : au repos, la caisse est à y = sol
  let contacts = 0;
  let slope = 0;
  let onBoost = false;
  let onTurbo = false;
  let onCut = false;
  let slopeSide = 0;
  let traction = 0;
  let rolling = 0;
  let slick = 0;
  for (let i = 0; i < 4; i++) {
    const f = WHEEL_F[i]!;
    const l = WHEEL_L[i]!;
    const gap = car.y + f * car.pitch + l * car.roll - gH[i]!;
    load[i] = 0;
    if (gap >= rest) continue;
    // Vitesse d'écrasement : caisse moins sol (pente sous la roue × vitesse), sans différence de hauteurs ÷ DT.
    const gapRate = car.vy + f * car.pitchRate + l * car.rollRate - (gX[i]! * car.vx + gZ[i]! * car.vz);
    const force = k * (rest - gap) - p.suspDamping * gapRate;
    load[i] = force > 0 ? force : 0;
    contacts++;
    slope += gX[i]! * fx + gZ[i]! * fz;
    slopeSide += gX[i]! * lx + gZ[i]! * lz;
    traction += gTraction[i]!;
    rolling += gRolling[i]!;
    slick += gSlick[i]!;
    if (gBoost[i]) onBoost = true;
    if (gTurbo[i]) onTurbo = true;
    if (gCut[i]) onCut = true;
  }
  const grounded = contacts > 0;
  if (grounded) {
    slope /= contacts;
    slopeSide /= contacts;
    traction /= contacts;
    rolling /= contacts;
    slick /= contacts;
  }

  // Réception : premier contact après un vol. À plat (caisse alignée sur le sol) on garde la vitesse.
  if (grounded && car.air >= LANDING_MIN_AIR) land(car, fx, fz, lx, lz, p);
  car.air = grounded ? 0 : car.air + 1;
  car.grounded = grounded ? 1 : 0;
  if (onBoost) car.boost = p.boostTicks;
  if (onTurbo) car.turbo = p.turboTicks;
  if (onCut) car.cut = 1;

  let ax = 0; // accélérations le long du cap et vers la gauche
  let ay = 0;
  let yawAcc = 0;

  if (grounded) {
    const half = g / 2;
    const loadF = (load[0]! + load[1]!) / half;
    const loadR = (load[2]! + load[3]!) / half;
    const ls = p.loadSensitivity;
    const kf = loadF > 0 ? clamp(1 + ls * (loadF - 1), 0, 1.6) : 0;
    const kr = loadR > 0 ? clamp(1 + ls * (loadR - 1), 0, 1.6) : 0;

    // --- Pneus : forces latérales des deux essieux (modèle bicyclette) ---------------------------
    const U = u > MIN_SLIP_SPEED ? u : u < -MIN_SLIP_SPEED ? -u : MIN_SLIP_SPEED;
    const delta = -car.steer * steerLimit(u, p); // angle des roues avant, positif = à gauche
    const slipF = (v + AXLE_FRONT * r - delta * u) / U;
    const slipR = (v - AXLE_REAR * r) / U;
    // Dérapage : l'arrière perd de l'adhérence tant qu'il dure ; il s'éteint vite si on relâche la direction
    // ou si la voiture a retrouvé son axe, lentement si on le tient.
    if (car.drift > 0) {
      const held = (steerTarget > 0.2 || steerTarget < -0.2) && (slipR > 0.06 || slipR < -0.06);
      car.drift -= (held ? 1 / p.driftHold : 6) * H;
      if (car.drift < 0) car.drift = 0;
    }
    // Adhérence de chaque essieu : réglage × revêtement sous ses deux roues × charge.
    // Glace : à l'accélérateur le grip est celui du revêtement ; en roue libre il revient à `iceCoastGrip` (la voiture
    // pivote et se redresse), sous le frein il tombe à une fraction (elle part en glisse).
    const coasting = throttle === 0 && brake === 0;
    let surfF = (gGrip[0]! + gGrip[1]!) / 2;
    let surfR = (gGrip[2]! + gGrip[3]!) / 2;
    if (slick > 0) {
      const slickF = (gSlick[0]! + gSlick[1]!) / 2;
      const slickR = (gSlick[2]! + gSlick[3]!) / 2;
      if (coasting) {
        surfF += slickF * (p.iceCoastGrip - surfF);
        surfR += slickR * (p.iceCoastGrip - surfR);
      } else if (brake > 0) {
        surfF -= slickF * (1 - p.iceBrakeGrip) * surfF;
        surfR -= slickR * (1 - p.iceBrakeGrip) * surfR;
      }
    }
    const rearGrip = p.gripRear * (1 - (1 - p.driftGrip) * car.drift);
    const peakF = ((p.gripFront * AXLE_REAR) / WHEELBASE) * surfF * kf;
    const peakR = ((rearGrip * AXLE_FRONT) / WHEELBASE) * surfR * kr;
    const forceF = -peakF * tireCurve(slipF / p.slipPeak, p.slideGrip);
    const forceR = -peakR * tireCurve(slipR / p.slipPeak, p.slideGrip);
    ay = forceF + forceR;
    ax = -forceF * delta; // la roue braquée freine un peu
    yawAcc = (AXLE_FRONT * forceF - AXLE_REAR * forceR) / YAW_INERTIA;
    if (car.drift > 0) {
      // En dérapage, la direction règle l'angle de dérive (−driftAngle … +driftAngle) au lieu du braquage :
      // un rappel amorti tient la glisse sans tête-à-queue.
      const beta = v / U;
      const dBeta = (ay - u * r) / U;
      yawAcc += car.drift * (-DRIFT_SPRING * (steerTarget * p.driftAngle - beta) + DRIFT_DAMPING * dBeta);
      ay -= car.drift * p.driftPull * beta;
    }

    // --- Moteur, freins, pente ------------------------------------------------------------------
    const grip = clamp(1 + p.loadSensitivity * ((loadF + loadR) / 2 - 1), 0, 1) * traction;
    const flatTop = p.maxSpeed * (1 + slick * (p.iceTop - 1));
    const top = car.turbo > 0 ? p.turboMaxSpeed : car.boost > 0 ? p.boostMaxSpeed : flatTop;
    let drive = 0;
    if (throttle > 0) {
      if (u < -0.5) drive += p.brake * throttle;
      else {
        const ratio = u > 0 ? u / top : 0;
        const left = ratio < 1 ? 1 - ratio : 0;
        drive += p.accel * throttle * left * (1 + p.accelCurve * ratio);
      }
    }
    if (brake > 0) {
      if (u > 0.5) drive -= p.brake * brake;
      else if (u > -p.reverseMax) drive -= p.reverseAccel * brake;
    }
    if (throttle === 0 && brake === 0) {
      const coast = p.coast * (1 - slick * (1 - p.iceCoast));
      drive -= u > 0 ? coast : u < 0 ? -coast : 0;
    }
    if (car.boost > 0 && u < p.boostMaxSpeed) drive += p.boostAccel;
    if (car.turbo > 0 && u < p.turboMaxSpeed) drive += p.turboAccel;
    ax += drive * grip;
    ax -= u > 0 ? rolling : u < 0 ? -rolling : 0;
    // Au-delà de la pointe (descente, plaque, turbo) : une traînée en cube du rapport vitesse ÷ pointe, nulle à la pointe.
    // Ce n'est plus un plafond dur : la gravité et les poussées vont plus haut, et la voiture retombe progressivement.
    if (u > flatTop) {
      const ratio = u / flatTop;
      ax -= p.overspeedDrag * (ratio * ratio * ratio - 1);
    }
    ax -= p.slopeGravity * slope;
    // Pente latérale (virage relevé) : la pesanteur pousse vers le bas de la pente, donc vers l'intérieur du virage.
    ay -= p.gravity * slopeSide;
    // Glace en roue libre : la vitesse latérale s'éteint (le vecteur vitesse se réaligne sur le cap), sans freiner.
    if (coasting && slick > 0) ay -= p.iceRealign * slick * v;
    // Une glisse coûte de la vitesse, en proportion de son angle (dérive = vitesse latérale ÷ vitesse).
    const drift = v / U;
    ax -= p.slideDrag * (drift < 0 ? -drift : drift) * (u > 0 ? 1 : u < 0 ? -1 : 0);
  }

  // --- Intégration horizontale (Euler semi-implicite) --------------------------------------------
  const prevU = u;
  let vx = car.vx + (ax * fx + ay * lx) * H;
  let vz = car.vz + (ax * fz + ay * lz) * H;
  if (grounded) {
    // Pas d'oscillation autour de l'arrêt : sans gaz, le frein ou la roue libre s'arrêtent à 0.
    const nu = vx * fx + vz * fz;
    if ((prevU > 0 && nu < 0 && throttle === 0) || (prevU < 0 && nu > 0 && brake === 0)) {
      vx -= nu * fx;
      vz -= nu * fz;
    }
    if (prevU < -p.reverseMax && brake > 0) {
      // Marche arrière plafonnée.
      const over = vx * fx + vz * fz + p.reverseMax;
      if (over < 0) {
        vx -= over * fx;
        vz -= over * fz;
      }
    }
  }
  car.vx = vx;
  car.vz = vz;
  car.yawRate = grounded ? r + yawAcc * H : r * (1 - p.airDamping * H);
  if (grounded && throttle === 0 && brake === 0 && vx * vx + vz * vz < 1e-4 && slope === 0) {
    // À l'arrêt sur le plat : on s'arrête vraiment (pas de reste de glissement infinitésimal).
    car.vx = 0;
    car.vz = 0;
    car.yawRate = 0;
  }

  // --- Vertical : ressorts, transfert de charge, gravité ------------------------------------------
  let sumF = 0;
  let pitchM = 0;
  let rollM = 0;
  for (let i = 0; i < 4; i++) {
    sumF += load[i]!;
    pitchM += WHEEL_F[i]! * load[i]!;
    rollM += WHEEL_L[i]! * load[i]!;
  }
  car.vy += (sumF - g) * H;
  if (grounded) {
    // L'inertie de la caisse, au-dessus des roues : accélérer lève le nez, tourner penche vers l'extérieur.
    car.pitchRate += ((pitchM + p.cgHeight * ax) / PITCH_INERTIA) * H;
    car.rollRate += ((rollM + p.cgHeight * ay) / ROLL_INERTIA) * H;
  } else {
    const damp = 1 - p.airDamping * H;
    car.pitchRate = car.pitchRate * damp - p.airLevel * car.pitch * H;
    car.rollRate = car.rollRate * damp - p.airLevel * car.roll * H;
  }

  // --- Déplacement -------------------------------------------------------------------------------
  const prevX = car.x;
  const prevZ = car.z;
  car.x += car.vx * H;
  car.z += car.vz * H;
  let yaw = car.yaw + car.yawRate * H;
  if (yaw > PI) yaw -= TWO_PI;
  else if (yaw < -PI) yaw += TWO_PI;
  car.yaw = yaw;
  car.y += car.vy * H;
  car.pitch += car.pitchRate * H;
  car.roll += car.rollRate * H;

  headX = sin(yaw);
  headZ = cos(yaw);
  collideWalls(car, world, p, headX, headZ);
  samplesValid = bumpStop(car, world, prevX, prevZ, headX, headZ);
}

/** Réception après un vol : perte et rebond selon l'écart entre l'orientation de la caisse et le sol. */
function land(car: CarState, fx: number, fz: number, lx: number, lz: number, p: Readonly<CarParams>): void {
  let gp = 0;
  let gr = 0;
  for (let i = 0; i < 4; i++) {
    gp += gX[i]! * fx + gZ[i]! * fz;
    gr += gX[i]! * lx + gZ[i]! * lz;
  }
  gp /= 4;
  gr /= 4;
  const dp = car.pitch - gp;
  const dr = car.roll - gr;
  const miss = (dp < 0 ? -dp : dp) + (dr < 0 ? -dr : dr) - p.landTolerance;
  if (miss <= 0) return;
  const keep = clamp(1 - p.landLoss * miss, 0.4, 1);
  car.vx *= keep;
  car.vz *= keep;
  car.yawRate *= keep;
  // Rebond : une partie de la vitesse de chute revient vers le haut.
  const impact = car.vy < 0 ? -car.vy : 0;
  car.vy = impact * p.landBounce * clamp(miss / 0.3, 0, 1);
}

/** Rebords : deux disques (avant, arrière) ; choc par impulsion avec rebond et frottement de Coulomb. */
function collideWalls(car: CarState, world: World, p: Readonly<CarParams>, fx: number, fz: number): void {
  for (let c = 0; c < 2; c++) {
    const off = c === 0 ? COLLIDER_OFFSET : -COLLIDER_OFFSET;
    const cx = car.x + off * fx;
    const cz = car.z + off * fz;
    if (!world.collide(cx, cz, car.y, COLLIDER_RADIUS, wall)) continue;
    const nx = wall.nx;
    const nz = wall.nz;
    car.x += nx * wall.depth;
    car.z += nz * wall.depth;
    // Point de contact, relatif au centre de gravité ; vitesse du point = v + ω × r.
    const rx = off * fx - nx * COLLIDER_RADIUS;
    const rz = off * fz - nz * COLLIDER_RADIUS;
    const px = rz; // ∂(vitesse du point)/∂(lacet)
    const pz = -rx;
    const vpx = car.vx + car.yawRate * px;
    const vpz = car.vz + car.yawRate * pz;
    const vn = vpx * nx + vpz * nz;
    if (vn >= 0) continue;
    const pn = px * nx + pz * nz;
    const jn = (-(1 + p.wallBounce) * vn) / (1 + (pn * pn) / YAW_INERTIA);
    const tx = -nz;
    const tz = nx;
    const vt = vpx * tx + vpz * tz;
    const pt = px * tx + pz * tz;
    const limit = p.wallFriction * jn;
    const jt = clamp(-vt / (1 + (pt * pt) / YAW_INERTIA), -limit, limit);
    const jx = jn * nx + jt * tx;
    const jz = jn * nz + jt * tz;
    car.vx += jx;
    car.vz += jz;
    car.yawRate += (px * jx + pz * jz) / YAW_INERTIA;
    car.drift = 0;
  }
}

/**
 * Butée de suspension (grosse réception, haut d'une rampe) et marche trop haute (mur). Renvoie vrai si les
 * échantillons de sol restent valables pour la position finale (faux si la voiture a été ramenée en arrière).
 */
function bumpStop(car: CarState, world: World, prevX: number, prevZ: number, fx: number, fz: number): boolean {
  sampleWheels(car, world, fx, fz);
  let worst = 0;
  let wi = -1;
  for (let i = 0; i < 4; i++) {
    const gap = car.y + WHEEL_F[i]! * car.pitch + WHEEL_L[i]! * car.roll - gH[i]!;
    if (gap < -STEP_UP) {
      // Une marche trop haute (l'arrière d'un tremplin) : c'est un mur.
      car.x = prevX;
      car.z = prevZ;
      car.vx = 0;
      car.vz = 0;
      return false;
    }
    if (gap + BUMP_TRAVEL < worst) {
      worst = gap + BUMP_TRAVEL;
      wi = i;
    }
  }
  if (wi < 0) return true;
  car.y -= worst;
  // La roue en butée ne s'enfonce plus : sa vitesse rejoint celle du sol (choc sans rebond).
  const rate = car.vy + WHEEL_F[wi]! * car.pitchRate + WHEEL_L[wi]! * car.rollRate - (gX[wi]! * car.vx + gZ[wi]! * car.vz);
  if (rate < 0) car.vy -= rate;
  return true;
}
