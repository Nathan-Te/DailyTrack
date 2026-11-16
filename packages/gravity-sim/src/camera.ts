import * as K from "./constantes";
import { REGLES_COURANTES, type Regles } from "./regles";
const { CIBLE_CAMERA, DUREE_MAX_TICKS, TICKS_PAR_SECONDE } = K;

// La caméra défile toute seule, plus vite avec la distance (maquette : `7 + distance / 220`, plafonnée à 12,5 cases/s). Sa trajectoire ne dépend de rien d'autre que du temps : le générateur s'en sert pour savoir QUAND le
// joueur arrive à une colonne (les cases qui battent d'un morceau sont alignées sur cette arrivée, `generateur.ts`).

/** Ce que la caméra lit des règles (lot GR5 : les valeurs de la version de la simulation du jour, ou d'un essai). Sans règles : celles de la version courante. */
type Vitesses = Pick<Regles, "vitesseBase" | "vitesseMax" | "distanceParCran">;

/** La vitesse de la caméra (unités par seconde) quand elle est à `cam` unités du départ. Entier. */
export const vitesseCamera = (cam: number, r: Vitesses = REGLES_COURANTES): number => Math.min(r.vitesseMax, r.vitesseBase + Math.trunc(cam / r.distanceParCran));

/** Un pas de la caméra. */
export const avancerCamera = (cam: number, r: Vitesses = REGLES_COURANTES): number => cam + Math.trunc(vitesseCamera(cam, r) / TICKS_PAR_SECONDE);

const tables = new Map<string, Int32Array>();
/** La position de la caméra à chaque pas de la partie (calculée une fois par jeu de règles : 72 001 entiers ; huit jeux au plus gardés). */
function positions(r: Regles): Int32Array {
  const cle = `${r.vitesseBase}.${r.vitesseMax}.${r.distanceParCran}`;
  const connue = tables.get(cle);
  if (connue) return connue;
  const t = new Int32Array(DUREE_MAX_TICKS + 1);
  for (let i = 1; i <= DUREE_MAX_TICKS; i++) t[i] = avancerCamera(t[i - 1]!, r);
  if (tables.size >= 8) tables.delete(tables.keys().next().value!);
  tables.set(cle, t);
  return t;
}

/** Le premier pas où un joueur qui suit la caméra (à `CIBLE_CAMERA` devant elle) a son bord gauche à `x` unités ou plus loin. Au-delà de 10 minutes : `DUREE_MAX_TICKS`. */
export function tickOuLeJoueurArrive(x: number, r: Regles = REGLES_COURANTES): number {
  const p = positions(r);
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
