import { TICK_RATE, UNITS_PER_TILE, type PlayerState } from "@cdj/jump-sim";
import { STRIDE_TILES } from "./events";

// L'allure du personnage, **à l'affichage seulement** : écrasement et étirement au saut et à l'atterrissage, regard dans la direction
// du mouvement. Lit les états de la simulation, ne les modifie jamais.
// Lot 8 : plus marqués (étirement −0,36 au lieu de −0,28, écrasement 0,55 au lieu de 0,42), écrasé contre le mur au début d'une glisse ;
// l'amplitude affichée suit les réglages (`squashScale(…, amount)` : mouvement réduit, effets réduits).
// Lot 8b : il court au lieu de glisser. Deux pieds dont le cycle est calé sur la **distance parcourue au sol** (`stride`, pas le temps : il
// suit toujours la vitesse, et un pied se pose à chaque bruit de pas : un cycle = deux `STRIDE_TILES`) ; repliés en montée, pendants en
// chute (plus écartés quand elle est rapide), plaqués contre le mur en glisse, posés à l'arrêt. Le corps se penche dans le sens de
// l'accélération, rebondit à chaque pas, respire à l'arrêt, s'incline au dérapage ; tout cela (`body`) se coupe par le mouvement réduit et
// les réglages d'effets ; les pieds et les yeux, non (ils font partie du personnage).

export type FeetPose = "arret" | "course" | "montee" | "chute" | "mur";

export interface Look {
  /** > 0 : écrasé (plus large, moins haut) ; < 0 : étiré. */
  squash: number;
  /** Vitesse du ressort de l'écrasement (1/s). */
  squashVel: number;
  /** Regard : −1 gauche, 1 droite (lissé). */
  eyeX: number;
  /** Regard vertical : > 0 vers le haut (lissé). */
  eyeY: number;
  /** Dernier côté regardé, gardé à l'arrêt. */
  facing: number;
  /** Lot 8b : distance parcourue au sol depuis le départ de la vie (tuiles) : le cycle des pieds. */
  stride: number;
  /** Accélération horizontale du dernier pas au sol (tuiles/s², > 0 vers la droite) ; 0 en l'air. */
  accel: number;
  /** Penché affiché (rad, > 0 : le haut part vers la droite), lissé. */
  lean: number;
  /** Dérapage : 1 au demi-tour, s'éteint en 0,25 s ; `skidSide` : sens du mouvement avant le demi-tour. */
  skid: number;
  skidSide: number;
  /** Temps immobile au sol (s) : la respiration. */
  idle: number;
  /** Pieds affichés : bas de chaque pied (gauche x, y, droit x, y) par rapport au bas-milieu de la boîte, en tuiles, y vers le haut. */
  feet: [number, number, number, number];
  /** Pose des pieds de la dernière image. */
  pose: FeetPose;
  /** Rebond du corps (tuiles, vers le haut) et respiration (échelle verticale du corps) de la dernière image. */
  bob: number;
  breath: number;
}

export const LOOK = {
  /** Étirement au décollage (saut, saut mural, ressort). */
  takeoff: -0.36,
  /** Écrasement maximal à l'atterrissage (chute à la vitesse maximale). */
  landing: 0.55,
  /** Contre le mur, au début d'une glisse : plus étroit, plus haut. */
  wall: -0.2,
  /** Lot 8b : contre le mur, tant que la glisse dure (le ressort revient vers cette valeur, pas vers 0). */
  wallHold: -0.08,
  /** Ressort du retour à la forme (raideur 1/s², amortissement 1/s). */
  stiffness: 420,
  damping: 26,
  /** Raideur du regard (1/s). */
  eyeRate: 14,
};

/** Lot 8b : dimensions et amplitudes de l'animation (tuiles, radians, secondes). */
export const STEP = {
  /** Hauteur des jambes : le corps dessiné commence à cette hauteur, les pieds remplissent le dessous (corps + pieds = la boîte). */
  leg: 0.08,
  footW: 0.2,
  footH: 0.09,
  /** Écart d'un pied au milieu, à l'arrêt. */
  footX: 0.19,
  /** Course : balancement avant-arrière et levée d'un pied à pleine vitesse. */
  swing: 0.12,
  lift: 0.09,
  /** Montée : pieds repliés sous le corps. */
  tuckX: 0.11,
  tuckY: 0.1,
  /** Chute : pieds pendants (sous la boîte), plus écartés à pleine chute. */
  hangY: -0.07,
  hangSpread: 0.1,
  /** Glisse : pieds plaqués au bord du mur, l'un plus haut que l'autre. */
  wallX: 0.33,
  wallY0: 0.04,
  wallY1: 0.22,
  /** Un cycle complet (deux pas) en distance au sol : un pied se pose à chaque bruit de pas. */
  cycle: 2 * STRIDE_TILES,
  /** Rebond du corps à chaque pas, à pleine vitesse. */
  bob: 0.04,
  /** Penché : selon l'accélération (référence ≈ l'accélération au sol), selon la vitesse, au dérapage ; borne. */
  leanAccel: 0.07,
  accelRef: 60,
  leanSpeed: 0.03,
  leanSkid: 0.1,
  leanMax: 0.14,
  leanRate: 16,
  /** Respiration à l'arrêt : amplitude (échelle) et période (s), installée en `breathIn` s. */
  breath: 0.022,
  breathPeriod: 2.4,
  breathIn: 0.8,
  /** Dérapage : durée de l'inclinaison (s). */
  skidTime: 0.25,
  /** Lissage des pieds (1/s) : en course (le cycle suit la distance) et pour les autres poses (passage en douceur). */
  feetRunRate: 60,
  feetRate: 25,
  /** En dessous de cette vitesse au sol (tuiles/s), il ne court plus : pieds posés. */
  still: 0.3,
};

