import { parseDay } from "@cdj/core";
import { numeroDeJournee as numero, premierJourDuJour } from "@cdj/core/lancement";
import type { Jeu } from "@cdj/ui";
import { FICHES } from "./jeuxFiches";

// Le numéro du jour de chaque jeu, pour les cartouches du portail (lot R4 ; lot I1 : les textes sont dans les catalogues). Le portail n'importe
// aucun jeu (il resterait léger, et les jeux ne s'importent jamais l'un l'autre) : le premier jour de chaque jeu vient de sa fiche (`premierJour`, lot K1c : plus aucune copie ici), et un test
// (`test/jours.test.ts`) vérifie qu'il donne les mêmes numéros que `circuitNumber` (`@cdj/sim`) et `levelNumber` (`@cdj/jump-sim`).

/**
 * Lot R8 : la journée n° 1 de Du Jour (le lancement public) vient de `config/lancement.json` (`@cdj/core/lancement`), la même source que le
 * serveur (`journee` de `GET /api/portail/jour`, qui fait foi quand il répond ; cette lecture affiche le numéro tout de suite, sans qu'il
 * saute quand les données arrivent). `VITE_LANCEMENT_PREMIER_JOUR` (construction de la recette, des aperçus et des essais) la déplace ; la
 * production n'en pose jamais.
 */
export const PREMIER_JOUR_DU_JOUR = premierJourDuJour(import.meta.env.VITE_LANCEMENT_PREMIER_JOUR as string | undefined);
/** Le numéro de la journée commune d'un jour de Paris, ou `null` avant le premier jour (rien n'est affiché). */
export const numeroDeJournee = (day: number): number | null => numero(day, PREMIER_JOUR_DU_JOUR);

export interface CarteJeu {
  /** Le code du jeu (son dossier sur le site : `/track/`, `/jump/`). */
  code: Jeu;
  /** Lot I2 : son code au registre du serveur (`GET /api/portail/jour`). */
  jeu: string;
  /** Lien relatif à la page du portail. */
  lien: string;
  /** Numéro du jour (≤ 0 avant le premier : la cartouche ne l'affiche pas). */
  numero: number;
}

/**
 * Les cartouches du portail pour un jour de Paris (`parisDay`). Pure. Lot TP : Tower n'a **pas de numéro local** (`numero: 0`, donc rien avant la réponse du serveur) : il est
 * `off` tant que Nathan ne l'a pas activé, et la liste des jeux du serveur fait seule foi de sa présence et de son numéro. Lot K1b : le numéro local d'un jeu à fiche est celui de son `premierJour`
 * (la projection ne le porte que pour un jeu public d'emblée).
 */
export function cartes(day: number): CarteJeu[] {
  // Lots K1, K1b et K1c : un jeu = une fiche (`config/jeux/<id>.json`), dans l'ordre de son champ `ordre` : Track, Jump, Tower. Sans `premierJour`, pas de numéro local (le serveur le donne).
  return FICHES.map((f): CarteJeu => ({ code: f.id as Jeu, jeu: f.code, lien: `${f.id}/`, numero: f.premierJour ? day - parseDay(f.premierJour)! + 1 : 0 }));
}
