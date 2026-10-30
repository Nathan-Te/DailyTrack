import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignParts, gameOf, specFiles, specsRegression, testList } from "../../../scripts/e2e-parts.mjs";
import { chromiumSeconds } from "../../../scripts/e2e-summary.mjs";
import { chargerTable, dureeE2e, matriceComplete, specsDuJeu } from "../../../scripts/ci-zones.mjs";
import { DEBT_DOCS, projectFor } from "../../../scripts/e2e-quarantaine.mjs";

// Lot R15 (plateforme) : Tower est un jeu de la CI au même titre que Track et Jump. Ces tests gardent la plomberie : aucun spec de Tower oublié par les parts, ses durées, son
// projet de CI, son entrée dans le petit ensemble Firefox et WebKit, et la disparition du workflow à part (`tower-essai.yml`).
const lire = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const durees = JSON.parse(lire("../e2e/durees.json")) as { secondes: Record<string, number>; essentiel: Record<string, number> };
const ci = lire("../../../.github/workflows/ci.yml");
const code = ci.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
const ROOT = new URL("../../../", import.meta.url).pathname;

describe("e2e de Tower dans la CI", () => {
  it("la matrice a une part Tower en Chromium dans chaque mode complet ; Firefox et WebKit lancent le petit ensemble, Tower compris", () => {
    for (const mode of ["main", "complet", "nuit"]) expect(matriceComplete(mode).include.filter((x: { suite: string }) => x.suite === "tower"), mode).toHaveLength(1);
    for (const browser of ["firefox", "webkit"]) expect(matriceComplete("nuit").include, browser).toContainEqual({ suite: "navigateurs", browser, shard: "1/1", essentiel: false });
    expect(code).toContain("npm run e2e -w @cdj/tower -- --project=tower-${{ matrix.browser }}");
    expect(lire("../playwright.config.ts")).toMatch(/name\("firefox"\), grep: \/@navigateurs\//);
    expect(lire("../playwright.config.ts")).toMatch(/name\("webkit"\), grep: \/@navigateurs\//);
  });

  it("le petit ensemble de Tower n'est pas vide : la rediffusion du banc, bit à bit, porte l'étiquette @navigateurs", () => {
    expect(lire("../e2e/determinisme.spec.ts")).toContain('{ tag: "@navigateurs" }');
  });

  it("chaque spec de Tower est dans exactement une part Chromium", () => {
    const files = specFiles(gameOf("tower-chromium").dir);
    expect(files.length).toBeGreaterThanOrEqual(3);
    const parts = assignParts(files, durees.secondes, 1);
    expect(parts.flatMap((p) => p.files).sort()).toEqual(files);
    expect(specsDuJeu("tower", ROOT)).toEqual(files);
  });

  it("chaque spec a sa durée (secondes et essentiel) : un nouveau spec s'ajoute à apps/tower/e2e/durees.json", () => {
    const files = specFiles(gameOf("tower-chromium").dir);
    const regression = specsRegression("tower");
    expect(files.filter((f) => !(f in durees.secondes))).toEqual([]);
    expect(Object.keys(durees.secondes).filter((f) => !files.includes(f)), "durées de specs disparus").toEqual([]);
    expect(files.filter((f) => !regression.includes(f) && !(f in durees.essentiel))).toEqual([]);
    for (const f of files) expect(dureeE2e(ROOT, "tower", f), f).toBeGreaterThan(0);
  });

  it("la liste de tests porte le nom du projet de CI (tower-chromium)", () => {
    expect(testList(["partie.spec.ts"], "tower-chromium")).toBe("[tower-chromium] › partie.spec.ts\n");
    expect(lire("../playwright.config.ts")).toContain("tower-${browser}");
    expect(gameOf("tower-firefox")).toMatchObject({ name: "tower" });
  });

  it("une relance en CI seulement, rapport blob par part (comme les deux autres jeux)", () => {
    const config = lire("../playwright.config.ts");
    expect(config).toContain("retries: CI ? 1 : 0");
    expect(config).toContain('["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }]');
  });

  it("les outils (captures, mesures) ne sont jamais dans les parts", () => {
    for (const f of readdirSync(new URL("../e2e/", import.meta.url)).filter((x) => /^(captures|mesure)[-.].*\.spec\.ts$/.test(x))) expect(specFiles(gameOf("tower-chromium").dir), f).not.toContain(f);
  });

  it("la fumée de Tower est déclarée, courte, et la table connaît ses zones", () => {
    const table = chargerTable(ROOT);
    expect(table.fumee.tower).toEqual(expect.arrayContaining(["determinisme.spec.ts", "partie.spec.ts", "poids.spec.ts"]));
    expect(Object.keys(table.specs).filter((k) => k.startsWith("tower/")).sort()).toEqual(specsDuJeu("tower", ROOT).map((s: string) => `tower/${s}`).sort());
  });

  it("le workflow à part (tower-essai.yml) n'existe plus : rien ne l'appelle, aucun workflow ne le cite comme contrôle", () => {
    expect(() => readFileSync(new URL("../../../.github/workflows/tower-essai.yml", import.meta.url))).toThrow();
    for (const f of readdirSync(new URL("../../../.github/workflows/", import.meta.url))) expect(lire(`../../../.github/workflows/${f}`), f).not.toContain("tower-essai");
  });

  it("les durées d'un rapport de Tower sont préfixées « tower/ » ; la quarantaine connaît le jeu et son projet", () => {
    const test = (project: string, file: string, ms: number) => ({ project, file, ms, title: "", status: "expected" as const, attempts: 1, errors: [] });
    expect(chromiumSeconds([test("tower-chromium", "e2e/partie.spec.ts", 9000), test("chromium", "partie.spec.ts", 2000), test("tower-firefox", "e2e/partie.spec.ts", 5000)])).toEqual({ "partie.spec.ts": 2, "tower/partie.spec.ts": 9 });
    expect(projectFor("tower/e2e/partie.spec.ts › une partie", "webkit")).toBe("tower-webkit");
    expect(projectFor("web/e2e/accueil.spec.ts › x", "webkit")).toBe("webkit");
    expect(DEBT_DOCS.tower).toBe("docs/tower/consignes.md");
  });
});
