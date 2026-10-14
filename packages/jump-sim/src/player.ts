import { UNITS_PER_TILE } from "./constants";
import { boxHits, sweep, tileOf, type Grid } from "./collide";
import { idiv } from "./idiv";
import { isSolidTile, tileAt, type Level } from "./level";

// Le personnage (lot 1) : course à l'élan, saut à hauteur variable, glisse et saut muraux, tolérances (coyote, tampon, coin).
// `stepPlayer` est pur et avance d'un pas de 1/120 s. Tout l'état est entier : positions en unités (1 tuile = 4 096), vitesses en unités
// par pas, accélérations en unités par pas², minuteries en pas. Repère : x vers la droite, y vers le bas (comme les rangées de la grille).

// ——— Commandes : 3 bits par pas ———

export const INPUT_LEFT = 1;
export const INPUT_RIGHT = 2;
/** Saut **tenu** (l'appui, front montant, est déduit dans la simulation à partir de `PlayerState.held`). */
export const INPUT_JUMP = 4;
/** Les trois bits ; toute autre valeur est refusée par `stepPlayer`. */
export const INPUT_MASK = 7;

// ——— Constantes (pas des réglages) ———

/**
 * Boîte de collision : 3/4 de tuile de côté. Plus petite qu'une tuile pour passer dans un couloir d'une tuile de haut et un puits d'une
 * tuile de large (1 024 unités de jeu dans chaque cas), assez grande pour rester lisible. Le rendu dessine exactement cette boîte.
 */
export const PLAYER_WIDTH = 3072;
export const PLAYER_HEIGHT = 3072;

/**
 * Plafond de vitesse sur chaque axe, appliqué à chaque pas quels que soient les réglages : une demi-tuile par pas (≈ 61 tuiles/s), plus de
 * cinq fois la course et presque trois fois la chute maximale par défaut. Strictement sous une tuile par pas : même sans le balayage des
 * collisions (qui suffit), une boîte ne peut pas sauter par-dessus un mur d'une tuile.
 */
export const MAX_SPEED = 2048;

/** Plafond des compteurs de pas (temps passé en l'air, depuis le dernier mur) : ils n'ont pas besoin d'aller plus loin. */
export const COUNTER_CAP = 255;

// ——— Réglages ———

/** Réglages du personnage (entiers). Une partie jouée avec d'autres valeurs que `DEFAULT_JUMP_PARAMS` n'est jamais enregistrée. */
export interface JumpParams {
  /** Vitesse maximale de course, unités/pas. */
  runSpeed: number;
  /** Accélération au sol (et demi-tour), unités/pas². */
  groundAccel: number;
  /** Freinage au sol sans commande, unités/pas² (le demi-tour prend le plus fort des deux). */
  groundDecel: number;
  /** Accélération en l'air, unités/pas². */
  airAccel: number;
  /** Freinage en l'air sans commande (ou au-delà de la vitesse de course), unités/pas². */
  airDecel: number;
  /** Gravité, unités/pas². */
  gravity: number;
  /** Vitesse de chute maximale, unités/pas. */
  fallSpeed: number;
  /** Impulsion du saut, unités/pas (vers le haut). */
  jumpSpeed: number;
  /** Coupe de saut : relâcher pendant la montée ramène la vitesse de montée à cette valeur, unités/pas. */
  jumpCut: number;
  /** Chute maximale en glissant contre un mur, unités/pas. */
  slideSpeed: number;
  /** Saut mural : poussée horizontale, opposée au mur, unités/pas. */
  wallJumpX: number;
  /** Saut mural : impulsion verticale, unités/pas. */
  wallJumpY: number;
  /** Saut mural : la commande vers le mur est ignorée pendant ce nombre de pas (0 = aucun verrou). */
  wallLock: number;
  /** Saut mural accepté à cette distance d'un mur, unités. */
  wallReach: number;
  /** Coyote : saut encore accepté ce nombre de pas après avoir quitté le sol. */
  coyote: number;
  /** Coyote mural : saut mural encore accepté ce nombre de pas après avoir quitté un mur. */
  wallCoyote: number;
  /** Tampon : un appui reste valable ce nombre de pas (sauter dès qu'on le peut). */
  jumpBuffer: number;
  /** Tolérance de coin : en montée, une tête qui accroche un coin de plafond d'au plus ce nombre d'unités est décalée, unités. */
  cornerTolerance: number;
  /** Bloc friable (lot 2) : il tombe ce nombre de pas après le premier contact. */
  crumbleDelay: number;
  /** Ressort (lot 2) : vitesse de lancement vers le haut, unités/pas (plafonnée à `MAX_SPEED`) ; ce saut ne se coupe pas. */
  springSpeed: number;
}

