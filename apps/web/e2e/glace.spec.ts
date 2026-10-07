import { expect, test } from "@playwright/test";
import { createGlaceTrack, encodeReplay, runPilot } from "@cdj/sim";

// Lot 16 : scénario `glace` (route puis longue ligne droite de glace, deux virages en roue libre, slalom).
// Le déterminisme du pilote dans les trois navigateurs est éprouvé par `daily.spec.ts` ; ici, Chromium : le jeu rejoue le
// pilote au temps de Node, sans erreur.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

test("?scenario=glace : le pilote finit au temps de Node, sans reprise", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const run = runPilot(createGlaceTrack(), { grip: 1 });
  expect(run.valid).toBe(true);
  await page.goto("/?debug&scenario=glace&timescale=6&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Circuit de glace");
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
  const finishMs = await page.evaluate(() => (window.__cdj.race as unknown as { finishMs: number }).finishMs);
  expect(finishMs).toBe(run.finishMs);
  expect(errors).toEqual([]);
});
