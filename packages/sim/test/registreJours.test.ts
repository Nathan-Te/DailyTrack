import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANCRE_V18,
  GENERATOR_VERSION,
  OLDEST_GENERATOR,
  PREMIER_JOUR,
  SIM_VERSION,
  THEME_NAMES,
  dailyCircuit,
  dailyTrackId,
  generatorVersionOf,
  parseDay,
  salonCircuit,
  themeForDay,
  themeOccurrence,
  vedetteOf,
  THEMES,
  themeOfVersion,
  type RegistreJoursTrack,
} from "../src/index";

// Lot R11 : le registre des jours de Track (`src/jours-track.json`). Écrit par « Mettre en production » (job `figer`), jamais par un lot ; ce fichier ne vérifie que sa forme et ce qu'en
// fait `generatorVersionOf`. Que ses jours ne changent pas : `apps/api/test/jours-passes.test.ts` (empreintes) ; qu'il s'accorde avec elles : le même fichier.
const registre = JSON.parse(readFileSync(join(import.meta.dirname, "../src/jours-track.json"), "utf8")) as RegistreJoursTrack;
const plages = registre.plages.map((p) => ({ ...p, jour: parseDay(p.du)!, fin: parseDay(p.au)! }));
const dernier = parseDay(registre.jusqua)!;

describe("le registre des jours de Track (lot R11)", () => {
  it("a la forme que la mise en production écrit : plages ordonnées, sans recouvrement, de versions connues, jamais au-delà de `jusqua` ; deux plages qui se touchent ont deux versions", () => {
    expect(registre.format).toBe(1);
    expect(plages.length).toBeGreaterThan(0);
    expect(Object.keys(registre).sort()).toEqual(["format", "jusqua", "plages"]);
    plages.forEach((p, i) => {
      expect(Object.keys(p).filter((k) => k !== "jour" && k !== "fin").sort(), p.du).toEqual(["au", "du", "g", "sim"]);
      expect(Number.isInteger(p.g) && p.g >= OLDEST_GENERATOR && p.g <= GENERATOR_VERSION, `${p.du} : v${p.g}`).toBe(true);
      expect(Number.isInteger(p.sim) && p.sim >= 1 && p.sim <= SIM_VERSION, `${p.du} : sim ${p.sim}`).toBe(true);
      expect(p.fin, p.du).toBeGreaterThanOrEqual(p.jour);
      expect(p.fin, p.du).toBeLessThanOrEqual(dernier);
      if (i > 0) {
        const avant = plages[i - 1]!;
        expect(p.jour, `${p.du} après ${avant.au}`).toBeGreaterThan(avant.fin);
        // Un trou = des jours sans résultat (régénérés par la mise en production) ; sans trou, la même version se fond en une seule plage.
        if (p.jour === avant.fin + 1) expect(`${p.g}/${p.sim}`, `${p.du} : deux plages voisines de même version se fondent en une`).not.toBe(`${avant.g}/${avant.sim}`);
      }
    });
  });

  it("commence avant le premier circuit (les jours d'essai d'avant la mise en ligne ont toujours eu la v15)", () => {
    expect(plages[0]!.jour).toBeLessThanOrEqual(PREMIER_JOUR);
    expect(generatorVersionOf(PREMIER_JOUR)).toBe(plages.find((p) => p.jour <= PREMIER_JOUR)!.g);
    expect(generatorVersionOf(parseDay("2026-09-30")!)).toBe(15);
  });

  it("un jour d'une plage prend sa version ; un trou, un jour au-delà de `jusqua`, avant, ou une graine du Salon, la dernière", () => {
    for (let d = plages[0]!.jour; d <= dernier; d++) {
      const p = plages.find((x) => d >= x.jour && d <= x.fin);
      expect(generatorVersionOf(d), `${d}`).toBe(p ? p.g : GENERATOR_VERSION);
    }
    expect(generatorVersionOf(dernier + 1)).toBe(GENERATOR_VERSION);
    expect(generatorVersionOf(dernier + 400)).toBe(GENERATOR_VERSION);
    expect(generatorVersionOf(plages[0]!.jour - 1)).toBe(GENERATOR_VERSION);
    expect(salonCircuit(2_946_000).id).toBe(`salon-2946000-g${GENERATOR_VERSION}`);
  });

  it("l'identifiant d'un jour porte sa version ; le code sait faire la plus ancienne version du registre (le premier jour se génère, valide)", () => {
    const first = plages[0]!;
    const oldest = Math.min(...plages.map((p) => p.g));
    expect(oldest).toBeGreaterThanOrEqual(OLDEST_GENERATOR);
    const day = plages.find((p) => p.g === oldest)!.jour + 3;
    const c = dailyCircuit(day);
    expect(c.fallback).toBe(false);
    expect(c.track.id).toBe(dailyTrackId(day));
    expect(c.track.id).toBe(`jour-${c.date}-g${generatorVersionOf(day)}`);
    expect(first.jour).toBeLessThanOrEqual(day);
  }, 30_000);
});

