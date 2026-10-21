import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodeTransfer } from "@cdj/profile";
import { expect as baseExpect, hasWebGL, newClockedContext, test, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";
import { auditAxe } from "./axe";

// Lot R4 (plateforme) : playdujour.com en local.
//   1. le portail « Du Jour » (une cartouche par jeu, numéro du jour ; lot I1 : le reste du portail dans portail.spec.ts) ;
//   2. les deux jeux servis sous /track/ et /jump/ du site assemblé (`node scripts/site.mjs site`, comme Firebase Hosting) : ressources, niveaux
//      figés, démonstration, et le serveur sous la même adresse (`?api=/` = `VITE_API_URL=/` : `/api/…` sur l'origine de la page) ;
//   3. lot R5 : plus aucun import par l'adresse — un lien `#dujour=…` (l'ancienne migration du lot R4) n'a aucun effet ;
//   4. lot R5 : la page « Mentions légales et confidentialité », depuis le portail et depuis le menu ⏸ de chaque jeu, au doigt en portrait ;
//   5. lot I6 : les aperçus de partage (balises, images servies aux bonnes tailles et sous le poids, adresses absolues de CE site : il est
//      assemblé avec `--origine http://localhost:4177`), le manifeste et les icônes, la page 404, les mentions en anglais depuis le portail en EN.
// Les deux jeux doivent être construits (la part DailyTrack de la CI construit les deux). Serveurs lancés ici (ports 4177, 8793 : réservés).
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const ROOT = resolve("../..");
const SITE = "http://localhost:4177";
const API_PORT = 8793;
const ID = "0123456789abcdef0123456789abcdef";

let tmp = "";
let servers: Server[] = [];
let api: ChildProcess | null = null;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "playdujour-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site"), "--origine", SITE], { cwd: ROOT, stdio: "inherit" });
  api = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: String(API_PORT), DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${API_PORT}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers = [await startSite(join(tmp, "site"), 4177, API_PORT)];
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  api?.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Les réponses en échec (≥ 400) de l'origine de `page` pendant `run`. */
async function failures(page: Page, run: () => Promise<void>): Promise<string[]> {
  const bad: string[] = [];
  page.on("response", (r) => {
    if (r.url().startsWith(SITE) && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  await run();
  return bad;
}

test("portail : une cartouche par jeu, le numéro du jour, un lien relatif", async ({ browser }) => {
  // Lot I1 : le portail passe au socle (cartouches, français et anglais) ; ici en français, le reste dans portail.spec.ts.
  const page = await (await newClockedContext(browser, { locale: "fr-FR" })).newPage();
  await page.goto(`${SITE}/`);
  await expect(page).toHaveTitle("Du Jour");
  const cards = page.locator("#jeux .dj-cartouche[data-jeu]");
  await expect(cards).toHaveCount(2);
  await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText("n° 8"); // 20/10/2026 (TODAY)
  await expect(page.locator('[data-jeu="jump"] .jump-etiquette__numero')).toHaveText("n° 5");
  await expect(page.locator("#date")).toHaveText("Mardi 20 octobre");
  await page.locator('[data-jeu="jump"] a.dj-bouton').click();
  await expect(page).toHaveURL(`${SITE}/jump/`);
});

test("les deux jeux sous /track/ et /jump/ : ressources, niveaux figés, démonstration, serveur sous la même adresse", async ({ browser }) => {
  const page = await (await newClockedContext(browser)).newPage();
  await page.goto(`${SITE}/`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : les jeux ne démarrent pas (portail testé à part)");

  // /track et /jump sans « / » final : redirigés vers le dossier (Firebase le fait par défaut ; le serveur local l'imite).
  const bad = await failures(page, async () => {
    await page.goto(`${SITE}/track?debug`);
    await expect(page).toHaveURL(`${SITE}/track/?debug`);
    await page.waitForFunction(() => !!(window as unknown as { __cdj?: unknown }).__cdj);

    // DailyTrack, démonstration : `demo/` relatif à /track/.
    const demo = page.waitForResponse((r) => r.url().startsWith(`${SITE}/track/demo/`) && r.ok());
    await page.goto(`${SITE}/track/?api=demo`);
    await demo;

    // DailyJump, un jour figé : `levels/AAAA-MM-JJ.json` relatif à /jump/.
    const frozen = page.waitForResponse((r) => r.url() === `${SITE}/jump/levels/2026-10-16.json` && r.ok());
    await page.goto(`${SITE}/jump/?seed=2026-10-16`);
    await frozen;

    // DailyJump, démonstration : `demo/` relatif à /jump/.
    const jumpDemo = page.waitForResponse((r) => r.url().startsWith(`${SITE}/jump/demo/`) && r.ok());
    await page.goto(`${SITE}/jump/?api=demo`);
    await jumpDemo;

    // Le serveur sous la même adresse (`?api=/`, ce que fait `VITE_API_URL=/`) : `/api/jump/…` sur l'origine de la page, sans CORS.
    const sameOrigin = page.waitForResponse((r) => r.url().startsWith(`${SITE}/api/jump/`) && r.ok());
    await page.goto(`${SITE}/jump/?api=/`);
    const res = await sameOrigin;
    expect(res.request().headers()["origin"] ?? null).toBeNull(); // une lecture de même origine : aucun en-tête Origin, aucun pré-vol
  });
  expect(bad).toEqual([]);
});

test("lot R5 : un lien #dujour=… (l'ancien import par l'adresse) n'a aucun effet : ni identité, ni pseudo, ni donnée écrite, fragment laissé tel quel", async ({ browser }) => {
  const context = await newClockedContext(browser);
  const page = await context.newPage();
  // Le fragment tel que les pages de redirection du lot R4 le construisaient (version 1, JSON en base64url, somme de contrôle) : un code
  // valide et un pseudo. Il ne doit plus rien implanter.
  const payload = Buffer.from(JSON.stringify({ code: encodeTransfer(ID), name: "Piège", keys: { "jump:classement:attente": "{}" } })).toString("base64url");
  const fragment = `#dujour=1.${payload}.00000000`;
  for (const path of ["/track/", "/jump/"]) {
    await page.goto(`${SITE}${path}${fragment}`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500); // rien ne doit changer pendant ce temps (aucun import, aucune réécriture de l'adresse)
    expect(await page.evaluate(() => location.hash), path).toBe(fragment);
    const stored = await page.evaluate(() => ({
      player: localStorage.getItem("cdj:player"),
      name: localStorage.getItem("cdj:name"),
      attente: localStorage.getItem("jump:classement:attente"),
      vue: localStorage.getItem("cdj:migration:vue"),
    }));
    expect(stored.player, path).not.toBe(ID);
    expect(stored.name, path).not.toBe("Piège");
    expect(stored.attente, path).toBeNull();
    expect(stored.vue, path).toBeNull();
  }
});

// ——— Lot R5 : la page « Mentions légales et confidentialité », au doigt en portrait ———
const PORTRAIT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

/** La page des mentions est bien là : titre, éditeur, hébergeurs, droits ; lisible au téléphone (aucun défilement horizontal). */
async function mentionsShown(page: Page): Promise<void> {
  await expect(page).toHaveURL(`${SITE}/mentions-legales/`);
  await expect(page.getByRole("heading", { level: 1, name: "Mentions légales et confidentialité" })).toBeVisible();
  for (const text of ["MZC Studios", "Google Cloud France", "ChiselStrike Inc.", "code de transfert"]) await expect(page.locator("main")).toContainText(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

/** Une cible au doigt d'au moins 44 px de haut. Lot I6 : la hauteur est lue à l'unité de mise en page de Firefox près (1/60 px) — il rend
 *  43,99994 px pour un `min-height: 44px` posé à une ordonnée fractionnaire (run 39604752428) ; un vrai manque compte au moins 1/60 px. */
async function bigEnough(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).not.toBeNull();
  expect(Math.round(box!.height * 60) / 60, selector).toBeGreaterThanOrEqual(44);
}

test("mentions légales : depuis le portail, au doigt en portrait ; retour au portail", async ({ browser }) => {
  const page = await (await newClockedContext(browser, PORTRAIT)).newPage();
  await page.goto(`${SITE}/`);
  await bigEnough(page, "#mentions");
  await page.locator("#mentions").tap();
  await mentionsShown(page);
  // Sans « / » final, comme Firebase : redirigé vers le dossier.
  await page.goto(`${SITE}/mentions-legales`);
  await expect(page).toHaveURL(`${SITE}/mentions-legales/`);
  await page.locator("a.retour").tap();
  await expect(page).toHaveURL(`${SITE}/`);
});

test("mentions légales : depuis le menu ⏸ et Réglages › Profil de DailyTrack, au doigt en portrait", async ({ browser }) => {
  const page = await (await newClockedContext(browser, PORTRAIT)).newPage();
  await page.goto(`${SITE}/track/?home=1&debug&api=demo&touch=1`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas (portail testé à part)");
  await page.waitForFunction(() => !!(window as unknown as { __cdj?: unknown }).__cdj);
  // Réglages › Profil.
  await page.locator("#home-settings").tap();
  await page.locator("#settings-mentions").scrollIntoViewIfNeeded();
  await bigEnough(page, "#settings-mentions");
  await page.locator("#settings-mentions").tap();
  await mentionsShown(page);
  // Le menu ⏸ : une course, la pause au doigt (bouton ⏸ de la barre tactile).
  await page.goto(`${SITE}/track/?home=1&debug&api=demo&touch=1`);
  await page.waitForFunction(() => !!(window as unknown as { __cdj?: unknown }).__cdj);
  await page.locator("#home-daily").tap();
  await page.waitForFunction(() => (window as unknown as { __cdj: { phase: string } }).__cdj.phase === "racing");
  const rotateOk = page.getByRole("button", { name: "Jouer quand même" });
  if (await rotateOk.isVisible()) await rotateOk.tap();
  await page.locator("#btn-pause").tap(); // lot I4 : la pause est le bouton en haut à gauche du HUD (plus de bouton ⏸ dans la barre tactile)
  await expect(page.locator("#pause-menu")).toBeVisible();
  await page.locator("#pause-mentions").scrollIntoViewIfNeeded();
  await bigEnough(page, "#pause-mentions");
  await page.locator("#pause-mentions").tap();
  await mentionsShown(page);
});

test("mentions légales : depuis le menu ⏸ et les Réglages de Jump, au doigt en portrait", async ({ browser }) => {
  const page = await (await newClockedContext(browser, PORTRAIT)).newPage();
  await page.goto(`${SITE}/jump/?debug&touch=1`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas (portail testé à part)");
  const help = page.locator("#help-close");
  await help.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  if (await help.isVisible()) await help.tap();
  // Lot I5 : l'accueil ouvre les Réglages (cadre crème, `#settings-mentions`, comme Track) ; la pause garde son lien (`#menu-mentions`).
  await page.locator("#home-settings").tap();
  await expect(page.locator("#settings")).toBeVisible();
  await page.locator("#settings-mentions").scrollIntoViewIfNeeded();
  await bigEnough(page, "#settings-mentions");
  await page.locator("#settings-mentions").tap();
  await mentionsShown(page);
  await page.goBack();
  await expect(page).toHaveURL(`${SITE}/jump/?debug&touch=1`);
  await page.locator("#home-play").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#home-play").tap();
  await page.locator("#pausebtn").tap();
  await expect(page.locator("#menu")).toBeVisible();
  await page.locator("#menu-mentions").scrollIntoViewIfNeeded();
  await bigEnough(page, "#menu-mentions");
  await page.locator("#menu-mentions").tap();
  await mentionsShown(page);
});

// ——— Lot I6 : ce qu'on voit quand on colle un lien, le manifeste, la page 404, les mentions en anglais ———
/** Les balises `<meta property|name>` d'une page servie : nom → contenu. */
async function balises(chemin: string): Promise<Map<string, string>> {
  const html = await (await fetch(`${SITE}${chemin}`)).text();
  return new Map([...html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
}

test("lot I6 : aperçus de partage de /, /track/ et /jump/ — balises, adresses absolues de ce site, images 1200 × 630 de moins de 150 ko", async () => {
  const attendus = [
    { chemin: "/", image: "portail", titre: "Du Jour — les jeux du jour" },
    { chemin: "/track/", image: "track", titre: "Track — Du Jour" },
    { chemin: "/jump/", image: "jump", titre: "Jump — Du Jour" },
  ];
  for (const a of attendus) {
    const m = await balises(a.chemin);
    expect(m.get("og:title"), a.chemin).toBe(a.titre);
    expect(m.get("og:description")!.length, a.chemin).toBeGreaterThan(40);
    expect(m.get("description")!.length, a.chemin).toBeGreaterThan(20);
    expect(m.get("og:site_name")).toBe("Du Jour");
    expect(m.get("og:type")).toBe("website");
    expect(m.get("og:locale")).toBe("fr_FR");
    expect(m.get("og:locale:alternate")).toBe("en_GB");
    expect(m.get("twitter:card")).toBe("summary_large_image");
    expect(m.get("og:url"), a.chemin).toBe(`${SITE}${a.chemin}`);
    expect(m.get("og:image"), a.chemin).toBe(`${SITE}/partage/${a.image}.png`);
    expect([m.get("og:image:width"), m.get("og:image:height")]).toEqual(["1200", "630"]);
    expect(m.get("og:image:alt")!.length).toBeGreaterThan(20);
    const image = await fetch(m.get("og:image")!);
    expect(image.status, a.image).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    const octets = Buffer.from(await image.arrayBuffer());
    expect([octets.readUInt32BE(16), octets.readUInt32BE(20)], a.image).toEqual([1200, 630]);
    expect(octets.length, a.image).toBeLessThanOrEqual(150 * 1024);
  }
  // Plus aucun jeton d'origine dans les pages du site.
  for (const chemin of ["/", "/track/", "/jump/", "/profil/", "/classement/", "/mentions-legales/", "/legal/", "/404.html"]) {
    expect(await (await fetch(`${SITE}${chemin}`)).text(), chemin).not.toContain("__ORIGINE_DU_SITE__");
  }
});

test("lot I6 : « Ajouter à l'écran d'accueil » — icône 180 px, manifeste (nom, couleurs, icônes 192 et 512, départ au portail)", async () => {
  for (const chemin of ["/", "/track/", "/jump/"]) {
    const html = await (await fetch(`${SITE}${chemin}`)).text();
    expect(html, chemin).toContain('<link rel="apple-touch-icon" href="/partage/icone-180.png" />');
    expect(html, chemin).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  }
  const taille = async (chemin: string) => {
    const r = await fetch(`${SITE}${chemin}`);
    expect(r.status, chemin).toBe(200);
    const o = Buffer.from(await r.arrayBuffer());
    return [o.readUInt32BE(16), o.readUInt32BE(20)];
  };
  expect(await taille("/partage/icone-180.png")).toEqual([180, 180]);
  const m = (await (await fetch(`${SITE}/manifest.webmanifest`)).json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string }[] };
  expect([m.name, m.start_url, m.display]).toEqual(["Du Jour", "/", "standalone"]);
  for (const i of m.icons) expect(await taille(i.src), i.src).toEqual(i.sizes.split("x").map(Number));
});

test("lot I6 : une adresse inconnue → la page 404 de la charte (deux langues, lien vers le portail), même en profondeur", async ({ browser }) => {
  const page = await (await newClockedContext(browser, PORTRAIT)).newPage();
  for (const chemin of ["/xyz", "/a/b/c/"]) {
    const r = await page.goto(`${SITE}${chemin}`);
    expect(r?.status(), chemin).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "This page doesn't exist" })).toBeVisible();
    // La feuille de la charte est chargée même en profondeur (chemins absolus) : fond crème, police de la marque.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(237, 227, 207)");
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontFamily)).toContain("Archivo Black");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await auditAxe(page, "404"); // lot I6 : la passe d'accessibilité (e2e/axe.ts)
  await bigEnough(page, ".dj-bouton--marque");
  await page.locator(".dj-bouton--marque").tap();
  await expect(page).toHaveURL(`${SITE}/`);
  // /api/** n'est jamais la page 404 du site : le serveur répond lui-même (code d'erreur JSON).
  const api = await fetch(`${SITE}/api/inconnue`);
  expect(api.status).toBe(404);
  expect(await api.json()).toEqual({ error: "not_found" });
});

test("lot I6 : mentions en anglais — le portail en EN ouvre /legal/, qui renvoie à la française (elle fait foi)", async ({ browser }) => {
  const page = await (await newClockedContext(browser, { ...PORTRAIT, locale: "en-US" })).newPage();
  await page.goto(`${SITE}/`);
  await expect(page.locator("#mentions")).toHaveText("Legal notice and privacy");
  await bigEnough(page, "#mentions");
  await page.locator("#mentions").tap();
  await expect(page).toHaveURL(`${SITE}/legal/`);
  await expect(page.getByRole("heading", { level: 1, name: "Legal notice and privacy" })).toBeVisible();
  await expect(page.locator("main")).toContainText("The French version is the reference");
  for (const text of ["MZC Studios", "Google Cloud France", "ChiselStrike Inc.", "transfer code"]) await expect(page.locator("main")).toContainText(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await auditAxe(page, "mentions-en"); // lot I6 : la passe d'accessibilité (e2e/axe.ts)
  await bigEnough(page, ".mentions-langue");
  await page.locator(".mentions-langue").tap();
  await mentionsShown(page);
  await expect(page.locator(".mentions-langue")).toHaveText("English version");
  await auditAxe(page, "mentions-fr");
});

// ——— Lot I4 : les polices de Track sont celles du portail (un seul chemin sur le site : `/assets/…`) ———
test("lot I4 : Track demande ses polices à /assets/, les mêmes fichiers que le portail, et le site n'en garde qu'un exemplaire", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "fr-FR" });
  const page = await context.newPage();
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas (portail testé à part)");
  const polices = new Map<string, number>();
  page.on("response", (r) => {
    if (r.url().endsWith(".woff2")) polices.set(r.url().replace(SITE, ""), r.status());
  });
  await page.goto(`${SITE}/`);
  await page.waitForLoadState("networkidle");
  const duPortail = [...polices.keys()];
  expect(duPortail.length, "le portail charge ses polices").toBeGreaterThan(3);
  polices.clear();
  await page.goto(`${SITE}/track/?api=demo`);
  await page.waitForSelector("#splash", { state: "detached", timeout: 90_000 });
  await page.waitForLoadState("networkidle");
  const deTrack = [...polices.keys()];
  expect(deTrack.length, "Track charge ses polices").toBeGreaterThan(3);
  for (const [chemin, statut] of polices) {
    expect(chemin, "chemin unique du site, pas sous /track/").toMatch(/^\/assets\/[a-z-]+-latin-\d+-(normal|italic)-[\w-]+\.woff2$/);
    expect(statut, chemin).toBe(200);
  }
  // Au moins quatre des faces de Track (Archivo Black, Archivo 400, JetBrains Mono 700, Barlow Condensed 800 italique) sont celles du portail : même chemin, donc déjà en cache.
  expect(deTrack.filter((c) => duPortail.includes(c)).length).toBeGreaterThanOrEqual(3);
  // Le site n'a qu'un exemplaire de chaque police : plus aucune sous /track/assets/, et celles que le portail n'utilise pas sont dans son dossier assets/.
  expect(readdirSync(join(tmp, "site/track/assets")).filter((f) => f.endsWith(".woff2"))).toEqual([]);
  for (const chemin of deTrack) expect(existsSync(join(tmp, "site", chemin)), chemin).toBe(true);
  await context.close();
});

// ——— Lot I2 : le retour au portail depuis les jeux (« ‹ Du Jour », accueil et menu ⏸), au doigt en portrait ———
test("lot I2 : portail → jeu → « ‹ Du Jour » → portail, au doigt en portrait, dans les deux jeux", async ({ browser }) => {
  const page = await (await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" })).newPage();
  await page.goto(`${SITE}/`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : les jeux ne démarrent pas (portail testé à part)");
  for (const [jeu, chemin, pause] of [["track", "/track/", "#pause-portail"], ["jump", "/jump/", "#menu-portail"]] as const) {
    await page.goto(`${SITE}/`);
    await page.locator(`[data-jeu="${jeu}"] a.dj-bouton`).tap();
    await expect(page).toHaveURL(`${SITE}${chemin}`);
    // DailyJump ouvre « Comment jouer » à la première visite : on le ferme d'abord.
    const aide = page.locator("#help-close");
    if (jeu === "jump") {
      await aide.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
      if (await aide.isVisible()) await aide.tap();
    }
    const retour = page.locator("#home-portail");
    await expect(retour, jeu).toBeVisible({ timeout: 30_000 });
    await expect(retour, jeu).toHaveText(/^(‹ )?du jour$/i); // lots I4 et I5 : la barre du socle (« DU JOUR ») dans les deux jeux
    await expect(retour, jeu).toHaveAccessibleName("Retour au portail Du Jour");
    await bigEnough(page, "#home-portail");
    // Le même lien dans le menu ⏸.
    await expect(page.locator(pause), jeu).toHaveAttribute("href", "../");
    await retour.tap();
    await expect(page, jeu).toHaveURL(`${SITE}/`);
    await expect(page.locator("#portail-jeux-titre")).toHaveText("Les jeux du jour");
  }
});
