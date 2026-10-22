import { expect, test, type Page } from "@playwright/test";
import { auditAxe } from "./axe";

// Lot 38 et retouche 38b : la vitrine de la scène (`/track/vitrine/`, construction à part : vitrine/construire.mjs). Deux planches : **les paliers**
// (par défaut : existant, paliers 1, 2, 3, « à la carte », vue en mouvement) et **les directions** du lot 38 (`?planche=directions`). Elle s'ouvre,
// construit et dessine chaque vue de chaque section sans aucune erreur, sur ordinateur et sur téléphone. Rendu 3D de dizaines de scènes :
// Chromium seulement (les autres navigateurs de la CI n'ont pas de WebGL utilisable pour cela).
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D de toute la vitrine : Chromium seulement");
test.setTimeout(600_000);

async function ouvrir(page: Page, adresse = "/vitrine/"): Promise<string[]> {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  await page.goto(adresse);
  await page.waitForFunction(() => window.__vitrine);
  return erreurs;
}

/** Une vue dessinée n'est pas un aplat : on compare quelques pixels de son canvas. */
async function dessinee(page: Page, sujet: string, variante: string): Promise<boolean> {
  return page.evaluate(
    ([s, v]) => {
      const c = document.querySelector<HTMLCanvasElement>(`#${s} .vue--${v} canvas`);
      if (!c || c.width < 10) return false;
      const ctx = c.getContext("2d")!;
      const px = new Set<string>();
      for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) px.add(ctx.getImageData(Math.floor((c.width * i) / 6), Math.floor((c.height * j) / 6), 1, 1).data.join(","));
      return px.size > 4;
    },
    [sujet, variante],
  );
}

test("directions (lot 38), ordinateur : chaque section, chaque direction se construit et se dessine, sans erreur", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const erreurs = await ouvrir(page, "/vitrine/?planche=directions");
  expect(await page.evaluate(() => window.__vitrine!.planche)).toBe("directions");
  const sujets = await page.evaluate(() => [...new Set(window.__vitrine!.vues().map((v) => v.sujet))]);
  expect(sujets.length, "six éléments et huit thèmes").toBe(14);
  for (const s of sujets) {
    await page.evaluate((x) => window.__vitrine!.construireTout(x), s);
    const vues = await page.evaluate((x) => window.__vitrine!.vues().filter((v) => v.sujet === x), s);
    expect(vues.map((v) => v.variante)).toEqual(["existant", "A", "B", "C", "M"]);
    for (const v of vues) {
      expect(v.etat, `${s} / ${v.variante}`).toBe("prete");
      expect(v.triangles, `${s} / ${v.variante} : une image dessinée`).toBeGreaterThan(1000);
      expect(await dessinee(page, s, v.variante), `${s} / ${v.variante} : des pixels`).toBe(true);
    }
  }
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
  expect(erreurs).toEqual([]);
  // Le résumé des coûts : une ligne par colonne, le poids de chaque direction lu dans poids.json (mesuré à la construction).
  await expect(page.locator("#resume-corps tr")).toHaveCount(5);
  await expect(page.locator("#resume-corps tr").nth(1).locator("td").first()).toHaveText(/^\+\d+,\d ko$/);
});

