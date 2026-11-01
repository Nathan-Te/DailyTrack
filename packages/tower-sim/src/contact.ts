// Lot T6 — les paramètres de contact de Rapier de la simulation version 4 (la « pose juste »), hors de `constantes.ts` pour que le premier chargement ne les porte pas. Ils ne servent qu'à la
// création du monde (les entrées de Rapier restent des entiers ÷ 8 ; ce sont des réglages du solveur, pas des positions). La version 3 garde ceux de Rapier (seules ses 30 itérations sont posées).
// Choisis d'après `tools/alignement.ts` (rapport `docs/tower/lots/lot-T6-grille-visee.md`) : voir le tableau des essais.

/** Les paramètres de contact du solveur. */
export interface ParamsContact {
  /** Pénétration permise (mètres) avant que le solveur corrige : `normalizedAllowedLinearError` (Rapier : 0,001). */
  erreurLineaire: number;
  /** Distance de prédiction du contact (mètres) : `normalizedPredictionDistance` (Rapier : 0,002). */
  prediction: number;
  /** Itérations du solveur (`numSolverIterations`) et itérations internes de Gauss-Seidel (`numInternalPgsIterations`, Rapier : 1). */
  iterations: number;
  iterationsInternes: number;
  /** Fréquence naturelle du contact (Hz) : la raideur de la correction d'erreur (Rapier : 30). `null` : celle de Rapier. */
  frequence: number | null;
}

/** Version 3 : Rapier par défaut, 30 itérations (rien d'autre n'est touché). */
export const CONTACT_V3: Readonly<ParamsContact> = { erreurLineaire: 0.001, prediction: 0.002, iterations: 30, iterationsInternes: 1, frequence: null };
/** Version 4 : voir le rapport du lot T6 (tableau des essais). */
export const CONTACT_V4: Readonly<ParamsContact> = { erreurLineaire: 0.0001, prediction: 0.002, iterations: 30, iterationsInternes: 1, frequence: 120 };

/** Version 4 : un voisin collé sur le côté ne fait pas lâcher la pièce active — la forme testée est rétrécie de ce retrait (mètres) sur les côtés (5 mm : plus que la dérive d'un voisin posé juste, de l'ordre de 1 à 2 mm). */
export const MARGE_LATERALE = 0.005;

/**
 * Version 4 : le décalage de secours d'un quart de tour refusé. Débrayable : `false` redonne un quart de tour refusé tout net. Une PROPOSITION (lot T6), à confirmer par Nathan en jouant.
 * Les essais, dans cet ordre fixe, en demi-cases (colonne, hauteur) : une demi-case à gauche, puis à droite, puis vers le haut.
 */
export const ROTATION_SECOURS = true;
export const DECALAGES_SECOURS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, 1]];

/** Les groupes d'interaction de Rapier (membre sur 16 bits, filtre sur 16 bits) : la pièce en main n'interagit avec rien (version 4), un corps posé avec tout. */
export const GROUPES_FANTOME = 0x0001_0000;
export const GROUPES_NORMAL = 0xffff_ffff;