/**
 * Réglages par défaut (points de départ du lot 1, en unités humaines dans `docs/jump/lots/lot-1-personnage.md`). Conversions :
 * tuiles/s × 4 096 ÷ 120 = unités/pas ; tuiles/s² × 4 096 ÷ 14 400 = unités/pas² ; secondes × 120 = pas.
 */
export const DEFAULT_JUMP_PARAMS: Readonly<JumpParams> = Object.freeze({
  runSpeed: 375, // 11,0 tuiles/s
  groundAccel: 17, // pleine vitesse en 23 pas (0,19 s)
  groundDecel: 32, // arrêt en 12 pas (0,10 s)
  airAccel: 13,
  airDecel: 6,
  gravity: 19, // 66,8 tuiles/s²
  fallSpeed: 751, // 22,0 tuiles/s
  jumpSpeed: 800, // saut complet ≈ 4,2 tuiles, montée 0,35 s
  jumpCut: 340, // saut court ≈ 1 tuile
  slideSpeed: 171, // 5,0 tuiles/s
  wallJumpX: 340, // 10,0 tuiles/s
  wallJumpY: 680, // ≈ 3,1 tuiles
  wallLock: 0,
  wallReach: 512, // 1/8 de tuile
  coyote: 10, // 0,083 s
  wallCoyote: 6, // 0,05 s
  jumpBuffer: 12, // 0,1 s
  cornerTolerance: 1024, // 1/4 de tuile
  crumbleDelay: 30, // 0,25 s
  springSpeed: 1056, // ≈ 7 tuiles de haut
});

export const JUMP_PARAM_KEYS = Object.keys(DEFAULT_JUMP_PARAMS) as readonly (keyof JumpParams)[];

/** Vrai si tous les réglages valent leur défaut (une partie aux réglages modifiés porte le drapeau `tuned`). */
export function isDefaultJumpParams(params: Readonly<JumpParams>): boolean {
  return JUMP_PARAM_KEYS.every((k) => params[k] === DEFAULT_JUMP_PARAMS[k]);
}

// ——— État ———

/** État du personnage : uniquement des entiers (les drapeaux valent 0 ou 1, les côtés −1, 0 ou 1). */
export interface PlayerState {
  /** Coin haut-gauche de la boîte, unités. */
  x: number;
  y: number;
  /** Vitesse, unités/pas (vy > 0 : vers le bas). */
  vx: number;
  vy: number;
  /** 1 si posé sur une tuile pleine à la fin du pas. */
  ground: number;
  /** Pas finis en l'air depuis le dernier pas au sol (0 au sol) ; `COUNTER_CAP` après un saut (plus de coyote). */
  air: number;
  /** Côté du dernier mur touché en l'air (−1 gauche, 1 droite, 0 aucun). */
  wallSide: number;
  /** Pas finis depuis ce contact (0 : contact à la fin du pas précédent) ; `COUNTER_CAP` au sol ou après un saut mural. */
  wallAir: number;
  /** Côté du mur contre lequel le personnage glisse pendant ce pas (0 : pas de glisse). */
  slide: number;
  /** Pas restants pendant lesquels un appui de saut est gardé (tampon). */
  buffer: number;
  /** Bouton de saut au pas précédent (0 ou 1) : l'appui est un front montant. */
  held: number;
  /** 1 pendant la montée d'un saut (la coupe de saut peut encore agir). */
  jumping: number;
  /** Pas restants du verrou de la commande vers le mur, et le côté verrouillé. */
  lock: number;
  lockDir: number;
}

/** État au départ du niveau : la boîte centrée sur la tuile `S`, posée au bas de cette tuile. */
export function initialPlayer(level: Level): PlayerState {
  const x = level.start.col * UNITS_PER_TILE + idiv(UNITS_PER_TILE - PLAYER_WIDTH, 2);
  const y = (level.start.row + 1) * UNITS_PER_TILE - PLAYER_HEIGHT;
  const ground = boxHits(level, x, y + 1, PLAYER_WIDTH, PLAYER_HEIGHT) ? 1 : 0;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    ground,
    air: ground ? 0 : COUNTER_CAP,
    wallSide: 0,
    wallAir: COUNTER_CAP,
    slide: 0,
    buffer: 0,
    held: 0,
    jumping: 0,
    lock: 0,
    lockDir: 0,
  };
}

