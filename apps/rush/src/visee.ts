import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";

// La visée à la souris (lot BR0b) : le chevalier regarde le point du SOL sous le curseur. On lance un rayon de la caméra à travers le curseur, on le coupe avec le plan du sol (y = 0), et la direction du chevalier vers ce
// point est arrondie aux 32 directions de la simulation (la même convention que `entree` : l'indice 0 regarde vers +x, 8 vers +z, c'est-à-dire vers le bas de l'écran). Du code de rendu : la simulation ne reçoit que
// l'indice (`entree(..., visee)`), jamais le point.
const SOL = new Plane(new Vector3(0, 1, 0), 0);
const rayon = new Raycaster();
const ecran = new Vector2();
const point = new Vector3();

/** Le point du sol (x, z en mètres) sous le point (ndcX, ndcY) de l'écran (de −1 à 1, y vers le haut), ou `null` si le rayon ne touche pas le sol (la caméra regarde au-dessus de l'horizon). */
export function pointSurLeSol(camera: Camera, ndcX: number, ndcY: number): { x: number; z: number } | null {
  camera.updateMatrixWorld();
  rayon.setFromCamera(ecran.set(ndcX, ndcY), camera);
  return rayon.ray.intersectPlane(SOL, point) ? { x: point.x, z: point.z } : null;
}

/** La direction (0 à 31) d'un vecteur du sol (dx, dz) en mètres : 0 vers +x, 8 vers +z (le bas de l'écran), 16 vers −x, 24 vers −z. */
export function directionDeVisee(dx: number, dz: number): number {
  return ((Math.round((Math.atan2(dz, dx) / (Math.PI * 2)) * 32) % 32) + 32) % 32;
}

/** Un curseur à moins de cette distance (mètres) du chevalier ne change pas la visée : la direction n'a plus de sens, elle tremblerait. */
export const ZONE_MORTE_VISEE = 0.3;
