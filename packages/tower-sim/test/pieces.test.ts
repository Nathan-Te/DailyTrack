import { describe, expect, it } from "vitest";
import { PIECE_KINDS } from "../lab/interface";
import { pieceBoxes } from "../lab/pieces";

describe("les sept tétrominos en boîtes soudées", () => {
  for (const kind of PIECE_KINDS) {
    it(`${kind} : 4 cases d'aire, centre de masse à l'origine, quatre quarts de tour reviennent à la forme`, () => {
      for (let rot = 0; rot < 4; rot++) {
        const boxes = pieceBoxes(kind, rot);
        const aire = boxes.reduce((s, b) => s + 4 * b.hw * b.hh, 0); // huitièmes au carré
        expect(aire).toBe(4 * 64);
        const mx = boxes.reduce((s, b) => s + 4 * b.hw * b.hh * b.cx, 0);
        const my = boxes.reduce((s, b) => s + 4 * b.hw * b.hh * b.cy, 0);
        expect([mx, my]).toEqual([0, 0]);
        for (const b of boxes) for (const v of [b.cx, b.cy, b.hw, b.hh]) expect(Number.isInteger(v)).toBe(true);
      }
      expect(pieceBoxes(kind, 4 & 3)).toEqual(pieceBoxes(kind, 0));
    });

    it(`${kind} : les boîtes ne se recouvrent pas`, () => {
      for (let rot = 0; rot < 4; rot++) {
        const bs = pieceBoxes(kind, rot);
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i]!;
          const b = bs[j]!;
          const recouvre = Math.abs(a.cx - b.cx) < a.hw + b.hw && Math.abs(a.cy - b.cy) < a.hh + b.hh;
          expect(recouvre).toBe(false);
        }
      }
    });
  }
});
