import { describe, expect, it } from "vitest";
import { THEME_NAMES, dailyCircuit, empreinte, ressemblance, themeForDay, type DailyCircuit } from "../src/index";
import { genMs, names, themeDays, v18 } from "./helpers/identite";

// Lot 49 : la ressemblance et le temps de génération, avant (v17) et après (v18) ; la mesure complète : `IDENTITE=1 npm run measure:generator`.
describe("lot 49 : la ressemblance et le temps de génération, avant (v17) et après (v18), sur les mêmes jours", () => {
  // Quinze jours par thème (120 circuits par version) : la mesure du README en prend 25 ; les seuils sont pris sous les gains mesurés.
  const N = 15;
  const days = [...themeDays(N).values()].flat();
  const before = new Map<number, { c: DailyCircuit; ms: number }>();
  for (const d of days) {
    const t0 = performance.now();
    const c = dailyCircuit(d, 0, null, 17);
    before.set(d, { c, ms: performance.now() - t0 });
  }
  const mesure = (get: (d: number) => DailyCircuit) => {
    const p = days.map((d) => ({ d, theme: themeForDay(d).name, e: empreinte({ spec: get(d).spec, figures: names(get(d)) }) }));
    const cross: number[] = [];
    const all: number[] = [];
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        const r = ressemblance(p[i]!.e, p[j]!.e).total;
        all.push(r);
        if (p[i]!.theme !== p[j]!.theme) cross.push(r);
      }
    const consecutive: number[] = [];
    for (const theme of THEME_NAMES) {
      const q = p.filter((x) => x.theme === theme);
      for (let i = 1; i < q.length; i++) consecutive.push(ressemblance(q[i - 1]!.e, q[i]!.e).total);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    return { cross: mean(cross), all: mean(all), consecutive: mean(consecutive), consecutiveMax: Math.max(...consecutive) };
  };

  it("la ressemblance baisse : entre thèmes, toutes paires et jours consécutifs d'un même thème ; aucune paire de jours consécutifs au-dessus de 0,5", () => {
    const avant = mesure((d) => before.get(d)!.c);
    const apres = mesure(v18);
    // Mesuré (25 par thème, README) : entre thèmes 0,091 → 0,059 ; toutes paires 0,102 → 0,073 ; jours consécutifs 0,179 → 0,135 (pire 0,750 → 0,308).
    expect(apres.cross, JSON.stringify({ avant, apres })).toBeLessThan(0.8 * avant.cross);
    expect(apres.all).toBeLessThan(0.85 * avant.all);
    expect(apres.consecutive).toBeLessThan(0.9 * avant.consecutive);
    expect(apres.consecutiveMax).toBeLessThan(0.5);
  }, 300_000);

  it("le temps de génération (un circuit, le calcul du fil de travail) reste du même ordre : moyenne au plus 1,6 fois celle de la v17", () => {
    const ms18 = days.map((d) => {
      v18(d);
      return genMs.get(d)!;
    });
    const ms17 = days.map((d) => before.get(d)!.ms);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    // Mesuré (README) : 127 → 161 ms en moyenne (Node).
    expect(mean(ms18), `v17 ${mean(ms17).toFixed(0)} ms, v18 ${mean(ms18).toFixed(0)} ms`).toBeLessThan(1.6 * mean(ms17));
  }, 300_000);
});
