import { colonneDe, dailyBlocks, grilleEnTexte, ligneDe, Partie } from "@cdj/blocks-sim";
import { jouerDiamant } from "@cdj/blocks-sim/diamant";
import { jouerGlouton } from "@cdj/blocks-sim/glouton";
import { parseDay } from "@cdj/core";
import { expect, test, type Page } from "@playwright/test";
import { appareil, JOUR, lancer, poserLesActions } from "./appareil";

// « Blocks » — le FANTÔME (lot B4, seed § 5) : le bouton du kit est EN JEU, il montre en transparence la grille d'une autre partie du jour au même rang de pièce que toi, avec son score et l'écart ; sa partie finie, sa
// dernière grille estompée (« Fin du fantôme ») ; il ne prend jamais les gestes. Deux chemins : `?scenario=fantome` (la partie du bot, tout de suite, sans avoir joué) et le chemin du kit (ma meilleure partie, puis le Diamant,
// débloqués en finissant le jour). Le second se joue sur le serveur d'APERÇU (Blocks en `preview`, port 8800, clé d'aperçu) : ses envois sont rangés à part, ils ne touchent pas le classement du serveur d'essai.
const APERCU = "http://127.0.0.1:8800";
const CLE = "cle-apercu-blocks-essai-0123456789";
const jour = parseDay(JOUR)!;
const contenu = dailyBlocks(jour);
const diamant = jouerDiamant(contenu);
const glouton = jouerGlouton(contenu);

/** L'état du jeu de référence (Node) après `n` poses d'une partie. */
function apres(actions: readonly number[], n: number): { grille: string[]; score: number } {
  const p = new Partie(contenu);
  for (const a of actions.slice(0, n)) p.poser(colonneDe(a), ligneDe(a));
  return { grille: grilleEnTexte(p.grille), score: p.score };
}
const fantome = (page: Page) => page.evaluate(() => window.__blocks.fantome());

