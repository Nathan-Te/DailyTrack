import { daysFromCivil, formatDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { DAY_MS, msUntilNextParisDay, parisClockSource, parisDay, parisDayByIntl, parisDayByRule, parisDayStart, parisOffsetByRule } from "../src";

const utc = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => Date.UTC(y, m - 1, d, h, min, s);
const dayOf = (y: number, m: number, d: number) => daysFromCivil(y, m, d);

describe("jour de Paris", () => {
  it("utilise Intl dans cet environnement (sinon le repli par règle est utilisé et testé plus bas)", () => {
    expect(["intl", "table"]).toContain(parisClockSource);
    expect(parisDayByIntl(utc(2026, 7, 1))).not.toBeNull();
  });

  it("été (UTC+2) : minuit de Paris = 22 h UTC la veille", () => {
    expect(parisDay(utc(2026, 7, 14, 21, 59, 59))).toBe(dayOf(2026, 7, 14));
    expect(parisDay(utc(2026, 7, 14, 22, 0, 0))).toBe(dayOf(2026, 7, 15));
    // 23 h 59 à Paris = 21 h 59 UTC ; 0 h 01 = 22 h 01 UTC
    expect(parisDay(utc(2026, 7, 14, 21, 59))).toBe(dayOf(2026, 7, 14));
    expect(parisDay(utc(2026, 7, 14, 22, 1))).toBe(dayOf(2026, 7, 15));
  });

  it("hiver (UTC+1) : minuit de Paris = 23 h UTC la veille", () => {
    expect(parisDay(utc(2026, 12, 3, 22, 59, 59))).toBe(dayOf(2026, 12, 3));
    expect(parisDay(utc(2026, 12, 3, 23, 0, 0))).toBe(dayOf(2026, 12, 4));
    expect(parisDay(utc(2027, 1, 31, 22, 59))).toBe(dayOf(2027, 1, 31));
    expect(parisDay(utc(2027, 1, 31, 23, 1))).toBe(dayOf(2027, 2, 1));
  });

  it("changement d'heure du dimanche 25/10/2026 : le 25 dure 25 h (minuit d'été à 22 h UTC, le 26 à minuit d'hiver 23 h UTC)", () => {
    expect(parisDayStart(dayOf(2026, 10, 25))).toBe(utc(2026, 10, 24, 22));
    expect(parisDayStart(dayOf(2026, 10, 26))).toBe(utc(2026, 10, 25, 23));
    expect(parisDayStart(dayOf(2026, 10, 26)) - parisDayStart(dayOf(2026, 10, 25))).toBe(25 * 3_600_000);
    expect(parisDay(utc(2026, 10, 25, 0, 30))).toBe(dayOf(2026, 10, 25)); // 2 h 30 d'été
    expect(parisDay(utc(2026, 10, 25, 1, 30))).toBe(dayOf(2026, 10, 25)); // 2 h 30 d'hiver (la seconde fois)
    expect(parisDay(utc(2026, 10, 25, 22, 59))).toBe(dayOf(2026, 10, 25)); // 23 h 59 à Paris
    expect(parisDay(utc(2026, 10, 25, 23, 1))).toBe(dayOf(2026, 10, 26)); // 0 h 01
    // le même jour, 25 h plus tard qu'un jour ordinaire : le décompte de l'accueil s'en sert
    expect(msUntilNextParisDay(utc(2026, 10, 25, 22, 0))).toBe(3_600_000);
  });

  it("changement d'heure de mars 2027 (dimanche 28/03) : le 28 dure 23 h", () => {
    expect(parisDayStart(dayOf(2027, 3, 28))).toBe(utc(2027, 3, 27, 23));
    expect(parisDayStart(dayOf(2027, 3, 29))).toBe(utc(2027, 3, 28, 22));
    expect(parisDayStart(dayOf(2027, 3, 29)) - parisDayStart(dayOf(2027, 3, 28))).toBe(23 * 3_600_000);
    expect(parisDay(utc(2027, 3, 28, 21, 59))).toBe(dayOf(2027, 3, 28));
    expect(parisDay(utc(2027, 3, 28, 22, 1))).toBe(dayOf(2027, 3, 29));
  });

  it("Delhi (UTC+5:30) et New York (UTC−4) lisent le même jour au même instant : celui de Paris, pas celui de leur horloge locale", () => {
    // 21 h 40 UTC le 14/10 : à Delhi il est déjà 3 h 10 le 15, à New York 17 h 40 le 14 ; à Paris 23 h 40 le 14.
    const t = utc(2026, 10, 14, 21, 40);
    const delhiLocalDay = Math.floor((t + 5.5 * 3_600_000) / DAY_MS);
    const newYorkLocalDay = Math.floor((t - 4 * 3_600_000) / DAY_MS);
    expect(delhiLocalDay).not.toBe(newYorkLocalDay);
    expect(formatDay(parisDay(t))).toBe("2026-10-14");
    // et à 22 h 05 UTC, minuit est passé à Paris pour tout le monde
    expect(formatDay(parisDay(utc(2026, 10, 14, 22, 5)))).toBe("2026-10-15");
  });

  it("minuit de Paris est un instant exact : une seconde avant = veille, à l'instant = jour", () => {
    for (let day = dayOf(2026, 1, 1); day < dayOf(2028, 1, 1); day++) {
      const start = parisDayStart(day);
      expect(parisDay(start)).toBe(day);
      expect(parisDay(start - 1)).toBe(day - 1);
      expect(msUntilNextParisDay(start)).toBe(parisDayStart(day + 1) - start);
    }
  });

  it("Intl et la règle d'heure d'été donnent la même date, d'heure en heure et au quart d'heure autour des changements, de 2026 à 2030", () => {
    if (parisDayByIntl(utc(2026, 7, 1)) === null) return; // pas de fuseaux ici : le repli par règle est alors le seul
    for (let t = utc(2026, 1, 1); t < utc(2031, 1, 1); t += 3_600_000) expect(parisDayByIntl(t), String(new Date(t).toISOString())).toBe(parisDayByRule(t));
    for (const [y, m, d] of [[2026, 3, 29], [2026, 10, 25], [2027, 3, 28], [2027, 10, 31], [2028, 3, 26], [2028, 10, 29]] as const) {
      for (let t = utc(y, m, d - 1); t < utc(y, m, d + 2); t += 15 * 60_000) expect(parisDayByIntl(t)).toBe(parisDayByRule(t));
    }
  });

  it("la règle d'heure d'été : UTC+2 du dernier dimanche de mars (01 h UTC) à celui d'octobre (01 h UTC)", () => {
    expect(parisOffsetByRule(utc(2026, 3, 29, 0, 59))).toBe(3_600_000);
    expect(parisOffsetByRule(utc(2026, 3, 29, 1, 0))).toBe(7_200_000);
    expect(parisOffsetByRule(utc(2026, 10, 25, 0, 59))).toBe(7_200_000);
    expect(parisOffsetByRule(utc(2026, 10, 25, 1, 0))).toBe(3_600_000);
  });
});
