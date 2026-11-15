import { mixSeed, Rng } from "@cdj/core";

// Les quatre thèmes de Pinball (lot PB1) : `foire`, `ocean`, `espace`, `volcan`. Au PB1 ils ne changent que le nom et les couleurs de la table (les éléments propres à chaque thème et les missions sont du lot PB3).
// **La règle du jour est propre au jeu**, comme celle de Rush : le sac de thèmes commun (`@cdj/core/sacThemes`) exige au moins cinq thèmes, Pinball en a quatre.
//   · Les jours se découpent en CYCLES de quatre, alignés sur le numéro de jour civil (aucune date écrite) ; dans un cycle, chaque thème sort une fois, dans un ordre tiré de la graine du cycle.
//   · **Jamais deux jours de suite le même thème, jonction comprise** : si le premier thème d'un cycle est le dernier du cycle d'avant, il échange sa place avec le deuxième. Le dernier thème d'un cycle
//     n'est jamais touché par cet échange, donc un cycle ne dépend que du tirage du cycle d'avant, jamais de toute l'histoire : le thème d'un jour se calcule seul, sans état.
export const THEMES_PINBALL = ["foire", "ocean", "espace", "volcan"] as const;
export type ThemePinball = (typeof THEMES_PINBALL)[number];

const SEL_THEME = 0x91b7a3;
const NB = THEMES_PINBALL.length;

/** Le tirage brut d'un cycle : une permutation des quatre thèmes, de sa graine seule. */
const tirage = (k: number): number[] => new Rng(mixSeed(k, SEL_THEME)).shuffle([0, 1, 2, 3]);

/** L'ordre d'un cycle, après l'échange de jonction. */
function ordreDuCycle(k: number): number[] {
  const o = tirage(k);
  if (o[0] === tirage(k - 1)[NB - 1]) [o[0], o[1]] = [o[1]!, o[0]!];
  return o;
}

/** Le thème d'un jour (numéro de jour civil). Pur, sans état. */
export function themeDuJour(jour: number): ThemePinball {
  const k = Math.floor(jour / NB);
  return THEMES_PINBALL[ordreDuCycle(k)[jour - k * NB]!]!;
}
