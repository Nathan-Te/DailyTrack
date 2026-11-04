import { boites, PIECE_KINDS, THEMES_TOWER } from "@cdj/tower-sim";
import { valeurJeton } from "@cdj/ui";
import { boitesDeForme, ENCRE, FORMES, PAPIER, THEMES_BLOCS } from "@cdj/visuels/blocs";
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

// Lot DA1 — Tower et le module commun des blocs (`@cdj/visuels/blocs`) disent la même chose : les formes, les thèmes, l'encre et le papier. Et Tower n'a plus de copie de ce que le module décrit.
describe("Tower et le module commun des blocs", () => {
  it("les sept formes du module sont celles de la physique de Tower, aux quatre quarts de tour", () => {
    expect([...FORMES].sort()).toEqual([...PIECE_KINDS].sort());
    for (const f of FORMES) for (let rot = 0; rot < 4; rot++) expect(boitesDeForme(f, rot), `${f}${rot}`).toEqual(boites(f, rot));
  });
  it("les thèmes du module sont ceux de Tower, dans le même ordre", () => {
    expect([...THEMES_BLOCS]).toEqual([...THEMES_TOWER]);
  });
  it("l'encre et le papier du module sont les jetons de la charte", () => {
    expect(ENCRE).toBe(valeurJeton("dj-encre"));
    expect(PAPIER).toBe(valeurJeton("dj-papier"));
  });
  it("Tower n'a plus de copie : ni palettes de thèmes, ni formes, ni yeux, ni relief, ni expression, ni mélange de couleurs", () => {
    const fichiers = readdirSync(new URL("../src/", import.meta.url));
    for (const f of ["palettes.ts", "couleurs.ts", "formes.ts", "yeux.ts", "expression.ts", "dessinPiece.ts"]) expect(fichiers, f).not.toContain(f);
    for (const f of fichiers.filter((x) => x.endsWith(".ts"))) {
      const s = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
      expect(s, f).not.toMatch(/I: "#F28C38", O: "#FFD23F"|I: "#E8731A", O: "#F2B705"/); // les couleurs des pièces par thème sont dans le module (un décor garde les siennes)
      expect(s, f).not.toMatch(/function melanger|class Yeux|class Clignotement|new CircleGeometry/);
    }
  });
});
