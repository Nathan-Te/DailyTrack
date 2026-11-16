import { expect, test } from "@playwright/test";
import { appareil } from "./appareil";

// Lot PG1 — `DefinitionJeu.chargerPartie` (le chargement asynchrone d'une partie), essayé sur « Cibles », le jeu témoin : `?debug&chargement=1000` lui en donne un LENT (1 s). Le kit l'appelle et l'attend **avant**
// le premier `nouvellePartie` : pendant ce temps l'accueil reste à l'écran, avec « Chargement du jeu… » (après 250 ms), JOUER est désarmé, et aucune scène n'existe ; la partie ne démarre qu'après. Sans le paramètre
// (le cas de tous les jeux d'aujourd'hui), rien ne change : `partie.spec.ts`.
// **Famille « Régression »** (`e2e.regression` de la fiche de Cibles) : l'Essentiel d'une PR large n'a plus une seconde de marge dans ses 900 s (`apps/web/test/ciZones.test.ts`, « le budget ») ; il tourne dans la CI complète de `main`,
// la nuit, par `npm run verifier -- --regression` et dès que ce spec est modifié.
const LENT_MS = 1000;
test.describe("Cibles : le chargement asynchrone d'une partie (kit, lot PG1)", () => {
  test("la partie ne démarre qu'après `chargerPartie`, l'accueil reste à l'écran pendant l'attente", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&chargement=${LENT_MS}`);
    const avant = await page.evaluate(() => performance.now());
    await page.locator("#jeu-jouer").click();
    // Pendant le chargement : l'accueil est là, JOUER est désarmé, le message d'attente apparaît, aucune scène n'a été créée, la porte des essais n'existe pas encore.
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-jouer")).toBeDisabled();
    await expect(page.getByText("Chargement du jeu…")).toBeVisible();
    expect(await page.locator("#jeu-scene").count()).toBe(0);
    expect(await page.evaluate(() => !!(window as unknown as { __jeu?: unknown }).__jeu)).toBe(false);
    // Après : la scène, puis la partie ; au moins `LENT_MS` se sont écoulées depuis le toucher.
    await page.waitForFunction(() => !!(window as unknown as { __jeu?: unknown }).__jeu);
    const apres = await page.evaluate(() => performance.now());
    expect(apres - avant, "la partie n'est pas venue avant la fin du chargement").toBeGreaterThanOrEqual(LENT_MS - 50);
    await expect(page.locator("#jeu-scene")).toBeVisible();
    await expect(page.locator("#jeu-hud-score")).toHaveText("0 / 20");
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    await context.close();
  });

  test("sans `chargerPartie` rien ne change : la scène vient aussitôt", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await page.locator("#jeu-jouer").click();
    await expect(page.locator("#jeu-scene")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Chargement du jeu…")).toHaveCount(0);
    await context.close();
  });
});
