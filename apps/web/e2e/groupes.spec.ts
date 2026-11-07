import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, newContextAt, test } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot C1, partie C (plateforme) : les groupes — **un seul parcours** (règle R13 : le reste est en unitaire, `apps/api/test/groupes.test.ts`, `groupesScore.test.ts`, `packages/profile/test/groupes.test.ts`). Sur la recette garnie
// (« Les Noctambules » dont « Démo » est le chef, « Les Rapides » avec un emblème, « Les Deux » à moins de 3 classés) :
//   - la page publique d'un groupe (`/groupe/<nom>`, la réécriture de Hosting) : description, emblème, membres, rang du jour dans chaque vue ; « Les Deux » dit « Moins de 3 classés » ;
//   - `/classement/?mode=groupes` : les groupes classés par la moyenne de leurs 3 meilleurs, « Moins de 3 classés » dessous ; le filtre « Mon groupe » est offert à « Démo » ;
//   - « Démo » voit son groupe dans son profil, avec le lien d'invitation ;
//   - un joueur sans groupe ouvre le lien d'invitation de « Les Rapides » : le jeton quitte l'adresse tout de suite, « Rejoindre le groupe » l'y fait entrer (il compte dès demain) ; l'identifiant n'est dans aucune adresse.
// Serveurs lancés ici (ports réservés à ce fichier) : site 4242, API 8842 (la recette garnie le 24/10, le vrai serveur et le vrai `recette:seed`).
test.setTimeout(150_000);
const expect = baseExpect.configure({ timeout: 25_000 });

const ROOT = resolve("../..");
const DEMO_ID = "de30de30de30de30de30de30de30de30";
/** Le 24/10/2026, midi UTC : la journée n° 2 de Du Jour. */
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE = "http://localhost:4242";
const API = "http://127.0.0.1:8842";

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
  tmp = mkdtempSync(join(tmpdir(), "groupes-"));
  // Le site comme sur la recette et les aperçus (portail, DailyTrack sous /track/, DailyJump sous /jump/).
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  // La recette garnie le 24/10 : « Démo », sa vingtaine de joueurs du classement et ses amis (`seedAmisDemo`, par le vrai `createApi`).
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  const child = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: "8842", DB_PATH: join(tmp, "recette.sqlite"), ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(T24 - Date.now()) },
    stdio: "ignore",
  });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers.push(await startSite(join(tmp, "site"), 4242, 8842));
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test("page publique d'un groupe › classement des groupes › Démo gère le sien › un joueur rejoint par le lien d'invitation", async ({ browser }) => {
  const context = await newContextAt(browser, T24, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "fr-FR" });
  const page = await context.newPage();
  const adresses: string[] = [];
  page.on("request", (r) => adresses.push(r.url()));

  // La page publique d'un groupe : la réécriture sert la page à n'importe quel nom ; sans identité.
  await page.goto(`${SITE}/groupe/${encodeURIComponent("Les Rapides")}`);
  await expect(page.locator("#groupe-nom")).toHaveText("Les Rapides");
  await expect(page.locator("#groupe-description")).toContainText("trois meilleurs");
  await expect(page.locator("#groupe-membres li")).toHaveCount(5);
  await expect(page.locator("#groupe-rangs li").first()).toBeVisible();
  await expect(page.locator("main img.dj-avatar__img").first()).toHaveAttribute("src", /^\/api\/avatars\/[0-9a-f]{16}$/); // l'emblème
  await page.goto(`${SITE}/groupe/${encodeURIComponent("Les Deux")}`);
  await expect(page.locator("#groupe-rangs")).toContainText("Moins de 3 classés");
  await page.goto(`${SITE}/groupe/${encodeURIComponent("Nexiste pas")}`);
  await expect(page.locator("#groupe-erreur")).toBeVisible();

  // Le classement des groupes : les deux groupes classés (Les Noctambules, Les Rapides), puis « Moins de 3 classés ».
  await page.goto(`${SITE}/classement/?mode=groupes&date=2026-10-24`);
  await expect(page.locator("#groupes-liste li")).toHaveCount(2);
  await expect(page.locator("#groupes-moins")).toContainText("Les Deux");
  await expect(page.locator("#groupes-moins")).toContainText("Moins de 3 classés");
  // Sur ce même classement, « Démo » (chef des Noctambules) trouve « Mon groupe » dans le sélecteur des joueurs.
  await page.goto(`${SITE}/?demo=joueur`);
  await expect(page.locator(".salle-barre a.dj-avatar--lien")).toBeVisible();
  await page.goto(`${SITE}/classement/?date=2026-10-24`);
  await expect(page.locator('#classement-selecteur [data-filtre="groupe"]')).toBeVisible();
  await page.locator('#classement-selecteur [data-filtre="groupe"]').click();
  await expect(page.locator("#classement-liste .classement-ligne")).toHaveCount(4);

  // Le profil de « Démo » : son groupe, le lien d'invitation, la gestion du chef.
  await page.goto(`${SITE}/profil/`);
  await expect(page.locator("#groupe-mon")).toBeVisible();
  await expect(page.locator("#groupe-lien-page")).toHaveText("Les Noctambules");
  await expect(page.locator("#groupe-lien")).toHaveValue(/\/groupe\/Les%20Noctambules\?invitation=[0-9a-f]{32}$/);
  await expect(page.locator("#groupe-chef")).toBeVisible();

  // Un joueur sans groupe (« Démo Tilleul ») ouvre le lien d'invitation de « Les Rapides » : le jeton quitte l'adresse, il rejoint.
  const abricot = identifiantFictif("Démo Abricot");
  const moi = (await (await fetch(`${API}/api/groupes/moi`, { headers: { "X-Player-Id": abricot } })).json()) as { groupe: { invitation: string } };
  const tilleul = identifiantFictif("Démo Tilleul");
  const autre = await newContextAt(browser, T24, { viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const p2 = await autre.newPage();
  const vus: string[] = [];
  p2.on("request", (r) => vus.push(r.url()));
  await p2.addInitScript(([i, n]) => {
    localStorage.setItem("cdj:player", i!);
    localStorage.setItem("cdj:name", n!);
  }, [tilleul, "Démo Tilleul"]);
  await p2.goto(`${SITE}/groupe/${encodeURIComponent("Les Rapides")}?invitation=${moi.groupe.invitation}`);
  await expect(p2.locator("#groupe-rejoindre")).toBeEnabled();
  expect(new URL(p2.url()).search).toBe(""); // le jeton a quitté l'adresse
  await p2.locator("#groupe-rejoindre").click();
  await expect(p2.locator("#groupe-message")).toContainText("Tu fais partie du groupe");
  await expect(p2.locator("#groupe-membres li")).toHaveCount(6);
  const apres = (await (await fetch(`${API}/api/groupes/moi`, { headers: { "X-Player-Id": tilleul } })).json()) as { groupe: { nom: string; chef: boolean } };
  expect(apres.groupe).toMatchObject({ nom: "Les Rapides", chef: false });
  expect([...adresses, ...vus].filter((a) => a.includes(tilleul) || a.includes(abricot))).toEqual([]); // l'identifiant secret n'est dans aucune adresse
  await autre.close();
  await context.close();
});
