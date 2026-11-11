import { CM, DEMI, M, TICKS_PAR_SECONDE } from "./constantes";
import { pas, REGLAGES_DEFAUT, type Reglages } from "./sensations";
import { idiv } from "./trigo";

// Les jauges (lot V2) : ce qu'un joueur peut franchir, calculé à partir des constantes de la simulation (les `Reglages`), pour vérifier chaque écart d'un module. Chaque jauge rejoue en entiers, pas à pas, les formules de
// `course.ts` (même ordre, mêmes divisions entières) : elle suit donc les constantes de sensation sans rien recopier, et `jauges.test.ts` la compare au moteur lui-même (un vrai saut, un vrai dash).
// **Un écart d'un module est au plus 85 % de la portée maximale** (`MARGE_MILLE`) : un humain doit pouvoir le passer, pas seulement le robot. Les portées sont celles d'un saut pris au bord (sans le temps de grâce, qui
// ne fait que pardonner), à pleine vitesse de course ; un « écart » est la distance libre entre deux bords de plateforme (portée + la largeur de la boîte, qui se tient jusqu'à ce que son centre dépasse le bord).
export const MARGE_MILLE = 850;
const SONDE = 80_000; // la sonde de mur de la simulation (8 cm)

export interface Vol {
  /** La distance horizontale parcourue (µm) jusqu'à l'atterrissage, sa durée (pas), la hauteur la plus haute atteinte (µm). */
  distance: number;
  pas: number;
  sommet: number;
}

export interface Jauges {
  /** La vitesse de course (µm/s) et sa distance par pas. */
  course: number;
  /** Un saut au bord, atterrissant à `denivele` µm au-dessus (ou au-dessous, négatif) du point de départ : la distance parcourue, sans rien d'autre. */
  vol(denivele: number): Vol;
  /** Idem avec un dash, pris au meilleur moment du vol. */
  volDash(denivele: number): Vol;
  /** Un dash sans saut, pris au bord (on tombe pendant et après). */
  volDashSeul(denivele: number): Vol;
  /** La plus grande hauteur d'un saut (µm). */
  hauteurSaut: number;
  /** La course sur le mur : sa durée (pas) et sa longueur (µm). */
  mur: { pas: number; longueur: number };
  /** Un saut de mur : la distance horizontale, perpendiculaire au mur, parcourue avant de retomber au niveau du saut (µm), et sa durée. */
  sautDeMur: Vol;
  /** Les écarts libres maximaux entre deux bords (µm) : la portée plus la largeur de la boîte ; pour un saut de mur, plus les deux sondes de mur. */
  ecartSaut(denivele: number): number;
  ecartSautDash(denivele: number): number;
  ecartDashSeul(denivele: number): number;
  ecartSautDeMur: number;
  /** Les mêmes, à 85 % : ce qu'un module peut demander. */
  permis: { ecartSaut(denivele: number): number; ecartSautDash(denivele: number): number; ecartDashSeul(denivele: number): number; ecartSautDeMur: number; longueurMur: number; hauteurSaut: number };
}

/** Un vol qui n'atteint jamais le niveau demandé (plus haut que le sommet du saut) : une distance impossible. */
const INATTEIGNABLE: Vol = { distance: -1_000_000 * M, pas: 0, sommet: 0 };
const marge = (v: number): number => idiv(v * MARGE_MILLE, 1000);

export function jauges(r: Readonly<Reglages> = REGLAGES_DEFAUT): Jauges {
  const course = r.vitesse * CM;
  const g = idiv(r.gravite * CM, TICKS_PAR_SECONDE);
  const nDash = pas(r.dashDuree);

  /** Un saut au bord. `dashAu` : le pas du vol où le dash est pris (−1 : aucun). */
  const voler = (denivele: number, dashAu: number, saute = true): Vol => {
    let y = 0;
    let vy = saute ? r.saut * CM : 0;
    let vz = course;
    let distance = 0;
    let sommet = 0;
    let dash = 0;
    for (let n = 0; n < 2000; n++) {
      if (n === dashAu) dash = nDash;
      if (dash > 0) {
        dash--;
        vz = r.dashVitesse * CM;
        vy = 0;
      } else {
        vz += idiv((course - vz) * r.accelAir, 1200);
        vy -= g;
      }
      distance += idiv(vz, TICKS_PAR_SECONDE);
      y += idiv(vy, TICKS_PAR_SECONDE);
      if (y > sommet) sommet = y;
      if (vy < 0 && y <= denivele) return denivele > sommet ? INATTEIGNABLE : { distance, pas: n + 1, sommet };
      if (y < denivele - 200 * M) break;
    }
    return INATTEIGNABLE;
  };
  const vol = (denivele: number): Vol => voler(denivele, -1);
  const volDash = (denivele: number): Vol => {
    let meilleur = vol(denivele);
    for (let au = 0; au < Math.max(meilleur.pas, 100) + 2 * nDash; au++) {
      const v = voler(denivele, au);
      if (v.distance > meilleur.distance) meilleur = v;
    }
    return meilleur;
  };
  const volDashSeul = (denivele: number): Vol => {
    const v = voler(denivele, 0, false);
    return v;
  };

  // Le saut de mur : poussée hors du mur (perpendiculaire), hauteur ; sans touche, la vitesse perpendiculaire retombe vers 0 (contrôle en l'air).
  const sautDeMur = ((): Vol => {
    let y = 0;
    let vy = r.sautMurHaut * CM;
    let vx = r.sautMurPousse * CM;
    let distance = 0;
    let sommet = 0;
    for (let n = 0; n < 2000; n++) {
      vx += idiv((0 - vx) * r.accelAir, 1200);
      vy -= g;
      distance += idiv(vx, TICKS_PAR_SECONDE);
      y += idiv(vy, TICKS_PAR_SECONDE);
      if (y > sommet) sommet = y;
      if (vy < 0 && y <= 0) return { distance, pas: n + 1, sommet };
    }
    return { distance, pas: 2000, sommet };
  })();

  const pasMur = pas(r.murDuree);
  const longueur = pasMur * idiv(course, TICKS_PAR_SECONDE);
  const hauteurSaut = vol(0).sommet;
  const ecartSaut = (d: number): number => vol(d).distance + 2 * DEMI;
  const ecartSautDash = (d: number): number => volDash(d).distance + 2 * DEMI;
  const ecartDashSeul = (d: number): number => volDashSeul(d).distance + 2 * DEMI;
  const ecartSautDeMur = sautDeMur.distance + 2 * (DEMI + SONDE);
  return {
    course,
    vol,
    volDash,
    volDashSeul,
    hauteurSaut,
    mur: { pas: pasMur, longueur },
    sautDeMur,
    ecartSaut,
    ecartSautDash,
    ecartDashSeul,
    ecartSautDeMur,
    permis: { ecartSaut: (d) => marge(ecartSaut(d)), ecartSautDash: (d) => marge(ecartSautDash(d)), ecartDashSeul: (d) => marge(ecartDashSeul(d)), ecartSautDeMur: marge(ecartSautDeMur), longueurMur: marge(longueur), hauteurSaut: marge(hauteurSaut) },
  };
}
