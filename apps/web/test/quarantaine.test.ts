import { describe, expect, it } from "vitest";
import { MAX_DAYS, MAX_ENTRIES, checkQuarantine, dayOf, loadQuarantine, matches } from "../../../scripts/e2e-quarantaine.mjs";
import { summarize } from "../../../scripts/e2e-summary.mjs";

// Lot R3 (plateforme) : la quarantaine des tests e2e (`e2e/quarantaine.json`) est un filet encadré. Ses garde-fous sont testés ici, et le
// fichier du dépôt est vérifié à chaque `npm test` : une entrée refusée rend le job `test` rouge, pas seulement le verdict `e2e`.
const TODAY = dayOf("2026-10-20")!;
const DOCS: Record<string, string> = {
  "docs/orchestration.md": "## 8. Pièges\n- `apps/web/e2e/salon.spec.ts:149` instable : …\n",
  "docs/jump/synthese.md": "## Dettes\n- `apps/jump/e2e/mobile.spec.ts` : …\n",
};
const readDoc = (p: string) => DOCS[p] ?? null;
const ok = {
  test: "web/e2e/salon.spec.ts › fin de session : podium",
  navigateur: "chromium",
  depuis: "2026-10-19",
  dette: "docs/orchestration.md#8-pièges-rencontrés-à-éviter",
  responsable: "lot 32 (DailyTrack)",
};
const check = (entrees: object[], today = TODAY) => checkQuarantine({ entrees }, { today, readDoc });

describe("quarantaine : garde-fous", () => {
  it("une entrée complète est acceptée, avec son projet Playwright", () => {
    const q = check([ok, { ...ok, test: "jump/e2e/mobile.spec.ts › glisser", navigateur: "webkit", dette: "docs/jump/synthese.md#dettes" }]);
    expect(q.errors).toEqual([]);
    expect(q.entries.map((e) => e.project)).toEqual(["chromium", "jump-webkit"]);
  });

  it("une entrée sans dette est refusée (absente, mauvais document, sans ancre, document qui ne nomme pas le test)", () => {
    for (const dette of [undefined, "", "docs/orchestration.md", "docs/jump/synthese.md#dettes", "https://example.com#x", "README.md#x"]) {
      const q = check([{ ...ok, dette }]);
      expect(q.errors.length, String(dette)).toBe(1);
      expect(q.errors[0]).toContain("« dette »");
      expect(q.entries).toEqual([]);
    }
    expect(check([{ ...ok, test: "web/e2e/watch.spec.ts › x" }]).errors[0]).toContain("ne nomme pas watch.spec.ts");
    expect(checkQuarantine({ entrees: [ok] }, { today: TODAY, readDoc: () => null }).errors[0]).toContain("introuvable");
  });

  it("les autres champs sont obligatoires : test au bon format, navigateur connu, date d'entrée, responsable ; pas de doublon", () => {
    expect(check([{ ...ok, test: "salon.spec.ts › x" }]).errors[0]).toContain("« test »");
    expect(check([{ ...ok, navigateur: "edge" }]).errors[0]).toContain("« navigateur »");
    expect(check([{ ...ok, depuis: "2026-02-30" }]).errors[0]).toContain("« depuis »");
    expect(check([{ ...ok, depuis: "2026-10-21" }]).errors[0]).toContain("futur");
    expect(check([{ ...ok, responsable: "  " }]).errors[0]).toContain("« responsable »");
    expect(check([ok, ok]).errors[0]).toContain("en double");
    expect(checkQuarantine({}, { today: TODAY, readDoc }).errors[0]).toContain("entrees");
  });

  it(`au plus ${MAX_ENTRIES} entrées`, () => {
    const four = ["a", "b", "c", "d"].map((t) => ({ ...ok, test: `web/e2e/salon.spec.ts › ${t}` }));
    expect(check(four.slice(0, MAX_ENTRIES)).errors).toEqual([]);
    expect(check(four).errors.join("\n")).toContain(`au plus ${MAX_ENTRIES}`);
  });

  it(`une entrée de plus de ${MAX_DAYS} jours est une dette expirée`, () => {
    expect(check([{ ...ok, depuis: "2026-10-06" }]).expired).toEqual([]); // 14 jours : encore tolérée
    const q = check([{ ...ok, depuis: "2026-10-05" }]);
    expect(q.errors).toEqual([]);
    expect(q.expired.map((e) => e.age)).toEqual([15]);
  });

  it("un test du rapport correspond à son entrée par le projet, le nom du fichier et les titres (describe compris)", () => {
    const entry = { ...ok, test: "web/e2e/tactile.spec.ts › iPhone 14 › pause", project: "chromium", age: 1 };
    expect(matches(entry, { project: "chromium", file: "tactile.spec.ts", title: "pause", path: ["iPhone 14", "pause"] })).toBe(true);
    expect(matches(entry, { project: "chromium", file: "tactile.spec.ts", title: "pause", path: ["Android (Pixel 7)", "pause"] })).toBe(false);
    expect(matches(entry, { project: "firefox", file: "tactile.spec.ts", title: "pause", path: ["iPhone 14", "pause"] })).toBe(false);
    expect(matches(entry, { project: "jump-chromium", file: "e2e/tactile.spec.ts", title: "pause", path: ["iPhone 14", "pause"] })).toBe(false);
  });
});

