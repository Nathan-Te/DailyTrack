import { expect, newClockedContext, test, type Page } from "./fixtures";

// Lot 45 : le palier 2 en jeu, la règle de qualité automatique et le réglage « Qualité graphique », dans le vrai jeu.
//   - `?palier=2` donne le palier 2 (le pas « finition », chargé à la demande) ; aucun appel de rendu de plus que le palier 1, sur chaque thème ;
//   - la règle : un navigateur piloté (et le rendu logiciel) part du palier 1 sans mesurer ; `?appareil=` et `?intervalles=` (recette et aperçus) imposent
//     l'appareil et les médianes mesurées à l'accueil : on monte ou descend d'un palier, on remesure, on garde `cdj:qualite` ;
//   - le réglage : « Économie » choisi en course attend la fin de la course (« appliqué à la fin de la course »), puis le palier 1 au retour à l'accueil.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

const THEMES = ["stade", "rallye", "banquise", "nuit", "campagne", "canyon", "col", "ville"] as const;
const qualite = (page: Page) => page.evaluate(() => window.__cdj.qualite);
const palier = (page: Page) => page.evaluate(() => [window.__cdj.socle.palier(), ...window.__cdj.socle.plus()].join("+"));
/** Les morceaux de la finition et de la mesure chargés par la page. */
const morceaux = (page: Page) => page.evaluate(() => performance.getEntriesByType("resource").map((e) => /\/(finitionJeu|qualiteMesure)-[^/]*\.js$/.exec(e.name)?.[1]).filter(Boolean) as string[]);

/** Les appels de rendu d'une image, à la pause (le décor posé), caméra au départ. */
async function appels(page: Page, adresse: string): Promise<number> {
  await page.goto(adresse);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown");
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.decor.dansScene && window.__cdj.ui.paused);
  const images = await page.evaluate(() => window.__cdj.render.renderFrames);
  await page.waitForFunction((n) => window.__cdj.render.renderFrames >= n + 3, images);
  return page.evaluate(() => window.__cdj.render.calls);
}

test("?palier=2 : le palier 2 (la finition, à la demande) ; sans paramètre, le navigateur piloté reste au palier 1 sans rien mesurer ni charger", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&home=1&seed=2026-10-16&ghost=off&fx=off");
  await page.waitForFunction(() => window.__cdj?.qualite);
  const q = await qualite(page);
  expect(q.appareil.logiciel, "navigateur piloté ou rendu logiciel").toBe(true);
  expect([q.choix, q.aMesurer, q.memoire]).toEqual(["auto", false, null]);
  await page.waitForTimeout(1500); // rien ne doit changer à l'accueil
  expect(await palier(page)).toBe("P1");
  expect(await morceaux(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("cdj:qualite"))).toBeNull();

  await page.goto("/?debug&home=0&seed=2026-10-16&ghost=off&fx=off&quality=2&palier=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await palier(page)).toBe("P2");
  expect(await morceaux(page)).toEqual(["finitionJeu"]);
  expect(await page.evaluate(() => window.__cdj.render.pas?.finition)).toMatchObject({ geometrie: true, variete: true, matiere: true, traces: true, reflets: true });
  expect(await page.evaluate(() => localStorage.getItem("cdj:qualite")), "l'adresse n'enregistre rien").toBeNull();
});

