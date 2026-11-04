// Les MÉDAILLES (lot B3, seed § 5). **Diamant** = le score du bot Diamant sur la suite du jour (`diamant.ts` ; dans les données la clé reste `auteur`, `author`). **Or, argent, bronze** = des fractions ENTIÈRES du Diamant
// (en pour cent), les mêmes tous les jours : `FRACTIONS_MEDAILLES`, calibrées sur 1 000 jours (`npm run calibrer:medailles`, README du lot B3). Ce fichier est pur et léger (il est dans le premier chargement du jeu) ;
// le calcul du Diamant, lui, est dans `diamant.ts` (`seuilsDe`), chargé avec le corps du jeu et par le serveur. Les fractions font partie des règles du classement avec le bot : les changer monte `BLOCKS_BOT_VERSION`.
export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/** Or, argent et bronze, en pour cent du Diamant (= le `bareme` de la fiche, dans cet ordre). */
export const FRACTIONS_MEDAILLES = { gold: 60, silver: 20, bronze: 8 } as const;

/** Les seuils d'un jour d'après le score du Diamant. Entiers, **strictement croissants** : bronze < argent < or < Diamant (un Diamant trop petit pour cela donne des seuils 1, 2, 3, 4 au minimum). */
export function seuilsDepuis(diamant: number): Seuils {
  const d = Math.max(4, Math.floor(diamant));
  const bronze = Math.max(1, Math.floor((d * FRACTIONS_MEDAILLES.bronze) / 100));
  const silver = Math.max(bronze + 1, Math.floor((d * FRACTIONS_MEDAILLES.silver) / 100));
  const gold = Math.max(silver + 1, Math.floor((d * FRACTIONS_MEDAILLES.gold) / 100));
  return { author: Math.max(d, gold + 1), gold, silver, bronze };
}

/** La médaille d'un score (les colonnes de classement ; la première est le score) : la plus haute dont le seuil est atteint. */
export function medailleDe(score: readonly number[], s: Seuils): Medaille | null {
  const v = score[0] ?? 0;
  return v >= s.author ? "author" : v >= s.gold ? "gold" : v >= s.silver ? "silver" : v >= s.bronze ? "bronze" : null;
}
