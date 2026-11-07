// « Blocks » (lot B1) — les constantes de la simulation. Règles : `docs/blocks/seed.md` § 3 à 5. Tout est entier ; aucune horloge.

/** La version des RÈGLES (la pose, l'effacement, le barème, la fin). Elle monte à tout changement qui change une partie rejouée. v2 (lot B8) : séries de trois pièces posées dans l'ordre qu'on veut, action = (emplacement, colonne, ligne), fin quand aucune pièce restante ne rentre. v1 (une pièce à la fois) n'est plus qu'un rejeu (`v1.ts`). */
export const BLOCKS_SIM_VERSION = 2;
/** La version du TIRAGE (la suite du jour : catalogue, poids, rampe, garde-fous). Elle monte à tout changement de ce que `dailyBlocks` produit. v2 (lot B2) : 40 pièces (grand T ajouté, pièce de 1 case retirée). v3 (lot B3) : poids de base et rampe recalibrés avec le bot Diamant (`pieces.ts`, `RAMPE_PAR_DEFAUT`). v4 (lot B8) : des SÉRIES de trois pièces (garde-fous par série, rampe au rang de la série), poids et rampe recalibrés pour les trois bots de référence. v5 (lot B8b) : une suite variée (seed § 4) — au plus un domino, jamais deux fois la même pièce, au moins une pièce de 4 cases ou plus par série ; poids de base et rampe (pente 1, rang maximal 80) réglés sur la répartition des pièces, plus sur la survie des bots. */
export const BLOCKS_GENERATOR_VERSION = 5;

/** La version du BOT DIAMANT (`diamant.ts` : sa logique et ses poids). Le bot fait partie des règles du classement (les seuils des médailles en dépendent) : elle monte à tout changement de ce qu'il joue ou des seuils. v3 (lot B8b) : les seuils des médailles sont des constantes (`SEUILS_MEDAILLES` : score de bots arrêtés après un nombre fixe de pièces) et le Diamant s'arrête à `PIECES_DU_DIAMANT` pièces. v4 (lot B8b) : le Diamant ne lit plus la série suivante (un joueur ne la voit pas) ; seuils recalibrés. */
export const BLOCKS_BOT_VERSION = 4;

/** Les pièces d'une série (lot B8) : on les pose dans l'ordre qu'on veut ; la série suivante arrive quand la troisième est posée. */
export const TAILLE_SERIE = 3;
/** Une action tient sur un octet : `emplacement × 64 + ligne × 8 + colonne` (0 à 191). */
export const NB_ACTIONS = TAILLE_SERIE * 64;

export const COLONNES = 8;
export const LIGNES = 8;
export const NB_CASES = COLONNES * LIGNES;
/** Une ligne pleine : huit bits allumés. */
export const LIGNE_PLEINE = 0xff;

/** Le plafond technique : au plus 2 000 pièces par partie (la rediffusion a un octet par pose). La partie s'arrête à la 2 000ᵉ pose (la 667ᵉ série n'a donc que deux pièces). */
export const PLAFOND_PIECES = 2000;

/** Les points d'un plateau vidé (fixes, sans multiplicateur). */
export const BONUS_PLATEAU_VIDE = 300;
/** Une ligne ou colonne effacée rapporte `POINTS_EFFACEMENT × n × n × combo`. */
export const POINTS_EFFACEMENT = 10;
/** À la 3ᵉ pose sans effacement de suite, le combo retombe à 0. */
export const POSES_SANS_EFFACEMENT_MAX = 3;

/** Garde-fou : aucune « très grosse pièce » dans les `SERIES_SANS_TRES_GROSSE` premières séries. Définition de « très grosse » : `pieces.ts` (6 cases ou plus, ou boîte de 3 × 3). */
export const SERIES_SANS_TRES_GROSSE = 2;
/** Garde-fou : au plus `BOITES33_PAR_SERIE` pièce à boîte de 3 × 3 par série. */
export const BOITES33_PAR_SERIE = 1;
/** Règle de série (lot B8b, seed § 4) : au plus `DOMINOS_PAR_SERIE` domino par série. */
export const DOMINOS_PAR_SERIE = 1;
/** Règle de série (lot B8b) : au moins une pièce d'`CASES_PIECE_GROSSE` cases ou plus par série. */
export const CASES_PIECE_GROSSE = 4;

/** La RAMPE de la suite (`suite.ts`) : le poids d'une pièce de grosseur `g > 0` vaut `poids × (100 + pente × g × min(rangDeSerie, rangMax))`. Réglable par `?debug&tune`. */
export interface Rampe {
  /** Gain de poids par rang et par point de grosseur, en centièmes du poids de base. */
  pente: number;
  /** Le rang de série où la rampe s'arrête (le poids ne grossit plus ensuite). */
  rangMax: number;
}
export const RAMPE_PAR_DEFAUT: Rampe = { pente: 1, rangMax: 80 };
/** La rampe du tirage v3 (règles v1), gardée pour rejouer un jour figé en v1 (`v1.ts`). */
export const RAMPE_PAR_DEFAUT_V1: Rampe = { pente: 1, rangMax: 140 };
