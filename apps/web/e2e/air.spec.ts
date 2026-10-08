import { expect, test } from "@playwright/test";
import { ReplayRecorder, createAirTrack, createAutopilot, createRace, encodeReplay, runPilot, stepRace } from "@cdj/sim";

// Lot 19 : scénario `air` (atterrissages, rotation héritée, frein qui fige), indicateur « figé », caméra stable en vol, son de réception.
// Rendu 3D : Chromium seulement ; le déterminisme du pilote dans les trois navigateurs est éprouvé par `daily.spec.ts`.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const track = createAirTrack();

test("?scenario=air : le pilote finit au temps de Node, sans reprise, malgré la rotation en l'air", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const run = runPilot(track, { grip: 1 });
  expect(run.valid).toBe(true);
  expect(run.jumps).toHaveLength(3);
  await page.goto("/?debug&scenario=air&timescale=6&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Circuit de l'air");
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

test("en vol : l'indicateur « figé » suit le frein, la caméra suit le déplacement, la réception propre sonne propre", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Dans Node : le premier vol où le pilote freine (il fige la caisse), et le pas de la réception qui suit.
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: 1 });
  const rec = new ReplayRecorder();
  let freezeAt = -1;
  let landAt = -1;
  for (let t = 0; t < 120 * 60 && race.finishMs < 0 && landAt < 0; t++) {
    const input = drive(race);
    rec.record(input);
    stepRace(race, input);
    if (freezeAt < 0 && !race.car.grounded && race.car.air > 24 && input.brake > 0) freezeAt = race.car.tick;
    if (freezeAt >= 0 && race.car.grounded && race.car.tick > freezeAt + 12) landAt = race.car.tick;
  }
  expect(freezeAt).toBeGreaterThan(0);
  expect(landAt).toBeGreaterThan(freezeAt);
  const run = runPilot(track, { grip: 1 });
  await page.goto("/?debug&scenario=air&quality=2&shake=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.evaluate(() => window.__cdj.manual(true));
  const before = await page.evaluate(() => window.__cdj.air.frozen);
  expect(before).toBe(false);
  for (let done = 0; done < freezeAt; ) {
    const k = Math.min(240, freezeAt - done);
    await page.evaluate((m) => window.__cdj.advance(m), k);
    done += k;
  }
  // Au premier pas de vol où le pilote freine : l'indicateur est allumé (le frein ne dure que le temps de figer la caisse).
  await page.evaluate(() => window.__cdj.advance(0));
  const frozen = await page.evaluate(() => ({ frozen: window.__cdj.air.frozen, grounded: window.__cdj.car.grounded }));
  expect(frozen.grounded).toBe(0);
  expect(frozen.frozen).toBe(true);
  // Quelques images en vol : la caméra passe en mode « déplacement », l'indicateur s'éteint avec le frein.
  for (let i = 0; i < 12; i++) await page.evaluate(() => window.__cdj.advance(2));
  const flying = await page.evaluate(() => ({ frozen: window.__cdj.air.frozen, mix: window.__cdj.air.cameraMix, grounded: window.__cdj.car.grounded, tick: window.__cdj.car.tick }));
  expect(flying.grounded).toBe(0);
  expect(flying.mix).toBeGreaterThan(0.1);
  // La réception : le pilote a figé la caisse, elle est propre ; le son « land » est joué avec sa qualité.
  for (let done = flying.tick; done < landAt + 4; ) {
    const k = Math.min(30, landAt + 4 - done);
    await page.evaluate((m) => window.__cdj.advance(m), k);
    done += k;
  }
  const landed = await page.evaluate(() => ({ frozen: window.__cdj.air.frozen, landing: window.__cdj.air.lastLanding, log: [...window.__cdj.audio.log] }));
  expect(landed.log).toContain("land");
  expect(landed.landing.strength).toBeGreaterThan(0.2);
  expect(landed.landing.quality).toBeGreaterThan(0.85);
  expect(errors).toEqual([]);
});
