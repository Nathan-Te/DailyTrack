import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, newContextAt, test } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Captures du README du lot C1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-c1 --project=chromium` (`OUT=…` change le dossier). Sur la recette garnie le 24/10 (vrai serveur, vrai `recette:seed`),
// en français, téléphone en portrait (390 × 844) et ordinateur en paysage (844 × 390) : le dialogue « Un bug ? Une idée ? », « Mes messages », l'avatar dans le classement, la page d'un groupe, le classement des
// groupes et les trois rubriques du panneau (Retours, Images, Groupes ; vérificateur factice). Ports 4243 et 8843.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "Chromium seulement");
test.setTimeout(300_000);
test.describe.configure({ mode: "serial" });

const ROOT = resolve("../..");
const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE = "http://localhost:4243";
const API = "http://127.0.0.1:8843";
const ADMIN = "admin@example.test";

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];
test.beforeAll(async () => {
  test.setTimeout(420_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "captures-c1-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], { cwd: ROOT, env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" }, stdio: "inherit" });
  apis.push(
    spawn("node", ["../api/dist/server.mjs"], {
      env: { ...process.env, PORT: "8843", DB_PATH: join(tmp, "recette.sqlite"), ALLOWED_ORIGINS: SITE, NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(T24 - Date.now()), ADMIN_FAKE_VERIFIER: "1", ADMIN_EMAILS: ADMIN, ADMIN_SESSION_KEY: "cle-de-session-pour-les-essais-0123456789", ADMIN_GOOGLE_CLIENT_ID: "123456789012-essais.apps.googleusercontent.com" },
      stdio: "ignore",
    }),
  );
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers.push(await startSite(join(tmp, "site"), 4243, 8843));
});
test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

for (const format of [
  { slug: "portrait", width: 390, height: 844 },
  { slug: "paysage", width: 844, height: 390 },
]) {
  test(`captures ${format.slug}`, async ({ browser }) => {
    const context = await newContextAt(browser, T24, { locale: "fr-FR", viewport: { width: format.width, height: format.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const photo = (nom: string) => page.screenshot({ path: join(OUT, `lot-C1-${nom}-${format.slug}.png`), fullPage: true });

    // Le dialogue « Un bug ? Une idée ? » et « Mes messages » (« Démo » a une réponse qui attend).
    await page.goto(`${SITE}/?demo=joueur`);
    await expect(page.locator("a.dj-avatar--lien .dj-avatar__pastille")).toBeVisible();
    await page.locator("#retours").click();
    await expect(page.locator(".dj-retour")).toBeVisible();
    await page.locator(".dj-retour textarea").fill("Le bouton de la caméra est trop petit sur mon téléphone.");
    await photo("retour");
    await page.goto(`${SITE}/messages/`);
    await expect(page.locator("#messages-liste li").first()).toBeVisible();
    await photo("messages");

    // L'avatar dans le classement et la page d'un groupe.
    await page.goto(`${SITE}/classement/?date=2026-10-24`);
    await expect(page.locator("main img.dj-avatar__img").first()).toBeVisible();
    await photo("classement-avatar");
    await page.goto(`${SITE}/groupe/${encodeURIComponent("Les Rapides")}`);
    await expect(page.locator("#groupe-nom")).toBeVisible();
    await photo("groupe");
    await page.goto(`${SITE}/classement/?mode=groupes&date=2026-10-24`);
    await expect(page.locator("#groupes-liste li").first()).toBeVisible();
    await photo("classement-groupes");
    await page.goto(`${SITE}/profil/`);
    await expect(page.locator("#groupe-mon")).toBeVisible();
    await photo("profil-groupe");

    // Les trois rubriques du panneau.
    await page.goto(`${SITE}/admin/`);
    await page.locator("#factice-adresse").fill(ADMIN);
    await page.getByRole("button", { name: "Connexion factice" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    for (const [rubrique, titre, attente] of [["retours", "Retours", "#retours-liste"], ["images", "Images", "#images-nouvelles"], ["groupes", "Groupes", "#groupes-liste"]] as const) {
      await page.goto(`${SITE}/admin/#/${rubrique}`);
      await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
      await expect(page.locator(attente)).toBeVisible();
      await page.waitForTimeout(500); // les images de la galerie arrivent en octets
      await photo(`admin-${rubrique}`);
    }
    await context.close();
  });
}
