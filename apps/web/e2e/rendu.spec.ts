import { expect, test, type Page } from "./fixtures";

// Lot 51 : le rendu du jeu — (1) **la netteté** : le jeu se dessine à la résolution native de l'écran (la densité de l'appareil, plafonnée à 2) à tous les paliers ; la scène
// de la chaîne de post-traitement a la taille du tampon de dessin (jamais plus petite : le lot 50 l'avait réduite à 2,1 millions de pixels au-delà de 1080p, l'image était
// molle), seul le halo est plus petit ; le FXAA est coupé à partir de la densité 1,75 ; (2) **le chronomètre du portique** montre le temps de la course en cours et revient
// à zéro au recommencement. Rendu logiciel de la CI : `?appareil=ordinateur` impose l'appareil (la chaîne ne s'allume pas sans lui). Chromium seulement (WebGL).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

const ORDINATEUR = "/?debug&home=0&ghost=off&fx=off&fps=0&quality=2&appareil=ordinateur";
const chaineAllumee = (page: Page) => page.waitForFunction(() => window.__cdj?.post?.actif && window.__cdj.render.renderFrames > 3, undefined, { timeout: 90_000 });
/** Les erreurs de la page (aucune ne doit sortir du rendu). */
function erreurs(page: Page): string[] {
  const e: string[] = [];
  page.on("pageerror", (x) => e.push(x.message));
  return e;
}

// --- Lot 51 : la netteté — le jeu se dessine à la résolution native, à tous les paliers --------------------------------------------------------------------------

/** La résolution du jeu (`__cdj.resolution`, lot 51). */
const resolution = (page: Page) => page.evaluate(() => window.__cdj.resolution);

for (const dpr of [1.5, 2]) {
  test.describe(`lot 51 : netteté, densité ${dpr}`, () => {
    test.use({ viewport: { width: 480, height: 270 }, deviceScaleFactor: dpr });
    // Essentiel : la densité 2 (le FXAA coupé) ; la densité 1,5 (le FXAA gardé) est de la Régression (la nuit et « Run workflow »).
    test(`le canevas vaut la fenêtre × la densité (plafonnée à 2) au palier 1, 2 et 3 ; la scène de la chaîne a cette taille ; le FXAA est coupé à partir de 1,75`, { tag: dpr === 2 ? [] : ["@regression"] }, async ({ page }) => {
      test.setTimeout(300_000);
      const e = erreurs(page);
      const attendu = [Math.floor(480 * dpr), Math.floor(270 * dpr)];
      for (const palier of [1, 2, 3]) {
        await page.goto(`${ORDINATEUR}&seed=2026-10-14&theme=nuit&palier=${palier}`);
        await page.waitForFunction(() => window.__cdj?.phase && window.__cdj.render.renderFrames > 3, undefined, { timeout: 90_000 });
        if (palier === 3) await chaineAllumee(page);
        const r = await resolution(page);
        expect(r.densite, `palier ${palier}`).toBe(Math.min(dpr, 2));
        expect(r.tampon, `palier ${palier} : le canevas`).toEqual(attendu);
        if (palier < 3) {
          expect(r.sceneCible, "pas de chaîne : dessin direct").toBeNull();
          continue;
        }
        expect(r.sceneCible, "la cible de la scène a la taille du tampon : jamais plus petite").toEqual([...attendu, 0]);
        expect(r.haloCibles.length, "la Nuit : le halo").toBeGreaterThan(0);
        for (const [x, y] of r.haloCibles) expect(x <= attendu[0]! && y <= attendu[1]!, "le halo est plus petit ou égal").toBe(true);
        expect(r.haloCibles[0], "la première cible du halo : la moitié de l'écran").toEqual([Math.round(attendu[0]! / 2), Math.round(attendu[1]! / 2)]);
        expect(r.fxaa, "FXAA coupé à partir de la densité 1,75").toBe(dpr < 1.75);
      }
      expect(e).toEqual([]);
    });
  });
}


// Lot 51 : le chronomètre du portique montre le temps de la course en cours (il tournait sur le temps d'affichage et ne revenait jamais à zéro).
test("lot 51 : le chronomètre du portique suit la course et revient à 0 quand on recommence", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0&quality=2&palier=3");
  await page.waitForFunction(() => window.__cdj?.phase === "countdown");
  await page.evaluate(() => window.__cdj.manual(true));
  /** Ce que le jeu donne au chronomètre du portique, en dixièmes de seconde (`render.chrono`, en secondes : il l'affiche en `M:SS.d`). */
  const chrono = () => page.evaluate(() => Math.floor((window.__cdj.render.chrono ?? -1) * 10 + 1e-6));
  const hud = () => page.evaluate(() => document.getElementById("timer-texte")!.textContent ?? "");
  /** « 5,500 s » / « 1:05,500 » (la plaque du HUD) → dixièmes de seconde. */
  const dixiemes = (txt: string) => {
    const m = /^(?:(\d+):)?(\d+)[.,](\d)/.exec(txt.trim())!;
    return Number(m[1] ?? 0) * 600 + Number(m[2]) * 10 + Number(m[3]);
  };
  await expect.poll(chrono, { message: "au décompte" }).toBe(0);
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__cdj.phase)) === "countdown"; i++) {
    await page.evaluate(() => window.__cdj.advance(12));
    expect(await chrono(), "pendant le décompte, le chronomètre reste à zéro").toBe(0);
  }
  await page.evaluate(() => window.__cdj.advance(660)); // 5,5 s de course (120 pas par seconde)
  await expect.poll(chrono, { message: "le chronomètre suit la course" }).toBeGreaterThanOrEqual(50);
  const course = (await chrono());
  expect(Math.abs(course - dixiemes(await hud())), "le même temps que la plaque du HUD, au dixième près").toBeLessThanOrEqual(1);
  // Recommencer : un décompte neuf, le chronomètre à zéro, qui repart au départ.
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__cdj.phase)).toBe("countdown");
  await expect.poll(chrono, { message: "revenu à zéro au recommencement" }).toBe(0);
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__cdj.phase)) === "countdown"; i++) await page.evaluate(() => window.__cdj.advance(12));
  await page.evaluate(() => window.__cdj.advance(240)); // 2 s
  await expect.poll(chrono, { message: "il repart au départ" }).toBeGreaterThanOrEqual(15);
  expect((await chrono()), "…et il n'a pas gardé le temps de la course d'avant").toBeLessThan(course);
});
