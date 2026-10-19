import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gameOf, multiSpecs, specFiles } from "../../../scripts/e2e-parts.mjs";

// Lot R3 (plateforme) : sur une PR, Firefox et WebKit ne lancent que le sous-ensemble multi-navigateurs de chaque jeu (`e2e/multi-navigateurs.json`) :
// les specs dont le sens est la comparaison entre navigateurs. La liste est explicite et gardée ici : chaque spec existe, a sa raison, tourne
// vraiment hors de Chromium (pas un fichier « Chromium seulement »), et la CI la lit.
const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");

for (const project of ["firefox", "jump-firefox"]) {
  const game = gameOf(project);
  describe(`sous-ensemble multi-navigateurs (${game.name})`, () => {
    const list = multiSpecs(game.dir);

    it("liste explicite, non vide, chaque spec existe et a sa raison", () => {
      expect(Object.keys(list).length).toBeGreaterThan(0);
      for (const [f, why] of Object.entries(list)) {
        expect(specFiles(game.dir), f).toContain(f);
        expect(why.length, f).toBeGreaterThan(20);
      }
    });

    it("chaque spec tourne hors de Chromium (aucun saut « Chromium seulement » au niveau du fichier) et compare au résultat de Node", () => {
      for (const f of Object.keys(list)) {
        const src = readFileSync(join(game.dir, f), "utf8");
        expect(src, f).not.toMatch(/^test\.skip\(\(\{ browserName \}\) => browserName !== "chromium"/m);
        expect(src, f).toMatch(/Node/);
      }
    });

    it("tout spec qui se dit « comparaison avec Node dans chaque navigateur » est dans la liste", () => {
      for (const f of specFiles(game.dir)) {
        const src = readFileSync(join(game.dir, f), "utf8");
        if (/^test\("le navigateur (rejoue|régénère)/m.test(src)) expect(Object.keys(list), f).toContain(f);
      }
    });
  });
}

describe("la CI lit le sous-ensemble", () => {
  it("Firefox et WebKit d'une PR lancent `e2e-parts.mjs multi` ; main, la nuit et à la demande lancent tout", () => {
    expect(ci).toContain("node scripts/e2e-parts.mjs multi");
    expect(ci).toMatch(/schedule:/);
    expect(ci).toMatch(/workflow_dispatch:/);
    expect(ci).toMatch(/branches: \[main\]/);
  });
});
