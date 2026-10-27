import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, newClockedContext, newContextAt, test, type BrowserContext, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot I2 (plateforme, phase 3) : le portail devient la porte d'entrée du jour.
//   - portail **plein** : `/?demo=joueur` installe le joueur de démonstration (créé par `recette:seed --demo-seulement`, comme sur la recette) :
//     compte à rebours calé sur l'heure du serveur, Track « Fini · temps · Or · rang », Jump « En cours · 12 morts », série de 5 jours, 2
//     journées parfaites ; **une seule requête** à l'API au chargement ; FR et EN ;
//   - **joueur neuf** (aucune identité) : « Pas encore joué », phrase d'accueil, pas de tuile Série, aucune donnée personnelle demandée ;
//   - **serveur injoignable** : cartouches sans statut, compte à rebours sur l'heure locale, un message discret, rien de bloquant ;
//   - le **profil commun** `/profil/` (avatar) : pseudo, code, statistiques par jeu ; un code chargé ici remplace l'identité (révision P4) ;
//   - **minuit** : le compte à rebours passe zéro, le nouveau jour se charge sans recharger la page, la série s'ajuste ;
//   - **le 25 octobre** (journée de 25 h) : le compte à rebours dépasse 24 h.
// Captures (portrait 390 × 844, paysage 844 × 390, FR et EN) jointes au rapport ; avec `CAPTURES=1`, écrites dans docs/plateforme/lots/img/.
// Serveurs lancés ici : site 4179, API 8794 (midi), 8795 (minuit), 8796 (25 octobre) — ports réservés à ce fichier.
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 20_000 });

const ROOT = resolve("../..");
const PORTRAIT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const PAYSAGE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };
const CAPTURES = process.env.CAPTURES ? join(ROOT, "docs/plateforme/lots/img") : null;
const DEMO_ID = "de30de30de30de30de30de30de30de30";
const SITES = { midi: 4179, minuit: 4180, octobre: 4181 } as const;

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

/** Lance le vrai serveur (`dist/server.mjs`) sur `port`, avec la base `db` et l'horloge réglée pour valoir `instant` maintenant. */
async function api(port: number, db: string, instant?: number): Promise<void> {
  const offset = instant === undefined ? process.env.E2E_CLOCK_OFFSET_MS : String(instant - Date.now());
  const child = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: String(port), DB_PATH: db, ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: offset },
    stdio: "ignore",
  });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`serveur ${port} injoignable`);
}

/** La base de la recette avec le joueur de démonstration (le vrai `recette:seed`, joueur « Démo » seulement), copiée pour un serveur. */
function base(nom: string): string {
  const out = join(tmp, `${nom}-recette.sqlite`);
  for (const ext of ["", "-wal", "-shm"]) if (existsSync(join(tmp, `demo-recette.sqlite${ext}`))) copyFileSync(join(tmp, `demo-recette.sqlite${ext}`), `${out}${ext}`);
  return out;
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  tmp = mkdtempSync(join(tmpdir(), "portail-jour-"));
  // Le portail comme sur la recette et les aperçus (vitrine et lien de démonstration compris).
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "error", "--outDir", join(tmp, "site"), "--emptyOutDir"], {
    cwd: ROOT,
    env: { ...process.env, PORTAIL_VITRINE: "1", VITE_CONFIG_NATIVE_IGNORE_WARNING: "true" },
    stdio: "inherit",
  });
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--today", "2026-10-20"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "demo-recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  await api(8794, base("midi"));
  servers.push(await startSite(join(tmp, "site"), SITES.midi, 8794));
  if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Capture jointe au rapport (et écrite pour le README avec CAPTURES=1). */
async function capture(page: Page, nom: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ fullPage: true, ...(CAPTURES ? { path: join(CAPTURES, `lot-I2-${nom}.png`) } : {}) });
  await test.info().attach(nom, { body: png, contentType: "image/png" });
}

