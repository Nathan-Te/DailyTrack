// « Blocks » (lot B1) — les constantes de la simulation. Règles : `docs/blocks/seed.md` § 3 à 5. Tout est entier ; aucune horloge.

/** La version des RÈGLES (la pose, l'effacement, le barème, la fin). Elle monte à tout changement qui change une partie rejouée. v2 (lot B8) : séries de trois pièces posées dans l'ordre qu'on veut, action = (emplacement, colonne, ligne), fin quand aucune pièce restante ne rentre. v3 (lot B8c) : le tirage de chaque série dépend de la grille au moment où elle est tirée (`suite.ts`), donc la partie rejouée tire ses séries elle-même ; la pose, l'effacement, le barème et la fin sont ceux de la v2. v1 (une pièce à la fois) n'est plus qu'un rejeu (`v1.ts`). */
export const BLOCKS_SIM_VERSION = 3;
/** La version du TIRAGE (la suite du jour : catalogue, poids, rampe, garde-fous). Elle monte à tout changement de ce que `dailyBlocks` produit. v2 (lot B2) : 40 pièces (grand T ajouté, pièce de 1 case retirée). v3 (lot B3) : poids de base et rampe recalibrés avec le bot Diamant (`pieces.ts`, `RAMPE_PAR_DEFAUT`). v4 (lot B8) : des SÉRIES de trois pièces (garde-fous par série, rampe au rang de la série), poids et rampe recalibrés pour les trois bots de référence. v5 (lot B8b) : une suite variée (seed § 4) — au plus un domino, jamais deux fois la même pièce, au moins une pièce de 4 cases ou plus par série ; poids de base et rampe (pente 1, rang maximal 80) réglés sur la répartition des pièces, plus sur la survie des bots. v6 (lot B8c, seed § 4) : un tirage ADAPTÉ À LA GRILLE — chaque série est tirée de la graine, de son rang et de la grille du moment, par essais successifs (exigence 1 : série posable ; exigence 2 : coup de pouce) ; le v4 et le v5 ne sont pas gardés (aucun jour n'a été figé avec eux). */
export const BLOCKS_GENERATOR_VERSION = 6;

/** La version du BOT DIAMANT (`diamant.ts` : sa logique et ses poids). Le bot fait partie des règles du classement (les seuils des médailles en dépendent) : elle monte à tout changement de ce qu'il joue ou des seuils. v3 (lot B8b) : les seuils des médailles sont des constantes (`SEUILS_MEDAILLES` : score de bots arrêtés après un nombre fixe de pièces) et le Diamant s'arrête à `PIECES_DU_DIAMANT` pièces. v4 (lot B8b) : le Diamant ne lit plus la série suivante (un joueur ne la voit pas) ; seuils recalibrés. v5 (lot B8c) : les bots jouent des séries adaptées à leur grille ; les nombres de pièces des bots de référence changent (30, 60, 105, 180) et les seuils ne sont plus des constantes du code : ils sont la donnée `medailles.seuils` de la fiche du jeu (changer un seuil ne monte pas cette version). */
export const BLOCKS_BOT_VERSION = 5;

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
  /** Le rang de série où la rampe prend sa pleine pente (ensuite elle ne grossit plus que de `apres`). */
  rangMax: number;
  /** Lot B8c : le gain de poids par rang et par point de grosseur APRÈS `rangMax` (même unité que `pente`) ; absent : 0, le poids reste là. Il garantit qu'une partie finit toujours (seed § 3), sans changer la répartition des pièces jusqu'à `rangMax`. */
  apres?: number;
}
export const RAMPE_PAR_DEFAUT: Rampe = { pente: 1, rangMax: 80, apres: 0.5 };

/**
 * LE TIRAGE ADAPTÉ À LA GRILLE (lot B8c, tirage v6, seed § 4). Chaque série est tirée de la graine du jour, de son rang et de la grille au moment où elle arrive, par essais successifs : on tire une série candidate (poids et règles de série de
 * B8b), on l'accepte si elle respecte les exigences du rang, sinon on retire, jusqu'à `essais` essais, puis on garde la meilleure candidate. Les pourcentages sont des entiers de 0 à 100 ; la probabilité de chaque exigence est tirée, elle aussi, de (graine, rang).
 */
export interface ReglageTirage {
  rampe: Rampe;
  /** Le nombre d'essais par série (N). */
  essais: number;
  /** Exigence 1, « série posable » : les trois pièces se posent toutes dans au moins un ordre (les effacements entre deux poses comptés). Exigée à 100 % jusqu'à la série `jusqua`, puis la part baisse en ligne droite jusqu'à `pct` % à la série `rang`, et y reste. */
  posable: { jusqua: number; rang: number; pct: number };
  /** Exigence 2, « coup de pouce » : une pièce de la série, posée seule, complète une ligne ou une colonne de la grille. Exigée avec `pct` % de chances à la série 0, qui baissent en ligne droite jusqu'à `pctFin` % à la série `rang` (celui de la rampe par défaut) et y restent. Jamais sur une grille vide. */
  pouce: { pct: number; pctFin: number; rang: number };
}
export const REGLAGE_PAR_DEFAUT: ReglageTirage = {
  rampe: RAMPE_PAR_DEFAUT,
  essais: 40,
  posable: { jusqua: 25, rang: 75, pct: 0 },
  pouce: { pct: 60, pctFin: 30, rang: 80 },
};
/** Un réglage partiel (`?debug&tune`, scénarios) : ce qui n'est pas dit est celui du jeu. */
export interface ReglageSaisi {
  rampe?: Partial<Rampe>;
  essais?: number;
  posable?: Partial<ReglageTirage["posable"]>;
  pouce?: Partial<ReglageTirage["pouce"]>;
}
/** La rampe du tirage v3 (règles v1), gardée pour rejouer un jour figé en v1 (`v1.ts`). */
export const RAMPE_PAR_DEFAUT_V1: Rampe = { pente: 1, rangMax: 140 };
