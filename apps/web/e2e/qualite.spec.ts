import { expect, newClockedContext, test, type Page } from "./fixtures";

// Lot 45 : le palier 2 en jeu, la règle de qualité automatique et le réglage « Qualité graphique », dans le vrai jeu.
//   - `?palier=2` donne le palier 2 (le pas « finition », chargé à la demande) ; aucun appel de rendu de plus que le palier 1 (la Nuit ; chaque thème : l'unitaire) ;
//   - la règle : un navigateur piloté (et le rendu logiciel) part du palier 1 sans mesurer ; `?appareil=` et `?intervalles=` (recette et aperçus) imposent
//     l'appareil et les médianes mesurées à l'accueil : on monte ou descend d'un palier, on remesure, on garde `cdj:qualite` ;
//   - le réglage : « Économie » choisi en course attend la fin de la course (« appliqué à la fin de la course »), puis le palier 1 au retour à l'accueil.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

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

// Lot R13 (docs/tests.md) : un seul thème, la Nuit (le plus de calques allumés : lampadaires, halos, phares ; et la branche « vie et ciel »). Les huit thèmes sont
// couverts par l'unitaire test/finitionJeu.test.ts « aucun appel de rendu de plus que le palier 1 : %s », et par vitrine.spec.ts (14 sujets, Régression).
test("palier 2 : aucun appel de rendu de plus que le palier 1 — nuit", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  const base = "/?debug&home=0&seed=2026-10-14&theme=nuit&ghost=off&fx=off&quality=2";
  const p1 = await appels(page, `${base}&palier=1`);
  const p2 = await appels(page, `${base}&palier=2`);
  expect(await palier(page)).toBe("P2");
  expect(p2, "nuit : palier 2 = palier 1").toBe(p1);
  // Avec la vie et le ciel (le palier 2 des téléphones) : la finition n'ajoute rien non plus.
  const v1 = await appels(page, `${base}&reglages=1+vie+ciel`);
  const v2 = await appels(page, `${base}&reglages=2+vie+ciel`);
  expect(v2, "nuit : vie et ciel, palier 2 = palier 1").toBe(v1);
});

// La mesure a lieu à l'accueil du circuit du jour (un jour passé n'a pas d'accueil) ; `quality=0` et un petit écran : en rendu logiciel, une mesure (121 images)
// prend une dizaine de secondes au lieu d'une minute.
const ACCUEIL = "/?debug&home=1&ghost=off&fx=off&quality=0";

test("règle automatique, intervalles imposés : un ordinateur part du palier 3 avec le post-traitement, perd d'abord la chaîne à 30 ms, puis le palier, tient à 16 ms ; mémorisé, puis plus de mesure", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 480, height: 270 } });
  const page = await context.newPage();
  await page.goto(`${ACCUEIL}&appareil=ordinateur&intervalles=30,30,16`);
  await page.waitForFunction(() => window.__cdj?.qualite);
  expect((await qualite(page)).appareil).toMatchObject({ ordinateur: true, logiciel: false });
  await page.waitForFunction(() => window.__cdj.socle.plus().includes("post"), undefined, { timeout: 90_000 });
  expect(await palier(page), "point de départ d'un ordinateur : le palier 3 et le post-traitement (lot 50 : prouvé au banc)").toBe("P3+post");
  // 30 ms (≥ 22) : la chaîne d'abord (le palier 3 seul) ; 30 ms encore : le palier 2 (avec la vie et le ciel) ; 16 ms : on reste.
  await page.waitForFunction(() => window.__cdj.qualite.derniere?.mediane === 30, undefined, { timeout: 90_000 });
  await page.waitForFunction(() => !window.__cdj.qualite.aMesurer, undefined, { timeout: 120_000 });
  const q = await qualite(page);
  expect(q.derniere).toEqual({ mediane: 16, hz: 60, palier: 2 });
  expect(q.memoire).toMatchObject({ palier: 2, mediane: 16, plafond: 2, durable: false, sansPost: true });
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

test("lot 50 : la règle surveille la course — trop lente (simulée), rien ne change en course ; au retour à l'accueil la chaîne puis le palier descendent et on s'en souvient ; « Maximale » garde sa scène et le dit", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 640, height: 360 } });
  try {
    const page = await context.newPage();
    // Un ordinateur dont la mesure de la semaine a donné le palier 3 (Auto, sans remesurer).
    await page.addInitScript(() => {
      if (sessionStorage.getItem("lot50")) return;
      sessionStorage.setItem("lot50", "1");
      localStorage.setItem("cdj:qualite", JSON.stringify({ palier: 3, date: Date.now(), mediane: 10, pixels: innerWidth * innerHeight * devicePixelRatio ** 2, echecs: 0, plafond: null, durable: false }));
    });
    await page.goto(`${ACCUEIL}&appareil=ordinateur`);
    await page.waitForFunction(() => window.__cdj?.socle.palier() === "P3" && window.__cdj.post.mode === "chaine", undefined, { timeout: 90_000 });
    expect((await qualite(page)).aMesurer).toBe(false);
    /** Une course trop lente (simulée), jusqu'à la descente proposée ; rien ne change en course ni à la pause ; puis l'accueil. */
    const courseLente = async (scene: string) => {
      await page.locator("#home-daily").click();
      await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
      // 250 ms par image vue par la surveillance : la fenêtre de 5 s est jugée au bout de 20 images de course.
      await page.evaluate(() => window.__cdj.qualite.ralentir(250));
      await page.waitForFunction(() => window.__cdj.qualite.descente, undefined, { timeout: 90_000 });
      expect((await qualite(page)).course).toMatchObject({ mediane: 250 });
      await page.evaluate(() => window.__cdj.qualite.ralentir(null));
      await page.keyboard.press("KeyP");
      await page.waitForTimeout(800); // la pause n'est pas « hors course » : rien ne change
      expect(await palier(page)).toBe(scene);
      expect((await qualite(page)).descente).toBe(true);
      await page.locator("#pause-home").click();
      if (await page.locator("#pause-leave").isVisible()) await page.locator("#pause-leave").click();
      await expect(page.locator("#home")).toBeVisible();
    };
    // D'abord la chaîne : le palier 3 seul (le moteur, créé pour elle, dessine en mode copie).
    await courseLente("P3+post");
    await page.waitForFunction(() => !window.__cdj.socle.plus().includes("post") && window.__cdj.post.mode === "copie", undefined, { timeout: 60_000 });
    expect(await palier(page)).toBe("P3");
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("cdj:qualite")))!)).toMatchObject({ palier: 3, sansPost: true, trop: true });
    // Puis le palier.
    await courseLente("P3");
    await page.waitForFunction(() => window.__cdj.socle.palier() === "P2", undefined, { timeout: 60_000 });
    expect(await palier(page)).toBe("P2+vie+ciel");
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("cdj:qualite")))!)).toMatchObject({ palier: 2, plafond: 2, durable: true, sansPost: true, trop: true });

    // On s'en souvient (`cdj:qualite`, relu au chargement : `test/qualite.test.ts`) ; « Maximale » garde le palier 3 et sa chaîne, et les Réglages disent « Trop lourd ».
    await page.locator("#home-settings").click();
    await page.getByRole("radiogroup", { name: "Qualité graphique" }).getByRole("radio", { name: "Maximale", exact: true }).click();
    await page.waitForFunction(() => window.__cdj.socle.palier() === "P3" && window.__cdj.post.mode === "chaine", undefined, { timeout: 60_000 });
    await expect(page.locator("#settings")).toContainText("Trop lourd pour cet appareil");
  } finally {
    await context.close();
  }
});
