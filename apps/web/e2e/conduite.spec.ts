import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_CAR_PARAMS } from "@cdj/sim";

// Lot 7 : scénario `pilotage`, panneau de réglage `?debug&tune`, caméras. Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(90_000);

// API simulée : on compte les envois, sans toucher au vrai serveur.
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };

async function racing(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 15_000 });
}

/** Téléporte la voiture juste avant l'arrivée, lancée : on teste ce qui suit l'arrivée, pas la conduite. */
async function finishByTeleport(page: Page) {
  await page.evaluate(() => {
    const r = window.__cdj.race as unknown as {
      car: Record<string, number>;
      nextGate: number;
      track: { gates: { x: number; y: number; z: number; fx: number; fz: number; yaw: number }[] };
    };
    const g = r.track.gates[r.track.gates.length - 1]!;
    r.nextGate = r.track.gates.length - 1;
    Object.assign(r.car, { x: g.x - g.fx * 4, z: g.z - g.fz * 4, y: g.y, yaw: g.yaw, vx: g.fx * 35, vz: g.fz * 35, vy: 0, pitch: 0, roll: 0, yawRate: 0 });
  });
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 15_000 });
}

test("?scenario=pilotage : le circuit de mise au point se charge et se joue", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await racing(page, "/?debug&scenario=pilotage");
  await expect(page.locator("#meta")).toHaveText("Circuit de pilotage");
  await expect(page.locator("#tune")).toBeHidden(); // pas de panneau sans `tune`
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => (window.__cdj.car as unknown as { vz: number }).vz > 15, undefined, { timeout: 15_000 });
  await page.keyboard.up("KeyW");
  await finishByTeleport(page);
  // Réglages par défaut : le temps compte comme record.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:best:pilotage") ?? "null"));
  expect(stored?.ms).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("?debug&tune : les curseurs changent la voiture en direct ; la course n'est ni classée ni enregistrée ; les réglages se copient", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const submits: string[] = [];
  await context.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === "/api/submit") submits.push(url.pathname);
    return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ date: "", participants: 0, top: [], me: null }) });
  });
  const today = new Date().toISOString().slice(0, 10);
  await racing(page, `/?debug&tune&api=${encodeURIComponent(API)}&seed=${today}`);
  const panel = page.locator("#tune");
  await expect(panel).toBeVisible();
  expect(await panel.locator("input[type=range]").count()).toBeGreaterThanOrEqual(15);
  await expect(page.locator("#tuned")).toBeEmpty();

  // Grip arrière à 40 : la course en cours le lit aussitôt.
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("#tune input[data-key=gripRear]")!;
    input.value = "40";
    input.dispatchEvent(new Event("input"));
  });
  expect(await page.evaluate(() => (window.__cdj.race as unknown as { params: { gripRear: number } }).params.gripRear)).toBe(40);
  await expect(page.locator("#tuned")).toContainText("non classée");
  await expect(panel.locator(".row.changed")).toHaveCount(1);

  await finishByTeleport(page);
  await expect(page.locator("#finish")).toContainText("Réglages modifiés : course non classée ni enregistrée");
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cdj:best:")));
  expect(keys).toEqual([]);
  await page.waitForTimeout(500);
  expect(submits).toEqual([]);

  await panel.getByRole("button", { name: "Copier les réglages" }).click();
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(Object.keys(copied)).toEqual(Object.keys(DEFAULT_CAR_PARAMS));
  expect(copied.gripRear).toBe(40);
  expect(copied.gripFront).toBe(DEFAULT_CAR_PARAMS.gripFront);

  // Retour aux réglages par défaut : la tentative suivante compte de nouveau.
  await panel.getByRole("button", { name: "Par défaut" }).click();
  await page.getByRole("button", { name: "Rejouer" }).click();
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 15_000 });
  await expect(page.locator("#tuned")).toBeEmpty();
});

test("C change de caméra (proche → loin), et le choix est gardé", async ({ page }) => {
  await racing(page, "/?debug&scenario=pilotage");
  await page.keyboard.press("KeyC");
  await expect(page.locator("#banner")).toHaveText("Caméra loin");
  expect(await page.evaluate(() => localStorage.getItem("cdj:camera"))).toBe("loin");
  await page.reload();
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 15_000 }); // le décompte occupe le bandeau
  await page.keyboard.press("KeyC");
  await expect(page.locator("#banner")).toHaveText("Caméra proche");
});
