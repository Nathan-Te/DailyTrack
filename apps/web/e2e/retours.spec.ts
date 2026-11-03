import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, newContextAt, test } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot C1, partie A (plateforme) : « Un bug ? Une idée ? » et « Mes messages » — **un seul parcours** (règle R13 : le reste est en unitaire, `apps/api/test/retours.test.ts`, `packages/ui/test/retours.test.ts`,
// `packages/profile/test/retours.test.ts`). Le joueur de démonstration de la recette (« Démo », qui a déjà un retour avec la réponse de l'éditeur à lire) :
//   - sur l'accueil du portail, la pastille de son avatar dit qu'une réponse attend (une seule requête au chargement : `GET /api/portail/jour`) ;
//   - le lien du pied ouvre le dialogue : le contexte joint est montré avant l'envoi ; il écrit un message (un piège HTML qui reste du texte) et l'envoie ;
//   - « Mes messages » : ses deux fils, la réponse de l'éditeur est dans le fil (et marquée lue : la pastille disparaît), il répond ;
//   - l'identifiant secret n'est jamais dans une adresse.
// Serveurs lancés ici (ports réservés à ce fichier) : site 4240, API 8840 (la recette garnie le 24/10, le vrai serveur et le vrai `recette:seed`).
test.setTimeout(150_000);
const expect = baseExpect.configure({ timeout: 25_000 });

const ROOT = resolve("../..");
const DEMO_ID = "de30de30de30de30de30de30de30de30";
/** Le 24/10/2026, midi UTC : la journée n° 2 de Du Jour. */
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE = "http://localhost:4240";
const API = "http://127.0.0.1:8840";

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

test.beforeAll(async () => {
  test.setTimeout(420_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  if (!existsSync(join(ROOT, "apps/api/dist/server.mjs"))) throw new Error("apps/api n'est pas construit : npm run build");
  tmp = mkdtempSync(join(tmpdir(), "retours-"));
  // Le site comme sur la recette et les aperçus (portail, DailyTrack sous /track/, DailyJump sous /jump/).
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  // La recette garnie le 24/10 : « Démo », sa vingtaine de joueurs du classement et ses amis (`seedAmisDemo`, par le vrai `createApi`).
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  const child = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: "8840", DB_PATH: join(tmp, "recette.sqlite"), ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(T24 - Date.now()) },
    stdio: "ignore",
  });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers.push(await startSite(join(tmp, "site"), 4240, 8840));
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

interface Fil {
  id: number;
  nonLu: boolean;
  messages: number;
}

test("Démo : la pastille de l'avatar › le dialogue (contexte montré) › « Mes messages » : la réponse de l'éditeur, puis la sienne", async ({ browser }) => {
  const entetes = { "X-Player-Id": DEMO_ID };
  const avant = (await (await fetch(`${API}/api/retours`, { headers: entetes })).json()) as { fils: Fil[]; nonLus: number };
  expect(avant.nonLus).toBe(1);
  const context = await newContextAt(browser, T24, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "fr-FR" });
  const page = await context.newPage();
  const requetes: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) requetes.push(`${r.method()} ${u.pathname}${u.search}`);
  });

  // L'accueil : une seule requête (le jour), la pastille sur l'avatar et son nom lu qui dit pourquoi.
  await page.goto(`${SITE}/?demo=joueur`);
  const avatar = page.locator("a.dj-avatar--lien");
  await expect(avatar.locator(".dj-avatar__pastille")).toBeVisible();
  await expect(avatar).toHaveAttribute("aria-label", /réponse t'attend/);
  expect(requetes.filter((r) => r.startsWith("GET /api/portail/jour"))).toHaveLength(1);

  // Le dialogue : tout le contexte joint est montré, rien de caché.
  await page.locator("#retours").click();
  const dialogue = page.locator(".dj-retour");
  await expect(dialogue).toBeVisible();
  await expect(dialogue.locator(".dj-retour__ligne")).toHaveCount(8);
  await expect(dialogue.locator(".dj-retour__contexte")).toContainText("Chrome"); // la famille du navigateur, jamais le détail
  await expect(dialogue.locator(".dj-retour__contexte")).toContainText("390x844");
  await expect(dialogue.locator(".dj-retour__ligne dd").last()).toHaveText(/^[0-9a-f]{12}$/); // la référence publique (jamais l'identifiant secret)
  await dialogue.getByRole("radio", { name: "Une idée" }).click();
  const piege = "<img src=x onerror=alert(1)> Un 4e jeu ?";
  await dialogue.locator("textarea").fill(piege);
  await dialogue.locator(".dj-retour__actions .dj-bouton--marque").click();
  await expect(dialogue.locator(".dj-retour__merci")).toBeVisible();
  await expect(dialogue).toContainText("Mes messages");
  await expect(page.locator(".dj-retour img")).toHaveCount(0);
  const apres = (await (await fetch(`${API}/api/retours`, { headers: entetes })).json()) as { fils: Fil[] };
  expect(apres.fils).toHaveLength(avant.fils.length + 1);

  // « Mes messages » : la réponse de l'éditeur est dans le fil, marquée lue ensuite ; Démo répond.
  await dialogue.getByRole("link", { name: "Mes messages" }).click();
  await expect(page).toHaveURL(`${SITE}/messages/`);
  const liste = page.locator("#messages-liste li");
  await expect(liste).toHaveCount(avant.fils.length + 1);
  const nonLu = page.locator("#messages-liste li.messages-fil--nonlu");
  await expect(nonLu).toHaveCount(1);
  await nonLu.locator("a").click();
  await expect(page.locator("#messages-bulles li")).toHaveCount(2);
  await expect(page.locator('#messages-bulles li.messages-bulle--admin')).toContainText("la scie sort du mur");
  await expect.poll(async () => ((await (await fetch(`${API}/api/retours`, { headers: entetes })).json()) as { nonLus: number }).nonLus).toBe(0);
  await page.locator("#messages-reponse").fill("Parfait, merci !");
  await page.locator("#messages-form .dj-bouton--marque").click();
  await expect(page.locator("#messages-bulles li")).toHaveCount(3);
  await expect(page.locator("#messages-bulles li").last()).toContainText("Parfait, merci !");

  // L'identifiant secret n'est dans aucune adresse.
  expect(page.url()).not.toContain(DEMO_ID);
  expect(requetes.join("\n")).not.toContain(DEMO_ID);
});
