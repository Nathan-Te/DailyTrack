import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, newContextAt, test } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot C1, partie B (plateforme) : les avatars — **un seul parcours** (règle R13 : le reste est en unitaire, `apps/api/test/avatars.test.ts`, `apps/portail/test/avatar.test.ts`). Sur la recette garnie (4 joueurs ont une image) :
//   - le classement du jour montre leurs images (adresse immuable `/api/avatars/<empreinte>`, en-têtes de cache et `nosniff`), les autres gardent leurs initiales ;
//   - un joueur sans image ouvre son profil, choisit un fichier, le recadre et l'envoie : le vrai Chromium réencode (profil de couleur compris), le navigateur assainit, **le serveur valide** ;
//   - son image s'affiche, puis le serveur la sert ; l'identifiant secret n'est dans aucune adresse.
// Serveurs lancés ici (ports réservés à ce fichier) : site 4241, API 8841 (la recette garnie le 24/10, le vrai serveur et le vrai `recette:seed`).
test.setTimeout(150_000);
const expect = baseExpect.configure({ timeout: 25_000 });

const ROOT = resolve("../..");
const DEMO_ID = "de30de30de30de30de30de30de30de30";
/** Le 24/10/2026, midi UTC : la journée n° 2 de Du Jour. */
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE = "http://localhost:4241";
const API = "http://127.0.0.1:8841";

// Deux petits WebP (64 × 64) tels que le navigateur sait les lire.
const WEBP_A = "UklGRmQAAABXRUJQVlA4IFgAAACwBACdASpAAEAAPslQoUunpKMhsegA8BkJQBpVIAatjwABJXMqp/Cw4rKfAwAAAP7s4y/5BixqhrRLl6ydIBhfJKZ/jeKVpLr1leiHeCr9B/THNroCAAAA";
const WEBP_B = "UklGRmYAAABXRUJQVlA4IFoAAABQBACdASpAAEAAPs1UpUunpKOhsAkA8BmJQBom1AAcCaTRZg8ZUV8i9PDgAP4TH/G9o67Lx//maP2G/LflngODt7j5RD/AOFKqVFu7ytXjYVd7MKNaaXEAAAA=";
/** L'identifiant des joueurs fictifs de la recette (la même fonction que `fictionalId` du serveur, recopiée : un spec n'importe pas le code du serveur). */
function identifiantFictif(nom: string): string {
  let id = "";
  for (let k = 0; k < 4; k++) {
    let h = (0x811c9dc5 ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
    for (const ch of nom) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    id += h.toString(16).padStart(8, "0");
  }
  return id;
}

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

test.beforeAll(async () => {
  test.setTimeout(420_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  if (!existsSync(join(ROOT, "apps/api/dist/server.mjs"))) throw new Error("apps/api n'est pas construit : npm run build");
  tmp = mkdtempSync(join(tmpdir(), "avatars-"));
  // Le site comme sur la recette et les aperçus (portail, DailyTrack sous /track/, DailyJump sous /jump/).
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  // La recette garnie le 24/10 : « Démo », sa vingtaine de joueurs du classement et ses amis (`seedAmisDemo`, par le vrai `createApi`).
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  const child = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: "8841", DB_PATH: join(tmp, "recette.sqlite"), ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(T24 - Date.now()) },
    stdio: "ignore",
  });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers.push(await startSite(join(tmp, "site"), 4241, 8841));
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test("le classement montre les images (adresse immuable) › un joueur sans image en envoie une : recadrée, assainie, validée par le serveur", async ({ browser }) => {
  const context = await newContextAt(browser, T24, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "fr-FR" });
  const page = await context.newPage();
  const adresses: string[] = [];
  page.on("request", (r) => adresses.push(r.url()));

  // Le classement du jour : les images des joueurs de la recette, pas d'identifiant dans une adresse.
  await page.goto(`${SITE}/classement/?date=2026-10-24`);
  const images = page.locator("main img.dj-avatar__img");
  await expect(images.first()).toBeVisible();
  expect(await images.count()).toBeGreaterThanOrEqual(1);
  const src = await images.first().getAttribute("src");
  expect(src).toMatch(/^\/api\/avatars\/[0-9a-f]{16}$/);
  const res = await fetch(`${SITE}${src}`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(res.headers.get("cache-control")).toContain("immutable");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");

  // Un joueur de la recette sans image.
  const nom = "Démo Tilleul"; // le seed donne une image à « Démo » et aux trois premiers noms dans l'ordre alphabétique
  const id = identifiantFictif(nom);
  await page.addInitScript(([i, n]) => {
    localStorage.setItem("cdj:player", i!);
    localStorage.setItem("cdj:name", n!);
  }, [id, nom]);
  await page.goto(`${SITE}/profil/`);
  await expect(page.locator("#photo-profil")).toBeVisible(); // lot U3 : la photo de 128 px et son crayon
  await page.locator("#photo-profil button").click(); // le crayon moutarde
  await page.locator("#avatar-fichier").setInputFiles({ name: "moi.webp", mimeType: "image/webp", buffer: Buffer.from(WEBP_B, "base64") });
  await expect(page.locator("#avatar-utiliser")).toBeEnabled();
  // Sur un téléphone, glisser le doigt sur l'aperçu déplace la zone prise, pas la page : `touch-action: none`.
  expect(await page.locator(".avatar-edition__apercu").evaluate((e) => getComputedStyle(e).touchAction)).toBe("none");
  await page.locator("#avatar-utiliser").click();
  await expect(page.locator("#avatar-message")).toHaveText("Ton image est enregistrée.");
  const sienne = await page.locator("#photo-profil img.dj-avatar__img").getAttribute("src");
  expect(sienne).toMatch(/^\/api\/avatars\/[0-9a-f]{16}$/);
  expect((await fetch(`${SITE}${sienne}`)).status).toBe(200);
  // Le même jour, un second changement est refusé, avec la phrase du catalogue.
  await page.locator("#photo-profil button").click();
  await page.locator("#avatar-fichier").setInputFiles({ name: "autre.webp", mimeType: "image/webp", buffer: Buffer.from(WEBP_A, "base64") });
  await page.locator("#avatar-utiliser").click();
  await expect(page.locator("#avatar-message")).toContainText("reviens demain");
  expect(adresses.filter((a) => a.includes(id))).toEqual([]); // l'identifiant secret n'est dans aucune adresse
  await context.close();
});
