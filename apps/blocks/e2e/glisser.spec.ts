import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Blocks » — LE geste (seed § 6, B2) : glisser-déposer à la souris et au doigt, **la pièce reste sous le doigt, au point exact où on l'a touchée** (aucun décalage), ombre aimantée, lignes et colonnes qui seraient
// effacées allumées, relâcher hors d'un endroit valide renvoie la pièce ; clavier : déplacer l'ombre case par case, puis poser. Le scénario « presque-plein » (une pose du rectangle 3 × 2 en colonne 5, ligne 6 efface 2 lignes
// et 1 colonne) donne une pose connue.
const PRESQUE_PLEIN = "/?debug&manuel&tactile=0&scenario=presque-plein";

/** Le point de la page au centre d'une case de la pièce du moment, au repos dans la zone de saisie (`cx`, `cy` : la case, depuis son coin haut-gauche). */
async function surLaPiece(page: Page, cx: number, cy: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ cx, cy }) => {
      const r = window.__blocks.repos()!;
      return { x: r.rect.x + (cx + 0.5) * r.cote, y: r.rect.y + (cy + 0.5) * r.cote };
    },
    { cx, cy },
  );
}
/** Le centre d'une case de la grille, en coordonnées de la page. */
async function centreDeCase(page: Page, col: number, ligne: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ col, ligne }) => {
      const d = window.__blocks.disposition();
      return { x: d.grille.x + (col + 0.5) * d.cote, y: d.grille.y + (ligne + 0.5) * d.cote };
    },
    { col, ligne },
  );
}

test.describe("Blocks : le geste", () => {
  test("souris : la pièce grossit à la taille des cases et la case touchée reste sous le pointeur pendant tout le glisser ; l'ombre s'aimante, les lignes s'allument, relâcher pose sous le doigt", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    expect(await page.evaluate(() => window.__blocks.piece())).toBe("rect-0");
    // On saisit la case (1, 1) du rectangle 3 × 2 (au milieu de sa rangée du bas), pas son centre : le point touché est exact.
    const prise = await surLaPiece(page, 1, 1);
    await page.mouse.move(prise.x, prise.y);
    await page.mouse.down();
    await page.waitForTimeout(150); // elle a fini de grossir
    const avant = await page.evaluate(() => window.__blocks.saisie());
    expect(avant!.cote).toBeCloseTo(d.cote, 0);
    expect(avant!.u).toBeCloseTo(1.5, 1);
    expect(avant!.v).toBeCloseTo(1.5, 1);
    // La case touchée est sous le doigt : le point touché est dans la case (1, 1) de la pièce, à la même place relative.
    const sous = (s: NonNullable<typeof avant>): { u: number; v: number } => ({ u: (s.doigt.x - s.piece.x) / s.cote, v: (s.doigt.y - s.piece.y) / s.cote });
    expect(sous(avant!).u).toBeCloseTo(1.5, 1);
    expect(sous(avant!).v).toBeCloseTo(1.5, 1);
    // On glisse jusqu'au centre de la case (6, 7) de la grille : la case touchée (1, 1) de la pièce y est, donc la boîte est en (5, 6).
    const cible = await centreDeCase(page, 6, 7);
    await page.mouse.move(cible.x + 3, cible.y + 3, { steps: 8 }); // un peu à côté : l'ombre s'aimante à la case la plus proche
    const s = (await page.evaluate(() => window.__blocks.saisie()))!;
    expect(sous(s).u).toBeCloseTo(1.5, 1); // pendant tout le glisser, la même case est sous le pointeur
    expect(sous(s).v).toBeCloseTo(1.5, 1);
    expect(s.piece.y + s.piece.h).toBeGreaterThan(s.doigt.y); // plus de flottement : le doigt est DANS la pièce, jamais au-dessous
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ col: 5, ligne: 6, legale: true });
    expect(await page.evaluate(() => window.__blocks.surlignage())).toEqual({ lignes: 0b11000000, colonnes: 0b10000000 }); // 2 lignes et 1 colonne s'allument
    await page.mouse.up();
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    expect(await page.evaluate(() => window.__blocks.piece())).toBe("domino-0");
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await context.close();
  });

  test("la case touchée dépend de l'endroit saisi : saisir par un coin de la pièce puis relâcher sous le doigt pose la boîte de façon que ce coin tombe sous le doigt", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const prise = await surLaPiece(page, 0, 0); // la case en haut à gauche du rectangle
    await page.mouse.move(prise.x, prise.y);
    await page.mouse.down();
    const cible = await centreDeCase(page, 5, 6); // son coin tombe sur la case (5, 6) : boîte en (5, 6)
    await page.mouse.move(cible.x, cible.y, { steps: 6 });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ col: 5, ligne: 6, legale: true });
    await page.mouse.up();
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 1, score: 96 });
    await context.close();
  });

  test("relâcher hors d'un endroit valide renvoie la pièce à sa place, sans pénalité (et le son de la pose refusée est demandé)", async ({ browser }) => {
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
    expect((await page.evaluate(() => window.__blocks.sons())).map((x) => x.son)).toEqual(["prise", "refus"]);
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
    await page.mouse.move(d.suivante.x + d.suivante.w / 2, d.suivante.y + d.suivante.h / 2);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await page.mouse.up();
    await context.close();
  });

  test("au doigt (événements tactiles) : la pièce reste sous le doigt, au point touché, sans décalage, et la pose marche", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&scenario=presque-plein");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    const cdp = await context.newCDPSession(page);
    const touche = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const d = await page.evaluate(() => window.__blocks.disposition());
    const prise = await surLaPiece(page, 2, 0); // la case en haut à droite
    await touche("touchStart", prise.x, prise.y);
    const cible = await centreDeCase(page, 7, 6); // cette case tombe en (7, 6) : boîte en (5, 6)
    await touche("touchMove", (prise.x + cible.x) / 2, (prise.y + cible.y) / 2);
    await touche("touchMove", cible.x, cible.y);
    await page.waitForTimeout(150);
    const s = (await page.evaluate(() => window.__blocks.saisie()))!;
    expect(s.cote).toBeCloseTo(d.cote, 0);
    // Le doigt est au centre de la case (2, 0) de la pièce : aucun flottement au-dessus.
    expect((s.doigt.x - s.piece.x) / s.cote).toBeCloseTo(2.5, 1);
    expect((s.doigt.y - s.piece.y) / s.cote).toBeCloseTo(0.5, 1);
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
