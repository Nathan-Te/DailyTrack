import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, hasWebGL, newClockedContext, test, type Browser, type BrowserContext, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot R8 (plateforme) — « tout le monde repart de zéro ». Le vrai serveur sur une base de fichier dont le nom contient « recette », le site assemblé
// comme Firebase Hosting le sert ; la remise à zéro est le vrai script du lot (`npm run lancement:remise-a-zero`), lancé entre deux chargements :
//   - un navigateur qui avait un profil et une série d'avant (portail, DailyTrack, DailyJump) arrive en joueur neuf, **garde sa langue, son son, ses
//     réglages**, voit le message « Nouveau départ » **une seule fois** ; sa vieille identité est inconnue du serveur (la base est vide) ;
//   - un navigateur neuf ne voit aucun message, une identité inconnue du serveur (`unknown_player`) n'est pas une erreur ;
//   - un navigateur d'avant le lot (aucune génération) est effacé de même.
// Les deux jeux doivent être construits. Serveurs lancés ici (site 4184, API 8800 : réservés).
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const ROOT = resolve("../..");
const SITE = "http://localhost:4184";
const API_PORT = 8800;
const ID = "0123456789abcdef0123456789abcdef";
const BASE = "e2e-recette.sqlite";

let tmp = "";
let db = "";
let server: Server | null = null;
let api: ChildProcess | null = null;

async function demarrerApi(): Promise<void> {
  api = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: String(API_PORT), DB_PATH: db, ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${API_PORT}/api/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("serveur injoignable");
}

async function arreterApi(): Promise<void> {
  if (!api) return;
  const fini = new Promise((r) => api!.once("exit", r));
  api.kill();
  await fini;
  api = null;
}

/** La génération de données que le serveur annonce (le portail la rend dans sa réponse publique). */
const generationDuServeur = async (): Promise<number> => ((await (await fetch(`http://127.0.0.1:${API_PORT}/api/portail/jour`)).json()) as { generation: number }).generation;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "nouveau-depart-"));
  db = join(tmp, BASE);
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site"), "--origine", SITE], { cwd: ROOT, stdio: "inherit" });
  await demarrerApi();
  server = await startSite(join(tmp, "site"), 4184, API_PORT);
});

