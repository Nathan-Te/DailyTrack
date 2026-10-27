import { expect, test, newClockedContext } from "./fixtures";
import { boxes, expectCentreLibre, expectNoOverlap } from "./layout";

// Lot I4, retouche 2 (charte rév. 7, § 9 : surimpressions compactes) sur un téléphone en paysage : le titre du circuit ne s'affiche qu'au départ, l'aide de départ
// tient en une ligne sous la bande puis s'efface au premier appui sur le gaz, les commandes tactiles par défaut sont les boutons (aux bords), la barre du bas n'existe plus
// (caméra, plein écran et réglages sont dans la pause), le classement est replié par défaut. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

// Lot R13 (docs/tests.md) : deux formats (téléphone en paysage, ordinateur) et le portrait là où l'écran s'y affiche ; 740×360 et 360×640 sont retirés.
for (const viewport of [
  { width: 844, height: 390 },
]) {
  test(`paysage ${viewport.width}×${viewport.height} : titre au départ seulement, aide d'une ligne, commandes par défaut = boutons, centre libre`, async ({ browser }) => {
    const context = await newClockedContext(browser, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    // Hors ligne : la synchronisation du profil (qui relance le décompte quand le serveur répond) ne vient pas se glisser entre deux pas.
    await context.route(/\/api\//, (route) => route.abort());
    const page = await context.newPage();
    await page.goto("/?debug&home=0");
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.addStyleTag({ content: "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }" }); // la police large de la CI : le pire cas
    await page.evaluate(() => window.__cdj.manual(true)); // pas à pas : rien ne dépend de la vitesse de la machine

    // Décompte : le titre du circuit est là, sous la bande.
    await expect(page.locator("#intro")).toBeVisible();
    await expect(page.locator("#meta")).toContainText("Circuit");
    // Les commandes par défaut sont les boutons, aux bords ; plus de barre du bas.
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons");
    await expect(page.locator("#tbar")).toHaveCount(0);
    for (const c of ["steer-left", "steer-right", "pedal-brake", "pedal-gas"]) await expect(page.locator(`#touch .${c}`)).toBeVisible();
    // Au départ : l'aide tient en une ligne (la plaque `#aide`), sous la bande, hors de la zone centrale.
    await page.evaluate(() => window.__cdj.advance(3 * 120 + 40)); // 3 s de décompte, plus une marge : la première image réelle peut avoir un temps négatif
    await expect(page.locator("#aide")).toBeVisible();
    const aide = (await page.locator("#aide").boundingBox())!;
    expect(aide.height, "une seule ligne").toBeLessThanOrEqual(26);
    const bande = (await page.locator("#hud-centre").boundingBox())!;
    expect(aide.y).toBeGreaterThanOrEqual(bande.y + bande.height);
    expectNoOverlap(await boxes(page, ["#hud-centre", "#aide", "#menu", "#medals"]), viewport);
    expectCentreLibre(await boxes(page, ["#hud-centre", "#aide", "#menu", "#medals", "#speed"]), viewport);
    // Le titre disparaît après le départ (1,5 s de course).
    await page.evaluate(() => window.__cdj.advance(2 * 120));
    await expect(page.locator("#meta")).toBeHidden();
    await expect(page.locator("#ghostinfo")).toBeHidden();
    // Le premier appui sur le gaz efface l'aide.
    await expect(page.locator("#aide")).toBeVisible();
    await page.keyboard.down("KeyW");
    await page.evaluate(() => window.__cdj.advance(12));
    await expect(page.locator("#aide")).toBeHidden();
    await page.keyboard.up("KeyW");
    // Pendant la partie, rien dans la zone centrale ; la bande fait 30 px ; le classement est replié.
    const racing = await boxes(page, ["#hud-centre", "#menu", "#medals", "#rang", "#speed", "#fx", "#touch .steer-left", "#touch .steer-right", "#touch .pedal-brake", "#touch .pedal-gas"]);
    expectNoOverlap(racing, viewport);
    expectCentreLibre(racing, viewport);
    expect((await page.locator("#hud-centre").boundingBox())!.height).toBeLessThanOrEqual(31);
    await expect(page.locator("#board")).toBeHidden();
    // Pause, dernier point de contrôle et recommencer : trois boutons de 44 px en haut à gauche, sur la même ligne (lot I7 : la caméra et le plein écran les suivent,
    // `plein-ecran.spec.ts`).
    const boutons = await Promise.all(["#btn-pause", "#btn-respawn", "#btn-restart"].map((s) => page.locator(s).elementHandle()));
    const ys = new Set<number>();
    for (const b of boutons) {
      const r = (await b!.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(43.5);
      expect(r.width).toBeGreaterThanOrEqual(43.5);
      ys.add(Math.round(r.y));
    }
    expect(ys.size, "les trois boutons sur la même ligne").toBe(1);

    // La pause porte ce que la barre du bas portait : caméra, plein écran (si le navigateur le permet), réglages.
    await page.locator("#btn-pause").click();
    await expect(page.locator("#pause")).toBeVisible();
    await expect(page.locator("#pause-camera")).toBeVisible();
    const avant = await page.locator("#pause-camera").textContent();
    await page.locator("#pause-camera").click();
    await expect(page.locator("#pause-camera")).not.toHaveText(avant!);
    await expect(page.locator("#pause-settings")).toBeVisible();
    for (const b of await page.locator("#pause button:visible").all()) expect((await b.boundingBox())!.height, `pause : ${await b.textContent()}`).toBeGreaterThanOrEqual(43.5);
    await context.close();
  });
}

test("ordinateur : le classement est ouvert par défaut, en haut à droite, hors du centre ; ni point de contrôle ni recommencer à l'écran (le clavier a ses touches)", async ({ browser }) => {
  const viewport = { width: 1280, height: 720 };
  const context = await newClockedContext(browser, { viewport });
  const page = await context.newPage();
  await page.goto("/?debug&home=0&api=demo");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#btn-respawn")).toBeHidden(); // le clavier a ses touches : point de contrôle et recommencer sont tactiles
  await expect(page.locator("#btn-restart")).toBeHidden();
  await expect(page.locator("#btn-pause")).toBeVisible();
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate(() => window.__cdj.advance(5 * 120));
  expectCentreLibre(await boxes(page, ["#hud-centre", "#menu", "#medals", "#speed", "#board"]), viewport);
  await context.close();
});
