import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_S, assignParts, durees as dureesDe, specFiles, specsRegression, testList } from "../../../scripts/e2e-parts.mjs";
import { PARTS_COMPLETES, matriceComplete } from "../../../scripts/ci-zones.mjs";

// Répartition des specs entre les parts Chromium de la CI (retouche 31b) : par durée mesurée, jamais un fichier oublié ni compté deux fois.
const durees = JSON.parse(readFileSync(new URL("../e2e/durees.json", import.meta.url), "utf8")).secondes as Record<string, number>;
// Lot R13 : la matrice de la CI complète vient de scripts/ci-zones.mjs (`matriceComplete`) ; ci.yml la lit dans les sorties du job `scope`.
const PARTS = PARTS_COMPLETES.nuit.web;
const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("parts e2e", () => {
  it("chaque spec est dans exactement une part", () => {
    const files = specFiles();
    const parts = assignParts(files, durees, PARTS);
    expect(parts).toHaveLength(PARTS);
    expect(parts.flatMap((p) => p.files).sort()).toEqual(files);
  });

  it("lot R13 : la CI de main lance l'Essentiel de chaque spec qui n'est pas tout entier « Régression », en parts équilibrées", () => {
    const regression = specsRegression("web");
    const files = specFiles().filter((f) => !regression.includes(f));
    const parts = assignParts(files, dureesDe(undefined, { essentiel: true }), PARTS_COMPLETES.main.web);
    expect(parts.flatMap((p) => p.files).sort()).toEqual(files);
    expect(parts.every((p) => p.files.length > 0)).toBe(true);
    expect(ci).toContain("matrix: ${{ fromJSON(needs.scope.outputs.e2e_complet_matrice) }}");
    expect(ci).toContain("--grep-invert=@regression");
    const m = matriceComplete("main").include;
    expect(m.filter((x) => x.suite === "web").every((x) => x.essentiel)).toBe(true);
    expect(matriceComplete("nuit").include.some((x) => x.essentiel)).toBe(false);
    expect(m.filter((x) => x.browser !== "chromium").map((x) => [x.suite, x.browser])).toEqual([["navigateurs", "firefox"], ["navigateurs", "webkit"]]);
  });

  it("chaque spec a sa durée mesurée (un nouveau spec s'ajoute à e2e/durees.json)", () => {
    expect(specFiles().filter((f) => !(f in durees))).toEqual([]);
    expect(Object.keys(durees).filter((f) => !specFiles().includes(f)), "durées de specs disparus").toEqual([]);
  });

  it("aucune part ne dépasse la plus longue des deux bornes : le plus long fichier, ou la moyenne + le plus long fichier", () => {
    const parts = assignParts(specFiles(), durees, PARTS);
    const loads = parts.map((p) => p.load);
    const longest = Math.max(...Object.values(durees));
    const mean = loads.reduce((a, b) => a + b, 0) / PARTS;
    for (const l of loads) expect(l).toBeLessThanOrEqual(Math.max(longest, mean + longest));
    expect(loads.every((l) => l > 0), "aucune part vide").toBe(true);
  });

  it("le plus long d'abord, sur la part la moins chargée ; un inconnu pèse DEFAULT_S ; déterministe", () => {
    const parts = assignParts(["a.spec.ts", "b.spec.ts", "c.spec.ts", "d.spec.ts"], { "a.spec.ts": 100, "b.spec.ts": 60, "c.spec.ts": 50 }, 2);
    // a (100) → 1 ; b (60) → 2 ; d (inconnu, 60) → 2 (60 < 100) ; c (50) → 1 (100 < 120).
    expect(parts.map((p) => p.files)).toEqual([
      ["a.spec.ts", "c.spec.ts"],
      ["b.spec.ts", "d.spec.ts"],
    ]);
    expect(parts.map((p) => p.load)).toEqual([150, 60 + DEFAULT_S]);
    expect(assignParts(["a.spec.ts", "b.spec.ts"], {}, 2)).toEqual(assignParts(["a.spec.ts", "b.spec.ts"], {}, 2));
  });

  it("liste de tests au format de Playwright (--test-list) : un fichier entier par ligne", () => {
    expect(testList(["salon.spec.ts", "watch.spec.ts"], "chromium")).toBe("[chromium] › salon.spec.ts\n[chromium] › watch.spec.ts\n");
  });
});
