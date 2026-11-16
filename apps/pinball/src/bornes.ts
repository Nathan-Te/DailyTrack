import { REGLAGES, copierReglages, type Reglages } from "@cdj/pinball-sim";

// Les bornes des réglages d'essai (lot PB2, `?debug&tune`), à la demande avec la scène. **Ce que le panneau change ne sort jamais de ces bornes** (ni les curseurs, ni un `&reglages=` collé dans l'adresse) : au-delà,
// la bille traverserait des parois (la vitesse maximale reste à 1 500 px/s, 2,5 px par pas, comme `test/traversee.test.ts` le prouve) ou la partie n'aurait plus de sens. Une partie jouée avec d'autres réglages que
// `REGLAGES` n'est jamais classée (`essai.ts`) : le serveur ne connaît que `REGLAGES`.
export const BORNES: Readonly<Record<keyof Reglages, readonly [number, number]>> = {
  pente: [300, 1600],
  vitesseMax: [800, 1500],
  rebondMur: [100, 900],
  rebondGuide: [100, 900],
  rebondFond: [0, 600],
  rebondPoteau: [100, 900],
  rebondBumper: [0, 600],
  rebondCible: [100, 900],
  rebondBatteur: [0, 800],
  frottementMur: [900, 1000],
  kickBumper: [0, 900],
  kickMini: [0, 900],
  kickSling: [0, 900],
  seuilSling: [0, 300],
  batteurRepos: [300, 800],
  batteurHaut: [-800, 0],
  batteurVitesseHaut: [8000, 26000],
  batteurVitesseBas: [4000, 26000],
  lanceurBase: [300, 1100],
  lanceurPlus: [0, 900],
  lanceurCharge: [400, 3000],
  trouGarde: [60, 1200],
  trouVitesse: [200, 900],
  trouPause: [100, 2400],
  trouVitesseMax: [300, 1000],
  sauvee: [0, 12000],
  banqueRelevee: [120, 3000],
  voiesRelevees: [60, 1200],
  // lot PB3 : les éléments des thèmes et les buts des missions
  kickBulles: [0, 900],
  kickMiniBulles: [0, 900],
  manegeVitesse: [0, 20],
  tourbillonForce: [0, 2500],
  tourbillonSpirale: [0, 2500],
  tourbillonGarde: [60, 1200],
  tourbillonPause: [100, 2400],
  tourbillonVitesse: [200, 900],
  trouNoirForce: [0, 800000],
  portailPause: [60, 2400],
  geyserVitesse: [300, 1500],
  geyserPause: [60, 2400],
  geyserDevie: [0, 300],
  geyserParBille: [1, 30],
  couleeForce: [0, 3000],
  butManege: [1, 20],
  butTourbillon: [1, 20],
  butPortail: [1, 20],
  butGeyser: [1, 20],
  // lot PBG1 : les rails (rampes et orbite) et le combo
  rampeVitesseMin: [100, 1500],
  rampePente: [0, 1600],
  rampeFrottement: [0, 600],
  rampePoints: [0, 20000],
  orbitePoints: [0, 20000],
  comboDelai: [600, 12000],
  comboMax: [1, 10],
  comboPas: [0, 200],
  // lot PBG2 : le verrou, la multibille, le jackpot et les niveaux de la mission
  verrouPoints: [0, 20000],
  verrouPause: [60, 1800],
  multibilleDepart: [60, 2400],
  multibilleLacher: [60, 3000],
  multibilleSauvee: [0, 18000],
  multibilleRelance: [60, 1800],
  rebondBille: [0, 1000],
  jackpotBase: [0, 50000],
  jackpotPas: [0, 300],
  jackpotMultiplie: [0, 1],
  missionButPas: [100, 400],
  missionPas: [0, 300],
};

