import { mixSeed, Rng } from "@cdj/core";
import { BOITES33_PAR_SERIE, CASES_PIECE_GROSSE, DOMINOS_PAR_SERIE, PLAFOND_PIECES, RAMPE_PAR_DEFAUT, REGLAGE_PAR_DEFAUT, type Rampe, type ReglageSaisi, type ReglageTirage, SERIES_SANS_TRES_GROSSE, TAILLE_SERIE } from "./constantes";
import { estVide, type Grille } from "./grille";
import { completeUneLigne, piecesPosables } from "./ordre";
import { PIECES, type Piece } from "./pieces";

// LE TIRAGE DU JOUR (lot B8, tirage v4 ; lot B8b, tirage v5 : une suite variée ; **lot B8c, tirage v6 : adapté à la grille**, seed § 4). On reçoit des SÉRIES de trois pièces. La série de rang `s` est tirée de trois choses, et de rien d'autre :
// la graine du jour, son rang et **la grille au moment où elle arrive** (après la dernière pose de la série d'avant et ses effacements). Il est déterministe : mêmes coups, mêmes pièces — le serveur rejoue la partie et retire chaque
// série depuis la grille rejouée. **Jamais d'heure, de `Math.random` ni d'état caché.**
//
// Méthode, par essais successifs : (1) on tire une série CANDIDATE avec les poids et les règles de série de B8b (au plus un domino, jamais deux fois la même pièce, au moins une pièce de 4 cases ou plus, au plus une boîte de 3 × 3, rien de très
// gros dans les deux premières séries ; poids de base de `pieces.ts` et rampe) ; (2) on l'accepte si elle respecte les EXIGENCES du rang ; (3) sinon on retire, jusqu'à `essais` essais (40), puis on garde la meilleure candidate. Le générateur
// de l'essai `k` est `Rng(mixSeed(mixSeed(graine, 2 × rang + 1), 3k + j))` pour sa pièce `j` : (graine, rang, k), jamais autre chose. Les exigences sont :
//   · **1, série posable** : les trois pièces se posent toutes dans au moins un ordre (les effacements entre deux poses comptés : `ordre.ts`) ; exigée avec une probabilité qui baisse le long de la rampe (100 % jusqu'à la série 25, puis une baisse
//     linéaire jusqu'à 0 % à la série 75 : c'est ce qui fait finir toute partie, README du lot B8c), tirée de (graine, rang) ;
//   · **2, coup de pouce** : une pièce de la série, posée seule, complète une ligne ou une colonne de la grille ; exigée avec une probabilité de 60 % qui baisse jusqu'à 30 % à la série 80, tirée de (graine, rang) ; jamais sur une grille vide.
// La première série d'un jour est la même pour tous (grille vide : aucune exigence 2). Les probabilités et le nombre d'essais se règlent (`?debug&tune`) : `ReglageTirage`, `constantes.ts`.
//
// La RAMPE s'applique au rang de la série : le poids d'une pièce de grosseur `g > 0` (4 cases : 1, 5 cases : 2, 6 cases ou plus : 3) vaut `poids × (ECHELLE + pente × g × min(rangDeSérie, rangMax))`. Il augmente donc de façon monotone avec la série ;
// les pièces de 1 à 3 cases gardent un poids fixe. Après `rangMax` la rampe ne s'arrête pas : elle monte de `apres` (0,5) au lieu de `pente` (1), pour qu'aucune partie ne dure sans fin. **Aucune cible de survie d'un bot ne pilote les poids** (lot B8b).

const ECHELLE = 100;

/** La graine d'un jour : un nombre de 32 bits tiré du numéro du jour. */
const SEL = 0x0b10c5;
export const graineDuJour = (jour: number): number => mixSeed(jour, SEL);

/** Le poids d'une pièce dans la série de rang `serie`, ou 0 si une règle de série l'écarte. `deja` : les pièces déjà tirées dans cette série (de 0 à 2). Entier. */
export function poidsDeSerie(p: Piece, serie: number, deja: readonly Piece[] = [], rampe: Rampe = RAMPE_PAR_DEFAUT): number {
  if (serie < SERIES_SANS_TRES_GROSSE && p.tresGrosse) return 0;
  if (p.boite33 && deja.filter((x) => x.boite33).length >= BOITES33_PAR_SERIE) return 0;
  if (p.famille === "petite" && deja.filter((x) => x.famille === "petite").length >= DOMINOS_PAR_SERIE) return 0;
  if (deja.some((x) => x.id === p.id)) return 0;
  // La dernière pièce d'une série qui n'a encore aucune pièce de 4 cases ou plus en est une.
  if (deja.length === TAILLE_SERIE - 1 && p.cases < CASES_PIECE_GROSSE && !deja.some((x) => x.cases >= CASES_PIECE_GROSSE)) return 0;
  return Math.round(p.poids * (ECHELLE + p.grosseur * (rampe.pente * Math.min(serie, rampe.rangMax) + (rampe.apres ?? 0) * Math.max(0, serie - rampe.rangMax))));
}

/** La pièce `j` de la série candidate `essai` du rang `serie` : un seul tirage pondéré, parmi les pièces que les règles de série laissent. `deja` : les pièces d'avant dans la série candidate. */
export function pieceDeSerie(graine: number, serie: number, essai: number, j: number, deja: readonly Piece[], rampe: Rampe = RAMPE_PAR_DEFAUT): Piece {
  let total = 0;
  for (const p of PIECES) total += poidsDeSerie(p, serie, deja, rampe);
  let reste = new Rng(mixSeed(mixSeed(graine, 2 * serie + 1), essai * TAILLE_SERIE + j)).int(total);
  for (const p of PIECES) {
    const w = poidsDeSerie(p, serie, deja, rampe);
    if (reste < w) return p;
    reste -= w;
  }
  throw new Error("suite : tirage hors des poids"); // inatteignable : reste < total
}

