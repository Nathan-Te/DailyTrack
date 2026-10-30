import { describe, expect, it } from "vitest";
import { sourceTable } from "../tools/trig";
import { cos, sin, TURN, QUARTER, wrap } from "../lab/a/trig";
import { SIN_QUART } from "../lab/a/trigTable";
import { readFileSync } from "node:fs";

describe("trigonométrie par table (moteur A)", () => {
  it("la table commitée est exactement ce que le générateur écrit", () => {
    expect(readFileSync(new URL("../lab/a/trigTable.ts", import.meta.url), "utf8")).toBe(sourceTable());
    expect(SIN_QUART).toHaveLength(1025);
  });

  it("sin et cos sont à moins de 2 unités de Q16 de la vraie valeur, sur un tour entier", () => {
    let pire = 0;
    for (let a = -TURN; a <= 2 * TURN; a += 997) {
      const x = (a / TURN) * 2 * Math.PI;
      pire = Math.max(pire, Math.abs(sin(a) - Math.sin(x) * 65536), Math.abs(cos(a) - Math.cos(x) * 65536));
    }
    expect(pire).toBeLessThan(2);
  });

  it("valeurs exactes aux quatre quarts de tour, entiers, jamais -0", () => {
    expect([sin(0), sin(QUARTER), sin(2 * QUARTER), sin(3 * QUARTER)]).toEqual([0, 65536, 0, -65536]);
    expect([cos(0), cos(QUARTER), cos(2 * QUARTER), cos(3 * QUARTER)]).toEqual([65536, 0, -65536, 0]);
    for (let a = -3 * TURN; a <= 3 * TURN; a += 12345) {
      for (const v of [sin(a), cos(a)]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(Object.is(v, -0)).toBe(false);
      }
    }
  });

  it("wrap ramène dans [0, TURN) sans -0", () => {
    expect(wrap(-1)).toBe(TURN - 1);
    expect(wrap(TURN)).toBe(0);
    expect(Object.is(wrap(-TURN), -0)).toBe(false);
  });
});