describe("lot R11 : l'ancre de la rotation des vedettes (v18) ne dépend d'aucune date de bascule", () => {
  it("les apparitions d'un thème se suivent (+1) de part et d'autre de l'ancre, négatives avant elle ; la vedette change à chaque apparition", () => {
    for (const name of THEME_NAMES) {
      const days: number[] = [];
      for (let d = ANCRE_V18 - 60; d < ANCRE_V18 + 60; d++) if (themeForDay(d, 18).name === name) days.push(d); // la v18 imposée : l'ancienne règle des thèmes (lot V1 : le sac est la v20)
      expect(days.some((d) => d < ANCRE_V18) && days.some((d) => d >= ANCRE_V18), name).toBe(true);
      const theme = themeOfVersion(THEMES[name], 18);
      let prev: string | null = null;
      days.forEach((d, i) => {
        const k = themeOccurrence(d, name, 18);
        if (i > 0) expect(k, `${name} ${d}`).toBe(themeOccurrence(days[i - 1]!, name, 18) + 1);
        const v = vedetteOf(theme, k);
        expect(v, `${name} ${d}`).not.toBeNull();
        if (prev !== null) expect(v, `${name} ${d} : deux apparitions de suite`).not.toBe(prev);
        prev = v;
      });
      expect(themeOccurrence(days.find((d) => d >= ANCRE_V18)!, name, 18)).toBeGreaterThanOrEqual(0);
      expect(themeOccurrence(days[0]!, name, 18)).toBeLessThan(0);
    }
  });

  it("lot V1 (v20, le sac de thèmes) : après le dernier jour du registre, les apparitions d'un thème se suivent aussi (+1) et la vedette change à chaque apparition", () => {
    const premier = parseDay(registre.jusqua)! + 1;
    for (const name of THEME_NAMES) {
      const days: number[] = [];
      for (let d = premier; d < premier + 120; d++) if (themeForDay(d).name === name) days.push(d);
      expect(days.length, name).toBeGreaterThanOrEqual(10);
      const theme = themeOfVersion(THEMES[name], GENERATOR_VERSION);
      let prev: string | null = null;
      days.forEach((d, i) => {
        const k = themeOccurrence(d, name);
        if (i > 0) expect(k, `${name} ${d}`).toBe(themeOccurrence(days[i - 1]!, name) + 1);
        const v = vedetteOf(theme, k);
        if (prev !== null) expect(v, `${name} ${d} : deux apparitions de suite`).not.toBe(prev);
        prev = v;
      });
    }
  });

  it("un jour d'avant l'ancre se génère en v18, valide (une mise en production avant le 04/11/2026 sert la v18 dès son jour de bascule)", () => {
    for (let d = ANCRE_V18 - 8; d < ANCRE_V18; d += 2) {
      const c = dailyCircuit(d, 0, null, 18);
      expect(c.fallback, `${c.date}`).toBe(false);
      expect(c.track.id).toBe(`jour-${c.date}-g18`);
    }
  }, 60_000);
});
