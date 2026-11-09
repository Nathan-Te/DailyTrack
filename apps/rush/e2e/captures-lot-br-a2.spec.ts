import { test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// Les captures du lot BR-A2 (jamais en CI) : `TOUR=1 CAPTURES=1 npx playwright test captures-lot-br-a2 --project=chromium --trace off` dans apps/rush. Elles servent à la boucle de comparaison avec `docs/rush/maquettes/cible-ia.png` :
// pour chaque thème, la vitrine (1920 × 1080), un chemin, un camp, la salle d'épreuve, l'entrée de l'arène et le boss ; en haute et en basse qualité pour la vitrine. Le nom du fichier porte le tour (`br-a2-t1-vitrine-prairie.png`).
const DOSSIER = "../../docs/rush/lots";
const TOUR = process.env.TOUR ?? "1";
const BASE = `/?api=${API}&debug&manuel&tactile=0&fps`;
const THEMES = ["prairie", "carriere", "sousbois"];

/** Joue `ticks` ticks puis dessine deux fois (les particules, le vent et les ombres se posent). */
const poser = async (page: Page, ticks: number, js = ""): Promise<void> => {
  await page.evaluate(
    ({ n, js }) => {
      const r = window.__rush;
      if (js) new Function("r", js)(r);
      window.__jeu.avancer(n);
      r.dessinerMaintenant();
    },
    { n: ticks, js },
  );
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__rush.dessinerMaintenant());
};

test.describe("captures du lot BR-A2", () => {
  for (const theme of THEMES) {
    test(`vitrine ${theme}`, async ({ browser }) => {
      for (const qualite of ["haute", "basse"] as const) {
        if (qualite === "basse" && theme !== "prairie") continue;
        const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine&theme=${theme}&qualite=${qualite}`);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await lancer(page, null);
        await poser(page, 2);
        await page.screenshot({ path: `${DOSSIER}/br-a2-t${TOUR}-vitrine-${theme}${qualite === "basse" ? "-basse" : ""}.png` });
        await context.close();
      }
    });

    /** Le niveau du jour : le chevalier posé à un endroit du chemin ou d'un camp, la caméra recadrée. */
    const lieux: [string, string][] = [
      ["chemin", "r.aller(...r.pointSurLeChemin(0.3)); r.recadrer()"],
      ["camp", "r.aller(...r.centreDuCamp(0)); r.recadrer()"],
      ["entree-arene", "r.aller(...r.avantLArene(9)); r.recadrer()"],
    ];
    for (const [nom, js] of lieux) {
      test(`${nom} ${theme}`, async ({ browser }) => {
        const { context, page } = await appareil(browser, `${BASE}&scenario=jour&theme=${theme}`);
        await page.setViewportSize({ width: 1280, height: 720 });
        await lancer(page);
        await poser(page, 3, js);
        await page.screenshot({ path: `${DOSSIER}/br-a2-t${TOUR}-${nom}-${theme}.png` });
        await context.close();
      });
    }

    test(`épreuve ${theme}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=epreuve&theme=${theme}&competence=tourbillon`);
      await page.setViewportSize({ width: 1280, height: 720 });
      await lancer(page);
      await poser(page, 150);
      await page.screenshot({ path: `${DOSSIER}/br-a2-t${TOUR}-epreuve-${theme}.png` });
      await context.close();
    });

    test(`arène du boss ${theme}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=boss&theme=${theme}&competence=tourbillon`);
      await page.setViewportSize({ width: 1280, height: 720 });
      await lancer(page);
      await poser(page, 100);
      await page.screenshot({ path: `${DOSSIER}/br-a2-t${TOUR}-arene-${theme}.png` });
      await context.close();
    });
  }
});
