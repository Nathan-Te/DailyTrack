import { expect, test, type Page } from "@playwright/test";
import { auditAxe } from "./axe";

// Lot 40 — la planche « Voiture » de la vitrine (`/track/vitrine/?planche=voiture`) : l'existant et les trois modèles proposés (A, B, C) aux
// paliers 1, 2 et 3, à l'arrêt, puis en fantôme du Salon ; le sélecteur de couleur repeint les modèles ; la vue en mouvement roule avec le
// modèle et le palier choisis ; le coût de chaque modèle est sous sa colonne. Rendu 3D de plusieurs scènes : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D de la vitrine : Chromium seulement");
test.setTimeout(600_000);

async function ouvrir(page: Page): Promise<string[]> {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  await page.goto("/vitrine/?planche=voiture");
  await page.waitForFunction(() => window.__vitrine);
  expect(await page.evaluate(() => window.__vitrine!.planche)).toBe("voiture");
  await page.evaluate(() => window.__vitrine!.voiture());
  return erreurs;
}

/** Un canvas dessiné n'est pas un aplat. */
const dessine = (page: Page, i: number) =>
  page.evaluate((k) => {
    const c = document.querySelectorAll<HTMLCanvasElement>(".voiture-grille canvas")[k]!;
    if (c.width < 10) return false;
    const ctx = c.getContext("2d")!;
    const px = new Set<string>();
    for (let a = 1; a < 6; a++) for (let b = 1; b < 6; b++) px.add(ctx.getImageData(Math.floor((c.width * a) / 6), Math.floor((c.height * b) / 6), 1, 1).data.join(","));
    return px.size > 4;
  }, i);

test("ordinateur : cinq colonnes (l'existant, la civile, A, B, C), trois paliers et les fantômes se dessinent ; la couleur change ; la vue en mouvement roule avec le modèle choisi", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const erreurs = await ouvrir(page);
  const vues = await page.evaluate(async () => (await window.__vitrine!.voiture())!.toutDessiner("theme-stade"));
  expect(vues).toHaveLength(20);
  for (const [i, v] of vues.entries()) {
    expect(v.triangles, `${v.col} ${v.sorte} P${v.palier}`).toBeGreaterThan(200);
    expect(v.appels, `${v.col} ${v.sorte} P${v.palier} : une image`).toBeGreaterThan(5);
    expect(await dessine(page, i), `${v.col} ${v.sorte} P${v.palier} : des pixels`).toBe(true);
    // Six maillages au plus pour une voiture ; un seul pour un fantôme.
    expect(v.maillages).toBeLessThanOrEqual(v.sorte === "fantome" ? 1 : 6);
  }
  // Palier 1 ≈ 2 000 triangles, paliers 2 et 3 entre 4 000 et 6 000 (les modèles proposés).
  for (const col of ["civile", "A", "B", "C"]) {
    const p1 = vues.find((v) => v.col === col && v.palier === 1 && v.sorte === "arret")!;
    const p2 = vues.find((v) => v.col === col && v.palier === 2 && v.sorte === "arret")!;
    expect(p1.triangles).toBeLessThan(2700);
    expect(p2.triangles).toBeGreaterThanOrEqual(4000);
    expect(p2.triangles).toBeLessThanOrEqual(6000);
  }
  // Le coût sous chaque colonne : poids lu dans poids-parties.json, triangles, maillages.
  await expect(page.locator("#voiture-couts tr")).toHaveCount(6);
  await expect(page.locator("#voiture-couts tr").first().locator("td").nth(1)).toContainText("ko au premier chargement");
  // La couleur : une pastille pressée, les vues redessinées sans erreur.
  await page.getByRole("button", { name: "Glycine" }).click();
  await expect(page.getByRole("button", { name: "Glycine" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Orange Track" })).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(async () => (await window.__vitrine!.voiture())!.toutDessiner());
  // La vue en mouvement : modèle A au palier 2, puis C au palier 3, sur la Nuit.
  await page.locator(".voiture-colonne").nth(1).getByRole("button", { name: "Vue en mouvement" }).click();
  const dlg = page.locator("#mouvement");
  await expect(dlg).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => window.__vitrine!.mouvement.etat()))?.images ?? 0, { timeout: 180_000 }).toBeGreaterThanOrEqual(2);
  expect((await page.evaluate(() => window.__vitrine!.mouvement.etat()))!.reglages).toBe("2");
  await dlg.getByRole("button", { name: "C", exact: true }).click();
  await dlg.getByRole("button", { name: "Palier 3" }).click();
  await dlg.locator("#mouvement-theme").selectOption("theme-nuit");
  await expect.poll(async () => (await page.evaluate(() => window.__vitrine!.mouvement.etat()))?.theme, { timeout: 180_000 }).toBe("theme-nuit");
  await expect.poll(async () => (await page.evaluate(() => window.__vitrine!.mouvement.etat()))?.reglages, { timeout: 60_000 }).toBe("3");
  const n = (await page.evaluate(() => window.__vitrine!.mouvement.etat()))!.images;
  await expect.poll(async () => (await page.evaluate(() => window.__vitrine!.mouvement.etat()))!.images, { timeout: 120_000 }).toBeGreaterThan(n + 1);
  await dlg.getByRole("button", { name: "Fermer" }).click();
  await expect(dlg).toBeHidden();
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
  expect(erreurs).toEqual([]);
});

test("téléphone : la page tient dans l'écran, pastilles à la taille d'un doigt ; axe", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR" });
  try {
    const page = await context.newPage();
    const erreurs = await ouvrir(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const b of await page.locator(".nuancier .pastille").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect.poll(() => dessine(page, 0), { timeout: 120_000 }).toBe(true);
    await auditAxe(page, "vitrine-voiture");
    expect(erreurs).toEqual([]);
  } finally {
    await context.close();
  }
});