/** Ce que fait le personnage, pour l'affichage et les tests : au sol, en l'air ou en glisse contre un mur. */
export function playerMode(state: Readonly<PlayerState>): "sol" | "air" | "mur" {
  if (state.ground) return "sol";
  return state.slide !== 0 ? "mur" : "air";
}

const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Rapproche `v` de `target` d'au plus `step`. */
const approach = (v: number, target: number, step: number) => (v < target ? (v + step > target ? target : v + step) : v - step < target ? target : v - step);

/** Distance (unités) entre le bord de la boîte et un mur plein de ce côté, si elle est d'au plus `reach` ; sinon −1. */
function wallGap(level: Grid, x: number, y: number, side: number, reach: number): number {
  const r0 = tileOf(y);
  const r1 = tileOf(y + PLAYER_HEIGHT - 1);
  const edge = side < 0 ? x : x + PLAYER_WIDTH; // bord de la boîte de ce côté
  const near = side < 0 ? tileOf(x) - 1 : tileOf(x + PLAYER_WIDTH - 1) + 1; // première colonne hors de la boîte
  const far = side < 0 ? tileOf(x - reach - 1) : tileOf(x + PLAYER_WIDTH + reach); // dernière colonne dont le bord est à ≤ reach
  for (let c = near; side < 0 ? c >= far : c <= far; c += side) {
    for (let r = r0; r <= r1; r++) {
      if (!isSolidTile(tileAt(level, c, r))) continue;
      return side < 0 ? edge - (c + 1) * UNITS_PER_TILE : c * UNITS_PER_TILE - edge;
    }
  }
  return -1;
}

/**
 * Un pas de simulation (1/120 s). Pur : `state` n'est pas modifié, le nouvel état est renvoyé. `input` = bits `INPUT_*`.
 * Ordre : commande horizontale → gravité ou glisse → saut (sol, coyote, mur, tampon) → coupe de saut → plafond de vitesse →
 * déplacement x puis y (tolérance de coin en montée) → sol, compteurs, contact mural.
 */
