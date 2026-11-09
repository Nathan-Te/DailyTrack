import { describe, expect, it } from "vitest";
import { THEME_NAMES, empreinte, ressemblance, themeForDay } from "../src/index";
import { V22, circuit, genMs, names, themeDays } from "./helpers/blocs58";

// Lot 58 : la ressemblance et le temps de génération, avant (v21) et après (v22, les familles de blocs nouveaux), sur les mêmes jours (le thème de chaque
// jour est celui de la v22). Mesuré (25 jours par thème, README du lot) : entre thèmes 0,052 → 0,048 ; toutes paires 0,065 → 0,062 ; jours consécutifs d'un
// même thème 0,118 → 0,119 (pire 0,285 → 0,275) ; génération 258 → 397 ms en moyenne (Node, ×1,5 ; la Nuit et le Canyon ×2).
describe("lot 58 : la ressemblance et le temps de génération, avant (v21) et après (v22), sur les mêmes jours", () => {
  const N = 15;
  const days = [...themeDays(N).values()].flat();
  const mesure = (g: number) => {
    const p = days.map((d) => ({ theme: themeForDay(d, V22).name, e: empreinte({ spec: circuit(d, g).spec, figures: names(circuit(d, g)) }) }));
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

  it("la ressemblance baisse entre thèmes et sur toutes les paires ; celle des jours consécutifs d'un même thème ne monte pas (5 % au plus), aucune paire au-dessus de 0,35", () => {
    const avant = mesure(21);
    const apres = mesure(V22);
    const msg = JSON.stringify({ avant, apres });
    expect(apres.cross, msg).toBeLessThan(avant.cross);
    expect(apres.all, msg).toBeLessThan(avant.all);
    expect(apres.consecutive, msg).toBeLessThanOrEqual(1.05 * avant.consecutive);
    expect(apres.consecutiveMax, msg).toBeLessThan(0.35);
  }, 600_000);

  it("le temps de génération (un circuit, le calcul du fil de travail) : moyenne au plus 1,8 fois celle de la v21 (mesuré : ×1,5)", () => {
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const ms = (g: number) =>
      days.map((d) => {
        circuit(d, g);
        return genMs.get(`${g}:${d}`)!;
      });
    const ms21 = ms(21);
    const ms22 = ms(V22);
    expect(mean(ms22), `v21 ${mean(ms21).toFixed(0)} ms, v22 ${mean(ms22).toFixed(0)} ms`).toBeLessThan(1.8 * mean(ms21));
  }, 600_000);
});
