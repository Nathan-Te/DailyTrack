import { expect, test, type Page } from "./fixtures";
import { dailyCircuit, daysFromCivil, encodeReplay, runPilot } from "@cdj/sim";

// Lot 46 : la vie et le ciel du palier 3 dans le vrai jeu. `?palier=3` (recette et aperçus seulement) charge leurs modules **à la demande et hors course**
// (au chargement de la page, avant la première scène) ; `?reglages=2+vie+ciel` : le palier 2 et le groupe « vie et ciel » des téléphones récents, sans les
// ombres fines ; demandés en pleine course, ils ne s'appliquent qu'à la pause. Au Stade, les confettis partent au passage de la ligne, pas avant.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

/** Les morceaux chargés par la page (les modules des pas sont des fichiers à part : `vieJeu-…`, `cielJeu-…`, `ombres3-…`). */
const morceaux = (page: Page) => page.evaluate(() => performance.getEntriesByType("resource").map((e) => /\/(vieJeu|cielJeu|ombres3)-[^/]*\.js$/.exec(e.name)?.[1]).filter(Boolean) as string[]);
const lire = (page: Page) =>
  page.evaluate(() => ({ palier: window.__cdj.socle.palier(), plus: window.__cdj.socle.plus(), pas: window.__cdj.render.pas as Record<string, Record<string, unknown>> | undefined, ombres: window.__cdj.render.shadowMap, phase: window.__cdj.phase }));

test("?palier=3 charge la vie, le ciel et les ombres fines à la demande, avant la course ; un appel par famille ; jamais avec ?prod", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await morceaux(page), "le palier 1 ne charge aucun module des pas").toEqual([]);
  expect((await lire(page)).pas).toBeUndefined();

  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0&quality=2&palier=3");
  await page.waitForFunction(() => window.__cdj?.phase);
  const e = await lire(page);
  expect(e.phase, "la scène est construite au palier 3 avant le départ (pendant le chargement de la page)").toBe("countdown");
  expect(e.palier).toBe("P3");
  expect((await morceaux(page)).sort()).toEqual(["cielJeu", "ombres3", "vieJeu"]);
  expect(e.pas!.vie!.appels).toEqual({ drapeaux: 1, foule: 1, ecrans: 1, particules: 1, nuages: 1 });
  expect(e.pas!.ciel).toMatchObject({ nuages: true });
  expect(e.ombres, "ombres fines : carte de 2048").toBe(2048);

  // `?prod` : le mode restreint de la production ; le paramètre est ignoré, la scène est le palier 1.
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0&palier=3&prod");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect((await lire(page)).palier).toBe("P1");
  expect(await morceaux(page)).toEqual([]);
});

test("?reglages=2+vie+ciel : le palier 2 et le groupe « vie et ciel » des téléphones récents, sans les ombres fines", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-14&ghost=off&fx=off&home=0&quality=2&reglages=2+vie+ciel");
  await page.waitForFunction(() => window.__cdj?.phase);
  const e = await lire(page);
  expect([e.palier, e.plus]).toEqual(["P2", ["vie", "ciel"]]);
  expect((await morceaux(page)).sort()).toEqual(["cielJeu", "vieJeu"]);
  expect(Object.keys(e.pas!).sort()).toEqual(["ciel", "vie"]);
  expect(e.ombres).toBe(1024);
});

test("demandés en pleine course, la vie et le ciel se chargent mais la scène ne change qu'à la pause", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__cdj.phase)) !== "racing"; i++) await page.evaluate(() => window.__cdj.advance(60));
  const avant = await page.evaluate(() => window.__cdj.socle.scene());
  await page.evaluate(() => window.__cdj.socle.demander("P2", ["vie", "ciel"]));
  await expect.poll(async () => (await morceaux(page)).sort()).toEqual(["cielJeu", "vieJeu"]);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__cdj.advance(30));
  await page.waitForTimeout(500); // rien ne doit changer pendant la course
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(avant);
  expect((await lire(page)).pas).toBeUndefined();
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2");
  const e = await lire(page);
  expect(e.plus).toEqual(["vie", "ciel"]);
  expect(Object.keys(e.pas!).sort()).toEqual(["ciel", "vie"]);
});

test.describe("au Stade, les confettis partent à l'arrivée", () => {
  const jour = daysFromCivil(2026, 10, 8);
  const circuit = dailyCircuit(jour);
  const code = encodeReplay(runPilot(circuit.track, { grip: 0.9 }).replay);

  test("aucun confetti pendant la course ; une salve au passage de la ligne", async ({ page }) => {
    expect(circuit.palette).toBe("stade");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?debug&seed=2026-10-08&ghost=off&fx=off&home=0&palier=3");
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    const vie = () => page.evaluate(() => (window.__cdj.render.pas as { vie: { salves: number; confettis: boolean } }).vie);
    for (let i = 0; i < 400 && (await page.evaluate(() => window.__cdj.phase)) !== "finished"; i++) {
      if (i % 20 === 0) expect(await vie(), "pendant la course").toMatchObject({ salves: 0, confettis: false });
      await page.evaluate(() => window.__cdj.advance(60));
    }
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("finished");
    expect((await vie()).salves).toBe(1);
    // Retour au rendu normal (le pas à pas ne dessine pas) : les confettis se voient, puis la salve s'efface (8 s).
    await page.evaluate(() => window.__cdj.manual(false));
    await page.waitForFunction(() => (window.__cdj.render.pas as { vie: { confettis: boolean } }).vie.confettis, undefined, { timeout: 5_000 });
    await page.waitForFunction(() => !(window.__cdj.render.pas as { vie: { confettis: boolean } }).vie.confettis, undefined, { timeout: 20_000 });
  });
});
