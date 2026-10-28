import { expect, newClockedContext, test } from "./fixtures";
import { auditAxe } from "./axe";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Lot N1 (plateforme) : le panneau d'administration de bout en bout — connexion (vérificateur factice, jamais en ligne), tableau de bord, un joueur, le renommer, le journal.
// La page est servie **sous la CSP de `/admin/`** (celle de `firebase.json`) : aucune violation, aucun script ni style en ligne. Le reste (les cinq actions et leur effet sur
// les classements, la vérification Google, les protections) est testé par `apps/api/test/admin*.test.ts`. Un seul test dans le navigateur ; en fin de parcours la page passe au
// format téléphone (menu replié, pas de défilement de côté, cibles de 44 px). Ports 4190 et 8810 réservés.
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let panneau: Panneau;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  panneau = await demarrerPanneau({ portSite: 4190, portApi: 8810 });
  // Le schéma est créé par la première requête de l'API ; les joueurs fictifs sont écrits dans la base du fichier.
  await fetch("http://127.0.0.1:8810/api/health");
  panneau.peupler();
});

test.afterAll(async () => {
  await panneau?.arreter();
});

test("connexion › tableau de bord › joueur › renommer › journal, sous la CSP de /admin/", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.route("https://api.github.com/**", (route) => route.abort()); // la lecture de GitHub (lot N2) : coupée, la page le dit sans rien bloquer
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/content security policy|csp/i.test(m.text())) violations.push(m.text());
  });
  page.on("pageerror", (e) => violations.push(e.message));

  // --- La page : noindex, CSP de firebase.json, rien en ligne ----------------------------------------------------------------
  const reponse = await page.goto(`${panneau.site}/admin/`);
  expect(reponse!.headers()["x-robots-tag"]).toContain("noindex");
  const csp = reponse!.headers()["content-security-policy"]!;
  expect(csp).toContain("script-src 'self' https://accounts.google.com/gsi/client");
  expect(csp).not.toContain("unsafe-inline");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await page.locator("script:not([src])").count()).toBe(0);
  await expect(page.getByRole("heading", { level: 1, name: "Administration" })).toBeVisible();

  // --- Une autre adresse est refusée (sans dire pourquoi) ---------------------------------------------------------------------
  await page.locator("#factice-adresse").fill("intrus@example.test");
  await page.getByRole("button", { name: "Connexion factice" }).click();
  await expect(page.getByRole("alert")).toHaveText("Connexion refusée.");
  await expect(page.locator("#factice-form")).toBeVisible();

  // --- L'adresse de la liste entre : cookie de session HttpOnly, Secure, SameSite=Strict, invisible de la page ---------------
  await page.locator("#factice-adresse").fill(ADRESSE_ADMIN);
  await page.getByRole("button", { name: "Connexion factice" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  const cookies = (await context.cookies()).filter((c) => c.name === "__session");
  expect(cookies).toHaveLength(1);
  expect(cookies[0]).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
  expect(await page.evaluate(() => document.cookie)).toBe(""); // la page ne voit jamais la session
  expect(JSON.stringify(cookies[0])).not.toContain("admin%40"); // pas d'adresse dans le cookie

  // --- Tableau de bord ------------------------------------------------------------------------------------------------------
  const chiffres = page.locator("#chiffres");
  await expect(chiffres).toContainText("Joueurs aujourd'hui");
  await expect(chiffres.locator(".dj-tuile").nth(0).locator(".dj-tuile__valeur")).toHaveText("3");
  await expect(chiffres.locator(".dj-tuile").nth(0).locator(".dj-tuile__sous-texte")).toHaveText("hier : 2");
  await expect(chiffres.locator(".dj-tuile").nth(1).locator(".dj-tuile__valeur")).toHaveText("1"); // Chloé, créée aujourd'hui
  await expect(chiffres.locator(".dj-tuile").nth(2).locator(".dj-tuile__valeur")).toHaveText("3"); // Track finis
  await expect(page.locator("#courbe .admin-courbe__barre")).toHaveCount(14);
  await expect(page.locator('[data-etat="api"]')).toContainText("OK");
  await expect(page.locator('[data-etat="base"]')).toContainText("OK");
  await expect(page.locator('[data-etat="version"]')).toContainText("prod-2026-10-19-1830 · 0123456");
  await expect(page.locator('[data-etat="erreurs"]')).toContainText("0");
  // Lot N2 : la ligne « PR depuis la dernière mise en production » est lue sur GitHub par le navigateur (ici coupé : « GitHub ne répond pas », jamais bloquant).
  await expect(page.locator('[data-etat="pr"]')).toContainText("GitHub ne répond pas");
  await auditAxe(page, "panneau-tableau");

  // --- Le menu : Nouveautés et Message en direct (lot N2), Track mène à ses outils, Jump n'a pas d'outil -----------------------
  await expect(page.locator('[data-menu="nouveautes"]')).toHaveAttribute("href", "#/nouveautes");
  await expect(page.locator('[data-menu="message"]')).toHaveAttribute("href", "#/message");
  await expect(page.locator('[data-menu="jump"]')).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator('[data-menu="track"]')).toHaveAttribute("href", "../track/admin/");

  // --- Joueurs : chercher « Démo », ouvrir la fiche, renommer ---------------------------------------------------------------
  await page.locator('[data-menu="joueurs"]').click();
  await page.locator("#recherche").fill("Démo");
  await page.getByRole("button", { name: "Chercher" }).click();
  await expect(page.locator("#joueurs tbody tr")).toHaveCount(2);
  await page.locator("#joueurs").getByRole("link", { name: "Démo Alice" }).click();
  await expect(page.locator("#fiche-pseudo")).toContainText("Démo Alice");
  await expect(page.locator("#fiche-chiffres")).toContainText("Jours joués");
  await expect(page.locator('[data-jeu="cdj"] tbody tr')).toHaveCount(2);
  await page.getByRole("button", { name: "Renommer" }).click();
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toBeVisible();
  await dialogue.locator("#dialogue-pseudo").fill("Démo Renommée");
  await dialogue.getByRole("button", { name: "Renommer", exact: true }).click();
  await expect(page.locator("#fiche-pseudo")).toContainText("Démo Renommée");
  await expect(page.locator("#fiche-message")).toContainText("Pseudo changé.");
  await auditAxe(page, "panneau-fiche");

  // --- Journal : l'action y est, avec l'avant / après ---------------------------------------------------------------------------
  await page.locator('[data-menu="journal"]').click();
  const ligne = page.locator('#journal tbody tr[data-action="renommer"]');
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText("Démo Alice");
  await expect(ligne).toContainText("pseudo : Démo Alice");
  await expect(ligne).toContainText("pseudo : Démo Renommée");
  expect(await ligne.innerText()).not.toContain("example.test"); // jamais l'adresse de l'administrateur

  // --- Le tableau de bord montre la dernière action ---------------------------------------------------------------------------
  await page.locator('[data-menu="tableau"]').click();
  await expect(page.locator("#dernieres-actions")).toContainText("Renommer");

  // --- Téléphone (390 × 844) : le menu est replié, la page ne défile pas de côté, les cibles font 44 px ---------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#admin-menu")).toBeHidden();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.locator("#admin-menu")).toBeVisible();
  await page.locator('[data-menu="joueurs"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "Joueurs" })).toBeVisible();
  await expect(page.locator("#admin-menu")).toBeHidden(); // replié après le choix
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const b of await page.locator("button, a.dj-bouton, .admin-filtre, input").all()) {
    if (!(await b.isVisible())) continue;
    expect((await b.boundingBox())!.height, "cible de 44 px au moins").toBeGreaterThanOrEqual(43.5);
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- Déconnexion : la session est révoquée côté serveur --------------------------------------------------------------------
  const cookie = (await context.cookies()).find((c) => c.name === "__session")!;
  await page.locator("#admin-deconnexion").click();
  await expect(page.locator("#factice-form")).toBeVisible();
  const apres = await fetch(`http://127.0.0.1:8810/api/admin/tableau`, { headers: { cookie: `__session=${cookie.value}` } });
  expect(apres.status).toBe(401);

  expect(violations).toEqual([]);
});
