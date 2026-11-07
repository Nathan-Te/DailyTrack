import { mixSeed, Rng } from "@cdj/core";
import { BOITES33_PAR_SERIE, CASES_PIECE_GROSSE, DOMINOS_PAR_SERIE, PLAFOND_PIECES, RAMPE_PAR_DEFAUT, type Rampe, SERIES_SANS_TRES_GROSSE, TAILLE_SERIE } from "./constantes";
import { PIECES, type Piece } from "./pieces";

// La SUITE DU JOUR (lot B8, tirage v4 ; lot B8b, tirage v5 : une suite variée, seed § 4) : des SÉRIES de trois pièces. La pièce `k` (0 à 2) de la série `s` est la pièce de rang `3 × s + k` ; elle ne dépend que de la graine du jour,
// de son rang et des pièces déjà tirées DANS SA SÉRIE — **jamais de la grille du joueur** (pas de tirage « qui aide »). Chaque rang a son propre générateur (`Rng(mixSeed(graine, rang))`, un seul tirage).
// Règles de série (lot B8b, dans le tirage même) : **au plus un domino** ; **jamais deux fois la même pièce** ; **au moins une pièce de 4 cases ou plus** (la dernière pièce de la série y est forcée si les deux premières sont
// plus petites) ; au plus une pièce à boîte de 3 × 3 ; aucune « très grosse » pièce dans les deux premières séries.
//
// La RAMPE s'applique au RANG DE LA SÉRIE : le poids d'une pièce de grosseur `g > 0` (4 cases : 1, 5 cases : 2, 6 cases ou plus : 3) vaut `poids × (ECHELLE + pente × g × min(rangDeSérie, rangMax))`. Il augmente donc de façon
// **monotone** avec la série (jusqu'à `rangMax`, puis il reste là) ; les pièces de 1 à 3 cases gardent un poids fixe, elles deviennent donc plus rares en proportion. Les deux nombres sont réglables par `?debug&tune` (`rampe=pente,rangMax`).
// **Aucune cible de survie d'un bot ne pilote les poids** (lot B8b) : la difficulté vient de la variété et de la rampe, pas de la rareté des grosses pièces.

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
  return p.poids * (ECHELLE + rampe.pente * p.grosseur * Math.min(serie, rampe.rangMax));
}

/** La pièce `k` de la série `serie` : un seul tirage pondéré, parmi les pièces que les règles de série laissent. `deja` : les pièces d'avant dans la série. */
export function pieceDeSerie(graine: number, serie: number, k: number, deja: readonly Piece[], rampe: Rampe = RAMPE_PAR_DEFAUT): Piece {
  let total = 0;
  for (const p of PIECES) total += poidsDeSerie(p, serie, deja, rampe);
  let reste = new Rng(mixSeed(graine, serie * TAILLE_SERIE + k)).int(total);
  for (const p of PIECES) {
    const w = poidsDeSerie(p, serie, deja, rampe);
    if (reste < w) return p;
    reste -= w;
  }
  throw new Error("suite : tirage hors des poids"); // inatteignable : reste < total
}

/** La série de rang `serie` (trois pièces ; moins si le plafond de pièces la coupe). */
export function serieAuRang(graine: number, serie: number, rampe: Rampe = RAMPE_PAR_DEFAUT, n: number = PLAFOND_PIECES): Piece[] {
  const out: Piece[] = [];
  for (let k = 0; k < TAILLE_SERIE && serie * TAILLE_SERIE + k < n; k++) out.push(pieceDeSerie(graine, serie, k, out, rampe));
  return out;
}

/** La suite entière (les ids des pièces, série après série), `PLAFOND_PIECES` pièces. */
export function genererSuite(graine: number, rampe: Rampe = RAMPE_PAR_DEFAUT, n: number = PLAFOND_PIECES): number[] {
  const suite: number[] = [];
  for (let s = 0; suite.length < n; s++) for (const p of serieAuRang(graine, s, rampe, n)) suite.push(p.id);
  return suite;
}
