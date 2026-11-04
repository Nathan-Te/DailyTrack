// Les SONS de « Blocks » (lot B2), la **décision** : de chaque événement, la liste des notes à jouer (hauteur, durée, forme, niveau). **Pur** : aucun `AudioContext` ici, `sons.ts` ne fait que les lire. Web Audio procédural,
// sans fichier. Le niveau général vient du volume du kit (le volume de la musique commune, et son « couper »).

/** Do₅ : la note de l'effacement au combo ×1. */
export const DO5 = 523.25;
/** Le plus haut palier : au-delà de +12 demi-tons (une octave), le son ne monte plus. */
export const DEMI_TONS_MAX = 12;
/** La hauteur du son d'effacement : **un demi-ton de plus à chaque palier du combo** (×1 : Do₅, ×2 : Do♯₅…). */
export const hauteurEffacement = (combo: number): number => DO5 * 2 ** (Math.min(DEMI_TONS_MAX, Math.max(0, combo - 1)) / 12);

export type FormeOnde = "sine" | "triangle" | "square";
export interface Note {
  /** Le départ, en secondes après le déclenchement. */
  t: number;
  /** La hauteur de départ et d'arrivée (Hz) : un glissement si elles diffèrent. */
  f: number;
  f2: number;
  /** La durée (s) et le niveau de crête (0 à 1, avant le volume). */
  d: number;
  g: number;
  onde: FormeOnde;
}

export type Evenement =
  | { son: "prise" }
  | { son: "pose"; cases: number }
  | { son: "refus" }
  | { son: "effacement"; n: number; combo: number }
  | { son: "combo"; combo: number }
  | { son: "plateauVide" }
  | { son: "fin" };

const note = (t: number, f: number, d: number, g: number, onde: FormeOnde = "sine", f2 = f): Note => ({ t, f, f2, d, g, onde });
/** Les degrés d'un accord majeur qui s'étoffe : une note de plus par ligne ou colonne effacée (1 à 4 et plus). */
const DEGRES = [1, 5 / 4, 3 / 2, 2, 5 / 2];

export function notesDe(e: Evenement): Note[] {
  switch (e.son) {
    case "prise":
      return [note(0, 520, 0.07, 0.22, "sine", 760)];
    case "pose":
      // Un « toc » : plus lourd pour une grande pièce.
      return [note(0, 190, 0.12, 0.45, "triangle", 85), note(0, 1100, 0.03, 0.06 + Math.min(e.cases, 6) * 0.01, "square", 320)];
    case "refus":
      // La pièce revient à sa place : deux notes qui descendent, douces.
      return [note(0, 340, 0.09, 0.2, "sine", 250), note(0.08, 260, 0.13, 0.2, "sine", 170)];
    case "effacement": {
      const h = hauteurEffacement(e.combo);
      const n = Math.min(DEGRES.length, Math.max(1, e.n));
      return Array.from({ length: n }, (_, i) => note(i * 0.055, h * DEGRES[i]!, 0.18, 0.3, "triangle")).concat([note(0, h * 2, 0.24, 0.1, "sine")]);
    }
    case "combo":
      // Un « ting » qui s'ajoute dès le combo ×2 : plus de pépiements aux paliers hauts.
      return e.combo < 2 ? [] : Array.from({ length: Math.min(3, e.combo - 1) }, (_, i) => note(0.14 + i * 0.06, hauteurEffacement(e.combo) * 2 * DEGRES[i + 1]!, 0.12, 0.14, "sine"));
    case "plateauVide":
      return [DO5, DO5 * 1.25, DO5 * 1.5, DO5 * 2, DO5 * 2.5].map((f, i) => note(i * 0.085, f, 0.3, 0.3, "triangle")).concat([note(0.4, DO5 * 4, 0.35, 0.1, "sine")]);
    case "fin":
      return [note(0, 392, 0.22, 0.28, "triangle"), note(0.2, 330, 0.22, 0.28, "triangle"), note(0.4, 262, 0.4, 0.28, "triangle", 247)];
  }
}

/** Le niveau général des effets : le volume du kit (0 à 1) ; 0 si le son est coupé. */
export const niveauEffets = (volume: number, coupe: boolean): number => (coupe || !(volume > 0) ? 0 : Math.min(1, volume));
