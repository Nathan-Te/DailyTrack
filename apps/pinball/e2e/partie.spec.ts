import { expect, test } from "@playwright/test";
import { medailleDe, VARIANTE } from "@cdj/pinball-sim";
import { appareil, jouerLeJour, lancer, SEUILS_ESSAI } from "./appareil";

// « Pinball » — LE parcours de joueur, sans serveur : l'accueil (l'étiquette, JOUER, les plaques Discord et Ko-fi), une partie jouée commande par commande, le HUD (score, multiplicateur, billes), la pause (le temps
// s'arrête), l'arrivée avec son score et sa médaille, « Rejouer ». Le classement avec le vrai serveur est dans `classement.spec.ts`. Les règles de la partie sont dans `packages/pinball-sim/test` : ici, seulement ce que
// le joueur voit et les entrées (clavier, souris, toucher) qui datent les changements de commandes.
test.describe("Pinball : une partie", () => {
  test("accueil, HUD, pause et reprise", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-record")).toHaveText("—");
    await expect(page.locator("#communaute")).toBeVisible(); // lot S1 : Discord et Ko-fi sur l'accueil
    await lancer(page);
    await expect(page.locator("#communaute")).toBeHidden(); // jamais en partie
    await expect(page.locator("#jeu-hud-score")).toHaveText("0");
    await expect(page.locator("#jeu-hud-temps")).toHaveText("×1 · Billes : 3");
    // La pause arrête le temps : aucun pas n'est joué, la reprise le relance.
    await page.locator("#jeu-hud-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await page.locator("#jeu-reprendre").click();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
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
    const medaille = medailleDe(score, SEUILS_ESSAI); // le jour d'essai est servi comme un jour figé
    if (medaille) await expect(page.locator("#jeu-fin .dj-medaille--pastille.dj-medaille--obtenue")).toBeVisible();
    // La rediffusion du jeu est celle de la simulation : le serveur la rejouera à l'identique (voir `classement.spec.ts` et `determinisme.spec.ts`).
    expect(await page.evaluate(() => window.__jeu.rediffusion())).toBeTruthy();
    // Hors ligne (aucun serveur) : on le dit, et on garde le record dans le navigateur.
    await expect(page.locator("#jeu-fin-rang")).toContainText("Hors ligne");
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    await expect(page.locator("#jeu-hud-score")).toHaveText("0");
    await context.close();
  });

  test("les entrées : le clavier tient et relâche les batteurs, la souris fait le lanceur puis les deux moitiés de l'écran, chaque changement est daté au pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(page);
    const journal = (): Promise<{ tick: number; c: number; enfonce: boolean }[]> => page.evaluate(() => window.__pinball!.evenements());
    // le clavier : ← lève le batteur gauche, → le droit, Espace le lanceur ; chaque relâchement est daté
    await page.keyboard.down("ArrowLeft");
    await page.evaluate(() => window.__jeu.avancer(5));
    await page.keyboard.down("KeyD");
    await page.evaluate(() => window.__jeu.avancer(5));
    await page.keyboard.up("ArrowLeft");
    await page.evaluate(() => window.__jeu.avancer(5));
    await page.keyboard.up("KeyD");
    await page.keyboard.down("Space");
    await page.evaluate(() => window.__jeu.avancer(20));
    await page.keyboard.up("Space");
    await page.evaluate(() => window.__jeu.avancer(2));
    expect(await journal()).toEqual([
      { tick: 0, c: 0, enfonce: true },
      { tick: 5, c: 1, enfonce: true },
      { tick: 10, c: 0, enfonce: false },
      { tick: 15, c: 1, enfonce: false },
      { tick: 15, c: 2, enfonce: true },
      { tick: 35, c: 2, enfonce: false },
    ]);
    // la souris (le toucher) : le lanceur seul quand la bille est partie, puis la moitié gauche et la moitié droite de la table
    const plateau = (await page.locator(".pinball-plateau").boundingBox())!;
    await page.evaluate(() => window.__jeu.avancer(100));
    const avant = (await journal()).length;
    await page.mouse.move(plateau.x + plateau.width * 0.25, plateau.y + plateau.height * 0.7);
    await page.mouse.down();
    await page.evaluate(() => window.__jeu.avancer(3));
    await page.mouse.up();
    await page.mouse.move(plateau.x + plateau.width * 0.75, plateau.y + plateau.height * 0.7);
    await page.mouse.down();
    await page.evaluate(() => window.__jeu.avancer(3));
    await page.mouse.up();
    await page.evaluate(() => window.__jeu.avancer(2));
    const nouveau = (await journal()).slice(avant);
    // la bille est dans le jeu (le lancer a duré 20 pas, elle est partie) ou revenue dans le couloir : dans les deux cas deux appuis tenus puis relâchés, un par moitié ou le lanceur
    expect(nouveau).toHaveLength(4);
    expect(nouveau.map((e) => e.enfonce)).toEqual([true, false, true, false]);
    await context.close();
  });

  test("la touche choisie par le joueur : une touche réassignée tient le batteur (le kit signale l'appui, la scène relit les touches)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await page.evaluate(() => localStorage.setItem("cdj:commandes:pinball", JSON.stringify({ v: 1, clavier: { gauche: ["KeyZ", "ArrowLeft"], droite: ["KeyM", "KeyD"], lanceur: ["Space", "ArrowDown"] }, manette: { gauche: "b4", droite: "b5", lanceur: "b0" } })));
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await page.keyboard.down("KeyZ");
    await page.evaluate(() => window.__jeu.avancer(4));
    await page.keyboard.up("KeyZ");
    await page.evaluate(() => window.__jeu.avancer(1));
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual([
      { tick: 0, c: 0, enfonce: true },
      { tick: 4, c: 0, enfonce: false },
    ]);
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

  test("les essais : ?jour= joue la table d'un autre jour, jamais classée ; ?debug pose les essais de la scène", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&jour=2026-11-03");
    await lancer(page);
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(0);
    await page.evaluate(() => window.__jeu.avancer(30));
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(30);
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

