import { describe, expect, it } from "vitest";
import { summarize } from "../../../scripts/e2e-summary.mjs";

// Le résumé du run e2e (retouche 29b) : un test qui n'a réussi qu'à la relance doit apparaître, nommé, dans le résumé.
const test = (projectName: string, status: string, results: { status: string; duration?: number; error?: { message: string } }[]) => ({ projectName, status, results });
const report = {
  stats: { duration: 125_000 },
  suites: [
    {
      file: "watch.spec.ts",
      suites: [],
      specs: [
        { title: "stable", file: "watch.spec.ts", tests: [test("chromium", "expected", [{ status: "passed", duration: 1000 }])] },
        {
          title: "instable",
          file: "watch.spec.ts",
          tests: [test("chromium", "flaky", [{ status: "failed", duration: 500, error: { message: "Timeout 60000ms exceeded.\nautre ligne" } }, { status: "passed", duration: 700 }])],
        },
        { title: "sauté", file: "watch.spec.ts", tests: [test("firefox", "skipped", [])] },
      ],
    },
    {
      file: "salon.spec.ts",
      specs: [{ title: "cassé", file: "salon.spec.ts", tests: [test("webkit", "unexpected", [{ status: "failed", error: { message: "Expected: 1" } }, { status: "failed", error: { message: "Expected: 1" } }])] }],
    },
  ],
};

describe("résumé e2e", () => {
  it("nomme les instables et les échecs, compte les autres", () => {
    const r = summarize(report);
    expect(r.flaky.map((t) => t.title)).toEqual(["instable"]);
    expect(r.failed.map((t) => t.title)).toEqual(["cassé"]);
    expect(r.markdown).toContain("Tests instables (1)");
    expect(r.markdown).toContain("Timeout 60000ms exceeded.");
    expect(r.markdown).not.toContain("autre ligne");
    expect(r.warnings).toEqual(["::warning title=Test instable (chromium)::watch.spec.ts › instable"]);
    expect(r.markdown).toContain("2 min 05 s");
  });

  it("code de sortie : échec = 1 ; instable seul = 0, sauf au run de nuit (--fail-on-flaky)", () => {
    const flakyOnly = { ...report, suites: [report.suites[0]!] };
    expect(summarize(report).exitCode).toBe(1);
    expect(summarize(flakyOnly).exitCode).toBe(0);
    expect(summarize(flakyOnly, { failOnFlaky: true }).exitCode).toBe(1);
    expect(summarize({ suites: [] }).markdown).toContain("Aucun échec, aucun test instable.");
  });
});
