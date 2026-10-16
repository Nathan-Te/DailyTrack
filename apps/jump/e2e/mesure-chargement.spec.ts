import { test } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";

// Mesure du lot 7b (outil, pas un test) : temps de fil principal bloqué par le chargement du niveau du jour, profil téléphone 844 × 390 @2,
// rendu logiciel, processeur ×1 et ×4 (CDP `Emulation.setCPUThrottlingRate`, Chromium seulement, comme la mesure du lot 3).
// Trois cas, cache vide à chaque fois sauf le dernier : « avant » = sans worker (la génération se fait sur le fil principal, exactement comme
// avant le 7b), « worker », « cache » (relecture : preuve rejouée). Deux chiffres : `blockedMs` (le travail du fil principal dans le
// chargeur : génération en repli, sinon reconstruction du niveau) et la somme des **tâches longues** (> 50 ms, `PerformanceObserver`) avant que
// le jeu soit prêt — celle-là compte aussi la construction de la scène, qui ne change pas. Médiane de N passages.
//   MESURE=1 npx playwright test mesure-chargement --project=chromium        (N=5 par défaut : RUNS=9)
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(600_000);

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

test("fil principal bloqué par le chargement du niveau du jour", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const runs = Number(process.env.RUNS ?? 5);
  const rows: string[] = [];
  for (const rate of [1, 4]) {
    for (const mode of ["avant (fil principal)", "worker", "cache"] as const) {
      const blocked: number[] = [];
      const long: number[] = [];
      const longest: number[] = [];
      const total: number[] = [];
      for (let i = 0; i < runs; i++) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        try {
          await shiftDate(context, FIXED_NOW);
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate });
          if (mode === "avant (fil principal)") await page.addInitScript(() => void delete (window as unknown as { Worker?: unknown }).Worker);
          await page.addInitScript(() => {
            const w = window as unknown as { __longTasks: number[] };
            w.__longTasks = [];
            new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__longTasks.push(e.duration))).observe({ type: "longtask", buffered: true });
          });
          const open = async () => {
            await page.goto("/?debug&touch=1&accueil=0");
            await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
          };
          await open();
          if (mode === "cache") {
            // Le second chargement lit le cache écrit par le premier.
            await page.reload();
            await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
          }
          const r = await page.evaluate(() => {
            const w = window as unknown as { __longTasks: number[]; __jump: { daily: { load: { source: string; blockedMs: number; totalMs: number } } } };
            const t = w.__longTasks;
            return { load: w.__jump.daily.load, long: t.reduce((a, b) => a + b, 0), longest: t.reduce((a, b) => Math.max(a, b), 0) };
          });
          blocked.push(r.load.blockedMs);
          total.push(r.load.totalMs);
          long.push(r.long);
          longest.push(r.longest);
        } finally {
          await context.close();
        }
      }
      const f = (v: number[]) => `${median(v).toFixed(0)} ms`;
      rows.push(`| ×${rate} | ${mode} | ${f(blocked)} | ${f(total)} | ${f(long)} | ${f(longest)} |`);
    }
  }
  console.log(
    ["| Processeur | Chargement | Fil principal dans le chargeur | Chargement complet du niveau | Tâches longues (somme, avant « prêt ») | Plus longue tâche |", "|---|---|---|---|---|---|", ...rows].join("\n"),
  );
});
