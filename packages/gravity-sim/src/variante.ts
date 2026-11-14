import { DUREE_MAX_TICKS, TICKS_PAR_SECONDE } from "./constantes";
import type { Resultat } from "./partie";
import type { Medaille, Seuils } from "./types";

// **LA VARIANTE — le seul endroit où « Gravity » sait comment il se classe** (lot K4g, refait au lot GR1). Gravity est un jeu d'arcade au **score, du plus grand au plus petit** ; à score égal, le plus rapide passe devant
// (la durée de la partie en pas, du plus petit au plus grand), puis le premier arrivé (`submitted_at`) et l'identifiant — les départages ultimes de la plateforme. C'est le même esprit que Blocks (score, puis combo) et
// Tower (hauteur, vies, ticks). Les colonnes, l'unité et le barème sont ceux de `config/jeux/gravity.json` : `test/variante.test.ts` vérifie l'accord. Le reste du code (rendu, définition, serveur, essais) ne lit que `VARIANTE`.

export type { Medaille, Seuils };
export interface FicheVariante {
  colonnes: readonly { nom: string; sens: "asc" | "desc" }[];
  unite: "points" | "ticks";
  format: "entier" | "temps";
  bareme: readonly number[];
}
export interface Variante {
  nom: "score";
  /** Ce que la fiche dit du classement et des médailles. */
  fiche: FicheVariante;
  /** Le score : les colonnes de classement, dans l'ordre de la fiche. */
  score(r: Pick<Resultat, "score" | "ticks">): number[];
  /** La médaille d'un score (la première colonne) : la plus haute dont le seuil est atteint. */
  medaille(score: readonly number[], s: Seuils): Medaille | null;
  formatScore(score: readonly number[], langue: "fr" | "en"): string;
  scorePartage(score: readonly number[], langue: "fr" | "en"): string;
}

/** Un nombre en groupes de trois chiffres (`4 582` en français, `4,582` en anglais) — sans `toLocaleString` (qui dépend de la plateforme). */
export function grouper(n: number, langue: "fr" | "en"): string {
  const t = String(Math.trunc(Math.abs(n)));
  let sortie = "";
  for (let i = 0; i < t.length; i++) {
    if (i > 0 && (t.length - i) % 3 === 0) sortie += langue === "fr" ? " " : ",";
    sortie += t[i];
  }
  return n < 0 ? `-${sortie}` : sortie;
}

/** La durée d'une partie en `m:ss`. */
export const dureeEnTexte = (ticks: number): string => {
  const s = Math.trunc(ticks / TICKS_PAR_SECONDE);
  return `${Math.trunc(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const VARIANTE: Variante = {
  nom: "score",
  fiche: { colonnes: [{ nom: "score", sens: "desc" }, { nom: "ticks", sens: "asc" }], unite: "points", format: "entier", bareme: [] },
  score: (r) => [r.score, Math.min(r.ticks, DUREE_MAX_TICKS)],
  medaille(score, s) {
    for (const m of ["author", "gold", "silver", "bronze"] as const) if ((score[0] ?? 0) >= s[m]) return m;
    return null;
  },
  formatScore: (score, langue) => grouper(score[0] ?? 0, langue),
  scorePartage: (score, langue) => grouper(score[0] ?? 0, langue),
};

/** Le score d'un résultat rejoué, par nom de colonne de la fiche : ce que le serveur classe. */
export function scoreParColonnes(r: Pick<Resultat, "score" | "ticks">, v: Variante = VARIANTE): Record<string, number> {
  const s = v.score(r);
  return Object.fromEntries(v.fiche.colonnes.map((c, i) => [c.nom, s[i]!]));
}
