import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 37 (outil, pas un test) : appels de rendu et triangles par image (`__cdj.render`, `?debug`) au départ, sur un circuit de chaque thème, puis le coût du fil
// principal par image (CDP, profil mobile 844 × 390 @2, processeur ×4). `MESURE=1 PERF_BASE=http://localhost:4174 PERF_OUT=avant.json npx playwright test mesure-lot37`
// (`main` servi sur un autre port pour l'« avant »). Rendu logiciel : les images par seconde ne disent rien, les appels, les triangles et le temps de fil principal oui.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(1_800_000);

const BASE = process.env.PERF_BASE ?? "http://localhost:4173";
// Les jours des captures du lot 37 (le jour où `main` avait le plus d'éléments en l'air), thème imposé pour Banquise et Campagne.
const SCENES: Record<string, string> = {
  stade: "seed=2026-10-08",
  rallye: "seed=2026-10-21",
  banquise: "seed=2026-10-10&theme=banquise",
  nuit: "seed=2026-10-14",
  campagne: "seed=2026-10-14&theme=campagne",
  canyon: "seed=2026-10-06",
  col: "seed=2026-10-12",
  ville: "seed=2026-10-16",
};

test("appels, triangles et fil principal par image", async ({ browser }) => {
  const out: Record<string, number> = {};
  for (const [name, query] of Object.entries(SCENES)) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => localStorage.setItem("cdj:camera", "proche"));
    await page.goto(`${BASE}/?debug&${query}&quality=2&ghost=off&fx=off&shake=0&home=0&demo`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.waitForTimeout(9000);
    const info = await page.evaluate(() => ({ calls: window.__cdj.render.calls, triangles: window.__cdj.render.triangles }));
    out[`${name} appels`] = info.calls;
    out[`${name} triangles`] = info.triangles;
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number };
      w.__frames = 0;
      const tick = () => {
        w.__frames++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const read = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const a = await read();
    await page.waitForTimeout(4500);
    const b = await read();
    const frames = await page.evaluate(() => (window as unknown as { __frames: number }).__frames);
    out[`${name} ms/image x4`] = Math.round((((b.TaskDuration ?? 0) - (a.TaskDuration ?? 0)) * 100000) / Math.max(1, frames)) / 100;
    console.info(`${name} : ${info.calls} appels, ${info.triangles} triangles, ${out[`${name} ms/image x4`]} ms/image (×4), ${frames} images`);
    await context.close();
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
