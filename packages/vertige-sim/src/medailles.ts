import { DUREE_MAX_TICKS } from "./constantes";
import { idiv } from "./trigo";

// Les médailles (lot V3) : **le Diamant est le temps du robot** (les solutions des modules du niveau du jour, jouées bout à bout), et l'or, l'argent et le bronze sont des pourcentages de ce temps, ceux de `medailles.bareme` de la fiche
// (convention `pourcentage-diamant` de la plateforme, comme Rush : [or, argent, bronze] = [130, 160, 200] % du temps du robot). Le barème est un PARAMÈTRE RÉGLABLE : Nathan le règle dans la fiche (`config/jeux/vertige.json`), puis
// `npm run fiches` ; ce fichier le lit dans `VARIANTE.fiche.bareme` (copie vérifiée contre la fiche par `variante.test.ts`). Un humain peut battre le robot : son temps est alors un Diamant, comme pour Track et Jump.
// **Un jour figé garde les seuils qu'on a servis** (`seuilsFiges` du contenu, écrits dans le fichier du jour) : changer le barème ne change jamais un jour déjà figé.
export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/** Des seuils valides : quatre entiers positifs, strictement croissants (Diamant < or < argent < bronze), le bronze sous la durée maximale (au-delà, une partie perdue aurait une médaille). */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { author, gold, silver, bronze } = s as Seuils;
  return [author, gold, silver, bronze].every((n) => Number.isSafeInteger(n) && n >= 1) && author < gold && gold < silver && silver < bronze && bronze < DUREE_MAX_TICKS;
};

/** Les seuils d'un temps du robot et d'un barème [or, argent, bronze] en pour cent du Diamant. Le bronze est plafonné juste sous la durée maximale, en restant strictement croissant. */
export function seuilsDeTemps(ticksRobot: number, bareme: readonly number[]): Seuils {
  const bronze = Math.min(idiv(ticksRobot * bareme[2]!, 100), DUREE_MAX_TICKS - 1);
  const silver = Math.min(idiv(ticksRobot * bareme[1]!, 100), bronze - 1);
  const gold = Math.min(idiv(ticksRobot * bareme[0]!, 100), silver - 1);
  return { author: ticksRobot, gold, silver, bronze };
}

/** La médaille d'un score (le temps, en pas) : la plus haute dont le seuil est atteint ; une partie perdue (le pire temps) n'en a jamais. */
export function medailleDeScore(score: readonly number[], s: Seuils): Medaille | null {
  const t = score[0] ?? DUREE_MAX_TICKS;
  if (t >= DUREE_MAX_TICKS) return null;
  for (const m of ["author", "gold", "silver", "bronze"] as const) if (t <= s[m]) return m;
  return null;
}
