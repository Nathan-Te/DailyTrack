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

declare global {
  interface Window {
    __verifier: (moteur: NomMoteur) => Promise<Verification>;
  }
}

window.__verifier = async (nom) => {
  const e = await charger(nom);
  const t0 = performance.now();
  const r = rejouerBanc(e, { trace: 300 });
  const tour = rejouerTour(e, DEFAULT_CONFIG, 30, 300);
  return { banc: { empreinte: r.empreinte, traces: r.traces, tombees: r.tombees, ticks: r.ticks }, tour: { empreinte: tour.empreinte, traces: tour.traces }, ms: performance.now() - t0 };
};

document.getElementById("status")!.textContent = "Prête.";
document.documentElement.dataset.ready = "true";
