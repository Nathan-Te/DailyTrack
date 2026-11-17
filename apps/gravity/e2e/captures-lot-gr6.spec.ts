import { test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot GR6 — les captures des modes de vol : un outil, jamais en CI (`testIgnore` de la configuration) ; `CAPTURES=<dossier> npx playwright test captures-lot-gr6` (après `npm run build -w @cdj/gravity`).
// Une par mode (avion, onde, ressort) en paysage 1280 × 720 à 2×, `?mode=<mode>&robot` : on regarde le robot jouer la section ; et l'annonce du mode en portrait au téléphone (390 × 844, `?mode=avion`).
const DOSSIER = process.env.CAPTURES;

/** Avance pas à pas jusqu'à l'annonce du mode (le portail vient d'être franchi), puis encore `apres` pas : le héros est dans le mode, l'arche juste derrière lui. */
async function jusquAuPortail(page: Page, apres: number): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await page.evaluate(() => window.__jeu.avancer(6));
    if (await page.locator(".g-mode--vu").count()) break;
  }
  await page.evaluate((n) => window.__jeu.avancer(n), apres);
  await page.waitForTimeout(900); // quelques images : le mode s'installe doucement (rendu au temps du mur), la scène se dessine
}

for (const [mode, apres] of [["avion", 30], ["onde", 36], ["ressort", 26]] as const) {
  test(`capture — le mode ${mode} en paysage (1280 × 720)`, async ({ browser }) => {
    test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&mode=${mode}&robot`, true, { deviceScaleFactor: 2 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await jusquAuPortail(page, apres);
    await page.screenshot({ path: `${DOSSIER}/mode-${mode}.png` });
    await context.close();
  });
}

test("capture — l'annonce du mode en portrait au téléphone (390 × 844)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&mode=avion&robot", true, { deviceScaleFactor: 2, hasTouch: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await jusquAuPortail(page, 40);
  await page.screenshot({ path: `${DOSSIER}/annonce-portrait.png` });
  await context.close();
});
