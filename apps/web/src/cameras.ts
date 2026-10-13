// Caméras du jeu (lot 23) : proche, loin, capot. Présentation seule : aucune incidence sur la simulation.

export interface CameraRig {
  name: CameraName;
  /** Distance derrière la voiture, à l'arrêt puis en plus à la vitesse de pointe (négative : devant le centre de la voiture). */
  back: number;
  backAtSpeed: number;
  height: number;
  /** Point visé : devant la voiture, à cette hauteur. */
  ahead: number;
  lookHeight: number;
  /** Champ de vision à l'arrêt, et ouverture en plus à pleine vitesse. */
  fov: number;
  fovAtSpeed: number;
  /** Rapidité (1/s) avec laquelle la caméra rattrape le cap de la voiture et sa position : un léger retard. */
  yawLag: number;
  posLag: number;
  /**
   * Caméra **fixée à la carrosserie** (vue capot) : position dans le repère de la voiture (x vers la gauche, y vers le haut, z vers
   * l'avant, origine au sol au centre). La voiture reste dessinée : on voit son vrai capot, ses ailes et ses roues avant. Sa position suit
   * la caisse sans retard (elle ne peut donc pas passer à travers) ; `back`, `height` et `posLag` ne servent pas.
   */
  mount?: { x: number; y: number; z: number };
  /** Vue capot : part de l'inclinaison de la caisse (tangage, roulis) que le regard suit, 0 = horizon fixe, 1 = rivé à la caisse. */
  bodyFollow?: number;
}

/**
 * Vue capot : l'œil est posé au-dessus du capot, juste devant le bas du pare-brise. Contraintes (testées dans `hoodView.test.ts`) :
 * rien de la carrosserie à moins de `HOOD_CLEARANCE` de profondeur dans le champ de vision (plan proche à 0,1 m), et le regard ne s'écarte jamais de plus de
 * `HOOD_MAX_TILT` de l'axe de la caisse.
 */
export const HOOD_MOUNT = { x: 0, y: 1.16, z: 0.98 } as const;
/** Profondeur minimale (m, le long du regard) de toute surface de la voiture dans le champ de vision ; le plan proche est à 0,1 m. */
export const HOOD_CLEARANCE = 0.15;
/** Écart maximal (rad) entre le regard et l'axe de la caisse : la voiture peut tourner en l'air, la vue reste sur la route. */
export const HOOD_MAX_TILT = 0.35;
/** Distance (m) sous laquelle une autre voiture (fantôme) n'est pas dessinée en vue capot : la caméra serait dans sa caisse. */
export const HOOD_GHOST_CLEARANCE = 3;

export const CAMERA_NAMES = ["proche", "loin", "capot"] as const;
export type CameraName = (typeof CAMERA_NAMES)[number];

export const CAMERAS: readonly CameraRig[] = [
  { name: "proche", back: 5.6, backAtSpeed: 1.4, height: 2.3, ahead: 5, lookHeight: 1, fov: 68, fovAtSpeed: 20, yawLag: 7, posLag: 14 },
  { name: "loin", back: 9.5, backAtSpeed: 2.2, height: 4.2, ahead: 8, lookHeight: 1.3, fov: 62, fovAtSpeed: 16, yawLag: 5, posLag: 10 },
  // Capot : sur la carrosserie, au-dessus du capot ; le regard loin devant, presque aucun retard (la route doit « coller » à la voiture).
  { name: "capot", back: 0, backAtSpeed: 0, height: HOOD_MOUNT.y, ahead: 22, lookHeight: HOOD_MOUNT.y - 0.35, fov: 78, fovAtSpeed: 14, yawLag: 14, posLag: 60, mount: HOOD_MOUNT, bodyFollow: 0.6 },
];

/** Indice de la caméra nommée (inconnue ou absente : la première). */
export function cameraIndexOf(name: string | null | undefined): number {
  return Math.max(0, CAMERAS.findIndex((c) => c.name === name));
}

/** Caméra suivante, en rond. */
export function nextCameraIndex(i: number): number {
  return (i + 1) % CAMERAS.length;
}
