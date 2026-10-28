import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { ALT_KEPT_VERSION, BRIDGE_GENERATOR, BRIDGE_VERSION, JUMP_GENERATOR_VERSION, RESTART_GENERATOR, RESTART_VERSION, LASER_GENERATOR, MUSHROOM_GENERATOR, LASER_VERSION, MUSHROOM_VERSION, PLATFORM_GENERATOR, PLATFORM_VERSION, PRESS_GENERATOR, PRESS_VERSION, SECTION_CLOCK_GENERATOR, SECTION_CLOCK_VERSION, SINGLE_CLOCK_GENERATOR, SINGLE_CLOCK_VERSION, STALACTITE_GENERATOR, STALACTITE_VERSION, dailyLevel } from "../src/index";

// Référence du générateur (lot 5) : pour des dates fixes, l'empreinte du niveau du jour, ses morceaux et variantes, le temps de l'auteur et
// les médailles, figés dans `fixtures/daily-golden.json`. Tout changement qui modifie le niveau d'une date (règles, seuils, catalogue,
// solutions, assemblage) fait échouer ce test : comprendre pourquoi, incrémenter `JUMP_GENERATOR_VERSION`, puis régénérer
//   UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden-daily.test.ts
// et relancer `npm run measure:jump -w @cdj/jump-sim`.
// Lot 15 : deux références. `daily-golden-v4.json` : le générateur en vigueur (g10, niveaux à une seule horloge, sim v4) ; `daily-golden.json` :
// **la référence v3, intacte** (g9, écrite au lot 13) — `dailyLevel(jour, thème, 3)` doit encore la rendre au bit près ; elle ne se régénère
// jamais (`UPDATE_GOLDEN=1` n'écrit que la v4).
// Lot 20 : trois références. `daily-golden-v4.json` : **la référence v4, intacte** (g14, écrite au lot 19) — `dailyLevel(jour, thème, 4)` doit encore la rendre au
// bit près (le catalogue sans les morceaux à plateformes, la même règle de variété) ; `daily-golden-v5.json` : le générateur en vigueur (g15, sim v5), la
// seule que `UPDATE_GOLDEN=1` écrive.
// Lot 22 : quatre références. Les v3, v4 et **v5 (g15, écrite au lot 20)** sont intactes ; `daily-golden-v6.json` est le générateur en vigueur (g16, sim v6, presses).
// Lot 28 : dix références. Les v3 à v10 et **v11 (g21, écrite au lot 27)** sont intactes ; `daily-golden-v12.json` est le générateur en vigueur (g22, sim v12, alternés qui gardent leur état à la reprise).
// Lot 27 : neuf références. Les v3 à v9 et **v10 (g20, écrite au lot 26)** sont intactes ; `daily-golden-v11.json` est le générateur en vigueur (g21, sim v11, nouvel essai à zéro, forêt à vent continu).
// Lot 26 : huit références. Les v3 à v8 et **v9 (g19, écrite au lot 25)** sont intactes ; `daily-golden-v10.json` est le générateur en vigueur (g20, sim v10, ponts à interrupteur, équilibre des mécaniques).
// Lot 25 : sept références. Les v3 à v7 et **v8 (g18, écrite au lot 24)** sont intactes ; `daily-golden-v9.json` est le générateur en vigueur (g19, sim v9, lasers, W = 4).
// Lot 24 : six références. Les v3 à v6 et **v7 (g17, écrite au lot 23)** sont intactes ; `daily-golden-v8.json` est le générateur en vigueur (g18, sim v8, stalactites).
// Lot 23 : cinq références. Les v3, v4, v5 et **v6 (g16, écrite au lot 22)** sont intactes ; `daily-golden-v7.json` est le générateur en vigueur (g17, sim v7, champignons).