/** Les requêtes `/api/…` faites par la page. */
function requetesApi(page: Page): { url: string; joueur: string | null }[] {
  const vues: { url: string; joueur: string | null }[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) vues.push({ url: new URL(r.url()).pathname, joueur: r.headers()["x-player-id"] ?? null });
  });
  return vues;
}

async function avecDemo(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`http://localhost:${SITES.midi}/?demo=joueur`);
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
  return page;
}

test("portail plein (joueur de démonstration) : compte à rebours, Track fini (or, rang), Jump en cours (morts), série, journées parfaites ; une requête", async ({ browser }) => {
  const context = await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" });
  const page = await context.newPage();
  const vues = requetesApi(page);
  await page.goto(`http://localhost:${SITES.midi}/?demo=joueur`);
  const track = page.locator('[data-jeu="track"]');
  const jump = page.locator('[data-jeu="jump"]');
  await expect(track.locator(".portail-statut")).toHaveAttribute("data-statut", "fini");
  // L'adresse perd ?demo=joueur ; l'identité installée est celle du joueur de démonstration.
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(() => [localStorage.getItem("cdj:player"), localStorage.getItem("cdj:name")])).toEqual([DEMO_ID, "Démo"]);
  // Le compte à rebours : minuit de Paris dans environ 10 h (l'horloge de test : midi UTC, 14 h à Paris).
  await expect(page.locator("#compte .dj-afficheur__legende")).toHaveText("Prochains jeux dans");
  await expect(page.locator("#compte .dj-afficheur__valeur")).toHaveText(/^(09|10):\d\d:\d\d$/);
  await expect(page.locator("#avancement")).toHaveText("1 fini sur 2");
  await expect(track.locator(".track-etiquette__numero")).toHaveText(/^n°\s8 · \S/);
  await expect(track.locator(".portail-pastille-fini")).toHaveText("Fini");
  await expect(track.locator(".portail-statut__temps")).toHaveText(/^\d+,\d{3}\u00a0s$/);
  await expect(track.locator(".dj-medaille")).toHaveAccessibleName("Or : obtenue");
  await expect(track.locator(".portail-statut__rang")).toHaveText("1er sur 1");
  await expect(track.locator("a.dj-bouton")).toHaveText("Rejouer");
  await expect(track.locator("a.dj-bouton")).toHaveAttribute("href", "track/");
  await expect(jump.locator(".portail-statut")).toHaveText("En cours · 12 morts");
  await expect(jump.locator("a.dj-bouton")).toHaveText("Continuer");
  await expect(jump.locator(".jump-etiquette__numero")).toHaveText(/^n°\s5 · \S/);
  await expect(page.locator("#serie .dj-tuile__valeur")).toHaveText("5 jours");
  await expect(page.locator("#serie .dj-tuile__sous-texte")).toHaveText("2 journées parfaites");
  await expect(page.locator("#serie")).not.toContainText("Joue aujourd'hui");
  await expect(page.locator(".dj-avatar")).toHaveText("DÉ");
  await expect(page.locator("#message")).toHaveCount(0);
  // Une seule requête à l'API au chargement, avec l'identifiant en en-tête (jamais dans l'adresse).
  await page.waitForTimeout(1500); // rien d'autre ne doit partir pendant ce temps
  expect(vues).toEqual([{ url: "/api/portail/jour", joueur: DEMO_ID }]);
  await capture(page, "portail-plein-portrait-fr");
  await page.locator('.dj-choix-langue [data-langue="en"]').click();
  await expect(page.locator("#avancement")).toHaveText("1 of 2 done");
  await expect(track.locator(".dj-medaille")).toHaveAccessibleName("Gold: earned");
  await expect(track.locator(".portail-statut__rang")).toHaveText("1st of 1");
  await expect(jump.locator(".portail-statut")).toHaveText("In progress · 12 deaths");
  await expect(page.locator("#serie .dj-tuile__valeur")).toHaveText("5 days");
  await expect(page.locator("#compte .dj-afficheur__legende")).toHaveText("Next games in");
  await capture(page, "portail-plein-portrait-en");
  expect(vues).toHaveLength(1); // changer de langue ne relit rien

  const paysage = await avecDemo(await newClockedContext(browser, { ...PAYSAGE, locale: "fr-FR" }));
  const [a, b] = await paysage.locator("#jeux .dj-cartouche").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(Math.abs(a! - b!)).toBeLessThan(2);
  expect(await paysage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture(paysage, "portail-plein-paysage-fr");
  await paysage.locator('.dj-choix-langue [data-langue="en"]').click();
  await expect(paysage.locator("#avancement")).toHaveText("1 of 2 done");
  await capture(paysage, "portail-plein-paysage-en");
});

