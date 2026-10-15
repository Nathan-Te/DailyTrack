import { test } from "@playwright/test";

// Mesure du lot 3 (outil, pas un test) : temps de fil principal par image pendant le carnage, à 50, 150 et 300 vies, profil téléphone
// 844 × 390 @2, rendu logiciel (SwiftShader), processeur ×1 et ×4 (CDP `Emulation.setCPUThrottlingRate`, Chromium seulement).
// Deux foules : `foule` = N copies de la solution, toutes en course en même temps jusqu'au bout (le pire cas pour la simulation et les
// carrés) ; `démo` = N vies fictives (morts, éclats, taches). Le temps compté est celui de la boucle du jeu (pas de simulation + préparation
// de l'image + `renderer.render`), mesuré dans le jeu (`__jump.frameTimes`) ; la rastérisation (SwiftShader) n'y est pas.
//   MESURE=1 npx playwright test mesure-carnage --project=chromium
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(600_000);

test("temps de fil principal du carnage à 50, 150 et 300 vies", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const rows: string[] = [];
  for (const rate of (process.env.RATES ?? "1,4").split(",").map(Number)) {
    for (const crowd of [true, false]) {
      for (const n of crowd ? [0, 50, 150, 300] : [50, 150, 300]) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        try {
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate });
          await page.goto("/?scenario=essai&debug&touch=1");
          await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
          const result = await page.evaluate(
            async ([lives, foule]) => {
              type J = { carnage: { demo(n: number, crowd: boolean): boolean; state: { running: number; tick: number; active: boolean } }; frameTimes: { mean: number; p95: number; frames: number; stepMs: number; drawMs: number; reset(): void } };
              const j = (window as unknown as { __jump: J }).__jump;
              j.carnage.demo(lives as number, foule as boolean);
              const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
              await wait(1000);
              j.frameTimes.reset();
              let running = 0;
              let samples = 0;
              const t0 = performance.now();
              while (performance.now() - t0 < 4000 && j.carnage.state.active) {
                running += j.carnage.state.running;
                samples++;
                await wait(100);
              }
              const f = j.frameTimes;
              return { mean: f.mean, p95: f.p95, frames: f.frames, stepMs: f.stepMs, drawMs: f.drawMs, seconds: (performance.now() - t0) / 1000, running: samples ? running / samples : 0 };
            },
            [n, crowd] as const,
          );
          const f = (v: number) => `${v.toFixed(2).replace(".", ",")} ms`;
          // À 60 images/s, une image = 2 pas de simulation + un dessin.
          rows.push(
            `| ×${rate} | ${crowd ? "foule" : "démo"} | ${n} | ${result.running.toFixed(0)} | ${f(result.stepMs)} | ${f(result.drawMs)} | **${f(2 * result.stepMs + result.drawMs)}** | ${f(result.mean)} · ${f(result.p95)} | ${(result.frames / result.seconds).toFixed(0)} |`,
          );
        } finally {
          await context.close();
        }
      }
    }
  }
  console.log(
    [
      "| Processeur | Vies | N | En course (moy.) | Simulation / pas | Dessin / image | Image à 60 i/s (2 pas + dessin) | Image mesurée (moy. · 95e c.) | Images/s (SwiftShader) |",
      "|---|---|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
  );
});
