import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot GR3 — les six captures de la scène et du HUD : un outil, jamais en CI (`testIgnore` de la configuration) ; `CAPTURES=<dossier> npx playwright test captures-lot-gr3` (après `npm run build -w @cdj/gravity`).
// Le jour de la capture est fixé (`?jour=`) : les morceaux cités sont ceux de ce jour — un morceau par thème, choisi pour sa mécanique (Usine : tapis ; Glace : sols de glace ; Néon : blocs alternés ; Nuit : clignotants ;
// Forêt : courant d'air et piques). `?morceau=<n>` met la partie dans l'état exact où le robot arrive (score, multiplicateur, bonus) : le HUD est celui d'une vraie partie.
const DOSSIER = process.env.CAPTURES;
const JOUR = "2026-11-06";
const THEMES: [string, number, number][] = [
  ["usine", 11, 20], // le nom du thème vient d'apparaître
  ["glace", 34, 260],
  ["neon", 42, 260],
  ["nuit", 61, 260],
  ["foret", 77, 260],
];

for (const [theme, morceau, pas] of THEMES) {
  test(`capture — ${theme} (PC, 1280 × 720)`, async ({ browser }) => {
    test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&jour=${JOUR}&morceau=${morceau}`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.waitForSelector(".g-medaille:not([hidden])", { timeout: 30000 }); // les seuils du jour (le robot, en arrière-plan) sont prêts : la médaille visée s'affiche (lot GR5 : on l'attend, au lieu d'un délai)
    await page.evaluate((n) => window.__jeu.avancer(n), pas);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DOSSIER}/${theme}.png` });
    await context.close();
  });
}

test("capture — le HUD en portrait au téléphone (360 × 780)", async ({ browser }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&jour=${JOUR}&morceau=42`);
  await page.setViewportSize({ width: 360, height: 780 });
  await lancer(page);
  await page.waitForSelector(".g-medaille:not([hidden])", { timeout: 30000 });
  await page.evaluate(() => window.__jeu.avancer(260));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DOSSIER}/hud-portrait.png` });
  await context.close();
});
