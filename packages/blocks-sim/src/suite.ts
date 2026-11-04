import { mixSeed, Rng } from "@cdj/core";
import { PLAFOND_PIECES, RAMPE_PAR_DEFAUT, type Rampe, RANGS_SANS_TRES_GROSSE } from "./constantes";
import { PIECES, type Piece } from "./pieces";

// La SUITE DU JOUR : la pièce de rang `i` ne dépend que de la graine du jour et de `i` — **jamais de la grille du joueur** (pas de tirage « qui aide »). Chaque rang a son propre générateur
// (`Rng(mixSeed(graine, i))`, un seul tirage) ; la seule chose qu'un rang lit d'un autre est le garde-fou « jamais deux 3 × 3 d'affilée » (il regarde la pièce du rang précédent, elle-même fonction de la graine).
//
// La RAMPE : le poids d'une pièce de grosseur `g > 0` (4 cases : 1, 5 cases : 2, 6 cases ou plus : 3) vaut `poids × (ECHELLE + pente × g × min(rang, rangMax))`. Il augmente donc de façon **monotone** avec le rang
// (jusqu'à `rangMax`, puis il reste là) ; les pièces de 1 à 3 cases gardent un poids fixe, elles deviennent donc plus rares en proportion. Les deux nombres sont réglables par `?debug&tune` (`rampe=pente,rangMax`).

const ECHELLE = 100;

/** La graine d'un jour : un nombre de 32 bits tiré du numéro du jour. */
const SEL = 0x0b10c5;
export const graineDuJour = (jour: number): number => mixSeed(jour, SEL);

/** Le poids d'une pièce au rang `rang`, ou 0 si un garde-fou l'écarte. `precedente` : la pièce du rang d'avant. Entier. */
export function poidsAuRang(p: Piece, rang: number, precedente: Piece | null, rampe: Rampe = RAMPE_PAR_DEFAUT): number {
  if (rang < RANGS_SANS_TRES_GROSSE && p.tresGrosse) return 0;
  if (p.boite33 && precedente?.boite33) return 0;
  return p.poids * (ECHELLE + rampe.pente * p.grosseur * Math.min(rang, rampe.rangMax));
}

/** La pièce de rang `rang` : un seul tirage pondéré, parmi les pièces que les garde-fous laissent. */
export function pieceAuRang(graine: number, rang: number, precedente: Piece | null, rampe: Rampe = RAMPE_PAR_DEFAUT): Piece {
  let total = 0;
  for (const p of PIECES) total += poidsAuRang(p, rang, precedente, rampe);
  let reste = new Rng(mixSeed(graine, rang)).int(total);
  for (const p of PIECES) {
    const w = poidsAuRang(p, rang, precedente, rampe);
    if (reste < w) return p;
    reste -= w;
  }
  throw new Error("suite : tirage hors des poids"); // inatteignable : reste < total
}

/** La suite entière (les ids des pièces), `PLAFOND_PIECES` rangs. */
export function genererSuite(graine: number, rampe: Rampe = RAMPE_PAR_DEFAUT, n: number = PLAFOND_PIECES): number[] {
  const suite: number[] = [];
  let avant: Piece | null = null;
  for (let i = 0; i < n; i++) {
    avant = pieceAuRang(graine, i, avant, rampe);
    suite.push(avant.id);
  }
  return suite;
}
