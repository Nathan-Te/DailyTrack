import { expect, test } from "@playwright/test";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, PIECES } from "@cdj/blocks-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";
import { API, appareil, JOUR, lancer } from "./appareil";

// « Blocks » — les scénarios d'essai (seed § 9), locaux et jamais classés : `?scenario=presque-plein` (une pose efface 2 lignes et 1 colonne), `blocage` (la pièce ne rentre nulle part : fin immédiate), `plateau-vide`
// (une pose vide la grille) ; `suivantes` (lot B7 : la pièce suivante à sa vraie taille). Une partie de scénario est un essai (`classable` de la définition, lot « manques de Blocks » : plus de passage en archive) : elle ne se classe pas et ne s'envoie pas, même avec un serveur.
/** Lot B7 — la suite de `?scenario=suivantes` (les douze premières pièces). */
const NOMS_SUITE = ["domino-0", "carre3-0", "coin-0", "barre5-0", "carre2-0", "grandl-0", "domino-1", "barre5-1", "coin-2", "grandt-0", "barre4-0", "carre3-0"];
/** La première place libre (colonne, ligne) de la boîte de cette pièce dans la grille en texte (`X` = occupée). */
function premierePlace(grille: string[], p: (typeof PIECES)[number]): [number, number] | null {
  for (let l = 0; l + p.hauteur <= 8; l++) {
    for (let c = 0; c + p.largeur <= 8; c++) {
      const libre = p.rangees.every((octet, k) => [...Array(p.largeur).keys()].every((x) => !(octet & (1 << x)) || grille[l + k]![c + x] === "."));
      if (libre) return [c, l];
    }
  }
  return null;
}

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
    await expect(page.locator("#jeu-fin-rang")).toHaveText(CATALOGUE_KIT_FR["kit.fin.essai"]);
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    await context.close();
  });

  // Lot B7 — `?scenario=suivantes` : une grille vide et une suite qui alterne petites et grosses pièces ; à chaque pose, la pièce du moment est à la taille des cases de la grille et la suivante à 60 %, la même échelle pour toutes.
  for (const [largeur, hauteur, tactile] of [[1280, 720, 0], [390, 844, 1]] as const) {
    test(`suivantes @ ${largeur} × ${hauteur} : la suivante garde la même échelle (60 % des cases) quelle que soit sa taille, la pièce du moment la taille des cases, le gabarit de 5 × 5 est derrière`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=${tactile}&scenario=suivantes`, true, false);
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.waitForSelector("#jeu-jouer", { state: "attached" });
      await lancer(page);
      const d = await page.evaluate(() => window.__blocks.disposition());
      const vues: string[] = [];
      for (let i = 0; i < 6; i++) {
        const [nom, suivante, repos, reposS] = await page.evaluate(() => [window.__blocks.piece(), window.__blocks.suivante(), window.__blocks.repos(), window.__blocks.reposSuivante()] as const);
        expect(nom).toBe(NOMS_SUITE[i]);
        expect(suivante).toBe(NOMS_SUITE[i + 1]);
        vues.push(suivante!);
        const p = PIECES.find((x) => x.nom === nom)!;
        const s = PIECES.find((x) => x.nom === suivante)!;
        // La pièce du moment : la taille exacte des cases de la grille, tout entière dans « Ta pièce ». La suivante : 60 % des cases, tout entière dans le gabarit de 5 × 5 (lui-même dans « Suivante »).
        expect(repos!.cote).toBeCloseTo(d.cote, 5);
        expect(repos!.rect.w).toBeCloseTo(p.largeur * d.cote, 3);
        expect(reposS!.cote).toBeCloseTo(d.cote * 0.6, 5);
        expect(reposS!.rect.w).toBeCloseTo(s.largeur * d.cote * 0.6, 3);
        expect(reposS!.rect.h).toBeCloseTo(s.hauteur * d.cote * 0.6, 3);
        const dedans = (g: { x: number; y: number; w: number; h: number }, r: { x: number; y: number; w: number; h: number }): boolean => r.x >= g.x - 0.5 && r.y >= g.y - 0.5 && r.x + r.w <= g.x + g.w + 0.5 && r.y + r.h <= g.y + g.h + 0.5;
        expect(dedans(d.main, repos!.rect), `${nom} dans « Ta pièce »`).toBe(true);
        expect(dedans(d.gabarit, reposS!.rect), `${suivante} dans le gabarit`).toBe(true);
        expect(dedans(d.suivante, d.gabarit), "le gabarit est dans « Suivante »").toBe(true);
        expect(Math.abs(reposS!.rect.x + reposS!.rect.w / 2 - (d.gabarit.x + d.gabarit.w / 2)), "centrée dans le gabarit").toBeLessThanOrEqual(0.5);
        if (process.env.CAPTURES && [0, 2, 3].includes(i)) await page.screenshot({ path: `${process.env.CAPTURES}/suivantes-${largeur}x${hauteur}-${i}.png` });
        // On pose à la première place libre : la grille est vide au départ, il y en a toujours une.
        const grille = await page.evaluate(() => window.__blocks.grille());
        const place = premierePlace(grille, p);
        expect(place, `une place pour ${nom}`).not.toBeNull();
        await page.evaluate(([c, l]) => window.__jeu.action(`pose:${c}:${l}`), place!);
      }
      expect(new Set(vues).size, "la suite alterne vraiment des tailles différentes").toBe(6);
      expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
      await context.close();
    });
  }

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

  test("`?debug&tune` : la rampe réglée change la suite du jour d'aujourd'hui, la partie est un essai (jamais classée ni envoyée), sans passer en archive", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&tune&rampe=100,1`);
    await expect(page.locator("#jeu-archive")).toHaveText(CATALOGUE_KIT_FR["kit.fin.essai"]);
    await lancer(page);
    // Le jour reste celui d'aujourd'hui (06/11/2026) : la suite est celle de ce jour avec la rampe 100, 1 (jamais celle du serveur).
    const suite = dailyBlocks(parseDay(JOUR)!, BLOCKS_GENERATOR_VERSION, { pente: 100, rangMax: 1 }).suite;
    expect(await page.evaluate(() => [window.__blocks.piece(), window.__blocks.suivante()])).toEqual([PIECES[suite[0]!]!.nom, PIECES[suite[1]!]!.nom]);
    expect(await page.evaluate(() => window.location.search)).not.toContain("seed="); // l'adresse n'est plus réécrite
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    await context.close();
  });
});
