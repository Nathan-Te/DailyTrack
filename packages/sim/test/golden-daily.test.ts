import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION, SIM_VERSION, dailyCircuit, parseDay } from "../src/index";

// Circuits du jour de référence : le texte exact, le temps de l'auteur et la palette de quelques dates,
// calculés par Node. Le test navigateur (apps/web/e2e/daily.spec.ts) régénère ces circuits dans Chromium,
// Firefox et WebKit et doit retrouver exactement les mêmes : c'est ce qui garantit que tout le monde joue le
// même circuit, avec les mêmes médailles, et que le serveur validera les courses sur le même circuit.
//
// Si ce test casse, le circuit d'une date a changé : incrémenter `GENERATOR_VERSION` (ou `SIM_VERSION` si c'est
// la physique), puis régénérer : UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts
const FILE = join(import.meta.dirname, "fixtures/daily-golden.json");
const DATES = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-12-25", "2027-02-28", "2028-02-29", "2030-01-01"];

interface Entry {
  date: string;
  number: number;
  attempt: number;
  spec: string;
  authorMs: number;
  palette: string;
}
interface Golden {
  simVersion: number;
  generatorVersion: number;
  circuits: Entry[];
}

const compute = (date: string): Entry => {
  const c = dailyCircuit(parseDay(date)!);
  return { date, number: c.number, attempt: c.attempt, spec: c.spec, authorMs: c.authorMs, palette: c.palette };
};

if (process.env.UPDATE_GOLDEN) {
  const golden: Golden = { simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, circuits: DATES.map(compute) };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

describe("circuits du jour de référence", () => {
  const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

  it("correspondent aux versions actuelles", () => {
    expect(golden.simVersion).toBe(SIM_VERSION);
    expect(golden.generatorVersion).toBe(GENERATOR_VERSION);
  });

  for (const entry of golden.circuits) {
    it(`${entry.date} : même circuit, même temps d'auteur, même palette`, () => {
      expect(compute(entry.date)).toEqual(entry);
    });
  }
});
