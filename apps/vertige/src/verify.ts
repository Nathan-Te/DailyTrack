import { parseDay } from "@cdj/core";
import { decoderRediffusion, empreinteContenu, empreinteNiveau, verifier, type NomNiveau, type Resultat } from "@cdj/vertige-sim";
import { assemblerCles, dailyVertige, enregistrerEnchainement } from "@cdj/vertige-sim/modules";

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
export interface JourDeReference {
  date: string;
  empreinte: string;
  modules: readonly string[];
  ticksRobot: number;
  niveau: string;
}
declare global {
  interface Window {
    /** Lot V3 : le contenu des jours demandés tel que le navigateur le génère (les modules, le temps du robot, l'empreinte du contenu et du niveau assemblé) et le temps de génération de chacun (ms). */
    __jours: (dates: string[]) => { jours: JourDeReference[]; ms: number[] };
    __rejouer: (references: Reference[]) => RejeuReference[];
    __mesurerRejeu: (references: Reference[], fois: number) => number;
  }
}
enregistrerEnchainement(); // le scénario « enchainement » du golden (lot V2)
const rejouerUne = (r: Reference): RejeuReference => {
  const v = verifier(r.scenario ? { niveau: r.scenario as NomNiveau } : dailyVertige(parseDay(r.date)!, r.g), decoderRediffusion(r.code).commandes);
  return { nom: r.nom, resultat: v.resultat, empreintes: v.empreintes };
};
window.__jours = (dates) => {
  const ms: number[] = [];
  const jours = dates.map((date): JourDeReference => {
    const t0 = performance.now();
    const c = dailyVertige(parseDay(date)!);
    const niveau = empreinteNiveau(assemblerCles(c.modules!).niveau);
    ms.push(performance.now() - t0);
    return { date, empreinte: empreinteContenu(c), modules: c.modules!, ticksRobot: c.ticksRobot!, niveau };
  });
  return { jours, ms };
};
window.__rejouer = (references) => references.map(rejouerUne);
window.__mesurerRejeu = (references, fois) => {
  const t0 = performance.now();
  for (let i = 0; i < fois; i++) for (const r of references) rejouerUne(r);
  return performance.now() - t0;
};
document.documentElement.dataset.ready = "true";
