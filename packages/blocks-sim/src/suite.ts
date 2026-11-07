import { mixSeed, Rng } from "@cdj/core";
import { BOITES33_PAR_SERIE, PLAFOND_PIECES, RAMPE_PAR_DEFAUT, type Rampe, SERIES_SANS_TRES_GROSSE, TAILLE_SERIE } from "./constantes";
import { PIECES, type Piece } from "./pieces";

// La SUITE DU JOUR (lot B8, tirage v4) : des SÉRIES de trois pièces. La pièce `k` (0 à 2) de la série `s` est la pièce de rang `3 × s + k` ; elle ne dépend que de la graine du jour, de son rang et des pièces déjà tirées DANS SA
// SÉRIE — **jamais de la grille du joueur** (pas de tirage « qui aide »). Chaque rang a son propre générateur (`Rng(mixSeed(graine, rang))`, un seul tirage).
// Garde-fous (par série) : au plus une pièce à boîte de 3 × 3 ; aucune « très grosse » pièce dans les deux premières séries.
//
// La RAMPE s'applique au RANG DE LA SÉRIE : le poids d'une pièce de grosseur `g > 0` (4 cases : 1, 5 cases : 2, 6 cases ou plus : 3) vaut `poids × (ECHELLE + pente × g × min(rangDeSérie, rangMax))`. Il augmente donc de façon
// **monotone** avec la série (jusqu'à `rangMax`, puis il reste là) ; les pièces de 1 à 3 cases gardent un poids fixe, elles deviennent donc plus rares en proportion. Les deux nombres sont réglables par `?debug&tune` (`rampe=pente,rangMax`).

const ECHELLE = 100;

/** La graine d'un jour : un nombre de 32 bits tiré du numéro du jour. */
const SEL = 0x0b10c5;
export const graineDuJour = (jour: number): number => mixSeed(jour, SEL);

/** Le poids d'une pièce dans la série de rang `serie`, ou 0 si un garde-fou l'écarte. `boites33` : combien de pièces à boîte de 3 × 3 la série a déjà. Entier. */
export function poidsDeSerie(p: Piece, serie: number, boites33: number, rampe: Rampe = RAMPE_PAR_DEFAUT): number {
  if (serie < SERIES_SANS_TRES_GROSSE && p.tresGrosse) return 0;
  if (p.boite33 && boites33 >= BOITES33_PAR_SERIE) return 0;
  return p.poids * (ECHELLE + rampe.pente * p.grosseur * Math.min(serie, rampe.rangMax));
}

/** La pièce `k` de la série `serie` : un seul tirage pondéré, parmi les pièces que les garde-fous laissent. `boites33` : celles que les pièces d'avant dans la série ont déjà. */
export function pieceDeSerie(graine: number, serie: number, k: number, boites33: number, rampe: Rampe = RAMPE_PAR_DEFAUT): Piece {
  let total = 0;
  for (const p of PIECES) total += poidsDeSerie(p, serie, boites33, rampe);
  let reste = new Rng(mixSeed(graine, serie * TAILLE_SERIE + k)).int(total);
  for (const p of PIECES) {
    const w = poidsDeSerie(p, serie, boites33, rampe);
    if (reste < w) return p;
    reste -= w;
  }
  throw new Error("suite : tirage hors des poids"); // inatteignable : reste < total
}

/** La série de rang `serie` (trois pièces ; moins si le plafond de pièces la coupe). */
export function serieAuRang(graine: number, serie: number, rampe: Rampe = RAMPE_PAR_DEFAUT, n: number = PLAFOND_PIECES): Piece[] {
  const out: Piece[] = [];
  let boites33 = 0;
  for (let k = 0; k < TAILLE_SERIE && serie * TAILLE_SERIE + k < n; k++) {
    const p = pieceDeSerie(graine, serie, k, boites33, rampe);
    if (p.boite33) boites33++;
    out.push(p);
  }
  return out;
}

/** La suite entière (les ids des pièces, série après série), `PLAFOND_PIECES` pièces. */
export function genererSuite(graine: number, rampe: Rampe = RAMPE_PAR_DEFAUT, n: number = PLAFOND_PIECES): number[] {
  const suite: number[] = [];
  for (let s = 0; suite.length < n; s++) for (const p of serieAuRang(graine, s, rampe, n)) suite.push(p.id);
  return suite;
}
