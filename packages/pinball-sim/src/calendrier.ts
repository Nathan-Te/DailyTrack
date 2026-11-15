import { daysFromCivil } from "@cdj/core";

/** Le premier jour de « Pinball » (le n° 1), numéro de jour civil. Il ne change que la numérotation, jamais un contenu. */
export const PREMIER_JOUR_PINBALL = daysFromCivil(2026, 11, 2);

/** Le numéro de la partie d'un jour (n° 1 au premier jour) ; ≤ 0 avant : le jeu n'affiche alors pas de numéro. */
export const numeroPinball = (jour: number): number => jour - PREMIER_JOUR_PINBALL + 1;
