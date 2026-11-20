import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, newClockedContext, test } from "./fixtures";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Captures du README du lot N3 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-n3 --project=chromium` (`OUT=…` change le dossier ; `AVANT=1` : les captures « avant »,
// à lancer sur l'ancien panneau). La page « Jeux » et le menu, en 1280 × 800 et en 390 × 844 (vérificateur factice, données fictives de `adminPanneau.ts`). Ports 4192 et 8812.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "Chromium seulement");
test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
const QUAND = process.env.AVANT ? "avant" : "apres";
mkdirSync(OUT, { recursive: true });

let panneau: Panneau;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  panneau = await demarrerPanneau({ portSite: 4192, portApi: 8812 });
  await fetch("http://127.0.0.1:8812/api/health");
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
    await page.route("https://api.github.com/**", (route) => route.abort());
    await page.goto(`${panneau.site}/admin/`);
    await page.locator("#factice-adresse").fill(ADRESSE_ADMIN);
    await page.getByRole("button", { name: "Connexion factice" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    const photo = (nom: string, pleine = true) => page.screenshot({ path: join(OUT, `lot-N3-${QUAND}-${nom}-${format.slug}.png`), fullPage: pleine });

    // Le menu : ordinateur, le menu replié à gauche ; téléphone, l'ancien bouton « Menu » ouvert, ou la feuille d'une rubrique.
    if (format.mobile) {
      const ancien = page.getByRole("button", { name: "Menu", exact: true });
      if (await ancien.count()) await ancien.click();
      else await page.locator('[data-onglet="communaute"]').click();
      await photo("menu", false);
      if (await ancien.count()) await ancien.click();
      else await page.keyboard.press("Escape");
    } else await photo("menu", false);

    await page.goto(`${panneau.site}/admin/#/jeux`);
    await expect(page.getByRole("heading", { level: 1, name: "Jeux" })).toBeVisible();
    await expect(page.locator('[data-jeu-admin="track"], .admin-jeu').first()).toBeVisible();
    await photo("jeux");
    // Après seulement : un jeu fermé passe en aperçu en un clic, le bandeau « Annuler » est là.
    if (QUAND === "apres") {
      await page.locator('[data-jeu-admin="tower"]').getByRole("button", { name: "Aperçu", exact: true }).click();
      await expect(page.locator("#jeux-annuler .admin-annuler")).toBeVisible();
      await photo("jeux-apercu-annuler", false);
      await page.locator("#jeux-annuler").getByRole("button", { name: /Annuler/ }).click();
    }
    await page.goto(`${panneau.site}/admin/#/tableau`);
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    await photo("tableau");
    // L'habillage des autres pages (après seulement : le titre, le sous-titre et les outils à droite).
    if (QUAND === "apres") {
      await page.goto(`${panneau.site}/admin/#/joueurs`);
      await expect(page.getByRole("heading", { level: 1, name: "Joueurs" })).toBeVisible();
      await photo("joueurs", false);
    }
    await context.close();
  });
}