test("le lien de démonstration demande confirmation quand une autre identité est là ; « Garder mon profil » ne change rien", { tag: "@regression" }, async ({ browser }) => {
  const context = await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("deja")) {
      sessionStorage.setItem("deja", "1");
      localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef");
      localStorage.setItem("cdj:name", "Kiwi");
    }
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${SITES.midi}/?demo=joueur`);
  await expect(page.locator("#demo")).toContainText("Kiwi");
  await page.locator("#demo .dj-bouton--secondaire").click();
  await expect(page.locator("#jeux .dj-cartouche")).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBe("0123456789abcdef0123456789abcdef");
  await page.goto(`http://localhost:${SITES.midi}/?demo=joueur`);
  await page.locator("#demo .dj-bouton--marque").click();
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
  expect(await page.evaluate(() => [localStorage.getItem("cdj:player"), localStorage.getItem("cdj:identite:code")])).toEqual([DEMO_ID, "1"]);
});

test("joueur neuf : « Pas encore joué », une phrase d'accueil, pas de tuile Série ; la requête ne porte aucun identifiant", async ({ browser }) => {
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    for (const langue of ["fr", "en"] as const) {
      const page = await (await newClockedContext(browser, { ...options, locale: langue === "fr" ? "fr-FR" : "en-US" })).newPage();
      const vues = requetesApi(page);
      await page.goto(`http://localhost:${SITES.midi}/`);
      await expect(page.locator('[data-jeu="jump"] .portail-statut')).toHaveText(langue === "fr" ? "Pas encore joué" : "Not played yet");
      await expect(page.locator('[data-jeu="track"] a.dj-bouton')).toHaveText(langue === "fr" ? "Jouer" : "Play");
      await expect(page.locator("#accueil")).toBeVisible();
      await expect(page.locator("#serie")).toHaveCount(0);
      await expect(page.locator("#avancement")).toHaveText("");
      await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText(langue === "fr" ? /^n°\s8 · \S/ : /^#8 · \S/);
      expect(vues).toEqual([{ url: "/api/portail/jour", joueur: null }]);
      await capture(page, `portail-neuf-${nom}-${langue}`);
    }
  }
});

test("serveur injoignable : cartouches sans statut, compte à rebours sur l'heure locale, un message discret, rien de bloquant", async ({ browser }) => {
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    for (const langue of ["fr", "en"] as const) {
      const context = await newClockedContext(browser, { ...options, locale: langue === "fr" ? "fr-FR" : "en-US" });
      await context.addInitScript((id) => localStorage.setItem("cdj:player", id), DEMO_ID);
      await context.route("**/api/**", (r) => r.abort("connectionrefused"));
      const page = await context.newPage();
      await page.goto(`http://localhost:${SITES.midi}/`);
      await expect(page.locator("#message")).toHaveText(langue === "fr" ? "Serveur injoignable : tes statuts reviendront dès qu'il répondra." : "Can't reach the server: your progress will show up once it's back.");
      await expect(page.locator(".portail-statut")).toHaveCount(2);
      for (const s of await page.locator(".portail-statut").all()) await expect(s).toHaveAttribute("data-statut", "inconnu");
      await expect(page.locator("#compte .dj-afficheur__valeur")).toHaveText(/^(09|10):\d\d:\d\d$/);
      await expect(page.locator('[data-jeu="track"] a.dj-bouton')).toHaveAttribute("href", "track/");
      await capture(page, `portail-injoignable-${nom}-${langue}`);
    }
  }
});

