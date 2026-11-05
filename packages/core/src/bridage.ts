// Lot Q1 — « appareil bridé à 30 images par seconde » : un iPhone en mode économie d'énergie, Chrome en « Économiseur d'énergie » sur batterie
// plafonnent `requestAnimationFrame` à 30 i/s, quelle que soit la puissance de l'appareil. L'intervalle entre images vaut alors ~33 ms alors que le
// fil principal n'a presque rien à faire : ce n'est pas un appareil lent, et un jeu ne doit ni alléger sa scène ni s'en prendre à lui. Logique **pure**
// (aucun DOM, aucune horloge : le jeu donne les durées), testée sous Node (`test/bridage.test.ts`). Module à part (`@cdj/core/bridage`) : un jeu ne
// le charge que s'il s'en sert, jamais avec le reste du socle.
//
// Règle : sur 2 s de rendu, intervalle **médian** entre 31 et 36 ms **et** travail moyen par image sous 10 ms. Un appareil vraiment lent à 30 i/s a un travail
// par image qui remplit l'intervalle (plus de 10 ms) : il n'est pas déclaré bridé.

/** Durée de rendu observée avant de rendre un verdict (ms). */
export const BRIDAGE_FENETRE_MS = 2000;
/** L'intervalle médian d'un affichage à 30 i/s (ms) : 33,3 ms, avec la marge des écrans et des horloges. */
export const BRIDAGE_MEDIANE_MIN_MS = 31;
export const BRIDAGE_MEDIANE_MAX_MS = 36;
/** Travail moyen du fil principal par image (ms) au-delà duquel l'appareil est chargé, pas bridé. */
export const BRIDAGE_TRAVAIL_MAX_MS = 10;
/** Une image plus longue n'est pas une mesure (onglet caché, pause, écran verrouillé). */
export const BRIDAGE_IMAGE_IGNOREE_MS = 250;
/** On ne refait le calcul (un tri) qu'après ce temps de rendu. */
const REEVALUER_MS = 500;

/** Une image : l'intervalle depuis la précédente et le travail du fil principal pour la dessiner (ms). */
export interface EchantillonImage {
  intervalleMs: number;
  travailMs: number;
}

/** Médiane (la moyenne des deux valeurs du milieu pour un nombre pair) ; `NaN` si la liste est vide. */
export function mediane(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return Number.NaN;
  const tri = [...valeurs].sort((a, b) => a - b);
  const m = tri.length >> 1;
  return tri.length % 2 ? tri[m]! : (tri[m - 1]! + tri[m]!) / 2;
}

/**
 * Les images d'une fenêtre de rendu montrent-elles un affichage bridé à 30 i/s ? Faux si la fenêtre n'a pas encore 2 s de rendu, ou si une image
 * ne compte pas (> 250 ms : elle est écartée avant, par `DetecteurBridage`).
 */
export function bridePar30(images: readonly EchantillonImage[]): boolean {
  let duree = 0;
  let travail = 0;
  for (const i of images) {
    duree += i.intervalleMs;
    travail += i.travailMs;
  }
  if (images.length === 0 || duree < BRIDAGE_FENETRE_MS) return false;
  const med = mediane(images.map((i) => i.intervalleMs));
  return med >= BRIDAGE_MEDIANE_MIN_MS && med <= BRIDAGE_MEDIANE_MAX_MS && travail / images.length < BRIDAGE_TRAVAIL_MAX_MS;
}

/**
 * Le détecteur d'un jeu : on lui donne chaque image dessinée, il garde les 2 dernières secondes et tient `bride` à jour. Le verdict **suit l'appareil** :
 * il redevient faux quand le mode économie d'énergie est coupé (la fenêtre se renouvelle en 2 s).
 */
export class DetecteurBridage {
  private images: EchantillonImage[] = [];
  private duree = 0;
  private depuis = 0;
  private verdict = false;

  /** Vrai tant que l'affichage paraît limité à 30 images par seconde. */
  get bride(): boolean {
    return this.verdict;
  }

  /** Une image : `intervalleMs` depuis la précédente, `travailMs` de fil principal. Rend vrai si le verdict a changé. */
  observe(intervalleMs: number, travailMs: number): boolean {
    if (!(intervalleMs > 0) || intervalleMs > BRIDAGE_IMAGE_IGNOREE_MS || !(travailMs >= 0)) return false;
    this.images.push({ intervalleMs, travailMs });
    this.duree += intervalleMs;
    this.depuis += intervalleMs;
    // Garde 2 s de rendu, pas plus : les plus anciennes images sortent tant que le reste couvre encore la fenêtre.
    while (this.images.length > 1 && this.duree - this.images[0]!.intervalleMs >= BRIDAGE_FENETRE_MS) this.duree -= this.images.shift()!.intervalleMs;
    if (this.depuis < REEVALUER_MS) return false;
    this.depuis = 0;
    const avant = this.verdict;
    this.verdict = bridePar30(this.images);
    return this.verdict !== avant;
  }

  /** L'onglet revient d'une longue absence : les images d'avant ne disent plus rien de l'appareil. */
  reset(): void {
    this.images = [];
    this.duree = 0;
    this.depuis = 0;
    this.verdict = false;
  }
}
