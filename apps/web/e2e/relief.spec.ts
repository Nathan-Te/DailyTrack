import { expect, test } from "@playwright/test";
import { CELL, FALL_TICKS, ReplayRecorder, carSpeed, cellKey, createAutopilot, createRace, createReliefTrack, encodeReplay, makeInput, runPilot, stepRace } from "@cdj/sim";

// Lot 17 : scénario `relief` (montées, descente, saut court, long saut, section sans rebords) et chute avec reprise automatique.
// Rendu 3D : Chromium seulement ; le déterminisme du pilote dans les trois navigateurs est éprouvé par `daily.spec.ts`.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const track = createReliefTrack();
const blockAt = (x: number, z: number) => track.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)))?.index ?? -1;

/** Le pilote jusqu'au bloc qui précède la rampe, puis un coup de frein et on repart trop lentement : le saut est raté. */
function slowJumpReplay() {
  const race = createRace(track);
  const drive = createAutopilot(track);
  const rec = new ReplayRecorder();
  let braking = false;
  let fallAt = -1;
  let respawnAt = -1;
  let fallPos: { x: number; z: number } | null = null;
  for (let t = 0; t < 120 * 60 && race.finishMs < 0 && respawnAt < 0; t++) {
    let input = drive(race);
    const kick = track.blocks.find((b) => b.kind === "kick")!;
    if (blockAt(race.car.x, race.car.z) >= kick.index - 2) {
      if (!braking && carSpeed(race.car) > 29) braking = true;
      if (braking && carSpeed(race.car) <= 29) braking = false;
      input = braking ? makeInput(0, 0, 1) : makeInput(0, 1, 0);
    }
    rec.record(input);
    stepRace(race, input);
    if (race.fallTicks === 1 && fallAt < 0) fallAt = t + 1;
    if (race.respawns > 0) {
      respawnAt = t + 1;
      fallPos = { x: race.car.x, z: race.car.z };
    }
  }
  return { code: encodeReplay(rec.toReplay(track.id)), fallAt, respawnAt, fallPos, tick: race.car.tick };
}

test("?scenario=relief : le pilote finit au temps de Node, sans chute, et franchit les deux sauts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const run = runPilot(track, { grip: 1 });
  expect(run.valid).toBe(true);
  expect(run.jumps).toHaveLength(2);
  await page.goto("/?debug&scenario=relief&timescale=6&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Circuit du relief");
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
  const end = await page.evaluate(() => {
    const r = window.__cdj.race as unknown as { finishMs: number; respawns: number };
    return { finishMs: r.finishMs, respawns: r.respawns };
  });
  expect(end.finishMs).toBe(run.finishMs);
  expect(end.respawns).toBe(0);
  expect(errors).toEqual([]);
});

test("un saut raté : la voiture tombe, le voile de chute monte, la reprise a lieu au point de contrôle après le délai (comme dans Node)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const plan = slowJumpReplay();
  expect(plan.fallAt).toBeGreaterThan(0);
  expect(plan.respawnAt - plan.fallAt + 1).toBe(FALL_TICKS);
  await page.goto("/?debug&scenario=relief&quality=2&shake=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate((c) => window.__cdj.autoplay(c), plan.code);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.evaluate(() => window.__cdj.manual(true));
  // Jusqu'au premier pas de la chute : le navigateur doit tomber au même pas que Node.
  await page.evaluate((n) => window.__cdj.advance(n), plan.fallAt);
  expect(await page.evaluate(() => (window.__cdj.race as unknown as { fallTicks: number }).fallTicks)).toBe(1);
  // Pendant la chute : voile sombre, bandeau, son (quelques images, sans avancer la simulation, pour que le voile monte).
  await page.evaluate((n) => window.__cdj.advance(n), FALL_TICKS - 14);
  for (let i = 0; i < 12; i++) await page.evaluate(() => window.__cdj.advance(0));
  const during = await page.evaluate(() => ({ veil: parseFloat(document.getElementById("fall")!.style.opacity || "0"), sounds: [...window.__cdj.audio.log] }));
  expect(during.veil).toBeGreaterThan(0.3);
  expect(during.sounds).toContain("fall");
  // La reprise : même pas que Node, même position, au dernier point de contrôle.
  await page.evaluate((n) => window.__cdj.advance(n), plan.respawnAt - plan.fallAt - (FALL_TICKS - 14));
  const after = await page.evaluate(() => {
    const r = window.__cdj.race as unknown as { respawns: number; fallTicks: number; checkpoints: { x: number; z: number }[] };
    return { respawns: r.respawns, fallTicks: r.fallTicks, cp: r.checkpoints[r.checkpoints.length - 1]!, tick: window.__cdj.car.tick, sounds: [...window.__cdj.audio.log] };
  });
  expect(after.respawns).toBe(1);
  expect(after.fallTicks).toBe(0);
  expect(after.tick).toBe(plan.tick);
  expect(after.sounds).toContain("respawn");
  expect(Math.abs(plan.fallPos!.x - after.cp.x)).toBeLessThan(1e-9);
  expect(Math.abs(plan.fallPos!.z - after.cp.z)).toBeLessThan(1e-9);
  // Le voile s'efface à la reprise (en temps réel : en pas à pas, le temps de l'interface ne passe pas).
  await page.evaluate(() => window.__cdj.manual(false));
  await expect.poll(() => page.evaluate(() => parseFloat(document.getElementById("fall")!.style.opacity || "0")), { timeout: 15_000 }).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});
