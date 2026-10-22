import { expect, test, type Page } from "@playwright/test";
import { auditAxe } from "./axe";

// Lot 38 : la vitrine de la scène (`/track/vitrine/`, construction à part : vitrine/construire.mjs). Elle s'ouvre, construit et dessine chaque vue
// (existant, A, B, C, mélange) de chaque section (éléments et thèmes) sans aucune erreur, sur ordinateur et sur téléphone. Rendu 3D de dizaines de
// scènes : Chromium seulement (les autres navigateurs de la CI n'ont pas de WebGL utilisable pour cela).
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D de toute la vitrine : Chromium seulement");
test.setTimeout(420_000);

async function ouvrir(page: Page): Promise<string[]> {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  await page.goto("/vitrine/");
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

test("ordinateur : chaque section, chaque direction se construit et se dessine, sans erreur", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const erreurs = await ouvrir(page);
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

test("téléphone : la page tient dans la largeur, une vue s'agrandit, se tourne et se mesure, sans erreur", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR" });
  try {
    const page = await context.newPage();
    const erreurs = await ouvrir(page);
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

test("accessibilité : la page passe axe (aucune violation grave)", async ({ page }) => {
  await ouvrir(page);
  await page.evaluate(() => window.__vitrine!.construireTout("depart"));
  await auditAxe(page, "vitrine-scene");
});
