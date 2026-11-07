import { expect, test } from "@playwright/test";
import { actionDe, enregistrer, jouer, dailyBlocks } from "@cdj/blocks-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer, partieDuGlouton, poserLesActions } from "./appareil";

// « Blocks » — LE parcours de joueur, sans serveur : l'accueil (l'étiquette, JOUER, les plaques Discord et Ko-fi), une partie jouée pose par pose, le HUD (score, combo), la pause, l'arrivée avec son score, « Rejouer ».
// Le classement avec le vrai serveur est dans `classement.spec.ts`, le glisser-déposer dans `glisser.spec.ts`, les scénarios dans `scenarios.spec.ts`. Les règles sont dans `packages/blocks-sim/test` : ici, ce que le joueur voit.
test.describe("Blocks : une partie", () => {
  test("accueil, partie du glouton, pause, arrivée et rejouer", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-record")).toHaveText("—");
    await expect(page.locator("#communaute")).toBeVisible(); // lot S1 : Discord et Ko-fi sur l'accueil
    await lancer(page);
    await expect(page.locator("#communaute")).toBeHidden(); // jamais en partie
    await expect(page.locator("#jeu-hud-score")).toHaveText("0 pts");
    await expect(page.locator("canvas.blocks-plateau")).toBeVisible();
    // La pause arrête la partie : la phase change, la reprise la relance.
    await page.locator("#jeu-hud-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await page.locator("#jeu-reprendre").click();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    // Une première pose : le score du HUD suit la simulation (1 point par case posée, ici la première pièce du jour).
    const { actions, resultat } = partieDuGlouton();
    const etat = await (async () => {
      await poserLesActions(page, actions.slice(0, 1), false);
      return page.evaluate(() => window.__blocks.etat());
    })();
    expect(etat.poses).toBe(1);
    await expect(page.locator("#jeu-hud-score")).toHaveText(new RegExp(`^${etat.score}\\s*pts$`));
    await poserLesActions(page, actions.slice(1));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([resultat.score, resultat.combo]);
    await expect(page.locator("#jeu-fin-score")).toContainText("pts");
    // La rediffusion que le jeu garde est celle des poses jouées, et le même code la rejoue au même résultat (serveur = jeu).
    const rediffusion = await page.evaluate(() => window.__jeu.rediffusion());
    expect(rediffusion).toBe(enregistrer(dailyBlocks(parseDay(JOUR)!), actions));
    expect(jouer(dailyBlocks(parseDay(JOUR)!), actions)).toEqual(resultat);
    // Hors ligne (aucun serveur) : on le dit, et on garde le record dans le navigateur.
    await expect(page.locator("#jeu-fin-rang")).toContainText("Hors ligne");
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    await expect(page.locator("#jeu-hud-score")).toHaveText("0 pts");
    await context.close();
  });

  test("une pose illégale est ignorée : le score, la grille et les trois pièces ne bougent pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(page);
    const { actions } = partieDuGlouton();
    await poserLesActions(page, actions.slice(0, 1), false);
    const avant = await page.evaluate(() => ({ grille: window.__blocks.grille(), etat: window.__blocks.etat(), pieces: window.__blocks.pieces() }));
    await poserLesActions(page, [actions[0]!, actionDe(2, 7, 7) + 9, actionDe(0, 4, 4)], false); // la même pose (l'emplacement est vide) ; hors grille ; encore l'emplacement vide
    expect(await page.evaluate(() => ({ grille: window.__blocks.grille(), etat: window.__blocks.etat(), pieces: window.__blocks.pieces() }))).toEqual(avant);
    await context.close();
  });

  test("le HUD montre le combo quand il y en a un", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=presque-plein");
    await lancer(page);
    await expect(page.locator("#jeu-hud-temps")).toHaveText("");
    await page.evaluate(() => window.__jeu.action("pose:0:5:6"));
    await expect(page.locator("#jeu-hud-temps")).toHaveText("Combo ×1");
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

