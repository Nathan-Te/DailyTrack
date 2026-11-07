// Les MÉDAILLES (lot B3, refaites aux lots B8 et B8b pour des humains, seed § 5). **Chaque seuil est le score d'un bot de référence arrêté après un nombre fixe de pièces** (`BOTS_DE_REFERENCE`) : la médiane de ce score sur 1 000 jours,
// arrondie. Cela figure une partie de quelques minutes ; la survie sans fin d'un bot (qui ne se fatigue jamais) ne mesure pas un humain. Le Diamant (clé `auteur`, `author`) est le score du bot fort arrêté à 240 pièces : un humain
// qui tient plus longtemps peut le dépasser. **Mêmes seuils tous les jours** d'une version de règles (`SEUILS_MEDAILLES`) : un seuil se retient d'un jour à l'autre. Ce fichier est pur et léger (il est dans le premier chargement
// du jeu) ; les bots sont dans `glouton.ts` et `diamant.ts`, hors de l'index. Les seuils font partie des règles du classement avec les bots : les changer monte `BLOCKS_BOT_VERSION`.
import type { Contenu } from "./generateur";

export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/**
 * Les bots de référence des médailles (lot B8b, seed § 5) : chaque seuil est le score d'un bot **arrêté après un nombre fixe de pièces** (une partie humaine de quelques minutes), pris en médiane sur 1 000 jours ; s'il meurt avant, son
 * score final. « moyen » : `glouton.ts` ; « fort » : le Diamant (`diamant.ts`). **Le point de départ du lot (moyen 45 et 90, fort 150 et 240) a été ajusté par la mesure** (README du lot B8b) : le bot moyen meurt vers 100 pièces
 * (sa médiane ne monte plus après : argent à 90 pièces donnait or / argent = 5), et à 240 pièces le Diamant est 2,6 fois l'or le plus bas qui garde l'argent près d'une partie attentive ; les rapports entre médailles restent entre 1,5 et 2,5.
 */
export const BOTS_DE_REFERENCE = {
  bronze: { bot: "moyen", pieces: 54 },
  silver: { bot: "fort", pieces: 60 },
  gold: { bot: "fort", pieces: 105 },
  author: { bot: "fort", pieces: 210 },
} as const;
/** Le nombre de pièces après lequel le Diamant s'arrête : sa rediffusion (`&bot`, « revoir la partie du Diamant ») s'arrête là aussi. */
export const PIECES_DU_DIAMANT = BOTS_DE_REFERENCE.author.pieces;

/**
 * **Les seuils, les mêmes tous les jours d'une version de règles** (lot B8b) : la médiane sur 1 000 jours (à partir du 2026-11-02, `npm run calibrer:medailles`, README du lot B8b : bronze 1 133, argent 2 168, or 4 921, Diamant 11 573) du score de chaque bot de référence arrêté
 * après son nombre de pièces, arrondie (`arrondir`). Les changer monte `BLOCKS_BOT_VERSION`.
 */
export const SEUILS_MEDAILLES: Readonly<Seuils> = { bronze: 1100, silver: 2200, gold: 4900, author: 11500 };

/** Part du Diamant que valent l'or, l'argent et le bronze, en pour cent, pour mémoire (la fiche, `bareme`, ne porte que cette indication : les seuils sont `SEUILS_MEDAILLES`). */
export const PART_DU_DIAMANT_MEDIAN = {
  gold: Math.round((100 * SEUILS_MEDAILLES.gold) / SEUILS_MEDAILLES.author),
  silver: Math.round((100 * SEUILS_MEDAILLES.silver) / SEUILS_MEDAILLES.author),
  bronze: Math.round((100 * SEUILS_MEDAILLES.bronze) / SEUILS_MEDAILLES.author),
} as const;

/** Un seuil se retient : arrondi au plus proche, à 50 près sous 1 000, à 100 près jusqu'à 5 000, à 500 près au-delà. */
export const arrondir = (n: number): number => {
  const pas = n < 1000 ? 50 : n <= 5000 ? 100 : 500;
  return Math.round(n / pas) * pas;
};

/** Les seuils des médailles : **toujours les mêmes** (`SEUILS_MEDAILLES`), une copie. Un jour figé a ses propres seuils dans son fichier (`seuilsDuJour`, `diamant.ts`). */
export const seuils = (): Seuils => ({ ...SEUILS_MEDAILLES });

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux **figés avec le jour** s'il vient d'un fichier de jour (`Contenu.seuilsFiges`, `jours.ts`), sinon les seuils de la version courante des règles (`SEUILS_MEDAILLES`, les mêmes tous les
 * jours : aucun bot n'est appelé). Le serveur et le jeu passent par cette seule fonction : un changement des seuils (`BLOCKS_BOT_VERSION`) ne change donc jamais un jour déjà figé.
 */
export const seuilsDuJour = (contenu: Pick<Contenu, "seuilsFiges">): Seuils => contenu.seuilsFiges ?? seuils();

/** La médaille d'un score (les colonnes de classement ; la première est le score) : la plus haute dont le seuil est atteint. */
export function medailleDe(score: readonly number[], s: Seuils): Medaille | null {
  const v = score[0] ?? 0;
  return v >= s.author ? "author" : v >= s.gold ? "gold" : v >= s.silver ? "silver" : v >= s.bronze ? "bronze" : null;
}