test("paliers, ordinateur : chaque section se construit et se dessine à chaque palier, sans erreur ; le palier 2 garde les appels du palier 1", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const erreurs = await ouvrir(page);
  expect(await page.evaluate(() => window.__vitrine!.planche)).toBe("paliers");
  const sujets = await page.evaluate(() => [...new Set(window.__vitrine!.vues().map((v) => v.sujet))]);
  expect(sujets.length, "six éléments et huit thèmes").toBe(14);
  for (const s of sujets) {
    await page.evaluate((x) => window.__vitrine!.construireTout(x), s);
    const vues = await page.evaluate((x) => window.__vitrine!.vues().filter((v) => v.sujet === x), s);
    expect(vues.map((v) => v.variante)).toEqual(["existant", "P1", "P2", "P3", "carte"]);
    for (const v of vues) {
      expect(v.etat, `${s} / ${v.variante}`).toBe("prete");
      expect(v.triangles, `${s} / ${v.variante} : une image dessinée`).toBeGreaterThan(1000);
      expect(await dessinee(page, s, v.variante), `${s} / ${v.variante} : des pixels`).toBe(true);
      expect(v.textures, `${s} / ${v.variante} : la mémoire des textures est comptée`).toBeGreaterThan(0);
    }
    // « Même budget de rendu » : la finition (palier 2) ne coûte aucun appel de rendu ; le palier 3 en ajoute (ses passes).
    const par = Object.fromEntries(vues.map((v) => [v.variante, v]));
    expect(par.P2!.appels, `${s} : palier 2, mêmes appels que le palier 1`).toBe(par.P1!.appels);
    expect(par.P3!.appels, `${s} : palier 3, des passes en plus`).toBeGreaterThan(par.P1!.appels);
    expect(par.P3!.cibles, `${s} : palier 3, les cibles du post-traitement sont comptées`).toBeGreaterThan(par.P1!.cibles);
  }
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
  expect(erreurs).toEqual([]);
  // Le résumé des coûts (une ligne par colonne, le poids ajouté au jeu lu dans poids-parties.json) et le coût de chaque pas.
  await expect(page.locator("#resume-corps tr")).toHaveCount(5);
  await expect(page.locator("#resume-corps tr").nth(1).locator("td").first()).toHaveText(/ko \(net \+/);
  await expect(page.locator("#pas-corps tr")).toHaveCount(15);
});

test("paliers : la colonne « à la carte » suit les cases, et l'adresse garde les réglages", async ({ page }) => {
  const erreurs = await ouvrir(page, "/vitrine/?reglages=1");
  await page.evaluate(() => window.__vitrine!.construireTout("depart"));
  const panneau = page.locator("#reglages-page");
  await panneau.getByRole("button", { name: "Palier 3" }).click();
  await expect(panneau.getByRole("button", { name: "Palier 3" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("reglages")).toBe("3");
  // Couper un pas seul : le halo.
  await panneau.getByLabel(/Halo des lumières/).uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get("reglages")).toBe("3-halo");
  await expect(panneau.getByRole("button", { name: "Palier 3" })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__vitrine!.reglages())).toBe("3-halo");
  // La colonne « à la carte » s'est reconstruite avec ces réglages (des passes : plus d'appels que le palier 1).
  await page.evaluate(() => window.__vitrine!.construireTout("depart"));
  const vues = await page.evaluate(() => window.__vitrine!.vues().filter((v) => v.sujet === "depart"));
  const carte = vues.find((v) => v.variante === "carte")!;
  expect(carte.etat).toBe("prete");
  expect(carte.appels).toBeGreaterThan(vues.find((v) => v.variante === "P1")!.appels);
  expect(erreurs).toEqual([]);
});

test("vue en mouvement : à chaque palier et dans l'existant, la voiture roule sur le vrai circuit, la caméra la suit, sans erreur", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  const erreurs = await ouvrir(page, "/vitrine/?reglages=1");
  await page.evaluate(() => window.__vitrine!.mouvement.ouvrir("theme-nuit"));
  await expect(page.locator("#mouvement")).toBeVisible();
  const etat = () => page.evaluate(() => window.__vitrine!.mouvement.etat());
  for (const reglages of ["1", "2", "3"]) {
    await page.evaluate((r) => window.__vitrine!.reglages(r), reglages);
    await expect.poll(async () => (await etat())?.reglages, { timeout: 120_000 }).toBe(reglages);
    const avant = (await etat())!;
    await expect.poll(async () => (await etat())!.images - avant.images, { timeout: 120_000, message: `palier ${reglages} : des images` }).toBeGreaterThanOrEqual(3);
    const e = (await etat())!;
    expect(e.erreur, `palier ${reglages}`).toBeNull();
    expect(e.roule).toBe(true);
    expect(e.pas, `palier ${reglages} : la course avance`).not.toBe(avant.pas);
    expect(e.distanceCamera, `palier ${reglages} : la caméra de poursuite suit la voiture`).toBeGreaterThan(3);
    expect(e.distanceCamera).toBeLessThan(30);
    expect(e.triangles).toBeGreaterThan(1000);
    await expect(page.locator(".mouvement__ips")).toContainText("images/s");
    await expect(page.locator(".mouvement__compteur")).toContainText("appels");
  }
  // L'existant (le jeu), sur le même tour.
  await page.locator("#mouvement").getByRole("button", { name: "Existant (le jeu)" }).click();
  await expect.poll(async () => (await etat())?.scene).toBe("existant");
  const avant = (await etat())!.images;
  await expect.poll(async () => (await etat())!.images - avant, { timeout: 120_000 }).toBeGreaterThanOrEqual(3);
  await page.locator("#mouvement").getByRole("button", { name: "Fermer" }).click();
  await expect(page.locator("#mouvement")).toBeHidden();
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
  expect(erreurs).toEqual([]);
});

