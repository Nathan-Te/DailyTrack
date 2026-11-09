import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Le monde de Rush (lot BR-A2) : îles flottantes, sols, murs bas, ambiance de chaque thème. Ces essais gardent ce que le lot promet : **moins de 200 appels de dessin partout** (le jour, un camp, la salle d'épreuve en pleine vague, l'arène de chacun des cinq boss),
// **dans les deux qualités**, la basse sans ombres portées ni post-traitement, tous les thèmes et tous les scénarios sans erreur.
const THEMES = ["prairie", "carriere", "sousbois"];
const BOSS = ["golem", "reine", "grand-duc", "belier", "chene"];
const BASE = "/?debug&manuel&tactile=0";

/** Dessine (deux images : les particules et le vent se posent) et rend les appels et les triangles. */
const mesure = async (page: Page): Promise<{ appels: number; triangles: number }> => {
  await page.evaluate(() => {
    window.__rush.dessinerMaintenant();
    window.__rush.dessinerMaintenant();
  });
  return page.evaluate(() => ({ appels: window.__rush.calls(), triangles: window.__rush.triangles() }));
};
/** Les deux qualités, l'une après l'autre sur la même page : sous 200 appels, et la basse éteint les ombres et le post-traitement. */
const lesDeuxQualites = async (page: Page, quoi: string): Promise<void> => {
  await page.evaluate(() => window.__rush.definirQualite("haute"));
  const haute = await mesure(page);
  expect(await page.evaluate(() => window.__rush.rendu()), `${quoi} : haute`).toMatchObject({ ombres: true, postTraitement: true });
  expect(haute.appels, `${quoi} : appels en haute`).toBeLessThan(200);
  expect(haute.appels, `${quoi} : appels en haute`).toBeGreaterThan(10);
  await page.evaluate(() => window.__rush.definirQualite("basse"));
  const basse = await mesure(page);
  expect(await page.evaluate(() => window.__rush.rendu()), `${quoi} : basse`).toMatchObject({ ombres: false, postTraitement: false });
  expect(basse.appels, `${quoi} : appels en basse`).toBeLessThan(200);
  expect(basse.triangles, `${quoi} : triangles en basse`).toBeLessThan(600_000);
};
const sansErreur = (page: Page): string[] => {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) erreurs.push(m.text());
  });
  return erreurs;
};

test.describe("le monde de Rush (lot BR-A2)", () => {
  for (const theme of THEMES) {
    test(`${theme} : le jour (chemin, camp) et la salle d'épreuve en pleine vague dessinent sous 200 appels, en haute et en basse qualité`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=jour&theme=${theme}`);
      const erreurs = sansErreur(page);
      await lancer(page);
      await page.evaluate(() => window.__rush.aller(...(window.__rush.pointSurLeChemin(0.3) as [number, number])));
      await page.evaluate(() => window.__jeu.avancer(3));
      await lesDeuxQualites(page, `${theme} : chemin`);
      await page.evaluate(() => window.__rush.aller(...(window.__rush.centreDuCamp(0) as [number, number])));
      await page.evaluate(() => window.__jeu.avancer(3));
      await lesDeuxQualites(page, `${theme} : camp`);
      await context.close();
      const e = await appareil(browser, `${BASE}&scenario=epreuve&theme=${theme}&qualite=haute`);
      const erreursE = sansErreur(e.page);
      await lancer(e.page);
      await e.page.evaluate(() => window.__jeu.avancer(900)); // la première vague, puis la deuxième : le sol, les portes, le cercle allumé et la horde
      await lesDeuxQualites(e.page, `${theme} : salle d'épreuve`);
      await e.context.close();
      expect(erreurs, "le jour").toEqual([]);
      expect(erreursE, "l'épreuve").toEqual([]);
    });
  }

  test("l'arène de chacun des cinq boss (un thème chacun) dessine sous 200 appels en haute et en basse, sans erreur", async ({ browser }) => {
    for (const [k, boss] of BOSS.entries()) {
      const { context, page } = await appareil(browser, `${BASE}&scenario=boss&boss=${boss}&theme=${THEMES[k % 3]}&competence=tourbillon`);
      const erreurs = sansErreur(page);
      await lancer(page);
      await page.evaluate(() => window.__jeu.avancer(200));
      await lesDeuxQualites(page, `arène ${boss}`);
      expect(erreurs, boss).toEqual([]);
      await context.close();
    }
  });

  test("la vitrine de chaque thème et les scénarios du monde s'ouvrent sans erreur ; la basse garde les particules (la moitié) et perd rais et brume", async ({ browser }) => {
    for (const theme of THEMES) {
      const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine&theme=${theme}`);
      const erreurs = sansErreur(page);
      await lancer(page, null);
      await page.evaluate(() => window.__rush.definirQualite("haute"));
      await mesure(page);
      const haute = (await page.evaluate(() => window.__rush.rendu())).rais;
      expect(haute, `${theme} : particules, et rais ou brume selon le thème`).toBeGreaterThanOrEqual(1);
      await page.evaluate(() => window.__rush.definirQualite("basse"));
      await mesure(page);
      expect((await page.evaluate(() => window.__rush.rendu())).rais, `${theme} : la basse ne garde que les particules`).toBe(1);
      expect(erreurs, theme).toEqual([]);
      await context.close();
    }
  });
});