for (const theme of THEMES) {
  test(`palier 2 : aucun appel de rendu de plus que le palier 1 — ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    const base = `/?debug&home=0&seed=2026-10-14&theme=${theme}&ghost=off&fx=off&quality=2`;
    const p1 = await appels(page, `${base}&palier=1`);
    const p2 = await appels(page, `${base}&palier=2`);
    expect(await palier(page)).toBe("P2");
    expect(p2, `${theme} : palier 2 = palier 1`).toBe(p1);
    if (theme === "stade" || theme === "nuit") {
      // Avec la vie et le ciel (le palier 2 des téléphones) : la finition n'ajoute rien non plus.
      const v1 = await appels(page, `${base}&reglages=1+vie+ciel`);
      const v2 = await appels(page, `${base}&reglages=2+vie+ciel`);
      expect(v2, `${theme} : vie et ciel, palier 2 = palier 1`).toBe(v1);
    }
  });
}

// La mesure a lieu à l'accueil du circuit du jour (un jour passé n'a pas d'accueil) ; `quality=0` et un petit écran : en rendu logiciel, une mesure (121 images)
// prend une dizaine de secondes au lieu d'une minute.
const ACCUEIL = "/?debug&home=1&ghost=off&fx=off&quality=0";

test("règle automatique, intervalles imposés : un ordinateur part du palier 3, descend à 30 ms, tient à 16 ms ; mémorisé, puis plus de mesure", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 480, height: 270 } });
  const page = await context.newPage();
  await page.goto(`${ACCUEIL}&appareil=ordinateur&intervalles=30,16`);
  await page.waitForFunction(() => window.__cdj?.qualite);
  expect((await qualite(page)).appareil).toMatchObject({ ordinateur: true, logiciel: false });
  expect(await palier(page), "point de départ d'un ordinateur : le palier 3 et son post-traitement (lot 47 : la chaîne est du palier 3 des ordinateurs)").toBe("P3+post");
  // Première mesure (30 ms ≥ 22) : on descend au palier 2 (avec la vie et le ciel), puis on remesure (16 ms : on reste).
  await page.waitForFunction(() => window.__cdj.qualite.derniere?.mediane === 30, undefined, { timeout: 90_000 });
  await page.waitForFunction(() => !window.__cdj.qualite.aMesurer, undefined, { timeout: 90_000 });
  const q = await qualite(page);
  expect(q.derniere).toEqual({ mediane: 16, hz: 60, palier: 2 });
  expect(q.memoire).toMatchObject({ palier: 2, mediane: 16, plafond: 2, durable: false });
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2");
  expect(await palier(page)).toBe("P2+vie+ciel");
  const garde = JSON.parse((await page.evaluate(() => localStorage.getItem("cdj:qualite")))!);
  expect(garde).toMatchObject({ palier: 2, mediane: 16 });
  expect(garde.date).toBeGreaterThan(0);
  expect(await morceaux(page)).toContain("qualiteMesure");

  // Rechargé (la mémoire vaut une semaine, sur un écran de même taille) : le palier 2 tout de suite, sans mesure.
  await page.goto(`${ACCUEIL}&appareil=ordinateur&intervalles=8`);
  await page.waitForFunction(() => window.__cdj?.qualite);
  expect(await palier(page)).toBe("P2+vie+ciel");
  expect((await qualite(page)).aMesurer).toBe(false);
  await page.waitForTimeout(1500); // rien ne doit être mesuré
  expect((await qualite(page)).derniere).toBeNull();
  expect(await morceaux(page)).not.toContain("qualiteMesure");
  await context.close();
});

test("réglage « Économie » : choisi en course, il attend la fin de la course ; au retour à l'accueil, le palier 1. Puis « Auto » revient au palier mémorisé", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 640, height: 360 } });
  const page = await context.newPage();
  // Un téléphone qui tient le palier 2 (16 ms à l'accueil).
  await page.goto(`${ACCUEIL}&appareil=telephone&intervalles=16`);
  await page.waitForFunction(() => window.__cdj?.qualite);
  await page.waitForFunction(() => window.__cdj.qualite.memoire?.mediane === 16, undefined, { timeout: 90_000 });
  expect(await palier(page)).toBe("P2+vie+ciel");

  await page.locator("#home-daily").click();
  await expect(page.locator("#home")).toBeHidden();
  await page.locator("#btn-pause").click();
  await page.locator("#pause-settings").click();
  const groupe = page.getByRole("radiogroup", { name: "Qualité graphique" });
  await expect(groupe.getByRole("radio", { name: "Auto", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#settings")).toContainText("Ne change rien à la course : seulement l'image.");
  await expect(page.locator("#settings")).toContainText("Choisie pour cet appareil : Équilibrée.");
  await groupe.getByRole("radio", { name: "Économie", exact: true }).click();
  await expect(page.locator("#settings")).toContainText("Appliqué à la fin de la course.");
  expect((await qualite(page)).enAttente).toBe(true);
  await page.waitForTimeout(800); // en course (même en pause), la scène ne change pas
  expect(await palier(page)).toBe("P2+vie+ciel");
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("cdj:settings")))!).graphismes).toBe("economie");

  await page.keyboard.press("Escape"); // ferme les réglages : la pause
  await page.locator("#pause-home").click();
  if (await page.locator("#pause-leave").isVisible()) await page.locator("#pause-leave").click();
  await expect(page.locator("#home")).toBeVisible();
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P1");
  expect(await palier(page)).toBe("P1");
  expect((await qualite(page)).enAttente).toBe(false);

  // « Auto » : le palier mémorisé (2, la vie et le ciel), sans remesurer.
  await page.locator("#home-settings").click();
  await page.getByRole("radiogroup", { name: "Qualité graphique" }).getByRole("radio", { name: "Auto", exact: true }).click();
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2");
  expect(await palier(page)).toBe("P2+vie+ciel");
  expect((await qualite(page)).aMesurer).toBe(false);
  await context.close();
});