const FILE_V3 = join(import.meta.dirname, "fixtures/daily-golden.json");
const FILE_V4 = join(import.meta.dirname, "fixtures/daily-golden-v4.json");
const FILE_V5 = join(import.meta.dirname, "fixtures/daily-golden-v5.json");
const FILE_V6 = join(import.meta.dirname, "fixtures/daily-golden-v6.json");
const FILE_V7 = join(import.meta.dirname, "fixtures/daily-golden-v7.json");
const FILE_V8 = join(import.meta.dirname, "fixtures/daily-golden-v8.json");
const FILE_V9 = join(import.meta.dirname, "fixtures/daily-golden-v9.json");
const FILE_V10 = join(import.meta.dirname, "fixtures/daily-golden-v10.json");
const FILE_V11 = join(import.meta.dirname, "fixtures/daily-golden-v11.json");
const FILE = join(import.meta.dirname, "fixtures/daily-golden-v12.json");
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

function snapshot(date: string, simVersion = ALT_KEPT_VERSION): GoldenDay {
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
  const golden: Golden = { jumpSimVersion: ALT_KEPT_VERSION, jumpGeneratorVersion: JUMP_GENERATOR_VERSION, days: Object.fromEntries(DATES.map((d) => [d, snapshot(d)])) };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
const goldenV11 = JSON.parse(readFileSync(FILE_V11, "utf8")) as Golden;
const goldenV10 = JSON.parse(readFileSync(FILE_V10, "utf8")) as Golden;
const goldenV9 = JSON.parse(readFileSync(FILE_V9, "utf8")) as Golden;
const goldenV8 = JSON.parse(readFileSync(FILE_V8, "utf8")) as Golden;
const goldenV7 = JSON.parse(readFileSync(FILE_V7, "utf8")) as Golden;
const goldenV6 = JSON.parse(readFileSync(FILE_V6, "utf8")) as Golden;
const goldenV5 = JSON.parse(readFileSync(FILE_V5, "utf8")) as Golden;
const goldenV4 = JSON.parse(readFileSync(FILE_V4, "utf8")) as Golden;
const goldenV3 = JSON.parse(readFileSync(FILE_V3, "utf8")) as Golden;

describe("référence du générateur (niveau du jour)", () => {
  it("versions de la référence", () => {
    expect(golden.jumpGeneratorVersion, "JUMP_GENERATOR_VERSION a changé : régénérer la référence (UPDATE_GOLDEN=1)").toBe(JUMP_GENERATOR_VERSION);
    expect(golden.jumpSimVersion, "la version des niveaux du jour a changé : JUMP_GENERATOR_VERSION +1 puis UPDATE_GOLDEN=1").toBe(ALT_KEPT_VERSION);
    expect(Object.keys(golden.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : même niveau, mêmes morceaux, même temps de l'auteur`, () => {
      const ref = golden.days[date]!;
      expect(snapshot(date), "le niveau de cette date a changé : JUMP_GENERATOR_VERSION +1 puis UPDATE_GOLDEN=1").toEqual(ref);
    });
  }
});

describe("lot 28 : la référence v11 du générateur est intacte (g21, nouvel essai à zéro, forêt à vent continu ; les alternés repartent de A à la reprise)", () => {
  it("versions de la référence v11", () => {
    expect(goldenV11.jumpGeneratorVersion).toBe(RESTART_GENERATOR);
    expect(goldenV11.jumpSimVersion).toBe(RESTART_VERSION);
    expect(Object.keys(goldenV11.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 11) rend le niveau g21 au bit près`, () => {
      expect(snapshot(date, RESTART_VERSION)).toEqual(goldenV11.days[date]!);
    });
  }
});

describe("lot 27 : la référence v10 du générateur est intacte (g20, ponts, mort avant le premier point = reprise au départ, forêt à rafales)", () => {
  it("versions de la référence v10", () => {
    expect(goldenV10.jumpGeneratorVersion).toBe(BRIDGE_GENERATOR);
    expect(goldenV10.jumpSimVersion).toBe(BRIDGE_VERSION);
    expect(Object.keys(goldenV10.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 10) rend le niveau g20 au bit près`, () => {
      expect(snapshot(date, BRIDGE_VERSION)).toEqual(goldenV10.days[date]!);
    });
  }
});

describe("lot 26 : la référence v9 du générateur est intacte (g19, lasers, sans ponts ni équilibre des mécaniques)", () => {
  it("versions de la référence v9", () => {
    expect(goldenV9.jumpGeneratorVersion).toBe(LASER_GENERATOR);
    expect(goldenV9.jumpSimVersion).toBe(LASER_VERSION);
    expect(Object.keys(goldenV9.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 9) rend le niveau g19 au bit près`, () => {
      expect(snapshot(date, LASER_VERSION)).toEqual(goldenV9.days[date]!);
    });
  }
});

describe("lot 25 : la référence v8 du générateur est intacte (g18, stalactites, sans lasers, W = 3)", () => {
  it("versions de la référence v8", () => {
    expect(goldenV8.jumpGeneratorVersion).toBe(STALACTITE_GENERATOR);
    expect(goldenV8.jumpSimVersion).toBe(STALACTITE_VERSION);
    expect(Object.keys(goldenV8.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 8) rend le niveau g18 au bit près`, () => {
      expect(snapshot(date, STALACTITE_VERSION)).toEqual(goldenV8.days[date]!);
    });
  }
});

describe("lot 24 : la référence v7 du générateur est intacte (g17, champignons, sans stalactites)", () => {
  it("versions de la référence v7", () => {
    expect(goldenV7.jumpGeneratorVersion).toBe(MUSHROOM_GENERATOR);
    expect(goldenV7.jumpSimVersion).toBe(MUSHROOM_VERSION);
    expect(Object.keys(goldenV7.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 7) rend le niveau g17 au bit près`, () => {
      expect(snapshot(date, MUSHROOM_VERSION)).toEqual(goldenV7.days[date]!);
    });
  }
});

describe("lot 23 : la référence v6 du générateur est intacte (g16, presses, sans champignons)", () => {
  it("versions de la référence v6", () => {
    expect(goldenV6.jumpGeneratorVersion).toBe(PRESS_GENERATOR);
    expect(goldenV6.jumpSimVersion).toBe(PRESS_VERSION);
    expect(Object.keys(goldenV6.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 6) rend le niveau g16 au bit près`, () => {
      expect(snapshot(date, PRESS_VERSION)).toEqual(goldenV6.days[date]!);
    });
  }
});

describe("lot 22 : la référence v5 du générateur est intacte (g15, plateformes mobiles, sans presses)", () => {
  it("versions de la référence v5", () => {
    expect(goldenV5.jumpGeneratorVersion).toBe(PLATFORM_GENERATOR);
    expect(goldenV5.jumpSimVersion).toBe(PLATFORM_VERSION);
    expect(Object.keys(goldenV5.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 5) rend le niveau g15 au bit près`, () => {
      expect(snapshot(date, PLATFORM_VERSION)).toEqual(goldenV5.days[date]!);
    });
  }
});

describe("lot 20 : la référence v4 du générateur est intacte (g14, une seule horloge, sans plateformes)", () => {
  it("versions de la référence v4", () => {
    expect(goldenV4.jumpGeneratorVersion).toBe(SINGLE_CLOCK_GENERATOR);
    expect(goldenV4.jumpSimVersion).toBe(SINGLE_CLOCK_VERSION);
    expect(Object.keys(goldenV4.days)).toEqual(DATES);
  });

  for (const date of DATES) {
    it(`${date} : dailyLevel(jour, thème, 4) rend le niveau g14 au bit près`, () => {
      expect(snapshot(date, SINGLE_CLOCK_VERSION)).toEqual(goldenV4.days[date]!);
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
      const v4 = goldenV4.days[date]!;
      if (v4.pieces.join() !== v3.pieces.join()) continue;
      expect(v4.authorTicks, date).toBe(v3.authorTicks);
      expect(v4.width, date).toBe(v3.width);
    }
  });
});
