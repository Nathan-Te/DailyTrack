import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Blocks » — LE geste (seed § 6, B2, refait au lot B8) : glisser-déposer à la souris et au doigt de n'importe laquelle des trois pièces, **la pièce reste sous le doigt, au point exact où on l'a touchée** (aucun décalage), ombre
// aimantée, lignes et colonnes qui seraient effacées allumées, relâcher hors d'un endroit valide renvoie la pièce ; clavier : choisir l'emplacement (1, 2, 3, Q, E), déplacer l'ombre case par case, puis poser. Le scénario
// « presque-plein » (la série rect-0, domino-0, coin-0 ; une pose du rectangle 3 × 2 en colonne 5, ligne 6 efface 2 lignes et 1 colonne) donne une pose connue.
const PRESQUE_PLEIN = "/?debug&manuel&tactile=0&scenario=presque-plein";

/** Le point de la page au centre d'une case d'une pièce, au repos dans son emplacement (`cx`, `cy` : la case, depuis son coin haut-gauche ; `emplacement` : 0 à 2). */
async function surLaPiece(page: Page, cx: number, cy: number, emplacement = 0): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ cx, cy, emplacement }) => {
      const r = window.__blocks.repos(emplacement)!;
      return { x: r.rect.x + (cx + 0.5) * r.cote, y: r.rect.y + (cy + 0.5) * r.cote };
    },
    { cx, cy, emplacement },
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
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["rect-0", "domino-0", "coin-0"]);
    // Au repos, la pièce est à l'échelle fixe du plateau (une fraction des cases de la grille) ; saisie, elle grossit à la taille des cases.
    expect((await page.evaluate(() => window.__blocks.repos(0)))!.cote).toBeCloseTo(d.coteMain, 5);
    expect(d.coteMain).toBeLessThan(d.cote);
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
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ emplacement: 0, col: 5, ligne: 6, legale: true });
    expect(await page.evaluate(() => window.__blocks.surlignage())).toEqual({ lignes: 0b11000000, colonnes: 0b10000000 }); // 2 lignes et 1 colonne s'allument
    await page.mouse.up();
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    // L'emplacement de la pièce posée est VIDE ; les deux autres n'ont pas bougé.
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual([null, "domino-0", "coin-0"]);
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
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ emplacement: 0, col: 5, ligne: 6, legale: true });
    await page.mouse.up();
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 1, score: 96 });
    await context.close();
  });

  test("la pièce saisie reste DESSINÉE pendant tout le geste, même sans position légale proche (à la prise, au-dessus de son emplacement, hors de la grille)", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    const tenue = async (): Promise<boolean> => {
      await page.waitForTimeout(60); // une image de plus
      return page.evaluate(() => window.__blocks.saisie()!.dessinee);
    };
    for (const e of [0, 1, 2]) {
      const c = d.centresMain[e]!;
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      expect(await page.evaluate(() => window.__blocks.ombre()), `emplacement ${e} : aucune ombre à la prise`).toBeNull();
      expect(await tenue(), `emplacement ${e} : dessinée à la prise`).toBe(true);
      await page.mouse.move(c.x + 5, c.y - 5, { steps: 3 }); // au survol de son emplacement
      expect(await tenue(), `emplacement ${e} : dessinée au survol de son emplacement`).toBe(true);
      await page.mouse.move(d.grille.x + d.grille.w + 20, d.grille.y - 20, { steps: 4 }); // hors de la grille
      expect(await tenue(), `emplacement ${e} : dessinée hors de la grille`).toBe(true);
      await page.mouse.up();
      expect(await page.evaluate((k) => window.__blocks.pieces()[k], e)).not.toBeNull(); // rien n'a été posé
    }
    await context.close();
  });

  test("relâcher hors d'un endroit valide renvoie la pièce à sa place, sans pénalité (et le son de la pose refusée est demandé)", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    await page.mouse.move(d.centresMain[0]!.x, d.centresMain[0]!.y);
    await page.mouse.down();
    await page.mouse.move(d.grille.x + d.cote * 0.3, d.grille.y + d.cote * 3, { steps: 6 }); // recouvre la colonne 0 déjà occupée et déborde : aucune position légale à moins d'une case
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.__blocks.ombre())).toBeNull();
    await page.mouse.up();
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ score: 0, poses: 0 });
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["rect-0", "domino-0", "coin-0"]);
    expect((await page.evaluate(() => window.__blocks.sons())).map((x) => x.son)).toEqual(["prise", "refus"]);
    // Et la pièce se reprend aussitôt.
    await page.mouse.move(d.centresMain[0]!.x, d.centresMain[0]!.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).not.toBeNull();
    await page.mouse.up();
    await context.close();
  });

  test("on ne saisit ni la grille, ni le plateau hors d'un emplacement ; un emplacement vide (sa pièce est posée) ne se saisit pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    await page.mouse.move(d.grille.x + d.cote * 3, d.grille.y + d.cote * 3);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await page.mouse.up();
    // Le titre du plateau, au-dessus des emplacements : rien à saisir.
    await page.mouse.move(d.plateau.x + d.plateau.w / 2, d.plateau.y + 6);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await page.mouse.up();
    // On pose la première pièce : son emplacement est vide et ne se saisit plus.
    await page.evaluate(() => window.__jeu.action("pose:0:5:6"));
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual([null, "domino-0", "coin-0"]);
    await page.mouse.move(d.centresMain[0]!.x, d.centresMain[0]!.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
    await page.mouse.up();
    await context.close();
  });

  test("on saisit n'importe laquelle des trois pièces, dans le désordre ; chaque emplacement posé reste vide sans décaler les autres, et la série suivante arrive après la troisième", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=plateau-vide");
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["domino-1", "domino-0", "barre3-0"]);
    // Les trois pièces sont à la même échelle fixe, quelle que soit leur taille.
    const echelles = await page.evaluate(() => [0, 1, 2].map((e) => window.__blocks.repos(e)!.cote));
    expect(new Set(echelles.map((c) => c.toFixed(3))).size).toBe(1);
    const glisser = async (emplacement: number, col: number, ligne: number): Promise<void> => {
      const prise = await surLaPiece(page, 0, 0, emplacement);
      await page.mouse.move(prise.x, prise.y);
      await page.mouse.down();
      const cible = await centreDeCase(page, col, ligne);
      await page.mouse.move(cible.x, cible.y, { steps: 6 });
      await page.waitForTimeout(120);
      expect(await page.evaluate(() => window.__blocks.saisie())!.then((x) => x!.emplacement)).toBe(emplacement);
      expect(await page.evaluate(() => window.__blocks.ombre())).toMatchObject({ emplacement, col, ligne, legale: true });
      await page.mouse.up();
    };
    // La troisième d'abord (la barre de 3), puis la première (le domino debout), puis la deuxième : dans le désordre.
    await glisser(2, 0, 0);
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["domino-1", "domino-0", null]);
    await glisser(0, 4, 2);
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual([null, "domino-0", null]);
    expect(await page.evaluate(() => window.__blocks.etat().serie)).toBe(0); // la série suivante n'est pas encore là
    await glisser(1, 0, 4);
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 3, serie: 1 });
    expect((await page.evaluate(() => window.__blocks.pieces())).every((x) => x !== null)).toBe(true); // trois nouvelles pièces
    await context.close();
  });

  test("une pièce grisée (qui ne rentre nulle part) ne se saisit pas : « blocage », les trois pièces sont grisées dès le départ", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=blocage");
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.grisees())).toEqual([true, true, true]);
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["domino-0", "domino-1", "barre3-0"]); // la fin les montre encore, grisées
    const d = await page.evaluate(() => window.__blocks.disposition());
    for (const c of d.centresMain) {
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      expect(await page.evaluate(() => window.__blocks.saisie())).toBeNull();
      await page.mouse.up();
    }
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 0, fin: "bloquee" });
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
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ emplacement: 0, col: 5, ligne: 6, legale: true });
    await touche("touchEnd", cible.x, cible.y);
    await expect(page.locator("#jeu-hud-score")).toHaveText(/^96\s*pts$/);
    await context.close();
  });

  test("clavier : les flèches déplacent l'ombre case par case (sans sortir de la grille), Espace pose", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.ombre())).toBeNull(); // pas d'ombre tant qu'on n'a pas touché au clavier
    expect(await page.evaluate(() => window.__blocks.selection())).toBeNull();
    await page.keyboard.press("ArrowRight");
    const depart = (await page.evaluate(() => window.__blocks.ombre()))!;
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight"); // butée à droite : la boîte de 3 cases tient jusqu'à la colonne 5
    expect(await page.evaluate(() => window.__blocks.ombre())).toMatchObject({ col: 5, ligne: depart.ligne });
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown"); // butée en bas : la boîte de 2 lignes tient jusqu'à la ligne 6
    expect(await page.evaluate(() => window.__blocks.ombre())).toEqual({ emplacement: 0, col: 5, ligne: 6, legale: true });
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

  test("clavier : 1, 2 et 3 choisissent l'emplacement, Q et E passent d'une pièce à l'autre en sautant les emplacements vides ; l'ombre et Espace suivent la pièce choisie", async ({ browser }) => {
    const { context, page } = await appareil(browser, PRESQUE_PLEIN);
    await lancer(page);
    const selection = (): Promise<number | null> => page.evaluate(() => window.__blocks.selection());
    await page.keyboard.press("Digit3");
    expect(await selection()).toBe(2);
    expect(await page.evaluate(() => window.__blocks.ombre())).toMatchObject({ emplacement: 2, legale: true }); // le coin
    await page.keyboard.press("KeyQ");
    expect(await selection()).toBe(1);
    await page.keyboard.press("KeyE");
    await page.keyboard.press("KeyE");
    expect(await selection()).toBe(0); // 2 → 0 : on repart du début
    // Le domino (emplacement 2 − 1 = 1) à la ligne 3 : on le choisit, on descend l'ombre, on pose ; son emplacement devient vide.
    await page.keyboard.press("Digit2");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
    const ombre = (await page.evaluate(() => window.__blocks.ombre()))!;
    expect(ombre.emplacement).toBe(1);
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.__blocks.pieces())).toEqual(["rect-0", null, "coin-0"]);
    expect(await page.evaluate(() => window.__blocks.etat())).toMatchObject({ poses: 1 });
    // L'emplacement vide ne se choisit plus ; E saute de 0 à 2.
    await page.keyboard.press("Digit2");
    expect(await selection()).not.toBe(1);
    await page.keyboard.press("Digit1");
    await page.keyboard.press("KeyE");
    expect(await selection()).toBe(2);
    await context.close();
  });
});
