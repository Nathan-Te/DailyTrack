import { daysFromCivil, formatDay } from "@cdj/core";

// Le numéro du jour de chaque jeu, pour les cartes du portail (lot R4). Le portail n'importe aucun jeu (il resterait léger, et les jeux ne
// s'importent jamais l'un l'autre) : les deux premiers jours sont recopiés ici, et un test (`test/jours.test.ts`) vérifie qu'ils donnent les
// mêmes numéros que `circuitNumber` (`@cdj/sim`) et `levelNumber` (`@cdj/jump-sim`).

/** DailyTrack : le circuit n° 1, le 13/10/2026 (`PREMIER_JOUR` de `@cdj/sim`). */
export const PREMIER_JOUR_TRACK = daysFromCivil(2026, 10, 13);
/** DailyJump : le niveau n° 1, le 16/10/2026 (`PREMIER_JOUR_JUMP` de `@cdj/jump-sim`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

export interface CarteJeu {
  /** Le code du jeu (son dossier sur le site : `/track/`, `/jump/`). */
  code: "track" | "jump";
  nom: string;
  accroche: string;
  /** Lien relatif à la page du portail. */
  lien: string;
  /** Numéro du jour (≤ 0 avant le premier). */
  numero: number;
  /** Ce qu'on écrit sur la carte : « Circuit n° 8 ». */
  titre: string;
}

/** Les cartes du portail pour un jour de Paris (`parisDay`). Pure. */
export function cartes(day: number): CarteJeu[] {
  const track = day - PREMIER_JOUR_TRACK + 1;
  const jump = day - PREMIER_JOUR_JUMP + 1;
  return [
    { code: "track", nom: "DailyTrack", accroche: "Un circuit par jour, le même pour tous.", lien: "track/", numero: track, titre: track > 0 ? `Circuit n° ${track}` : formatDay(day) },
    { code: "jump", nom: "DailyJump", accroche: "Un niveau de plateforme par jour, le même pour tous.", lien: "jump/", numero: jump, titre: jump > 0 ? `Niveau n° ${jump}` : formatDay(day) },
  ];
}
