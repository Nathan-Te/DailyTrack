import { moteurA } from "../lab/a/moteurA";
import { chargerMoteurB } from "../lab/b/moteurB";
import { BANC_CONFIG, bancEmpreinte, rejouerBanc, rejouerTour } from "../lab/banc";
import type { Engine } from "../lab/interface";

// Les empreintes de référence, calculées par Node (`fixtures/banc-golden.json`). Les navigateurs doivent retrouver exactement les mêmes (apps/tower/e2e/determinisme.spec.ts).
export interface GoldenMoteur {
  banc: { empreinte: string; traces: { tick: number; empreinte: string }[]; tombees: number; ticks: number };
  tour: { empreinte: string; traces: { tick: number; empreinte: string }[] };
}
export interface Golden {
  commandes: string;
  a: GoldenMoteur;
  b: GoldenMoteur;
}

export const TRACE = 300;
export const SECONDES_TOUR = 30;

export function calculerMoteur(e: Engine): GoldenMoteur {
  const r = rejouerBanc(e, { trace: TRACE });
  const t = rejouerTour(e, BANC_CONFIG, SECONDES_TOUR, TRACE);
  return { banc: { empreinte: r.empreinte, traces: r.traces, tombees: r.tombees, ticks: r.ticks }, tour: { empreinte: t.empreinte, traces: t.traces } };
}

export async function calculerGolden(): Promise<Golden> {
  return { commandes: bancEmpreinte(), a: calculerMoteur(moteurA()), b: calculerMoteur(await chargerMoteurB()) };
}
