import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startSite } from "./domaine-serveurs";
import { expect, newContextAt, test } from "./fixtures";

// Captures du README du lot U6 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-u6`. Quatre vues de `/classement/` — Cumulé, Track (avec les seuils des médailles), Amis, Groupes — sur téléphone (390 × 844)
// et sur ordinateur (1280 × 1060), sur la recette garnie du 24/10 (le vrai `recette:seed` : « Démo », sa vingtaine de joueurs, ses amis et ses groupes), en français.
// `PHASE=apres` (par défaut) : le portail construit ; `PHASE=avant OVERLAY=<dossier dist du portail d'avant>` : les pages et les fichiers du portail d'avant (la construction de `main`) posés sur le même site, pour comparer.
// Serveurs lancés ici (ports réservés à ce fichier) : site 4260, API 8860. Les images vont dans `OUT` (docs/plateforme/lots/lot-U6-captures par défaut).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(300_000);
test.describe.configure({ mode: "serial" });

const ROOT = resolve("../..");
const OUT = process.env.OUT ?? join(ROOT, "docs/plateforme/lots/lot-U6-captures");
const PHASE = process.env.PHASE ?? "apres";
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE = "http://localhost:4260";
const API = "http://127.0.0.1:8860";
const VUES = [
  { nom: "telephone", width: 390, height: 844, mobile: true },
  { nom: "ordinateur", width: 1280, height: 1060, mobile: false },
] as const;
const PAGES = [
  { nom: "cumul", chemin: "/classement/?date=2026-10-24", jouer: false },
  { nom: "track", chemin: "/classement/?date=2026-10-24&vue=track", jouer: false },
  { nom: "amis", chemin: "/classement/?date=2026-10-24&filtre=amis", jouer: false },
  { nom: "groupes", chemin: "/classement/?date=2026-10-24&mode=groupes", jouer: false },
] as const;

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

test.beforeAll(async () => {
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  if (!existsSync(join(ROOT, "apps/api/dist/server.mjs"))) throw new Error("apps/api n'est pas construit : npm run build");
  mkdirSync(OUT, { recursive: true });
  tmp = mkdtempSync(join(tmpdir(), "captures-u6-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  if (process.env.OVERLAY) {
    // Le portail d'avant : ses fichiers (noms à empreinte) s'ajoutent à `assets/`, sa page `/classement/` remplace celle du site.
    cpSync(join(process.env.OVERLAY, "assets"), join(tmp, "site/assets"), { recursive: true });
    cpSync(join(process.env.OVERLAY, "classement/index.html"), join(tmp, "site/classement/index.html"));
  }
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  apis.push(spawn("node", ["../api/dist/server.mjs"], { env: { ...process.env, PORT: "8860", DB_PATH: join(tmp, "recette.sqlite"), ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(T24 - Date.now()) }, stdio: "ignore" }));
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers.push(await startSite(join(tmp, "site"), 4260, 8860));
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

for (const vue of VUES) {
  test(`les quatre vues du classement (${vue.nom}, ${PHASE})`, async ({ browser }) => {
    const context = await newContextAt(browser, T24, { viewport: { width: vue.width, height: vue.height }, locale: "fr-FR", isMobile: vue.mobile, hasTouch: vue.mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    // « Démo » : le joueur de démonstration de la recette (il a fini Track et Jump le 24/10, il a des amis et un groupe).
    await page.goto(`${SITE}/?demo=joueur`);
    await expect(page.locator(".salle-barre a.dj-avatar--lien")).toBeVisible();
    for (const p of PAGES) {
      await page.goto(`${SITE}${p.chemin}`);
      await expect(page.locator(p.nom === "groupes" ? "#groupes-liste li, #groupes-etat" : "#classement-liste li").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(OUT, `lot-U6-${p.nom}-${vue.nom}-${PHASE}.png`), fullPage: true });
    }
    await context.close();
  });
}

// La planche de la vitrine `/ui/` (recette et aperçus seulement) : le composant dans tous ses états, clair et sombre.
test(`la vitrine : la section « Classements » (${PHASE})`, async ({ browser }) => {
  test.skip(PHASE === "avant", "la vitrine n'existait pas avant le lot");
  const context = await newContextAt(browser, T24, { viewport: { width: 1000, height: 1200 }, locale: "fr-FR", deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${SITE}/ui/`);
  const section = page.locator("#classement-fr");
  await expect(page.locator(".vitrine-classement .classement-podium").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await section.screenshot({ path: join(OUT, `lot-U6-vitrine-${PHASE}.png`) });
  await context.close();
});
