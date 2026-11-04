// « Blocks » (lot B1) — les constantes de la simulation. Règles : `docs/blocks/seed.md` § 3 à 5. Tout est entier ; aucune horloge.

/** La version des RÈGLES (la pose, l'effacement, le barème, la fin). Elle monte à tout changement qui change une partie rejouée. */
export const BLOCKS_SIM_VERSION = 1;
/** La version du TIRAGE (la suite du jour : catalogue, poids, rampe, garde-fous). Elle monte à tout changement de ce que `dailyBlocks` produit. v2 (lot B2) : 40 pièces (grand T ajouté, pièce de 1 case retirée). */
export const BLOCKS_GENERATOR_VERSION = 2;

export const COLONNES = 8;
export const LIGNES = 8;
export const NB_CASES = COLONNES * LIGNES;
/** Une ligne pleine : huit bits allumés. */
export const LIGNE_PLEINE = 0xff;

/** Le plafond technique : au plus 2 000 pièces par partie (la rediffusion a un octet par pose). La partie s'arrête à la 2 000ᵉ pose. */
export const PLAFOND_PIECES = 2000;

/** Les points d'un plateau vidé (fixes, sans multiplicateur). */
export const BONUS_PLATEAU_VIDE = 300;
/** Une ligne ou colonne effacée rapporte `POINTS_EFFACEMENT × n × n × combo`. */
export const POINTS_EFFACEMENT = 10;
/** À la 3ᵉ pose sans effacement de suite, le combo retombe à 0. */
export const POSES_SANS_EFFACEMENT_MAX = 3;

/** Garde-fou : aucune « très grosse pièce » parmi les `RANGS_SANS_TRES_GROSSE` premières (rangs 0 à 5). Définition de « très grosse » : `pieces.ts` (6 cases ou plus, ou boîte de 3 × 3). */
export const RANGS_SANS_TRES_GROSSE = 6;

/** La RAMPE de la suite (`suite.ts`) : le poids d'une pièce de grosseur `g > 0` vaut `poids × (100 + pente × g × min(rang, rangMax))`. Réglable par `?debug&tune`. */
export interface Rampe {
  /** Gain de poids par rang et par point de grosseur, en centièmes du poids de base. */
  pente: number;
  /** Le rang où la rampe s'arrête (le poids ne grossit plus ensuite). */
  rangMax: number;
}
export const RAMPE_PAR_DEFAUT: Rampe = { pente: 4, rangMax: 80 };
