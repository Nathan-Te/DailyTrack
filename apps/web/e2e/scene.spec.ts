import { expect, test, newClockedContext, type Page } from "./fixtures";
import { boxes, expectNoOverlap } from "./layout";

// Lot I4b (charte rév. 8 § 9, règle de Nathan : « quand on entre dans un jeu, on y reste tant qu'on ne choisit pas de le quitter ») : tous les écrans de Track
// sont posés sur la scène sous le voile à rayures (cadre commun de @cdj/ui), la barre des jeux en plaque crème ; un seul voile (l'écran du dessous s'efface) ;
// Échap ou « ‹ TRACK » ferment l'écran du dessus. Formats : paysage 844 × 390 et 740 × 360 (le jeu), portrait 390 × 844, ordinateur 1280 × 720 ; police large
// de la CI imposée. Le jeu en démonstration (`?api=demo`). Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const WIDE_FONT = "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }";

/** L'écran est posé sur la scène : le voile à rayures (jamais l'aplat crème), la barre des jeux en plaque crème, la scène 3D dessous. */
async function surLaScene(page: Page, id: string) {
  const r = await page.locator(`#${id}`).evaluate((e) => {
    const s = getComputedStyle(e);
    const barre = e.querySelector(":scope > .dj-barre-jeu");
    return { fond: s.backgroundImage, aplat: s.backgroundColor, barre: barre ? getComputedStyle(barre).backgroundColor : null };
  });
  expect(r.fond, `#${id} : le voile à rayures`).toContain("repeating-linear-gradient");
  expect(r.aplat, `#${id} : pas d'aplat crème`).toBe("rgba(0, 0, 0, 0)");
  expect(r.barre, `#${id} : la barre en plaque crème`).toBe("rgb(237, 227, 207)");
  await expect(page.locator("canvas").first()).toBeVisible();
}

/** Les blocs de l'écran (barre, étiquette, pied) dans l'écran sans se chevaucher ; chaque bouton et lien visible fait au moins 44 px de haut. */
async function tientDansLEcran(page: Page, id: string, viewport: { width: number; height: number }) {
  const blocs = await boxes(page, [`#${id} > .dj-barre-jeu`, `#${id} .etiquette`, `#${id} .cadre__pied`]);
  expect(blocs.length, `#${id} : la barre et l'étiquette`).toBeGreaterThanOrEqual(2);
  expectNoOverlap(blocs, viewport);
  for (const b of await page.locator(`#${id} > .dj-barre-jeu a:visible, #${id} > .dj-barre-jeu button:visible, #${id} .etiquette button:visible`).all()) {
    const box = await b.boundingBox();
    if (box && box.width > 0) expect(box.height, `#${id} : « ${(await b.textContent())?.trim()} » trop petit`).toBeGreaterThanOrEqual(43.5);
  }
}

for (const vp of [
  { name: "paysage", width: 844, height: 390, touch: true },
  { name: "paysage compact", width: 740, height: 360, touch: true },
  { name: "portrait", width: 390, height: 844, touch: true },
  { name: "ordinateur", width: 1280, height: 720, touch: false },
]) {
  test(`${vp.name} (${vp.width}×${vp.height}) : accueil, classement, archives, réglages, « Comment jouer » sur la scène ; un seul voile ; Échap et « ‹ TRACK »`, async ({ browser }) => {
    const ctx = await newClockedContext(browser, { viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
    await ctx.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
    const page = await ctx.newPage();
    await page.goto("/?home=1&debug&api=demo");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await page.addStyleTag({ content: WIDE_FONT });
    await expect(page.locator("#home .board-card .row, #home .home-classement .ligne").first()).toBeVisible({ timeout: 15_000 });
    await surLaScene(page, "home");
    await tientDansLEcran(page, "home", vp);

    // Sous-écrans de l'accueil : chacun sur la scène, l'accueil s'efface dessous ; Échap (au clavier) ou « ‹ TRACK » (au doigt) y ramène.
    for (const [bouton, id] of [["#home-board-all", "board-screen"], ["#home-archive", "archive"], ["#home-settings", "settings"]] as const) {
      await page.locator(bouton).click();
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator("#home"), `un seul voile : l'accueil s'efface sous #${id}`).toBeHidden();
      await surLaScene(page, id);
      await tientDansLEcran(page, id, vp);
      await expect(page.locator(`#${id} > .dj-barre-jeu`)).toContainText("TRACK");
      if (vp.touch) await page.locator(`#${id} .dj-barre-jeu__retour`).click();
      else await page.keyboard.press("Escape");
      await expect(page.locator(`#${id}`)).toBeHidden();
      await expect(page.locator("#home")).toBeVisible();
    }

    // « Comment jouer » : un dialogue sur la scène, seul voile (l'accueil s'efface) ; Échap le ferme.
    await page.locator("#home-howto").click();
    await expect(page.locator("#howto")).toBeVisible();
    await expect(page.locator("#home")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator("#howto")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();

    // En course, depuis la pause : les réglages effacent la pause et les plaques de la course ; Échap rend la pause.
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
    await page.locator("#btn-pause").click();
    await expect(page.locator("#pause")).toBeVisible();
    await page.locator("#pause-settings").click();
    await expect(page.locator("#settings")).toBeVisible();
    for (const sel of ["#pause", "#hud-centre", "#menu"]) await expect(page.locator(sel), `${sel} effacé sous les réglages`).toBeHidden();
    await surLaScene(page, "settings");
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings")).toBeHidden();
    await expect(page.locator("#pause")).toBeVisible();
    await ctx.close();
  });
}
