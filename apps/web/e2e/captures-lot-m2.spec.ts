import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { newClockedContext, test } from "./fixtures";

// Lot M2 (outil, pas un test de CI) : Réglages › Commandes de Track, onglets Clavier et Manette, ordinateur 1100 × 760, français.
//   CAPTURES=1 npx playwright test captures-lot-m2 --project=chromium   → docs/plateforme/lots/img/lot-M2-track-<onglet>.png
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(300_000);
const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");

test("Réglages › Commandes : Clavier et Manette", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await newClockedContext(browser, { viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto("/?debug&home=0&fps=0");
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 60_000 });
  await page.keyboard.press("KeyP");
  await page.locator("#pause-settings").click();
  await page.locator("#tab-controls").click();
  await page.locator('#settings-commandes [data-focus="k:accelerer:0"]').click();
  await page.keyboard.press("KeyZ"); // Accélérer sur Z (KeyW garde sa place : Z devient la première touche)
  await page.locator("#settings .etiquette__corps").evaluate((e) => (e.scrollTop = 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "lot-M2-track-clavier.png") });
  await page.locator('#settings-commandes [data-onglet="manette"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "lot-M2-track-manette.png") });
  await context.close();
});
