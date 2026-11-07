// Les MÉDAILLES (lot B3, refaites au lot B8 pour des humains, seed § 5). **Diamant** = le score du bot Diamant sur la suite du jour (`diamant.ts` ; dans les données la clé reste `auteur`, `author`). **Or, argent, bronze** = les trois
// RÉFÉRENCES de force graduée, mesurées sur 1 000 jours (`npm run calibrer:medailles`, README du lot B8) : le bronze est la médiane du bot faible (`faible.ts`), l'argent la médiane du bot moyen (`glouton.ts`), l'or le 3ᵉ quartile du bot
// moyen (plus bas que le mi-chemin entre le bot moyen et le Diamant, qui est à 19 800). **Ces trois seuils sont les mêmes tous les jours**, arrondis à des nombres qui se retiennent : ce n'est pas un oubli, c'est une mesure — d'un jour à
// l'autre, les scores des trois bots ne sont pas corrélés (Spearman 0,00 entre eux sur 1 000 jours) : l'écart d'un jour à l'autre n'est que du bruit (la mort d'un bot tient à un hasard de la suite), et des seuils « par jour » donneraient un
// bronze qui dépasse 3,7 fois la médiane du bot faible les jours de chance. Seul le Diamant suit le jour (la partie du bot). Ce fichier est pur et léger (il est dans le premier chargement du jeu) ; le calcul du Diamant est dans `diamant.ts` (`seuilsDe`).
// Les références font partie des règles du classement avec le bot : les changer monte `BLOCKS_BOT_VERSION`.
export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/**
 * Les trois seuils de référence, mesurés sur 1 000 jours à partir du 2026-11-02 (README du lot B8) : médiane du bot faible 1 165 → **1 200** ; médiane du bot moyen 7 425 → **7 500** ; 3ᵉ quartile du bot moyen 11 211 → **11 000**
 * (le mi-chemin entre le bot moyen et le Diamant, 19 800, est plus haut : l'or prend le 3ᵉ quartile).
 */
export const REFERENCES_MEDAILLES = { bronze: 1200, silver: 7500, gold: 11000 } as const;

/** Part du Diamant médian (32 142) que valent les références : or, argent, bronze en pour cent, pour mémoire (la fiche, `bareme`, ne porte que cette indication : la règle est `seuilsDepuis`). */
export const PART_DU_DIAMANT_MEDIAN = { gold: 34, silver: 23, bronze: 4 } as const;

/** Un seuil se retient : arrondi vers le bas à 100 près jusqu'à 2 000, à 500 près au-delà. */
export const arrondir = (n: number): number => (n <= 2000 ? Math.floor(n / 100) * 100 : Math.floor(n / 500) * 500);

/**
 * Les seuils d'un jour d'après le score du Diamant (le bot Diamant sur la suite du jour). Bronze, argent et or sont les références ; le Diamant est la partie du bot, arrondie vers le bas (le bot gagne donc toujours son propre Diamant).
 * **Un Diamant faible** (le bot est mort tôt : un jour sur huit environ) **ramène les trois autres sous lui**, sans jamais les monter : or au plus 3/4 du Diamant, argent au plus 3/4 de l'or, bronze au plus la moitié de l'argent, chacun
 * arrondi. Entiers, **strictement croissants** (un Diamant trop petit pour cela, comme celui d'un scénario où rien ne tient, donne des seuils 1, 2, 3, 4 au minimum).
 */
export function seuilsDepuis(diamant: number): Seuils {
  const a = Math.max(4, arrondir(Math.floor(diamant)));
  const gold = Math.max(3, Math.min(REFERENCES_MEDAILLES.gold, arrondir(Math.floor((a * 3) / 4))));
  const silver = Math.max(2, Math.min(REFERENCES_MEDAILLES.silver, arrondir(Math.floor((gold * 3) / 4))));
  const bronze = Math.max(1, Math.min(REFERENCES_MEDAILLES.bronze, arrondir(Math.floor(silver / 2))));
  // Les arrondis ne doivent jamais confondre deux seuils : on remonte du bas vers le haut au besoin.
  const s = Math.max(silver, bronze + 1);
  const g = Math.max(gold, s + 1);
  return { author: Math.max(a, g + 1), gold: g, silver: s, bronze };
}

/** La médaille d'un score (les colonnes de classement ; la première est le score) : la plus haute dont le seuil est atteint. */
export function medailleDe(score: readonly number[], s: Seuils): Medaille | null {
  const v = score[0] ?? 0;
  return v >= s.author ? "author" : v >= s.gold ? "gold" : v >= s.silver ? "silver" : v >= s.bronze ? "bronze" : null;
}
