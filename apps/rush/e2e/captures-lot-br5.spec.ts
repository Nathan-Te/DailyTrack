import { test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// Les captures du lot BR5 (jamais en CI) : `CAPTURES=1 npx playwright test captures-lot-br5 --project=chromium --trace off` dans apps/rush.
// L'écran du choix de la compétence (844 × 390 et PC), chaque compétence en action, un groupe de vases avant puis pendant l'éclatement, la horde, le coup d'élan.
const DOSSIER = "../../docs/rush/lots";
const BASE = `/?api=${API}&debug&manuel&tactile=0`;
const dessiner = (page: Page): Promise<void> => page.evaluate(() => window.__rush.dessinerMaintenant());

test.describe("captures du lot BR5", () => {
  for (const [nom, w, h] of [["844", 844, 390], ["pc", 1280, 720]] as const) {
    test(`l'écran du choix de la compétence (${nom})`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=jour&jour=2026-11-06`);
      await page.setViewportSize({ width: w, height: h });
      await lancer(page, null);
      await page.waitForSelector(".rush-option");
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DOSSIER}/br5-choix-competence-${nom}.png` });
      await context.close();
    });
  }

  test("le tourbillon dans la horde", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=horde&competence=tourbillon`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(75)); // la horde arrive
    await page.evaluate(() => {
      window.__jeu.action("competence");
      window.__jeu.avancer(22);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-tourbillon.png` });
    await context.close();
  });

  test("le bond écrasant : le cercle d'atterrissage cyan, puis l'onde de choc", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=mannequin&competence=bond`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => {
      window.__rush.forcer(25, 1); // vers le haut
      window.__jeu.action("competence");
      window.__jeu.avancer(12);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-bond.png` });
    await page.evaluate(() => {
      window.__jeu.avancer(20);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-bond-atterrissage.png` });
    await context.close();
  });

  test("le lancer de bouclier contre le grand-duc", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=mannequin&competence=bouclier`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => {
      window.__jeu.action("competence");
      window.__jeu.avancer(16);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-bouclier.png` });
    await context.close();
  });

  test("un groupe de vases, avant puis pendant l'éclatement", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=horde`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => {
      const p = window.__rush.partie() as unknown as { monstres: unknown[]; vases: { x: number; y: number; groupe: number }[]; c: { x: number; y: number } };
      p.monstres.length = 0;
      const g = p.vases.filter((q) => q.groupe === 3);
      const v = g[0]!;
      p.c.x = v.x;
      p.c.y = v.y + 4096 * 1.3;
      window.__rush.cameraLibre([v.x / 4096, 9, v.y / 4096 + 6.5], [v.x / 4096, 0, v.y / 4096 - 0.3]);
      window.__rush.dessinerMaintenant();
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${DOSSIER}/br5-vases-avant.png` });
    await page.evaluate(() => {
      window.__rush.forcer(64 | 25, 30);
      window.__jeu.avancer(11);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-vases-eclats.png` });
    await context.close();
  });

  test("la horde", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=horde&fps`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => {
      window.__jeu.avancer(110);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-horde.png` });
    await context.close();
  });

  test("le coup d'élan : la fente en pleine course", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=jour&jour=2026-11-06&competence=tourbillon`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => {
      window.__rush.forcer(window.__rush.versLArene(), 70);
      window.__jeu.avancer(70);
      window.__rush.forcer(window.__rush.versLArene() | 64, 12);
      window.__jeu.avancer(5);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br5-elan.png` });
    await context.close();
  });
});
