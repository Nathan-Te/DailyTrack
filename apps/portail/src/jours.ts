import { daysFromCivil } from "@cdj/core";

// Le numéro du jour de chaque jeu, pour les cartouches du portail (lot R4 ; lot I1 : les textes sont dans les catalogues). Le portail n'importe
// aucun jeu (il resterait léger, et les jeux ne s'importent jamais l'un l'autre) : les deux premiers jours sont recopiés ici, et un test
// (`test/jours.test.ts`) vérifie qu'ils donnent les mêmes numéros que `circuitNumber` (`@cdj/sim`) et `levelNumber` (`@cdj/jump-sim`).

/** DailyTrack : le circuit n° 1, le 13/10/2026 (`PREMIER_JOUR` de `@cdj/sim`). */
export const PREMIER_JOUR_TRACK = daysFromCivil(2026, 10, 13);
/** DailyJump : le niveau n° 1, le 16/10/2026 (`PREMIER_JOUR_JUMP` de `@cdj/jump-sim`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

/**
 * Lot I3 : la journée n° 1 de Du Jour est le 23/10/2026 (l'ouverture publique) — la constante de la plateforme, recopiée du serveur
 * (`PREMIER_JOUR_DU_JOUR`, `apps/api/src/portail.ts` ; testée dans `test/jours.test.ts`). Le serveur fait foi quand il répond ; cette copie
 * affiche le numéro tout de suite, sans qu'il saute quand les données arrivent.
 */
export const PREMIER_JOUR_DU_JOUR = daysFromCivil(2026, 10, 23);
/** Le numéro de la journée commune d'un jour de Paris, ou `null` avant le 23/10/2026 (rien n'est affiché). */
export const numeroDeJournee = (day: number): number | null => (day >= PREMIER_JOUR_DU_JOUR ? day - PREMIER_JOUR_DU_JOUR + 1 : null);

export interface CarteJeu {
  /** Le code du jeu (son dossier sur le site : `/track/`, `/jump/`). */
  code: "track" | "jump";
  /** Lot I2 : son code au registre du serveur (`GET /api/portail/jour`). */
  jeu: "cdj" | "jump";
  /** Lien relatif à la page du portail. */
  lien: string;
  /** Numéro du jour (≤ 0 avant le premier : la cartouche ne l'affiche pas). */
  numero: number;
}

/** Les cartouches du portail pour un jour de Paris (`parisDay`). Pure. */
export function cartes(day: number): CarteJeu[] {
  return [
    { code: "track", jeu: "cdj", lien: "track/", numero: day - PREMIER_JOUR_TRACK + 1 },
    { code: "jump", jeu: "jump", lien: "jump/", numero: day - PREMIER_JOUR_JUMP + 1 },
  ];
}
