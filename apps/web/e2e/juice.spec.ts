import { expect, test, type Page } from "@playwright/test";
import { dailyCircuit, encodeReplay, medalFor, runPilot, createSurfacesTrack } from "@cdj/sim";

// Lot 9 : effets visuels, sons, démo. Tout se lit dans `__cdj.fx` / `__cdj.audio` (présentation seule : ces tests ne
// vérifient jamais un résultat de simulation, les rediffusions et les références golden s'en chargent).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

async function racing(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 30_000 });
}

/** Pose la voiture (champs de `CarState`) et avance de `ticks` pas, en pas à pas (indépendant de la vitesse de la machine). */
async function drive(page: Page, car: Record<string, number>, ticks: number) {
  await page.evaluate((c) => Object.assign((window.__cdj.race as { car: object }).car, c), car);
  await page.evaluate((n) => window.__cdj.advance(n), ticks);
}

test.describe("pas à pas sur le circuit de pilotage", () => {
  test.beforeEach(async ({ page }) => {
    await racing(page, "/?debug&scenario=pilotage&quality=2");
    await page.evaluate(() => window.__cdj.manual(true));
  });

  test("dérapage : fumée et traces au sol", async ({ page }) => {
    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyS");
    await drive(page, { vx: 9, vz: 30 }, 10);
    for (let i = 0; i < 8; i++) await page.evaluate(() => window.__cdj.advance(8)); // des images courtes : les effets lisent l'état de chaque image
    const e = await page.evaluate(() => window.__cdj.fx.emitted);
    expect(e.smoke).toBeGreaterThan(0);
    expect(e.skid).toBeGreaterThan(0);
    // les traces sont réellement posées au sol (segments de ruban), pas seulement comptées
    expect(await page.evaluate(() => window.__cdj.fx.marks)).toBeGreaterThan(3);
  });

  test("rebord : étincelles et son de choc ; réception : poussière, secousse et son", async ({ page }) => {
    await page.keyboard.down("KeyW");
    await drive(page, { vx: 25, vz: 20 }, 10);
    for (let i = 0; i < 30; i++) await page.evaluate(() => window.__cdj.advance(10));
    expect(await page.evaluate(() => window.__cdj.fx.emitted.spark)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__cdj.audio.log)).toContain("impact");
    await drive(page, { y: 4, vy: 0, grounded: 0, vx: 0, vz: 20 }, 6);
    // en l'air, les roues pendent (débattement maximal) ; la suspension suit ensuite le sol
    const air = await page.evaluate(() => window.__cdj.fx.wheelDroop);
    expect(Math.min(...air)).toBeGreaterThan(1);
    await page.evaluate(() => window.__cdj.advance(120));
    const fx = await page.evaluate(() => window.__cdj.fx);
    expect(fx.emitted.land).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__cdj.audio.log)).toContain("land");
    for (const d of fx.wheelDroop) expect(Math.abs(d)).toBeLessThan(0.2);
  });

  test("effets coupés avec ?fx=off : aucune particule", async ({ page }) => {
    await racing(page, "/?debug&scenario=pilotage&fx=off");
    await page.evaluate(() => window.__cdj.manual(true));
    await page.keyboard.down("KeyW");
    await drive(page, { vx: 25, vz: 20 }, 100);
    const fx = await page.evaluate(() => window.__cdj.fx);
    expect(fx.enabled).toBe(false);
    expect(fx.particles).toBe(0);
  });
});

