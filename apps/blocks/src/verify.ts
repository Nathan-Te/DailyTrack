import { parseDay } from "@cdj/core";
import { estScenario, type Resultat } from "@cdj/blocks-sim";

// Page de vérification sans rendu : rejoue des rediffusions de référence (`packages/blocks-sim/test/fixtures/golden-blocks.json`) avec le code du navigateur. `e2e/determinisme.spec.ts` compare au résultat de Node, au bit près.
export interface Reference {
  nom: string;
  date: string;
  scenario?: string;
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
// Lot B8 — la simulation vient du corps du jeu (`corps.ts`, chargé à la demande) et non d'un import direct : une page de vérification qui importerait elle-même le tirage, la partie et la rediffusion en ferait, avec le corps du jeu, un morceau
// COMMUN que la mesure du budget (qui range les morceaux par leur nom) comptait dans le premier chargement de l'accueil, où il n'est jamais demandé.
void import("./corps").then((c) => {
  window.__rejouer = (references) => references.map((r) => ({ nom: r.nom, resultat: c.rejouer(r.scenario && estScenario(r.scenario) ? c.contenuDeScenario(r.scenario) : c.dailyBlocks(parseDay(r.date)!, r.g), r.code) }));
  document.documentElement.dataset.ready = "true";
});
