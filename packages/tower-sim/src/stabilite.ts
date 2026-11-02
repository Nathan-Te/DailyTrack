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
  /** Le taquet en main : le pas fin (huitièmes de mètre). */
  pasFin8: number;
  /** Le taquet après le lâcher : la fenêtre (ticks), la vitesse ajoutée par poussée (huitièmes de m/s) et le nombre de poussées par pièce. */
  taquetFenetre: number;
  taquetDv8: number;
  taquetMax: number;
}

export const PARAMS_STABILITE: Readonly<ParamsStabilite> = {
  vitessePose8: 2,
  graviteDouce: 0,
  dureeGraviteDouce: 20,
  tolerance: 0.02,
  pasFin8: 1,
  taquetFenetre: 15,
  taquetDv8: 20,
  taquetMax: 3,
};

/** Les bornes admises pour les réglages d'essai du taquet (`?debug&tune`). */
export function paramsResolus(partiel: Partial<ParamsStabilite> | undefined): ParamsStabilite {
  return { ...PARAMS_STABILITE, ...(partiel ?? {}) };
}
