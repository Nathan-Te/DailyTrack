import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, newClockedContext, test } from "./fixtures";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Captures du README du lot N1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-n1 --project=chromium` (`OUT=…` change le dossier).
// Le tableau de bord et la fiche d'un joueur, en 1280 × 800 et en 390 × 844 (vérificateur factice, données fictives de `adminPanneau.ts`). Ports 4191 et 8811.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "Chromium seulement");
test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

let panneau: Panneau;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  panneau = await demarrerPanneau({ portSite: 4191, portApi: 8811 });
  await fetch("http://127.0.0.1:8811/api/health");
  panneau.peupler();
});
test.afterAll(async () => {
  await panneau?.arreter();
});

for (const format of [
  { slug: "ordinateur", width: 1280, height: 800, mobile: false },
  { slug: "telephone", width: 390, height: 844, mobile: true },
]) {
  test(`captures ${format.slug}`, async ({ browser }) => {
    const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: format.width, height: format.height }, isMobile: format.mobile, hasTouch: format.mobile, deviceScaleFactor: format.mobile ? 2 : 1 });
    const page = await context.newPage();
    await page.goto(`${panneau.site}/admin/`);
    await page.locator("#factice-adresse").fill(ADRESSE_ADMIN);
    await page.getByRole("button", { name: "Connexion factice" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    await expect(page.locator("#courbe .admin-courbe__barre")).toHaveCount(14);
    await page.screenshot({ path: join(OUT, `lot-N1-tableau-${format.slug}.png`), fullPage: true });

    if (format.mobile) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.locator('[data-menu="joueurs"]').click();
    } else {
      await page.locator('[data-menu="joueurs"]').click();
    }
    await page.locator("#recherche").fill("Démo");
    await page.getByRole("button", { name: "Chercher" }).click();
    await page.locator("#joueurs").getByRole("link", { name: "Démo Alice" }).click();
    await expect(page.locator("#fiche-pseudo")).toContainText("Démo Alice");
    await page.screenshot({ path: join(OUT, `lot-N1-fiche-${format.slug}.png`), fullPage: true });
    await context.close();
  });
}
