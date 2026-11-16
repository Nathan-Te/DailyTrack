import { LARGEUR_MORCEAU, MORCEAUX_PAR_BOUCLE } from "@cdj/gravity-sim";

// Les essais de recette (lot GR2) : **hors production seulement, jamais classés**. `?robot` : on regarde le robot jouer le niveau du jour ; `?morceau=<n>` : la partie commence juste avant le morceau `n`, dans l'état où
// le robot y arrive (quelques secondes pour reprendre ses esprits) — on joue soi-même le passage ; les deux ensemble : on regarde le robot depuis ce morceau. `?jour=AAAA-MM-JJ` (déjà là) choisit le niveau. Ce
// fichier ne contient que la lecture de l'adresse et des constantes : le premier chargement le garde (il sert à `classable`), tout le reste est à la demande (`niveau.ts`, `scene.ts`).

/** Ce que l'adresse demande. */
export interface Essais {
  robot: boolean;
  /** Le numéro du morceau avant lequel commencer (1 à deux tours des cinq thèmes), ou null. */
  morceau: number | null;
}
/** Ce que `niveau.ts` joint au contenu du jour quand un essai est demandé : les appuis du robot et le pas où le joueur reprend la main (0 : dès le début). */
export interface EssaiRecette {
  robot: boolean;
  appuis: readonly number[];
  depart: number;
}
/** Combien de colonnes avant le morceau demandé la partie commence : douze, de quoi voir le passage venir (une seconde à 12,5 m/s). */
export const COLONNES_AVANT_MORCEAU = 12;
/** Jusqu'où le robot joue quand on le regarde : la première boucle des cinq thèmes et la moitié de la seconde, comme sa preuve de franchissabilité (2 280 m). */
export const DISTANCE_DU_ROBOT = Math.trunc(MORCEAUX_PAR_BOUCLE * LARGEUR_MORCEAU * 1.5);

/** Lit `?robot` et `?morceau=<n>` ; **rien en production** (`VITE_PRODUCTION`), et un numéro qui n'est pas un entier de 1 à deux tours est ignoré. */
export function lireEssais(adresse: string, production: boolean): Essais {
  if (production) return { robot: false, morceau: null };
  const p = new URLSearchParams(adresse);
  const brut = p.get("morceau");
  const n = brut !== null && /^\d{1,4}$/.test(brut) ? Number(brut) : NaN;
  return { robot: p.has("robot") && p.get("robot") !== "0", morceau: Number.isInteger(n) && n >= 1 && n <= 2 * MORCEAUX_PAR_BOUCLE ? n : null };
}

/** La distance (mètres) à laquelle la partie du joueur commence avant le morceau `n` : douze colonnes avant lui, en comptant les trois colonnes du départ. */
export const distanceAvantMorceau = (n: number): number => Math.max(1, n * LARGEUR_MORCEAU - 3 - COLONNES_AVANT_MORCEAU);

/**
 * Lot GR5 — **un réglage d'essai est-il dans l'adresse ?** (`?vitesse=`, `?plafond=`, `?pente=`, `?gravite=`, `?longueur=`, `?medailles=` : `reglagesEssai.ts`). Seul ce test est du premier chargement (`classable`, `definition.ts`) :
 * **rien en production**, et hors production un paramètre de réglage, même illisible, rend la page non classable (la lecture et la validation des valeurs sont dans `reglagesEssai.ts`, à la demande, avec le niveau).
 */
export const NOMS_DES_REGLAGES = ["vitesse", "plafond", "pente", "gravite", "longueur", "medailles"] as const;
export const aUnReglageDEssai = (adresse: string, production: boolean): boolean => {
  if (production) return false;
  const p = new URLSearchParams(adresse);
  return NOMS_DES_REGLAGES.some((n) => p.has(n));
};
