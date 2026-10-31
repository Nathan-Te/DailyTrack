// Les profondeurs (z) du décor de la scène et le niveau de la mer (lot T5), **sans Three.js** : le test d'ordre (`test/chute.test.ts`) les lit. Plus petit = plus loin derrière.
//
// Les pièces tombées (la simulation les a retirées sous la plateforme) finissent leur chute **devant la mer du fond** (`mer`, `vagues`) et **derrière l'eau de devant** (`merAvant`) : elles
// entrent dans l'eau, sans rien couper (question 4 du lot T1 : au T1 elles passaient derrière les vagues). Elles restent derrière la plateforme et son pilier, et derrière la tour.

/** La surface de la mer, en mètres au-dessus du dessus de la plateforme (négatif : en dessous). */
export const NIVEAU_MER = -1.65;

export const Z = {
  decor: -9,
  mer: -8,
  /** Les pièces tombées : devant la mer du fond, derrière l'eau de devant. */
  chute: -6.5,
  /** L'eau de devant : un aplat de la couleur de la mer, sous lequel une pièce tombée disparaît. */
  merAvant: -6,
  /** Les petits traits de vague, posés sur l'eau de devant (la surface). */
  vagues: -5.9,
  /** La gerbe d'eau (gouttes et ondes), devant l'eau. */
  gerbe: -5.8,
  traineesVent: -0.4,
  pilier: -2,
  plateforme: -1,
} as const;
