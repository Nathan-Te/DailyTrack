// Les réglages de la simulation (« sensations » de mouvement) : des entiers, dans des unités lisibles (centimètres par seconde, millisecondes, pour cent). Les valeurs de départ sont celles de la maquette
// jouable. `?debug&tune` les fait varier et exporte le JSON ; une partie jouée avec d'autres réglages que ceux du jeu n'est jamais classée (le serveur ne rejoue que `REGLAGES_DEFAUT`).
import { TICKS_PAR_SECONDE } from "./constantes";

export interface Reglages {
  /** Vitesse de course (cm/s). */
  vitesse: number;
  /** Accélération vers la vitesse souhaitée, en dixièmes de 1/s : au sol, en l'air, sur le mur. */
  accelSol: number;
  accelAir: number;
  accelMur: number;
  /** Vitesse verticale du saut (cm/s) et gravité (cm/s²). */
  saut: number;
  gravite: number;
  /** Temps de grâce au bord (ms) et saut mémorisé (ms). */
  coyote: number;
  tampon: number;
  /** Course sur le mur : gravité restante (%), durée maximale (ms), vitesse minimale le long du mur (cm/s), chute maximale (cm/s), attirance vers le mur (cm/s²). */
  murGravite: number;
  murDuree: number;
  murVitesse: number;
  murChute: number;
  murAttirance: number;
  /** Saut de mur : poussée hors du mur (cm/s), hauteur (cm/s), verrou (ms) pendant lequel on ne recolle pas au mur. */
  sautMurPousse: number;
  sautMurHaut: number;
  murVerrou: number;
  /** Dash : vitesse (cm/s), durée (ms), recharge (ms). */
  dashVitesse: number;
  dashDuree: number;
  dashRecharge: number;
}

export const REGLAGES_DEFAUT: Readonly<Reglages> = {
  vitesse: 950,
  accelSol: 140,
  accelAir: 32,
  accelMur: 20,
  saut: 960,
  gravite: 2800,
  coyote: 100,
  tampon: 120,
  murGravite: 12,
  murDuree: 1700,
  murVitesse: 350,
  murChute: 150,
  murAttirance: 200,
  sautMurPousse: 950,
  sautMurHaut: 920,
  murVerrou: 300,
  dashVitesse: 2300,
  dashDuree: 170,
  dashRecharge: 850,
};

/** Les bornes permises de chaque réglage ([min, max]) : le panneau d'essai et la lecture d'un JSON collé les respectent. */
export const BORNES: Readonly<Record<keyof Reglages, readonly [number, number]>> = {
  vitesse: [300, 2000],
  accelSol: [10, 600],
  accelAir: [1, 300],
  accelMur: [1, 300],
  saut: [300, 2000],
  gravite: [500, 6000],
  coyote: [0, 400],
  tampon: [0, 400],
  murGravite: [0, 100],
  murDuree: [100, 6000],
  murVitesse: [0, 1200],
  murChute: [0, 1500],
  murAttirance: [0, 1500],
  sautMurPousse: [0, 2000],
  sautMurHaut: [0, 2000],
  murVerrou: [0, 1000],
  dashVitesse: [500, 4000],
  dashDuree: [20, 600],
  dashRecharge: [100, 3000],
};
export const CLES_REGLAGES = Object.keys(REGLAGES_DEFAUT) as (keyof Reglages)[];

/** Des réglages lus d'un JSON collé : chaque valeur entière dans ses bornes, le reste prend la valeur de départ. */
export function reglagesDe(brut: unknown): Reglages {
  const r: Reglages = { ...REGLAGES_DEFAUT };
  if (typeof brut !== "object" || brut === null) return r;
  for (const k of CLES_REGLAGES) {
    const v = (brut as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= BORNES[k][0] && v <= BORNES[k][1]) r[k] = v;
  }
  return r;
}
export const sontLesReglagesDuJeu = (r: Reglages): boolean => CLES_REGLAGES.every((k) => r[k] === REGLAGES_DEFAUT[k]);

/** Des millisecondes en pas de simulation (arrondi au plus proche, entier). */
export const pas = (ms: number): number => Math.trunc((ms * TICKS_PAR_SECONDE + 500) / 1000);
