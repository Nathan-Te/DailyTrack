import { test } from "@playwright/test";
import { dailyPinball, piloter } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PB1 pour Nathan — la table de chaque thème en portrait sur un téléphone, une partie en cours avec les
// contours de `?debug`. `CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pb1` (dans `apps/pinball`).
const dossier = process.env.DOSSIER ?? "captures";
const contenu = dailyPinball(parseDay(JOUR)!);

for (const theme of ["foire", "ocean", "espace", "volcan"]) {
  test(`la table, thème ${theme}`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(5));
    await page.screenshot({ path: `${dossier}/table-${theme}.png` });
    await context.close();
  });
}

test("une partie en cours, avec les contours de ?debug", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1");
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  const evenements = piloter(contenu, 4000).evenements;
  await page.evaluate((evenements) => {
    let t = 0;
    for (const e of evenements) {
      window.__jeu.avancer(e.tick - t);
      t = e.tick;
      window.__pinball!.regler(e.c, e.enfonce);
    }
    window.__jeu.avancer(4000 - t);
  }, evenements);
  await page.screenshot({ path: `${dossier}/partie-debug.png` });
  await context.close();
});
