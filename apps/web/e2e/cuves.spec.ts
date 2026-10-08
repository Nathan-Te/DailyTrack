import { expect, test } from "@playwright/test";
import { ReplayRecorder, createAutopilot, createCuvesTrack, createRace, encodeReplay, runPilot, stepRace } from "@cdj/sim";

// Lot 18 : cuves (cuve droite, mur latéral, virage en cuve). Rendu 3D : Chromium seulement ; la physique de paroi est la même dans tous
// les navigateurs (aucune fonction non déterministe : `purete.test.ts`), et ce test compare le navigateur à Node pas à pas.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const track = createCuvesTrack();

test("?scenario=cuves : le pilote finit au temps de Node, sur le fond comme sur la paroi, et la voiture monte vraiment", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/?debug&scenario=cuves&timescale=6&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Circuit des cuves");
  for (const wall of [false, true]) {
    const run = runPilot(track, { grip: 1, wall });
    expect(run.valid).toBe(true);
    await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
    await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
    // La normale de la surface sous la voiture, échantillonnée pendant la course : la paroi se lit dans l'état de la voiture.
    await page.evaluate(() => {
      const w = window as unknown as { __minNy: number; __timer?: number };
      w.__minNy = 1;
      w.__timer = window.setInterval(() => {
        w.__minNy = Math.min(w.__minNy, window.__cdj.car.ny);
      }, 20);
    });
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
    const end = await page.evaluate(() => {
      const w = window as unknown as { __minNy: number; __timer: number };
      window.clearInterval(w.__timer);
      const r = window.__cdj.race as unknown as { finishMs: number; respawns: number };
      return { finishMs: r.finishMs, respawns: r.respawns, minNy: w.__minNy };
    });
    expect(end.finishMs).toBe(run.finishMs);
    expect(end.respawns).toBe(0);
    // Sur le fond, le pilote ne monte pas ; sur la paroi, la voiture s'incline nettement.
    if (wall) expect(end.minNy).toBeLessThan(0.85);
  }
  expect(errors).toEqual([]);
});

test("sur la paroi, le navigateur calcule la même voiture que Node, pas à pas (position, hauteur, normale)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const run = runPilot(track, { grip: 1, wall: true });
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: 1, wall: true });
  const rec = new ReplayRecorder();
  // Jusqu'à un instant où la voiture est sur la paroi du virage en cuve large (bloc 16).
  let ticks = 0;
  while (ticks < 40 * 120) {
    const input = drive(race);
    rec.record(input);
    stepRace(race, input);
    ticks++;
    if (race.car.ny < 0.6 && ticks > 120 * 12) break;
  }
  expect(race.car.ny).toBeLessThan(0.6);
  expect(run.valid).toBe(true);
  await page.goto("/?debug&scenario=cuves&quality=2&shake=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(rec.toReplay(track.id)));
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.evaluate(() => window.__cdj.manual(true));
  const n = race.car.tick;
  for (let done = 0; done < n; ) {
    const k = Math.min(240, n - done);
    await page.evaluate((m) => window.__cdj.advance(m), k);
    done += k;
  }
  const car = await page.evaluate(() => ({ ...window.__cdj.car }));
  expect(car.tick).toBe(n);
  for (const key of ["x", "y", "z", "vx", "vy", "vz", "yaw", "nx", "ny", "nz"] as const) expect(Math.abs(car[key] - race.car[key]), key).toBeLessThan(1e-9);
  // Les effets lisent la paroi : sur le mur, ils marquent et lancent des étincelles.
  await page.evaluate(() => window.__cdj.advance(0));
  const fx = await page.evaluate(() => ({ tilt: window.__cdj.fx.tel.tilt, onWall: window.__cdj.fx.tel.onWall, sparks: window.__cdj.fx.emitted.spark }));
  expect(fx.tilt).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
