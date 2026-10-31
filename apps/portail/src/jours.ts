import { daysFromCivil } from "@cdj/core";
import { numeroDeJournee as numero, premierJourDuJour } from "@cdj/core/lancement";

// Le numéro du jour de chaque jeu, pour les cartouches du portail (lot R4 ; lot I1 : les textes sont dans les catalogues). Le portail n'importe
// aucun jeu (il resterait léger, et les jeux ne s'importent jamais l'un l'autre) : les deux premiers jours sont recopiés ici, et un test
// (`test/jours.test.ts`) vérifie qu'ils donnent les mêmes numéros que `circuitNumber` (`@cdj/sim`) et `levelNumber` (`@cdj/jump-sim`).

/** DailyTrack : le circuit n° 1, le 13/10/2026 (`PREMIER_JOUR` de `@cdj/sim`). */
export const PREMIER_JOUR_TRACK = daysFromCivil(2026, 10, 13);
/** DailyJump : le niveau n° 1, le 16/10/2026 (`PREMIER_JOUR_JUMP` de `@cdj/jump-sim`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

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
  code: "track" | "jump" | "tower";
  /** Lot I2 : son code au registre du serveur (`GET /api/portail/jour`). */
  jeu: "cdj" | "jump" | "tower";
  /** Lien relatif à la page du portail. */
  lien: string;
  /** Numéro du jour (≤ 0 avant le premier : la cartouche ne l'affiche pas). */
  numero: number;
}

/**
 * Les cartouches du portail pour un jour de Paris (`parisDay`). Pure. Lot TP : Tower n'a **pas de numéro local** (`numero: 0`, donc rien avant la réponse du serveur) : il est
 * `off` tant que Nathan ne l'a pas activé, et la liste des jeux du serveur fait seule foi de sa présence et de son numéro.
 */
export function cartes(day: number): CarteJeu[] {
  return [
    { code: "track", jeu: "cdj", lien: "track/", numero: day - PREMIER_JOUR_TRACK + 1 },
    { code: "jump", jeu: "jump", lien: "jump/", numero: day - PREMIER_JOUR_JUMP + 1 },
    { code: "tower", jeu: "tower", lien: "tower/", numero: 0 },
  ];
}
