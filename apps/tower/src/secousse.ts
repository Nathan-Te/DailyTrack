import { mouvementReduit } from "./mouvement";

// La secousse de caméra (lot T5), **affichage seulement** : une pièce perdue secoue la vue ≈ 200 ms ; une cascade (plusieurs pièces d'affilée) plus fort et un peu plus long. Elle s'éteint
// en ligne droite ; le décalage est tiré du hasard d'affichage. **Absente si `prefers-reduced-motion` est actif** (`mouvement.ts`), et réglable (`intensite`, 0 la coupe) par `?debug&tune`.

export const DUREE_SECOUSSE_MS = 200;
export const DUREE_CASCADE_MS = 320;
/** Amplitude de crête, en mètres du monde (≈ 3 px et 8 px à 20 px par mètre). */
export const AMPLITUDE = { perte: 0.15, cascade: 0.4, taquet: 0.1 } as const;
/** Lot T9 — la micro-secousse du choc d'un taquet : 80 ms (≈ 2 px à 20 px par mètre). */
export const DUREE_TAQUET_MS = 80;

export class Secousse {
  private restant = 0;
  private duree = 1;
  private amplitude = 0;

  constructor(
    private readonly hasard: () => number,
    private readonly reduit: () => boolean = () => mouvementReduit(),
    /** Le facteur du réglage de rendu (1 : normal, 0 : coupée). */
    private readonly intensite: () => number = () => 1,
  ) {}

  /** Une pièce perdue (`cascade` faux), ou une cascade (vrai). Sans effet avec le mouvement réduit ou une intensité nulle. */
  declencher(cascade: boolean): void {
    const k = this.intensite();
    if (this.reduit() || k <= 0) return;
    const a = (cascade ? AMPLITUDE.cascade : AMPLITUDE.perte) * k;
    const d = cascade ? DUREE_CASCADE_MS : DUREE_SECOUSSE_MS;
    // Une secousse en cours n'est pas raccourcie ni affaiblie par une plus faible.
    if (a >= this.amplitude * (this.restant / this.duree)) {
      this.amplitude = a;
      this.duree = d;
      this.restant = d;
    }
  }

  /** Lot T9 — la micro-secousse du choc d'un taquet : 80 ms, `facteur` (le curseur du taquet fois le réglage du joueur) la module. Rien avec le mouvement réduit ni un facteur nul ; elle n'écrase pas une secousse plus forte. */
  declencherTaquet(facteur: number): void {
    if (this.reduit() || facteur <= 0) return;
    const a = AMPLITUDE.taquet * facteur;
    if (a >= this.amplitude * (this.restant / this.duree)) {
      this.amplitude = a;
      this.duree = DUREE_TAQUET_MS;
      this.restant = DUREE_TAQUET_MS;
    }
  }

  get active(): boolean {
    return this.restant > 0;
  }

  /** Avance de `dtMs` ; rend le décalage de la caméra (mètres). */
  avancer(dtMs: number): { x: number; y: number } {
    if (this.restant <= 0) return { x: 0, y: 0 };
    this.restant = Math.max(0, this.restant - dtMs);
    const k = (this.restant / this.duree) * this.amplitude;
    return { x: (this.hasard() * 2 - 1) * k, y: (this.hasard() * 2 - 1) * k };
  }

  arreter(): void {
    this.restant = 0;
  }
}
