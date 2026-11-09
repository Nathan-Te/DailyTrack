import type { WidthLetter } from "./track";

// Lot 57b : les outils de notation que les figures et la grammaire des sauts partagent (`figures.ts` lit `grammaire.ts` pour y ranger ses éléments ; elle ne peut donc pas
// les lire dans `figures.ts`).

/** Bloc de transition de largeur (une ligne droite de 32 m dont les rebords s'écartent ou se resserrent en douceur). */
export const transition = (from: WidthLetter, to: WidthLetter) => `S/${from}>${to}`;

const WIDTH_ORDER: readonly WidthLetter[] = ["e", "n", "l"];

/** Blocs de transition pour passer d'une largeur à une autre, un cran à la fois (aucun si elles sont égales). */
export function reach(from: WidthLetter, to: WidthLetter): string[] {
  const out: string[] = [];
  let i = WIDTH_ORDER.indexOf(from);
  const j = WIDTH_ORDER.indexOf(to);
  while (i !== j) {
    const next = i < j ? i + 1 : i - 1;
    out.push(transition(WIDTH_ORDER[i]!, WIDTH_ORDER[next]!));
    i = next;
  }
  return out;
}

