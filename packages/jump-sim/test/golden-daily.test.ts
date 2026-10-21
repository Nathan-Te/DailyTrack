import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { JUMP_GENERATOR_VERSION, SECTION_CLOCK_GENERATOR, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, dailyLevel } from "../src/index";

// Référence du générateur (lot 5) : pour des dates fixes, l'empreinte du niveau du jour, ses morceaux et variantes, le temps de l'auteur et
// les médailles, figés dans `fixtures/daily-golden.json`. Tout changement qui modifie le niveau d'une date (règles, seuils, catalogue,
// solutions, assemblage) fait échouer ce test : comprendre pourquoi, incrémenter `JUMP_GENERATOR_VERSION`, puis régénérer
//   UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden-daily.test.ts
// et relancer `npm run measure:jump -w @cdj/jump-sim`.
// Lot 15 : deux références. `daily-golden-v4.json` : le générateur en vigueur (g10, niveaux à une seule horloge, sim v4) ; `daily-golden.json` :
// **la référence v3, intacte** (g9, écrite au lot 13) — `dailyLevel(jour, thème, 3)` doit encore la rendre au bit près ; elle ne se régénère
// jamais (`UPDATE_GOLDEN=1` n'écrit que la v4).

const FILE_V3 = join(import.meta.dirname, "fixtures/daily-golden.json");
const FILE = join(import.meta.dirname, "fixtures/daily-golden-v4.json");
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

function snapshot(date: string, simVersion = SINGLE_CLOCK_VERSION): GoldenDay {
  const L = dailyLevel(parseDay(date)!, null, simVersion);
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
  const golden: Golden = { jumpSimVersion: SINGLE_CLOCK_VERSION, jumpGeneratorVersion: JUMP_GENERATOR_VERSION, days: Object.fromEntries(DATES.map((d) => [d, snapshot(d)])) };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
const goldenV3 = JSON.parse(readFileSync(FILE_V3, "utf8")) as Golden;

describe("référence du générateur (niveau du jour)", () => {
  it("versions de la référence", () => {
    expect(golden.jumpGeneratorVersion, "JUMP_GENERATOR_VERSION a changé : régénérer la référence (UPDATE_GOLDEN=1)").toBe(JUMP_GENERATOR_VERSION);
    expect(golden.jumpSimVersion, "la version des niveaux du jour a changé : JUMP_GENERATOR_VERSION +1 puis UPDATE_GOLDEN=1").toBe(SINGLE_CLOCK_VERSION);
    expect(Object.keys(golden.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : même niveau, mêmes morceaux, même temps de l'auteur`, () => {
      const ref = golden.days[date]!;
      expect(snapshot(date), "le niveau de cette date a changé : JUMP_GENERATOR_VERSION +1 puis UPDATE_GOLDEN=1").toEqual(ref);
    });
  }
});

describe("lot 15 : la référence v3 du générateur est intacte (g9, une horloge par section)", () => {
  it("versions de la référence v3", () => {
    expect(goldenV3.jumpGeneratorVersion).toBe(SECTION_CLOCK_GENERATOR);
    expect(goldenV3.jumpSimVersion).toBe(SECTION_CLOCK_VERSION);
    expect(Object.keys(goldenV3.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 3) rend le niveau g9 au bit près`, () => {
      expect(snapshot(date, SECTION_CLOCK_VERSION)).toEqual(goldenV3.days[date]!);
    });
  }

  it("le niveau v4 d'une date est le niveau v3 mis à l'heure : mêmes morceaux, même preuve, même temps de l'auteur (sauf variante refusée)", () => {
    for (const date of DATES) {
      const v3 = goldenV3.days[date]!;
      const v4 = golden.days[date]!;
      if (v4.pieces.join() !== v3.pieces.join()) continue;
      expect(v4.authorTicks, date).toBe(v3.authorTicks);
      expect(v4.width, date).toBe(v3.width);
    }
  });
});