describe("quarantaine : effet sur le verdict", () => {
  const t = (title: string, status: string, results: object[], projectName = "chromium") => ({ projectName, status, results });
  const failedRun = [{ status: "failed", duration: 100, error: { message: "Expected: < 250" } }, { status: "failed", duration: 100, error: { message: "Expected: < 250" } }];
  const report = {
    suites: [
      {
        title: "salon.spec.ts",
        file: "salon.spec.ts",
        specs: [
          { title: "fin de session : podium", file: "salon.spec.ts", tests: [t("fin de session : podium", "unexpected", failedRun)] },
          { title: "autre", file: "salon.spec.ts", tests: [t("autre", "expected", [{ status: "passed", duration: 50 }])] },
        ],
      },
    ],
  };
  const quarantine = check([ok]);

  it("sur une PR : le test en quarantaine qui échoue est un avertissement nommé, le verdict reste vert", () => {
    const r = summarize(report, { mode: "pr", quarantine });
    expect(r.exitCode).toBe(0);
    expect(r.failed).toEqual([]);
    expect(r.excused.map((x) => x.title)).toEqual(["fin de session : podium"]);
    expect(r.markdown).toContain("En quarantaine (avertissement, non bloquant sur une PR)");
    expect(r.warnings.join("\n")).toContain("Test en quarantaine (chromium)");
  });

  it("sur main (complet) et la nuit : il reste bloquant", () => {
    for (const mode of ["complet", "nuit"] as const) {
      const r = summarize(report, { mode, quarantine });
      expect(r.exitCode, mode).toBe(1);
      expect(r.failed.map((x) => x.title)).toEqual(["fin de session : podium"]);
      expect(r.markdown).toContain("bloquante ici");
    }
  });

  it("un échec hors quarantaine reste rouge, même sur une PR", () => {
    expect(summarize(report, { mode: "pr", quarantine: check([]) }).exitCode).toBe(1);
    expect(summarize(report, { mode: "pr", quarantine: null }).exitCode).toBe(1);
  });

  it("une quarantaine refusée fait échouer le run, quel que soit le mode", () => {
    const refused = check([{ ...ok, dette: "" }]);
    for (const mode of ["pr", "complet", "nuit"] as const) {
      const r = summarize(report, { mode, quarantine: refused });
      expect(r.exitCode, mode).toBe(1);
      expect(r.markdown).toContain("Quarantaine refusée");
      expect(r.failed.length).toBe(1); // l'entrée refusée ne protège rien
    }
  });

  it("une dette expirée fait échouer le run de nuit seulement", () => {
    const old = check([{ ...ok, depuis: "2026-10-01" }]);
    const green = { suites: [{ title: "salon.spec.ts", file: "salon.spec.ts", specs: [{ title: "autre", file: "salon.spec.ts", tests: [t("autre", "expected", [{ status: "passed", duration: 50 }])] }] }] };
    expect(summarize(green, { mode: "pr", quarantine: old }).exitCode).toBe(0);
    expect(summarize(green, { mode: "complet", quarantine: old }).exitCode).toBe(0);
    const night = summarize(green, { mode: "nuit", quarantine: old });
    expect(night.exitCode).toBe(1);
    expect(night.markdown).toContain("Dettes expirées");
  });

  it("la nuit, un instable fait échouer le run (comme --fail-on-flaky)", () => {
    const flaky = { suites: [{ title: "a.spec.ts", file: "a.spec.ts", specs: [{ title: "x", file: "a.spec.ts", tests: [t("x", "flaky", [{ status: "failed", duration: 1 }, { status: "passed", duration: 1 }])] }] }] };
    expect(summarize(flaky, { mode: "complet" }).exitCode).toBe(0);
    expect(summarize(flaky, { mode: "nuit" }).exitCode).toBe(1);
  });
});

describe("le fichier du dépôt", () => {
  it("e2e/quarantaine.json respecte ses garde-fous", () => {
    const q = loadQuarantine();
    expect(q.errors).toEqual([]);
    expect(q.entries.length).toBeLessThanOrEqual(MAX_ENTRIES);
  });
});