test.describe("Blocks : le fantôme", () => {
  test("`?scenario=fantome` : la partie du bot est là dès la première pièce, sa plaque (score et écart) est dans l'écran, et le bouton fantôme du kit est visible en jeu", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=fantome`);
    await lancer(page);
    // Pas jouée avant, et pourtant : le fantôme est la partie du Diamant, au rang 0 (grille vide, 0 point).
    expect(await fantome(page)).toMatchObject({ score: 0, ecart: "=", fini: false, rang: 0, poses: diamant.actions.length });
    expect((await fantome(page))!.grille.every((l) => l === "........")).toBe(true);
    // La plaque du fantôme existe, dans l'écran, sans recouvrir la grille, le score, le combo ni les boutons du kit.
    const d = await page.evaluate(() => window.__blocks.disposition());
    const f = d.fantome!;
    expect(f).not.toBeNull();
    const separes = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    for (const autre of [d.grille, d.score, d.combo, d.boutons]) expect(separes(f, autre)).toBe(true);
    // Le bouton fantôme est EN JEU (pas seulement dans la pause) : visible, cible tactile, dans l'écran, au-dessus de la scène.
    const bouton = page.locator("#jeu-hud-fantome");
    await expect(bouton).toBeVisible();
    const boite = (await bouton.boundingBox())!;
    const vue = page.viewportSize()!;
    expect(boite.width).toBeGreaterThanOrEqual(40);
    expect(boite.x + boite.width).toBeLessThanOrEqual(vue.width);
    expect(boite.y).toBeGreaterThanOrEqual(0);
    await expect(page.locator("#jeu-pause")).toBeHidden(); // la pause n'est pas ouverte : on est bien en jeu
    await context.close();
  });

  test("à chaque pose du joueur, le fantôme montre sa grille et son score AU MÊME RANG, avec l'écart ; le lecteur d'écran en parle", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=fantome`);
    await lancer(page);
    // Le joueur joue la partie du glouton ; le fantôme est celle du Diamant.
    let faites = 0;
    for (const n of [1, 2, 5, 12]) {
      await poserLesActions(page, glouton.actions.slice(faites, n), false);
      faites = n;
      const joueur = apres(glouton.actions, n);
      const bot = apres(diamant.actions, n);
      const f = (await fantome(page))!;
      expect(f.rang, `rang ${n}`).toBe(n);
      expect(f.grille).toEqual(bot.grille);
      expect(f.score).toBe(bot.score);
      expect(f.fini).toBe(false);
      // L'écart est celui du joueur sur le fantôme, au format de la langue.
      const diff = joueur.score - bot.score;
      expect(f.ecart.replace(/[\u00a0\u202f]/g, "")).toBe(diff === 0 ? "=" : `${diff > 0 ? "+" : "\u2212"}${Math.abs(diff)}`);
    }
    // Le lecteur d'écran lit le fantôme et l'écart (le texte du kit `#jeu-hud-temps`, caché à la vue).
    expect(await page.locator("#jeu-hud-temps").textContent()).toContain("Fantôme");
    await context.close();
  });

  test("le bouton fantôme cache le fantôme d'essai, puis le remontre ; la grille du joueur ne bouge pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=fantome`);
    await lancer(page);
    const avant = await page.evaluate(() => window.__blocks.disposition().grille);
    await page.locator("#jeu-hud-fantome").click();
    expect(await fantome(page)).toBeNull();
    expect(await page.evaluate(() => window.__blocks.disposition().fantome)).toBeNull();
    expect(await page.evaluate(() => window.__blocks.disposition().grille)).toEqual(avant);
    await page.locator("#jeu-hud-fantome").click();
    expect(await fantome(page)).not.toBeNull();
    await context.close();
  });

  test("le fantôme ne prend jamais les gestes : on pose à travers lui, à la souris", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=fantome`);
    await lancer(page);
    // Deux poses, la seconde sur des cases que le fantôme (au rang 1) occupe : choisies avec la simulation.
    const g1 = diamant.actions[0]!;
    const fantome1 = apres(diamant.actions, 1).grille;
    let choix: { p1: number } | null = null;
    for (let p1 = 0; p1 < 64 && !choix; p1++) {
      const p = new Partie(contenu);
      if (p.poser(colonneDe(p1), ligneDe(p1)) === null || !p.legale(colonneDe(g1), ligneDe(g1))) continue;
      p.poser(colonneDe(g1), ligneDe(g1));
      if (grilleEnTexte(p.grille).some((l, i) => [...l].some((c, j) => c === "X" && fantome1[i]![j] === "X"))) choix = { p1 };
    }
    expect(choix, "une première pose telle que la seconde recouvre le fantôme").not.toBeNull();
    const glisser = async (action: number): Promise<void> => {
      const repos = (await page.evaluate(() => window.__blocks.repos()))!;
      const d = await page.evaluate(() => window.__blocks.disposition());
      await page.mouse.move(repos.rect.x + repos.cote * 0.5, repos.rect.y + repos.cote * 0.5);
      await page.mouse.down();
      await page.mouse.move(d.grille.x + (colonneDe(action) + 0.5) * d.cote, d.grille.y + (ligneDe(action) + 0.5) * d.cote, { steps: 8 });
      await page.mouse.up();
    };
    await glisser(choix!.p1);
    expect((await page.evaluate(() => window.__blocks.etat())).poses).toBe(1);
    expect((await fantome(page))!.grille).toEqual(fantome1); // le fantôme est au rang 1 : sa première pièce est dessinée
    await glisser(g1); // la souris pose à travers ses cases
    expect((await page.evaluate(() => window.__blocks.etat())).poses).toBe(2);
    await context.close();
  });
});

test.describe("Blocks : le fantôme du kit (ma meilleure partie, puis le Diamant), sur le serveur d'aperçu", () => {
  test("finir le jour débloque « ma meilleure » puis « Diamant » ; au même rang, puis « Fin du fantôme » quand sa partie s'arrête avant celle du joueur", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${APERCU}&debug&manuel&tactile=0&apercu=${CLE}`);
    await expect(page.locator('[data-apercu="cle"]')).toBeVisible(); // le jeu est en aperçu, on y joue par son lien
    await lancer(page);
    // Avant d'avoir fini le jour, rien à débloquer : le bouton reste sur « aucun ».
    await page.locator("#jeu-hud-fantome").click();
    await expect(page.locator("#jeu-hud-fantome")).toHaveAttribute("data-etat", "aucun");
    expect(await fantome(page)).toBeNull();
    // On finit le jour avec la partie du glouton (courte) : c'est ma meilleure partie.
    await poserLesActions(page, glouton.actions);
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    // « Ma meilleure » : la partie du glouton, au même rang.
    await page.locator("#jeu-hud-fantome").click();
    await expect(page.locator("#jeu-hud-fantome")).toHaveAttribute("data-etat", "meilleure");
    expect(await fantome(page)).toMatchObject({ score: 0, rang: 0, poses: glouton.actions.length, fini: false });
    await poserLesActions(page, diamant.actions.slice(0, 7), false);
    const f7 = (await fantome(page))!;
    expect(f7).toMatchObject({ rang: 7, score: apres(glouton.actions, 7).score, fini: false });
    expect(f7.grille).toEqual(apres(glouton.actions, 7).grille);
    // Sa partie finie : le joueur, plus loin, voit sa dernière grille (estompée) et « Fin du fantôme ».
    const long = diamant.actions;
    expect(long.length).toBeGreaterThan(glouton.actions.length + 3);
    await poserLesActions(page, long.slice(7, glouton.actions.length + 3), false);
    const fin = (await fantome(page))!;
    expect(fin.fini).toBe(true);
    expect(fin.score).toBe(glouton.resultat.score);
    expect(fin.grille).toEqual(apres(glouton.actions, glouton.actions.length).grille);
    // « Diamant » : la partie du bot, rejouée, au même rang.
    await page.locator("#jeu-hud-fantome").click();
    await expect(page.locator("#jeu-hud-fantome")).toHaveAttribute("data-etat", "diamant");
    const bot = (await fantome(page))!;
    expect(bot).toMatchObject({ poses: diamant.actions.length, fini: false, rang: glouton.actions.length + 3, score: apres(diamant.actions, glouton.actions.length + 3).score });
    // Et on revient à « aucun ».
    await page.locator("#jeu-hud-fantome").click();
    await expect(page.locator("#jeu-hud-fantome")).toHaveAttribute("data-etat", "aucun");
    expect(await fantome(page)).toBeNull();
    expect(await page.evaluate(() => window.__blocks.disposition().fantome)).toBeNull();
    await context.close();
  });
});
