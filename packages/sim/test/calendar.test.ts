import { describe, expect, it } from "vitest";
import { PREMIER_JOUR, circuitNumber, civilFromDays, daysFromCivil, formatDay, parseDay } from "../src/index";

describe("calendrier", () => {
  it("compte les jours depuis le 1er janvier 1970", () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(2000, 3, 1)).toBe(11017);
    expect(daysFromCivil(1969, 12, 31)).toBe(-1);
  });

  it("colle à Date.UTC sur plusieurs siècles, années bissextiles comprises", () => {
    for (let day = -20000; day < 40000; day += 17) {
      const t = new Date(day * 86400000);
      expect(civilFromDays(day)).toEqual({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
    }
    expect(formatDay(daysFromCivil(2024, 2, 29))).toBe("2024-02-29");
  });

  it("lit et écrit AAAA-MM-JJ, et refuse les dates impossibles", () => {
    expect(parseDay("2026-09-22")).toBe(PREMIER_JOUR);
    expect(formatDay(parseDay("2026-10-06")!)).toBe("2026-10-06");
    for (const bad of ["2025-02-29", "2026-13-01", "2026-00-10", "2026-10-32", "26-10-06", "2026/10/06", "", "demain", "2026-10-06 "]) {
      expect(parseDay(bad), bad).toBeNull();
    }
    expect(parseDay("2024-02-29")).not.toBeNull();
  });

  it("numérote les circuits à partir du premier jour (provisoirement le 22/09/2026)", () => {
    expect(circuitNumber(PREMIER_JOUR)).toBe(1);
    expect(circuitNumber(PREMIER_JOUR + 141)).toBe(142);
  });
});
