import { BAREME_DE_LA_FICHE } from "./medailles";
import type { Resultat } from "./partie";

// LA VARIANTE de Blocks : `score` (lot B1). Le seul endroit qui sait comment ce jeu se classe : le score ↓, puis le combo maximal ↓, puis le premier arrivé (les deux départages ultimes de toute table :
// `submitted_at`, `player_id`, sont ceux de la plateforme). `test/variante.test.ts` vérifie l'accord avec `config/jeux/blocks.json`.
export type NomVariante = "score";

export interface FicheVariante {
  colonnes: readonly { nom: string; sens: "asc" | "desc" }[];
  unite: "points";
  format: "entier";
  /** Or, argent et bronze en pour cent du Diamant médian, dans cet ordre (le `bareme` de la fiche, à titre d'indication : les seuils sont `medailles.seuils` de la fiche, lus par `medailles.ts`). */
  bareme: readonly number[];
}
export interface Variante {
  nom: NomVariante;
  /** Ce que la fiche dit du classement. */
  fiche: FicheVariante;
  /** Le score : les colonnes de classement, dans l'ordre de la fiche. */
  score(r: Pick<Resultat, "score" | "combo">): number[];
}

const SCORE: Variante = {
  nom: "score",
  fiche: { colonnes: [{ nom: "score", sens: "desc" }, { nom: "combo", sens: "desc" }], unite: "points", format: "entier", bareme: BAREME_DE_LA_FICHE },
  score: (r) => [r.score, r.combo],
};

export const VARIANTES: Readonly<Record<NomVariante, Variante>> = { score: SCORE };
export const VARIANTE_NOM: NomVariante = "score";
export const VARIANTE: Variante = VARIANTES[VARIANTE_NOM];

/** Le score d'un résultat rejoué, par nom de colonne de la fiche : ce que le serveur classe. */
export function scoreParColonnes(r: Pick<Resultat, "score" | "combo">, v: Variante = VARIANTE): Record<string, number> {
  const s = v.score(r);
  return Object.fromEntries(v.fiche.colonnes.map((c, i) => [c.nom, s[i]!]));
}