/** Ce que le joueur d'essai règle sur la vue (rien de cela n'entre dans la simulation). */
export interface Vue {
  /** L'angle de la caméra au-dessus de la table, en degrés (90 : à la verticale). */
  angle: number;
  /** La distance, en % de celle qui cadre toute la table (100 : tout juste cadrée). */
  distance: number;
  /** Le champ (ouverture verticale), en degrés. */
  champ: number;
  /** La lumière, en % (100 : celle de la maquette). */
  lumiere: number;
  /** La taille des étiquettes des modules, en % de la maquette (100 : la pastille de 9 px). */
  etiquettes: number;
  /** Lot PBV1 : l'intensité du soleil, en % (100 : la lumière chaude de fin d'après-midi de la recette). `lumiere` règle alors la lumière du ciel (l'ambiance). */
  soleil: number;
  /** Lot PBV1 : d'où vient le soleil, en degrés autour de la table (0 : du haut de la table ; négatif : de la gauche ; positif : de la droite). */
  azimut: number;
  /** Lot PBV1 : la hauteur du soleil au-dessus de l'horizon, en degrés (bas : de longues ombres). */
  hauteur: number;
  /** Lot PBV1 : la force du bloom, en % (0 : pas de bloom, la passe de composition n'est pas faite). */
  bloom: number;
  /** Lot PBV1 : la lueur des bandes lumineuses et des lampes du décor, en %. */
  bandes: number;
  /** Lot PBV3 : l'exposition du tone mapping, en % (100 : la recette ; **0 : sans tone mapping ni étalonnage**, le rendu d'avant le lot, pour mesurer leur coût). */
  exposition: number;
  /** Lot PBV3 : la chaleur de l'étalonnage (ombres ambrées, hautes lumières dorées), en % (0 : neutre). */
  chaleur: number;
  /** Lot PBV3 : la saturation de l'étalonnage, en % (100 : la recette ; 0 : noir et blanc). */
  saturation: number;
  /** Lot PBV3 : la force de l'occlusion cuite dans le sol (l'ombre de contact autour de ce qui est posé), en %. */
  occlusion: number;
  /** Lot PBV3 : la force du vignettage dans la table (les bords et le haut de l'arc plus sombres), en %. */
  vignettage: number;
}
export const VUE_DEFAUT: Vue = { angle: 66, distance: 100, champ: 20, lumiere: 100, etiquettes: 140, soleil: 100, azimut: -28, hauteur: 36, bloom: 100, bandes: 100, exposition: 100, chaleur: 100, saturation: 100, occlusion: 100, vignettage: 100 };
export const BORNES_VUE: Readonly<Record<keyof Vue, readonly [number, number]>> = {
  angle: [35, 85],
  distance: [70, 140],
  champ: [15, 60],
  lumiere: [30, 200],
  etiquettes: [60, 320],
  soleil: [0, 250],
  azimut: [-90, 90],
  hauteur: [12, 85],
  bloom: [0, 300],
  bandes: [0, 300],
  exposition: [0, 250],
  chaleur: [0, 300],
  saturation: [0, 250],
  occlusion: [0, 200],
  vignettage: [0, 200],
};

const borne = (v: unknown, [min, max]: readonly [number, number]): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null);

/** Les réglages d'une adresse (`&reglages=`) : le JSON écrit par « Exporter » (`{ reglages, vue }`) ou les réglages seuls ; une clé inconnue ou illisible est ignorée, une valeur est ramenée dans ses bornes. */
export function reglagesDe(brut: unknown): Reglages {
  const r = copierReglages(REGLAGES);
  const j = (brut && typeof brut === "object" ? brut : {}) as { reglages?: unknown };
  const src = (j.reglages && typeof j.reglages === "object" ? j.reglages : brut) as Record<string, unknown> | null;
  if (src && typeof src === "object") for (const cle of Object.keys(BORNES) as (keyof Reglages)[]) r[cle] = borne(src[cle], BORNES[cle]) ?? r[cle];
  return r;
}
export function vueDe(brut: unknown): Vue {
  const v = { ...VUE_DEFAUT };
  const src = (brut && typeof brut === "object" ? (brut as { vue?: unknown }).vue : null) as Record<string, unknown> | null;
  if (src && typeof src === "object") for (const cle of Object.keys(BORNES_VUE) as (keyof Vue)[]) v[cle] = borne(src[cle], BORNES_VUE[cle]) ?? v[cle];
  return v;
}
