import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASCULE_LOT_34, GENERATOR_BEFORE_34, GENERATOR_VERSION, SIM_VERSION, dailyCircuit, generatorVersionOf, parseDay } from "../src/index";

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
const FILE = join(import.meta.dirname, "fixtures/daily-golden.json");
const DATES = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-21", "2026-10-27", "2026-10-28", "2026-12-25", "2027-02-28", "2028-02-29", "2030-01-01"];

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
const beforeBascule = (date: string) => parseDay(date)! < BASCULE_LOT_34;

if (process.env.UPDATE_GOLDEN) {
  const previous = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
  const circuits = DATES.map(compute);
  for (const entry of circuits) {
    const old = previous.circuits.find((c) => c.date === entry.date);
    const without = (e: Entry) => JSON.stringify({ ...e, trackId: undefined });
    if (old && beforeBascule(entry.date) && without(old) !== without(entry))
      throw new Error(`le circuit du ${entry.date} (avant la bascule du lot 34) a changé : un jour passé ne change jamais`);
  }
  writeFileSync(FILE, JSON.stringify({ simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, circuits } satisfies Golden, null, 2) + "\n");
}

describe("circuits du jour de référence", () => {
  const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

  it("correspondent aux versions actuelles", () => {
    expect(golden.simVersion).toBe(SIM_VERSION);
    expect(golden.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it("lot 34 : chaque jour porte la version de son générateur, 15 avant la bascule du 28/10/2026", () => {
    expect(golden.circuits.map((c) => c.date)).toEqual(DATES);
    for (const c of golden.circuits) {
      const g = beforeBascule(c.date) ? GENERATOR_BEFORE_34 : GENERATOR_VERSION;
      expect(generatorVersionOf(parseDay(c.date)!)).toBe(g);
      expect(c.trackId).toBe(`jour-${c.date}-g${g}`);
    }
  });

  for (const entry of golden.circuits) {
    it(`${entry.date} : même circuit, même temps d'auteur, même thème et palette`, () => {
      expect(compute(entry.date)).toEqual(entry);
    });
  }
});
