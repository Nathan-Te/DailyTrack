import { describe, expect, it } from "vitest";
import { AUTHOR_MAX_MS, AUTHOR_MIN_MS, GENERATOR_VERSION, dailyCircuit, daysFromCivil, formatDay } from "../src/index";

// Lot V2 (Track) : la validité du générateur v21 sur 365 graines (un an de jours, loin devant : le registre ne les nommera pas avant longtemps, la version est imposée), et son
// temps de génération. Le pilote de l'auteur finit chacun des 365 circuits (jamais le circuit de secours), dans la fenêtre de 30 à 40 s.
const DEBUT = daysFromCivil(2029, 1, 1);

describe("générateur v21 : 365 graines", () => {
  it("le pilote de l'auteur finit 365 circuits sur 365, dans la fenêtre 30–40 s ; temps de génération mesuré", { timeout: 900_000 }, () => {
    const ms: number[] = [];
    const secours: string[] = [];
    for (let i = 0; i < 365; i++) {
      const t0 = performance.now();
      const c = dailyCircuit(DEBUT + i, 0, null, GENERATOR_VERSION);
      ms.push(performance.now() - t0);
      if (c.fallback) secours.push(formatDay(c.day));
      else {
        expect(c.authorMs, c.date).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
        expect(c.authorMs, c.date).toBeLessThanOrEqual(AUTHOR_MAX_MS);
      }
    }
    expect(secours).toEqual([]);
    ms.sort((a, b) => a - b);
    const moyenne = ms.reduce((a, b) => a + b, 0) / ms.length;
    console.log(`v${GENERATOR_VERSION}, 365 graines : génération moyenne ${moyenne.toFixed(0)} ms, médiane ${ms[182]!.toFixed(0)} ms, pire ${ms[364]!.toFixed(0)} ms`);
    // Mêmes limites que `generator.test.ts` (« construit vite ») : la CI (2 cœurs, tests en parallèle) va deux à trois fois moins vite que cette mesure.
    expect(moyenne).toBeLessThan(800);
    expect(ms[364]!).toBeLessThan(3500);
  });
});
