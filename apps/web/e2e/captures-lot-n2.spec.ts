import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, newClockedContext, test } from "./fixtures";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Captures du README du lot N2 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-n2 --project=chromium` (`OUT=…` change le dossier).
// L'accueil du portail avec le bandeau et la ligne « Nouveautés » (point terre), `/nouveautes/`, et les deux rubriques du panneau (Nouveautés avec GitHub simulé, Message en direct).
// Vérificateur factice, données fictives. Ports 4193 et 8813.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "Chromium seulement");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

let panneau: Panneau;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  panneau = await demarrerPanneau({ portSite: 4193, portApi: 8813 });
  await fetch("http://127.0.0.1:8813/api/health");
});
test.afterAll(async () => {
  await panneau?.arreter();
});

const CORS = { "access-control-allow-origin": "*" };
const pr = (numero: number, titre: string, fusion: string, body: string, labels: string[] = []) => ({ number: numero, title: titre, html_url: `https://github.com/Nathan-Te/DailyTrack/pull/${numero}`, body, labels: labels.map((name) => ({ name })), pull_request: { merged_at: fusion } });

for (const format of [
  { slug: "ordinateur", width: 1280, height: 900, mobile: false },
  { slug: "telephone", width: 390, height: 844, mobile: true },
]) {
  test(`captures ${format.slug}`, async ({ browser }) => {
    const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: format.width, height: format.height }, isMobile: format.mobile, hasTouch: format.mobile, deviceScaleFactor: format.mobile ? 2 : 1 });
    const admin = await context.newPage();
    await admin.route("https://api.github.com/**", (route) => {
      if (route.request().url().includes("/git/matching-refs/")) return route.fulfill({ json: [{ ref: "refs/tags/prod-2026-10-12-0900" }, { ref: "refs/tags/prod-2026-10-19-1830" }], headers: CORS });
      return route.fulfill({
        json: {
          total_count: 3,
          items: [
            pr(171, "Le bouton caméra revient sur téléphone", "2026-10-18T10:00:00Z", "## Pour les joueurs\n- [Track] Le bouton caméra revient à l'écran sur téléphone. // The camera button is back on screen on phones.\n- [Du Jour] Le classement du jour se lit au chrono.\n", ["jeu:track"]),
            pr(172, "Jump : thème Nuit", "2026-10-20T08:00:00Z", "## Pour les joueurs\n- [Jump] Le thème Nuit arrive. // The Night theme arrives.\n- [Jump] Un chrono plus lisible\n"),
            pr(173, "Refonte interne", "2026-10-20T09:00:00Z", "## Pour les joueurs\nrien"),
          ],
        },
        headers: CORS,
      });
    });
    await admin.goto(`${panneau.site}/admin/`);
    await admin.locator("#factice-adresse").fill(ADRESSE_ADMIN);
    await admin.getByRole("button", { name: "Connexion factice" }).click();
    await expect(admin.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    const ouvrir = async (menu: string) => {
      if (format.mobile) await admin.getByRole("button", { name: "Menu" }).click();
      await admin.locator(`[data-menu="${menu}"]`).click();
    };
    await ouvrir("nouveautes");
    await expect(admin.locator("#prs > li")).toHaveCount(2);
    await admin.locator('#prs li[data-pr="171"] input[type="checkbox"]').check();
    await admin.locator('#prs li[data-pr="172"] input[type="checkbox"]').check();
    await admin.locator("#nouveaute-titre-fr").fill("Le bouton caméra revient, Jump passe de nuit");
    await admin.locator("#nouveaute-titre-en").fill("The camera button is back, Jump goes dark");
    await admin.locator("#nouveautes-apercu-bouton").click();
    await expect(admin.locator("#nouveautes-problemes")).toContainText("Anglais");
    await admin.screenshot({ path: join(OUT, `lot-N2-admin-nouveautes-${format.slug}.png`), fullPage: true });
    // On complète l'anglais, on publie, puis le message.
    await admin.locator('#nouveautes-lignes li:nth-child(2) [data-champ="en"]').fill("The daily leaderboard is ranked against the clock.");
    await admin.locator('#nouveautes-lignes li:nth-child(4) [data-champ="en"]').fill("A clearer timer");
    await admin.locator("#nouveautes-publier").click();
    await admin.getByRole("dialog").getByRole("button", { name: "Publier", exact: true }).click();
    await expect(admin.locator("#nouveautes-message")).toContainText("publiée");
    await ouvrir("message");
    await admin.locator("#message-fr").fill("Maintenance ce soir à 22 h : le classement sera figé dix minutes.");
    await admin.locator("#message-en").fill("Maintenance tonight at 10 pm: the leaderboard will freeze for ten minutes.");
    await admin.locator("#message-ton-important").check();
    await admin.locator("#message-envoyer").click();
    await admin.getByRole("dialog").getByRole("button", { name: "Diffuser", exact: true }).click();
    await expect(admin.locator("#message-retour")).toContainText("Message diffusé");
    await admin.screenshot({ path: join(OUT, `lot-N2-admin-message-${format.slug}.png`), fullPage: true });

    const portail = await context.newPage();
    await portail.goto(`${panneau.site}/`);
    await expect(portail.locator("#nouveautes-point")).toBeVisible();
    await expect(portail.locator(".dj-bandeau")).toBeVisible();
    await portail.screenshot({ path: join(OUT, `lot-N2-portail-${format.slug}.png`), fullPage: true });
    await portail.locator("#nouveautes").click();
    await expect(portail.locator("article.nouveautes-mise-a-jour")).toBeVisible();
    await portail.screenshot({ path: join(OUT, `lot-N2-nouveautes-${format.slug}.png`), fullPage: true });
    // On nettoie pour le format suivant : message retiré, nouveauté supprimée.
    await admin.getByRole("button", { name: "Retirer maintenant" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Retirer maintenant", exact: true }).click();
    await expect(admin.locator("#message-retour")).toContainText("Message retiré");
    await context.close();
  });
}
