import { expect, test } from "@playwright/test";
import { DUREE_PARTIE_ROBOT, VARIANTE, dailyPinball, graineDuRobot, jouerRobot } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// « Pinball » (lot PB4) — LES ESSAIS DE RECETTE `?robot` : on regarde le robot jouer la table du jour avec la mention « Le robot joue » ; `?jour=AAAA-MM-JJ&robot` pour un autre jour. La page rejoue les événements
// que la simulation (Node, la même) calcule pour la partie du robot : le jeu ne décide rien. Hors production seulement, jamais classé (la production n'a aucune de ces options : `test/essai.test.ts`).
const robot = (jour: string, k = 0) => jouerRobot(dailyPinball(parseDay(jour)!), graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT });

test.describe("Pinball : le robot joue (?robot)", () => {
  test("la mention « Le robot joue », et la page rejoue les événements de la partie du robot au pas près", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await expect(page.locator(".pinball-robot")).toHaveText("Le robot joue");
    const attendu = robot(JOUR);
    const PAS = 9000;
    await page.evaluate((pas) => window.__jeu.avancer(pas), PAS);
    const joues = await page.evaluate(() => window.__pinball!.evenements());
    expect(joues).toEqual(attendu.evenements.filter((e) => e.tick < PAS));
    expect(joues.length).toBeGreaterThan(5);
    // le score de la page est celui de la simulation à ce pas (le robot a joué sa partie, pas autre chose)
    const verite = jouerRobot(dailyPinball(parseDay(JOUR)!), graineDuRobot(0), { maxTicks: PAS });
    await expect(page.locator("#jeu-hud-score")).toHaveText(VARIANTE.formatScore([verite.partie.score, PAS], "fr"));
    await context.close();
  });

  test("le toucher et le clavier ne changent rien quand le robot joue ; la partie n'est pas classable", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await page.evaluate(() => {
      window.__pinball!.regler(0, true); // le joueur appuie : ignoré
      window.__jeu.avancer(2000);
    });
    const joues = await page.evaluate(() => window.__pinball!.evenements());
    expect(joues).toEqual(robot(JOUR).evenements.filter((e) => e.tick < 2000));
    await page.keyboard.down("KeyQ");
    await page.evaluate(() => window.__jeu.avancer(300));
    await page.keyboard.up("KeyQ");
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual(robot(JOUR).evenements.filter((e) => e.tick < 2300));
    await context.close();
  });

  test("`?robot=2` : la troisième partie du robot ; `?jour=…&robot` : un autre jour", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot=2&jour=2026-11-03");
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(4000));
    const attendu = jouerRobot(dailyPinball(parseDay("2026-11-03")!), graineDuRobot(2), { maxTicks: DUREE_PARTIE_ROBOT });
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual(attendu.evenements.filter((e) => e.tick < 4000));
    await context.close();
  });

  test("la partie du robot s'arrête au pas où il s'est arrêté, et l'arrivée dit que ce n'est pas un classement", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await page.evaluate((pas) => window.__jeu.avancer(pas + 500), DUREE_PARTIE_ROBOT);
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(robot(JOUR).partie.tick);
    await expect(page.locator("#jeu-fin-score")).toHaveText(/\d/);
    await context.close();
  });

  test("l'anglais : « The robot plays »", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await expect(page.locator(".pinball-robot")).toHaveText("The robot plays");
    await context.close();
  });

  test("sans `?robot`, aucune mention ni robot : une partie normale", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse");
    await lancer(page);
    await expect(page.locator(".pinball-robot")).toHaveCount(0);
    await context.close();
  });
});
