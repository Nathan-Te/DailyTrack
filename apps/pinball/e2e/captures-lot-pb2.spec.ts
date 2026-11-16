import { test } from "@playwright/test";
import { dailyPinball, piloter } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PB2 pour Nathan — la table en three.js de chaque thème en portrait sur deux téléphones (390 × 844 et
// 360 × 640), le rendu de secours, une partie en cours, le panneau `?debug&tune`. `CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pb2` (dans `apps/pinball`, après `npm run build`).
const dossier = process.env.DOSSIER ?? "captures";
const contenu = dailyPinball(parseDay(JOUR)!);
const TELEPHONES = [[390, 844], [360, 640]] as const;

for (const theme of ["foire", "ocean", "espace", "volcan"]) {
  for (const [l, h] of TELEPHONES) {
    test(`la table en three.js, thème ${theme}, ${l} × ${h}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute`);
      await page.setViewportSize({ width: l, height: h });
      await lancer(page);
      await page.evaluate(() => window.__jeu.avancer(5));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dossier}/table-${theme}-${l}x${h}.png` });
      await context.close();
    });
  }
}

test("le rendu de secours (qualité basse), 390 × 844", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&theme=ocean&qualite=basse");
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__jeu.avancer(5));
  await page.screenshot({ path: `${dossier}/secours-ocean-390x844.png` });
  await context.close();
});

test("une partie en cours en three.js, avec les contours de ?debug", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&theme=foire&qualite=haute");
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
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dossier}/partie-debug-390x844.png` });
  await context.close();
});

test("le panneau ?debug&tune ouvert", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&tune&qualite=haute");
  await page.setViewportSize({ width: 520, height: 844 });
  await lancer(page);
  await page.locator(".pinball-tune button").first().click();
  await page.evaluate(() => window.__jeu.avancer(5));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dossier}/tune-520x844.png` });
  await context.close();
});
