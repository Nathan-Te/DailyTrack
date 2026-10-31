// Lot T3 — les médailles de Tower. Le Diamant est la hauteur stable du bot de l'auteur (`bot/`) ; les trois autres en sont des pourcentages (docs/tower/seed.md § 3, à calibrer). **Tout est
// en millimètres ENTIERS**, par `idiv` (division tronquée vers zéro) : aucun flottant, le même seuil partout. Dans les données la clé du Diamant est `auteur` (comme dans les autres jeux).
import { idiv } from "../lab/a/fixe";
import { boites } from "./sommet";
import type { Contenu } from "./generateur";

/** Les pourcentages du Diamant, et leur version : un recalibrage monte `MEDAILLES_VERSION` et ne touche que les jours préparés après lui (un jour préparé garde ses seuils écrits). */
export const MEDAILLES_VERSION = 1;
export const POURCENTAGES_MEDAILLES = { or: 90, argent: 75, bronze: 55 } as const;

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
 * contre le bot sur 30 jours (`npm run mesures-t3:tower`, rapport du lot T3 : la médiane du rapport bot / estimation est de 224 %, mais l'écart est très grand d'un jour à l'autre — onze jours sur trente à moins de 25 % :
 * c'est un repli de dernier recours, d'où le mot « provisoires »). Entiers : l'aire en huitièmes de mètre carré, le résultat en millimètres. Le jeu marque ces médailles
 * « provisoires » ; seul un jour préparé (`bot/`) en a de fiables.
 */
export const COEFFICIENT_GEOMETRIQUE_PCT = 224;

/** L'aire des pièces du jour, en huitièmes de mètre au carré (somme des boîtes, tailles normales). */
export function aireDuJour(pieces: Contenu["pieces"]): number {
  let aire = 0;
  for (const kind of pieces) for (const b of boites(kind, 0)) aire += 4 * b.hw * b.hh;
  return aire;
}

export function estimationGeometrique(c: Pick<Contenu, "pieces" | "plateformeDemi8">, coefficientPct: number = COEFFICIENT_GEOMETRIQUE_PCT): Medailles {
  // aire (huitièmes²) / largeur (huitièmes) = hauteur en huitièmes de mètre ; × 125 = millimètres.
  const mm = idiv(aireDuJour(c.pieces) * 125 * coefficientPct, 2 * c.plateformeDemi8 * 100);
  return medaillesDe(mm);
}