test.afterAll(async () => {
  await new Promise((r) => (server ? server.close(r) : r(null)));
  await arreterApi();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Un joueur d'avant : identité, pseudo, records, séries, envois en attente, mémoire de Jump… et des réglages qui doivent survivre. */
const AVANT = {
  "cdj:player": ID,
  "cdj:name": "Nowy",
  "cdj:best:jour-2026-10-20-g1": '{"ms":40123,"medal":"gold"}',
  "cdj:rank:2026-10-20": '{"rank":2,"participants":9}',
  "jump:historique": '{"v":1}',
  "jump:classement:attente": "[]",
  "jump:vies:envoi": "[]",
  "cdj:howto": "1",
  "cdj:langue": "en",
  "cdj:audio": '{"volume":0.2}',
  "cdj:settings": '{"unit":"mph"}',
  "jump:settings": '{"sound":0.3}',
};

/** Un contexte dont le stockage reçoit `donnees` **une seule fois** (au premier chargement : un rechargement ne les remet pas). */
async function contexteAvec(browser: Browser, donnees: Record<string, string>, options: Parameters<Browser["newContext"]>[0] = {}): Promise<BrowserContext> {
  const context = await newClockedContext(browser, options);
  await context.addInitScript((d: Record<string, string>) => {
    if (localStorage.getItem("test:amorce")) return;
    localStorage.setItem("test:amorce", "1");
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
  }, donnees);
  return context;
}

const cles = (page: Page) => page.evaluate(() => Object.keys(localStorage).sort());
const valeur = (page: Page, cle: string) => page.evaluate((k) => localStorage.getItem(k), cle);

test("le portail : le profil et la série d'avant disparaissent, la langue reste, le message ne vient qu'une fois", async ({ browser }) => {
  const context = await contexteAvec(browser, AVANT);
  const page = await context.newPage();
  // Avant la remise à zéro : le serveur connaît ce joueur (une ligne dans `players`), la génération est 0, le navigateur la retient sans rien effacer.
  const bdd = new DatabaseSync(db);
  bdd.exec("PRAGMA busy_timeout = 5000");
  bdd.prepare("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Nowy', 0, 0, 'nowy')").run(ID);
  bdd.close();
  await page.goto(`${SITE}/`);
  await expect(page.locator("#journee, #date").first()).toBeVisible();
  await expect.poll(() => valeur(page, "cdj:generation")).toBe("0");
  expect(await valeur(page, "cdj:player")).toBe(ID);
  expect((await fetch(`http://127.0.0.1:${API_PORT}/api/me`, { headers: { "X-Player-Id": ID } })).status).toBe(200);

  // La remise à zéro du lancement (le vrai script, sur la base de ce test), puis le serveur redémarre sur la base vide.
  await arreterApi();
  const sortie = execFileSync(
    "npm",
    ["run", "--silent", "lancement:remise-a-zero", "--", "--cible", "recette", "--base", BASE, "--phrase", "tout le monde repart de zéro", "--appliquer"],
    { cwd: ROOT, env: { ...process.env, DB_PATH: db, TURSO_DATABASE_URL: "" }, encoding: "utf8" },
  );
  expect(sortie).toContain("Génération de données");
  expect(sortie).not.toContain("Nowy"); // aucune donnée personnelle dans le résumé
  await demarrerApi();
  const generation = await generationDuServeur();
  expect(generation).toBeGreaterThan(0);
  expect((await fetch(`http://127.0.0.1:${API_PORT}/api/me`, { headers: { "X-Player-Id": ID } })).status).toBe(404); // la vieille identité est inconnue

  // Le navigateur recharge : ses données de jeu sont effacées, il est un joueur neuf, la page est recommencée et le message le dit (en anglais : sa langue).
  await page.reload();
  await expect(page.locator(".dj-astuce--depart")).toHaveText(/Fresh start: everyone begins from zero\. Good luck!/);
  expect(await cles(page)).toEqual(["cdj:audio", "cdj:generation", "cdj:langue", "cdj:settings", "jump:settings", "test:amorce"]);
  expect(await valeur(page, "cdj:generation")).toBe(String(generation));
  expect(await valeur(page, "cdj:langue")).toBe("en");
  expect(await valeur(page, "cdj:audio")).toBe('{"volume":0.2}');
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // Une seule fois : le chargement suivant n'a plus de message ni rien d'effacé de plus.
  await page.reload();
  await expect(page.locator("#date")).toBeVisible();
  await expect(page.locator(".dj-astuce--depart")).toHaveCount(0);
  expect(await valeur(page, "cdj:nouveau-depart")).toBeNull();
});

test("un navigateur neuf après la remise à zéro : aucun message, la génération est adoptée sans rien effacer ; une identité inconnue n'est pas une erreur", async ({ browser }) => {
  const generation = await generationDuServeur();
  const neuf = await (await newClockedContext(browser, { locale: "fr-FR" })).newPage();
  await neuf.goto(`${SITE}/`);
  await expect(neuf.locator("#date")).toBeVisible();
  await expect.poll(() => valeur(neuf, "cdj:generation")).toBe(String(generation));
  await expect(neuf.locator(".dj-astuce--depart")).toHaveCount(0);

  // Une identité que le serveur ne connaît pas (404 `unknown_player`), à la bonne génération : un joueur neuf, sans message alarmant ni rien d'effacé.
  const inconnu = await (await contexteAvec(browser, { "cdj:player": "f".repeat(32), "cdj:name": "Fantôme", "cdj:generation": String(generation), "cdj:langue": "fr" })).newPage();
  await inconnu.goto(`${SITE}/`);
  await expect(inconnu.locator("#date")).toBeVisible();
  await expect(inconnu.locator('#jeux .dj-cartouche[data-jeu="track"]')).toBeVisible();
  await expect(inconnu.locator(".dj-astuce--depart")).toHaveCount(0);
  await expect(inconnu.locator('[role="alert"]')).toHaveCount(0);
  expect(await valeur(inconnu, "cdj:player")).toBe("f".repeat(32));
  expect(await inconnu.locator("body").innerText()).not.toMatch(/erreur|error|invalide|invalid/i);
});

test("DailyTrack : un navigateur d'avant le lot (aucune génération) est effacé, ses réglages gardés, le message est sur l'accueil et ne vient qu'une fois", async ({ browser }) => {
  const page = await (await contexteAvec(browser, AVANT, { locale: "en-US" })).newPage();
  test.skip(!(await hasWebGL(page)), "DailyTrack a besoin de WebGL");
  const generation = await generationDuServeur();
  await page.goto(`${SITE}/track/?api=/`);
  await expect(page.locator("#home .dj-astuce--depart")).toHaveText(/Fresh start/);
  expect(await valeur(page, "cdj:player")).not.toBe(ID); // l'ancienne identité est partie (DailyTrack en tire une neuve dès le chargement)
  expect(await valeur(page, "cdj:name")).not.toBe("Nowy");
  expect(await valeur(page, "cdj:best:jour-2026-10-20-g1")).toBeNull();
  expect(await valeur(page, "cdj:howto")).toBeNull();
  expect(await valeur(page, "cdj:langue")).toBe("en");
  expect(await valeur(page, "cdj:audio")).toBe('{"volume":0.2}');
  expect(await valeur(page, "cdj:generation")).toBe(String(generation));
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator(".dj-astuce--depart")).toHaveCount(0);
});

test("DailyJump : un navigateur d'une génération plus ancienne est effacé, l'accueil le dit une fois, les réglages restent", async ({ browser }) => {
  const page = await (await contexteAvec(browser, { ...AVANT, "cdj:langue": "fr", "cdj:generation": "5" }, { locale: "fr-FR" })).newPage();
  test.skip(!(await hasWebGL(page)), "DailyJump a besoin de WebGL");
  const generation = await generationDuServeur();
  await page.goto(`${SITE}/jump/?api=/`);
  await expect(page.locator("#home .dj-astuce--depart")).toHaveText(/Nouveau départ : tout le monde repart de zéro\. Bonne chance !/);
  expect(await valeur(page, "jump:historique")).toBeNull();
  expect(await valeur(page, "cdj:player")).not.toBe(ID);
  expect(await valeur(page, "cdj:name")).not.toBe("Nowy");
  expect(await valeur(page, "jump:settings")).toBe('{"sound":0.3}');
  expect(await valeur(page, "cdj:generation")).toBe(String(generation));
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator(".dj-astuce--depart")).toHaveCount(0);
});

