// Lot T3 — les constantes du bot de l'auteur. Tout est ENTIER (la note est en millimètres) ou une vitesse en huitièmes de m/s : le bot n'a ni hasard ni horloge, deux passages donnent la
// même preuve. Toute modification qui change une preuve monte `TOWER_GENERATOR_VERSION` (docs/tower/consignes.md, « Le bot »).

/** Positions essayées de chaque côté de la position d'apparition, au pas de la demi-case (`DEMI_CASE_8`) : 6 pas = 3 m. Réglable ; 0 : une seule colonne. */
export const POSITIONS_PAR_COTE = 5;

/** Une tour est « calme » quand aucune pièce libre non endormie ne dépasse `CALME_VITESSE` m/s pendant `CALME_TICKS` ticks de suite (jamais avant `CALME_MIN_TICKS` ticks après le lâcher). */
export const CALME_VITESSE = 0.05;
export const CALME_TICKS = 4;
export const CALME_MIN_TICKS = 8;
/** Un coup est jugé calme au plus tard à ce tick après le lâcher (la tour qui bouge encore alors est pénalisée par `PENALITE_MOUVEMENT`). */
export const CALME_MAX_TICKS = 100;
/** Les meilleurs coups (au premier jugement) dont on anticipe la pièce suivante. */
export const FINALISTES = 2;

/** La note d'un coup (millimètres) : la hauteur de la tour calme − `PENALITE_VIE` par vie perdue − `PENALITE_MOUVEMENT` par pièce qui bouge encore à la fin. */
export const PENALITE_VIE = 100_000;
export const PENALITE_MOUVEMENT = 1_500;

/**
 * Le bonus de largeur : un sommet large laisse de la place aux pièces suivantes, un mât non. La largeur (millimètres) de ce qui est dans les `LARGEUR_PROFONDEUR_MM` du haut de la tour, multipliée par
 * `LARGEUR_POIDS_PCT` / 100, s'ajoute à la note.
 */
export const LARGEUR_PROFONDEUR_MM = 2500;
export const LARGEUR_POIDS_PCT = 50;

/**
 * **La zone visible.** La caméra de Tower ne montre que `VUE_COURTE − MARGE_HAUT` = 19,5 − 13 = 6,5 m sous le sommet de la tour (paysage, `apps/tower/src/scene.ts` ; en portrait elle montre
 * davantage). Le bot joue comme un joueur : **une pièce qui se pose plus bas que cela (au pied de la tour, sur la plateforme, hors de l'écran) est un coup interdit** ; jeter une pièce à
 * la mer n'existe pas non plus. Écrite ici, car la simulation ne lit pas le jeu : un test la compare à la caméra (`apps/tower/test/`).
 */
export const PROFONDEUR_VISIBLE_MM = 6_500;

/** Marge (mm) de la borne haute d'un coup : une pièce qui pivote peut lever son sommet de quelques centimètres avant de retomber. */
export const MARGE_BORNE_MM = 300;

/**
 * Un jour dont le réglage ordinaire donne moins que `SATISFAIT_MM` (30 m : une tour qui s'effondre dès les premières pièces) est repris avec les variantes de `VARIANTES_BOT` ; le total de
 * ticks de calcul est plafonné par `BUDGET_TICKS` (600 000 : une journée en 90 s au plus sur un cœur, mesuré — c'est un nombre de ticks, jamais une durée lue sur une horloge).
 */
export const SATISFAIT_MM = 30_000;
export const BUDGET_TICKS = 600_000;
