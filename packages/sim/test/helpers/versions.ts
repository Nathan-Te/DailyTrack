import { GENERATOR_BEFORE_34, GENERATOR_BEFORE_48, GENERATOR_VERSION, daysFromCivil, parseDay, resumeRegistreTrack } from "../../src/index";

// Lot R11 : le code ne connaît plus de date de bascule (le registre des jours, `jours-track.json`, dit la version de chaque jour servi). Les tests des anciennes versions du
// générateur ont pourtant besoin de jours précis : ces deux jours sont **des données de test** (les jours où les lots 34 et 48/49 devaient entrer en production, ceux de leurs
// golden), pas des règles du jeu. Une version se donne alors explicitement : `dailyCircuit(jour, 0, null, version)`.

/** Premier jour que la production aurait servi avec la v16 (lot 34) : les jours d'avant sont des v15. */
export const JOUR_V16 = daysFromCivil(2026, 10, 28);
/** Premier jour de la v18 des golden (lots 48 et 49) : les jours du 28/10 au 03/11 sont des v16. Aussi l'ancre de la rotation des vedettes (`ANCRE_V18`). */
export const JOUR_V18 = daysFromCivil(2026, 11, 4);

/** La version que les golden et les tests de référence donnent à un jour : 15 avant `JOUR_V16`, 16 avant `JOUR_V18`, la dernière ensuite. */
export const versionDeReference = (day: number): number => (day < JOUR_V16 ? GENERATOR_BEFORE_34 : day < JOUR_V18 ? GENERATOR_BEFORE_48 : GENERATOR_VERSION);

/**
 * Le premier jour que le registre ne nomme pas (le lendemain de son dernier jour) : un jour « absent » qui prend la dernière version. Jamais une date écrite en dur :
 * chaque mise en production ajoute des jours au registre (le 28/10/2026, la première a fait échouer deux tests qui prenaient le 28/10 pour un jour absent).
 */
export const jourAbsentDuRegistre = (): number => parseDay(resumeRegistreTrack().jusqua)! + 1;

