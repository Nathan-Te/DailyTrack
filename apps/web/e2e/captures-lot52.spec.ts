import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, newClockedContext, test, type Page } from "./fixtures";
import { fingersOf } from "./doigts";

// Lot 52 (outil, pas un test de CI) : les captures en jeu de chaque mode de direction tactile, en français et en anglais, sur un téléphone en paysage (844 × 390, densité 2),
// plus Réglages › Commandes et la pause du gyroscope.
//   CAPTURES=1 npx playwright test captures-lot52 --project=chromium   → docs/lots/lot-52-commandes/img/<cas>-<langue>.jpg
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-52-commandes/img");
const LANGUES = [
  ["fr", "fr-FR"],
  ["en", "en-US"],
] as const;
const MODES = [
  { id: "boutons", reglage: { steerMode: "buttons" } },
  { id: "glissiere", reglage: { steerMode: "slider" } },
  { id: "volant", reglage: { steerMode: "wheel" } },
  { id: "gyroscope", reglage: { steerMode: "gyro" } },
] as const;

async function telephone(browser: Parameters<Parameters<typeof test>[2]>[0]["browser"], locale: string, reglage: object) {
  const context = await newClockedContext(browser, { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale });
  const page = await context.newPage();
  await page.addInitScript((r) => {
    if (localStorage.getItem("cdj:touch") === null) localStorage.setItem("cdj:touch", JSON.stringify({ autoThrottle: false, ...r, version: 2 }));
    const w = window as unknown as { __gyro: { beta: number; gamma: number } };
    w.__gyro = { beta: 0, gamma: -90 };
    Object.defineProperty(screen.orientation, "angle", { get: () => 90, configurable: true });
    (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission = undefined;
    setInterval(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: w.__gyro.beta, gamma: w.__gyro.gamma })), 16);
  }, reglage);
  return { context, page };
}
const centre = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};
async function enCourse(page: Page) {
  await page.goto("/?debug&home=0&touch=1&fps=0");
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 60_000 });
  await page.waitForTimeout(4000); // la voiture roule, la scène est dessinée
}

for (const [langue, locale] of LANGUES) {
  for (const mode of MODES) {
    test(`${mode.id} en jeu : ${langue}`, async ({ browser }) => {
      mkdirSync(OUT, { recursive: true });
      const { context, page } = await telephone(browser, locale, mode.reglage);
      await enCourse(page);
      const f = await fingersOf(page);
      // Un pouce sur la commande, un autre sur le gaz : l'état « en action » de chaque mode.
      const gaz = await centre(page, "#touch .pedal-gas");
      await f.down(2, gaz.x, gaz.y);
      if (mode.id === "boutons") {
        const g = await centre(page, "#touch .steer-left");
        await f.down(1, g.x, g.y);
      } else if (mode.id === "glissiere") {
        const r = await centre(page, "#touch .glissiere");
        await f.down(1, r.x - (r.w / 2 - 34) * 0.55, r.y);
      } else if (mode.id === "volant") {
        const r = await centre(page, "#touch .volant");
        const sur = (deg: number) => ({ x: r.x + 52 * Math.sin((deg * Math.PI) / 180), y: r.y - 52 * Math.cos((deg * Math.PI) / 180) });
        await f.down(1, sur(0).x, sur(0).y);
        for (const deg of [-15, -30, -45, -60]) await f.move(1, sur(deg).x, sur(deg).y);
      } else {
        await page.evaluate(() => ((window as unknown as { __gyro: { beta: number } }).__gyro.beta = 14));
      }
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(OUT, `${mode.id}-${langue}.jpg`), type: "jpeg", quality: 88 });
      await context.close();
    });
  }

  test(`réglages et pause : ${langue}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const { context, page } = await telephone(browser, locale, { steerMode: "gyro" });
    await enCourse(page);
    await page.locator("#btn-pause").tap();
    await expect(page.locator("#pause-recentrer")).toBeVisible();
    await page.screenshot({ path: join(OUT, `pause-gyroscope-${langue}.jpg`), type: "jpeg", quality: 88 });
    await page.locator("#pause-settings").tap();
    await page.locator("#tab-controls").tap();
    await expect(page.locator("#page-controls .gyro-carte--ok")).toBeVisible({ timeout: 10_000 });
    await page.locator("#settings .etiquette__corps").evaluate((e) => (e.scrollTop = 300));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `reglages-gyroscope-${langue}.jpg`), type: "jpeg", quality: 88 });
    await page.getByRole("radio", { name: langue === "fr" ? "Volant" : "Wheel" }).tap();
    await expect(page.locator("#page-controls .reglage", { hasText: langue === "fr" ? "Angle maximal" : "Maximum angle" })).toBeVisible();
    await page.locator("#settings .etiquette__corps").evaluate((e) => (e.scrollTop = 150));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `reglages-volant-${langue}.jpg`), type: "jpeg", quality: 88 });
    await context.close();
  });
}
