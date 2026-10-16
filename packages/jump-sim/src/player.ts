import { UNITS_PER_TILE } from "./constants";
import { boxHits, sweep, tileOf, type Grid } from "./collide";
import { idiv } from "./idiv";
import { TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE, isSolidTile, tileAt, type Level } from "./level";

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
  // ——— Lot 8b : essai d'élan progressif (panneau `?debug&tune` seulement) ———
  // Ces quatre réglages sont **absents des défauts** (absent = 0 : aucun élan) : sans eux, `stepPlayer` fait exactement les mêmes calculs
  // qu'avant (golden, rediffusions et niveaux du jour inchangés, `JUMP_SIM_VERSION` aussi). Une partie avec `sprintMode` = 1 est `tuned`.
  /** 0 (ou absent) : aucun élan ; 1 : élan progressif. */
  sprintMode?: number;
  /** Vitesse maximale en élan, unités/pas (sans effet sous `runSpeed` ; plafonnée à `MAX_SPEED`). */
  sprintSpeed?: number;
  /** Pas au sol à `runSpeed`, direction tenue, avant que l'élan commence. */
  sprintDelay?: number;
  /** Accélération de `runSpeed` vers `sprintSpeed` (au sol), unités/pas². */
  sprintAccel?: number;
  // ——— Lot 11 : tapis roulants et glace ———
  // Comme l'élan, ces trois réglages sont **absents de `DEFAULT_JUMP_PARAMS`** (absent = `SURFACE_DEFAULTS`) : la table des défauts, donc le
  // golden du personnage, ne bouge pas ; aucun niveau d'avant ne contient de tapis ni de glace, leurs trajectoires sont identiques.
  /** Tapis roulant : vitesse ajoutée dans le sens du tapis à la vitesse visée au sol, unités/pas. */
  beltSpeed?: number;
  /** Glace : accélération au sol (remplace `groundAccel`), unités/pas². */
  iceAccel?: number;
  /** Glace : freinage au sol (remplace `groundDecel`), unités/pas². */
  iceDecel?: number;
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

/** Lot 8b : les réglages de l'essai d'élan progressif (absents des défauts, voir `JumpParams`). */
export const SPRINT_PARAM_KEYS = ["sprintMode", "sprintSpeed", "sprintDelay", "sprintAccel"] as const satisfies readonly (keyof JumpParams)[];
export type SprintParamKey = (typeof SPRINT_PARAM_KEYS)[number];
/** Les réglages qui ont un défaut (tous sauf l'essai d'élan). */
export type JumpParamKey = Exclude<keyof JumpParams, SprintParamKey | SurfaceParamKey>;

export const JUMP_PARAM_KEYS = Object.keys(DEFAULT_JUMP_PARAMS) as readonly JumpParamKey[];

/**
 * Lot 8b : valeurs de départ de l'essai d'élan (`?debug&tune&sprint=1`, interrupteur du panneau) : élan jusqu'à 15 tuiles/s (512), après
 * 0,4 s au sol à pleine vitesse (48 pas), atteint en ≈ 0,57 s (137 unités/pas gagnées à 2 par pas : 69 pas). Pas des défauts.
 */
export const SPRINT_TRIAL_PARAMS: Readonly<Required<Pick<JumpParams, SprintParamKey>>> = Object.freeze({
  sprintMode: 1,
  sprintSpeed: 512,
  sprintDelay: 48,
  sprintAccel: 2,
});

/**
 * Lot 11 : défauts des réglages des surfaces. Tapis : 5 tuiles/s (171 unités/pas) ; glace : accélération au quart de `groundAccel` (4 contre
 * 17) et freinage au huitième de `groundDecel` (4 contre 32) : pleine vitesse en ≈ 94 pas (0,8 s), arrêt en ≈ 94 pas.
 */
export const SURFACE_DEFAULTS = Object.freeze({ beltSpeed: 171, iceAccel: 4, iceDecel: 4 });
export const SURFACE_PARAM_KEYS = ["beltSpeed", "iceAccel", "iceDecel"] as const satisfies readonly (keyof JumpParams)[];
export type SurfaceParamKey = (typeof SURFACE_PARAM_KEYS)[number];

