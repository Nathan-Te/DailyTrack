import { expect, newClockedContext, test } from "./fixtures";
import { auditAxe } from "./axe";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Lot N1 (plateforme) : le panneau d'administration de bout en bout — connexion (vérificateur factice, jamais en ligne), tableau de bord, un joueur, le renommer, le journal.
// La page est servie **sous la CSP de `/admin/`** (celle de `firebase.json`) : aucune violation, aucun script ni style en ligne. Le reste (les cinq actions et leur effet sur
// les classements, la vérification Google, les protections) est testé par `apps/api/test/admin*.test.ts`. Un seul test dans le navigateur ; en fin de parcours la page passe au
// format téléphone (barre d'onglets, pas de défilement de côté, cibles de 44 px). Lot N3 : la page « Jeux » (un jeu ouvert en un clic puis annulé, un retrait confirmé, une position bloquée,
// un refus affiché sur la ligne, le lien d'aperçu) et le menu en quatre rubriques. Ports 4190 et 8810 réservés.
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
  // Lot N2 (retouche) : la courbe est interactive : le survol (et le clavier) montre le jour et ses joueurs dans une infobulle et dans la ligne au-dessus.
  const zones = page.locator("#courbe .admin-courbe__zone");
  await expect(zones).toHaveCount(14);
  await zones.nth(13).hover();
  await expect(page.locator("#courbe-lecture")).toContainText("(aujourd'hui) · 3 joueurs");
  await expect(page.locator("#courbe .admin-courbe__infobulle")).toBeVisible();
  await zones.nth(13).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#courbe-lecture")).toContainText("joueur");
  await expect(page.locator("#courbe .admin-courbe__barre--actif")).toHaveCount(1);
  await page.mouse.move(5, 5);
  await page.locator("#courbe-lecture").click(); // le focus quitte la courbe : la consigne revient
  await expect(page.locator("#courbe-lecture")).toContainText("Survole");
  await expect(page.locator('[data-etat="api"]')).toContainText("OK");
  await expect(page.locator('[data-etat="base"]')).toContainText("OK");
  await expect(page.locator('[data-etat="version"]')).toContainText("prod-2026-10-19-1830 · 0123456");
  await expect(page.locator('[data-etat="erreurs"]')).toContainText("0");
  // Lot N2 : la ligne « PR depuis la dernière mise en production » est lue sur GitHub par le navigateur (ici coupé : « GitHub ne répond pas », jamais bloquant).
  await expect(page.locator('[data-etat="pr"]')).toContainText("GitHub ne répond pas");
  await auditAxe(page, "panneau-tableau");

  // --- Le menu (lot N3) : quatre rubriques, les adresses d'avant, l'environnement en clair -----------------------------------------------------
  await expect(page.locator(".admin-env")).toHaveText("LOCAL"); // PRODUCTION (terre) et RECETTE (moutarde) se lisent de même
  await expect(page.locator(".admin-menu__rubrique")).toHaveText(["Aujourd'hui", "Communauté", "Diffusion", "Suivi"]);
  for (const [cle, href] of Object.entries({ tableau: "#/tableau", jeux: "#/jeux", joueurs: "#/joueurs", groupes: "#/groupes", images: "#/images", retours: "#/retours", journal: "#/journal" })) {
    await expect(page.locator(`[data-menu="${cle}"]`)).toHaveAttribute("href", href);
  }
  await expect(page.locator('[data-menu="track"]')).toContainText("Outils de Track");
  await expect(page.locator('[data-menu="jump"]')).toContainText("Outils de Jump");
  await expect(page.locator('[data-menu="tableau"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-compteur]")).toHaveCount(0); // rien à voir, aucun retour, GitHub coupé : pas de pastille
  await expect(page.locator("#admin-onglets")).toBeHidden(); // la barre d'onglets est celle du téléphone
  await expect(page.locator('[data-menu="nouveautes"]')).toHaveAttribute("href", "#/nouveautes");
  await expect(page.locator('[data-menu="message"]')).toHaveAttribute("href", "#/message");
  await expect(page.locator('[data-menu="jump"]')).toHaveAttribute("href", "../jump/admin/");
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

  // --- Jeux (lot N3) : une ligne par jeu, l'état en un clic ----------------------------------------------------------------------------------------------
  await page.locator('[data-menu="jeux"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "Jeux" })).toBeVisible();
  const track = page.locator('[data-jeu-admin="track"]');
  const tower = page.locator('[data-jeu-admin="tower"]');
  await expect(page.locator("[data-groupe]")).toHaveCount(2); // En ligne et Fermés : un groupe sans jeu n'est pas montré (aucun jeu en aperçu au départ)
  await expect(track).toContainText("En ligne depuis le 13 oct."); // la mise en ligne de Track, pas la date du semis de la base
  await expect(track.locator('[data-joueurs="track"] b')).toHaveText("3"); // les joueurs du jour : un nombre
  await expect(track.locator(".admin-jeu__cat")).toHaveText("Classé");
  await expect(tower.locator(".admin-jeu__cat")).toHaveText("Arcade");
  await expect(tower).toHaveAttribute("data-etat-jeu", "off");
  await auditAxe(page, "panneau-jeux");

  // Ouvrir un jeu fermé en aperçu : tout de suite, sans fenêtre, avec « Annuler » pendant 8 secondes ; l'annulation remet l'état d'avant.
  await tower.getByRole("button", { name: "Aperçu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(tower).toHaveAttribute("data-etat-jeu", "preview");
  await expect(page.locator('[data-groupe="preview"]')).toContainText("En aperçu · 1");
  const annuler = page.locator("#jeux-annuler");
  await expect(annuler).toContainText("Tower est passé en « Aperçu »");
  await expect(annuler.getByRole("button", { name: /Annuler/ })).toContainText("Annuler · ");
  await annuler.getByRole("button", { name: /Annuler/ }).click();
  await expect(tower).toHaveAttribute("data-etat-jeu", "off");
  await expect(page.locator("#jeux-retour")).toContainText("Tower est revenu à « Off »");
  await expect(annuler.getByRole("button")).toHaveCount(0);

  // Le bandeau s'efface seul au bout de 8 secondes.
  await tower.getByRole("button", { name: "Aperçu", exact: true }).click();
  await expect(annuler.getByRole("button", { name: /Annuler/ })).toBeVisible();
  await expect(annuler.getByRole("button")).toHaveCount(0, { timeout: 12_000 });
  await expect(tower).toHaveAttribute("data-etat-jeu", "preview"); // rien n'a été annulé

  // Le lien d'aperçu : « Nouveau lien d'aperçu » crée la clé et copie le lien en un geste ; l'ancien cesse de marcher (dit sur la ligne) ; « Révoquer » est dans le menu « ⋯ ».
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: panneau.site });
  await tower.getByRole("button", { name: "Nouveau lien d'aperçu" }).click();
  await expect(tower.locator('[data-lien-message="tower"]')).toContainText("Lien copié.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/tower\/\?apercu=[\w-]{20,}$/);
  await expect(tower).toContainText("Un lien existe : en créer un nouveau fait cesser l'ancien.");
  await tower.getByRole("button", { name: "Nouveau lien d'aperçu" }).click();
  await expect(tower.locator('[data-lien-message="tower"]')).toContainText("L'ancien lien ne marche plus.");
  await tower.locator('[data-plus="tower"]').click();
  await tower.getByRole("menuitem", { name: "Révoquer le lien" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Révoquer le lien" }).click();
  await expect(page.locator("#jeux-retour")).toContainText("Lien d'aperçu de Tower révoqué.");
  await tower.locator('[data-plus="tower"]').click();
  await expect(tower.getByRole("menuitem")).toHaveAttribute("aria-disabled", "true"); // plus de lien à révoquer
  await page.keyboard.press("Escape");
  await expect(tower.locator(".admin-plus__menu")).toBeHidden();

  // Retirer un jeu aux joueurs (On vers Off) garde sa fenêtre de confirmation, qui dit combien de joueurs y ont joué aujourd'hui.
  await track.getByRole("button", { name: "Off", exact: true }).click();
  const retrait = page.getByRole("dialog");
  await expect(retrait).toContainText("3 joueurs y ont joué aujourd'hui.");
  await retrait.getByRole("button", { name: "Annuler" }).click(); // renoncer : rien ne change
  await expect(track).toHaveAttribute("data-etat-jeu", "on");
  await track.getByRole("button", { name: "Off", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Passer à Off" }).click();
  await expect(track).toHaveAttribute("data-etat-jeu", "off");
  await expect(annuler.getByRole("button")).toHaveCount(0); // un retrait confirmé n'a pas de bandeau « Annuler »
  await expect(page.locator('[data-groupe="off"]')).toContainText("Fermés");
  await track.getByRole("button", { name: "On", exact: true }).click(); // ouvrir : tout de suite
  await expect(track).toHaveAttribute("data-etat-jeu", "on");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Chercher et filtrer : par nom, puis par catégorie (tirées des fiches).
  await page.locator("#jeux-recherche").fill("tow");
  await expect(page.locator("[data-jeu-admin]")).toHaveCount(1);
  await page.locator("#jeux-recherche").fill("");
  await page.locator('.admin-filtre[data-categorie="arcade"]').click();
  await expect(page.locator('[data-jeu-admin] .admin-jeu__cat:not([data-categorie="arcade"])')).toHaveCount(0);
  await expect(page.locator('.admin-filtre[data-categorie="arcade"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('.admin-filtre[data-categorie="tous"]').click();

  // Ce qui bloque est écrit sur la ligne : la position interdite est grisée (`aria-disabled`) et décrite par la raison, que le clavier et le lecteur d'écran lisent ; un clic dessus ne fait rien.
  // Le serveur est simulé : les fiches du dépôt changent le jour où Nathan remplit l'identité d'un jeu (le refus du serveur est testé par `apps/api/test/jeuxIdentite.test.ts`).
  await page.route("**/api/admin/jeux", async (route) => {
    const reponse = await route.fetch();
    const corps = await reponse.json();
    const blocage = { code: "identite_incomplete", manque: ["police", "illustration"] };
    for (const j of corps.jeux) if (j.jeu === "tower") j.bloque = { off: null, preview: blocage, on: blocage };
    await route.fulfill({ response: reponse, json: corps });
  });
  await tower.getByRole("button", { name: "Off", exact: true }).click(); // aperçu → off : permis, tout de suite
  await page.locator('[data-menu="tableau"]').click();
  await page.locator('[data-menu="jeux"]').click(); // la liste est relue : celle du serveur simulé
  await expect(tower.locator(".admin-jeu__alerte")).toHaveText("Il manque la police et l'illustration");
  const interdit = tower.getByRole("button", { name: "Aperçu", exact: true });
  await expect(interdit).toHaveAttribute("aria-disabled", "true");
  await expect(interdit).toHaveAccessibleDescription("Il manque la police et l'illustration");
  await expect(tower.getByRole("button", { name: "On", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(tower.getByRole("button", { name: "Off", exact: true })).not.toHaveAttribute("aria-disabled", "true");
  await interdit.click({ force: true }); // aria-disabled : Playwright refuse le clic ordinaire ; un vrai doigt, lui, touche
  await expect(tower).toHaveAttribute("data-etat-jeu", "off");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.unroute("**/api/admin/jeux");

  // Lot K5b : le refus du serveur après coup se montre sur la ligne du jeu, en alerte, avec le focus.
  await page.route("**/api/admin/jeux/*/etat", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "identite_incomplete", manque: ["police", "illustration"] }) }),
  );
  await page.locator('[data-menu="tableau"]').click();
  await page.locator('[data-menu="jeux"]').click(); // la liste est relue : sans blocage affiché, le serveur reste le juge
  await tower.getByRole("button", { name: "Aperçu", exact: true }).click(); // ouvrir : sans fenêtre, donc refusé par le serveur tout de suite
  const refus = tower.getByRole("alert");
  await expect(refus).toHaveCount(1); // sur la ligne du jeu, pas dans une zone lointaine
  await expect(refus).toContainText("L'identité de ce jeu n'est pas complète : police, illustration encore « à choisir » dans sa fiche");
  await expect(refus).toContainText("Remplis-la, puis réessaie.");
  await expect(refus).toBeFocused();
  await expect(refus).toHaveClass(/admin-message--erreur/);
  await expect(page.locator("[data-refus-action]")).toHaveCount(1);
  await expect(annuler.getByRole("button")).toHaveCount(0); // un changement refusé n'offre rien à annuler
  // Il reste jusqu'à l'action suivante : une autre fenêtre de confirmation l'efface.
  await track.getByRole("button", { name: "Off", exact: true }).click();
  await expect(page.locator("[data-refus-action]")).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  await page.unroute("**/api/admin/jeux/*/etat");

  // --- Journal : chaque changement et chaque annulation y sont ------------------------------------------------------------------------------------------
  await page.locator('[data-menu="journal"]').click();
  await expect(page.locator('#journal tbody tr[data-action="annuler le changement d\'état d\'un jeu"]')).toHaveCount(1);
  expect(await page.locator('#journal tbody tr[data-action="changer l\'état d\'un jeu"]').count()).toBeGreaterThanOrEqual(5);

  // --- Téléphone (390 × 844) : la barre d'onglets remplace le bouton « Menu » ; la page ne défile pas de côté, les cibles font 44 px ---------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#admin-menu")).toBeHidden();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveCount(0);
  const barre = page.locator("#admin-onglets");
  await expect(barre).toBeVisible();
  await expect(barre.locator("[data-onglet]")).toHaveText(["Tableau", "Jeux", "Communauté", "Diffusion", "Suivi"]);
  // « Communauté » › Retours : toucher une rubrique ouvre ses liens.
  await barre.locator('[data-onglet="communaute"]').click();
  const feuille = page.locator('[data-feuille="communaute"]');
  await expect(feuille).toBeVisible();
  await expect(barre.locator('[data-onglet="communaute"]')).toHaveAttribute("aria-expanded", "true");
  await expect(feuille.getByRole("link")).toHaveText(["Joueurs", "Groupes", "Images", "Retours"]);
  await page.keyboard.press("Escape"); // Échap la referme et rend le focus à l'onglet
  await expect(feuille).toBeHidden();
  await expect(barre.locator('[data-onglet="communaute"]')).toBeFocused();
  await barre.locator('[data-onglet="communaute"]').click();
  await feuille.getByRole("link", { name: "Retours" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Retours" })).toBeVisible();
  await expect(feuille).toBeHidden(); // refermée après le choix
  await expect(barre.locator('[data-onglet="communaute"]')).toHaveClass(/est-ici/);
  await barre.locator('[data-onglet="communaute"]').click();
  await feuille.getByRole("link", { name: "Joueurs" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Joueurs" })).toBeVisible();
  // La page « Jeux » au téléphone : une ligne par jeu, l'interrupteur sur toute la largeur.
  await barre.locator('[data-onglet="jeux"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "Jeux" })).toBeVisible();
  await expect(tower).toBeVisible();
  const positions = await tower.locator(".admin-position").all();
  expect(positions).toHaveLength(3);
  for (const b of positions) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await tower.getByRole("button", { name: "Aperçu", exact: true }).click();
  await expect(page.locator("#jeux-annuler .admin-annuler")).toBeVisible();
  const bandeau = await page.locator("#jeux-annuler .admin-annuler").boundingBox();
  const onglets = await barre.boundingBox();
  expect(bandeau!.y + bandeau!.height, "le bandeau « Annuler » est au-dessus de la barre d'onglets").toBeLessThanOrEqual(onglets!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const b of await page.locator("button, a.dj-bouton, a.admin-onglet, .admin-filtre, input").all()) {
    if (!(await b.isVisible())) continue;
    expect((await b.boundingBox())!.height, "cible de 44 px au moins").toBeGreaterThanOrEqual(43.5);
  }
  await auditAxe(page, "panneau-jeux-telephone");
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- Déconnexion : la session est révoquée côté serveur --------------------------------------------------------------------
  const cookie = (await context.cookies()).find((c) => c.name === "__session")!;
  await page.locator("#admin-deconnexion").click();
  await expect(page.locator("#factice-form")).toBeVisible();
  const apres = await fetch(`http://127.0.0.1:8810/api/admin/tableau`, { headers: { cookie: `__session=${cookie.value}` } });
  expect(apres.status).toBe(401);

  expect(violations).toEqual([]);
});
