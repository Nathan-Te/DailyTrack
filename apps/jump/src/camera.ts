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

export const CAMERA = {
  /** Avance maximale (à la vitesse de course), en tuiles. */
  lookAhead: 4,
  /** Vitesse de course de référence pour l'avance, en tuiles/s. */
  runSpeed: 11,
  /** Raideurs des lissages (1/s) : avance, suivi horizontal, suivi vertical. */
  aheadRate: 2.2,
  followRate: 9,
  verticalRate: 6,
  /** Zone morte verticale : le personnage peut s'écarter de tant de tuiles du centre sans que l'image bouge. */
  deadZone: 2.5,
  /** Au sol, l'image se recentre doucement un peu au-dessus du personnage (on voit mieux où l'on va sauter). */
  groundLift: 1.5,
};

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
  if (p.cy > view.y + CAMERA.deadZone) targetY = p.cy - CAMERA.deadZone;
  else if (p.cy < view.y - CAMERA.deadZone) targetY = p.cy + CAMERA.deadZone;
  else if (p.ground) targetY = p.cy + CAMERA.groundLift;
  const y = view.y + (targetY - view.y) * ease(CAMERA.verticalRate, dt);
  return clampView({ x, y, ahead }, frame);
}
