import { describe, expect, it } from "vitest";
import { CLE_RANGS, VISITE_MS } from "@cdj/ui/src/classementRangs";
import { CLES_GARDEES } from "@cdj/profile";
import { suivreLesRangs } from "../src/classementRangs";

// Lot U6 : les places gagnées ou perdues, gardées dans le navigateur par jour, par vue et par filtre — sur un faux stockage.
const faux = (refuse = false): Pick<Storage, "getItem" | "setItem"> & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      if (refuse) throw new Error("refusé");
      m.set(k, v);
    },
  };
};
const T0 = Date.UTC(2026, 10, 18, 9);

describe("lot U6 : suivreLesRangs", () => {
  it("garde les rangs dans `cdj:classement:rangs` et rend les places gagnées à la visite suivante", () => {
    const s = faux();
    expect(suivreLesRangs(s, "j|cumul|tous", { a: 1, b: 2 }, true, T0).size).toBe(0);
    expect(s.m.has(CLE_RANGS)).toBe(true);
    const m = suivreLesRangs(s, "j|cumul|tous", { b: 1, a: 2 }, true, T0 + VISITE_MS + 1);
    expect([...m]).toEqual([["b", 1], ["a", -1]]);
  });
  it("un jour fermé ne bouge plus : rien n'est gardé, rien n'est montré", () => {
    const s = faux();
    expect(suivreLesRangs(s, "j|cumul|tous", { a: 1 }, false, T0).size).toBe(0);
    expect(s.m.size).toBe(0);
  });
  it("sans stockage, avec un stockage qui refuse ou sans rang : aucun mouvement, jamais d'exception", () => {
    expect(suivreLesRangs(null, "j", { a: 1 }, true).size).toBe(0);
    expect(suivreLesRangs(faux(true), "j", { a: 1 }, true).size).toBe(0);
    expect(suivreLesRangs(faux(), "j", {}, true).size).toBe(0);
  });
  it("c'est une donnée de jeu : effacée au « Nouveau départ » (jamais dans les clés gardées)", () => {
    expect(CLES_GARDEES).not.toContain(CLE_RANGS);
    expect(CLE_RANGS.startsWith("cdj:")).toBe(true);
  });
});
