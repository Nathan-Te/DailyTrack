import { TICK_RATE, UNITS_PER_TILE, type PlayerState } from "@cdj/jump-sim";
import { LOOK, type Look, type Motion } from "@cdj/visuels/plateformes";

// L'allure du personnage, **à l'affichage seulement** : écrasement et étirement au saut et à l'atterrissage, regard dans la direction
// du mouvement. Lit les états de la simulation, ne les modifie jamais.
// Lot 8 : plus marqués (étirement −0,36 au lieu de −0,28, écrasement 0,55 au lieu de 0,42), écrasé contre le mur au début d'une glisse ;
// l'amplitude affichée suit les réglages (`squashScale(…, amount)` : mouvement réduit, effets réduits).
// Lot 8b : il court au lieu de glisser. Deux pieds dont le cycle est calé sur la **distance parcourue au sol** (`stride`, pas le temps : il
// suit toujours la vitesse, et un pied se pose à chaque bruit de pas : un cycle = deux `STRIDE_TILES`) ; repliés en montée, pendants en
// chute (plus écartés quand elle est rapide), plaqués contre le mur en glisse, posés à l'arrêt. Le corps se penche dans le sens de
// l'accélération, rebondit à chaque pas, respire à l'arrêt, s'incline au dérapage ; tout cela (`body`) se coupe par le mouvement réduit et
// les réglages d'effets ; les pieds et les yeux, non (ils font partie du personnage).

// Lot DA2 : l'allure du personnage (types, réglages `LOOK` et `STEP`, pose des pieds, ressort, penché, respiration) est dans
// `@cdj/visuels/plateformes` (`personnage.ts`) ; ce fichier garde ce qui lit la simulation (`onStep`, `onSkid`, `motionOf`).
export { LOOK, STEP, animateLook, feetPose, feetTarget, leanTarget, restLook, squashScale, stridePhase } from "@cdj/visuels/plateformes";
export type { FeetPose, Look, Motion } from "@cdj/visuels/plateformes";

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

/** Le mouvement d'un état de la simulation, pour `animateLook`. */
export function motionOf(s: Readonly<PlayerState>, runSpeed: number, fallSpeed: number): Motion {
  const k = TICK_RATE / UNITS_PER_TILE;
  return { vx: s.vx * k, vyUp: -s.vy * k, ground: s.ground === 1, slide: s.slide, runSpeed: runSpeed * k, fallSpeed: fallSpeed * k };
}

