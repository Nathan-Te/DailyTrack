// Les MÉDAILLES (lot B3, refaites aux lots B8, B8b et B8c pour des humains, seed § 5). **Chaque seuil est le score d'un bot de référence arrêté après un nombre fixe de pièces** (`BOTS_DE_REFERENCE`) : la médiane de ce score sur 1 000 jours,
// arrondie. Cela figure une partie de quelques minutes ; la survie sans fin d'un bot (qui ne se fatigue jamais) ne mesure pas un humain. Le Diamant (clé `auteur`, `author`) est le score du bot fort arrêté à 180 pièces : un humain
// qui tient plus longtemps peut le dépasser. **Mêmes seuils tous les jours** d'une version de règles : un seuil se retient d'un jour à l'autre.
// **Lot B8c : les seuils sont une DONNÉE de la fiche du jeu** (`config/jeux/blocks.json`, `medailles.seuils` : bronze, argent, or, diamant), lue ici par le jeu et par le serveur — Nathan les retouche en une ligne, puis `npm run fiches`, sans toucher
// au code ni changer de version du bot. Ce fichier est pur et léger (il est dans le premier chargement du jeu) ; les bots (qui les mesurent) sont dans `glouton.ts` et `diamant.ts`, hors de l'index.
import fiche from "../../../config/jeux/blocks.json" with { type: "json" };
import type { Contenu } from "./generateur";

export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/**
 * Les bots de référence des médailles (lot B8c, seed § 5) : chaque seuil est le score d'un bot **arrêté après un nombre fixe de pièces** (une partie humaine de quelques minutes), pris en médiane sur 1 000 jours ; s'il meurt avant, son
 * score final. « moyen » : `glouton.ts` ; « fort » : le Diamant (`diamant.ts`). Le bronze figure une partie de 3 à 4 minutes (30 pièces), l'argent une partie de 6 à 8 minutes (60 pièces) : le bot moyen y est un repère honnête d'un joueur
 * expérimenté (README du lot B8c). **Ces nombres servent à CALCULER les seuils de la fiche** (`npm run calibrer:medailles`) ; le jeu et le serveur lisent la fiche, pas ces bots.
 */
export const BOTS_DE_REFERENCE = {
  bronze: { bot: "moyen", pieces: 36 },
  silver: { bot: "moyen", pieces: 60 },
  gold: { bot: "fort", pieces: 90 },
  author: { bot: "fort", pieces: 165 },
} as const;
/** Le nombre de pièces après lequel le Diamant s'arrête : sa rediffusion (`&bot`, « revoir la partie du Diamant ») s'arrête là aussi. */
export const PIECES_DU_DIAMANT = BOTS_DE_REFERENCE.author.pieces;

/** Des seuils valides : quatre entiers positifs, strictement croissants. */
export const seuilsSontValides = (s: Seuils): boolean => [s.bronze, s.silver, s.gold, s.author].every((n) => Number.isSafeInteger(n) && n >= 1) && s.bronze < s.silver && s.silver < s.gold && s.gold < s.author;

/** Les seuils de la fiche (`medailles.seuils` : bronze, argent, or, diamant) lus comme des `Seuils` ; une fiche aux seuils invalides arrête le jeu et le serveur tout de suite. */
function lireSeuilsDeLaFiche(brut: { bronze: number; argent: number; or: number; diamant: number }): Seuils {
  const s: Seuils = { bronze: brut.bronze, silver: brut.argent, gold: brut.or, author: brut.diamant };
  if (!seuilsSontValides(s)) throw new Error("fiche de Blocks : medailles.seuils doit donner quatre entiers strictement croissants (bronze, argent, or, diamant)");
  return s;
}

/** **Les seuils, les mêmes tous les jours d'une version de règles** : la donnée `medailles.seuils` de la fiche du jeu. Un jour figé a les siens dans son fichier (`seuilsDuJour`). */
export const SEUILS_MEDAILLES: Readonly<Seuils> = lireSeuilsDeLaFiche(fiche.medailles.seuils);
/** Le `bareme` de la fiche (or, argent, bronze en pour cent du Diamant) : une INDICATION de la dernière calibration, que la plateforme exige (`pourcentage-diamant`) mais que ni le jeu ni le serveur ne lisent — retoucher les seuils n'oblige pas à le retoucher. */
export const BAREME_DE_LA_FICHE: readonly number[] = fiche.medailles.bareme;

/** Un seuil se retient : arrondi au plus proche, à 50 près sous 1 000, à 100 près jusqu'à 5 000, à 500 près au-delà. */
export const arrondir = (n: number): number => {
  const pas = n < 1000 ? 50 : n <= 5000 ? 100 : 500;
  return Math.round(n / pas) * pas;
};

/** Les seuils des médailles : **toujours les mêmes** (`SEUILS_MEDAILLES`), une copie. Un jour figé a ses propres seuils dans son fichier (`seuilsDuJour`, `diamant.ts`). */
export const seuils = (): Seuils => ({ ...SEUILS_MEDAILLES });

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux **figés avec le jour** s'il vient d'un fichier de jour (`Contenu.seuilsFiges`, `jours.ts`), sinon ceux de la fiche (`SEUILS_MEDAILLES`, les mêmes tous
 * les jours : aucun bot n'est appelé). Le serveur et le jeu passent par cette seule fonction : un changement des seuils de la fiche ne change donc jamais un jour déjà figé.
 */
export const seuilsDuJour = (contenu: Pick<Contenu, "seuilsFiges">): Seuils => contenu.seuilsFiges ?? seuils();

/** La médaille d'un score (les colonnes de classement ; la première est le score) : la plus haute dont le seuil est atteint. */
export function medailleDe(score: readonly number[], s: Seuils): Medaille | null {
  const v = score[0] ?? 0;
  return v >= s.author ? "author" : v >= s.gold ? "gold" : v >= s.silver ? "silver" : v >= s.bronze ? "bronze" : null;
}
