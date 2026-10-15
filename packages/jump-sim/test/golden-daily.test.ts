import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel } from "../src/index";

// Référence du générateur (lot 5) : pour des dates fixes, l'empreinte du niveau du jour, ses morceaux et variantes, le temps de l'auteur et
// les médailles, figés dans `fixtures/daily-golden.json`. Tout changement qui modifie le niveau d'une date (règles, seuils, catalogue,
// solutions, assemblage) fait échouer ce test : comprendre pourquoi, incrémenter `JUMP_GENERATOR_VERSION`, puis régénérer
//   UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden-daily.test.ts
// et relancer `npm run measure:jump -w @cdj/jump-sim`.

const FILE = join(import.meta.dirname, "fixtures/daily-golden.json");
/** Le premier jour, un jour ordinaire, un changement d'heure, un jour de fête, l'année suivante. */
const DATES = ["2026-10-16", "2026-10-25", "2026-11-03", "2026-12-25", "2027-03-28", "2027-06-21"];

interface GoldenDay {
  id: string;
  number: number;
  hash: string;
  width: number;
  height: number;
  pieces: string[];
  authorTicks: number;
  medals: { author: number; gold: number; silver: number; bronze: number };
  exigence: { sum: number; rate: number; thirds: readonly number[] };
  chosen: number;
  code: string;
}

interface Golden {
  jumpSimVersion: number;
  jumpGeneratorVersion: number;
  days: Record<string, GoldenDay>;
}

function snapshot(date: string): GoldenDay {
  const L = dailyLevel(parseDay(date)!);
  return {
    id: L.id,
    number: L.number,
    hash: L.hash,
    width: L.level.width,
    height: L.level.height,
    pieces: L.pieces.map((p) => `${p.id}:${p.variant}`),
    authorTicks: L.authorTicks,
    medals: { ...L.medals },
    exigence: { ...L.exigence, thirds: [...L.exigence.thirds] },
    chosen: L.chosen,
    code: L.code,
  };
}

if (process.env.UPDATE_GOLDEN) {
  const golden: Golden = { jumpSimVersion: JUMP_SIM_VERSION, jumpGeneratorVersion: JUMP_GENERATOR_VERSION, days: Object.fromEntries(DATES.map((d) => [d, snapshot(d)])) };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

describe("référence du générateur (niveau du jour)", () => {
  it("versions de la référence", () => {
    expect(golden.jumpGeneratorVersion, "JUMP_GENERATOR_VERSION a changé : régénérer la référence (UPDATE_GOLDEN=1)").toBe(JUMP_GENERATOR_VERSION);
    expect(golden.jumpSimVersion, "JUMP_SIM_VERSION a changé : JUMP_GENERATOR_VERSION +1 puis UPDATE_GOLDEN=1").toBe(JUMP_SIM_VERSION);
    expect(Object.keys(golden.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : même niveau, mêmes morceaux, même temps de l'auteur`, () => {
      const ref = golden.days[date]!;
      expect(snapshot(date), "le niveau de cette date a changé : JUMP_GENERATOR_VERSION +1 puis UPDATE_GOLDEN=1").toEqual(ref);
    });
  }
});
