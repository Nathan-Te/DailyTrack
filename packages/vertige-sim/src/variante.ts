import { DUREE_MAX_TICKS, TICKS_PAR_SECONDE } from "./constantes";
import { tempsDe, type Resultat } from "./partie";
import { idiv } from "./trigo";

// **LA VARIANTE — le seul endroit où « Vertige » sait comment il se classe** : au temps, le plus court d'abord (une colonne, `temps`, en pas de 1/120 s). Le reste du code (rendu, définition, serveur, essais, e2e)
// ne lit que `VARIANTE`. `test/variante.test.ts` la vérifie contre `config/jeux/vertige.json`. Les médailles (le Diamant du robot) viennent après le prototype : `bareme` n'est lu par personne avant le lot V3.

export type NomVariante = "temps";
export const VARIANTE_NOM: NomVariante = "temps";

/** Un temps en pas, écrit « 83,475 s » ou « 1:23,475 » (le millième est tronqué). */
export function ecrireTemps(ticks: number, langue: "fr" | "en"): string {
  const ms = idiv(ticks * 1000, TICKS_PAR_SECONDE);
  const s = idiv(ms, 1000);
  const mil = String(ms % 1000).padStart(3, "0");
  const sep = langue === "fr" ? "," : ".";
  return s >= 60 ? `${idiv(s, 60)}:${String(s % 60).padStart(2, "0")}${sep}${mil}` : `${s}${sep}${mil} s`;
}

export const VARIANTE = {
  nom: VARIANTE_NOM,
  fiche: { colonnes: [{ nom: "temps", sens: "asc" as const }], unite: "ticks" as const, format: "temps" as const, bareme: [130, 160, 200] as readonly number[] },
  /** Le score : les colonnes de classement, dans l'ordre de la fiche. */
  score: (r: Pick<Resultat, "arrive" | "ticks">): number[] => [tempsDe(r)],
  formatScore: (score: readonly number[], langue: "fr" | "en"): string => ecrireTemps(score[0] ?? DUREE_MAX_TICKS, langue),
  scorePartage: (score: readonly number[], langue: "fr" | "en"): string => ecrireTemps(score[0] ?? DUREE_MAX_TICKS, langue),
};

/** Le score d'un résultat rejoué, par nom de colonne de la fiche : ce que le serveur classe. */
export function scoreParColonnes(r: Pick<Resultat, "arrive" | "ticks">): Record<string, number> {
  const s = VARIANTE.score(r);
  return Object.fromEntries(VARIANTE.fiche.colonnes.map((c, i) => [c.nom, s[i]!]));
}
