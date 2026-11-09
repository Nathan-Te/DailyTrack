import { test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// Les captures du lot BR-A1 (les modèles ; jamais en CI) : `CAPTURES=1 TOUR=1 npx playwright test captures-lot-br-a1 --project=chromium --trace off` dans apps/rush (après `npm run build -w @cdj/rush`).
// `TOUR` (1, 2, 3…) numérote les tours de corrections (les captures d'un tour ne remplacent pas celles du précédent) ; `&modeles=0` donne l'« avant » (les formes procédurales d'avant le lot). En 1920 × 1080, comme la cible.
const DOSSIER = "../../docs/rush/lots";
const BASE = `/?api=${API}&debug&manuel&tactile=0`;
const TOUR = process.env.TOUR ?? "1";

const dessiner = (page: Page, ticks: number): Promise<void> =>
  page.evaluate((n) => {
    window.__jeu.avancer(n);
    window.__rush.dessinerMaintenant();
  }, ticks);

async function capturer(page: Page, chemin: string): Promise<void> {
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__rush.dessinerMaintenant());
  await page.screenshot({ path: chemin });
}

test.describe("captures du lot BR-A1", () => {
  for (const [avant, suffixe] of [[false, ""], [true, "-avant"]] as const) {
    for (const theme of avant ? ["prairie"] : ["prairie", "carriere", "sousbois"]) {
      test(`le bestiaire des boss (${theme}${suffixe})`, async ({ browser }) => {
        const { context, page } = await appareil(browser, `${BASE}&scenario=bestiaire&theme=${theme}${avant ? "&modeles=0" : ""}`);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await lancer(page, null);
        await dessiner(page, 2);
        await capturer(page, `${DOSSIER}/bra1-t${TOUR}-bestiaire-${theme}${suffixe}.png`);
        await context.close();
      });
      test(`le bestiaire des monstres (${theme}${suffixe})`, async ({ browser }) => {
        const { context, page } = await appareil(browser, `${BASE}&scenario=bestiaire-monstres&theme=${theme}${avant ? "&modeles=0" : ""}`);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await lancer(page, null);
        await dessiner(page, 2);
        await capturer(page, `${DOSSIER}/bra1-t${TOUR}-monstres-${theme}${suffixe}.png`);
        await context.close();
      });
    }
    test(`la vitrine${suffixe}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine${avant ? "&modeles=0" : ""}`);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await lancer(page, null);
      await dessiner(page, 2);
      await capturer(page, `${DOSSIER}/bra1-t${TOUR}-vitrine${suffixe}.png`);
      await context.close();
    });
  }

  test("la horde au tourbillon : des dizaines de gélatons et des vases qui éclatent", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=horde&competence=tourbillon`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await lancer(page);
    await page.evaluate(() => {
      // la horde arrive ; le chevalier est posé contre un groupe de vases et tourbillonne : les vases éclatent (leurs éclats modélisés en vol), les gélatons sont fauchés
      window.__jeu.avancer(75);
      const p = window.__rush.partie() as unknown as { vases: { x: number; y: number; id: number }[] };
      const v = p.vases.find((x) => x.id >= 0);
      if (v) window.__rush.aller(v.x / 4096 + 0.7, v.y / 4096 + 0.7);
      window.__jeu.action("competence");
      window.__jeu.avancer(16);
      window.__rush.dessinerMaintenant();
    });
    await capturer(page, `${DOSSIER}/bra1-t${TOUR}-horde.png`);
    await context.close();
  });

  for (const boss of ["golem", "reine", "grand-duc", "belier", "chene"]) {
    test(`le combat : ${boss}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=boss&boss=${boss}&competence=tourbillon`);
      await page.setViewportSize({ width: 1280, height: 720 });
      await lancer(page);
      await page.evaluate(() => {
        window.__rush.jouerPilote(330, 0, "foncer");
        window.__rush.dessinerMaintenant();
      });
      await capturer(page, `${DOSSIER}/bra1-t${TOUR}-combat-${boss}.png`);
      await context.close();
    });
  }
});
