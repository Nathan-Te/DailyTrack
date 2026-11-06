import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Les captures du lot BR2 (jamais en CI) : `CAPTURES=1 npx playwright test captures-lot-br2 --project=chromium` dans apps/rush.
// L'écran de choix (téléphone en paysage 844 × 390 et PC 1280 × 720), le HUD avec l'XP et les gemmes en jeu, la carte des 7 jours avec la stratégie la plus rapide.
const DOSSIER = "../../docs/rush/lots";

test.describe("captures du lot BR2", () => {
  test("l'écran de choix : téléphone en paysage, puis PC", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=cartes&nv=5&theme=prairie");
    await page.setViewportSize({ width: 844, height: 390 });
    await lancer(page);
    await page.waitForSelector(".rush-option");
    await page.evaluate(() => window.__rush.dessinerMaintenant());
    await page.screenshot({ path: `${DOSSIER}/br2-choix-844.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${DOSSIER}/br2-choix-pc.png` });
    await context.close();
  });

  test("le HUD avec l'XP : un camp, des gemmes au sol, le niveau", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=jour&theme=prairie");
    await page.setViewportSize({ width: 844, height: 390 });
    await lancer(page);
    await page.evaluate(() => {
      const [x, z] = window.__rush.centreDuCamp(0);
      window.__rush.aller(x - 6, z);
      window.__rush.recadrer();
      // le coup tenu : les monstres du camp s'alertent, viennent, tombent ; leurs gemmes jaillissent
      window.__rush.forcer(0 | 64, 210);
      for (let t = 0; t < 210; t++) {
        const ch = window.__rush.choixEnAttente();
        if (ch) window.__rush.choisir(0);
        window.__jeu.avancer(1);
      }
      window.__rush.dessinerMaintenant();
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${DOSSIER}/br2-hud-xp.png` });
    // des gemmes posées hors de l'aimant (3 m), pour les voir : un anneau de six autour du chevalier, à 4,5 m
    await page.evaluate(() => {
      const p = window.__rush.partie() as unknown as { c: { x: number; y: number }; gemmes: { id: number; x: number; y: number; v: number; vers: boolean; age: number }[]; tick: number };
      for (let i = 0; i < 6; i++) p.gemmes.push({ id: 700 + i, x: p.c.x + Math.round(Math.cos(i) * 4.5 * 4096), y: p.c.y + Math.round(Math.sin(i) * 4.5 * 4096), v: 12 + i * 4, vers: false, age: p.tick - 100 });
      window.__rush.dessinerMaintenant();
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${DOSSIER}/br2-gemmes.png` });
    await context.close();
  });

  test("la carte des 7 jours, avec la stratégie la plus rapide", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=carte&jours=7");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector(".rush-carte__jour canvas", { timeout: 60_000 });
    await page.screenshot({ path: `${DOSSIER}/br2-carte-7-jours.png`, fullPage: true });
    await context.close();
  });
});
