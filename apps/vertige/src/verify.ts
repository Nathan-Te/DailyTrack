import { parseDay } from "@cdj/core";
import { dailyVertige, decoderRediffusion, verifier, type NomNiveau, type Resultat } from "@cdj/vertige-sim";
import { enregistrerEnchainement } from "@cdj/vertige-sim/modules";

// Page de vérification sans rendu : rejoue des rediffusions de référence (`packages/vertige-sim/test/fixtures/golden-vertige.json`) avec le code du navigateur et rend le résultat ET les empreintes de l'état tous les
// 600 pas. `e2e/determinisme.spec.ts` compare à Node, au bit près. `window.__mesurerRejeu` rejoue une partie de `pas` pas (les mesures du lot) et rend la durée.
export interface Reference {
  nom: string;
  scenario: string | null;
  date: string;
  g: number;
  code: string;
}
export interface RejeuReference {
  nom: string;
  resultat: Resultat;
  empreintes: string[];
}
declare global {
  interface Window {
    __rejouer: (references: Reference[]) => RejeuReference[];
    __mesurerRejeu: (references: Reference[], fois: number) => number;
  }
}
enregistrerEnchainement(); // le scénario « enchainement » du golden (lot V2)
const rejouerUne = (r: Reference): RejeuReference => {
  const niveau = (r.scenario ?? dailyVertige(parseDay(r.date)!, r.g).niveau) as NomNiveau;
  const v = verifier({ niveau }, decoderRediffusion(r.code).commandes);
  return { nom: r.nom, resultat: v.resultat, empreintes: v.empreintes };
};
window.__rejouer = (references) => references.map(rejouerUne);
window.__mesurerRejeu = (references, fois) => {
  const t0 = performance.now();
  for (let i = 0; i < fois; i++) for (const r of references) rejouerUne(r);
  return performance.now() - t0;
};
document.documentElement.dataset.ready = "true";
