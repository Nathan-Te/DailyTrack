import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Les captures du lot BR4 (jamais en CI) : `CAPTURES=1 npx playwright test captures-lot-br4 --project=chromium --trace off` dans apps/rush.
// Le tableau des médailles sur 7 jours, l'écran de fin (844 × 390 : un téléphone en paysage, et au PC en 1280 × 720), le fantôme du Diamant en jeu.
const DOSSIER = "../../docs/rush/lots";

test.describe("captures du lot BR4", () => {
  test("le tableau des médailles sur 7 jours", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=medailles&jours=7");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector(".rush-medailles__table tbody tr:nth-child(7)", { timeout: 120_000 });
    await page.screenshot({ path: `${DOSSIER}/br4-medailles-7-jours.png` });
    await context.close();
  });

  for (const [nom, w, h] of [["844", 844, 390], ["pc", 1280, 720]] as const) {
    test(`l'écran de fin à 1:05 (${nom})`, async ({ browser }) => {
      const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=fin&temps=65000");
      await page.setViewportSize({ width: w, height: h });
      await page.locator("#jeu-jouer").click();
      await page.waitForSelector("#jeu-fin .rush-fin", { timeout: 60_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DOSSIER}/br4-fin-${nom}.png` });
      await context.close();
    });
  }

  test("le fantôme du Diamant en jeu", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=jour&fantome=1&jour=2026-11-06");
    await page.setViewportSize({ width: 844, height: 390 });
    await lancer(page);
    // le joueur reste au départ ; le fantôme a pris de l'avance : on laisse passer quelques secondes pour qu'ils soient séparés
    await page.evaluate(() => {
      window.__jeu.avancer(150);
      window.__rush.dessinerMaintenant();
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${DOSSIER}/br4-fantome.png` });
    await context.close();
  });
});
