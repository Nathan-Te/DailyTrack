import { expect, test } from "@playwright/test";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, PIECES } from "@cdj/blocks-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";
import { API, appareil, lancer } from "./appareil";

// « Blocks » — les scénarios d'essai (seed § 9), locaux et jamais classés : `?scenario=presque-plein` (une pose efface 2 lignes et 1 colonne), `blocage` (la pièce ne rentre nulle part : fin immédiate), `plateau-vide`
// (une pose vide la grille). Une partie de scénario est en archive : elle ne se classe pas et ne s'envoie pas, même avec un serveur.
test.describe("Blocks : les scénarios", () => {
  test("presque-plein : une pose, 2 lignes et 1 colonne, 96 points, combo 1", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=presque-plein");
    await expect(page.locator("#jeu-archive")).toBeVisible();
    await lancer(page);
    await page.evaluate(() => window.__jeu.action("pose:5:6"));
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: 96, combo: 1, poses: 1 });
    expect(await page.evaluate(() => window.__blocks.grille())).toEqual(["X.......", "X.......", "........", "........", "........", "........", "........", "........"]);
    await context.close();
  });

  test("blocage : « Plus de place ! » puis l'écran de fin, score 0", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=blocage");
    await lancer(page);
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu"); // la grille est déjà bloquée, mais « Plus de place ! » reste environ une seconde
    await page.evaluate(() => window.__jeu.avancer(10));
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    await page.evaluate(() => window.__jeu.avancer(40));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([0, 0]);
    await context.close();
  });

  test("plateau-vide : une pose vide la grille (+300), la partie continue", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=plateau-vide");
    await lancer(page);
    await page.evaluate(() => window.__jeu.action("pose:7:6"));
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: 342, combo: 1, poses: 1, fin: null });
    expect((await page.evaluate(() => window.__blocks.grille())).every((l) => l === "........")).toBe(true);
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    await context.close();
  });

  test("avec un serveur, une partie de scénario n'est ni classée ni envoyée", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&scenario=blocage`);
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(60));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toHaveText(CATALOGUE_KIT_FR["kit.fin.archive"]);
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    await context.close();
  });

  test("?seed=AAAA-MM-JJ : le jour d'une date (la suite de ce jour-là), en archive", async ({ browser }) => {
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&seed=${date}`);
      await expect(page.locator("#jeu-archive")).toBeVisible();
      await lancer(page);
      const suite = dailyBlocks(parseDay(date)!).suite;
      expect(await page.evaluate(() => [window.__blocks.piece(), window.__blocks.suivante()])).toEqual([PIECES[suite[0]!]!.nom, PIECES[suite[1]!]!.nom]);
      await context.close();
    }
  });

  test("`?debug&tune` : la rampe réglée change la suite, la page est en archive (une partie réglée n'est jamais envoyée)", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&tune&rampe=100,1`);
    await expect(page.locator("#jeu-archive")).toBeVisible();
    await lancer(page);
    // La page prend la veille du 06/11/2026 : la suite est celle de ce jour avec la rampe 100, 1 (jamais celle du serveur).
    const suite = dailyBlocks(parseDay("2026-11-05")!, BLOCKS_GENERATOR_VERSION, { pente: 100, rangMax: 1 }).suite;
    expect(await page.evaluate(() => [window.__blocks.piece(), window.__blocks.suivante()])).toEqual([PIECES[suite[0]!]!.nom, PIECES[suite[1]!]!.nom]);
    expect(await page.evaluate(() => window.location.search)).toContain("seed=2026-11-05");
    await context.close();
  });
});
