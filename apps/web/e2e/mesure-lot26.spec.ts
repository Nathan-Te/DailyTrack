import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 26 (outil, pas un test) : ce que coûtent cinq fantômes et leurs étiquettes dans le Salon, profil mobile 844 × 390 @2,
// CPU ×1 et ×4 (CDP `Emulation.setCPUThrottlingRate`), la voiture conduite par le pilote automatique (`?demo`). On bascule entre « aucun
// fantôme » et « cinq fantômes » (`__cdj.salon.setGhostMode`) pendant la même course, en alternant 4 fois 4 s : chaque mode voit les mêmes
// endroits du circuit. Trois mesures, comptées dans le jeu :
//  - simulation des fantômes (`ghosts.cost.stepMs` / pas : elle tourne même quand ils sont masqués) ;
//  - placement des voitures et étiquettes (`ghosts.cost.placeMs` / image) ;
//  - `renderer.render` (`render.renderMs` / image) : le coût du fil principal pour dessiner la scène (JS de three.js ; la rastérisation,
//    elle, est faite par le processeur graphique, ou par SwiftShader dans le conteneur : les images par seconde ne disent rien).
// `MESURE=1 PERF_OUT=lot26.json npx playwright test mesure-lot26`.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(1_800_000);

const BASE = process.env.PERF_BASE ?? "http://localhost:4173";
const LEN = 10 * 60_000;
const START = Math.floor(1791549980000 / LEN) * LEN;

test("coût de cinq fantômes et de leurs étiquettes", async ({ browser }) => {
  const out: Record<string, number> = {};
  for (const quality of [0, 1, 2]) {
    for (const rate of (process.env.RATES ?? "1,4").split(",").map(Number)) {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      await page.addInitScript(() => localStorage.setItem("cdj:camera", "proche"));
      await page.goto(`${BASE}/?mode=salon&api=demo&demo&debug&quality=${quality}&salonAt=${START + 420_000}`);
      await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
      await page.waitForFunction(() => (window.__cdj.salon!.board?.rows.length ?? 0) >= 6, undefined, { timeout: 180_000, polling: 500 });
      await page.waitForFunction(() => window.__cdj.salon!.ghosts!.count >= 5, undefined, { timeout: 60_000 });
      await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
      await page.waitForTimeout(5000); // compilation des shaders, premiers effets
      const acc = { all: { render: 0, frames: 0, step: 0, steps: 0, place: 0, placeFrames: 0 }, off: { render: 0, frames: 0, step: 0, steps: 0, place: 0, placeFrames: 0 } };
      const snap = () => page.evaluate(() => ({ r: window.__cdj.render, c: { ...window.__cdj.salon!.ghosts!.cost }, shown: window.__cdj.salon!.ghosts!.shown }));
      let shown = 0;
      for (let round = 0; round < 4; round++) {
        for (const mode of ["off", "all"] as const) {
          await page.evaluate((m) => window.__cdj.salon!.setGhostMode(m), mode);
          await page.waitForTimeout(600);
          const a = await snap();
          await page.waitForTimeout(4000);
          const b = await snap();
          const t = acc[mode];
          t.render += b.r.renderMs - a.r.renderMs;
          t.frames += b.r.renderFrames - a.r.renderFrames;
          t.step += b.c.stepMs - a.c.stepMs;
          t.steps += b.c.steps - a.c.steps;
          t.place += b.c.placeMs - a.c.placeMs;
          t.placeFrames += b.c.frames - a.c.frames;
          if (mode === "all") shown = Math.max(shown, b.shown);
        }
      }
      const r = (n: number, d = 100) => Math.round(n * d) / d;
      const key = `q${quality} x${rate}`;
      out[`${key} : rendu sans fantôme, ms par image`] = r(acc.off.render / Math.max(1, acc.off.frames));
      out[`${key} : rendu avec cinq fantômes, ms par image`] = r(acc.all.render / Math.max(1, acc.all.frames));
      out[`${key} : simulation des fantômes, ms par pas`] = r(acc.all.step / Math.max(1, acc.all.steps), 10000);
      out[`${key} : placement et étiquettes, ms par image`] = r(acc.all.place / Math.max(1, acc.all.placeFrames), 1000);
      out[`${key} : fantômes dessinés`] = shown;
      out[`${key} : images (sans / avec)`] = acc.off.frames * 10000 + acc.all.frames;
      console.info(`${key} : ${JSON.stringify(Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith(key))))}`);
      await context.close();
    }
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
