import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Blocks » — les sensations (seed § 7, lot B2) : le scénario `combo` (quatre poses de suite qui effacent chacune une ligne : le combo monte jusqu'à ×4 et le son d'un demi-ton à chaque palier), le HUD (score, combo et ses
// deux carrés), les effets qui ne bloquent jamais la pose suivante, les yeux, le plateau vide et « Plus de place ! ». Les effets sont de l'affichage : la partie, elle, est celle de la simulation (vérifiée ici aussi).
const COMBO = "/?debug&manuel&tactile=0&scenario=combo";
const DEMI_TON = 2 ** (1 / 12);

/** Pose la première pièce restante de la série (l'emplacement le plus à gauche qui n'est pas vide) en (col, ligne). */
const poser = (page: Page, col: number, ligne: number) =>
  page.evaluate(([c, l]) => {
    const e = window.__blocks.pieces().findIndex((p) => p !== null);
    window.__jeu.action(`pose:${e}:${c}:${l}`);
  }, [col, ligne]);

test.describe("Blocks : les sensations", () => {
  test("combo : quatre effacements de suite, le combo monte jusqu'à ×4 (HUD, carrés, annonce) et le son monte d'un demi-ton à chaque palier", async ({ browser }) => {
    const { context, page } = await appareil(browser, COMBO);
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.hud())).toEqual({ score: "0", combo: null, carres: 0, moutarde: false });
    const attendu = [
      { score: 12, combo: "×1", carres: 2, moutarde: false },
      { score: 12 + 22, combo: "×2", carres: 2, moutarde: true },
      { score: 12 + 22 + 32, combo: "×3", carres: 2, moutarde: true },
      { score: 12 + 22 + 32 + 42, combo: "×4", carres: 2, moutarde: true },
    ];
    for (const [i, a] of attendu.entries()) {
      await poser(page, 6, 4 + i);
      expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: a.score, combo: i + 1, comboMax: i + 1 });
      expect(await page.evaluate(() => window.__blocks.hud())).toEqual({ score: String(a.score), combo: a.combo, carres: a.carres, moutarde: a.moutarde });
      await expect(page.locator("#jeu-hud-temps")).toHaveText(`Combo ×${i + 1}`); // ce que lit un lecteur d'écran
    }
    // « Combo ×n ! » s'annonce dès ×2 (pas au premier effacement), avec le dernier palier.
    expect(await page.evaluate(() => window.__blocks.effets().annonces)).toContain("Combo ×4 !");
    // Le son de l'effacement : quatre notes, d'un demi-ton chacune de plus que la précédente.
    const effacements = (await page.evaluate(() => window.__blocks.sons())).filter((x) => x.son === "effacement").map((x) => x.hz);
    expect(effacements).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(effacements[i]! / effacements[i - 1]!).toBeCloseTo(DEMI_TON, 5);
    expect((await page.evaluate(() => window.__blocks.sons())).filter((x) => x.son === "combo")).toHaveLength(3); // un « ting » de plus dès ×2
    await context.close();
  });

  test("les carrés du combo se vident à chaque pose sans effacement, et le combo se perd à la troisième (la plaque se vide, sans punition)", async ({ browser }) => {
    const { context, page } = await appareil(browser, COMBO);
    await lancer(page);
    await poser(page, 6, 4); // ×1
    expect((await page.evaluate(() => window.__blocks.hud())).carres).toBe(2);
    await poser(page, 0, 1); // sans effacement
    expect(await page.evaluate(() => window.__blocks.hud())).toMatchObject({ combo: "×1", carres: 1 });
    await poser(page, 2, 1);
    expect(await page.evaluate(() => window.__blocks.hud())).toMatchObject({ combo: "×1", carres: 0 });
    await poser(page, 4, 1); // la troisième : perdu
    expect(await page.evaluate(() => window.__blocks.hud())).toMatchObject({ combo: null, carres: 0 });
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ combo: 0, comboMax: 1 });
    await expect(page.locator("#jeu-hud-temps")).toHaveText("");
    await context.close();
  });

  test("effacement : la ligne s'illumine (ses yeux se ferment), puis éclate en particules ; le gain flotte à l'endroit de l'effacement", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=presque-plein");
    await lancer(page);
    await page.evaluate(() => window.__jeu.action("pose:0:5:6"));
    const tot = await page.evaluate(() => window.__blocks.effets());
    expect(tot.effacees).toBe(16 + 8 - 2); // deux lignes de 8 et une colonne de 8, sans compter deux fois les deux croisements
    expect(tot.gains).toEqual(["+96"]); // le gain total : ce dont le score monte
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    // Après l'illumination, les cases éclatent : des particules, plus de case en cours d'effacement.
    await expect.poll(() => page.evaluate(() => window.__blocks.effets().particules), { timeout: 2000 }).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__blocks.effets().effacees), { timeout: 2000 }).toBe(0);
    // Tout finit par disparaître.
    await expect.poll(() => page.evaluate(() => window.__blocks.effets()), { timeout: 4000 }).toMatchObject({ particules: 0, gains: [], annonces: [] });
    await context.close();
  });

  test("les effets ne bloquent jamais la pose suivante : on saisit la pièce et on la pose pendant que les particules finissent", async ({ browser }) => {
    const { context, page } = await appareil(browser, COMBO);
    await lancer(page);
    await poser(page, 6, 4);
    await expect.poll(() => page.evaluate(() => window.__blocks.effets().effacees + window.__blocks.effets().particules)).toBeGreaterThan(0); // des effets sont en cours
    // Sans attendre : on saisit la deuxième pièce de la série à la souris, on la glisse sur la ligne 5 et on la pose.
    const pose = await page.evaluate(() => {
      const r = window.__blocks.repos(1)!;
      const d = window.__blocks.disposition();
      return { de: { x: r.rect.x + r.cote / 2, y: r.rect.y + r.cote / 2 }, vers: { x: d.grille.x + 6.5 * d.cote, y: d.grille.y + 5.5 * d.cote } };
    });
    await page.mouse.move(pose.de.x, pose.de.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).not.toBeNull();
    await page.mouse.move(pose.vers.x, pose.vers.y, { steps: 4 });
    const pendant = await page.evaluate(() => window.__blocks.effets());
    await page.mouse.up();
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 2, combo: 2 });
    expect(pendant.effacees + pendant.particules + pendant.gains.length).toBeGreaterThan(0); // les effets de la première pose couraient encore
    await context.close();
  });

  test("les yeux : une paire par pièce posée, qui regardent la pièce qu'on déplace", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=plateau-vide");
    await lancer(page);
    await poser(page, 0, 0);
    await poser(page, 0, 3);
    await page.waitForTimeout(100);
    expect((await page.evaluate(() => window.__blocks.yeux())).paires).toBe(2);
    // Au repos : le regard est droit devant (rien à regarder).
    expect((await page.evaluate(() => window.__blocks.yeux())).regard).toEqual({ x: 0, y: 0 });
    // On saisit la dernière pièce de la série (la barre de 3) et on la tient en bas à droite, sur une place où elle tient : le regard du dernier œil dessiné se tourne vers elle.
    const r = await page.evaluate(() => {
      const rp = window.__blocks.repos(2)!;
      const d = window.__blocks.disposition();
      return { de: { x: rp.rect.x + rp.cote / 2, y: rp.rect.y + rp.cote / 2 }, vers: { x: d.grille.x + 4.5 * d.cote, y: d.grille.y + 5.5 * d.cote } };
    });
    await page.mouse.move(r.de.x, r.de.y);
    await page.mouse.down();
    await page.mouse.move(r.vers.x, r.vers.y, { steps: 4 });
    await page.waitForTimeout(100);
    const regard = (await page.evaluate(() => window.__blocks.yeux())).regard!;
    expect(Math.hypot(regard.x, regard.y)).toBeGreaterThan(0.2);
    expect(regard.x).toBeGreaterThan(0); // vers la droite…
    expect(regard.y).toBeLessThan(0); // …et vers le bas (le repère de la pièce a y vers le haut)
    await page.mouse.up();
    await context.close();
  });

  test("plateau vide : l'annonce, le +300 (dans le gain affiché), les sons de l'effacement et du plateau vide", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=plateau-vide");
    await lancer(page);
    await page.evaluate(() => window.__jeu.action("pose:0:7:6"));
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: 2 + 40 + 300 });
    expect((await page.evaluate(() => window.__blocks.effets())).gains).toEqual(["+342"]);
    await expect.poll(() => page.evaluate(() => window.__blocks.effets().annonces), { timeout: 2000 }).toEqual(["Plateau vide ! +300"]);
    expect((await page.evaluate(() => window.__blocks.sons())).map((x) => x.son)).toEqual(expect.arrayContaining(["pose", "effacement", "plateauVide"]));
    await expect.poll(() => page.evaluate(() => window.__blocks.effets().particules)).toBeGreaterThan(8); // la célébration : des confettis sur toute la grille
    await context.close();
  });

  test("plus de place : « Plus de place ! », le son de la fin, puis l'écran de fin (les trois pièces, grisées, restent sur le plateau)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=blocage");
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.etat().fin)).toBe("bloquee");
    await page.evaluate(() => window.__jeu.avancer(100));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await context.close();
  });

  test("mouvements réduits : pas de particules, la partie est la même", async ({ browser }) => {
    const { context, page } = await appareil(browser, COMBO);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await poser(page, 6, 4);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__blocks.effets().particules)).toBe(0);
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: 12, combo: 1 });
    await context.close();
  });
});
