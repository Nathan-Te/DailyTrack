import { DUREE_TICKS, TICKS_PAR_SECONDE } from "./constantes";
import type { Resultat } from "./partie";

// **Le classement de Rush** — le seul endroit qui sait que le jeu se classe au temps (lot K4g : `npm run nouveau-jeu -- --classement temps`). Le prototype (lot BR0) ne garde que cette variante : le temps pour faire tomber
// le golem, en ticks (60 par seconde), le plus court gagne ; une partie perdue (ou qui dépasse dix minutes) vaut le pire temps, `DUREE_TICKS`.

export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}
export interface FicheVariante {
  colonnes: readonly { nom: string; sens: "asc" | "desc" }[];
  unite: "points" | "ticks";
  format: "entier" | "temps";
  bareme: readonly number[];
  plafondDiamant?: number;
}

const idiv = (a: number, b: number): number => Math.trunc(a / b);
const deux = (n: number): string => String(n).padStart(2, "0");

/** Un temps en ticks, écrit `1:23,45` (français) ou `1:23.45` (anglais). */
export function formatTemps(ticks: number, langue: "fr" | "en"): string {
  const cs = idiv(ticks * 100, TICKS_PAR_SECONDE);
  const s = idiv(cs, 100);
  return `${idiv(s, 60)}:${deux(s % 60)}${langue === "fr" ? "," : "."}${deux(cs % 100)}`;
}

export const VARIANTE = {
  nom: "temps" as const,
  /** Ce que la fiche dit du classement et des médailles (vérifié contre `config/jeux/rush.json` par `test/variante.test.ts`). */
  fiche: { colonnes: [{ nom: "temps", sens: "asc" }], unite: "ticks", format: "temps", bareme: [130, 160, 200] } satisfies FicheVariante,
  /** Le score : les colonnes de classement, dans l'ordre de la fiche. */
  score: (r: Pick<Resultat, "victoire" | "ticks">): number[] => [r.victoire ? r.ticks : DUREE_TICKS],
  seuils(bot: Pick<Resultat, "victoire" | "ticks">): Seuils {
    const author = VARIANTE.score(bot)[0]!;
    // Lot BR4 : l'or, l'argent et le bronze sont des pourcentages du Diamant, ceux de la fiche (`medailles.bareme`) — jamais des nombres écrits ailleurs.
    const b = VARIANTE.fiche.bareme;
    return { author, gold: idiv(author * b[0]!, 100), silver: idiv(author * b[1]!, 100), bronze: idiv(author * b[2]!, 100) };
  },
  medaille(score: readonly number[], s: Seuils): Medaille | null {
    for (const m of ["author", "gold", "silver", "bronze"] as const) if ((score[0] ?? DUREE_TICKS) <= s[m]) return m;
    return null;
  },
  formatScore: (score: readonly number[], langue: "fr" | "en"): string => formatTemps(score[0] ?? DUREE_TICKS, langue),
  scorePartage: (score: readonly number[], langue: "fr" | "en"): string => formatTemps(score[0] ?? DUREE_TICKS, langue),
};

/** Le score d'un résultat rejoué, par nom de colonne de la fiche : ce que le serveur classe. */
export function scoreParColonnes(r: Pick<Resultat, "victoire" | "ticks">): Record<string, number> {
  const s = VARIANTE.score(r);
  return Object.fromEntries(VARIANTE.fiche.colonnes.map((c, i) => [c.nom, s[i]!]));
}
