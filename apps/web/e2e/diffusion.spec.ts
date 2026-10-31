import { expect, newClockedContext, test } from "./fixtures";
import { auditAxe } from "./axe";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

/** Axe lit les couleurs **calculées** : une transition de couleur d'un bouton qui vient de s'activer fausserait le contraste (vu en CI, plus lente) — on attend qu'aucune animation ne tourne. */
const apresTransitions = (page: import("@playwright/test").Page) => page.waitForFunction(() => document.getAnimations().length === 0);

// Lot N2 (plateforme) : **un seul test dans le navigateur** (règle R13) — l'éditeur publie un message en direct depuis le panneau › il apparaît sur le portail (une seule requête au
// chargement, rien relu avant 60 s), se ferme, ne revient que s'il change ; au passage la rédaction d'une nouveauté à partir d'une PR de GitHub (réponse de GitHub simulée : la CSP
// de `/admin/` est celle de `firebase.json`, donc `api.github.com` y est vraiment autorisé) › la ligne « Nouveautés » avec son point › la page `/nouveautes/`. Tout le reste est testé en
// unitaire : lecture d'une ligne « Pour les joueurs », publication bloquée sans anglais, fin du message, en-têtes de cache (`apps/api/test/diffusion.test.ts`, `packages/core/test/nouveautes.test.ts`,
// `packages/profile/test/annonce.test.ts`, `apps/portail/test/nouveautes.test.ts`, `adminGithub.test.ts`). Ports 4192 et 8812 réservés.
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

let panneau: Panneau;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  panneau = await demarrerPanneau({ portSite: 4192, portApi: 8812 });
  await fetch("http://127.0.0.1:8812/api/health");
});

test.afterAll(async () => {
  await panneau?.arreter();
});

const CORS = { "access-control-allow-origin": "*" };
const pr = (numero: number, titre: string, fusion: string, body: string, labels: string[] = []) => ({
  number: numero,
  title: titre,
  html_url: `https://github.com/Nathan-Te/DailyTrack/pull/${numero}`,
  body,
  labels: labels.map((name) => ({ name })),
  pull_request: { merged_at: fusion },
});

