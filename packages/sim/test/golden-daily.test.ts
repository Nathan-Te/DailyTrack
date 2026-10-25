import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASCULE_LOT_34, BASCULE_LOT_48, BASCULE_LOT_49, GENERATOR_BEFORE_34, GENERATOR_BEFORE_48, GENERATOR_BEFORE_49, GENERATOR_VERSION, SIM_VERSION, dailyCircuit, generatorVersionOf, parseDay } from "../src/index";

// Circuits du jour de référence : le texte exact, le temps de l'auteur et la palette de quelques dates,
// calculés par Node. Le test navigateur (apps/web/e2e/daily.spec.ts) régénère ces circuits dans Chromium,
// Firefox et WebKit et doit retrouver exactement les mêmes : c'est ce qui garantit que tout le monde joue le
// même circuit, avec les mêmes médailles, et que le serveur validera les courses sur le même circuit.
//
// Si ce test casse, le circuit d'une date a changé : incrémenter `GENERATOR_VERSION` (ou `SIM_VERSION` si c'est
// la physique), puis régénérer : UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts
//
// Lot 34 : **versionnement par date**. Les jours d'avant la bascule (`BASCULE_LOT_34`, 28/10/2026) gardent le générateur v15 au bit près
// (texte, temps de l'auteur, identifiant) : la régénération refuse de réécrire l'un d'eux ; seuls les jours d'après suivent la dernière version.
// Lot 48 : de même pour les jours d'avant sa bascule (`BASCULE_LOT_48`, 04/11/2026) : v16 du 28/10 au 03/11, v17 (herbe de course) ensuite ;
// le 04/11 et le 15/11 sont des jours de Campagne.
// Lot 49 : v18 (identité des thèmes) à partir de `BASCULE_LOT_49`, la même date que le lot 48 tant que celui-ci n'est pas en production (la v17 ne sert
// alors à aucun jour) ; au moins un jour d'après la bascule par thème (05/11 Banquise, 06/11… : voir le test « un jour par thème »).
const FILE = join(import.meta.dirname, "fixtures/daily-golden.json");
const DATES = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-21", "2026-10-27", "2026-10-28", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-08", "2026-11-10", "2026-11-15", "2026-11-16", "2026-12-10", "2026-12-25", "2027-02-28", "2028-02-29", "2030-01-01"];

interface Entry {
  date: string;
  number: number;
  attempt: number;
  spec: string;
  authorMs: number;
  palette: string;
  theme: string;
  /** Lot 34 : l'identifiant du circuit (il porte la version du générateur du jour). */
  trackId: string;
}
interface Golden {
  simVersion: number;
  generatorVersion: number;
  circuits: Entry[];
}

const compute = (date: string): Entry => {
  const c = dailyCircuit(parseDay(date)!);
  return { date, number: c.number, attempt: c.attempt, spec: c.spec, authorMs: c.authorMs, palette: c.palette, theme: c.theme, trackId: c.track.id };
};
/** Un jour d'avant la dernière bascule : il ne change jamais (lots 34, 48 et 49). */
const beforeBascule = (date: string) => parseDay(date)! < BASCULE_LOT_49;
const versionOf = (date: string) => {
  const d = parseDay(date)!;
  return d < BASCULE_LOT_34 ? GENERATOR_BEFORE_34 : d < BASCULE_LOT_48 ? GENERATOR_BEFORE_48 : d < BASCULE_LOT_49 ? GENERATOR_BEFORE_49 : GENERATOR_VERSION;
};

if (process.env.UPDATE_GOLDEN) {
  const previous = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
  const circuits = DATES.map(compute);
  for (const entry of circuits) {
    const old = previous.circuits.find((c) => c.date === entry.date);
    const without = (e: Entry) => JSON.stringify({ ...e, trackId: undefined });
    if (old && beforeBascule(entry.date) && without(old) !== without(entry))
      throw new Error(`le circuit du ${entry.date} (avant la bascule du lot 49) a changé : un jour passé ne change jamais`);
  }
  writeFileSync(FILE, JSON.stringify({ simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, circuits } satisfies Golden, null, 2) + "\n");
}

describe("circuits du jour de référence", () => {
  const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

  it("correspondent aux versions actuelles", () => {
    expect(golden.simVersion).toBe(SIM_VERSION);
    expect(golden.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it("lots 34, 48 et 49 : chaque jour porte la version de son générateur, 15 avant le 28/10/2026, 16 avant le 04/11/2026, 18 ensuite", () => {
    expect(golden.circuits.map((c) => c.date)).toEqual(DATES);
    for (const c of golden.circuits) {
      const g = versionOf(c.date);
      expect(generatorVersionOf(parseDay(c.date)!)).toBe(g);
      expect(c.trackId).toBe(`jour-${c.date}-g${g}`);
    }
  });

  it("lot 48 : les jours de Campagne d'après la bascule roulent sur l'herbe de course, aucun jour d'avant n'en a", () => {
    for (const c of golden.circuits) {
      const turf = c.spec.split(" ").some((t) => /^[^@~]*\/[^@~]*z/.test(t.replace(/~./g, "")));
      if (beforeBascule(c.date)) expect(turf).toBe(false);
      else if (c.theme === "campagne") expect(turf).toBe(true);
    }
    expect(golden.circuits.filter((c) => !beforeBascule(c.date) && c.theme === "campagne").length).toBeGreaterThanOrEqual(2);
  });

  it("lot 49 : au moins un jour d'après la bascule par thème", () => {
    const themes = new Set(golden.circuits.filter((c) => !beforeBascule(c.date)).map((c) => c.theme));
    expect([...themes].sort()).toEqual(["banquise", "campagne", "canyon", "col", "nuit", "rallye", "stade", "ville"]);
  });

  for (const entry of golden.circuits) {
    it(`${entry.date} : même circuit, même temps d'auteur, même thème et palette`, () => {
      expect(compute(entry.date)).toEqual(entry);
    });
  }
});
