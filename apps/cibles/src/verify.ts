import { parseDay } from "@cdj/core";
import { dailyCibles, rejouer, type Resultat } from "@cdj/cibles-sim";

// Page de vérification sans rendu : rejoue des rediffusions de référence (`packages/cibles-sim/test/fixtures/golden-cibles.json`) avec le code du navigateur. `e2e/determinisme.spec.ts` compare au résultat de Node, au bit près.
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
window.__rejouer = (references) => references.map((r) => ({ nom: r.nom, resultat: rejouer(dailyCibles(parseDay(r.date)!, r.g), r.code) }));
document.documentElement.dataset.ready = "true";
