import { daysFromCivil, formatDay } from "@cdj/core";
import { GENERATOR_VERSION } from "./constants";
import type { ThemeName } from "./themes";

// Versions et identifiants des circuits du jour (lots 14 et 34) : dans leur propre fichier (lot 36), le jeu en a besoin dès le premier écran (identifiant du
// circuit, version d'un jour passé) alors que le générateur (`generator.ts`) n'est calculé que dans un fil de travail.

/** Plus grand numéro de variante accepté (lot 14) : au-delà, la graine déborderait sur celle des tentatives. */
export const MAX_VARIANT = 99;

/** Vrai pour un numéro de variante valide : entier de 0 à `MAX_VARIANT`. */
export const isVariant = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_VARIANT;

/**
 * Lot 34 — **date de bascule** : les règles « freinage possible après un boost » (générateur v16) valent à partir du **28/10/2026**, le
 * premier jour qui n'est ni passé, ni en cours, ni déjà joué à la mise en production du lot ; les jours d'avant gardent le générateur v15,
 * bit pour bit (texte, temps de l'auteur, identifiant `jour-…-g15` : classements, rediffusions et records intacts). **Versionnement par
 * date** : la version d'un jour est `generatorVersionOf(jour)`, dans son identifiant ; le Salon (graines au-delà de tous les jours) suit
 * toujours la dernière. Déplacer la bascule (mise en production plus tardive) : cette constante, puis `UPDATE_GOLDEN=1` sur `golden-daily.test.ts`.
 */
export const BASCULE_LOT_34 = daysFromCivil(2026, 10, 28);
/** Générateur des jours d'avant la bascule du lot 34. */
export const GENERATOR_BEFORE_34 = 15;

/** Version du générateur qui a fait (ou fera) le circuit de ce jour (ou de cette graine du Salon) : 15 avant la bascule du lot 34, la dernière ensuite. */
export const generatorVersionOf = (day: number): number => (day < BASCULE_LOT_34 ? GENERATOR_BEFORE_34 : GENERATOR_VERSION);

/**
 * Identifiant du circuit d'un jour. La variante 0 (le circuit d'origine) n'a pas de suffixe : les circuits d'avant le lot 14
 * gardent leur identifiant (rediffusions et références inchangées) ; une variante n ≥ 1 ajoute `-v<n>`. Un thème imposé
 * (essais, ou remplacement du planning) ajoute son nom : un autre circuit.
 */
export function dailyTrackId(day: number, theme?: ThemeName | null, variant = 0, generator = generatorVersionOf(day)): string {
  return `jour-${formatDay(day)}-g${generator}${variant > 0 ? `-v${variant}` : ""}${theme ? `-${theme}` : ""}`;
}
