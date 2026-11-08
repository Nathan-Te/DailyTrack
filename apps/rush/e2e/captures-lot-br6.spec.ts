import { test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// Les captures du lot BR6 (jamais en CI) : `CAPTURES=1 npx playwright test captures-lot-br6 --project=chromium --trace off` dans apps/rush.
// Le bestiaire des monstres (trois thèmes), chaque nouvel ennemi pendant son annonce, un élite, la salle d'épreuve en pleine vague, la carte des 7 jours.
const DOSSIER = "../../docs/rush/lots";
const BASE = `/?api=${API}&debug&manuel&tactile=0`;

/** Joue `ticks` ticks puis dessine. */
const jouer = (page: Page, ticks: number): Promise<void> =>
  page.evaluate((n) => {
    window.__jeu.avancer(n);
    window.__rush.dessinerMaintenant();
  }, ticks);

test.describe("captures du lot BR6", () => {
  for (const theme of ["prairie", "carriere", "sousbois"]) {
    test(`le bestiaire des monstres (${theme})`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=bestiaire-monstres&theme=${theme}`);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await lancer(page, null);
      await jouer(page, 2);
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__rush.dessinerMaintenant());
      await page.screenshot({ path: `${DOSSIER}/br6-bestiaire-monstres-${theme}.png` });
      await context.close();
    });
  }

  /** Le camp d'essai : on joue jusqu'à ce que `condition` soit vraie (au plus 600 ticks), puis on recadre sur le chevalier. */
  const camp = async (page: Page, condition: string, apres = 0): Promise<void> => {
    await page.evaluate(
      ([cond, apres]) => {
        const p = window.__rush.partie() as unknown as { monstres: { type: number; etat: number; t: number; prot: number; vuln: number; elite: number }[] };
        const ok = new Function("p", `return ${cond}`) as (p: unknown) => boolean;
        for (let i = 0; i < 600 && !ok(p); i++) window.__jeu.avancer(1);
        window.__jeu.avancer(apres as number);
        window.__rush.dessinerMaintenant();
      },
      [condition, apres] as const,
    );
  };
  const cas: [string, string, string, number][] = [
    ["cracheur", "ennemis=cracheur", "p.monstres.some((m) => m.type === 3 && m.etat === 1 && m.t > 30)", 0],
    ["chaman", "ennemis=chaman,gelee,gelaton", "p.monstres.filter((m) => m.prot > 0).length >= 3", 4],
    ["totem", "ennemis=totem,gelee", "p.monstres.some((m) => m.type === 5 && m.etat === 1 && m.t > 330)", 0],
    ["porte-bouclier", "ennemis=porte-bouclier", "p.monstres.some((m) => m.type === 6 && m.etat === 1 && m.t > 20)", 0],
    ["elite", "ennemis=gelee,gelaton,cracheur&elite=1", "p.monstres.length > 0", 40],
  ];
  for (const [nom, adresse, condition, apres] of cas) {
    test(`l'annonce : ${nom}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `${BASE}&scenario=camp&${adresse}&competence=tourbillon`);
      await page.setViewportSize({ width: 1280, height: 720 });
      await lancer(page);
      await camp(page, condition, apres);
      await page.screenshot({ path: `${DOSSIER}/br6-${nom === "elite" ? "elite" : `annonce-${nom}`}.png` });
      await context.close();
    });
  }

  test("la salle d'épreuve en pleine vague", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=epreuve&competence=tourbillon`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await page.evaluate(() => {
      window.__rush.jouerPilote(520, 0, "foncer");
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br6-epreuve.png` });
    await context.close();
  });

  test("la carte des 7 jours", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=carte&jours=7`);
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector(".rush-carte__jour canvas", { timeout: 100_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DOSSIER}/br6-carte-7-jours.png`, fullPage: true });
    await context.close();
  });
});
