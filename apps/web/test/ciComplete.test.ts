import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { candidats, dureeMin, jobsDeCi, jugerJobs, jugerStatuts, resumeVerdict, type Job, type WorkflowRun } from "../../../scripts/ci-complete.mjs";

// Lot R3 (plateforme) : la production exige la CI complète du commit. Lot R12 : « Mettre en production » la lance lui-même (ci.yml appelé, mode `complet`)
// ou reprend un run complet vert de ce commit ; un run `push` de main (mode `main`, l'Essentiel seulement) ne suffit plus.
const SHA = "0123456789abcdef0123456789abcdef01234567";
const run = (o: Partial<WorkflowRun>): WorkflowRun => ({ id: 1, head_sha: SHA, head_branch: "main", event: "schedule", status: "completed", conclusion: "success", html_url: "https://github.com/x/y/actions/runs/1", created_at: "2026-10-27T03:17:00Z", ...o });
const job = (name: string, conclusion: string | null = "success", o: Partial<Job> = {}): Job => ({ name, status: conclusion === null ? "in_progress" : "completed", conclusion, started_at: "2026-10-27T10:00:00Z", completed_at: "2026-10-27T10:14:00Z", ...o });
const COMPLET = ["scope", "zones", "unit (1/3)", "e2e-parts (chromium 1/8)", "e2e-parts (firefox, petit ensemble)", "api-image", "test", "e2e"];

describe("la CI complète : ce qui compte", () => {
  it("complète et verte = une matrice `e2e-parts`, `test` et `e2e` verts, aucun job en échec", () => {
    expect(jugerJobs(jobsDeCi(COMPLET.map((n) => job(n)), false)).state).toBe("vert");
    // les jobs appelés par production.yml : « ci / … »
    expect(jugerJobs(jobsDeCi([job("verifier"), ...COMPLET.map((n) => job(`ci / ${n}`)), job("figer", "failure")], true)).state).toBe("vert");
  });

  it("un job rouge, annulé ou un verdict manquant : rouge, avec les jobs en cause", () => {
    const rouge = jugerJobs(jobsDeCi(COMPLET.map((n) => job(n, n === "e2e-parts (chromium 1/8)" ? "failure" : "success")), false));
    expect(rouge).toEqual({ state: "rouge", rouges: ["e2e-parts (chromium 1/8)"] });
    expect(jugerJobs(jobsDeCi(COMPLET.filter((n) => n !== "e2e").map((n) => job(n)), false)).state).toBe("rouge");
    expect(jugerJobs(jobsDeCi(COMPLET.map((n) => job(n, n === "unit (1/3)" ? "cancelled" : "success")), false)).rouges).toEqual(["unit (1/3)"]);
  });

  it("une CI de PR (ou le commit des jours figés, `pr`) n'est jamais complète ; une CI pas finie : on attend", () => {
    expect(jugerJobs(jobsDeCi(["scope", "unit (1/1)", "e2e-pr (1/2)", "test", "e2e"].map((n) => job(n)), false)).state).toBe("incomplet");
    expect(jugerJobs(jobsDeCi([job("verifier")], true)).state).toBe("incomplet");
    expect(jugerJobs(jobsDeCi(COMPLET.map((n) => job(n, n === "e2e" ? null : "success")), false)).state).toBe("attendre");
  });

  it("reprise : la nuit, « Run workflow » ou un run du bouton de CE commit ; jamais un `push` de main, une PR, un autre commit ou un run rouge", () => {
    const ok = [run({ id: 1, event: "schedule" }), run({ id: 2, event: "workflow_dispatch", created_at: "2026-10-27T09:00:00Z" })];
    const non = [run({ id: 3, event: "push" }), run({ id: 4, event: "pull_request" }), run({ id: 5, head_sha: "f".repeat(40) }), run({ id: 6, conclusion: "failure" }), run({ id: 7, status: "in_progress", conclusion: null })];
    const prod = [run({ id: 8, event: "workflow_dispatch", conclusion: "failure", created_at: "2026-10-27T11:00:00Z" })];
    // le plus récent d'abord ; un run du bouton compte même s'il s'est arrêté plus loin (son job `ci` est jugé à part)
    expect(candidats([...ok, ...non], prod, SHA).map((r) => [r.id, r.appele])).toEqual([[8, true], [2, false], [1, false]]);
  });

  it("durée : du premier job lancé au dernier fini", () => {
    expect(dureeMin([job("a", "success", { started_at: "2026-10-27T10:00:00Z", completed_at: "2026-10-27T10:05:00Z" }), job("b", "success", { started_at: "2026-10-27T10:02:00Z", completed_at: "2026-10-27T10:13:40Z" })])).toBe(14);
    expect(dureeMin([])).toBeNull();
  });

  it("résumé : vert (relancée ou reprise, lien, durée) ; rouge = jobs, tests rouges et la phrase « Lance le lot de mise en production avec ce run »", () => {
    const url = "https://github.com/x/y/actions/runs/42";
    expect(resumeVerdict({ state: "vert", url, duree: 14, reprise: false, sha: SHA })).toContain("relancée par le bouton");
    expect(resumeVerdict({ state: "vert", url, duree: 14, reprise: true, sha: SHA })).toContain("reprise");
    const rouge = resumeVerdict({ state: "rouge", rouges: ["e2e"], echecsE2e: ["web/e2e/a.spec.ts › b"], url, duree: 9, reprise: false, sha: SHA });
    expect(rouge).toContain(`Lance le lot de mise en production avec ce run : ${url}`);
    expect(rouge).toContain("- web/e2e/a.spec.ts › b");
  });

  it("statuts d'un commit (les jours figés avant leur fusion) : le plus récent de chaque nom", () => {
    const c = (id: number, name: string, conclusion: string | null, started_at: string) => ({ id, name, status: conclusion ? "completed" : "queued", conclusion, started_at });
    expect(jugerStatuts([c(1, "test", "success", "2026-10-27T10:00:00Z"), c(2, "e2e", "success", "2026-10-27T10:00:00Z")], ["test", "e2e"]).state).toBe("vert");
    expect(jugerStatuts([c(1, "test", "success", "2026-10-27T10:00:00Z")], ["test", "e2e"]).state).toBe("attendre");
    expect(jugerStatuts([c(1, "test", "failure", "2026-10-27T10:00:00Z"), c(3, "test", "success", "2026-10-27T11:00:00Z"), c(2, "e2e", "failure", "2026-10-27T10:00:00Z")], ["test", "e2e"]).state).toBe("rouge");
  });
});

