import { expect, test } from "@playwright/test";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, PIECES } from "@cdj/blocks-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";
import { API, appareil, JOUR, lancer } from "./appareil";

// « Blocks » — les scénarios d'essai (seed § 9), locaux et jamais classés : `?scenario=presque-plein` (une pose efface 2 lignes et 1 colonne), `blocage` (aucune des trois pièces ne rentre : fin immédiate), `plateau-vide`
// (une pose vide la grille), `combo` et `ordre` (lot B8 : une série où l'ordre des trois pièces décide de tout). `suivantes` (lot B7) n'existe plus : il n'y a plus de pièce suivante. Une partie de scénario est un essai (`classable` de la définition, lot « manques de Blocks » : plus de passage en archive) : elle ne se classe pas et ne s'envoie pas, même avec un serveur.
test.describe("Blocks : les scénarios", () => {
  test("presque-plein : une pose, 2 lignes et 1 colonne, 96 points, combo 1", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=presque-plein");
    await expect(page.locator("#jeu-archive")).toBeVisible();
    await lancer(page);
    await page.evaluate(() => window.__jeu.action("pose:0:5:6"));
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
    await page.evaluate(() => window.__jeu.action("pose:0:7:6"));
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
    await expect(page.locator("#jeu-fin-rang")).toHaveText(CATALOGUE_KIT_FR["kit.fin.essai"]);
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    await context.close();
  });

  // Lot B8 — `?scenario=ordre` : une série où l'ordre décide de tout. Le carré d'abord (emplacement 2), puis le domino (1), puis le coin (0) : deux lignes s'effacent et la série suivante arrive. Dans un autre ordre, la troisième pièce est grisée
  // et la partie finit (« Plus de place ! »).
  test("ordre, dans le bon ordre : le carré, le domino, le coin — deux lignes s'effacent, la série suivante arrive, la partie continue", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=ordre");
    await expect(page.locator("#jeu-archive")).toBeVisible(); // un essai : jamais classé
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["coin-1", "domino-1", "carre2-0"]);
    expect(await page.evaluate(() => window.__blocks.grisees())).toEqual([false, false, false]); // les trois se saisissent au départ
    await page.evaluate(() => window.__jeu.action("pose:2:0:6")); // le carré dans la poche : la ligne 7 s'efface
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ combo: 1, poses: 1 });
    await page.evaluate(() => window.__jeu.action("pose:1:7:6")); // le domino debout : la ligne 6 s'efface
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ combo: 2, poses: 2, score: 4 + 10 + 2 + 20 });
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["coin-1", null, null]);
    await page.evaluate(() => window.__jeu.action("pose:0:0:6")); // le coin, où l'on veut
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 3, serie: 1, fin: null });
    expect((await page.evaluate(() => window.__blocks.pieces())).every((x) => x !== null)).toBe(true);
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    await context.close();
  });

  test("ordre, dans le mauvais ordre : le coin d'abord — le domino et le carré sont grisés, « Plus de place ! », l'écran de fin ; on ne les saisit pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=ordre");
    await lancer(page);
    await page.evaluate(() => window.__jeu.action("pose:0:0:6")); // le coin dans la poche
    expect(await page.evaluate(() => window.__blocks.grisees())).toEqual([false, true, true]);
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 1, fin: "bloquee" });
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual([null, "domino-1", "carre2-0"]); // grisées, elles restent à l'écran
    // Une pièce grisée ne se saisit pas.
    const d = await page.evaluate(() => window.__blocks.disposition());
    await page.mouse.move(d.centresMain[2]!.x, d.centresMain[2]!.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await page.mouse.up();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu"); // « Plus de place ! » reste environ une seconde
    await page.evaluate(() => window.__jeu.avancer(60));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await context.close();
  });

  test("ordre : une nouvelle série arrive avec une entrée courte qui ne bloque jamais le geste suivant", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=ordre");
    await lancer(page);
    for (const a of ["pose:2:0:6", "pose:1:7:6", "pose:0:0:6"]) await page.evaluate((x) => window.__jeu.action(x), a);
    expect(await page.evaluate(() => window.__blocks.arrivee())).toBeLessThan(1); // l'entrée commence…
    // …et on saisit déjà une pièce : sa zone est à sa place dès la première image.
    const centre = (await page.evaluate(() => window.__blocks.disposition())).centresMain[0]!;
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).not.toBeNull();
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.__blocks.arrivee()), { timeout: 2000 }).toBe(1);
    await context.close();
  });

  test("« mouvements réduits » : les pièces d'une nouvelle série sont là tout de suite, sans entrée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=ordre");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    for (const a of ["pose:2:0:6", "pose:1:7:6", "pose:0:0:6"]) await page.evaluate((x) => window.__jeu.action(x), a);
    expect(await page.evaluate(() => window.__blocks.arrivee())).toBe(1);
    await context.close();
  });

  test("?seed=AAAA-MM-JJ : le jour d'une date (la suite de ce jour-là), en archive", async ({ browser }) => {
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&seed=${date}`);
      await expect(page.locator("#jeu-archive")).toBeVisible();
      await lancer(page);
      const suite = dailyBlocks(parseDay(date)!).suite;
      expect(await page.evaluate(() => window.__blocks.pieces())).toEqual([0, 1, 2].map((k) => PIECES[suite[k]!]!.nom));
      await context.close();
    }
  });

  test("`?debug&tune` : la rampe réglée change la suite du jour d'aujourd'hui, la partie est un essai (jamais classée ni envoyée), sans passer en archive", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&tune&rampe=100,1`);
    await expect(page.locator("#jeu-archive")).toHaveText(CATALOGUE_KIT_FR["kit.fin.essai"]);
    await lancer(page);
    // Le jour reste celui d'aujourd'hui (06/11/2026) : la suite est celle de ce jour avec la rampe 100, 1 (jamais celle du serveur).
    const suite = dailyBlocks(parseDay(JOUR)!, BLOCKS_GENERATOR_VERSION, { pente: 100, rangMax: 1 }).suite;
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual([0, 1, 2].map((k) => PIECES[suite[k]!]!.nom));
    expect(await page.evaluate(() => window.location.search)).not.toContain("seed="); // l'adresse n'est plus réécrite
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    await context.close();
  });
});
