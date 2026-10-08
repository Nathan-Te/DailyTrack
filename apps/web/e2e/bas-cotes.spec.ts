import { expect, test } from "@playwright/test";
import { ReplayRecorder, createBasCotesTrack, createRace, createSurface, encodeReplay, makeInput, runPilot, stepRace, trackWorld } from "@cdj/sim";

// Lot 21 : bas-côtés, vibreurs, route bosselée. Le rendu 3D est vérifié dans Chromium (WebGL) ; la course est la même partout.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const track = createBasCotesTrack();

test("?scenario=bas-cotes : le pilote finit au temps de Node, et ses roues passent sur les vibreurs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/?debug&scenario=bas-cotes&timescale=6&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Bas-côtés et vibreurs");
  const run = runPilot(track, { grip: 1 });
  expect(run.valid).toBe(true);
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    const w = window as unknown as { __kerb: number; __timer?: number };
    w.__kerb = 0;
    w.__timer = window.setInterval(() => {
      w.__kerb = Math.max(w.__kerb, (window.__cdj.fx as unknown as { tel: { kerb: number } }).tel.kerb);
    }, 15);
  });
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
  const end = await page.evaluate(() => {
    const w = window as unknown as { __kerb: number; __timer: number };
    window.clearInterval(w.__timer);
    return { finishMs: (window.__cdj.race as unknown as { finishMs: number }).finishMs, kerb: w.__kerb };
  });
  expect(end.finishMs).toBe(run.finishMs);
  expect(end.kerb).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("sortir sur l'herbe : le revêtement sous la voiture change, le bandeau le dit, et le navigateur calcule la même voiture que Node", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Node : la voiture accélère tout droit, puis braque à gauche sur le bas-côté d'herbe du premier virage (blocs 2 à 6).
  const race = createRace(track);
  const rec = new ReplayRecorder();
  const world = trackWorld(track);
  const s = createSurface();
  let onGrass = -1;
  for (let t = 0; t < 12 * 120 && onGrass < 0; t++) {
    const input = makeInput(t > 150 && t < 200 ? -0.6 : 0, 1, 0);
    rec.record(input);
    stepRace(race, input);
    world.sample(race.car.x, race.car.z, s);
    if (s.kind === "grass" && t > 150) onGrass = t + 1;
  }
  expect(onGrass).toBeGreaterThan(0);
  for (let k = 0; k < 30; k++) {
    const input = makeInput(0, 1, 0);
    rec.record(input);
    stepRace(race, input);
  }
  const ticks = onGrass + 30;
  await page.goto("/?debug&scenario=bas-cotes&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(rec.toReplay(track.id)));
  for (let guard = 0; guard < 400; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= ticks) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(30, ticks - at));
  }
  const got = await page.evaluate(() => ({ x: window.__cdj.car.x, z: window.__cdj.car.z, surface: (window.__cdj.fx as unknown as { tel: { surface: string } }).tel.surface, hud: document.getElementById("fx")!.textContent }));
  expect(got.x).toBe(race.car.x);
  expect(got.z).toBe(race.car.z);
  expect(got.surface).toBe("grass");
  expect(got.hud).toContain("HERBE");
  expect(errors).toEqual([]);
});
