import * as K from "./constantes";
import { REGLES_COURANTES, type Regles } from "./regles";
const { CASE, CIBLE_CAMERA, COURBE_DOUCE, CROISIERE_PLUS, DUREE_MAX_TICKS, FACTEUR_NORMAL, LARGEUR_MORCEAU, NB_THEMES, PENTE_APRES_CROISIERE, RAMPE_BOUCLE, TAILLE, TICKS_PAR_SECONDE, VITESSE_PLAFOND } = K;

// La caméra défile toute seule, plus vite avec la distance (maquette : `7 + distance / 220`, plafonnée à 12,5 cases/s). Sa trajectoire ne dépend de rien d'autre que du temps : le générateur s'en sert pour savoir QUAND le
// joueur arrive à une colonne (les cases qui battent d'un morceau sont alignées sur cette arrivée, `generateur.ts`).

/** Ce que la caméra lit des règles (lot GR5 : les valeurs de la version de la simulation du jour, ou d'un essai). Sans règles : celles de la version courante. Lot GR7 : la forme de la courbe et la longueur d'une boucle. */
type Vitesses = Pick<Regles, "vitesseBase" | "vitesseMax" | "distanceParCran" | "courbe" | "morceauxParTheme">;

/**
 * **La vitesse de la montée normale** (sans portail de vitesse) quand la caméra est à `cam` unités du départ. Entier. Lot GR7 :
 *  - **avant la croisière** : en courbe douce (`COURBE_DOUCE`), une parabole qui part vite et arrive à plat sur la croisière à `(vitesseMax − vitesseBase) × distanceParCran` unités ; en courbe linéaire, 1 unité/s tous les
 *    `distanceParCran` unités (la courbe d'avant le GR7, pour les réglages d'essai) ;
 *  - **après** : la courbe continue plus doucement (`PENTE_APRES_CROISIERE`), **bornée par la croisière de la boucle** : `vitesseMax` à la 1re boucle, plus `CROISIERE_PLUS` ensuite, la croisière montant de celle d'avant en `RAMPE_BOUCLE`
 *    unités au début de chaque boucle.
 */
export function vitesseNormale(cam: number, r: Vitesses): number {
  const dv = r.vitesseMax - r.vitesseBase;
  const fin = dv * r.distanceParCran;
  let v: number;
  if (cam >= fin) v = r.vitesseMax + Math.trunc((cam - fin) / PENTE_APRES_CROISIERE);
  else if (r.courbe === COURBE_DOUCE) v = r.vitesseBase + Math.trunc((dv * Math.trunc((2 * fin * cam - cam * cam) / fin)) / fin);
  else v = r.vitesseBase + Math.trunc(cam / r.distanceParCran);
  const boucle = Math.trunc(cam / (r.morceauxParTheme * NB_THEMES * LARGEUR_MORCEAU * CASE));
  if (boucle === 0) return Math.min(v, r.vitesseMax);
  const longueur = r.morceauxParTheme * NB_THEMES * LARGEUR_MORCEAU * CASE;
  const avant = r.vitesseMax + CROISIERE_PLUS[Math.min(boucle - 1, CROISIERE_PLUS.length - 1)]!;
  const apres = r.vitesseMax + CROISIERE_PLUS[Math.min(boucle, CROISIERE_PLUS.length - 1)]!;
  const dans = cam - boucle * longueur;
  const plafond = avant + Math.trunc(((apres - avant) * Math.min(dans, RAMPE_BOUCLE)) / RAMPE_BOUCLE);
  return Math.min(v, plafond);
}

/**
 * La vitesse de la caméra (unités par seconde) quand elle est à `cam` unités du départ. Entier. **Lot GR6** : la montée normale est multipliée par le facteur du dernier portail de vitesse (`facteur`, en pour cent ; 100 sans
 * portail), puis **plafonnée à `VITESSE_PLAFOND`** : la vitesse réelle, celle que suit la caméra, ne dépasse jamais 17 cases/s.
 */
export const vitesseCamera = (cam: number, r: Vitesses = REGLES_COURANTES, facteur: number = FACTEUR_NORMAL): number => Math.min(VITESSE_PLAFOND, Math.trunc((vitesseNormale(cam, r) * facteur) / 100));

/** Un pas de la caméra. */
export const avancerCamera = (cam: number, r: Vitesses = REGLES_COURANTES, facteur: number = FACTEUR_NORMAL): number => cam + Math.trunc(vitesseCamera(cam, r, facteur) / TICKS_PAR_SECONDE);

const tables = new Map<string, Int32Array>();
/** La position de la caméra à chaque pas de la partie (calculée une fois par jeu de règles : 72 001 entiers ; huit jeux au plus gardés). */
function positions(r: Regles): Int32Array {
  const cle = `${r.vitesseBase}.${r.vitesseMax}.${r.distanceParCran}.${r.courbe}.${r.morceauxParTheme}`;
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

/**
 * Lot GR6 — la trajectoire de la caméra **sous les portails de vitesse d'un jour** : le facteur de vitesse n'est plus constant, il change quand le joueur franchit un portail. `facteurAu(x)` donne le facteur (en pour cent)
 * qui vaut quand le centre du joueur est en `x` ; on suppose le joueur à `CIBLE_CAMERA` devant la caméra (il y est, sauf un mur : le robot prouve le reste). Le générateur s'en sert pour savoir QUAND le joueur arrive à une
 * colonne (les cases qui battent) et à quelle vitesse (les surfaces suivent la vitesse réelle). Paresseuse : la table s'étend à la demande, jusqu'à 72 000 pas.
 */
export class Trajectoire {
  private readonly pos: number[] = [0];
  constructor(
    private readonly r: Regles,
    private readonly facteurAu: (x: number) => number,
  ) {}
  /** La position de la caméra au pas `t`. */
  camAu(t: number): number {
    while (this.pos.length <= t && this.pos.length <= DUREE_MAX_TICKS) {
      const cam = this.pos[this.pos.length - 1]!;
      this.pos.push(avancerCamera(cam, this.r, this.facteurAu(cam + CIBLE_CAMERA + (TAILLE >> 1))));
    }
    return this.pos[Math.min(t, this.pos.length - 1)]!;
  }
  /** Le premier pas où un joueur qui suit la caméra a son bord gauche à `x` unités ou plus loin. */
  tickOuLeJoueurArrive(x: number): number {
    const voulu = x - CIBLE_CAMERA;
    let t = 0;
    // Les pas sont sautés par paquets de 64 : la table est croissante, on cherche le paquet puis le pas.
    while (t < DUREE_MAX_TICKS && this.camAu(Math.min(DUREE_MAX_TICKS, t + 64)) < voulu) t += 64;
    while (t < DUREE_MAX_TICKS && this.camAu(t) < voulu) t++;
    return t;
  }
  /** La vitesse de la caméra (unités par seconde) quand elle est à `cam`, sous le facteur qui vaut en ce point. */
  vitesseEn(cam: number): number {
    return vitesseCamera(cam, this.r, this.facteurAu(cam + CIBLE_CAMERA + (TAILLE >> 1)));
  }
}
