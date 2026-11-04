import { parseDay } from "@cdj/core";
import { dailyBlocks, rejouer, type Resultat } from "@cdj/blocks-sim";

// Page de vérification sans rendu : rejoue des rediffusions de référence (`packages/blocks-sim/test/fixtures/golden-blocks.json`) avec le code du navigateur. `e2e/determinisme.spec.ts` compare au résultat de Node, au bit près.
export interface Reference {
  nom: string;
  date: string;
  g: number;
  code: string;
}
export interface RejeuReference {
  nom: string;
  resultat: Resultat;
}
declare global {
  interface Window {
    __rejouer: (references: Reference[]) => RejeuReference[];
  }
}
window.__rejouer = (references) => references.map((r) => ({ nom: r.nom, resultat: rejouer(dailyBlocks(parseDay(r.date)!, r.g), r.code) }));
document.documentElement.dataset.ready = "true";
