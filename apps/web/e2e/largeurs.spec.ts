import { expect, test } from "@playwright/test";
import { bestPilotRun, createLargeursTrack, encodeReplay } from "@cdj/sim";

// Lot 12 : scénario `largeurs` (trois largeurs de route, transitions, courbe ample, S large, rétrécissement avant un virage).
// Rendu 3D : Chromium seulement ; le déterminisme des circuits du jour (largeurs comprises) dans les trois navigateurs est
// éprouvé par `daily.spec.ts` (le générateur et le pilote tournent dans chaque navigateur).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

test("?scenario=largeurs : le circuit se charge et la rediffusion du pilote donne le temps que Node a calculé", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const run = bestPilotRun(createLargeursTrack())!;
  await page.goto("/?debug&scenario=largeurs&timescale=6");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Circuit des largeurs");

  // Le monde du navigateur est celui de Node : mêmes largeurs, mêmes portes.
  const widths = await page.evaluate(() => {
    const t = (window.__cdj.race as unknown as { track: { blocks: { w0: number; w1: number }[]; gates: { halfWidth: number }[] } }).track;
    return { widths: [...new Set(t.blocks.flatMap((b) => [b.w0, b.w1]))].sort((a, b) => a - b), gates: t.gates.map((g) => g.halfWidth) };
  });
  expect(widths.widths).toEqual([14, 20, 26]);
  expect(widths.gates.every((h) => [7, 10, 13].includes(h))).toBe(true);

  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 100_000 });
  const finishMs = await page.evaluate(() => (window.__cdj.race as unknown as { finishMs: number }).finishMs);
  expect(finishMs).toBe(run.finishMs);
  expect(errors).toEqual([]);
});
