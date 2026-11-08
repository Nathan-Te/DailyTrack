import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { dailyBlocks, grilleEnTexte, medailleDe, Partie, PIECES_DU_DIAMANT, PREMIER_JOUR_BLOCKS, SEUILS_MEDAILLES, THEMES_BLOCKS, themeDuJour } from "@cdj/blocks-sim";
import { partieDuDiamant } from "@cdj/blocks-sim/diamant";
import { parseDay } from "@cdj/core";
import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";
import { PALETTE_PORT } from "@cdj/visuels/blocs";
import { PALETTES } from "@cdj/visuels/blocs/themes";
import { jouerGlouton } from "@cdj/blocks-sim/glouton";
import { appareil, JOUR, lancer, poserLesActions } from "./appareil";

// « Blocks » — le bot Diamant, les médailles et les thèmes du jour (lot B3). `&bot` : le bot joue la suite du jour à la place du joueur (essai local, jamais classé), son score est le Diamant des médailles ;
// `?theme=` : les six thèmes en un clic (palette de la scène, nom et phrase de l'accueil). Les tests de B1 et B2 (glisser, sensations, scénarios…) sont ailleurs et inchangés.
const jour = parseDay(JOUR)!;
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PALETTES_TOUTES = { port: PALETTE_PORT, ...PALETTES };

test.describe("Blocks : le bot Diamant (&bot)", () => {
  test("le bot joue la suite du jour à 3 poses par seconde (un tick de 30 Hz sur dix), sans qu'on touche à rien", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&bot`);
    await expect(page.locator("#jeu-archive")).toBeVisible(); // « Partie d'essai : non classée. »
    await expect(page.locator("#jeu-archive")).toHaveText(CATALOGUE_KIT_FR["kit.fin.essai"]);
    await lancer(page);
    expect((await page.evaluate(() => window.__blocks.etat())).poses).toBe(0);
    await page.evaluate(() => window.__jeu.avancer(30)); // une seconde
    expect((await page.evaluate(() => window.__blocks.etat())).poses).toBe(3);
    await page.evaluate(() => window.__jeu.avancer(60)); // deux de plus
    expect((await page.evaluate(() => window.__blocks.etat())).poses).toBe(9);
    // Ce sont bien les poses du Diamant (celles de la simulation, Node), dans l'ordre.
    const bot = partieDuDiamant(dailyBlocks(jour));
    const attendue = new Partie(dailyBlocks(jour));
    for (const a of bot.actions.slice(0, 9)) attendue.jouerAction(a);
    expect(await page.evaluate(() => window.__blocks.grille())).toEqual(grilleEnTexte(attendue.grille));
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: attendue.score, combo: attendue.combo, poses: 9 });
    await context.close();
  });

  test("la partie du bot s'arrête après PIECES_DU_DIAMANT pièces (ou plus tôt, s'il meurt) : l'écran de fin montre son score et les quatre seuils, la partie reste non classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&bot=30`);
    await lancer(page);
    const contenu = dailyBlocks(jour);
    const bot = partieDuDiamant(contenu);
    expect(bot.resultat.poses).toBeLessThanOrEqual(PIECES_DU_DIAMANT);
    await page.evaluate(() => window.__jeu.avancer(30 * 800));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([bot.resultat.score, bot.resultat.combo]);
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: bot.resultat.poses });
    const s = SEUILS_MEDAILLES;
    const medailles = await page.locator(".jeu-medailles").innerText();
    for (const v of [s.author, s.gold, s.silver, s.bronze]) expect(medailles).toContain(String(v));
    // Lot B8c : ces seuils sont ceux de la FICHE du jeu (`medailles.seuils`), lus tels quels par l'écran de fin.
    const f = (JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as { medailles: { seuils: Record<string, number> } }).medailles.seuils;
    for (const v of [f.diamant, f.or, f.argent, f.bronze]) expect(medailles).toContain(String(v));
    expect(s.bronze).toBeLessThan(s.silver);
    expect(s.silver).toBeLessThan(s.gold);
    expect(s.gold).toBeLessThan(s.author);
    await expect(page.locator("#jeu-fin-rang")).toHaveText(CATALOGUE_KIT_FR["kit.fin.essai"]); // ni classée, ni envoyée
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    await context.close();
  });

  test("un jour passé : `?seed=AAAA-MM-JJ&bot` joue la suite de ce jour-là", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&seed=2026-11-02&bot=30`);
    await lancer(page);
    const bot = partieDuDiamant(dailyBlocks(PREMIER_JOUR_BLOCKS));
    await page.evaluate(() => window.__jeu.avancer(30 * 800));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([bot.resultat.score, bot.resultat.combo]);
    await context.close();
  });

  test("sans `&bot`, rien ne joue à la place du joueur", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0`);
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(300));
    expect((await page.evaluate(() => window.__blocks.etat())).poses).toBe(0);
    await context.close();
  });
});

