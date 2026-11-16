import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot GR4 — les captures de l'identité, des textes et de la fin de partie : un outil, jamais en CI (`testIgnore` de la configuration) ; `CAPTURES=<dossier> npx playwright test captures-lot-gr4` (après `npm run build -w @cdj/gravity`).
const DOSSIER = process.env.CAPTURES;
const JOUR = "2026-11-06";

async function accueil(browser: Parameters<typeof appareil>[0], largeur: number, hauteur: number, tactile: boolean, langue = "fr", aideVue = true) {
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=${tactile ? 1 : 0}&jour=${JOUR}`, aideVue);
  await page.setViewportSize({ width: largeur, height: hauteur });
  if (langue !== "fr") {
    await page.evaluate((l) => localStorage.setItem("cdj:langue", l), langue);
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
  }
  await page.waitForTimeout(6000); // les seuils du jour (le robot, en arrière-plan) sont prêts : le panneau les montre
  return { context, page };
}

test("capture — l'accueil au PC (1366 × 768)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const { context, page } = await accueil(browser, 1366, 768, false);
  await page.screenshot({ path: `${DOSSIER}/accueil-pc.png` });
  await context.close();
});

test("capture — l'accueil au PC en anglais", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const { context, page } = await accueil(browser, 1366, 768, false, "en");
  await page.screenshot({ path: `${DOSSIER}/accueil-pc-en.png` });
  await context.close();
});

test("capture — l'accueil en portrait au téléphone (390 × 844)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const { context, page } = await accueil(browser, 390, 844, true);
  await page.screenshot({ path: `${DOSSIER}/accueil-portrait.png`, fullPage: true });
  await context.close();
});

test("capture — Comment jouer (PC et portrait)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  for (const [nom, l, h, tactile] of [["pc", 1366, 768, false], ["portrait", 390, 844, true]] as const) {
    const { context, page } = await accueil(browser, l, h, tactile, "fr", true);
    await page.locator("#jeu-bouton-aide").click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DOSSIER}/comment-jouer-${nom}.png` });
    await context.close();
  }
});

test("capture — la mort et la fin de partie (PC et portrait)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  for (const [nom, l, h, tactile] of [["pc", 1366, 768, false], ["portrait", 390, 844, true]] as const) {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=${tactile ? 1 : 0}&jour=${JOUR}`);
    await page.setViewportSize({ width: l, height: h });
    await lancer(page);
    await page.waitForTimeout(800);
    // quelques inversions pour avoir un bilan, puis la chute dans le vide
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) {
        window.__jeu.avancer(55);
        window.__jeu.action("toucher");
      }
      window.__jeu.avancer(900);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DOSSIER}/mort-${nom}.png` });
    await page.waitForSelector("#jeu-fin-score", { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DOSSIER}/fin-${nom}.png` });
    await context.close();
  }
});
