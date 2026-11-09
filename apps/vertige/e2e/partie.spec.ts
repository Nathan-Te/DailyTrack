import { expect, test, type Page } from "@playwright/test";
import { VARIANTE } from "@cdj/vertige-sim";
import { appareil, jouerLeJour, lancer } from "./appareil";

// « Vertige » — le parcours de joueur du jeu, sans serveur : l'accueil, une partie jouée touche par touche (le clavier est lu par `event.code`), le HUD, la pause (le temps s'arrête), la relance sur R, le changement
// de style, le chrono qui part au premier mouvement et s'arrête à l'arrivée, l'écran tactile. Le classement avec le vrai serveur est dans `classement.spec.ts`. Les règles des mouvements sont dans
// `packages/vertige-sim/test` : ici, seulement ce que le joueur voit et ce que le navigateur lit (touches, souris).
const sim = (page: Page) =>
  page.evaluate(() => {
    const s = window.__vertige.sim();
    return { tick: s.tick, z: s.z, vz: s.vz, y: s.y, sol: s.sol, dash: s.dash, depart: s.depart, chrono: s.chrono };
  });

test.describe("Vertige : une partie", () => {
  test("accueil, pause, course au clavier, relance sur R, style, dash", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=bac-a-sable");
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-record")).toHaveText("—");
    await lancer(page);
    await page.waitForFunction(() => !!window.__vertige);
    await expect(page.locator("#jeu-hud-score")).toHaveText("0,000 s");
    // La pause arrête le temps : aucun pas n'est joué, la reprise le relance.
    await page.locator("#jeu-hud-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await page.locator("#jeu-reprendre").click();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");

    // Le chrono ne part pas tant qu'on ne bouge pas ; la touche W (ZQSD d'un AZERTY, WASD d'un QWERTY) fait courir vers l'avant.
    await page.evaluate(() => window.__jeu.avancer(30));
    expect((await sim(page)).depart).toBe(-1);
    await expect(page.locator("#jeu-hud-score")).toHaveText("0,000 s");
    await page.keyboard.down("KeyW");
    await page.evaluate(() => window.__jeu.avancer(120));
    const course = await sim(page);
    expect(course.depart).toBeGreaterThanOrEqual(0);
    expect(course.vz).toBeLessThan(-9_000_000);
    expect(course.z).toBeLessThan(0);
    await page.keyboard.up("KeyW");
    await page.evaluate(() => window.__jeu.avancer(60));
    expect(Math.abs((await sim(page)).vz)).toBeLessThan(500_000); // relâchée : il s'arrête
    await page.keyboard.down("Space"); // le saut : un appui
    await page.evaluate(() => window.__jeu.avancer(3));
    await page.keyboard.up("Space");
    expect((await sim(page)).y).toBeGreaterThan(0);
    await page.evaluate(() => window.__jeu.avancer(100));
    await page.keyboard.down("ShiftLeft"); // le dash
    await page.evaluate(() => window.__jeu.avancer(2));
    expect((await sim(page)).dash).toBeGreaterThan(0);
    await page.keyboard.up("ShiftLeft");
    await expect(page.locator(".vertige-etat")).toHaveText("Dash");

    // R recommence tout de suite ; 2 passe en « Cartouche », 1 revient à « Lumière douce », et le choix est gardé.
    await page.keyboard.press("KeyR");
    await expect.poll(async () => (await sim(page)).tick).toBe(0);
    await page.keyboard.press("Digit2");
    expect(await page.evaluate(() => window.__vertige.monde.hab.style)).toBe("cartouche");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vertige:confort") ?? "{}").style)).toBe("cartouche");
    await page.keyboard.press("Digit1");
    expect(await page.evaluate(() => window.__vertige.monde.hab.style)).toBe("doux");
    await context.close();
  });

  test("le parcours est joué de bout en bout : le chrono s'arrête à l'arrivée, l'écran de fin donne le temps, la partie d'essai n'est pas classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&demo&tactile=0&scenario=parcours");
    await lancer(page);
    await page.waitForFunction(() => !!window.__vertige);
    await page.waitForTimeout(500); // le joueur scripté se charge à la demande
    await page.evaluate(() => window.__jeu.avancer(2000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    const r = await page.evaluate(() => window.__vertige.sim().resultat());
    expect(r.arrive).toBe(true);
    await expect(page.locator("#jeu-fin-score")).toHaveText(VARIANTE.formatScore(VARIANTE.score(r), "fr"));
    await expect(page.locator("#jeu-fin")).toContainText("Partie d'essai");
    await context.close();
  });

  test("une partie du jour jouée de bout en bout garde sa rediffusion : les commandes de chaque pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(page);
    await page.waitForFunction(() => !!window.__vertige);
    const attendu = await jouerLeJour(page, 0);
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-score")).toHaveText(VARIANTE.formatScore(VARIANTE.score(attendu), "fr"));
    expect(await page.evaluate(() => window.__jeu.score())).toEqual(VARIANTE.score(attendu));
    expect(await page.evaluate(() => (window.__jeu.rediffusion() ?? "").length)).toBeGreaterThan(20);
    await expect(page.locator("#jeu-fin-rang")).toContainText("Hors ligne"); // aucun serveur : on le dit
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    await expect(page.locator("#jeu-hud-score")).toHaveText("0,000 s");
    await context.close();
  });

  test("sur un écran tactile, le jeu dit où jouer et ne charge pas la scène", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1");
    await lancer(page);
    await expect(page.locator(".vertige-tactile")).toHaveText("À jouer sur ordinateur, au clavier et à la souris, ou à la manette.");
    expect(await page.locator("canvas").count()).toBe(0);
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
