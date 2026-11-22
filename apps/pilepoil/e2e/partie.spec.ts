import { expect, test } from "@playwright/test";
import { appareil, jouerLeJour, lancer } from "./appareil";

// « Pile poil » — LE parcours de joueur, sans serveur : l'accueil (l'étiquette, JOUER, les plaques Discord et Ko-fi), une partie jouée appui par appui, le HUD en surimpression (score, « n/10 », « PILE ×n »), la pause
// (le temps s'arrête), l'arrivée avec son score et son bilan, « Rejouer ». Le classement avec le vrai serveur est dans `classement.spec.ts`. Les règles de la partie sont dans `packages/pilepoil-sim/test` : ici, seulement ce que le joueur voit.
test.describe("Pilepoil : une partie", () => {
  test("accueil, partie scriptée, pause, arrivée et rejouer", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-record")).toHaveText("—");
    await expect(page.locator("#communaute")).toBeVisible(); // lot S1 : Discord et Ko-fi sur l'accueil
    await lancer(page);
    await expect(page.locator("#communaute")).toBeHidden(); // jamais en partie
    await expect(page.locator(".jeu-surimpression__valeur")).toHaveText("0");
    await expect(page.locator(".jeu-surimpression__cartouche")).toHaveText("1/10");
    // Un appui (Espace) arrête le curseur : la jauge suivante après la pause.
    await page.keyboard.press("Space");
    await page.evaluate(() => window.__jeu.avancer(70));
    await expect(page.locator(".jeu-surimpression__cartouche")).toHaveText("2/10");
    // Entrée arrête aussi le curseur (elle ne recommence pas la partie) ; « Recommencer » de la pause, si.
    await page.keyboard.press("Enter");
    await page.evaluate(() => window.__jeu.avancer(70));
    await expect(page.locator(".jeu-surimpression__cartouche")).toHaveText("3/10");
    await page.keyboard.press("Escape");
    await expect(page.locator("#jeu-pause")).toBeVisible();
    await page.locator("#jeu-pause-recommencer").click();
    await expect(page.locator(".jeu-surimpression__cartouche")).toHaveText("1/10");
    // La pause arrête le temps : aucun tick n'est joué, la reprise le relance.
    await page.locator("#jeu-hud-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await page.locator("#jeu-reprendre").click();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    const attendu = await jouerLeJour(page, 30000, [3, 7]);
    expect(attendu.ratees).toBeGreaterThanOrEqual(2); // deux jauges filées
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect((await page.locator("#jeu-fin-score").textContent())!.replace(/\D/g, "")).toBe(String(attendu.score)); // le nombre au format de la langue
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([attendu.score, attendu.piles]);
    await expect(page.locator("#jeu-fin")).toContainText(`« Pile »${attendu.piles} sur 10`); // le bilan de la partie, dans l'écran de fin du kit
    // Un jeu Party n'a pas de médaille : l'écran de fin n'en montre aucune.
    await expect(page.locator("#jeu-fin .dj-medaille")).toHaveCount(0);
    // Hors ligne (aucun serveur) : on le dit, et on garde le record dans le navigateur.
    await expect(page.locator("#jeu-fin-rang")).toContainText("Hors ligne");
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    await expect(page.locator(".jeu-surimpression__valeur")).toHaveText("0");
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
