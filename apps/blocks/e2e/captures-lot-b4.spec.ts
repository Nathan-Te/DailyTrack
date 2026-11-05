import { dailyBlocks } from "@cdj/blocks-sim";
import { jouerDiamant } from "@cdj/blocks-sim/diamant";
import { jouerGlouton } from "@cdj/blocks-sim/glouton";
import { parseDay } from "@cdj/core";
import { test } from "@playwright/test";
import { appareil, JOUR, lancer, poserLesActions } from "./appareil";

// Outil (jamais en CI : `CAPTURES=1`) — les captures du lot B4 pour Nathan : le fantôme en jeu (portrait, paysage), sa fin, l'écran de partage. Dossier : `CAPTURES_DIR` (défaut `captures-b4`).
const DOSSIER = process.env.CAPTURES_DIR ?? "captures-b4";
const contenu = dailyBlocks(parseDay(JOUR)!);
const diamant = jouerDiamant(contenu);
const glouton = jouerGlouton(contenu);

test("captures du lot B4", async ({ browser }) => {
  for (const [nom, v] of [["portrait", { width: 390, height: 844 }], ["paysage", { width: 844, height: 390 }]] as const) {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=fantome`);
    await page.setViewportSize(v);
    await lancer(page);
    await poserLesActions(page, glouton.actions.slice(0, 9), false);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${DOSSIER}/fantome-${nom}.png` });
    await context.close();
  }
  // Le fantôme fini : le joueur (le Diamant) dépasse la partie du glouton, gardée en fantôme.
  const { context, page } = await appareil(browser, `/?api=http://127.0.0.1:8800&debug&manuel&tactile=0&apercu=cle-apercu-blocks-essai-0123456789`);
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await poserLesActions(page, glouton.actions);
  await page.locator("#jeu-rejouer").click();
  await page.locator("#jeu-hud-fantome").click();
  await poserLesActions(page, diamant.actions.slice(0, glouton.actions.length + 4), false);
  await page.evaluate(() => document.querySelector("[data-apercu]")?.remove()); // le bandeau d'aperçu n'est pas le sujet
  await page.waitForTimeout(3500); // les effets des poses jouées d'un coup retombent
  await page.screenshot({ path: `${DOSSIER}/fantome-fini.png` });
  await context.close();
  for (const [nom, loc] of [["fr", "fr-FR"], ["en", "en-US"]] as const) {
    const a = await appareil(browser, `/?debug&manuel&tactile=0&scenario=partage`, true, true, loc);
    await a.page.setViewportSize({ width: 390, height: 844 });
    await lancer(a.page);
    await a.page.evaluate(() => window.__jeu.avancer(5));
    await a.page.waitForSelector("#jeu-fin:not([hidden])");
    await a.page.screenshot({ path: `${DOSSIER}/partage-${nom}.png` });
    await a.context.close();
  }
});
