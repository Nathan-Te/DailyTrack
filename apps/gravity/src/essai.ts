import { LARGEUR_MORCEAU, MORCEAUX_PAR_BOUCLE } from "@cdj/gravity-sim";

// Les essais de recette (lot GR2) : **hors production seulement, jamais classés**. `?robot` : on regarde le robot jouer le niveau du jour ; `?morceau=<n>` : la partie commence juste avant le morceau `n`, dans l'état où
// le robot y arrive (quelques secondes pour reprendre ses esprits) — on joue soi-même le passage ; les deux ensemble : on regarde le robot depuis ce morceau. **Lot GR6 : `?mode=avion|onde|ressort`** commence juste avant la
// première section de ce mode du jour (c'est `?morceau=` avec le morceau que le plan du jour donne : `niveau.ts`) ; avec `&robot` on regarde le robot la jouer ; `?morceau=` l'emporte s'il est là. **Lot GR7 : `?danger=scies|fragiles|lasers`** commence juste avant la première rencontre de ce danger (le morceau que le plan du jour introduit), avec `&robot` on regarde ; `?morceau=` l'emporte, puis `?mode=`, puis `?danger=`. `?jour=AAAA-MM-JJ` (déjà là) choisit le niveau. Ce
// fichier ne contient que la lecture de l'adresse et des constantes : le premier chargement le garde (il sert à `classable`), tout le reste est à la demande (`niveau.ts`, `scene.ts`).

/** Ce que l'adresse demande. */
export interface Essais {
  robot: boolean;
  /** Le numéro du morceau avant lequel commencer (1 à deux tours des cinq thèmes), ou null. */
  morceau: number | null;
  /** Lot GR6 : le mode dont on veut voir la première section (`?mode=`), ou null. */
  mode: ModeEssai | null;
  /** Lot GR7 : le danger dont on veut voir la première rencontre (`?danger=scies|fragiles|lasers`), ou null : la partie commence juste avant. */
  danger: DangerEssai | null;
}
/** Les dangers qu'on peut demander (lot GR7) : les trois premiers ; les écraseurs, plateformes mobiles et projectiles sont pour le GR8. */
export const DANGERS_D_ESSAI = ["scies", "fragiles", "lasers"] as const;
export type DangerEssai = (typeof DANGERS_D_ESSAI)[number];
/** Les modes qu'on peut demander : les trois modes de vol (la gravité est le mode de base). */
export const MODES_D_ESSAI = ["avion", "onde", "ressort"] as const;
export type ModeEssai = (typeof MODES_D_ESSAI)[number];
/** Ce que `niveau.ts` joint au contenu du jour quand un essai est demandé : les changements du bouton du robot et le pas où le joueur reprend la main (0 : dès le début). */
export interface EssaiRecette {
  robot: boolean;
  /** Les pas où le bouton change d'état (appui, relâché, appui…) : la rediffusion du robot. */
  changements: readonly number[];
  depart: number;
}
/** Combien de colonnes avant le morceau demandé la partie commence : douze, de quoi voir le passage venir (une seconde à 12,5 m/s). */
export const COLONNES_AVANT_MORCEAU = 12;
/** Jusqu'où le robot joue quand on le regarde : la première boucle des cinq thèmes et la moitié de la seconde, comme sa preuve de franchissabilité (2 280 m). */
export const DISTANCE_DU_ROBOT = Math.trunc(MORCEAUX_PAR_BOUCLE * LARGEUR_MORCEAU * 1.5);

/** Lit `?robot`, `?morceau=<n>` et `?mode=<mode>` ; **rien en production** (`VITE_PRODUCTION`), un numéro qui n'est pas un entier de 1 à deux tours est ignoré, un mode inconnu aussi. */
export function lireEssais(adresse: string, production: boolean): Essais {
  if (production) return { robot: false, morceau: null, mode: null, danger: null };
  const p = new URLSearchParams(adresse);
  const d = p.get("danger");
  const danger = (DANGERS_D_ESSAI as readonly string[]).includes(d ?? "") ? (d as DangerEssai) : null;
  const m = p.get("mode");
  const mode = (MODES_D_ESSAI as readonly string[]).includes(m ?? "") ? (m as ModeEssai) : null;
  const brut = p.get("morceau");
  const n = brut !== null && /^\d{1,4}$/.test(brut) ? Number(brut) : NaN;
  return { robot: p.has("robot") && p.get("robot") !== "0", morceau: Number.isInteger(n) && n >= 1 && n <= 2 * MORCEAUX_PAR_BOUCLE ? n : null, mode, danger };
}

/** La distance (mètres) à laquelle la partie du joueur commence avant le morceau `n` : douze colonnes avant lui, en comptant les trois colonnes du départ. */
export const distanceAvantMorceau = (n: number): number => Math.max(1, n * LARGEUR_MORCEAU - 3 - COLONNES_AVANT_MORCEAU);

/**
 * Lot GR5 — **un réglage d'essai est-il dans l'adresse ?** (`?vitesse=`, `?plafond=`, `?pente=`, `?gravite=`, `?longueur=`, `?medailles=` : `reglagesEssai.ts`). Seul ce test est du premier chargement (`classable`, `definition.ts`) :
 * **rien en production**, et hors production un paramètre de réglage, même illisible, rend la page non classable (la lecture et la validation des valeurs sont dans `reglagesEssai.ts`, à la demande, avec le niveau).
 */
export const NOMS_DES_REGLAGES = ["vitesse", "plafond", "pente", "courbe", "gravite", "longueur", "medailles"] as const;
/** Lot GR6 : `?mode=` (et, lot GR7, `?danger=`) rend lui aussi la page non classable, même avec une valeur illisible (un essai, jamais une partie du jour). */
const NOMS_D_ESSAI_DE_PARTIE = ["mode", "danger"] as const;
export const aUnReglageDEssai = (adresse: string, production: boolean): boolean => {
  if (production) return false;
  const p = new URLSearchParams(adresse);
  return NOMS_DES_REGLAGES.some((n) => p.has(n)) || NOMS_D_ESSAI_DE_PARTIE.some((n) => p.has(n));
};