export function restLook(): Look {
  const f = STEP.footX;
  return { squash: 0, squashVel: 0, eyeX: 1, eyeY: 0, facing: 1, stride: 0, accel: 0, lean: 0, skid: 0, skidSide: 0, idle: 0, feet: [-f, 0, f, 0], pose: "arret", bob: 0, breath: 1 };
}

/** Un pas de simulation vient d'être joué : repère décollage et atterrissage. `fallSpeed` : chute maximale (unités/pas). */
export function onStep(look: Look, prev: PlayerState, cur: PlayerState, fallSpeed: number): Look {
  let { squash, squashVel, facing } = look;
  if (cur.vy < 0 && cur.vy < prev.vy - 100) {
    squash = LOOK.takeoff; // impulsion vers le haut : saut ou saut mural
    squashVel = 0;
  } else if (!prev.ground && cur.ground) {
    squash = Math.max(squash, LOOK.landing * Math.min(1, Math.max(0.25, prev.vy / Math.max(1, fallSpeed))));
    squashVel = 0;
  } else if (prev.slide === 0 && cur.slide !== 0) {
    squash = Math.min(squash, LOOK.wall);
    squashVel = 0;
  }
  if (cur.slide !== 0) facing = -cur.slide; // contre un mur : il regarde de l'autre côté
  else if (cur.vx > 0) facing = 1;
  else if (cur.vx < 0) facing = -1;
  // Lot 8b : la distance au sol fait avancer le cycle des pieds ; l'accélération au sol penche le corps.
  const onGround = prev.ground === 1 && cur.ground === 1;
  const stride = onGround ? look.stride + Math.abs(cur.x - prev.x) / UNITS_PER_TILE : look.stride;
  const accel = onGround ? ((cur.vx - prev.vx) * TICK_RATE * TICK_RATE) / UNITS_PER_TILE : 0;
  return { ...look, squash, squashVel, facing, stride, accel };
}

/** Lot 8b : un dérapage (événement `derapage`) : le corps s'incline en arrière, contre le mouvement. */
export function onSkid(look: Look, side: number): Look {
  return { ...look, skid: 1, skidSide: side };
}

/** Ce que l'animation sait du mouvement à cette image (tuiles/s, y vers le haut). */
export interface Motion {
  vx: number;
  vyUp: number;
  ground: boolean;
  /** Côté du mur en glisse (−1, 0, 1). */
  slide: number;
  /** Vitesse de course et chute maximale (tuiles/s), pour mesurer « pleine vitesse » et « chute rapide ». */
  runSpeed: number;
  fallSpeed: number;
}

/** Le mouvement d'un état de la simulation, pour `animateLook`. */
export function motionOf(s: Readonly<PlayerState>, runSpeed: number, fallSpeed: number): Motion {
  const k = TICK_RATE / UNITS_PER_TILE;
  return { vx: s.vx * k, vyUp: -s.vy * k, ground: s.ground === 1, slide: s.slide, runSpeed: runSpeed * k, fallSpeed: fallSpeed * k };
}

/** Sous-pas du ressort de l'écrasement, par seconde. */
const SPRING_RATE = 120;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

/** La pose des pieds selon le mouvement. */
export function feetPose(m: Readonly<Motion>): FeetPose {
  if (m.slide !== 0 && !m.ground) return "mur";
  if (!m.ground) return m.vyUp > 0.5 ? "montee" : "chute";
  return Math.abs(m.vx) > STEP.still ? "course" : "arret";
}

/** Phase du cycle des pieds (0 à 1) pour une distance au sol donnée (tuiles). */
export const stridePhase = (stride: number): number => {
  const p = (stride / STEP.cycle) % 1;
  return p < 0 ? p + 1 : p;
};

/**
 * Où vont les pieds (bas de chaque pied, par rapport au bas-milieu de la boîte, tuiles, y vers le haut) et le rebond du corps, sans lissage.
 * `stride` : distance au sol (tuiles).
 */
