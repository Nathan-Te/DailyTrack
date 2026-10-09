import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 23 (outil, pas un test) : temps de fil principal par image (CDP `Performance.getMetrics`, profil mobile 844 × 390 @2, CPU ×1 et ×4),
// par thème et par niveau de qualité. `MESURE=1 PERF_BASE=http://localhost:4174 PERF_OUT=avant.json npx playwright test mesure-lot23`.
// Rendu logiciel (SwiftShader) : les images par seconde ne disent rien, le coût du fil principal oui.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(1_800_000);

const BASE = process.env.PERF_BASE ?? "http://localhost:4173";
const SCENES: Record<string, string> = {
  pilotage: "?scenario=pilotage&demo",
  stade: "?demo&seed=2026-10-11",
  nuit: "?demo&seed=2026-10-14",
  ville: "?demo&seed=2026-10-16",
  canyon: "?demo&seed=2026-10-10",
};
const only = process.env.SCENES?.split(",");

test("fil principal par image", async ({ browser }) => {
  const out: Record<string, number> = {};
  for (const [name, query] of Object.entries(SCENES)) {
    if (only && !only.includes(name)) continue;
    for (const quality of [0, 1, 2]) {
      for (const rate of (process.env.RATES ?? "1,4").split(",").map(Number)) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Performance.enable");
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        await page.addInitScript(() => localStorage.setItem("cdj:camera", "proche"));
        await page.goto(`${BASE}/${query}&debug&quality=${quality}`);
        await page.waitForFunction(() => window.__cdj?.phase);
        await page.waitForTimeout(9000); // après le départ, les premiers effets (compilation des shaders) et le premier changement de caméra de la démo (à 7 s)
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
        await page.waitForTimeout(4500); // finit avant le second changement de caméra de la démo (14 s)
        const b = await read();
        const frames = await page.evaluate(() => (window as unknown as { __frames: number }).__frames);
        const ms = (((b.TaskDuration ?? 0) - (a.TaskDuration ?? 0)) * 1000) / Math.max(1, frames);
        const script = (((b.ScriptDuration ?? 0) - (a.ScriptDuration ?? 0)) * 1000) / Math.max(1, frames);
        out[`${name} q${quality} x${rate}`] = Math.round(ms * 100) / 100;
        out[`${name} q${quality} x${rate} script`] = Math.round(script * 100) / 100;
        out[`${name} q${quality} x${rate} images`] = frames;
        console.info(`${name} q${quality} ×${rate} : ${ms.toFixed(2)} ms/image (script ${script.toFixed(2)}), ${frames} images`);
        await context.close();
      }
    }
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