test("directions (lot 38), téléphone : la page tient dans la largeur, une vue s'agrandit, se tourne et se mesure, sans erreur", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR" });
  try {
    const page = await context.newPage();
    const erreurs = await ouvrir(page, "/vitrine/?planche=directions");
    await page.evaluate(() => window.__vitrine!.construireTout("depart"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const vue = page.locator("#depart .vue--A");
    const boite = (await vue.boundingBox())!;
    expect(boite.width).toBeLessThanOrEqual(390);
    expect(await dessinee(page, "depart", "A")).toBe(true);
    // Les boutons ont la taille d'un doigt.
    expect((await vue.getByRole("button").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await vue.getByRole("button", { name: "Agrandir et mesurer" }).click();
    const dialogue = page.locator("#agrandi");
    await expect(dialogue).toBeVisible();
    // Tourner autour au doigt : un glissement horizontal sur la vue agrandie la redessine.
    const cadre = (await dialogue.locator(".agrandi__cadre").boundingBox())!;
    const avant = await dialogue.locator("canvas").evaluate((c: HTMLCanvasElement) => c.toDataURL().length);
    const cdp = await context.newCDPSession(page);
    const y = cadre.y + cadre.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cadre.x + 80, y }] });
    for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cadre.x + 80 + i * 25, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => dialogue.locator("canvas").evaluate((c: HTMLCanvasElement) => c.toDataURL().length)).not.toBe(avant);
    await dialogue.getByRole("button", { name: /Mesurer/ }).click();
    await expect(dialogue.locator(".agrandi__chiffres")).toContainText("image");
    await dialogue.getByRole("button", { name: "Fermer" }).click();
    await expect(dialogue).toBeHidden();
    expect(erreurs).toEqual([]);
  } finally {
    await context.close();
  }
});

test("paliers, téléphone : la page et la vue en mouvement tiennent dans l'écran, cibles d'un doigt, sans erreur", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR" });
  try {
    const page = await context.newPage();
    const erreurs = await ouvrir(page);
    await page.evaluate(() => window.__vitrine!.construireTout("depart"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(await dessinee(page, "depart", "P2")).toBe(true);
    // Le panneau des réglages : boutons et cases à la taille d'un doigt.
    const panneau = page.locator("#reglages-page");
    for (const b of await panneau.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const l of await panneau.locator(".reglages__pas").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // La vue en mouvement : l'image tient dans la largeur, le compteur s'affiche, on la ferme.
    await page.getByRole("button", { name: "Ouvrir la vue en mouvement" }).click();
    const dlg = page.locator("#mouvement");
    await expect(dlg).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.__vitrine!.mouvement.etat()))?.images ?? 0, { timeout: 120_000 }).toBeGreaterThanOrEqual(2);
    expect((await dlg.locator("canvas").boundingBox())!.width).toBeLessThanOrEqual(390);
    await expect(dlg.locator(".mouvement__ips")).toContainText("images/s");
    expect(await dlg.evaluate((d) => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
    for (const b of await dlg.locator(".mouvement__tete").getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await dlg.getByRole("button", { name: "Fermer" }).click();
    await expect(dlg).toBeHidden();
    expect(erreurs).toEqual([]);
  } finally {
    await context.close();
  }
});

test("accessibilité : les deux planches et la vue en mouvement passent axe (aucune violation grave)", async ({ page }) => {
  await ouvrir(page, "/vitrine/?planche=directions");
  await page.evaluate(() => window.__vitrine!.construireTout("depart"));
  await auditAxe(page, "vitrine-scene");
  await ouvrir(page);
  await page.evaluate(() => window.__vitrine!.construireTout("depart"));
  await auditAxe(page, "vitrine-paliers");
  await page.evaluate(() => window.__vitrine!.mouvement.ouvrir("theme-stade"));
  await expect(page.locator("#mouvement")).toBeVisible();
  await auditAxe(page, "vitrine-mouvement", "#mouvement");
});
