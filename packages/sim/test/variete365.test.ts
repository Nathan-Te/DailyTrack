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
    // Mêmes limites que `generator.test.ts` (« construit vite » : moyenne < 0,8 s, pire < 4,5 s depuis le lot V1) : la CI (2 cœurs, tests en parallèle) va deux à trois fois
    // moins vite qu'en local. Mesuré (lot V2) sur ces 365 jours : pire 562 ms en local ; la première version des fiches (Stade tout en courbes amples, Nuit très sautée)
    // donnait 1 424 ms en local et 3 617 ms en CI (les circuits trop longs coûtaient des tentatives) : elles ont été adoucies. Sur trois années, le pire jour de la v21 vaut
    // 1 667 ms en local (une Nuit de juin 2028, 48 tentatives), celui de la v20 1 074 ms.
    expect(moyenne).toBeLessThan(800);
    expect(ms[364]!).toBeLessThan(4500);
  });
});
