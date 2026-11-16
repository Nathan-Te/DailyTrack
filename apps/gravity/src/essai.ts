import { LARGEUR_MORCEAU, MORCEAUX_PAR_BOUCLE, POURCENT_DU_ROBOT, REGLES_COURANTES, TICKS_PAR_SECONDE, type ReglagesEssai } from "@cdj/gravity-sim";

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

// ——— Les réglages d'essai (lot GR5, pour le calibrage du GR6) : **recette seulement, jamais classés, rien en production** ———
// Des paramètres d'adresse pour essayer un calibrage sans déployer : la vitesse de départ de la caméra, son plafond, la pente (de combien de mètres la vitesse gagne 1 m/s), la gravité, la longueur d'un thème en morceaux et le
// pourcentage du score du robot qui fait un seuil de médaille. Ils changent le contenu du jour (`niveau.ts` : `dailyGravity(jour, g, sim, reglages)`) : le terrain, la partie et le robot lisent les règles de ce contenu (`regles.ts`
// du paquet) ; les seuils du fichier de jour ne valent plus (ils sont ceux de la physique normale) : le robot les recalcule en arrière-plan avec ces règles. La partie est marquée `essai` : jamais classée, jamais envoyée,
// et la scène le dit (« Réglage d'essai · départ 8 m/s · gravité 40 », `libellesDesReglages`).

/** Un paramètre : son nom dans l'adresse, la plage permise (hors plage : ignoré, comme `?morceau=`), le nom du champ et la conversion de l'unité du paramètre vers l'unité entière de la simulation. */
interface Parametre {
  nom: string;
  champ: keyof ReglagesEssai;
  min: number;
  max: number;
  /** La clé du catalogue (`essai.reglage.<cle>`). */
  cle: string;
  versSim(v: number): number;
  /** La valeur lisible (l'unité du paramètre) d'après l'unité de la simulation. */
  versLisible(sim: number): number;
  /** Doit-elle être entière dans l'adresse ? */
  entier: boolean;
}
const CASES_PAR_UNITE = 4096;
export const PARAMETRES_D_ESSAI: readonly Parametre[] = [
  { nom: "vitesse", champ: "vitesseBase", cle: "vitesse", min: 2, max: 20, versSim: (v) => Math.round(v * CASES_PAR_UNITE), versLisible: (u) => u / CASES_PAR_UNITE, entier: false },
  { nom: "plafond", champ: "vitesseMax", cle: "plafond", min: 4, max: 30, versSim: (v) => Math.round(v * CASES_PAR_UNITE), versLisible: (u) => u / CASES_PAR_UNITE, entier: false },
  { nom: "pente", champ: "distanceParCran", cle: "pente", min: 20, max: 2000, versSim: (v) => Math.round(v), versLisible: (u) => u, entier: true },
  // la gravité se lit en cases/s² (46) ; la simulation en unités ajoutées à chaque pas (1 570)
  { nom: "gravite", champ: "gravite", cle: "gravite", min: 10, max: 120, versSim: (v) => Math.round((v * CASES_PAR_UNITE) / TICKS_PAR_SECONDE), versLisible: (u) => (u * TICKS_PAR_SECONDE) / CASES_PAR_UNITE, entier: false },
  { nom: "longueur", champ: "morceauxParTheme", cle: "longueur", min: 3, max: 40, versSim: (v) => v, versLisible: (u) => u, entier: true },
  { nom: "medailles", champ: "pourcent", cle: "medailles", min: 10, max: 100, versSim: (v) => Math.round(v), versLisible: (u) => u, entier: true },
];

/**
 * Lit les réglages d'essai de l'adresse : `?vitesse=8&plafond=14&pente=180&gravite=40&longueur=12&medailles=55`. **Rien en production** (`production` : `VITE_PRODUCTION`), une valeur absente, illisible ou hors plage est ignorée
 * (comme `?morceau=`), aucun réglage lu : `null` (la page est celle d'un joueur).
 */
export function lireReglagesEssai(adresse: string, production: boolean): ReglagesEssai | null {
  if (production) return null;
  const p = new URLSearchParams(adresse);
  const r: ReglagesEssai = {};
  for (const q of PARAMETRES_D_ESSAI) {
    const brut = p.get(q.nom);
    if (brut === null || !/^\d{1,4}(\.\d{1,2})?$/.test(brut)) continue;
    const v = Number(brut);
    if (v < q.min || v > q.max || (q.entier && !Number.isInteger(v))) continue;
    r[q.champ] = q.versSim(v);
  }
  return Object.keys(r).length > 0 ? r : null;
}

/** Ce que les réglages changent, en clair : une entrée par réglage **différent** de celui de la version courante (`{ cle, valeur }`, la valeur dans l'unité de l'adresse, arrondie à 0,1), pour la mention de la partie. */
export function libellesDesReglages(r: ReglagesEssai): { cle: string; valeur: number }[] {
  const courant: ReglagesEssai = { ...REGLES_COURANTES, pourcent: POURCENT_DU_ROBOT };
  const sorties: { cle: string; valeur: number }[] = [];
  for (const q of PARAMETRES_D_ESSAI) {
    const v = r[q.champ];
    if (v !== undefined && v !== courant[q.champ]) sorties.push({ cle: q.cle, valeur: Math.round(q.versLisible(v) * 10) / 10 });
  }
  return sorties;
}
