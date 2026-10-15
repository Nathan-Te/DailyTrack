import { test } from "@playwright/test";

// Mesure du lot 9 (outil, pas un test) : temps de fil principal par image avec les thèmes, méthode des lots 3 et 8 — téléphone 844 × 390
// @2, rendu logiciel (SwiftShader), processeur ×N (CDP, Chromium seulement), temps compté dans le jeu (`__jump.frameTimes`) : une image à
// 60 i/s = 2 pas de simulation + un dessin. Deux situations : le niveau du jour (rediffusion de l'auteur, `&solution`) et le carnage à 150
// vies (foule : 150 copies de la solution de l'essai, toutes en course). Pour chaque thème, effets normaux et réduits.
//   MESURE=1 npx playwright test mesure-themes --project=chromium
//   RATES=4 THEMES=nuit,foret EFFETS=normal : un sous-ensemble ; BASE=1 : sans `?theme=` (pour mesurer `main`, qui n'a pas de thèmes)
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(1_200_000);

test("temps de fil principal par image : niveau du jour et carnage à 150 vies, par thème", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const rows: string[] = [];
  const themes = process.env.BASE ? [""] : (process.env.THEMES ?? "foret,usine,glace,nuit,neon").split(",");
  for (const rate of (process.env.RATES ?? "4").split(",").map(Number)) {
    for (const theme of themes) {
      for (const effects of (process.env.EFFETS ?? "normal,reduit").split(",")) {
        for (const situation of ["jour", "carnage"] as const) {
          const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
          try {
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send("Emulation.setCPUThrottlingRate", { rate });
            if (effects === "reduit") {
              await page.addInitScript(() => localStorage.setItem("jump:settings", JSON.stringify({ v: 1, volume: 0.8, sfx: 1, ambience: 0.7, vibration: true, shake: true, effects: "reduit", reducedMotion: false })));
            }
            const t = theme ? `&theme=${theme}` : "";
            await page.goto(situation === "jour" ? `/?seed=2026-10-20&solution&debug&touch=1${t}` : `/?scenario=essai&debug&touch=1${t}`);
            await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready", null, { timeout: 120_000 });
            const result = await page.evaluate(async (carnage) => {
              type J = {
                carnage: { demo(n: number, crowd: boolean): boolean; state: { running: number; active: boolean } };
                frameTimes: { mean: number; p95: number; frames: number; stepMs: number; drawMs: number; reset(): void };
                theme?: { stats: { tileTriangles: number; decorTriangles: number; parallaxTriangles: number; buildMs: number } | null };
              };
              const j = (window as unknown as { __jump: J }).__jump;
              if (carnage) j.carnage.demo(150, true);
              const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
              await wait(1000);
              j.frameTimes.reset();
              const t0 = performance.now();
              await wait(4000);
              const f = j.frameTimes;
              return { stepMs: f.stepMs, drawMs: f.drawMs, mean: f.mean, p95: f.p95, frames: f.frames, seconds: (performance.now() - t0) / 1000, stats: j.theme?.stats ?? null };
            }, situation === "carnage");
            const ms = (v: number) => `${v.toFixed(2).replace(".", ",")} ms`;
            const tri = result.stats ? `${Math.round((result.stats.tileTriangles + result.stats.decorTriangles + result.stats.parallaxTriangles) / 1000)} k · ${Math.round(result.stats.buildMs)} ms` : "—";
            rows.push(`| ×${rate} | ${theme || "(main)"} | ${effects} | ${situation} | ${tri} | ${ms(result.stepMs)} | ${ms(result.drawMs)} | **${ms(2 * result.stepMs + result.drawMs)}** | ${ms(result.mean)} · ${ms(result.p95)} | ${(result.frames / result.seconds).toFixed(0)} |`);
          } finally {
            await context.close();
          }
        }
      }
    }
  }
  console.log(
    [
      "| Processeur | Thème | Effets | Situation | Triangles · construction | Simulation / pas | Dessin / image | Image à 60 i/s (2 pas + dessin) | Image mesurée (moy. · 95e c.) | Images/s (SwiftShader) |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
  );
});
