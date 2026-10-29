import { formatDay } from "@cdj/sim";
import { expect, newClockedContext, test, TODAY } from "./fixtures";
import { auditAxe } from "./axe";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Les outils d'administration de Jump (`/jump/admin/`) ne s'ouvrent que par la connexion du panneau d'administration de la plateforme (SSO Google ; ici le vérificateur factice, jamais
// en ligne), comme ceux de Track : sans session la page ne montre aucun outil et ne lit rien ; avec elle, le calendrier et les outils de test s'ouvrent. La page de Jump est servie **sur la
// même origine que l'API**, comme en production. Un seul parcours ; ports 4197 et 8817 réservés.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let panneau: Panneau;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  panneau = await demarrerPanneau({ portSite: 4197, portApi: 8817, jump: true });
  await fetch("http://127.0.0.1:8817/api/health");
});

test.afterAll(async () => {
  await panneau?.arreter();
});

test("sans connexion rien ne s'ouvre › connexion au panneau et retour › calendrier et outils › données locales › session expirée : la porte se referme", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route("https://api.github.com/**", (route) => route.abort());
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  const appelsAdmin: string[] = [];
  page.on("request", (r) => {
    const chemin = new URL(r.url()).pathname;
    if (chemin.startsWith("/api/")) appelsAdmin.push(`${r.method()} ${chemin}`);
  });

  // --- Sans session : la porte, aucun outil, rien d'autre lu que la session -------------------------------------------------------
  const adresse = `${panneau.site}/jump/admin/?api=%2F`;
  const reponse = await page.goto(adresse);
  expect(reponse!.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator("#acces-titre")).toHaveText("Connexion requise");
  await expect(page.locator("#outils")).toBeHidden();
  await expect(page.locator("#calendrier tr")).toHaveCount(0);
  await expect(page.locator("#launch")).toBeHidden();
  const lien = page.locator("#acces-connexion");
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "../../admin/?retour=%2Fjump%2Fadmin%2F");
  expect(appelsAdmin).toEqual(["GET /api/admin/session"]);
  await auditAxe(page, "jump-admin-porte");

  // --- Le lien mène au panneau, qui ramène ici une fois connecté (le retour est une liste fermée) --------------------------------
  await lien.click();
  await expect(page).toHaveURL(/\/admin\/\?retour=%2Fjump%2Fadmin%2F$/);
  await page.locator("#factice-adresse").fill(ADRESSE_ADMIN);
  await page.getByRole("button", { name: "Connexion factice" }).click();
  await expect(page).toHaveURL(`${panneau.site}/jump/admin/`);
  // Revenue sans `?api=` : la page s'appuie sur l'API de la construction ; ici le site de test n'en a pas : on rouvre avec l'adresse même origine.
  await page.goto(adresse);
  await expect(page.locator("#outils")).toBeVisible();
  await expect(page.locator("#acces")).toBeHidden();
  await expect(page.locator("#barre-acces")).toHaveText("Connecté");
  await expect(page.locator("#conn-state")).toContainText("session du panneau d'administration");
  await auditAxe(page, "jump-admin-outils");

  // --- Aujourd'hui et le calendrier : le code du jeu, 7 jours avant et 14 après ----------------------------------------------------
  await expect(page.locator("#daynow")).toContainText(formatDay(TODAY));
  await expect(page.locator("#calendrier tr")).toHaveCount(22);
  await expect(page.locator(`#calendrier tr[data-date="${formatDay(TODAY)}"]`)).toHaveAttribute("data-etat", "aujourdhui");
  await expect(page.locator(`#calendrier tr[data-date="${formatDay(TODAY + 3)}"]`)).toHaveAttribute("data-etat", "avenir");
  await expect(page.locator(`#calendrier tr[data-date="${formatDay(TODAY - 1)}"] a`).first()).toHaveAttribute("href", `../?seed=${formatDay(TODAY - 1)}&accueil=0`);

  // --- Les outils de test : l'adresse du jeu suit les choix, le lien lance le jeu ------------------------------------------------
  await expect(page.locator("#launch")).toHaveAttribute("href", "../?api=%2F"); // `?api=` de la page est repris dans le lien du jeu, comme sur /track/admin/
  await page.getByRole("button", { name: /Boîtes de collision/ }).click();
  await expect(page.locator("#launch")).toHaveAttribute("href", "../?scenario=essai&debug&hitbox&api=%2F");
  await expect(page.locator("#url")).toHaveText(`${panneau.site}/jump/?scenario=essai&debug&hitbox&api=%2F`);
  await page.getByRole("button", { name: "Réinitialiser les choix" }).click();
  await page.getByLabel("Date", { exact: true }).fill(formatDay(TODAY - 2));
  await page.locator("#theme").selectOption("neon");
  await page.locator("#fxOff").check();
  await expect(page.locator("#launch")).toHaveAttribute("href", `../?seed=${formatDay(TODAY - 2)}&theme=neon&fx=off`);
  await page.getByRole("radio", { name: "Variété de la semaine" }).check();
  await expect(page.locator("#launch")).toHaveAttribute("href", `../?semaine=${formatDay(TODAY - 2)}&fx=off`); // le thème ne s'applique pas à l'outil de la variété
  await page.getByRole("radio", { name: "Niveau du jour" }).check();
  // Les choix sont gardés dans ce navigateur et retrouvés à la réouverture.
  await page.reload();
  await expect(page.locator("#outils")).toBeVisible();
  await expect(page.locator("#theme")).toHaveValue("neon");
  expect(await page.evaluate(() => localStorage.getItem("jump:admin"))).toContain('"theme":"neon"');
  await expect(page.locator("#launch")).toHaveAttribute("href", `../?seed=${formatDay(TODAY - 2)}&theme=neon&fx=off&api=%2F`);

  // --- Données locales : seules les clés du jeu partent, pas les choix de la page ni celles de Track -----------------------------
  await page.evaluate(() => {
    localStorage.setItem("jump:meilleur:x", "1");
    localStorage.setItem("cdj:player", "garde");
  });
  await page.reload();
  await expect(page.locator("#keys")).toContainText("jump:meilleur:x");
  await expect(page.locator("#keys")).not.toContainText("jump:admin");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Effacer les données du jeu" }).click();
  await expect(page.locator("#wiped")).toHaveText("Effacé.");
  expect(await page.evaluate(() => [localStorage.getItem("jump:meilleur:x"), localStorage.getItem("cdj:player"), localStorage.getItem("jump:admin") !== null])).toEqual([null, "garde", true]);

  // --- La session expire : « Actualiser » referme la porte ----------------------------------------------------------------------
  await context.clearCookies();
  await page.getByRole("button", { name: "Actualiser" }).click();
  await expect(page.locator("#acces-titre")).toHaveText("Connexion requise");
  await expect(page.locator("#outils")).toBeHidden();
  expect(erreurs).toEqual([]);
  await context.close();
});
