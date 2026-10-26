import { formatDay, parseDay } from "@cdj/core";
import { GENERATOR_VERSION } from "./constants";
import registre from "./jours-track.json";
import type { ThemeName } from "./themes";

// Versions et identifiants des circuits du jour (lots 14 et 34) : dans leur propre fichier (lot 36), le jeu en a besoin dès le premier écran (identifiant du
// circuit, version d'un jour passé) alors que le générateur (`generator.ts`) n'est calculé que dans un fil de travail.

/** Plus grand numéro de variante accepté (lot 14) : au-delà, la graine déborderait sur celle des tentatives. */
export const MAX_VARIANT = 99;

/** Vrai pour un numéro de variante valide : entier de 0 à `MAX_VARIANT`. */
export const isVariant = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_VARIANT;

/**
 * Lot R11 — **le registre des jours** (`jours-track.json`) : pour chaque jour **protégé**, la version du générateur (`g`) et celle de la simulation (`sim`) qui ont fait son
 * circuit, en plages `du`–`au` de jours consécutifs de même version. Sont protégés : les jours d'avant le lancement public, les jours qui ont au moins un résultat en
 * production (Track ou Jump) et ceux que le registre nommait déjà ; **un jour sans résultat n'y est pas** (il n'a pas été « servi » : la mise en production le régénère avec
 * son code). **Plus aucune date de bascule écrite par un lot** : le fichier est écrit par « Mettre en production » (job `figer`, avec le code alors en production, jusqu'à la
 * veille du jour de bascule) et versé dans `main` par la PR « Jours figés », comme les niveaux de Jump. Un jour du registre garde sa version pour toujours ; **un jour absent**
 * (jour sans résultat, jour de bascule et suivants, le Salon) **prend la dernière** (`GENERATOR_VERSION`). Changer le générateur = monter `GENERATOR_VERSION`
 * (constants.ts) et **garder l'ancienne version dans le code tant qu'un jour du registre s'en sert**.
 */
export interface RegistreJoursTrack {
  format: 1;
  /** Dernier jour que la dernière mise en production a décidé (AAAA-MM-JJ) : la veille de son jour de bascule. Un jour au-delà prend la dernière version. */
  jusqua: string;
  plages: { du: string; au: string; g: number; sim: number }[];
}
const REGISTRE = registre as RegistreJoursTrack;
/** Les plages du registre en numéros de jours (calculées au premier besoin). */
let plages: { du: number; au: number; g: number }[] | null = null;

/** La plus ancienne version du générateur que le code sait encore faire (`composeFigures` & co. : `generator >= 16`, `>= 17`, `>= 18` ; la v15 est la base). Le registre ne peut pas la dépasser vers le bas. */
export const OLDEST_GENERATOR = 15;
/** Générateur ayant servi les versions 15 à 17, que le registre peut nommer (leur code reste dans `generator.ts` et `themesVersion.ts`) ; v15 : avant le 28/10/2026. */
export const GENERATOR_BEFORE_34 = 15;
/** v16 : freinage possible après un boost (lot 34), les jours du 28/10/2026 que la production a servis avec elle. */
export const GENERATOR_BEFORE_48 = 16;
/** v17 : l'herbe de course (lot 48) ; aucun jour n'a été servi avec elle tant que le registre ne la nomme pas. */
export const GENERATOR_BEFORE_49 = 17;

/** Version du générateur qui a fait (ou fera) le circuit de ce jour (ou de cette graine du Salon) : celle du registre pour un jour protégé, la dernière sinon. */
export const generatorVersionOf = (day: number): number => {
  plages ??= REGISTRE.plages.map((p) => ({ du: parseDay(p.du) ?? 0, au: parseDay(p.au) ?? 0, g: p.g }));
  return plages.find((p) => day >= p.du && day <= p.au)?.g ?? GENERATOR_VERSION;
};

/**
 * Identifiant du circuit d'un jour. La variante 0 (le circuit d'origine) n'a pas de suffixe : les circuits d'avant le lot 14
 * gardent leur identifiant (rediffusions et références inchangées) ; une variante n ≥ 1 ajoute `-v<n>`. Un thème imposé
 * (essais, ou remplacement du planning) ajoute son nom : un autre circuit.
 */
export function dailyTrackId(day: number, theme?: ThemeName | null, variant = 0, generator = generatorVersionOf(day)): string {
  return `jour-${formatDay(day)}-g${generator}${variant > 0 ? `-v${variant}` : ""}${theme ? `-${theme}` : ""}`;
}
