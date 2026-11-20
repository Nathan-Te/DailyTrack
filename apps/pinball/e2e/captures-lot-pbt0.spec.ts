import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PBT0 (des tables dessinées d'un seul tenant), en 390 × 844.
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbt0 -g plans     (dans `apps/pinball`, après `npm run build`) → chaque plan d'essai t1 à t6 en Fête foraine et en Volcan, haute qualité
//   … -g miroir   → les mêmes plans retournés (`?miroir`), Fête foraine
//   … -g tirs     → les plans avec l'éventail des tirs de `?debug&tirs` (la zone de tir et les fenêtres de chaque objectif)
//   … -g tous     → chaque plan dans les quatre thèmes (la lisibilité de l'Océan et de l'Espace)
const dossier = process.env.DOSSIER ?? "captures";
const PLANS = ["t1", "t2", "t3", "t4", "t5", "t6"] as const;

async function prendre(browser: Parameters<typeof appareil>[0], adresse: string, fichier: string, attente = 500): Promise<void> {
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&${adresse}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__pinball!.contours(false));
  await page.evaluate(() => window.__jeu.avancer(30));
  await page.waitForTimeout(attente);
  await page.screenshot({ path: `${dossier}/${fichier}.png` });
  await context.close();
}

for (const plan of PLANS) {
  test(`plans ${plan}`, async ({ browser }) => {
    for (const theme of ["foire", "volcan"] as const) await prendre(browser, `plan=${plan}&theme=${theme}&qualite=haute`, `plan-${plan}-${theme}`);
  });
  test(`miroir ${plan}`, async ({ browser }) => {
    await prendre(browser, `plan=${plan}&miroir&theme=foire&qualite=haute`, `miroir-${plan}-foire`);
  });
  test(`tous ${plan}`, async ({ browser }) => {
    for (const theme of ["ocean", "espace"] as const) await prendre(browser, `plan=${plan}&theme=${theme}&qualite=haute`, `plan-${plan}-${theme}`);
  });
  test(`tirs ${plan}`, async ({ browser }) => {
    await prendre(browser, `debug&tirs&plan=${plan}&theme=foire&qualite=haute`, `tirs-${plan}-foire`, 2500);
  });
}
