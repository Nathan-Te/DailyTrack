// Caméra du jeu (affichage seulement) : elle suit le personnage avec une avance dans la direction du mouvement, lissée, une zone morte
// verticale (sauter ne secoue pas l'image) et reste dans le niveau. Coordonnées du monde en tuiles, x vers la droite, **y vers le haut**
// (la rangée r de la grille occupe [−r − 1, −r]).

export interface CameraView {
  /** Centre de l'image, en tuiles. */
  x: number;
  y: number;
  /** Avance horizontale actuelle (lissée), en tuiles. */
  ahead: number;
}

export interface Follow {
  /** Centre du personnage, en tuiles (y vers le haut). */
  cx: number;
  cy: number;
  /** Vitesse horizontale, en tuiles/s. */
  vx: number;
  ground: boolean;
}

export interface Frame {
  /** Taille du niveau, en tuiles. */
  width: number;
  height: number;
  /** Demi-largeur et demi-hauteur de l'image, en tuiles. */
  halfW: number;
  halfH: number;
}

export const CAMERA_DEFAULTS = {
  /** Avance maximale (à la vitesse de course), en tuiles. */
  lookAhead: 4,
  /** Vitesse de course de référence pour l'avance, en tuiles/s. */
  runSpeed: 11,
  /** Raideurs des lissages (1/s) : avance, suivi horizontal, suivi vertical (hors de la zone morte : chutes, longues montées). */
  aheadRate: 2.2,
  followRate: 9,
  verticalRate: 6,
  /**
   * Lot 14, zone morte verticale « façon Mario » : le personnage peut s'écarter de tant de tuiles du centre sans que l'image bouge. 3,2 tuiles :
   * un saut complet (≈ 4,2 tuiles) depuis le sol, l'image étant posée 1,5 au-dessus de lui, reste dans la zone (avant : 2,5, et il la dépassait).
   */
  deadZone: 3.2,
  /** Lot 14 : raideur du recalage doux, au sol et dans la zone (avant : celle du suivi, 6 ; un saut ne tire plus l'image à chaque atterrissage). */
  settleRate: 1.5,
  /** Au sol, l'image se recentre doucement un peu au-dessus du personnage (on voit mieux où l'on va sauter). */
  groundLift: 1.5,
};
export type CameraKey = keyof typeof CAMERA_DEFAULTS;
/** Les réglages en vigueur (modifiés en place par `?debug&tune`, section Caméra). */
export const CAMERA: Record<CameraKey, number> = { ...CAMERA_DEFAULTS };

/**
 * Lot 14, secousses de l'écran : réservées aux moments forts, jamais à une action ordinaire (saut, saut mural, atterrissage, ressort, tapis, glace,
 * vent : aucune). `amp` en tuiles, `dur` en secondes. Avant : mort 0,35 tuile (≈ 0,22 s) ; grosse chute 0,12 à 0,32 tuile (≈ 0,08 à 0,2 s).
 */
export const SHAKE_DEFAULTS = {
  mortAmp: 0.1,
  mortDur: 0.12,
  /** Atterrissage d'une grosse chute (vitesse ≥ 85 % de la chute maximale) : coupé par défaut, réglable. */
  chuteAmp: 0,
  chuteDur: 0.12,
};
export type ShakeKey = keyof typeof SHAKE_DEFAULTS;
export const SHAKES: Record<ShakeKey, number> = { ...SHAKE_DEFAULTS };

/** Centre de l'image pour que le niveau reste dans le cadre (centré s'il est plus petit que l'image), sur un axe. */
export function clampAxis(min: number, max: number, half: number, center: number): number {
  if (half * 2 >= max - min) return (min + max) / 2;
  return Math.min(Math.max(center, min + half), max - half);
}

function clampView(view: CameraView, frame: Frame): CameraView {
  return {
    x: clampAxis(0, frame.width, frame.halfW, view.x),
    y: clampAxis(-frame.height, 0, frame.halfH, view.y),
    ahead: view.ahead,
  };
}

/** Caméra posée d'un coup sur le personnage (départ, « recommencer »). */
export function snapCamera(p: Follow, frame: Frame): CameraView {
  return clampView({ x: p.cx, y: p.cy + CAMERA.groundLift, ahead: 0 }, frame);
}

const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Une image de suivi (`dt` en secondes). */
export function followCamera(view: CameraView, p: Follow, frame: Frame, dt: number): CameraView {
  const wanted = Math.max(-1, Math.min(1, p.vx / CAMERA.runSpeed)) * CAMERA.lookAhead;
  const ahead = view.ahead + (wanted - view.ahead) * ease(CAMERA.aheadRate, dt);
  const x = view.x + (p.cx + ahead - view.x) * ease(CAMERA.followRate, dt);
  let targetY = view.y;
  let rate = CAMERA.verticalRate;
  if (p.cy > view.y + CAMERA.deadZone) targetY = p.cy - CAMERA.deadZone;
  else if (p.cy < view.y - CAMERA.deadZone) targetY = p.cy + CAMERA.deadZone;
  else if (p.ground) rate = CAMERA.settleRate, targetY = p.cy + CAMERA.groundLift;
  const y = view.y + (targetY - view.y) * ease(rate, dt);
  return clampView({ x, y, ahead }, frame);
}

/** Hauteur de l'image, en tuiles, sur grand écran (clavier et souris). */
export const VIEW_TILES_DESKTOP = 18;
/** Sur téléphone en paysage : de 12 à 14 tuiles de haut (13 : 28 tuiles de large sur un écran 19,5:9, chaque tuile fait ≈ 30 px). */
export const VIEW_TILES_PHONE = 13;
/** Largeur minimale de l'image, en tuiles : en portrait, l'image s'agrandit en hauteur plutôt que de montrer moins de 10 tuiles de large. */
export const VIEW_MIN_WIDTH_TILES = 10;

/**
 * Hauteur de l'image en tuiles d'après la fenêtre (affichage seul). `touch` : téléphone (13 tuiles de haut en paysage) ; sinon 18.
 * Dans les deux cas, jamais moins de `VIEW_MIN_WIDTH_TILES` de large : un écran en portrait gagne en hauteur.
 */
export function viewHeightTiles(width: number, height: number, touch: boolean): number {
  const base = touch ? VIEW_TILES_PHONE : VIEW_TILES_DESKTOP;
  if (!(width > 0) || !(height > 0)) return base;
  return Math.max(base, (VIEW_MIN_WIDTH_TILES * height) / width);
}