test("turbo : flammes et son ; super turbo ouvre le champ de vision", async ({ page }) => {
  await racing(page, "/?debug&scenario=surfaces&quality=2");
  await page.evaluate(() => window.__cdj.manual(true));
  const track = createSurfacesTrack();
  const turbo = track.blocks.find((b) => b.kind === "turbo")!;
  await page.evaluate(
    ([cx, cz, dir, y0]) => {
      const c = (window.__cdj.race as { car: Record<string, number> }).car;
      const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir as number]!;
      Object.assign(c, { x: (cx as number) * 32 + 16, z: (cz as number) * 32 + 16, y: y0, yaw, vx: 0, vz: 0 });
    },
    [turbo.cx, turbo.cz, turbo.dir, turbo.y0],
  );
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__cdj.advance(120));
  const fx = await page.evaluate(() => window.__cdj.fx);
  expect(fx.emitted.flame).toBeGreaterThan(0);
  expect(fx.fovKick).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__cdj.audio.log)).toContain("turbo");
});

test("décompte, départ et point de contrôle sonnent ; M coupe le son et le réglage survit au rechargement", async ({ page }) => {
  await racing(page, "/?debug&scenario=pilotage");
  const log = await page.evaluate(() => window.__cdj.audio.log);
  expect(log.filter((s) => s === "countdown").length).toBeGreaterThanOrEqual(2);
  expect(log).toContain("go");
  await page.keyboard.press("KeyM");
  expect(await page.evaluate(() => window.__cdj.audio.settings.volume)).toBe(0);
  await expect(page.locator("#btn-sound")).toContainText("🔇");
  await page.reload();
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.audio.settings.volume)).toBe(0);
  await page.keyboard.press("KeyM");
  expect(await page.evaluate(() => window.__cdj.audio.settings.volume)).toBeGreaterThan(0);
  // le bouton fait le tour des crans
  const before = await page.evaluate(() => window.__cdj.audio.settings.volume);
  await page.locator("#btn-sound").click();
  expect(await page.evaluate(() => window.__cdj.audio.settings.volume)).not.toBe(before);
});

test("le contexte audio démarre au premier geste, pas avant", async ({ page }) => {
  await page.goto("/?debug&scenario=pilotage");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.audio.running)).toBe(false);
  await page.keyboard.press("KeyW");
  await page.waitForFunction(() => window.__cdj.audio.running, undefined, { timeout: 5_000 });
});

test.describe("circuit du jour joué par le pilote", () => {
  const day = Math.floor(Date.now() / 86_400_000);
  const circuit = dailyCircuit(day);
  const run = runPilot(circuit.track, { grip: 0.9 });
  const code = encodeReplay(run.replay);

  test("arrivée : confettis, fanfare, médaille ; points de contrôle : éclair et bip", async ({ page }) => {
    await page.goto("/?debug&timescale=6");
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
    const fx = await page.evaluate(() => window.__cdj.fx);
    expect(fx.emitted.confetti).toBeGreaterThan(0);
    expect(fx.emitted.flash).toBeGreaterThan(0);
    const log = await page.evaluate(() => window.__cdj.audio.log);
    expect(log).toContain("finish");
    expect(log).toContain("checkpoint");
    if (medalFor(run.finishMs, circuit.medals)) expect(log).toContain("medal");
  });
});

test("?demo : le pilote roule seul, tous les effets s'animent, rien n'est enregistré", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await racing(page, "/?debug&scenario=surfaces&demo");
  await page.waitForFunction(() => window.__cdj.car.z !== 0 || window.__cdj.car.x !== 0, undefined, { timeout: 10_000 });
  await page.waitForFunction(() => window.__cdj.race && (window.__cdj.race as { splits: number[] }).splits.length >= 1, undefined, { timeout: 60_000 });
  const fx = await page.evaluate(() => window.__cdj.fx);
  expect(fx.emitted.surface + fx.emitted.smoke + fx.emitted.flash).toBeGreaterThan(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cdj:best")))).toEqual([]);
  expect(errors).toEqual([]);
});

test("la qualité peut être figée (?quality=) et la secousse coupée (?shake=0)", async ({ page }) => {
  await racing(page, "/?debug&scenario=pilotage&quality=1&shake=0");
  expect(await page.evaluate(() => window.__cdj.fx.quality)).toBe(1);
});