test("publier un message › il apparaît sur le portail ; une nouveauté depuis une PR › la ligne de l'accueil et /nouveautes/", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const violations: string[] = [];
  const surveiller = (page: import("@playwright/test").Page) => {
    page.on("console", (m) => {
      if (/content security policy|csp/i.test(m.text())) violations.push(m.text());
    });
    page.on("pageerror", (e) => violations.push(e.message));
  };

  // --- Le portail, avant : ni bandeau ni ligne « Nouveautés » ; une seule requête au chargement, rien relu avant 60 s ---------------------------------
  const portail = await context.newPage();
  surveiller(portail);
  const requetes: string[] = [];
  portail.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) requetes.push(u.pathname);
  });
  await portail.goto(`${panneau.site}/`);
  await expect(portail.locator("#jeux .dj-cartouche, #jeux [data-jeu]").first()).toBeVisible();
  await expect(portail.locator(".dj-bandeau")).toHaveCount(0);
  await expect(portail.locator("#nouveautes")).toHaveCount(0);
  await portail.waitForTimeout(1500); // « rien ne doit arriver » : aucune relecture avant la première minute
  expect(requetes.filter((p) => p === "/api/portail/jour")).toHaveLength(1);
  expect(requetes).not.toContain("/api/annonce");

  // --- Le panneau (connexion factice), GitHub simulé ------------------------------------------------------------------------------------------------
  const admin = await context.newPage();
  surveiller(admin);
  await admin.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/git/matching-refs/")) return route.fulfill({ json: [{ ref: "refs/tags/prod-2026-10-12-0900" }, { ref: "refs/tags/prod-2026-10-19-1830" }], headers: CORS });
    return route.fulfill({
      json: {
        total_count: 3,
        items: [
          pr(901, "Le bouton caméra revient", "2026-10-18T10:00:00Z", "## Pour les joueurs\n- [Track] Le bouton caméra revient à l'écran sur téléphone.\n", ["jeu:track"]),
          pr(902, "Refonte interne", "2026-10-20T08:00:00Z", "## Pour les joueurs\nrien"),
          pr(903, "Jours figés — prod-2026-10-19-1830", "2026-10-19T19:00:00Z", ""),
        ],
      },
      headers: CORS,
    });
  });
  await admin.goto(`${panneau.site}/admin/`);
  await admin.locator("#factice-adresse").fill(ADRESSE_ADMIN);
  await admin.getByRole("button", { name: "Connexion factice" }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect(admin.locator('[data-etat="pr"]')).toContainText("2"); // 901 et 902 : la PR « robot » n'est pas comptée

  // --- Nouveautés : la PR, ses lignes, l'anglais manquant bloque la publication, puis on publie -------------------------------------------------------
  await admin.locator('[data-menu="nouveautes"]').click();
  await expect(admin.getByRole("heading", { level: 1, name: "Nouveautés" })).toBeVisible();
  await expect(admin.locator('#prs li[data-pr="901"]')).toContainText("Le bouton caméra revient");
  await expect(admin.locator('#prs li[data-pr="902"]')).toHaveCount(0); // « rien » : cachée par défaut
  await admin.locator('#prs li[data-pr="901"] input[type="checkbox"]').check();
  await expect(admin.locator("#nouveautes-lignes li")).toHaveCount(1);
  await admin.locator("#nouveaute-titre-fr").fill("Le bouton caméra revient");
  await admin.locator("#nouveaute-titre-en").fill("The camera button is back");
  await expect(admin.locator("#nouveautes-problemes")).toContainText("Anglais : 1 ligne pas encore traduite");
  await expect(admin.locator("#nouveautes-publier")).toBeDisabled();
  await admin.locator('#nouveautes-lignes [data-champ="en"]').fill("The camera button is back on screen on phones.");
  await expect(admin.locator("#nouveautes-publier")).toBeEnabled();
  await admin.locator("#nouveautes-apercu-bouton").click();
  await expect(admin.locator('#nouveautes-apercu [data-langue="en"]')).toContainText("The camera button is back on screen on phones.");
  await apresTransitions(admin);
  await auditAxe(admin, "panneau-nouveautes");
  await admin.locator("#nouveautes-publier").click();
  await admin.getByRole("dialog").getByRole("button", { name: "Publier", exact: true }).click();
  await expect(admin.locator("#nouveautes-message")).toContainText("publiée");
  await expect(admin.locator('#nouveautes-gestion [data-statut="publiee"]')).toHaveCount(1);

  // --- Échanger un changelog : exporter, réimporter (déjà là), importer une autre nouveauté : elle arrive en brouillon, jamais publiée -----------------------
  await admin.locator("#export-tout").click();
  const exporte = await admin.locator("#export-texte").inputValue();
  expect(JSON.parse(exporte)).toMatchObject({ format: "cdj-nouveautes", version: 1, nouveautes: [{ statut: "publiee", titre: { fr: "Le bouton caméra revient" } }] });
  const [telechargement] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("button", { name: "Télécharger le fichier" }).click()]);
  expect(telechargement.suggestedFilename()).toMatch(/^nouveautes-\d{4}-\d\d-\d\d\.json$/);
  await admin.locator("#import-texte").fill("pas du json");
  await admin.locator("#import-valider").click();
  await expect(admin.locator("#nouveautes-message")).toContainText("pas du JSON lisible");
  await admin.locator("#import-texte").fill(exporte);
  await admin.locator("#import-valider").click();
  await expect(admin.locator("#nouveautes-message")).toContainText("déjà dans la liste");
  const autre = JSON.parse(exporte);
  autre.nouveautes[0].titre = { fr: "Une autre nouveauté", en: "Another update" };
  await admin.locator("#import-texte").fill(JSON.stringify(autre));
  await admin.locator("#import-valider").click();
  await admin.getByRole("dialog").getByRole("button", { name: "Importer", exact: true }).click();
  await expect(admin.locator("#nouveautes-message")).toContainText("importée en brouillon");
  await expect(admin.locator('#nouveautes-gestion [data-statut="brouillon"]')).toHaveCount(1);
  await expect(admin.locator('#nouveautes-gestion [data-statut="publiee"]')).toHaveCount(1); // rien n'a été publié par l'import

  // --- Le portail : la ligne « Nouveautés » avec son point, puis la page ----------------------------------------------------------------------------
  await portail.reload();
  const ligne = portail.locator("#nouveautes");
  await expect(ligne).toContainText("Le bouton caméra revient");
  await expect(portail.locator("#nouveautes-point")).toBeVisible();
  await ligne.click();
  await expect(portail).toHaveURL(/\/nouveautes\/$/);
  await expect(portail.locator("article.nouveautes-mise-a-jour h3")).toHaveText("Le bouton caméra revient");
  await expect(portail.locator(".nouveautes-ligne")).toContainText("Track");
  await expect(portail.locator(".nouveautes-ligne")).toContainText("Le bouton caméra revient à l'écran sur téléphone.");
  await apresTransitions(portail);
  await auditAxe(portail, "nouveautes");
  await portail.goBack();
  await expect(portail.locator("#nouveautes")).toBeVisible();
  await expect(portail.locator("#nouveautes-point")).toHaveCount(0); // lue sur cet appareil

  // --- Message en direct : écrire, mettre à jour ------------------------------------------------------------------------------------------------------
  await admin.locator('[data-menu="message"]').click();
  await expect(admin.getByRole("heading", { level: 1, name: "Message en direct" })).toBeVisible();
  await admin.locator("#message-fr").fill("Maintenance ce soir à 22 h : le classement sera figé dix minutes.");
  await expect(admin.locator("#message-envoyer")).toBeDisabled(); // l'anglais manque
  await admin.locator("#message-en").fill("Maintenance tonight at 10 pm: the leaderboard will freeze for ten minutes.");
  await admin.locator("#message-fr").fill("Va sur https://exemple.test");
  await expect(admin.locator("#message-problemes")).toContainText("ni lien ni HTML"); // texte seul
  await admin.locator("#message-fr").fill("Maintenance ce soir à 22 h : le classement sera figé dix minutes.");
  await expect(admin.locator("#message-envoyer")).toBeEnabled();
  await apresTransitions(admin);
  await auditAxe(admin, "panneau-message");
  await admin.locator("#message-envoyer").click();
  await admin.getByRole("dialog").getByRole("button", { name: "Diffuser", exact: true }).click();
  await expect(admin.locator("#message-retour")).toContainText("Message diffusé");
  await expect(admin.locator("#message-actif")).toContainText("Maintenance ce soir à 22 h");

  // --- Le portail le montre (la réponse de l'accueil le porte : une seule requête), sans prendre le focus ----------------------------------------
  requetes.length = 0;
  await portail.reload();
  const bandeau = portail.locator(".dj-bandeau");
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toHaveAttribute("role", "status");
  await expect(bandeau).toContainText("Maintenance ce soir à 22 h");
  expect(await portail.evaluate(() => document.activeElement === document.body || document.activeElement?.closest(".dj-bandeau") === null)).toBe(true);
  expect(requetes.filter((p) => p === "/api/portail/jour")).toHaveLength(1);
  expect(requetes).not.toContain("/api/annonce"); // le message est dans la réponse de l'accueil : aucune requête de plus au chargement
  await apresTransitions(portail);
  await auditAxe(portail, "portail-bandeau");

  // `GET /api/annonce` seul : public, partagé 30 s par le cache de Hosting.
  const seule = await fetch("http://127.0.0.1:8812/api/annonce");
  expect(seule.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=30");
  expect((await seule.json()).annonce).toMatchObject({ ou: ["portail", "track", "jump", "tower"], ton: "information" });

  // --- Fermé, il ne revient pas au rechargement ; il revient quand le message change -----------------------------------------------------------------
  await bandeau.getByRole("button", { name: "Fermer le message" }).click();
  await expect(portail.locator(".dj-bandeau")).toHaveCount(0);
  await portail.reload();
  await expect(portail.locator("#jeux [data-jeu]").first()).toBeVisible();
  await expect(portail.locator(".dj-bandeau")).toHaveCount(0);
  await admin.locator("#message-fr").fill("Retour à la normale : merci de ta patience.");
  await admin.locator("#message-en").fill("Back to normal: thanks for your patience.");
  await admin.locator("#message-ton-important").check();
  await admin.locator("#message-envoyer").click();
  await admin.getByRole("dialog").getByRole("button", { name: "Mettre à jour", exact: true }).click();
  await expect(admin.locator("#message-retour")).toContainText("Message diffusé");
  await portail.reload();
  await expect(portail.locator(".dj-bandeau")).toContainText("Retour à la normale");
  await expect(portail.locator(".dj-bandeau")).toHaveAttribute("data-ton", "important");
  await expect(portail.locator(".dj-bandeau__fermer")).toBeHidden(); // « Important » ne se ferme qu'après 10 s

  // --- Retirer maintenant : le portail ne l'a plus au rechargement ---------------------------------------------------------------------------------------
  await admin.getByRole("button", { name: "Retirer maintenant" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Retirer maintenant", exact: true }).click();
  await expect(admin.locator("#message-retour")).toContainText("Message retiré");
  await portail.reload();
  await expect(portail.locator("#jeux [data-jeu]").first()).toBeVisible();
  await expect(portail.locator(".dj-bandeau")).toHaveCount(0);

  expect(violations).toEqual([]);
});
