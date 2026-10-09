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
  /** La carrosserie est cachée (on regarde depuis l'intérieur du capot). */
  hideCar?: boolean;
}

export const CAMERA_NAMES = ["proche", "loin", "capot"] as const;
export type CameraName = (typeof CAMERA_NAMES)[number];

export const CAMERAS: readonly CameraRig[] = [
  { name: "proche", back: 5.6, backAtSpeed: 1.4, height: 2.3, ahead: 5, lookHeight: 1, fov: 68, fovAtSpeed: 20, yawLag: 7, posLag: 14 },
  { name: "loin", back: 9.5, backAtSpeed: 2.2, height: 4.2, ahead: 8, lookHeight: 1.3, fov: 62, fovAtSpeed: 16, yawLag: 5, posLag: 10 },
  // Capot : très basse, sur l'avant de la voiture, le regard loin devant ; presque aucun retard (la route doit « coller » à la voiture).
  { name: "capot", back: -1.55, backAtSpeed: 0, height: 0.78, ahead: 22, lookHeight: 0.55, fov: 78, fovAtSpeed: 14, yawLag: 14, posLag: 60, hideCar: true },
];

/** Indice de la caméra nommée (inconnue ou absente : la première). */
export function cameraIndexOf(name: string | null | undefined): number {
  return Math.max(0, CAMERAS.findIndex((c) => c.name === name));
}

/** Caméra suivante, en rond. */
export function nextCameraIndex(i: number): number {
  return (i + 1) % CAMERAS.length;
}
