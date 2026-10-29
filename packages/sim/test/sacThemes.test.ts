import { describe, expect, it } from "vitest";
import {
  GENERATOR_SAC_THEMES,
  GENERATOR_VERSION,
  MAX_ATTEMPTS,
  MAX_ATTEMPTS_SAC,
  THEME_NAMES,
  dailyCircuit,
  generatorVersionOf,
  parseDay,
  resumeRegistreTrack,
  themeAncien,
  themeForDay,
  themeOccurrence,
} from "../src/index";

// Lot V1 (plateforme) : le sac de thèmes de Track (huit thèmes, cycles de huit jours). La règle commune est testée dans `packages/core/test/sacThemes.test.ts`, pour toutes les positions
// possibles de la bascule ; ici ce qui est propre à Track : le registre des jours donne les jours « anciens » (leur thème ne change jamais), le premier jour du sac lit celui de la veille.

const N = THEME_NAMES.length;
const dernier = parseDay(resumeRegistreTrack().jusqua)!; // le dernier jour que le registre nomme
const premier = dernier + 1; // le premier jour du sac
const suite = (depuis: number, jours: number): string[] => Array.from({ length: jours }, (_, i) => themeForDay(depuis + i).name);
const ecartMax = (s: readonly string[]): number => {
  let max = 0;
  for (const t of THEME_NAMES) {
    let d = -1;
    s.forEach((x, i) => {
      if (x !== t) return;
      if (d >= 0) max = Math.max(max, i - d);
      d = i;
    });
  }
  return max;
};

describe("le sac de thèmes de Track (lot V1)", () => {
  it("la v20 est celle du sac ; la simulation ne change pas", () => {
    expect(GENERATOR_SAC_THEMES).toBe(20);
    expect(GENERATOR_VERSION).toBeGreaterThanOrEqual(GENERATOR_SAC_THEMES);
    expect(generatorVersionOf(premier)).toBe(GENERATOR_VERSION);
  });

  it("365 jours depuis le premier jour du sac : 0 répétition d'un jour à l'autre, 0 alternance A B A, les huit thèmes, aucun ne tarde plus de 2n − 1 jours", () => {
    const s = suite(premier, 365);
    expect(s.filter((x, i) => i > 0 && x === s[i - 1])).toEqual([]);
    expect(s.filter((x, i) => i > 1 && x === s[i - 2])).toEqual([]);
    expect(new Set(s).size).toBe(N);
    expect(ecartMax(s)).toBeLessThanOrEqual(2 * N - 1);
  });

  it("la jonction avec le dernier jour du registre : le premier jour du sac ne répète ni la veille ni l'avant-veille, le suivant pas l'avant-veille (le thème de la veille est lu dans le registre)", () => {
    const veille = themeForDay(dernier).name;
    const avantVeille = themeForDay(dernier - 1).name;
    expect(veille).toBe(themeAncien(dernier).name);
    expect(avantVeille).toBe(themeAncien(dernier - 1).name);
    const [a, b] = suite(premier, 2);
    expect(a).not.toBe(veille);
    expect(a).not.toBe(avantVeille);
    expect(b).not.toBe(a);
    expect(b).not.toBe(veille);
  });

  it("chaque cycle de huit jours (alignés sur le numéro de jour) contient les huit thèmes, une fois ; la jonction de deux cycles ne répète rien", () => {
    const debut = (Math.floor(premier / N) + 2) * N; // à partir du troisième cycle du sac : aucun cycle ne touche le registre
    for (let c = 0; c < 45; c++) {
      const cycle = suite(debut + c * N, N);
      expect([...cycle].sort(), `cycle ${c}`).toEqual([...THEME_NAMES].sort());
      expect(themeForDay(debut + (c + 1) * N).name, `jonction ${c}`).not.toBe(cycle[N - 1]);
      expect(themeForDay(debut + (c + 1) * N + 1).name, `jonction ${c} (A B A)`).not.toBe(cycle[N - 1]);
    }
  });

  it("un jour du registre garde son ancien thème, quelle que soit la dernière version ; une version d'avant le sac imposée aussi", () => {
    for (let d = parseDay("2026-09-01")!; d <= dernier; d++) {
      expect(themeForDay(d).name, `${d}`).toBe(themeAncien(d).name);
      expect(generatorVersionOf(d), `${d}`).toBeLessThan(GENERATOR_SAC_THEMES);
    }
    for (let d = premier; d < premier + 400; d++) expect(themeForDay(d, GENERATOR_SAC_THEMES - 1).name, `${d}`).toBe(themeAncien(d).name);
  });

  it("l'ancienne règle répétait la veille et alternait A B A (ce que le sac supprime)", () => {
    const s = Array.from({ length: 365 }, (_, i) => themeAncien(premier + i).name);
    expect(s.filter((x, i) => i > 0 && x === s[i - 1]).length).toBeGreaterThan(20);
    expect(s.filter((x, i) => i > 1 && x === s[i - 2]).length).toBeGreaterThan(20);
  });

  it("la rotation des vedettes compte les apparitions avec l'ancienne règle avant le sac et avec les thèmes servis ensuite (une apparition de plus à chaque apparition)", () => {
    const jours = Array.from({ length: 200 }, (_, i) => premier + i).filter((d) => themeForDay(d).name === "stade");
    jours.forEach((d, i) => {
      if (i > 0) expect(themeOccurrence(d, "stade"), `${d}`).toBe(themeOccurrence(jours[i - 1]!, "stade") + 1);
    });
  });

  it("le budget de tentatives : 120 pour la v20, 40 avant", () => {
    expect(MAX_ATTEMPTS).toBe(40);
    expect(MAX_ATTEMPTS_SAC).toBe(120);
  });

  it("le Salon et les jours d'essai suivent le sac sans y toucher le registre", () => {
    expect(themeForDay(parseDay("2035-01-01")!).name).toBeDefined();
    expect(dailyCircuit(premier + 1).theme).toBe(themeForDay(premier + 1).name);
  }, 60_000);
});
