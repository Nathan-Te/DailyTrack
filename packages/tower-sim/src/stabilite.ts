// Lot T8 — les paramètres de la simulation 5 : la pose douce, le repos de la tour, la tolérance d'emboîtement et le taquet. Hors de `constantes.ts` pour que l'accueil (qui lit `constantes`)
// ne les porte pas. Choisis d'après la mesure du lot (`tools/stabilite.ts`, rapport `docs/tower/lots/lot-T8-stabilite-taquet.md`). Tout ce qui entre dans Rapier reste un entier ÷ 8
// (huitièmes de mètre, huitièmes de m/s) ou un réglage du solveur ; aucune transcendante, aucun hasard.

/** Les réglages de la simulation 5 (la 3 et la 4 n'en lisent aucun). Les entiers sont en huitièmes de mètre (ou de m/s) quand le nom finit par `8`. */
export interface ParamsStabilite {
  /** Pose douce : la pièce part de cette vitesse au lâcher (huitièmes de m/s) au lieu de la chute normale ; la gravité fait le reste (≈ 1 m/s au contact). */
  vitessePose8: number;
  /** Pose douce, suite : pendant `dureeGraviteDouce` ticks après le lâcher la gravité de la pièce est multipliée par `graviteDouce` (1 : aucun effet) — la pièce n'accélère pas sur les derniers centimètres avant le contact ; elle retrouve tout son poids ensuite. */
  graviteDouce: number;
  dureeGraviteDouce: number;
  /** Tolérance d'emboîtement (mètres) : un déplacement ou un quart de tour en main accepte de recouvrir une pièce posée jusqu'à cette profondeur ; au-delà il est refusé. */
  tolerance: number;
  /** Le déplacement « intelligent » : la portée (mètres) dans laquelle le jeu recale la pièce en main, après chaque déplacement ou quart de tour, pour qu'elle tombe vraiment dans le creux qu'elle vise (0 : éteint). */
  alignement: number;
  /**
   * Le taquet, un coup de côté de la pièce EN MAIN (avant la pose), manuel à 100 % : son pas par tick (huitièmes de mètre, entier), sa durée (ticks : la portée est pas × durée), la vitesse latérale
   * (huitièmes de m/s) avec laquelle la pièce est LÂCHÉE quand elle percute un bloc, et le nombre de coups par pièce (0 : sans limite).
   */
  taquetPas8: number;
  taquetTicks: number;
  taquetChoc8: number;
  taquetMax: number;
}

export const PARAMS_STABILITE: Readonly<ParamsStabilite> = {
  vitessePose8: 2,
  graviteDouce: 0,
  dureeGraviteDouce: 20,
  tolerance: 0.02,
  alignement: 0.06,
  taquetPas8: 2,
  taquetTicks: 6,
  taquetChoc8: 40,
  taquetMax: 0,
};

/** Les bornes admises pour les réglages d'essai du taquet (`?debug&tune`). */
export function paramsResolus(partiel: Partial<ParamsStabilite> | undefined): ParamsStabilite {
  return { ...PARAMS_STABILITE, ...(partiel ?? {}) };
}
