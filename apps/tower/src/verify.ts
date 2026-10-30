import { parseDay } from "@cdj/core";
import { dailyTower, empreinteVue, rejouerComplet, type Resultat, SCENARIO_ESSAI } from "@cdj/tower-sim";
import { rejouerBanc, rejouerTour, type ResultatBanc } from "@cdj/tower-sim/lab/banc";
import { DEFAULT_CONFIG } from "@cdj/tower-sim/lab/interface";
import { charger, type NomMoteur } from "./moteurs";

// Page de test sans rendu (lot T0) : rejoue le banc d'essai et la tour propre avec le moteur demandé et rend les empreintes de l'état. Le test de navigateur
// `e2e/determinisme.spec.ts` les compare à celles de Node (`packages/tower-sim/test/fixtures/banc-golden.json`), au bit près, dans Chromium, Firefox et WebKit.
// Aucun paramètre d'adresse : tout passe par `window.__verifier`.

export interface Verification {
  banc: Pick<ResultatBanc, "empreinte" | "traces" | "tombees" | "ticks">;
  tour: { empreinte: string; traces: { tick: number; empreinte: string }[] };
  /** Durée du banc dans CE navigateur, en ms (information, jamais comparée). */
  ms: number;
}

/** Lot T2 : une rediffusion de référence à rejouer (le golden `golden-tower.json`) et ce que le navigateur en tire. */
export interface Reference {
  nom: string;
  contenu: { scenario: string } | { date: string };
  code: string;
}
export interface RejeuReference {
  nom: string;
  resultat: Resultat;
  empreinteFinale: string;
  paliers: number;
  /** Durée du rejeu dans CE navigateur, en ms (information, jamais comparée). */
  ms: number;
}

declare global {
  interface Window {
    __verifier: (moteur: NomMoteur) => Promise<Verification>;
    __rejouer: (references: Reference[]) => Promise<RejeuReference[]>;
  }
}

window.__verifier = async (nom) => {
  const e = await charger(nom);
  const t0 = performance.now();
  const r = rejouerBanc(e, { trace: 300 });
  const tour = rejouerTour(e, DEFAULT_CONFIG, 30, 300);
  return { banc: { empreinte: r.empreinte, traces: r.traces, tombees: r.tombees, ticks: r.ticks }, tour: { empreinte: tour.empreinte, traces: tour.traces }, ms: performance.now() - t0 };
};

// Lot T2 : rejoue les rediffusions de référence avec le Rapier du navigateur (le même `.wasm` que le jeu) ; le test de navigateur compare à Node, au bit près.
window.__rejouer = async (references) => {
  const R = await (await import("@cdj/tower-sim/rapier")).chargerRapier();
  return references.map((ref) => {
    const t0 = performance.now();
    const contenu = "scenario" in ref.contenu ? SCENARIO_ESSAI : dailyTower(parseDay(ref.contenu.date)!);
    const r = rejouerComplet(R, contenu, ref.code);
    return { nom: ref.nom, resultat: r.resultat, empreinteFinale: empreinteVue(r.vue), paliers: r.vue.declenches, ms: performance.now() - t0 };
  });
};

document.getElementById("status")!.textContent = "Prête.";
document.documentElement.dataset.ready = "true";
