import { expect, test, type Page } from "@playwright/test";

// Lots 39 et 43 : le socle par paliers, dans le vrai jeu. Lot 43 : **le palier 1 est la scène de tout le monde** ; l'ancienne scène (« existant ») n'est
// chargée qu'à la demande — par `?palier=existant` (recette et aperçus seulement) ou par une demande du reconstructeur — et, demandée en pleine course,
// **ne change pas la scène** : elle est appliquée à la pause (une fois), la course reprend dans la nouvelle. Les feux de départ suivent le décompte.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

/** Le morceau de l'ancienne scène a-t-il été chargé par la page ? */
const existantCharge = (page: Page) => page.evaluate(() => performance.getEntriesByType("resource").some((e) => /\/existant-[^/]*\.js$/.test(e.name)));

test("le palier 1 par défaut ; l'existant demandé pendant une course se charge à la demande et n'est appliqué qu'à la pause", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.socle.palier())).toBe("P1");
  expect(await existantCharge(page), "l'ancienne scène n'est pas dans le premier chargement").toBe(false);

  // Course en cours : l'existant est demandé, son morceau se charge, la scène reste.
  await page.evaluate(() => window.__cdj.manual(true));
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__cdj.phase)) !== "racing"; i++) await page.evaluate(() => window.__cdj.advance(60));
  const avant = await page.evaluate(() => window.__cdj.socle.scene());
  await page.evaluate(() => window.__cdj.socle.demander("existant"));
  await expect.poll(() => existantCharge(page)).toBe(true);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__cdj.advance(30)); // la course continue, image après image
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("racing");
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(avant);
  expect(await page.evaluate(() => window.__cdj.socle.palier())).toBe("P1");

  // La pause : la scène est reconstruite, une seule fois ; la voiture est dans la nouvelle.
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "existant");
  const apres = await page.evaluate(() => window.__cdj.socle.scene());
  expect(apres).not.toBe(avant);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(apres);
  expect(await page.evaluate(() => window.__cdj.render.feux), "l'ancienne scène n'a pas de feux").toBeUndefined();
  // Reprendre : la course continue sur la nouvelle scène, sans autre reconstruction.
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.advance(60));
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(apres);
});

test("?palier=existant montre l'ancienne scène dès le départ (hors production), jamais avec ?prod", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0&palier=existant");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.socle.palier())).toBe("existant");
  expect(await existantCharge(page)).toBe(true);
  // `?prod` : le mode restreint de la production ; le paramètre est ignoré, la scène est le palier 1.
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0&palier=existant&prod");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.socle.palier())).toBe("P1");
});

test("les feux de départ s'allument un à un pendant le décompte, passent au vert au départ, et s'éteignent quand on recommence", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-08&ghost=off&fx=off&home=0");
  await page.waitForFunction(() => window.__cdj?.phase === "countdown");
  await page.evaluate(() => window.__cdj.manual(true));
  // Les feux que la scène montre (`render.feux`) sont ceux du décompte (`feux`), à chaque image.
  const lire = () => page.evaluate(() => ({ phase: window.__cdj.phase, attendu: window.__cdj.feux, scene: window.__cdj.render.feux }));
  const vus: number[] = [];
  for (let i = 0; i < 60; i++) {
    const e = await lire();
    expect(e.scene, `image ${i}`).toEqual(e.attendu);
    if (e.phase !== "countdown") break;
    vus.push(e.attendu.rouges);
    await page.evaluate(() => window.__cdj.advance(12)); // 0,2 s par pas
  }
  // Une colonne de plus à chaque cinquième du décompte, jamais en arrière ; les cinq avant le départ.
  expect(vus.slice(1).every((n, i) => n >= vus[i]!)).toBe(true);
  expect(Math.max(...vus)).toBe(5);
  expect(new Set(vus).size).toBeGreaterThanOrEqual(5);
  const depart = await lire();
  expect(depart.phase).toBe("racing");
  expect(depart.scene).toEqual({ rouges: 0, vert: true });
  // Recommencer (Entrée : depuis le départ) : un décompte neuf, les feux éteints.
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await lire()).scene).toEqual({ rouges: 0, vert: false });
});
