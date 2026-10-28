import { PREMIER_JOUR, formatDay } from "@cdj/sim";
import { expect, newClockedContext, test, TODAY } from "./fixtures";
import { auditAxe } from "./axe";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Les outils d'administration de Track (`/track/admin/`) ne s'ouvrent que par la connexion du panneau d'administration de la plateforme (SSO Google ; ici le vérificateur
// factice, jamais en ligne) : sans session la page ne montre aucun outil et ne lit rien ; avec elle, le planning se lit et se remplace comme avant, sans jeton. La page de Track est
// servie **sur la même origine que l'API**, comme en production. Un seul parcours ; ports 4194 et 8814 réservés.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let panneau: Panneau;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  panneau = await demarrerPanneau({ portSite: 4194, portApi: 8814, track: true });
  await fetch("http://127.0.0.1:8814/api/health");
  panneau.peupler();
});

test.afterAll(async () => {
  await panneau?.arreter();
});

test("sans connexion rien ne s'ouvre › connexion au panneau et retour › planning, remplacement, médailles › session expirée : la porte se referme", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route("https://api.github.com/**", (route) => route.abort());
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  const appelsAdmin: string[] = [];
  page.on("request", (r) => {
    const chemin = new URL(r.url()).pathname;
    if (chemin.startsWith("/api/admin/")) appelsAdmin.push(`${r.method()} ${chemin}`);
  });

  // --- Sans session : la porte, aucun outil, rien d'autre lu que la session -------------------------------------------------------
  const adresse = `${panneau.site}/track/admin/?api=%2F`;
  const reponse = await page.goto(adresse);
  expect(reponse!.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator("#acces-titre")).toHaveText("Connexion requise");
  await expect(page.locator("#outils")).toBeHidden();
  await expect(page.locator("#planning")).toBeHidden();
  await expect(page.locator("#launch")).toBeHidden();
  const lien = page.locator("#acces-connexion");
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "../../admin/?retour=%2Ftrack%2Fadmin%2F");
  expect(appelsAdmin).toEqual(["GET /api/admin/session"]);
  expect(await page.evaluate(() => localStorage.getItem("cdj:admin-token"))).toBeNull();
  await auditAxe(page);

  // L'ancien jeton gardé dans le navigateur n'ouvre rien et s'efface.
  await page.evaluate(() => localStorage.setItem("cdj:admin-token", "e2e-admin-token-0123456789"));
  await page.reload();
  await expect(page.locator("#acces-titre")).toHaveText("Connexion requise");
  expect(await page.evaluate(() => localStorage.getItem("cdj:admin-token"))).toBeNull();
  await expect(page.locator("#outils")).toBeHidden();

  // --- Le lien mène au panneau, qui ramène ici une fois connecté (le retour est une liste fermée) --------------------------------
  await lien.click();
  await expect(page).toHaveURL(/\/admin\/\?retour=%2Ftrack%2Fadmin%2F$/);
  await page.locator("#factice-adresse").fill(ADRESSE_ADMIN);
  await page.getByRole("button", { name: "Connexion factice" }).click();
  await expect(page).toHaveURL(`${panneau.site}/track/admin/`);
  // Revenue sans `?api=` : la page s'appuie sur l'API de la construction ; ici le site de test n'en a pas : on rouvre avec l'adresse même origine.
  await page.goto(adresse);
  await expect(page.locator("#outils")).toBeVisible();
  await expect(page.locator("#acces")).toBeHidden();
  await expect(page.locator("#barre-acces")).toHaveText("Connecté");
  await expect(page.locator("#conn-state")).toContainText("session du panneau d'administration");
  await expect(page.locator("#planning .card")).toHaveCount(14);
  await expect(page.locator("#token-form")).toHaveCount(0); // plus de jeton à saisir
  await auditAxe(page);

  // --- Remplacer un circuit à venir, puis revenir à l'original (écrit par la session : `X-Cdj-Admin` et l'origine du site) -----------
  const date = formatDay(TODAY + 2);
  const carte = page.locator(`#planning .card[data-date="${date}"]`);
  await carte.getByRole("button", { name: "Remplacer" }).click();
  const premiere = page.locator("#candidates .candidate").first();
  await expect(premiere.locator("dl.stats")).toContainText("Temps du pilote", { timeout: 60_000 });
  await premiere.getByRole("button", { name: "Choisir" }).click();
  await premiere.getByRole("button", { name: "Confirmer" }).click();
  await expect(carte).toHaveAttribute("data-variant", "1", { timeout: 30_000 });
  const apercu = await (await page.request.get(`${panneau.site}/api/admin/overview`)).json();
  expect(apercu.plan).toMatchObject([{ date, variant: 1, theme: null }]);
  await carte.getByRole("button", { name: "Remplacer" }).click();
  await page.getByRole("button", { name: "Revenir à l'original" }).click();
  await page.locator("#replace").getByRole("button", { name: "Confirmer" }).click();
  await expect(carte).toHaveAttribute("data-variant", "0", { timeout: 30_000 });
  expect((await (await page.request.get(`${panneau.site}/api/admin/overview`)).json()).plan).toEqual([]);

  // --- Médailles : lecture seule, un tableau par thème et par jour ---------------------------------------------------------------
  await page.getByRole("button", { name: "Charger les médailles" }).click();
  await expect(page.locator("#med-state")).toContainText("jours");
  await expect(page.locator("#med-days tr")).toHaveCount(TODAY - PREMIER_JOUR + 1);

  // --- La session expire : « Actualiser » referme la porte ----------------------------------------------------------------------
  await context.clearCookies();
  await page.getByRole("button", { name: "Actualiser" }).click();
  await expect(page.locator("#acces-titre")).toHaveText("Connexion requise");
  await expect(page.locator("#outils")).toBeHidden();
  expect(erreurs).toEqual([]);

  // --- Téléphone : rien ne déborde de côté ---------------------------------------------------------------------------------------
  await context.close();
});
