import { expect, test, type Page } from "@playwright/test";
import { THEMES, THEME_NAMES, createSurfacesTrack, dailyCircuit, parseDay } from "@cdj/sim";

// Lot 8 : scénario `surfaces`, indicateur d'effets du HUD, thèmes forcés. Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(90_000);

const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };

async function racing(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
}

/** Pose la voiture au milieu du bloc d'indice `index` du circuit en cours, cap du bloc, lancée. */
async function placeOn(page: Page, index: number, extra: Record<string, number> = {}) {
  await page.evaluate(
    ([i, more]) => {
      const r = window.__cdj.race as unknown as {
        car: Record<string, number>;
        track: { blocks: { cx: number; cz: number; dir: number; y0: number }[] };
      };
      const b = r.track.blocks[i as number]!;
      const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][b.dir]!;
      const mid = [
        [16, 16],
        [16, 16],
      ][0]!;
      // Milieu de cellule (le bloc droit est centré), à la hauteur de son entrée.
      Object.assign(r.car, { x: b.cx * 32 + mid[0]!, z: b.cz * 32 + mid[1]!, y: b.y0, yaw, vx: Math.sin(yaw) * 5, vz: Math.cos(yaw) * 5, vy: 0, ...(more as Record<string, number>) });
    },
    [index, extra] as const,
  );
}

test("?scenario=surfaces : le circuit se charge, chaque revêtement et chaque effet s'affiche dans le HUD", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await racing(page, "/?debug&scenario=surfaces&timescale=1");
  await expect(page.locator("#meta")).toHaveText("Circuit des surfaces");
  const track = createSurfacesTrack();
  const firstOf = (pred: (b: (typeof track.blocks)[number]) => boolean) => track.blocks.find(pred)!.index;
  const fx = page.locator("#fx");

  for (const [surface, label] of [["dirt", "TERRE"], ["ice", "GLACE"], ["grass", "HERBE"]] as const) {
    await placeOn(page, firstOf((b) => b.surface === surface && b.kind === "straight"));
    await expect(fx).toContainText(label, { timeout: 5_000 });
  }
  await placeOn(page, firstOf((b) => b.kind === "turbo"), { vx: 0, vz: 0 });
  // Le bloc de turbo est sur la route : le centre de la plaque active l'effet.
  await expect(fx).toContainText("SUPER TURBO", { timeout: 5_000 });
  await placeOn(page, firstOf((b) => b.kind === "cut"), { turbo: 0, boost: 0 }); // le turbo d'avant ne doit pas pousser
  await expect(fx).toContainText("MOTEUR COUPÉ", { timeout: 5_000 });
  expect(await page.evaluate(() => (window.__cdj.race as unknown as { car: { cut: number } }).car.cut)).toBe(1);
  await expect(fx).toHaveAttribute("data-cut", "1");
  // Moteur coupé : plein gaz, et pourtant la voiture n'accélère pas.
  await page.keyboard.down("KeyW");
  const v0 = await page.evaluate(() => Math.hypot(window.__cdj.car.vx, window.__cdj.car.vz));
  await page.waitForTimeout(700);
  const v1 = await page.evaluate(() => Math.hypot(window.__cdj.car.vx, window.__cdj.car.vz));
  await page.keyboard.up("KeyW");
  expect(v1).toBeLessThanOrEqual(v0 + 0.5);
  expect(errors).toEqual([]);
});

test("?seed=…&theme=… : chaque thème se charge et s'annonce dans l'en-tête, comme thème forcé et non classé", async ({ page }) => {
  test.setTimeout(240_000); // cinq chargements (circuit généré et validé dans le navigateur, rendu logiciel de la CI)
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const name of THEME_NAMES) {
    await racing(page, `/?debug&seed=2026-10-07&theme=${name}`);
    await expect(page.locator("#meta")).toContainText(THEMES[name].label);
    await expect(page.locator("#meta")).toContainText("thème forcé");
    const c = dailyCircuit(parseDay("2026-10-07")!, name);
    expect(await page.evaluate(() => (window.__cdj.race as unknown as { track: { id: string } }).track.id)).toBe(c.track.id);
  }
  expect(errors).toEqual([]);
});

test("un thème forcé n'est jamais envoyé au classement, même avec une adresse d'API", async ({ page, context }) => {
  const calls: string[] = [];
  await context.route(`${API}/**`, async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({}) });
  });
  const today = new Date().toISOString().slice(0, 10);
  await racing(page, `/?debug&seed=${today}&theme=banquise&api=${encodeURIComponent(API)}`);
  await expect(page.locator("#btn-board")).toBeHidden(); // pas de classement pour un circuit d'essai
  // On se téléporte avant la ligne d'arrivée : la course finit, rien ne part.
  await page.evaluate(() => {
    const r = window.__cdj.race as unknown as { car: Record<string, number>; nextGate: number; track: { gates: { x: number; y: number; z: number; fx: number; fz: number; yaw: number }[] } };
    const g = r.track.gates[r.track.gates.length - 1]!;
    r.nextGate = r.track.gates.length - 1;
    Object.assign(r.car, { x: g.x - g.fx * 4, z: g.z - g.fz * 4, y: g.y, yaw: g.yaw, vx: g.fx * 30, vz: g.fz * 30, vy: 0 });
  });
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 15_000 });
  await page.waitForTimeout(800);
  expect(calls).toEqual([]);
  await expect(page.locator("#finish .online")).toHaveCount(0);
});

test("sans thème forcé, l'en-tête donne le thème du jour (et plus la palette)", async ({ page }) => {
  await racing(page, "/?debug&seed=2026-10-06");
  const c = dailyCircuit(parseDay("2026-10-06")!);
  await expect(page.locator("#meta")).toContainText(THEMES[c.theme].label);
  await expect(page.locator("#meta")).not.toContainText("forcé");
});
