import { parseDay } from "@cdj/core";
import { contenuScenario, dailyRush, decoderRediffusion, jouerJusqua, rejouer, type Resultat, type Scenario } from "@cdj/rush-sim";

// Page de vérification sans rendu : rejoue des rediffusions de référence (`packages/rush-sim/test/fixtures/golden-rush.json`) avec le code du navigateur. `e2e/determinisme.spec.ts` compare au résultat de Node, au bit près :
// le résultat de chaque partie du jour, et l'empreinte de tout l'état (chevalier, monstres, golem, zones) d'un scénario après 3 000 ticks.
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
export interface ScenarioReference {
  nom: string;
  scenario: Scenario;
  monstres: number;
  ameliorations: string[];
  nv: number;
  /** Lot BR3 : le boss (indice) et la phase 2 du scénario `boss`. */
  boss: number;
  phase2: boolean;
  /** Lot BR5 : la compétence du scénario (`&competence=`, 0 : le tourbillon). */
  competence?: number;
  /** Lot BR6 : les types des monstres du scénario `camp` et son élite. */
  ennemis?: number[];
  elite?: boolean;
  code: string;
  ticks: number;
}
export interface RejeuScenario {
  nom: string;
  empreinte: string;
  resultat: Resultat;
}
declare global {
  interface Window {
    __rejouer: (references: Reference[]) => RejeuReference[];
    __scenarios: (references: ScenarioReference[]) => RejeuScenario[];
  }
}
window.__rejouer = (references) => references.map((r) => ({ nom: r.nom, resultat: rejouer(dailyRush(parseDay(r.date)!, r.g), r.code) }));
window.__scenarios = (references) =>
  references.map((r) => {
    const d = decoderRediffusion(r.code);
    const jeu = jouerJusqua(contenuScenario(r.scenario, { monstres: r.monstres, ameliorations: r.ameliorations, nv: r.nv, boss: r.boss, phase2: r.phase2, competence: r.competence, ennemis: r.ennemis ?? [], elite: r.elite ?? false }), d.changements, r.ticks, undefined, d.choix);
    return { nom: r.nom, empreinte: jeu.empreinte, resultat: jeu.resultat };
  });
document.documentElement.dataset.ready = "true";
