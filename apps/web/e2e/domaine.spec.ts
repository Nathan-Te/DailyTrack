import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { collectMigration, migrationFragment } from "@cdj/profile";
import { expect as baseExpect, hasWebGL, newClockedContext, test, type Page } from "./fixtures";
import { startOldPages, startSite } from "./domaine-serveurs";

// Lot R4 (plateforme) : playdujour.com en local.
//   1. le portail « Du Jour » (une carte par jeu, numéro du jour) ;
//   2. les deux jeux servis sous /track/ et /jump/ du site assemblé (`node scripts/site.mjs site`, comme Firebase Hosting) : ressources, niveaux
//      figés, démonstration, et le serveur sous la même adresse (`?api=/` = `VITE_API_URL=/` : `/api/…` sur l'origine de la page) ;
//   3. la migration entre deux origines locales : l'ancienne adresse (pages de redirection de GitHub Pages, `node scripts/site.mjs redirections`)
//      sur 127.0.0.1:4178, le nouveau domaine sur localhost:4177 ; l'identité passe dans le fragment, est importée une fois, le fragment effacé.
// Les deux jeux doivent être construits (la part DailyTrack de la CI construit les deux). Serveurs lancés ici (ports 4177, 4178, 8793 : réservés).
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const ROOT = resolve("../..");
const SITE = "http://localhost:4177";
const OLD = "http://127.0.0.1:4178";
const API_PORT = 8793;
const ID = "0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";

let tmp = "";
let servers: Server[] = [];
let api: ChildProcess | null = null;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "playdujour-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  execFileSync("node", ["scripts/site.mjs", "redirections", "--sortie", join(tmp, "pages"), "--cible", SITE, "--base", "/DailyTrack/"], { cwd: ROOT, stdio: "inherit" });
  api = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: String(API_PORT), DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${API_PORT}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers = [await startSite(join(tmp, "site"), 4177, API_PORT), await startOldPages(join(tmp, "pages"), 4178)];
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

test("portail : une carte par jeu, le numéro du jour, un lien relatif", async ({ browser }) => {
  const page = await (await newClockedContext(browser)).newPage();
  await page.goto(`${SITE}/`);
  await expect(page).toHaveTitle("Du Jour");
  const cards = page.locator("#jeux a.carte");
  await expect(cards).toHaveCount(2);
  await expect(page.locator('a[data-jeu="track"] .numero')).toHaveText("Circuit n° 8"); // 20/10/2026 (TODAY)
  await expect(page.locator('a[data-jeu="jump"] .numero')).toHaveText("Niveau n° 5");
  await expect(page.locator("#date")).toHaveText("20/10/2026");
  await page.locator('a[data-jeu="jump"]').click();
  await expect(page).toHaveURL(`${SITE}/jump/`);
});

test("les deux jeux sous /track/ et /jump/ : ressources, niveaux figés, démonstration, serveur sous la même adresse", async ({ browser }) => {
  const page = await (await newClockedContext(browser)).newPage();
  await page.goto(`${SITE}/`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : les jeux ne démarrent pas (portail et migration testés à part)");

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

test("migration : l'ancienne adresse redirige avec les paramètres, l'identité passe dans le fragment, importée une fois, fragment effacé", async ({ browser }) => {
  const context = await newClockedContext(browser);
  const page = await context.newPage();
  // Le stockage de l'ancienne origine : une page hors de /DailyTrack/ (pas de redirection) pour l'écrire.
  await page.goto(`${OLD}/autre`);
  await page.evaluate((id) => {
    localStorage.setItem("cdj:player", id);
    localStorage.setItem("cdj:name", "Ancien");
    localStorage.setItem("jump:classement:attente", JSON.stringify({ date: "2026-10-20", marque: "migration" }));
    localStorage.setItem("jump:settings", "{}");
  }, ID);

  // DailyJump : /DailyTrack/jump/?seed=… → /jump/?seed=… (le fragment lu puis effacé, l'identité et l'envoi en attente importés).
  await page.goto(`${OLD}/DailyTrack/jump/?seed=2026-10-19`);
  await page.waitForURL(`${SITE}/jump/?seed=2026-10-19`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  expect(await page.evaluate(() => [localStorage.getItem("cdj:player"), localStorage.getItem("cdj:name"), localStorage.getItem("jump:classement:attente"), localStorage.getItem("jump:settings")])).toEqual([
    ID,
    "Ancien",
    JSON.stringify({ date: "2026-10-20", marque: "migration" }),
    null,
  ]);
  // Le fragment n'a jamais été envoyé à un serveur : aucune requête n'en porte la trace.
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));

  // DailyTrack, même identité : /DailyTrack/?seed=… → /track/?seed=…, aucune question.
  let asked = 0;
  page.on("dialog", (d) => {
    asked++;
    void d.dismiss();
  });
  await page.goto(`${OLD}/DailyTrack/?seed=2026-10-18&watch=best`);
  await page.waitForURL(`${SITE}/track/?seed=2026-10-18&watch=best`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  expect(asked).toBe(0);
  expect(urls.filter((u) => u.includes("dujour"))).toEqual([]);

  // Un ancien aperçu de branche : une page qui explique (aucune redirection vers un jeu).
  await page.goto(`${OLD}/DailyTrack/b/claude-lot-5/jump/`);
  await expect(page.getByRole("heading", { name: "Les aperçus ont déménagé" })).toBeVisible();
  expect(page.url()).toBe(`${OLD}/DailyTrack/b/claude-lot-5/jump/`);
});

test("migration : une autre identité déjà sur le nouveau domaine — le joueur choisit ; le même fragment n'est importé qu'une fois", async ({ browser }) => {
  const context = await newClockedContext(browser);
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  await page.evaluate((other) => {
    localStorage.setItem("cdj:player", other);
    localStorage.setItem("cdj:name", "Nouveau");
  }, OTHER);
  const store = new Map<string, string>([["cdj:player", ID], ["cdj:name", "Ancien"]]);
  const fragment = migrationFragment(
    collectMigration({ getItem: (k) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {}, key: (i) => [...store.keys()][i] ?? null, length: store.size })!,
  );

  // Refus (Annuler) : on garde l'identité de cet appareil.
  const questions: string[] = [];
  page.once("dialog", (d) => {
    questions.push(d.message());
    void d.dismiss();
  });
  await page.goto(`${SITE}/jump/${fragment}`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  expect(questions[0]).toContain("« Ancien »");
  expect(questions[0]).toContain("« Nouveau »");
  expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBe(OTHER);

  // Le même fragment revenu (vieux favori) : déjà traité, plus de question.
  let again = 0;
  const count = () => void again++;
  page.on("dialog", count);
  await page.goto(`${SITE}/track/${fragment}`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  expect(again).toBe(0);
  page.off("dialog", count);

  // Un nouveau fragment (autre pseudo) et OK : l'identité de l'ancienne adresse remplace celle de l'appareil (règle d'un code chargé).
  store.set("cdj:name", "Ancien2");
  const second = migrationFragment(
    collectMigration({ getItem: (k) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {}, key: (i) => [...store.keys()][i] ?? null, length: store.size })!,
  );
  // (Vers /jump/ : la page est sur /track/, et un simple changement de fragment ne recharge pas la page — la redirection, elle, arrive
  // toujours d'une autre origine.)
  page.once("dialog", (d) => void d.accept());
  await page.goto(`${SITE}/jump/${second}`);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cdj:player"))).toBe(ID);
  expect(await page.evaluate(() => [localStorage.getItem("cdj:name"), location.hash])).toEqual(["Ancien2", ""]);
});