/** La série candidate de l'essai `essai` (trois pièces), sans regarder la grille. */
export function serieCandidate(graine: number, serie: number, essai: number, rampe: Rampe = RAMPE_PAR_DEFAUT): Piece[] {
  const out: Piece[] = [];
  for (let j = 0; j < TAILLE_SERIE; j++) out.push(pieceDeSerie(graine, serie, essai, j, out, rampe));
  return out;
}

/** Un réglage complet : celui du jeu, avec ce que `saisi` en change. */
export function resoudreReglage(saisi?: ReglageSaisi): ReglageTirage {
  const d = REGLAGE_PAR_DEFAUT;
  return {
    rampe: { ...d.rampe, ...saisi?.rampe },
    essais: saisi?.essais ?? d.essais,
    posable: { ...d.posable, ...saisi?.posable },
    pouce: { ...d.pouce, ...saisi?.pouce },
  };
}
/** Ce réglage est-il celui du jeu ? Un contenu réglé autrement est un essai (jamais classé). */
export const reglageEstCeluiDuJeu = (saisi?: ReglageSaisi): boolean => JSON.stringify(resoudreReglage(saisi)) === JSON.stringify(REGLAGE_PAR_DEFAUT);

/** Baisse en ligne droite de `debut` % (jusqu'au rang `de`) à `fin` % (au rang `a`), puis `fin` %. Entier. */
const baisse = (rang: number, de: number, a: number, debut: number, fin: number): number => {
  if (rang <= de || a <= de) return rang <= de ? debut : fin;
  if (rang >= a) return fin;
  return debut - Math.floor(((debut - fin) * (rang - de)) / (a - de));
};
/** La part (en %) des séries du rang `rang` pour lesquelles l'exigence 1 (série posable) est exigée. */
export const partPosable = (rang: number, r: ReglageTirage = REGLAGE_PAR_DEFAUT): number => baisse(rang, r.posable.jusqua, r.posable.rang, 100, r.posable.pct);
/** La part (en %) des séries du rang `rang` pour lesquelles l'exigence 2 (coup de pouce) est exigée. */
export const partPouce = (rang: number, r: ReglageTirage = REGLAGE_PAR_DEFAUT): number => baisse(rang, 0, r.pouce.rang, r.pouce.pct, r.pouce.pctFin);

/** Ce que le tirage d'une série a décidé : les pièces, et de quoi mesurer le tirage (jamais classé). */
export interface Tirage {
  pieces: Piece[];
  /** L'essai gardé (0 = la première candidate). */
  essai: number;
  /** Les exigences de ce rang, tirées de (graine, rang). */
  exige1: boolean;
  exige2: boolean;
  /** Combien des trois pièces se posent (dans le meilleur ordre), si l'exigence 1 a été vérifiée (sinon 3) ; et le coup de pouce, si l'exigence 2 a été vérifiée. */
  posables: number;
  pouce: boolean;
}

/** La qualité d'une candidate : l'exigence 1 d'abord (le nombre de pièces qui se posent), puis le coup de pouce. 7 = tout est tenu. */
const qualite = (posables: number, pouce: boolean): number => posables * 2 + (pouce ? 1 : 0);
const QUALITE_MAX = TAILLE_SERIE * 2 + 1;

/**
 * **La série de rang `serie`, tirée pour cette grille** (voir l'en-tête). Rend les pièces et ce qui a été décidé. `reglage` : celui du jeu, sauf essai (`?debug&tune`).
 */
export function tirerSerie(graine: number, serie: number, grille: Grille, reglage: ReglageTirage = REGLAGE_PAR_DEFAUT): Tirage {
  const exig = new Rng(mixSeed(mixSeed(graine, 2 * serie), 0xe5));
  const exige1 = exig.int(100) < partPosable(serie, reglage);
  const exige2 = exig.int(100) < partPouce(serie, reglage) && !estVide(grille);
  let meilleur: Tirage | null = null;
  let meilleureQualite = -1;
  for (let essai = 0; essai < Math.max(1, reglage.essais); essai++) {
    const pieces = serieCandidate(graine, serie, essai, reglage.rampe);
    const posables = exige1 ? piecesPosables(grille, pieces) : TAILLE_SERIE;
    // Le coup de pouce ne se cherche que si l'exigence 1 est tenue (sinon la candidate est de toute façon moins bonne qu'une qui la tient).
    const pouce = exige2 && posables === TAILLE_SERIE ? completeUneLigne(grille, pieces) : !exige2;
    const q = qualite(posables, pouce);
    if (q > meilleureQualite) {
      meilleureQualite = q;
      meilleur = { pieces, essai, exige1, exige2, posables, pouce };
      if (q === QUALITE_MAX) break;
    }
  }
  return meilleur!;
}

/**
 * Les pièces de la série `serie` pour cette grille, au plus `n` pièces posées en tout (le plafond de 2 000 pièces coupe la dernière série : elle n'a que deux pièces).
 * Les séries d'avant `serie` n'entrent pour rien : seule la grille compte.
 */
export function serieAuRang(graine: number, serie: number, grille: Grille, reglage: ReglageTirage = REGLAGE_PAR_DEFAUT, n: number = PLAFOND_PIECES): Piece[] {
  if (serie * TAILLE_SERIE >= n) return [];
  return tirerSerie(graine, serie, grille, reglage).pieces.slice(0, n - serie * TAILLE_SERIE);
}
