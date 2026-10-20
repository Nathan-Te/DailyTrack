import { daysFromCivil } from "@cdj/core";

// Le numéro du jour de chaque jeu, pour les cartouches du portail (lot R4 ; lot I1 : les textes sont dans les catalogues). Le portail n'importe
// aucun jeu (il resterait léger, et les jeux ne s'importent jamais l'un l'autre) : les deux premiers jours sont recopiés ici, et un test
// (`test/jours.test.ts`) vérifie qu'ils donnent les mêmes numéros que `circuitNumber` (`@cdj/sim`) et `levelNumber` (`@cdj/jump-sim`).

/** DailyTrack : le circuit n° 1, le 13/10/2026 (`PREMIER_JOUR` de `@cdj/sim`). */
export const PREMIER_JOUR_TRACK = daysFromCivil(2026, 10, 13);
/** DailyJump : le niveau n° 1, le 16/10/2026 (`PREMIER_JOUR_JUMP` de `@cdj/jump-sim`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

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
