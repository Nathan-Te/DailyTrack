import { POURCENT_DU_ROBOT, REGLES_COURANTES, TICKS_PAR_SECONDE, type ReglagesEssai } from "@cdj/gravity-sim";

// Les réglages d'essai (lot GR5, pour le calibrage du GR6), **à la demande** avec le niveau (`niveau.ts`) et la scène : ce fichier n'est pas du premier chargement (`essai.ts` ne garde que `aUnReglageDEssai`).
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
  // lot GR7 : la forme de la courbe de vitesse (1 : linéaire, comme avant le GR7 ; 2 : douce, la courbe d'aujourd'hui) ; l'ancienne courbe : `?vitesse=7&pente=220&courbe=1`
  { nom: "courbe", champ: "courbe", cle: "courbe", min: 1, max: 2, versSim: (v) => Math.round(v), versLisible: (u) => u, entier: true },
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
