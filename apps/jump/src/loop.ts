import { TICK_RATE } from "@cdj/jump-sim";

// Boucle à pas fixe : le temps écoulé entre deux images est découpé en pas de 1/120 s ; le reste sert à interpoler l'affichage
// entre l'état précédent et l'état courant. Un plafond de rattrapage évite la spirale (onglet en arrière-plan, téléphone lent) :
// au-delà, le temps perdu est abandonné et le jeu ralentit plutôt que de geler.

export const STEP_SECONDS = 1 / TICK_RATE;
/** Au plus ce nombre de pas par image (0,25 s de jeu). */
export const MAX_STEPS_PER_FRAME = 30;

export class FixedStepper {
  private acc = 0;

  /** Ajoute `elapsed` secondes et renvoie le nombre de pas à jouer pour cette image. */
  advance(elapsed: number): number {
    if (!(elapsed > 0)) return 0;
    this.acc += Math.min(elapsed, MAX_STEPS_PER_FRAME * STEP_SECONDS);
    let steps = 0;
    // Une marge d'un milliardième de seconde : 2,5 pas + 0,5 pas font bien 3 pas malgré l'arrondi des flottants.
    while (this.acc >= STEP_SECONDS - 1e-9 && steps < MAX_STEPS_PER_FRAME) {
      this.acc = Math.max(0, this.acc - STEP_SECONDS);
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = Math.min(this.acc, STEP_SECONDS); // le surplus est abandonné
    return steps;
  }

  /** Part du pas suivant déjà écoulée, dans [0, 1) : de quoi interpoler l'affichage. */
  get alpha(): number {
    return Math.min(this.acc / STEP_SECONDS, 1);
  }

  reset(): void {
    this.acc = 0;
  }
}
