import { expect, test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Les essais de recette du lot GR2 (hors production, jamais classés) : `?robot` — on regarde le robot jouer le niveau du jour — et `?morceau=<n>` — la partie commence juste avant le morceau n, dans l'état où le robot
// y arrive. La logique (lecture de l'adresse, rien en production) est testée en unitaire (`test/essai.test.ts`) ; ici, seulement ce que le joueur voit.
test.describe("Gravity : les essais de recette", () => {
  test("?robot : le robot joue seul (la distance monte sans un appui), le toucher ne change rien, la partie n'est jamais classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&robot");
    await lancer(page);
    await expect(page.locator("#jeu-hud-temps")).toHaveText("0 m · ×1");
    await page.evaluate(() => {
      window.__jeu.avancer(1500);
      window.__jeu.action("toucher"); // un humain qui touche pendant que le robot joue : sans effet
    });
    const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
    expect(Number(texte.split(" m")[0])).toBeGreaterThan(60); // 1 500 pas à 7 m/s : 88 m
    expect(Number((await page.locator("#jeu-hud-score").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(100);
    // Le robot passe plusieurs minutes de jeu : la partie finit un jour, non classée.
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
    await context.close();
  });

  test("?morceau=30 : la partie commence juste avant le morceau 30, avec le score et le multiplicateur du robot ; jamais classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&morceau=30");
    await lancer(page);
    const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
    const distance = Number(texte.split(" m")[0]);
    expect(distance).toBeGreaterThan(30 * 16 - 3 - 14); // douze colonnes avant le morceau (480 m)
    expect(distance).toBeLessThan(30 * 16);
    expect(Number((await page.locator("#jeu-hud-score").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(distance);
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai");
    await context.close();
  });

  // Lot GR5 : les réglages d'essai du calibrage (`?vitesse=`, `?plafond=`, `?pente=`, `?gravite=`, `?longueur=`, `?medailles=`). La lecture, les plages et « rien en production » sont en unitaire (`test/essai.test.ts`).
  test("lot GR5 — ?vitesse=9&gravite=40&medailles=50 : la partie dit « Réglage d'essai » et ce qui a changé, la caméra part plus vite, jamais classée ; sans réglage la mention est absente", async ({ browser }) => {
    const normal = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(normal.page);
    await expect(normal.page.locator(".g-reglage")).toBeHidden();
    await normal.context.close();
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&vitesse=9&gravite=40&medailles=50");
    await lancer(page);
    await expect(page.locator(".g-reglage")).toBeVisible();
    await expect(page.locator(".g-reglage")).toHaveText("Réglage d'essai · départ 9 m/s · gravité 40 · médailles à 50 %");
    await page.evaluate(() => window.__jeu.avancer(400));
    const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
    expect(Number(texte.split(" m")[0])).toBeGreaterThan(28); // 400 pas (3,3 s) à 9 m/s : ≈ 31 m (à 7 m/s : ≈ 25 m)
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
    await context.close();
  });
});
