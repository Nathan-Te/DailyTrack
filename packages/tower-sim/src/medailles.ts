// Lot T3 — les médailles de Tower. Le Diamant est la hauteur stable du bot de l'auteur (`bot/`) ; les trois autres en sont des pourcentages (docs/tower/seed.md § 3, à calibrer). **Tout est
// en millimètres ENTIERS**, par `idiv` (division tronquée vers zéro) : aucun flottant, le même seuil partout. Dans les données la clé du Diamant est `auteur` (comme dans les autres jeux).
import { idiv } from "../lab/a/fixe";
import { boites } from "./sommet";
import { type Contenu, GENERATEUR_TIRAGE, TOWER_GENERATOR_VERSION } from "./generateur";

/**
 * Les pourcentages du Diamant, et leur version : un recalibrage monte `MEDAILLES_VERSION` et ne touche que les jours préparés après lui (un jour préparé garde ses seuils écrits).
 * Version 2 (lot T3b, décision de Nathan) : Bronze 15 %, Argent 30 %, Or 50 % — au lot T3 les joueurs simulés étaient à 16–19 % du Diamant (médiane), le Bronze à 55 % était hors de portée.
 * **Ces pourcentages seront recalibrés au lot T5, sur des parties humaines** (les joueurs simulés ne sont qu'une première approximation).
 */
export const MEDAILLES_VERSION = 2;
export const POURCENTAGES_MEDAILLES = { or: 50, argent: 30, bronze: 15 } as const;

/** Le plafond du Diamant (lot T3b, générateur 3) : 60 m. Diamant = min(hauteur du bot, plafond) ; la preuve reste la vraie partie du bot (elle peut finir plus haut). */
export const PLAFOND_DIAMANT_MM = 60_000;

/** Le Diamant d'après la hauteur stable du bot : plafonné dès le générateur 3 (les versions 1 et 2 n'ont pas de plafond : leurs jours servis gardent leur Diamant). */
export function diamantDe(hauteurBotMm: number, g: number = TOWER_GENERATOR_VERSION): number {
  return g >= GENERATEUR_TIRAGE ? Math.min(hauteurBotMm, PLAFOND_DIAMANT_MM) : hauteurBotMm;
}

/** Du moins précieux au plus précieux. */
export const NOMS_MEDAILLES = ["bronze", "argent", "or", "auteur"] as const;
export type NomMedaille = (typeof NOMS_MEDAILLES)[number];

/** Les seuils d'un jour (millimètres) : `auteur` est le Diamant. */
export interface Medailles {
  auteur: number;
  or: number;
  argent: number;
  bronze: number;
}

/** Les seuils d'après la hauteur stable du bot (millimètres entiers). */
export function medaillesDe(auteurMm: number): Medailles {
  return {
    auteur: auteurMm,
    or: idiv(auteurMm * POURCENTAGES_MEDAILLES.or, 100),
    argent: idiv(auteurMm * POURCENTAGES_MEDAILLES.argent, 100),
    bronze: idiv(auteurMm * POURCENTAGES_MEDAILLES.bronze, 100),
  };
}

/** La médaille la plus haute dont la hauteur atteint le seuil (hauteur ≥ seuil : le Diamant s'obtient à hauteur égale ou supérieure à celle du bot) ; null sous le Bronze. */
export function medailleObtenue(hauteurMm: number, m: Medailles): NomMedaille | null {
  for (let i = NOMS_MEDAILLES.length - 1; i >= 0; i--) if (hauteurMm >= m[NOMS_MEDAILLES[i]!]) return NOMS_MEDAILLES[i]!;
  return null;
}

/** La prochaine médaille à atteindre (la plus basse que la hauteur n'atteint pas encore) et ce qu'il en reste en millimètres ; null si le Diamant est atteint. */
export function medailleVisee(hauteurMm: number, m: Medailles): { nom: NomMedaille; seuil: number; reste: number } | null {
  for (const nom of NOMS_MEDAILLES) if (hauteurMm < m[nom]) return { nom, seuil: m[nom], reste: m[nom] - hauteurMm };
  return null;
}

/**
 * Le repli (seed § 5) : l'estimation GÉOMÉTRIQUE du Diamant, sans bot — l'aire des pièces du jour divisée par la largeur de la plateforme, multipliée par un coefficient mesuré
 * contre le bot sur 30 jours (`npm run mesures-t3:tower`, rapport du lot T3 : la médiane du rapport bot / estimation : 195 % au lot T3, **165 % au lot T3b** sur le contenu retenu (g3), valeur adoptée au lot T4 sur décision de Nathan ; l'écart est très grand d'un jour à l'autre — sept jours sur trente à moins de 25 % :
 * c'est un repli de dernier recours, d'où le mot « provisoires »). Entiers : l'aire en huitièmes de mètre carré, le résultat en millimètres. Le jeu marque ces médailles
 * « provisoires » ; seul un jour préparé (`bot/`) en a de fiables.
 */
export const COEFFICIENT_GEOMETRIQUE_PCT = 165;

/** L'aire des pièces du jour, en huitièmes de mètre au carré (somme des boîtes, tailles normales). */
export function aireDuJour(pieces: Contenu["pieces"]): number {
  let aire = 0;
  for (const kind of pieces) for (const b of boites(kind, 0)) aire += 4 * b.hw * b.hh;
  return aire;
}

/** Les médailles provisoires d'un jour sans fichier préparé : l'estimation, plafonnée comme le Diamant (lot T3b ; à 100 % elle ne dépasse jamais 32 m, le plafond ne joue que pour un coefficient plus grand). */
export function estimationGeometrique(c: Pick<Contenu, "pieces" | "plateformeDemi8">, coefficientPct: number = COEFFICIENT_GEOMETRIQUE_PCT): Medailles {
  // aire (huitièmes²) / largeur (huitièmes) = hauteur en huitièmes de mètre ; × 125 = millimètres.
  return medaillesDe(diamantDe(idiv(aireDuJour(c.pieces) * 125 * coefficientPct, 2 * c.plateformeDemi8 * 100)));
}
