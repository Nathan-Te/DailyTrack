import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignParts, gameOf, specFiles, testList } from "../../../scripts/e2e-parts.mjs";
import { chromiumSeconds, summarize } from "../../../scripts/e2e-summary.mjs";

// Lot 3c : les e2e de DailyJump suivent les règles de CI de DailyTrack (matrice, rapport fusionné, une relance, instables nommés).
// Ces tests gardent la plomberie : aucun spec de DailyJump oublié par les parts, outils sautés avec leur motif, config de CI.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const durees = JSON.parse(read("../e2e/durees.json")).secondes as Record<string, number>;
const ci = read("../../../.github/workflows/ci.yml");
const JUMP_CHROMIUM_PARTS = [...ci.matchAll(/\{ suite: jump, shard: "\d+\/(\d+)", browser: chromium \}/g)].length;

describe("e2e de DailyJump dans la CI", () => {
  it("la matrice a des parts DailyJump pour les trois navigateurs", () => {
    for (const browser of ["chromium", "firefox", "webkit"]) expect(ci, browser).toMatch(new RegExp(`suite: jump, shard: "\\d+/\\d+", browser: ${browser}`));
    expect(JUMP_CHROMIUM_PARTS).toBeGreaterThanOrEqual(1);
  });

  it("chaque spec de DailyJump est dans exactement une part Chromium", () => {
    const files = specFiles(gameOf("jump-chromium").dir);
    expect(files.length).toBeGreaterThan(10);
    const parts = assignParts(files, durees, JUMP_CHROMIUM_PARTS);
    expect(parts.flatMap((p) => p.files).sort()).toEqual(files);
    expect(parts.every((p) => p.files.length > 0), "aucune part vide").toBe(true);
  });

  it("chaque spec a sa durée mesurée (un nouveau spec s'ajoute à e2e/durees.json)", () => {
    const files = specFiles(gameOf("jump-chromium").dir);
    expect(files.filter((f) => !(f in durees))).toEqual([]);
    expect(Object.keys(durees).filter((f) => !files.includes(f)), "durées de specs disparus").toEqual([]);
  });

  it("la liste de tests porte le nom du projet de CI (jump-chromium)", () => {
    expect(testList(["smoke.spec.ts"], "jump-chromium")).toBe("[jump-chromium] › smoke.spec.ts\n");
    expect(read("../playwright.config.ts")).toContain("jump-${browser}");
  });

  it("une relance en CI seulement, rapport blob par part (comme DailyTrack)", () => {
    const config = read("../playwright.config.ts");
    expect(config).toContain("retries: CI ? 1 : 0");
    expect(config).toContain('["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }]');
  });

  it("les outils de mesure et de captures se sautent sans MESURE / CAPTURES, avec leur motif", () => {
    for (const f of specFiles(gameOf("jump-chromium").dir)) {
      const src = read(`../e2e/${f}`);
      if (f.startsWith("mesure-")) expect(src, f).toMatch(/test\.skip\(!process\.env\.MESURE, "outil de mesure : MESURE=1"\)/);
      if (src.includes("process.env.CAPTURES") && f.startsWith("captures")) expect(src, f).toMatch(/test\.skip\(.*CAPTURES.*"outil de captures?/);
    }
    // Le test de captures de themes.spec.ts : sauté hors CAPTURES, motif clair.
    expect(read("../e2e/themes.spec.ts")).toMatch(/test\.skip\(!process\.env\.CAPTURES \|\| browserName !== "chromium", "outil de captures : CAPTURES=1, Chromium"\)/);
    // Aucune étape de la CI ne les active.
    const code = ci.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(code).not.toMatch(/\bMESURE\b\s*[:=]/);
    expect(code).not.toMatch(/\bCAPTURES\b\s*[:=]/);
  });

  it("un test de DailyJump instable est nommé dans le résumé, ses durées sont préfixées « jump/ »", () => {
    const flat = (project: string, file: string, ms: number) => ({ project, file, ms, title: "", status: "expected" as const, attempts: 1, errors: [] });
    const t = (projectName: string, status: string, results: object[]) => ({ projectName, status, results });
    const report = {
      suites: [
        {
          file: "smoke.spec.ts",
          specs: [
            { title: "instable de DailyJump", file: "smoke.spec.ts", tests: [t("jump-chromium", "flaky", [{ status: "failed", duration: 400, error: { message: "Timeout" } }, { status: "passed", duration: 600 }])] },
            { title: "de DailyTrack", file: "smoke.spec.ts", tests: [t("chromium", "expected", [{ status: "passed", duration: 2000 }])] },
          ],
        },
      ],
    };
    const r = summarize(report);
    expect(r.flaky.map((x: { project: string }) => x.project)).toEqual(["jump-chromium"]);
    expect(r.markdown).toContain("`jump-chromium` · `smoke.spec.ts` › instable de DailyJump");
    expect(r.warnings.join("\n")).toContain("Test instable (jump-chromium)");
    expect(r.exitCode).toBe(0);
    // Même nom de fichier dans les deux jeux : deux lignes distinctes.
    expect(chromiumSeconds([flat("jump-chromium", "e2e/smoke.spec.ts", 1000), flat("chromium", "smoke.spec.ts", 2000)])).toEqual({ "jump/smoke.spec.ts": 1, "smoke.spec.ts": 2 });
  });
});
