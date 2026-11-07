import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot B8 — les captures du plateau des trois pièces pour la PR : `CAPTURES=<dossier> npx playwright test captures-b8` (un outil, jamais en CI : `testIgnore` de la configuration). Portrait, paysage et bureau, au départ de `?scenario=ordre`
// (trois pièces, aucune ne grisée) ; puis le mauvais ordre (le coin d'abord : les deux autres pièces grisées) ; puis une partie du jour en cours (les poses du bot Diamant).
const DOSSIER = process.env.CAPTURES;
const ECRANS: [string, number, number][] = [["portrait", 390, 844], ["paysage", 844, 390], ["pc", 1920, 1080]];

for (const [nom, largeur, hauteur] of ECRANS) {
  test(`captures du plateau — ${nom} ${largeur} × ${hauteur}`, async ({ browser }) => {
    test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&scenario=ordre&theme=port", true, false);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await page.waitForTimeout(900); // l'entrée des pièces est finie
    await page.screenshot({ path: `${DOSSIER}/b8-${nom}-depart.png` });
    await page.evaluate(() => window.__jeu.action("pose:0:0:6")); // le mauvais ordre : le coin d'abord
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOSSIER}/b8-${nom}-grisees.png` });
    await context.close();
  });
}

test("captures — une partie du jour en cours (le bot Diamant, 60 poses)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&bot=30&theme=chantier", true, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForSelector("#jeu-jouer", { state: "attached" });
  await lancer(page);
  await page.evaluate(() => window.__jeu.avancer(61)); // 60 poses à 30 par seconde (1 tick = 1 pose par tick)
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DOSSIER}/b8-portrait-en-cours.png` });
  await context.close();
});
