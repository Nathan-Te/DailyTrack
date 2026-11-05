import { CAMERA_DEFAUT } from "./camera";

// Les réglages de SENSATION qui ne touchent pas à la simulation : ils ne changent ni la partie ni sa rediffusion, seulement ce que le joueur voit et sent. Réglables en direct par `?debug&tune`, exportés avec les
// réglages de la simulation (`reglages` de `@cdj/rush-sim`) en un seul JSON que Nathan colle dans un lot.

export interface Sensations {
  /** L'arrêt sur image du coup FINAL (le troisième), en millisecondes (lot BR0c : 90). Les coups 1 et 2 n'en ont PAS : leur impact passe par l'éclair, l'écrasement, le recul, la poussée de caméra et les éclats. */
  arretImage: number;
  /** L'arrêt sur image du coup qui fait passer le golem en phase 2, en millisecondes (150). Jamais plus d'un arrêt par coup, et au moins 300 ms entre deux. */
  arretPhase: number;
  /** La force de la secousse de caméra, en % (100 : celle du prototype). */
  secousse: number;
  /** La quantité d'éclats (étincelles, poussière), en %. */
  eclats: number;
  /** La caméra (lot BR0b) : l'angle de plongée au-dessus de l'horizon, en degrés. */
  angle: number;
  /** La distance de base de la caméra, en mètres (elle s'allonge pour garder le golem dans le champ). */
  distance: number;
  /** Le champ vertical, en degrés. */
  champ: number;
  /** La durée de l'éclair blanc sur ce qui est touché, en images (60 par seconde). */
  eclair: number;
}

export const SENSATIONS_DEFAUT: Sensations = { arretImage: 90, arretPhase: 150, secousse: 100, eclats: 100, angle: CAMERA_DEFAUT.angle, distance: CAMERA_DEFAUT.distance, champ: CAMERA_DEFAUT.champ, eclair: 4 };
export const BORNES_SENSATIONS: Readonly<Record<keyof Sensations, readonly [number, number]>> = {
  arretImage: [0, 200],
  arretPhase: [0, 300],
  secousse: [0, 300],
  eclats: [0, 300],
  angle: [20, 75],
  distance: [8, 60],
  champ: [15, 60],
  eclair: [0, 14],
};
export const CLES_SENSATIONS = Object.keys(SENSATIONS_DEFAUT) as (keyof Sensations)[];

export function sensationsDe(brut: unknown): Sensations {
  const s: Sensations = { ...SENSATIONS_DEFAUT };
  if (typeof brut !== "object" || brut === null) return s;
  for (const k of CLES_SENSATIONS) {
    const v = (brut as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v)) s[k] = Math.min(BORNES_SENSATIONS[k][1], Math.max(BORNES_SENSATIONS[k][0], v));
  }
  return s;
}
