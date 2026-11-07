import { test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { BOSS_IDS, Partie, contenuScenario } from "@cdj/rush-sim";
import { JOUR, appareil, lancer } from "./appareil";

// Les captures du lot BR3 (jamais en CI) : `CAPTURES=1 npx playwright test captures-lot-br3 --project=chromium --trace off` dans apps/rush.
// Le bestiaire sur les trois thèmes (1280 × 720), puis chaque boss en train d'annoncer une attaque (844 × 390 : un téléphone en paysage).
const DOSSIER = "../../docs/rush/lots";

/** Avance jusqu'à la première annonce du boss, puis de `apres` ticks, et dessine (les ticks se comptent en Node : `avancer(n)` dessine une image par appel). */
async function annoncer(page: Page, id: string, apres: number): Promise<void> {
  const p = new Partie(contenuScenario("boss", { jour: parseDay(JOUR)!, boss: BOSS_IDS.indexOf(id as (typeof BOSS_IDS)[number]) }));
  let n = 0;
  while (p.golem!.etat !== 1 && n < 1000) {
    p.avancer(0);
    n++;
  }
  await page.evaluate((t) => {
    window.__jeu.avancer(t);
    window.__rush.dessinerMaintenant();
  }, n + apres);
  await page.waitForTimeout(150);
}

test.describe("captures du lot BR3", () => {
  for (const theme of ["prairie", "carriere", "sousbois"]) {
    test(`le bestiaire sur ${theme}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=bestiaire&theme=${theme}`);
      await page.setViewportSize({ width: 1280, height: 720 });
      await lancer(page);
      await page.evaluate(() => window.__rush.dessinerMaintenant());
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${DOSSIER}/br3-bestiaire-${theme}.png` });
      await context.close();
    });
  }

  // [identifiant, ticks après le début de l'annonce, thème]
  const annonces: [string, number, string][] = [
    ["golem", 45, "prairie"],
    ["reine", 58, "prairie"],
    ["grand-duc", 90, "carriere"],
    ["belier", 45, "carriere"],
    ["chene", 55, "sousbois"],
  ];
  for (const [id, ticks, theme] of annonces) {
    test(`${id} annonce une attaque`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=boss&boss=${id}&theme=${theme}`);
      await page.setViewportSize({ width: 844, height: 390 });
      await lancer(page);
      await annoncer(page, id, ticks);
      await page.screenshot({ path: `${DOSSIER}/br3-annonce-${id}.png` });
      await context.close();
    });
  }
});