test("DailyTrack et DailyJump : une identité inconnue du serveur (404 unknown_player) n'est pas une erreur : le jeu s'ouvre, aucun message, rien d'effacé", async ({ browser }) => {
  const generation = await generationDuServeur();
  const context = await contexteAvec(browser, { "cdj:player": "e".repeat(32), "cdj:name": "Fantôme", "cdj:generation": String(generation), "cdj:langue": "fr", "cdj:howto": "1" }, { locale: "fr-FR" });
  const page = await context.newPage();
  test.skip(!(await hasWebGL(page)), "les jeux ont besoin de WebGL");
  for (const jeu of ["track", "jump"]) {
    await page.goto(`${SITE}/${jeu}/?api=/`);
    await expect(page.locator("#home")).toBeVisible();
    // Le profil est lu sur le serveur (404 unknown_player) : un état normal, pas une erreur.
    await page.waitForTimeout(1500); // rien ne doit apparaître (la synchronisation du profil a eu lieu)
    await expect(page.locator(".dj-astuce--depart")).toHaveCount(0);
    await expect(page.locator('#home [role="alert"]')).toHaveCount(0);
    expect(await page.locator("#home").innerText()).not.toMatch(/erreur|error|invalide|invalid/i);
    expect(await valeur(page, "cdj:player")).toBe("e".repeat(32));
    expect(await valeur(page, "cdj:generation")).toBe(String(generation));
  }
});
