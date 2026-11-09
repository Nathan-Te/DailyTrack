import { describe, expect, it } from "vitest";
import { THEME_NAMES, empreinte, ressemblance, sautDansLAxe, themeForDay } from "../src/index";
import { V23, circuit23, genMs23, noms23, sautsDe, themeDays23 } from "./helpers/grammaire23";

// Lot 57b : avant (v22) et après (v23), sur les mêmes jours (le thème de chaque jour est celui de la v23) — la part des sauts « droite → tremplin → axe », la ressemblance des
// circuits (lot 49) et le temps de génération. Mesuré (README du lot 57b) : voir ce fichier pour les seuils.
describe("lot 57b : la part des sauts « droite → tremplin → axe », avant (v22) et après (v23), sur 60 jours par thème", () => {
  const jours = themeDays23(60);

  it("la part des sauts dans l'axe baisse (tous thèmes), et aucun circuit n'en a plus d'un", () => {
    let axe22 = 0;
    let sauts22 = 0;
    let axe23 = 0;
    let sauts23 = 0;
    let plusDUn22 = 0;
    for (const theme of THEME_NAMES)
      for (const d of jours.get(theme)!) {
        const a = sautsDe(circuit23(d, 22));
        const b = sautsDe(circuit23(d, V23));
        axe22 += a.filter(sautDansLAxe).length;
        sauts22 += a.length;
        axe23 += b.filter(sautDansLAxe).length;
        sauts23 += b.length;
        if (a.filter(sautDansLAxe).length > 1) plusDUn22++;
        expect(b.filter(sautDansLAxe).length).toBeLessThanOrEqual(1);
      }
    const msg = JSON.stringify({ v22: { axe: axe22, sauts: sauts22, part: axe22 / sauts22, circuitsAvecPlusDUn: plusDUn22 }, v23: { axe: axe23, sauts: sauts23, part: axe23 / sauts23 } });
    expect(axe23 / sauts23, msg).toBeLessThan(axe22 / sauts22);
    expect(axe23, msg).toBeLessThan(axe22);
  }, 900_000);
});

describe("lot 57b : la ressemblance et le temps de génération, avant (v22) et après (v23), sur les mêmes jours", () => {
  const N = 15;
  const days = [...themeDays23(N).values()].flat();
  const mesure = (g: number) => {
    const p = days.map((d) => ({ theme: themeForDay(d, V23).name, e: empreinte({ spec: circuit23(d, g).spec, figures: noms23(circuit23(d, g)) }) }));
    const cross: number[] = [];
    const all: number[] = [];
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        const r = ressemblance(p[i]!.e, p[j]!.e).total;
        all.push(r);
        if (p[i]!.theme !== p[j]!.theme) cross.push(r);
      }
    const consecutive: number[] = [];
    const memeTheme: number[] = [];
    for (const theme of THEME_NAMES) {
      const q = p.filter((x) => x.theme === theme);
      for (let i = 1; i < q.length; i++) consecutive.push(ressemblance(q[i - 1]!.e, q[i]!.e).total);
      for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) memeTheme.push(ressemblance(q[i]!.e, q[j]!.e).total);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    return { cross: mean(cross), all: mean(all), memeTheme: mean(memeTheme), consecutive: mean(consecutive), consecutiveMax: Math.max(...consecutive) };
  };

  it("la ressemblance (lot 49) ne monte pas : toutes paires, entre thèmes, dans un même thème et entre jours consécutifs d'un même thème (5 % au plus), aucune paire au-dessus de 0,35", () => {
    const avant = mesure(22);
    const apres = mesure(V23);
    const msg = JSON.stringify({ avant, apres });
    expect(apres.all, msg).toBeLessThanOrEqual(1.05 * avant.all);
    expect(apres.cross, msg).toBeLessThanOrEqual(1.05 * avant.cross);
    expect(apres.memeTheme, msg).toBeLessThanOrEqual(1.05 * avant.memeTheme);
    expect(apres.consecutive, msg).toBeLessThanOrEqual(1.05 * avant.consecutive);
    expect(apres.consecutiveMax, msg).toBeLessThan(0.35);
  }, 900_000);

  it("le temps de génération (un circuit, le calcul du fil de travail, sous Node) : la moyenne de la v23 ne dépasse pas celle de la v22 de plus de 30 % (mesuré : +5 à +20 %, README du lot 57b)", () => {
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const ms = (g: number) =>
      days.map((d) => {
        circuit23(d, g);
        return genMs23.get(`${g}:${d}`)!;
      });
    const ms22 = ms(22);
    const ms23 = ms(V23);
    expect(mean(ms23), `v22 ${mean(ms22).toFixed(0)} ms, v23 ${mean(ms23).toFixed(0)} ms`).toBeLessThan(1.3 * mean(ms22));
  }, 900_000);
});