test.describe("Blocks : les médailles de l'écran de fin", () => {
  test("une partie du glouton, jouée à la main, montre les vrais seuils (plus de zéros) et sa médaille", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&seed=2026-11-02`);
    await lancer(page);
    const contenu = dailyBlocks(PREMIER_JOUR_BLOCKS);
    const glouton = jouerGlouton(contenu);
    await poserLesActions(page, glouton.actions);
    await expect(page.locator("#jeu-fin")).toBeVisible();
    const s = SEUILS_MEDAILLES;
    const medailles = await page.locator(".jeu-medailles").innerText();
    for (const v of [s.author, s.gold, s.silver, s.bronze]) expect(medailles).toContain(String(v));
    // Lot B8c : ces seuils sont ceux de la FICHE du jeu (`medailles.seuils`), lus tels quels par l'écran de fin.
    const f = (JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as { medailles: { seuils: Record<string, number> } }).medailles.seuils;
    for (const v of [f.diamant, f.or, f.argent, f.bronze]) expect(medailles).toContain(String(v));
    expect(medailles).not.toMatch(/\b0\b/);
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([glouton.resultat.score, glouton.resultat.combo]);
    // Un score en dessous du Diamant : « encore … » vers la médaille suivante.
    if (medailleDe([glouton.resultat.score], s) !== "author") await expect(page.locator("#jeu-fin-encore")).toBeVisible();
    await context.close();
  });
});

test.describe("Blocks : les thèmes du jour", () => {
  for (const th of THEMES_BLOCKS) {
    test(`?theme=${th} : le nom et la phrase du thème à l'accueil, la palette du thème sur la scène`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&theme=${th}`);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(th);
      await expect(page.locator(".jeu-replique")).not.toBeEmpty();
      await lancer(page);
      // Le ciel du thème est le fond de toute la scène : le pixel (2, 2) du canevas.
      // La première image est peinte à l'image d'écran suivante : on l'attend (le canevas vaut 0, 0, 0, 0 avant), sans relâcher l'assertion.
      const lire = () => page.evaluate(() => [...document.querySelector<HTMLCanvasElement>(".blocks-plateau")!.getContext("2d")!.getImageData(2, 2, 1, 1).data]);
      await expect.poll(lire).toEqual([...rgb(PALETTES_TOUTES[th].ciel), 255]);
      await context.close();
    });
  }

  test("sans `?theme=`, le thème est celui du jour (le sac commun) ; un thème inconnu est ignoré", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0`);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(themeDuJour(jour));
    await context.close();
    const autre = await appareil(browser, `/?debug&manuel&tactile=0&theme=clair`);
    expect(await autre.page.evaluate(() => document.documentElement.dataset.theme)).toBe(themeDuJour(jour));
    await autre.context.close();
  });

  test("un thème forcé ne change pas le tirage, mais la partie est un essai local, jamais classé (le kit lit `?theme=`, lot « manques de Blocks »)", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&theme=nuit`);
    await expect(page.locator("#jeu-archive")).toHaveText("Partie d'essai : non classée.");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("nuit");
    await lancer(page);
    const premiere = new Partie(dailyBlocks(jour)).pieces.map((p) => p!.nom);
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(premiere); // la première série (la même pour tous : grille vide), aucune pièce suivante
    await context.close();
  });
});
