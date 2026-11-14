import { CIBLE_CAMERA, DISTANCE_PAR_CRAN, DUREE_MAX_TICKS, TICKS_PAR_SECONDE, VITESSE_BASE, VITESSE_MAX } from "./constantes";

// La caméra défile toute seule, plus vite avec la distance (maquette : `7 + distance / 220`, plafonnée à 12,5 cases/s). Sa trajectoire ne dépend de rien d'autre que du temps : le générateur s'en sert pour savoir QUAND le
// joueur arrive à une colonne (les cases qui battent d'un morceau sont alignées sur cette arrivée, `generateur.ts`).

/** La vitesse de la caméra (unités par seconde) quand elle est à `cam` unités du départ. Entier. */
export const vitesseCamera = (cam: number): number => Math.min(VITESSE_MAX, VITESSE_BASE + Math.trunc(cam / DISTANCE_PAR_CRAN));

/** Un pas de la caméra. */
export const avancerCamera = (cam: number): number => cam + Math.trunc(vitesseCamera(cam) / TICKS_PAR_SECONDE);

let table: Int32Array | null = null;
/** La position de la caméra à chaque pas de la partie (calculée une fois : 72 001 entiers). */
function positions(): Int32Array {
  if (table) return table;
  const t = new Int32Array(DUREE_MAX_TICKS + 1);
  for (let i = 1; i <= DUREE_MAX_TICKS; i++) t[i] = avancerCamera(t[i - 1]!);
  return (table = t);
}

/** Le premier pas où un joueur qui suit la caméra (à `CIBLE_CAMERA` devant elle) a son bord gauche à `x` unités ou plus loin. Au-delà de 10 minutes : `DUREE_MAX_TICKS`. */
export function tickOuLeJoueurArrive(x: number): number {
  const p = positions();
  const voulu = x - CIBLE_CAMERA;
  let bas = 0;
  let haut = DUREE_MAX_TICKS;
  while (bas < haut) {
    const milieu = (bas + haut) >> 1;
    if (p[milieu]! >= voulu) haut = milieu;
    else bas = milieu + 1;
  }
  return bas;
}