export function stepPlayer(state: Readonly<PlayerState>, input: number, level: Grid, params: Readonly<JumpParams>): PlayerState {
  if (!Number.isInteger(input) || input < 0 || input > INPUT_MASK) throw new RangeError(`Commande invalide : ${input}`);
  const p = params;
  let dir = (input & INPUT_RIGHT ? 1 : 0) - (input & INPUT_LEFT ? 1 : 0); // gauche + droite = neutre
  const jump = input & INPUT_JUMP ? 1 : 0;
  const pressed = jump === 1 && state.held === 0;

  // Verrou après un saut mural : la commande vers le mur ne compte pas.
  if (state.lock > 0 && dir === state.lockDir) dir = 0;
  let lock = state.lock > 0 ? state.lock - 1 : 0;
  let lockDir = lock > 0 ? state.lockDir : 0;

  // ——— Horizontal ———
  const grounded = state.ground === 1;
  const accel = grounded ? p.groundAccel : p.airAccel;
  const decel = grounded ? p.groundDecel : p.airDecel;
  let vx = state.vx;
  if (dir === 0) vx = approach(vx, 0, decel);
  else if (vx * dir < 0) vx = approach(vx, dir * p.runSpeed, accel > decel ? accel : decel); // demi-tour : le plus fort des deux
  else if (vx * dir > p.runSpeed) vx = approach(vx, dir * p.runSpeed, decel); // au-delà de la course (après un saut mural)
  else vx = approach(vx, dir * p.runSpeed, accel);

  // ——— Gravité ou glisse murale ———
  let vy = state.vy;
  let slide = 0;
  if (!grounded && vy >= 0 && dir !== 0 && wallGap(level, state.x, state.y, dir, 1) === 0) slide = dir;
  const fall = slide !== 0 ? p.slideSpeed : p.fallSpeed;
  vy = vy < fall ? (vy + p.gravity > fall ? fall : vy + p.gravity) : vy - p.gravity < fall ? fall : vy - p.gravity;

  // ——— Saut ———
  let air = state.air;
  let wallAir = state.wallAir;
  let jumping = state.jumping;
  let jumped = false;
  if (pressed || state.buffer > 0) {
    if (grounded || state.air <= p.coyote) {
      vy = -p.jumpSpeed;
      jumped = true;
      air = COUNTER_CAP; // plus de coyote après un saut
    } else {
      const gl = wallGap(level, state.x, state.y, -1, p.wallReach);
      const gr = wallGap(level, state.x, state.y, 1, p.wallReach);
      let wall = 0;
      if (gl >= 0 && gr >= 0) wall = dir !== 0 ? dir : gl <= gr ? -1 : 1; // deux murs à portée : celui qu'on pousse, sinon le plus proche
      else if (gl >= 0) wall = -1;
      else if (gr >= 0) wall = 1;
      else if (state.wallSide !== 0 && state.wallAir <= p.wallCoyote) wall = state.wallSide;
      if (wall !== 0) {
        vx = -wall * p.wallJumpX;
        vy = -p.wallJumpY;
        jumped = true;
        slide = 0;
        wallAir = COUNTER_CAP;
        lock = p.wallLock;
        lockDir = lock > 0 ? wall : 0;
      }
    }
  }
  if (jumped) jumping = 1;
  const buffer = jumped ? 0 : pressed ? p.jumpBuffer : state.buffer > 0 ? state.buffer - 1 : 0;

  // ——— Coupe de saut : relâcher pendant la montée ———
  if (jumping === 1 && jump === 0 && vy < -p.jumpCut) {
    vy = -p.jumpCut;
    jumping = 0;
  }
  if (vy >= 0) jumping = 0;

  vx = clamp(vx, -MAX_SPEED, MAX_SPEED);
  vy = clamp(vy, -MAX_SPEED, MAX_SPEED);

  // ——— Déplacement, axe par axe ———
  let x = state.x;
  let y = state.y;
  const mx = sweep(level, x, PLAYER_WIDTH, vx, y, PLAYER_HEIGHT, true);
  x = mx.pos;
  if (mx.blocked) vx = 0;

  let my = sweep(level, y, PLAYER_HEIGHT, vy, x, PLAYER_WIDTH, false);
  if (my.blocked && vy < 0 && p.cornerTolerance > 0) {
    // Tolérance de coin : la tête accroche le coin d'une tuile de plafond ; si elle n'en couvre qu'un peu, on la décale à côté.
    const row = tileOf(my.pos) - 1;
    const c0 = tileOf(x);
    const c1 = tileOf(x + PLAYER_WIDTH - 1);
    const s0 = isSolidTile(tileAt(level, c0, row));
    const s1 = isSolidTile(tileAt(level, c1, row));
    let nx = x;
    if (c0 !== c1 && s0 && !s1 && (c0 + 1) * UNITS_PER_TILE - x <= p.cornerTolerance) nx = (c0 + 1) * UNITS_PER_TILE;
    else if (c0 !== c1 && s1 && !s0 && x + PLAYER_WIDTH - c1 * UNITS_PER_TILE <= p.cornerTolerance) nx = c1 * UNITS_PER_TILE - PLAYER_WIDTH;
    if (nx !== x && !boxHits(level, nx, y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
      x = nx;
      my = sweep(level, y, PLAYER_HEIGHT, vy, x, PLAYER_WIDTH, false);
    }
  }
  y = my.pos;
  if (my.blocked) {
    if (vy < 0) jumping = 0; // la tête cogne : la montée s'arrête
    vy = 0;
  }

  // ——— Sol, compteurs, contact mural ———
  const ground = vy >= 0 && boxHits(level, x, y + 1, PLAYER_WIDTH, PLAYER_HEIGHT) ? 1 : 0;
  if (ground) air = 0;
  else if (air < COUNTER_CAP) air += 1;

  let wallSide = state.wallSide;
  if (ground) {
    wallSide = 0;
    wallAir = COUNTER_CAP;
  } else {
    const left = wallGap(level, x, y, -1, 1) === 0;
    const right = wallGap(level, x, y, 1, 1) === 0;
    if (left !== right) {
      wallSide = left ? -1 : 1;
      wallAir = 0;
    } else if (left && right) {
      wallSide = dir !== 0 ? dir : wallSide;
      wallAir = 0;
    } else if (wallAir < COUNTER_CAP) wallAir += 1;
  }
  if (ground) jumping = 0;

  return { x, y, vx: vx + 0, vy: vy + 0, ground, air, wallSide, wallAir, slide, buffer, held: jump, jumping, lock, lockDir };
}

/** Avance de plusieurs pas avec les commandes données (une par pas). */
export function runPlayer(state: Readonly<PlayerState>, inputs: readonly number[], level: Grid, params: Readonly<JumpParams>): PlayerState {
  let s = state as PlayerState;
  for (const input of inputs) s = stepPlayer(s, input, level, params);
  return s;
}