/** Un réglage de surface : la valeur donnée, sinon son défaut. */
export function surfaceParam(params: Readonly<JumpParams>, key: SurfaceParamKey): number {
  return params[key] ?? SURFACE_DEFAULTS[key];
}

/**
 * Vrai si tous les réglages valent leur défaut (une partie aux réglages modifiés porte le drapeau `tuned`). L'élan éteint (`sprintMode`
 * absent ou 0) ne change rien : ses autres réglages, sans effet, ne rendent pas la partie `tuned`.
 */
export function isDefaultJumpParams(params: Readonly<JumpParams>): boolean {
  return JUMP_PARAM_KEYS.every((k) => params[k] === DEFAULT_JUMP_PARAMS[k]) && !params.sprintMode && SURFACE_PARAM_KEYS.every((k) => surfaceParam(params, k) === SURFACE_DEFAULTS[k]);
}

/** Vitesse visée en élan (unités/pas) : `sprintSpeed`, jamais sous `runSpeed` ni au-dessus de `MAX_SPEED`. */
export function sprintTop(params: Readonly<JumpParams>): number {
  const v = params.sprintSpeed ?? 0;
  return v < params.runSpeed ? params.runSpeed : v > MAX_SPEED ? MAX_SPEED : v;
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
  /**
   * Lot 8b, **seulement avec `sprintMode` = 1** (le champ est absent sinon : les empreintes de trajectoire ne changent pas) : pas finis au
   * sol à pleine vitesse, direction tenue (plafonné à `COUNTER_CAP`) ; gardé en l'air, remis à 0 au lâcher, au mur, au demi-tour. L'élan
   * agit quand il atteint `sprintDelay`.
   */
  sprint?: number;
  /**
   * Lot 11, **seulement non nul** (le champ est absent sinon : les empreintes des niveaux sans tapis ne changent pas) : sens (−1, 1) du
   * tapis sur lequel le personnage était posé ; gardé en l'air tant que la vitesse va dans ce sens, remis à 0 au sol hors d'un tapis, contre
   * un mur ou à l'arrêt. Tant qu'il est là, la vitesse acquise sur le tapis n'est pas freinée en l'air.
   */
  carry?: number;
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

/**
 * Lot 11 : la tuile sous les pieds (la rangée juste sous la boîte) : celle de la colonne du centre si elle est pleine, sinon la première
 * pleine des colonnes couvertes ; `TILE_EMPTY` (0) en l'air. Seul son code compte (tapis, glace, bloc ordinaire).
 */
export function groundTile(level: Grid, x: number, y: number): number {
  const row = tileOf(y + PLAYER_HEIGHT);
  const c0 = tileOf(x);
  const c1 = tileOf(x + PLAYER_WIDTH - 1);
  const mid = tileOf(x + idiv(PLAYER_WIDTH, 2));
  const m = tileAt(level, mid, row);
  if (isSolidTile(m)) return m;
  for (let c = c0; c <= c1; c++) {
    const t = tileAt(level, c, row);
    if (isSolidTile(t)) return t;
  }
  return 0;
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
  // Lot 11 : la surface sous les pieds (au début du pas) ; la glace remplace l'accélération et le freinage au sol, un tapis ajoute sa vitesse.
  const under = grounded ? groundTile(level, state.x, state.y) : 0;
  const belt = under === TILE_BELT_LEFT ? -1 : under === TILE_BELT_RIGHT ? 1 : 0;
  const onIce = under === TILE_ICE;
  const carry0 = state.carry ?? 0;
  const accel = grounded ? (onIce ? surfaceParam(p, "iceAccel") : p.groundAccel) : p.airAccel;
  const decel = grounded ? (onIce ? surfaceParam(p, "iceDecel") : p.groundDecel) : p.airDecel;
  // Lot 8b : élan progressif (essai). Éteint, rien de ce qui suit ne change de calcul.
  const sprintOn = p.sprintMode === 1;
  let sprint = sprintOn ? (state.sprint ?? 0) : 0;
  let vx = state.vx;
  if (belt !== 0) {
    // Tapis : vitesse visée = course voulue + vitesse du tapis (immobile, on est emporté ; contre le tapis, on avance moins vite).
    const target = dir * p.runSpeed + belt * surfaceParam(p, "beltSpeed");
    const sg = sign(target);
    if (sg === 0) vx = approach(vx, 0, decel);
    else vx = approach(vx, target, vx * sg < 0 ? (accel > decel ? accel : decel) : vx * sg < target * sg ? accel : decel);
  } else if (carry0 !== 0 && !grounded) {
    // En l'air, après un tapis : la vitesse acquise est gardée (ni freinée, ni réaccélérée au-delà de la course) ; on peut encore la freiner.
    if (dir === 0) vx = vx * carry0 > 0 ? vx : approach(vx, 0, decel);
    else if (vx * dir < 0) vx = approach(vx, dir * p.runSpeed, accel > decel ? accel : decel);
    else if (vx * dir <= p.runSpeed) vx = approach(vx, dir * p.runSpeed, accel);
  } else if (dir === 0) vx = approach(vx, 0, decel);
  else if (vx * dir < 0) vx = approach(vx, dir * p.runSpeed, accel > decel ? accel : decel); // demi-tour : le plus fort des deux
  else if (sprintOn && sprint >= (p.sprintDelay ?? 0) && vx * dir >= p.runSpeed && sprintTop(p) > p.runSpeed) {
    // En élan : au sol, la vitesse monte vers `sprintSpeed` ; en l'air, la vitesse acquise est gardée (ni réaccélérée, ni freinée).
    const top = sprintTop(p);
    if (vx * dir > top) vx = approach(vx, dir * top, decel);
    else if (grounded) vx = approach(vx, dir * top, p.sprintAccel ?? 0);
  } else if (vx * dir > p.runSpeed) vx = approach(vx, dir * p.runSpeed, decel); // au-delà de la course (après un saut mural)
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
  let wallJumped = false;
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
        wallJumped = true;
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

  // Lot 11 : le sens du tapis qui porte le personnage ; en l'air il est gardé tant que la vitesse va dans ce sens (un mur l'arrête).
  let carry = 0;
  if (ground) {
    const t = groundTile(level, x, y);
    carry = t === TILE_BELT_LEFT ? -1 : t === TILE_BELT_RIGHT ? 1 : 0;
  } else if (carry0 !== 0 && vx * carry0 > 0) carry = carry0;
  const tail = carry !== 0 ? { carry } : {};

  if (sprintOn) {
    // L'élan se perd au lâcher, au demi-tour, contre un mur (heurté, glisse, saut mural) ; il se compte au sol à pleine vitesse.
    if (dir === 0 || state.vx * dir < 0 || mx.blocked || slide !== 0 || wallJumped) sprint = 0;
    // Compté à la course exacte (avant l'élan) ou pendant l'élan ; pas pendant le freinage qui suit un élan perdu (au-dessus de la course).
    else if (grounded) sprint = vx * dir === p.runSpeed || (sprint >= (p.sprintDelay ?? 0) && vx * dir > p.runSpeed) ? (sprint < COUNTER_CAP ? sprint + 1 : sprint) : 0;
    return { x, y, vx: vx + 0, vy: vy + 0, ground, air, wallSide, wallAir, slide, buffer, held: jump, jumping, lock, lockDir, sprint, ...tail };
  }
  return { x, y, vx: vx + 0, vy: vy + 0, ground, air, wallSide, wallAir, slide, buffer, held: jump, jumping, lock, lockDir, ...tail };
}

/** Avance de plusieurs pas avec les commandes données (une par pas). */
export function runPlayer(state: Readonly<PlayerState>, inputs: readonly number[], level: Grid, params: Readonly<JumpParams>): PlayerState {
  let s = state as PlayerState;
  for (const input of inputs) s = stepPlayer(s, input, level, params);
  return s;
}
