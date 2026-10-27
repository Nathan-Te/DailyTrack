import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignParts, gameOf, specFiles, testList } from "../../../scripts/e2e-parts.mjs";
import { chromiumSeconds, summarize } from "../../../scripts/e2e-summary.mjs";
import { matriceComplete } from "../../../scripts/ci-zones.mjs";

// Lot 3c : les e2e de DailyJump suivent les règles de CI de DailyTrack (matrice, rapport fusionné, une relance, instables nommés).
// Ces tests gardent la plomberie : aucun spec de DailyJump oublié par les parts, outils sautés avec leur motif, config de CI.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const durees = JSON.parse(read("../e2e/durees.json")).secondes as Record<string, number>;
const ci = read("../../../.github/workflows/ci.yml");
// Lot R13 : la matrice de la CI complète vient de scripts/ci-zones.mjs (`matriceComplete`).
const JUMP_CHROMIUM_PARTS = matriceComplete("nuit").include.filter((x) => x.suite === "jump").length;

describe("e2e de DailyJump dans la CI", () => {
  it("la matrice a des parts DailyJump en Chromium ; Firefox et WebKit lancent le petit ensemble des deux jeux (lot R13)", () => {
    expect(JUMP_CHROMIUM_PARTS).toBeGreaterThanOrEqual(1);
    for (const browser of ["firefox", "webkit"]) expect(matriceComplete("nuit").include, browser).toContainEqual({ suite: "navigateurs", browser, shard: "1/1", essentiel: false });
    expect(ci).toContain("npm run e2e -w @cdj/jump -- --project=jump-${{ matrix.browser }}");
    expect(read("../playwright.config.ts")).toMatch(/name: name\("firefox"\), grep: \/@navigateurs\//);
    expect(read("../playwright.config.ts")).toMatch(/name: name\("webkit"\), grep: \/@navigateurs\//);
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

  it("les outils de mesure et de captures ne sont jamais dans la CI : ni dans les parts, ni listés sans leur variable (lot R13)", () => {
    const outils = readdirSync(new URL("../e2e/", import.meta.url)).filter((f) => /^(captures|mesure)[-.].*\.spec\.ts$/.test(f));
    expect(outils.length).toBeGreaterThan(0);
    for (const f of outils) expect(specFiles(gameOf("jump-chromium").dir), f).not.toContain(f);
    expect(read("../playwright.config.ts")).toContain('testIgnore: OUTIL ? [] : ["**/captures*.spec.ts", "**/mesure*.spec.ts"]');
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