describe("production.yml : la CI d'abord, sans accès, et tout le reste en dépend", () => {
  const wf = readFileSync(new URL("../../../.github/workflows/production.yml", import.meta.url), "utf8");
  const job = (nom: string) => {
    const debut = wf.indexOf(`\n  ${nom}:\n`);
    const suite = wf.slice(debut + 1).search(/\n {2}[a-z-]+:\n/);
    return wf.slice(debut, suite < 0 ? undefined : debut + 1 + suite);
  };

  it("`ci` appelle ci.yml en mode complet sur le commit déployé, sans secret, sans environnement, sans fédération", () => {
    const ci = job("ci");
    expect(ci).toContain("uses: ./.github/workflows/ci.yml");
    expect(ci).toContain("mode: complet");
    expect(ci).toContain("ref: ${{ needs.verifier.outputs.sha }}");
    expect(ci).toContain("needs.verifier.outputs.ci_reprise != 'true'");
    expect(ci).not.toMatch(/secrets|environment|id-token/);
  });

  it("le verdict (`ci-complete.mjs verdict`) précède le garde-fou, la répétition, la sauvegarde et le déploiement", () => {
    expect(job("verifier")).toContain("ci-complete.mjs reprise");
    expect(job("ci-verdict")).toContain("ci-complete.mjs verdict");
    expect(job("figer")).toMatch(/needs: \[verifier, ci-verdict\]\n.*needs\.ci-verdict\.result == 'success'/);
    expect(job("recette-serveur")).toContain("needs: [verifier, figer]");
    expect(job("sauvegarde")).toContain("needs.recette-verification.result == 'success'");
    expect(job("serveur")).toContain("needs.sauvegarde.result == 'success'");
    for (const j of ["site", "verification", "etiquette"]) expect(job(j), j).toMatch(/needs: \[[^\n]*(serveur|site|verification)/);
  });

  it("ci.yml est appelable (workflow_call : mode, commit) et rend ses tests rouges", () => {
    const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(ci).toMatch(/workflow_call:\n\s+inputs:\n\s+mode:/);
    expect(ci).toContain("value: ${{ jobs.e2e.outputs.echecs }}");
    expect(ci).not.toMatch(/\$\{\{\s*secrets\./);
  });
});