export function feetTarget(m: Readonly<Motion>, stride: number): { pose: FeetPose; feet: [number, number, number, number]; bob: number } {
  const pose = feetPose(m);
  const f = STEP.footX;
  switch (pose) {
    case "course": {
      const k = Math.min(1, Math.abs(m.vx) / Math.max(0.1, m.runSpeed));
      const theta = 2 * Math.PI * stridePhase(stride);
      const d = m.vx > 0 ? 1 : -1;
      const foot = (base: number, ph: number) => [base + d * STEP.swing * k * Math.cos(ph), STEP.lift * k * Math.max(0, Math.sin(ph))] as const;
      const [lx, ly] = foot(-f, theta);
      const [rx, ry] = foot(f, theta + Math.PI);
      return { pose, feet: [lx, ly, rx, ry], bob: STEP.bob * k * Math.abs(Math.sin(theta)) };
    }
    case "montee":
      return { pose, feet: [-STEP.tuckX, STEP.tuckY, STEP.tuckX, STEP.tuckY], bob: 0 };
    case "chute": {
      const k = clamp(-m.vyUp / Math.max(0.1, m.fallSpeed), 0, 1);
      const x = f + STEP.hangSpread * k;
      return { pose, feet: [-x, STEP.hangY * k, x, STEP.hangY * k], bob: 0 };
    }
    case "mur": {
      const x = m.slide * STEP.wallX;
      return { pose, feet: m.slide < 0 ? [x, STEP.wallY1, x, STEP.wallY0] : [x, STEP.wallY0, x, STEP.wallY1], bob: 0 };
    }
    default:
      return { pose, feet: [-f, 0, f, 0], bob: 0 };
  }
}

/** Penché visé (rad, > 0 : le haut vers la droite), avant l'amplitude des réglages. */
export function leanTarget(look: Readonly<Look>, m: Readonly<Motion>): number {
  if (m.slide !== 0 && !m.ground) return 0;
  const speed = STEP.leanSpeed * clamp(m.vx / Math.max(0.1, m.runSpeed), -1, 1);
  const accel = m.ground ? STEP.leanAccel * clamp(look.accel / STEP.accelRef, -1, 1) : 0;
  const skid = -look.skidSide * STEP.leanSkid * look.skid;
  return clamp(speed + accel + skid, -STEP.leanMax, STEP.leanMax);
}

/**
 * Une image : le ressort revient vers 0 (vers `wallHold` en glisse), le regard suit, les pieds et le corps s'animent. `motion` : le
 * mouvement (ou seulement la vitesse verticale vers le haut, en tuiles/s, comme au lot 1). `body` : amplitude du rebond, du penché et de
 * la respiration (0 : mouvement réduit ou effets coupés ; les pieds et les yeux restent animés).
 */
export function animateLook(look: Look, dt: number, motion: Motion | number, body = 1): Look {
  const m: Motion = typeof motion === "number" ? { vx: 0, vyUp: motion, ground: true, slide: 0, runSpeed: 11, fallSpeed: 22 } : motion;
  const rest = m.slide !== 0 && !m.ground ? LOOK.wallHold : 0;
  // Le ressort en sous-pas d'au plus 1/120 s : intégré en un seul pas, une image longue (rendu lent, onglet ralenti) le faisait osciller
  // d'un extrême à l'autre (instable au-delà de ≈ 1/13 s avec cette raideur et cet amortissement).
  let squash = look.squash;
  let squashVel = look.squashVel;
  const n = Math.min(60, Math.max(1, Math.ceil(dt * SPRING_RATE)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    squashVel += (-LOOK.stiffness * (squash - rest) - LOOK.damping * squashVel) * h;
    squash = Math.max(-0.5, Math.min(0.6, squash + squashVel * h));
  }
  const k = 1 - Math.exp(-LOOK.eyeRate * dt);
  const eyeX = look.eyeX + (look.facing - look.eyeX) * k;
  const targetY = Math.max(-1, Math.min(1, m.vyUp / 15));
  const eyeY = look.eyeY + (targetY - look.eyeY) * k;
  if (typeof motion === "number") return { ...look, squash, squashVel, eyeX, eyeY };

  const target = feetTarget(m, look.stride);
  const rate = target.pose === "course" && look.pose === "course" ? STEP.feetRunRate : STEP.feetRate;
  const feet = look.feet.map((v, i) => smooth(v, target.feet[i]!, rate, dt)) as Look["feet"];
  const amp = clamp(body, 0, 1);
  const skid = Math.max(0, look.skid - dt / STEP.skidTime);
  const lean = amp > 0 ? smooth(look.lean, leanTarget(look, m) * amp, STEP.leanRate, dt) : 0;
  const idle = m.ground && Math.abs(m.vx) < 0.05 ? look.idle + dt : 0;
  const breath = 1 + STEP.breath * amp * Math.min(1, idle / STEP.breathIn) * Math.sin((2 * Math.PI * idle) / STEP.breathPeriod);
  return { ...look, squash, squashVel, eyeX, eyeY, feet, pose: target.pose, bob: target.bob * amp, lean, skid, idle, breath };
}

/** Échelles du corps (largeur, hauteur) pour un écrasement donné : l'aire reste à peu près la même. `amount` : part affichée (réglages). */
export function squashScale(squash: number, amount = 1): { sx: number; sy: number } {
  const sy = 1 - squash * amount;
  return { sx: 1 / Math.max(0.4, sy), sy };
}
