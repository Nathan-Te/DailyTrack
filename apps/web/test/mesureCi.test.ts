import { describe, expect, it } from "vitest";
import { analyser, cleDePr, dureesDuDepot, lundiDe, mediane, mesureDuRun, minutesDuJob, percentile, specsLesPlusLongs, tableau } from "../../../scripts/mesure-ci.mjs";

// Lot R10 : l'outil de mesure de la CI (scripts/mesure-ci.mjs) — des calculs purs, vérifiés sans réseau sur des runs inventés.
const t = (hhmmss: string, jour = "2026-10-20") => `${jour}T${hhmmss}Z`;
const job = (debut: string, fin: string, conclusion = "success") => ({ conclusion, started_at: t(debut), completed_at: t(fin) });
const run = (extra: object = {}) => ({
  id: 1, event: "pull_request", status: "completed", head_branch: "claude/x", created_at: t("10:00:00"), run_started_at: t("10:00:00"), updated_at: t("10:10:00"), pull_requests: [{ number: 7 }], ...extra,
});

describe("minutes d'un job", () => {
  it("arrondies à la minute supérieure, comme la facturation", () => {
    expect(minutesDuJob(job("10:00:00", "10:00:01"))).toBe(1);
    expect(minutesDuJob(job("10:00:00", "10:01:00"))).toBe(1);
    expect(minutesDuJob(job("10:00:00", "10:01:01"))).toBe(2);
  });
  it("0 pour un job sauté, jamais démarré ou annulé après plus de 2 h", () => {
    expect(minutesDuJob(job("10:00:00", "10:05:00", "skipped"))).toBe(0);
    expect(minutesDuJob({ conclusion: "cancelled", started_at: null, completed_at: null })).toBe(0);
    expect(minutesDuJob(job("10:00:00", "13:00:00", "cancelled"))).toBe(0);
    expect(minutesDuJob(job("10:00:00", "10:03:00", "cancelled"))).toBe(3);
  });
});

describe("statistiques", () => {
  it("médiane et p90 par le rang le plus proche ; liste vide = NaN", () => {
    expect(mediane([5, 1, 3])).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 50)).toBeNaN();
  });
  it("semaine = lundi UTC", () => {
    expect(lundiDe(t("23:59:59", "2026-10-25"))).toBe("2026-10-19"); // dimanche
    expect(lundiDe(t("00:00:00", "2026-10-26"))).toBe("2026-10-26"); // lundi
  });
  it("une PR se reconnaît à son numéro, à défaut à sa branche ; push et nuit n'en ont pas", () => {
    expect(cleDePr(run())).toBe(7);
    expect(cleDePr(run({ pull_requests: [] }))).toBe("claude/x");
    expect(cleDePr(run({ event: "push" }))).toBeNull();
  });
});

describe("mesure d'un run", () => {
  it("minutes de jobs, durée murale (du début du run à la fin du dernier job) et attente dans la file", () => {
    const m = mesureDuRun(run({ created_at: t("10:00:00"), run_started_at: t("10:00:20") }), [
      job("10:00:30", "10:02:10"), // 100 s → 2 min ; attente 30 s
      job("10:01:00", "10:06:00"), // 5 min ; attente 60 s
      job("10:00:40", "10:00:40", "skipped"),
    ]);
    expect(m.minutes).toBe(7);
    expect(m.murMin).toBeCloseTo(5 + 40 / 60, 5);
    expect(m.files).toEqual([30, 60]);
  });
});

describe("analyse par semaine", () => {
  const runs = [
    { run: run({ id: 1 }), jobs: [job("10:00:10", "10:04:00")] },
    { run: run({ id: 2, created_at: t("11:00:00"), run_started_at: t("11:00:00") }), jobs: [job("11:01:00", "11:03:00")] },
    { run: run({ id: 3, pull_requests: [{ number: 8 }], head_branch: "claude/y" }), jobs: [job("10:00:00", "10:02:00")] },
    { run: run({ id: 4, event: "push", pull_requests: [] }), jobs: [job("10:00:00", "10:10:00")] },
    { run: run({ id: 5, status: "in_progress" }), jobs: [job("10:00:00", "10:10:00")] },
    { run: run({ id: 6, created_at: t("10:00:00", "2026-10-26"), run_started_at: t("10:00:00", "2026-10-26") }), jobs: [job("10:00:00", "10:01:00").constructor === Object ? { conclusion: "success", started_at: t("10:00:05", "2026-10-26"), completed_at: t("10:01:00", "2026-10-26") } : null] },
  ];
  const a = analyser(runs as never);
  it("un run non terminé ne compte pas ; deux semaines ; deux PR, trois runs de PR dont un autre jour", () => {
    expect(a.semaines.map((s) => s.semaine)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(a.total.runs).toBe(5);
    const s1 = a.semaines[0]!;
    expect(s1).toMatchObject({ runs: 4, prs: 2, runsParPr: 1.5, minutes: 4 + 2 + 2 + 10 });
    expect(s1.minutesParRun).toBe(4.5);
  });
  it("le tableau Markdown a une ligne par semaine et un total", () => {
    const lignes = tableau(a).split("\n");
    expect(lignes).toHaveLength(2 + 2 + 1);
    expect(lignes.at(-1)).toContain("**Total**");
  });
});

describe("specs les plus longs", () => {
  it("tri décroissant, à égalité par nom, coupé à n", () => {
    expect(specsLesPlusLongs({ "web/b.spec.ts": 10, "web/a.spec.ts": 10, "jump/c.spec.ts": 50 }, 2)).toEqual([
      { spec: "jump/c.spec.ts", secondes: 50 },
      { spec: "web/a.spec.ts", secondes: 10 },
    ]);
  });
  it("les durées du dépôt couvrent les deux jeux, sans les outils sautés (durée 0)", () => {
    const d = dureesDuDepot();
    expect(Object.keys(d).some((k) => k.startsWith("web/"))).toBe(true);
    expect(Object.keys(d).some((k) => k.startsWith("jump/"))).toBe(true);
    expect(Object.keys(d).filter((k) => /captures|mesure-/.test(k))).toEqual([]);
    expect(specsLesPlusLongs(d)).toHaveLength(20);
  });
});
