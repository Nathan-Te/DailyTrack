import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Blocks » — LE geste (seed § 6) : glisser-déposer à la souris et au doigt, pièce flottante au-dessus du point touché, ombre aimantée, lignes et colonnes qui seraient effacées surlignées, relâcher hors d'un endroit valide
// renvoie la pièce ; clavier : déplacer l'ombre case par case, puis poser. Le scénario « presque-plein » (une pose du rectangle 3 × 2 en colonne 5, ligne 6 efface 2 lignes et 1 colonne) donne une pose connue.
const PRESQUE_PLEIN = "/?debug&manuel&tactile=0&scenario=presque-plein";

/** Le point de la page où il faut poser le doigt pour que le coin haut-gauche de la boîte de la pièce vise la case (col, ligne). */
async function viser(page: Page, col: number, ligne: number, decalage: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ col, ligne, decalage }) => {
      const d = window.__blocks.disposition();
      const nom = window.__blocks.piece()!;
      const largeur = nom.startsWith("rect-0") ? 3 : 1;
      const hauteur = nom.startsWith("rect-0") ? 2 : 1;
      return { x: d.grille.x + (col + largeur / 2) * d.cote, y: d.grille.y + (ligne + hauteur) * d.cote + decalage * d.cote };
    },
    { col, ligne, decalage },
  );
}

test.describe("Blocks : le geste", () => {
  test("souris : saisir, la pièce grossit à la taille des cases et flotte au-dessus du pointeur, l'ombre s'aimante, les lignes s'allument, relâcher pose", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    expect(await page.evaluate(() => window.__blocks.piece())).toBe("rect-0");
    await page.mouse.move(d.centreMain.x, d.centreMain.y);
    await page.mouse.down();
    const cible = await viser(page, 5, 6, 0.4);
    await page.mouse.move(cible.x + 3, cible.y + 3, { steps: 8 }); // un peu à côté : l'ombre s'aimante à la case la plus proche
    await page.waitForTimeout(150);
    const s = await page.evaluate(() => window.__blocks.saisie());
    expect(s).not.toBeNull();
    expect(s!.cote).toBeCloseTo(d.cote, 0); // elle a grossi à la taille des cases
    expect(s!.piece.y + s!.piece.h).toBeLessThan(s!.doigt.y); // elle flotte au-dessus du pointeur
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ col: 5, ligne: 6, legale: true });
    expect(await page.evaluate(() => window.__blocks.surlignage())).toEqual({ lignes: 0b11000000, colonnes: 0b10000000 }); // 2 lignes et 1 colonne s'allument
    await page.mouse.up();
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    expect(await page.evaluate(() => window.__blocks.piece())).toBe("mono-0");
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await context.close();
  });

  test("relâcher hors d'un endroit valide renvoie la pièce à sa place, sans pénalité", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    await page.mouse.move(d.centreMain.x, d.centreMain.y);
    await page.mouse.down();
    await page.mouse.move(d.grille.x + d.cote * 0.3, d.grille.y + d.cote * 3, { steps: 6 }); // recouvre la colonne 0 déjà occupée et déborde : aucune position légale à moins d'une case
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.__blocks.ombre())).toBeNull();
    await page.mouse.up();
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: 0, poses: 0 });
    expect(await page.evaluate(() => window.__blocks.piece())).toBe("rect-0");
    // Et la pièce se reprend aussitôt.
    await page.mouse.move(d.centreMain.x, d.centreMain.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).not.toBeNull();
    await page.mouse.up();
    await context.close();
  });

  test("on ne saisit pas la pièce suivante, ni la grille", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    await page.mouse.move(d.grille.x + d.cote * 3, d.grille.y + d.cote * 3);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await page.mouse.up();
    await context.close();
  });

  test("au doigt (événements tactiles) : la pièce flotte plus haut qu'à la souris, et la pose marche", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&scenario=presque-plein");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    const cdp = await context.newCDPSession(page);
    const touche = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const d = await page.evaluate(() => window.__blocks.disposition());
    await touche("touchStart", d.centreMain.x, d.centreMain.y);
    const cible = await viser(page, 5, 6, 1.3);
    await touche("touchMove", (d.centreMain.x + cible.x) / 2, (d.centreMain.y + cible.y) / 2);
    await touche("touchMove", cible.x, cible.y);
    await page.waitForTimeout(150);
    const s = await page.evaluate(() => window.__blocks.saisie());
    expect(s!.doigt.y - (s!.piece.y + s!.piece.h)).toBeGreaterThan(d.cote); // au moins une case entre le bas de la pièce et le doigt : il ne la cache pas
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ col: 5, ligne: 6, legale: true });
    await touche("touchEnd", cible.x, cible.y);
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    await context.close();
  });

  test("clavier : les flèches déplacent l'ombre case par case (sans sortir de la grille), Espace pose", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.ombre())).toBeNull(); // pas d'ombre tant qu'on n'a pas touché au clavier
    await page.keyboard.press("ArrowRight");
    const depart = (await page.evaluate(() => window.__blocks.ombre()))!;
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight"); // butée à droite : la boîte de 3 cases tient jusqu'à la colonne 5
    expect(await page.evaluate(() => window.__blocks.ombre())).toMatchObject({ col: 5, ligne: depart.ligne });
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown"); // butée en bas : la boîte de 2 lignes tient jusqu'à la ligne 6
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ col: 5, ligne: 6, legale: true });
    expect(await page.evaluate(() => window.__blocks.surlignage())).toEqual({ lignes: 0b11000000, colonnes: 0b10000000 });
    await page.keyboard.press("ArrowLeft");
    expect(await page.evaluate(() => window.__blocks.ombre())).toMatchObject({ col: 4, ligne: 6, legale: false }); // recouvre : ombre grisée, pose refusée
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 0, score: 0 });
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    await context.close();
  });
});
