// Les réglages de SENSATION qui ne touchent pas à la simulation : ils ne changent ni la partie ni sa rediffusion, seulement ce que le joueur voit et sent. Réglables en direct par `?debug&tune`, exportés avec les
// réglages de la simulation (`reglages` de `@cdj/rush-sim`) en un seul JSON que Nathan colle dans un lot.

export interface Sensations {
  /** L'arrêt sur image à chaque coup qui touche, en millisecondes (le golem, un coup fort ou une mise à mort l'allongent). */
  arretImage: number;
  /** La force de la secousse de caméra, en % (100 : celle du prototype). */
  secousse: number;
  /** La quantité d'éclats (étincelles, poussière), en %. */
  eclats: number;
  /** Combien de mètres du sol l'écran montre dans sa hauteur. */
  vue: number;
  /** La durée de l'éclair blanc sur ce qui est touché, en images (60 par seconde). */
  eclair: number;
}

export const SENSATIONS_DEFAUT: Sensations = { arretImage: 70, secousse: 100, eclats: 100, vue: 13, eclair: 6 };
export const BORNES_SENSATIONS: Readonly<Record<keyof Sensations, readonly [number, number]>> = {
  arretImage: [0, 200],
  secousse: [0, 300],
  eclats: [0, 300],
  vue: [9, 24],
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
