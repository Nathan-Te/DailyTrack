import { parseDay } from "@cdj/core";
import { dailyVertige, rejouer, type Resultat } from "@cdj/vertige-sim";

// Page de vérification sans rendu : rejoue des rediffusions de référence (`packages/vertige-sim/test/fixtures/golden-vertige.json`) avec le code du navigateur. `e2e/determinisme.spec.ts` compare au résultat de Node, au bit près.
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
window.__rejouer = (references) => references.map((r) => ({ nom: r.nom, resultat: rejouer(dailyVertige(parseDay(r.date)!, r.g), r.code) }));
document.documentElement.dataset.ready = "true";