test("profil commun (/profil/) : l'avatar y mène ; pseudo, code de transfert, série, statistiques par jeu, langue", { tag: "@regression" }, async ({ browser }) => {
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    const page = await avecDemo(await newClockedContext(browser, { ...options, locale: "fr-FR" }));
    await page.locator(".dj-avatar").click();
    await expect(page).toHaveURL(`http://localhost:${SITES.midi}/profil/`);
    await expect(page.locator("#pseudo-actuel")).toHaveText("Démo");
    await expect(page.locator("#code")).toHaveText(/^CDJ2\.de30de30de30de30de30de30de30de30\.[0-9a-f]{8}$/);
    await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText("5 jours finis");
    await expect(page.locator('[data-jeu="jump"] .jump-etiquette__numero')).toHaveText("2 jours finis");
    await expect(page.locator('[data-jeu="track"] .track-etiquette__texte')).toHaveText(/^Meilleure place : 1er sur 1, /);
    await expect(page.locator(".profil-tuiles .dj-tuile").first()).toContainText("5 jours");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await capture(page, `profil-${nom}-fr`);
    await page.locator('.dj-choix-langue [data-langue="en"]').click();
    await expect(page.locator("h1")).toHaveText("Your profile");
    await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText("5 days done");
    await capture(page, `profil-${nom}-en`);
    // Retour au portail par « ‹ DU JOUR » : la langue suit (même stockage).
    await page.locator(".dj-barre-jeu__retour").click();
    await expect(page.locator("#portail-jeux-titre")).toHaveText("Today's games");
  }
});

test("profil commun : ?retour= ramène au jeu d'où l'on vient (un chemin du site seulement, jamais une adresse extérieure)", { tag: "@regression" }, async ({ browser }) => {
  const context = await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" });
  const page = await context.newPage();
  const retour = page.locator(".dj-barre-jeu__retour");
  // Le jeu d'où l'on vient : « ‹ TRACK » vers /track/ (Réglages › « Mon profil Du Jour › » ajoute ?retour=/track/).
  await page.goto(`http://localhost:${SITES.midi}/profil/?retour=${encodeURIComponent("/track/")}`);
  await expect(retour).toHaveAttribute("href", "/track/");
  await expect(retour).toContainText("TRACK");
  await expect(retour).toHaveAttribute("aria-label", "Retour à Track");
  await page.locator('.dj-choix-langue [data-langue="en"]').click();
  await expect(retour).toHaveAttribute("aria-label", "Back to Track");
  // Tout le reste est ignoré : le retour par défaut, vers le portail.
  for (const hostile of ["https://evil.example/track/", "//evil.example/", "javascript:alert(1)", "/track/../../x", "/%2e%2e/"]) {
    await page.goto(`http://localhost:${SITES.midi}/profil/?retour=${encodeURIComponent(hostile)}`);
    await expect(retour, hostile).toHaveAttribute("href", "../");
    await expect(retour, hostile).toContainText(/DU JOUR/i);
  }
  await context.close();
});

test("profil commun : un code chargé ici (lu sur le serveur, confirmé) devient l'identité de tous les jeux", async ({ browser }) => {
  const context = await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(`http://localhost:${SITES.midi}/profil/`);
  await expect(page.locator("#profil-etat")).toContainText("Pas encore de profil");
  const code = `CDJ2.${DEMO_ID}.${await page.evaluate(async (id) => {
    let c = 0xffffffff;
    for (const b of new TextEncoder().encode(id)) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
  }, DEMO_ID)}`;
  await page.locator("#code-champ").fill("CDJ2.abc");
  await page.locator("#charger button").click();
  await expect(page.locator("#code-message")).toHaveText("Ce code est illisible : copie-le en entier, sans rien ajouter.");
  await page.locator("#code-champ").fill(code);
  await page.locator("#charger button").click();
  await expect(page.locator("#apercu")).toContainText("Profil de Démo");
  expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBeNull(); // rien ne change avant la confirmation
  await page.locator("#apercu .dj-bouton--marque").click();
  await expect(page.locator("#code-message")).toHaveText("Profil chargé : Démo.");
  expect(await page.evaluate(() => [localStorage.getItem("cdj:player"), localStorage.getItem("cdj:name"), localStorage.getItem("cdj:identite:code")])).toEqual([DEMO_ID, "Démo", "1"]);
  await expect(page.locator("#code")).toHaveText(code);
});

