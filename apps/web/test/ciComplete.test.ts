import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summary, verdict, type WorkflowRun } from "../../../scripts/ci-complete.mjs";

// Lot R3 (plateforme) : la production exige la CI complète du commit (le run `push` de main de ci.yml, trois navigateurs). Décision testée ici ;
// production.yml la lance avant tout autre job, et tout le reste en dépend.
const SHA = "0123456789abcdef0123456789abcdef01234567";
const run = (o: Partial<WorkflowRun>): WorkflowRun => ({ id: 1, head_sha: SHA, head_branch: "main", event: "push", status: "completed", conclusion: "success", html_url: "https://github.com/x/y/actions/runs/1", created_at: "2026-10-19T20:00:00Z", ...o });

describe("la production exige la CI complète", () => {
  it("run push de main vert : on continue", () => {
    expect(verdict([run({})], SHA).state).toBe("vert");
  });

  it("rouge, annulée, sautée : refus, avec le lien du run", () => {
    for (const conclusion of ["failure", "cancelled", "timed_out", "skipped", "action_required"]) {
      const v = verdict([run({ conclusion })], SHA);
      expect(v.state, conclusion).toBe("rouge");
      expect(v.url).toBe("https://github.com/x/y/actions/runs/1");
      expect(summary(v, SHA)).toContain("la production refuse de déployer");
      expect(summary(v, SHA)).toContain("Une validation ne contourne pas ce refus");
    }
  });

  it("en cours, ou pas encore créé : on attend", () => {
    expect(verdict([run({ status: "in_progress", conclusion: null })], SHA).state).toBe("attendre");
    expect(verdict([], SHA).state).toBe("attendre");
  });

  it("un run de PR, d'une autre branche, d'un autre commit ou lancé à la main ne compte jamais", () => {
    for (const o of [{ event: "pull_request" }, { head_branch: "claude/lot-x" }, { head_sha: "f".repeat(40) }, { event: "workflow_dispatch" }, { event: "schedule" }])
      expect(verdict([run(o)], SHA).state, JSON.stringify(o)).toBe("attendre");
  });

  it("le plus récent des runs push de ce commit fait foi", () => {
    const old = run({ id: 1, conclusion: "failure", created_at: "2026-10-19T20:00:00Z" });
    const fresh = run({ id: 2, conclusion: "success", created_at: "2026-10-19T21:00:00Z" });
    expect(verdict([old, fresh], SHA).state).toBe("vert");
    expect(verdict([fresh, { ...old, created_at: "2026-10-19T22:00:00Z" }], SHA).state).toBe("rouge");
  });

  it("production.yml : le garde tourne d'abord, et tous les jobs qui déploient en dépendent", () => {
    const wf = readFileSync(new URL("../../../.github/workflows/production.yml", import.meta.url), "utf8");
    expect(wf).toContain("node scripts/ci-complete.mjs");
    expect(wf).toMatch(/\n {2}ci-complete:\n/);
    // `changes` (la première étape de tous les autres) attend le garde : recette, validation, API, Pages et vérification en découlent.
    expect(wf).toMatch(/\n {2}changes:\n {4}needs: ci-complete\n/);
    for (const job of ["recette", "api", "pages"]) expect(new RegExp(`\\n  ${job}:\\n    needs: \\[?[^\\n]*changes`).test(wf), job).toBe(true);
    expect(wf).toContain("actions: read");
  });
});
