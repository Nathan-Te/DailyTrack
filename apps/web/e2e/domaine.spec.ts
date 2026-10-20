import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodeTransfer } from "@cdj/profile";
import { expect as baseExpect, hasWebGL, newClockedContext, test, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot R4 (plateforme) : playdujour.com en local.
//   1. le portail « Du Jour » (une carte par jeu, numéro du jour) ;
//   2. les deux jeux servis sous /track/ et /jump/ du site assemblé (`node scripts/site.mjs site`, comme Firebase Hosting) : ressources, niveaux
//      figés, démonstration, et le serveur sous la même adresse (`?api=/` = `VITE_API_URL=/` : `/api/…` sur l'origine de la page) ;
//   3. lot R5 : plus aucun import par l'adresse — un lien `#dujour=…` (l'ancienne migration du lot R4) n'a aucun effet ;
//   4. lot R5 : la page « Mentions légales et confidentialité », depuis le portail et depuis le menu ⏸ de chaque jeu, au doigt en portrait.
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
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
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