test("minuit : le compte à rebours passe zéro, le nouveau jour se charge sans recharger la page, la série s'ajuste", async ({ browser }) => {
  // L'heure du serveur et du navigateur : 23 h 59 min 40 s à Paris le 20/10 (21 h 59 min 40 s UTC).
  const instant = Date.parse("2026-10-20T21:59:40Z");
  await api(8795, base("minuit"), instant);
  servers.push(await startSite(join(tmp, "site"), SITES.minuit, 8795));
  const context = await newContextAt(browser, instant, { ...PORTRAIT, locale: "fr-FR" });
  await context.addInitScript((id) => localStorage.setItem("cdj:player", id), DEMO_ID);
  const page = await context.newPage();
  const vues = requetesApi(page);
  await page.goto(`http://localhost:${SITES.minuit}/`);
  await page.evaluate(() => ((window as unknown as { __sansRechargement: boolean }).__sansRechargement = true));
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
  await expect(page.locator("#compte .dj-afficheur__valeur")).toHaveText(/^00:00:[0-3]\d$/);
  await expect(page.locator("#date")).toHaveText("Mardi 20 octobre");
  await expect(page.locator("#serie .dj-tuile__valeur")).toHaveText("5 jours");
  // Après minuit : le 21, numéros suivants, rien de joué, la série court jusqu'à hier et demande à être prolongée.
  await expect(page.locator("#date")).toHaveText("Mercredi 21 octobre", { timeout: 60_000 });
  await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText(/^n°\s9 · \S/);
  await expect(page.locator('[data-jeu="jump"] .jump-etiquette__numero')).toHaveText(/^n°\s6 · \S/);
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveText("Pas encore joué");
  await expect(page.locator('[data-jeu="jump"] .portail-statut')).toHaveText("Pas encore joué");
  await expect(page.locator("#avancement")).toHaveText("0 fini sur 2");
  await expect(page.locator("#serie .dj-tuile__valeur")).toHaveText("5 jours");
  await expect(page.locator("#serie")).toContainText("Joue aujourd'hui pour la garder");
  await expect(page.locator("#compte .dj-afficheur__valeur")).toHaveText(/^23:59:\d\d$/);
  expect(await page.evaluate(() => (window as unknown as { __sansRechargement?: boolean }).__sansRechargement)).toBe(true);
  expect(vues.length).toBeGreaterThanOrEqual(2);
  expect(vues.every((v) => v.url === "/api/portail/jour")).toBe(true);
  await capture(page, "portail-minuit-portrait-fr");
});

test("25 octobre (journée de 25 h) : à 0 h 30, le compte à rebours dit 24 h 30", async ({ browser }) => {
  const instant = Date.parse("2026-10-24T22:30:00Z"); // 0 h 30 à Paris le 25 (encore l'heure d'été)
  await api(8796, ":memory:", instant);
  servers.push(await startSite(join(tmp, "site"), SITES.octobre, 8796));
  const page = await (await newContextAt(browser, instant, { ...PORTRAIT, locale: "fr-FR" })).newPage();
  await page.goto(`http://localhost:${SITES.octobre}/`);
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveText("Pas encore joué");
  await expect(page.locator("#date")).toHaveText("Dimanche 25 octobre");
  await expect(page.locator("#compte .dj-afficheur__valeur")).toHaveText(/^24:29:\d\d$/);
});
