import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { encodeReplay, runPilot, salonCircuit } from "@cdj/sim";

// Captures du README du lot 31 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot31` (`OUT=…` change le dossier).
// La finale du Salon (grand compte à rebours, départs fermés, classement d'office), le podium par-dessus le circuit suivant, l'accueil.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/img");
mkdirSync(OUT, { recursive: true });

const LEN = 2 * 60_000;
const SESSION = Math.floor(1791549980000 / LEN);
const START = SESSION * LEN;
const END = START + LEN;
const circuit = salonCircuit(SESSION);
const code = encodeReplay(runPilot(circuit.track, { grip: 0.9 }).replay);

test("la finale du Salon, puis le podium sur le circuit suivant", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => localStorage.setItem("cdj:name", "Nathan"));
  await page.goto(`/?mode=salon&api=demo&debug&salonMinutes=2&salonAt=${START + 30_000}`);
  await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
  await page.waitForFunction(() => (window.__cdj.salon!.board?.rows.length ?? 0) >= 5, undefined, { timeout: 180_000, polling: 500 });
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "racing" && window.__cdj.car.tick > 240, undefined, { timeout: 60_000 });
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 9_400);
  await page.waitForFunction(() => window.__cdj.salon!.finaleOn, undefined, { timeout: 15_000 });
  await expect(page.locator("#finale")).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "lot-31-finale.png") });
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 100);
  await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "lot-31-podium.png") });
});

test("l'accueil : prochain circuit dans HH:MM:SS", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForSelector("#splash", { state: "detached", timeout: 120_000 });
  await expect(page.locator("#home-nextday")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, "lot-31-accueil.png") });
});
