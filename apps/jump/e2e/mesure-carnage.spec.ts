import { test } from "@playwright/test";

// Mesure du lot 3 (outil, pas un test) : temps de fil principal par image pendant le carnage, à 50, 150 et 300 vies, profil téléphone
// 844 × 390 @2, rendu logiciel (SwiftShader), processeur ×1 et ×4 (CDP `Emulation.setCPUThrottlingRate`, Chromium seulement).
// Deux foules : `foule` = N copies de la solution, toutes en course en même temps jusqu'au bout (le pire cas pour la simulation et les
// carrés) ; `démo` = N vies fictives (morts, éclats, taches). Le temps compté est celui de la boucle du jeu (pas de simulation + préparation
// de l'image + `renderer.render`), mesuré dans le jeu (`__jump.frameTimes`) ; la rastérisation (SwiftShader) n'y est pas.
// Lot 8 : avec et sans effets. « oui » = son déverrouillé par un geste (Web Audio en marche : sons du héros, morts du carnage au débit
// plafonné, scies) et particules au niveau normal ; « non » = `?fx=off` et aucun geste (pas de contexte audio).
//   MESURE=1 npx playwright test mesure-carnage --project=chromium
//   RATES=4 NS=0,150 EFFETS=oui,non : un sous-ensemble
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(600_000);

test("temps de fil principal du carnage à 50, 150 et 300 vies", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const rows: string[] = [];
  const ns = process.env.NS ? process.env.NS.split(",").map(Number) : null;
  for (const rate of (process.env.RATES ?? "1,4").split(",").map(Number)) {
    for (const effects of (process.env.EFFETS ?? "oui,non").split(",")) {
      for (const crowd of [true, false]) {
        for (const n of ns ?? (crowd ? [0, 50, 150, 300] : [50, 150, 300])) {
          if (!crowd && n === 0) continue;
          const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
          try {
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send("Emulation.setCPUThrottlingRate", { rate });
            await page.goto(`/?scenario=essai&debug&touch=1${effects === "oui" ? "" : "&fx=off"}`);
            await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
            if (effects === "oui") {
              // Un geste (Maj : aucune commande de jeu) déverrouille le son.
              await page.keyboard.press("Shift");
              await page.waitForFunction(() => (window as unknown as { __jump: { audio: { unlocked: boolean } } }).__jump.audio.unlocked);
            }
            const result = await page.evaluate(
              async ([lives, foule]) => {
                type J = {
                  carnage: { demo(n: number, crowd: boolean): boolean; state: { running: number; tick: number; active: boolean } };
                  frameTimes: { mean: number; p95: number; frames: number; stepMs: number; drawMs: number; reset(): void };
                  audio: { played: Record<string, number> };
                  effects: { carnageDropped: number };
                };
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
                const sounds = Object.values(j.audio?.played ?? {}).reduce((a, b) => a + b, 0);
                return { mean: f.mean, p95: f.p95, frames: f.frames, stepMs: f.stepMs, drawMs: f.drawMs, seconds: (performance.now() - t0) / 1000, running: samples ? running / samples : 0, sounds, dropped: j.effects?.carnageDropped ?? 0 };
              },
              [n, crowd] as const,
            );
            const f = (v: number) => `${v.toFixed(2).replace(".", ",")} ms`;
            // À 60 images/s, une image = 2 pas de simulation + un dessin.
            rows.push(
              `| ×${rate} | ${effects} | ${crowd ? "foule" : "démo"} | ${n} | ${result.running.toFixed(0)} | ${result.sounds} · ${result.dropped} | ${f(result.stepMs)} | ${f(result.drawMs)} | **${f(2 * result.stepMs + result.drawMs)}** | ${f(result.mean)} · ${f(result.p95)} | ${(result.frames / result.seconds).toFixed(0)} |`,
            );
          } finally {
            await context.close();
          }
        }
      }
    }
  }
  console.log(
    [
      "| Processeur | Effets | Vies | N | En course (moy.) | Sons joués · événements écartés | Simulation / pas | Dessin / image | Image à 60 i/s (2 pas + dessin) | Image mesurée (moy. · 95e c.) | Images/s (SwiftShader) |",
      "|---|---|---|---|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
  );
});

// Lot P3 (plateforme) : le carnage de tout le monde à 150 vies (l'échantillon du serveur), ton essai en héros, processeur ×1 et ×4, avec la
// démonstration (`?api=demo` : l'échantillon des joueurs fictifs, tel quel pour N = 0, repris jusqu'à 150 vies par `__jump.startEveryone(150)`).
//   MESURE=1 npx playwright test mesure-carnage -g "tout le monde" --project=chromium
test("temps de fil principal du carnage de tout le monde à 150 vies", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const rows: string[] = [];
  for (const rate of (process.env.RATES ?? "1,4").split(",").map(Number)) {
    for (const n of (process.env.NS ?? "0,150").split(",").map(Number)) {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      try {
        const page = await context.newPage();
        await page.goto("/?debug&touch=1&api=demo&accueil=0");
        await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
        await page.keyboard.press("Shift");
        // Ton essai (la preuve de l'auteur), joué pas à pas, puis ton carnage passé : l'arrivée et l'échantillon.
        await page.evaluate(() => {
          type W = { manual(on: boolean): void; autoplay(): number; advance(n: number): unknown; phase: string; carnage: { skip(): void } };
          const w = (window as unknown as { __jump: W }).__jump;
          w.manual(true);
          const total = w.autoplay();
          for (let t = 0; t < total + 5 && w.phase !== "carnage"; t++) w.advance(1);
          w.carnage.skip();
          w.manual(false);
        });
        await page.waitForFunction(() => (window as unknown as { __jump: { everyone: { loaded: boolean } } }).__jump.everyone.loaded);
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        const result = await page.evaluate(async (lives) => {
          type J = {
            startEveryone(max?: number): boolean;
            carnage: { state: { running: number; active: boolean; label: string } };
            frameTimes: { mean: number; p95: number; frames: number; stepMs: number; drawMs: number; reset(): void };
            audio: { played: Record<string, number> };
            effects: { carnageDropped: number };
          };
          const j = (window as unknown as { __jump: J }).__jump;
          if (!j.startEveryone(lives || 1)) return null;
          const label = j.carnage.state.label;
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
          const sounds = Object.values(j.audio?.played ?? {}).reduce((a, b) => a + b, 0);
          return { label, mean: f.mean, p95: f.p95, frames: f.frames, stepMs: f.stepMs, drawMs: f.drawMs, seconds: (performance.now() - t0) / 1000, running: samples ? running / samples : 0, sounds, dropped: j.effects?.carnageDropped ?? 0 };
        }, n);
        if (!result) throw new Error("carnage de tout le monde indisponible");
        const f = (v: number) => `${v.toFixed(2).replace(".", ",")} ms`;
        rows.push(
          `| ×${rate} | ${n === 0 ? "échantillon de la démo" : n} | ${result.label} | ${result.running.toFixed(0)} | ${result.sounds} · ${result.dropped} | ${f(result.stepMs)} | ${f(result.drawMs)} | **${f(2 * result.stepMs + result.drawMs)}** | ${f(result.mean)} · ${f(result.p95)} | ${(result.frames / result.seconds).toFixed(0)} |`,
        );
      } finally {
        await context.close();
      }
    }
  }
  console.log(
    [
      "| Processeur | Vies | Compteur | En course (moy.) | Sons joués · événements écartés | Simulation / pas | Dessin / image | Image à 60 i/s (2 pas + dessin) | Image mesurée (moy. · 95e c.) | Images/s (SwiftShader) |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
  );
});
