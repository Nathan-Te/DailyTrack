import { describe, expect, it } from "vitest";
import { PIECES } from "@cdj/blocks-sim";
import { casesDe } from "../src/boites";
import { caseDesYeux, morceaux } from "../src/yeuxBlocks";

describe("les yeux des pièces posées", () => {
  it("une pièce entière est un seul morceau : une paire de yeux, sur une de ses cases", () => {
    for (const p of PIECES) {
      const m = morceaux(casesDe(p));
      expect(m, p.nom).toHaveLength(1);
      const c = caseDesYeux(m[0]!);
      expect(casesDe(p).some((x) => x.col === c.col && x.ligne === c.ligne), p.nom).toBe(true);
    }
  });
  it("la case la plus centrale : le milieu d'une barre de 3, la case du centre d'un carré 3 × 3, la branche d'un T", () => {
    expect(caseDesYeux(casesDe(PIECES.find((p) => p.nom === "barre3-0")!))).toEqual({ col: 1, ligne: 0 });
    expect(caseDesYeux(casesDe(PIECES.find((p) => p.nom === "carre3-0")!))).toEqual({ col: 1, ligne: 1 });
  });
  it("un effacement qui coupe une pièce en deux : chaque morceau garde sa paire, et deux cases voisines par un coin seulement sont deux morceaux", () => {
    const m = morceaux([{ col: 0, ligne: 0 }, { col: 1, ligne: 0 }, { col: 4, ligne: 0 }, { col: 5, ligne: 0 }]);
    expect(m).toHaveLength(2);
    expect(m.map(caseDesYeux)).toHaveLength(2);
    expect(morceaux([{ col: 0, ligne: 0 }, { col: 1, ligne: 1 }])).toHaveLength(2);
  });
  it("un morceau seul d'une case a ses yeux sur cette case", () => {
    expect(caseDesYeux([{ col: 3, ligne: 5 }])).toEqual({ col: 3, ligne: 5 });
  });
});
