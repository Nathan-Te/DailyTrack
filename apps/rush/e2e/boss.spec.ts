import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { BOSS_IDS, Partie, contenuScenario } from "@cdj/rush-sim";
import { JOUR, appareil, lancer } from "./appareil";

// « Rush » (lot BR3) — les CINQ boss côté vue : chacun se charge sans erreur dans la console, la barre de vie porte son nom et sa phase, sa présentation paraît, il annonce et frappe sans erreur, et la scène reste sous 200 appels de dessin dans les deux
// niveaux de qualité. Le bestiaire montre les cinq côte à côte, figés, avec leur nom. Les règles du combat (zones, états, étourdissement) sont dans `packages/rush-sim/test`.
const NOMS: Record<string, string> = { golem: "Golem", reine: "Reine gelée", "grand-duc": "Grand-duc", belier: "Bélier de carrière", chene: "Vieux chêne" };

/** Les ticks que le boss met à commencer sa première annonce (la simulation, la même qu'en page, chevalier immobile) : la page les joue d'un seul appel — `avancer(n)` dessine UNE image par appel, et un dessin coûte cher sans carte graphique. */
function ticksAvantAnnonce(id: string): number {
  const p = new Partie(contenuScenario("boss", { jour: parseDay(JOUR)!, boss: BOSS_IDS.indexOf(id as (typeof BOSS_IDS)[number]) }));
  let n = 0;
  while (p.golem!.etat !== 1 && n < 1000) {
    p.avancer(0);
    n++;
  }
  return n;
}

/** Écoute la console et les erreurs de la page : les erreurs se lisent à la fin du test. */
function espionner(page: Page): string[] {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(`pageerror : ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(`console : ${m.text()}`);
  });
  return erreurs;
}

test.describe("Rush : les cinq boss", () => {
  for (const [k, id] of BOSS_IDS.entries()) {
    test(`${id} : se charge sans erreur, nom et phase dans la barre de vie, présentation, annonce et appels de dessin sous 200`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=boss&boss=${id}`);
      const erreurs = espionner(page);
      await lancer(page);
      expect(await page.evaluate(() => window.__rush.partie().golem!.kind)).toBe(k);
      await expect(page.locator(".rush-boss")).toBeVisible();
      await expect(page.locator(".rush-boss__nom")).toHaveText(NOMS[id]!);
      await expect(page.locator(".rush-boss__phase")).toHaveText("Phase 1");
      await expect(page.locator("#jeu-hud-score")).toHaveText(`${NOMS[id]} 100 %`);
      // sa présentation : une pastille avec son nom, ~1 s
      await expect(page.locator(".rush-presentation")).toHaveText(NOMS[id]!);
      // jusqu'à sa première annonce, puis au beau milieu : la scène se dessine, sous 200 appels (haute et basse qualité)
      await page.evaluate((n) => window.__jeu.avancer(n + 40), ticksAvantAnnonce(id));
      expect(await page.evaluate(() => window.__rush.partie().golem!.etat)).toBe(1);
      for (const q of ["haute", "basse"] as const) {
        const appels = await page.evaluate((q) => {
          window.__rush.definirQualite(q);
          window.__rush.dessinerMaintenant();
          return window.__rush.calls();
        }, q);
        expect(appels, `appels de dessin (${q})`).toBeLessThan(200);
        expect(appels).toBeGreaterThan(10);
      }
      // il continue : ses attaques, ses impacts, sa récupération, sans erreur
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.__jeu.avancer(180));
        await page.evaluate(() => window.__rush.dessinerMaintenant());
      }
      expect(erreurs).toEqual([]);
      await context.close();
    });
  }

  test("la phase 2 : la barre de vie le dit, pour un boss qui n'est pas le golem", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=boss&boss=reine&phase=2");
    const erreurs = espionner(page);
    await lancer(page);
    await expect(page.locator(".rush-boss__nom")).toHaveText("Reine gelée");
    await expect(page.locator(".rush-boss__phase")).toHaveText("Phase 2");
    await page.evaluate(() => window.__jeu.avancer(300));
    expect(erreurs).toEqual([]);
    await context.close();
  });

  test("un identifiant de boss inconnu joue le golem", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=boss&boss=dragon");
    await lancer(page);
    await expect(page.locator(".rush-boss__nom")).toHaveText("Golem");
    await context.close();
  });

  test("le bestiaire : les cinq boss côte à côte, figés, leur nom dessous, sous 200 appels de dessin", async ({ browser }) => {
    for (const theme of ["prairie", "carriere", "sousbois"]) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=bestiaire&theme=${theme}`);
      const erreurs = espionner(page);
      await lancer(page);
      const etiquettes = page.locator(".rush-etiquette");
      await expect(etiquettes).toHaveCount(5);
      expect(await etiquettes.allTextContents()).toEqual(BOSS_IDS.map((id) => NOMS[id]));
      await expect(page.locator(".rush-boss")).toBeHidden(); // pas de barre de vie : personne ne se bat
      const avant = await page.evaluate(() => window.__rush.partie().tick);
      await page.evaluate(() => window.__jeu.avancer(200));
      expect(await page.evaluate(() => window.__rush.partie().tick)).toBe(avant); // figés
      for (const q of ["haute", "basse"] as const) {
        const appels = await page.evaluate((q) => {
          window.__rush.definirQualite(q);
          window.__rush.dessinerMaintenant();
          return window.__rush.calls();
        }, q);
        expect(appels, `appels de dessin (${theme}, ${q})`).toBeLessThan(200);
      }
      expect(erreurs).toEqual([]);
      await context.close();
    }
  });

  test("à l'entrée de l'arène du niveau du jour, le boss du jour se présente (pastille avec son nom) et sa barre de vie le nomme", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    const erreurs = espionner(page);
    await lancer(page);
    const kind = await page.evaluate(() => window.__rush.partie().golem!.kind);
    await page.evaluate(() => {
      window.__rush.aller(...(window.__rush.avantLArene(6) as [number, number]));
      window.__rush.forcer(window.__rush.versLArene(), 600);
      window.__jeu.avancer(120);
    });
    await expect(page.locator(".rush-boss")).toBeVisible();
    await expect(page.locator(".rush-boss__nom")).toHaveText(NOMS[BOSS_IDS[kind]!]!);
    await expect(page.locator(".rush-presentation")).toBeVisible(); // il rugit, invulnérable : son nom est au centre-haut…
    await expect(page.locator(".rush-presentation")).toHaveText(NOMS[BOSS_IDS[kind]!]!);
    await expect(page.locator(".rush-presentation")).toBeHidden({ timeout: 4000 }); // … ~1 s, puis disparaît
    expect(erreurs).toEqual([]);
    await context.close();
  });

  test("la carte des jours écrit le boss de chaque jour", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=carte&jours=3");
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector(".rush-carte__jour canvas", { timeout: 60_000 });
    const legendes = await page.locator(".rush-carte__jour figcaption").allTextContents();
    expect(legendes).toHaveLength(3);
    for (const l of legendes) expect(Object.values(NOMS).some((n) => l.includes(n)), l).toBe(true);
    await context.close();
  });
});
