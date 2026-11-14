import { expect, test } from "@playwright/test";
import { dailyGravity, medailleDe, seuilsDe, VARIANTE } from "@cdj/gravity-sim";
import { parseDay } from "@cdj/core";
import { appareil, jouerLeJour, JOUR, lancer } from "./appareil";

// « Gravity » — LE parcours de joueur, sans serveur : l'accueil (l'étiquette, JOUER, les plaques Discord et Ko-fi), une partie jouée appui par appui, le HUD (score, distance, multiplicateur), la pause (le temps s'arrête),
// l'arrivée avec son score et sa médaille, « Rejouer ». Le classement avec le vrai serveur est dans `classement.spec.ts`. Les règles de la partie sont dans `packages/gravity-sim/test` : ici, seulement ce que le joueur voit.
test.describe("Gravity : une partie", () => {
  test("accueil, partie scriptée, pause, arrivée et rejouer", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-record")).toHaveText("—");
    await expect(page.locator("#communaute")).toBeVisible(); // lot S1 : Discord et Ko-fi sur l'accueil
    await lancer(page);
    await expect(page.locator("#communaute")).toBeHidden(); // jamais en partie
    await expect(page.locator("#jeu-hud-score")).toHaveText("0");
    await expect(page.locator("#jeu-hud-temps")).toHaveText("0 m · ×1");
    // La pause arrête le temps : aucun pas n'est joué, la reprise le relance.
    await page.locator("#jeu-hud-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await page.locator("#jeu-reprendre").click();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    // Quelques pas puis un appui : le score et la distance montent.
    await page.evaluate(() => {
      window.__jeu.avancer(400);
      window.__jeu.action("toucher");
      window.__jeu.avancer(60);
    });
    await expect(page.locator("#jeu-hud-score")).not.toHaveText("0");
    await expect(page.locator("#jeu-hud-temps")).toContainText(" m · ×");
    await context.close();
  });

  test("une partie entière : l'arrivée montre le score rejoué par la simulation, la médaille et « Rejouer »", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(page);
    const attendu = await jouerLeJour(page);
    await expect(page.locator("#jeu-fin")).toBeVisible();
    const score = VARIANTE.score(attendu);
    await expect(page.locator("#jeu-fin-score")).toHaveText(VARIANTE.formatScore(score, "fr"));
    expect(await page.evaluate(() => window.__jeu.score())).toEqual(score);
    const medaille = medailleDe(score, seuilsDe(dailyGravity(parseDay(JOUR)!)));
    if (medaille) await expect(page.locator("#jeu-fin .dj-medaille--pastille.dj-medaille--obtenue")).toBeVisible();
    // Hors ligne (aucun serveur) : on le dit, et on garde le record dans le navigateur.
    await expect(page.locator("#jeu-fin-rang")).toContainText("Hors ligne");
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    await expect(page.locator("#jeu-hud-score")).toHaveText("0");
    await context.close();
  });

  test("les essais : ?theme= commence sur ce thème, la touche T saute au suivant ; la partie n'est jamais classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&theme=neon");
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(30));
    await page.keyboard.press("KeyT");
    await page.evaluate(() => window.__jeu.avancer(30));
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
    await context.close();
  });

  test("« Comment jouer » s'ouvre au premier lancement, une seule fois", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?tactile=0", false);
    await expect(page.locator("#jeu-aide")).toBeVisible();
    await page.locator("#jeu-aide-ok").click();
    await expect(page.locator("#jeu-aide")).toBeHidden();
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await expect(page.locator("#jeu-aide")).toBeHidden();
    await context.close();
  });

  for (const [largeur, hauteur] of [[390, 844], [360, 640]] as const) {
    test(`l'accueil sur un téléphone en portrait (${largeur} × ${hauteur}) : l'étiquette complète, des plaques de 44 px qui ne la recouvrent pas`, async ({ browser }) => {
      const { context, page } = await appareil(browser, "/?tactile=1");
      await page.setViewportSize({ width: largeur, height: hauteur });
      const etiquette = await page.locator("#jeu-accueil .jeu-etiquette").boundingBox();
      expect(etiquette!.x).toBeGreaterThanOrEqual(0);
      expect(etiquette!.x + etiquette!.width).toBeLessThanOrEqual(largeur);
      for (const a of await page.locator("#communaute a").all()) {
        const b = (await a.boundingBox())!;
        expect([Math.round(b.width), Math.round(b.height)]).toEqual([44, 44]);
        const recouvre = b.x < etiquette!.x + etiquette!.width && b.x + b.width > etiquette!.x && b.y < etiquette!.y + etiquette!.height && b.y + b.height > etiquette!.y;
        expect(recouvre, "une plaque ne recouvre pas l'étiquette").toBe(false);
      }
      await context.close();
    });
  }
});
