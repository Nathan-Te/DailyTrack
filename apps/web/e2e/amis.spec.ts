import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, newContextAt, test } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot F2 (plateforme) : les amis dans le classement du portail — **un seul parcours** (règle R13 : le reste est en unitaire, `apps/portail/test/classementAmis.test.ts`, `amisDonnees.test.ts`, et
// `packages/ui/test/amis.test.ts` pour les composants). Le joueur de démonstration de la recette (« Démo », qui a déjà des amis) ouvre `/classement/` du 24/10/2026 :
//   - le sélecteur « Tous · N » / « Amis · 5 » est là (le nombre d'amis vient d'une seule lecture de `GET /api/amis`) et **rien n'est demandé pour « Amis » avant le choix** ;
//   - toucher la ligne d'un joueur qui n'est pas son ami ouvre sa feuille (rang général, temps par jeu) ; « Ajouter en ami » le range dans ses amis, le sélecteur passe à « Amis · 6 » ;
//   - choisir « Amis » : une requête `filtre=amis`, `?filtre=amis` dans l'adresse, le nouvel ami est dans la liste avec **son rang entre amis**, ta ligne en moutarde, personne d'autre que toi et tes amis ;
//   - l'identifiant secret du joueur n'est jamais dans une adresse.
// Serveurs lancés ici (ports réservés à ce fichier) : site 4237, API 8837 (la recette garnie le 24/10, le vrai serveur et le vrai `recette:seed`).
test.setTimeout(150_000);
const expect = baseExpect.configure({ timeout: 25_000 });

const ROOT = resolve("../..");
const DEMO_ID = "de30de30de30de30de30de30de30de30";
/** Le 24/10/2026, midi UTC : la journée n° 2 de Du Jour. */
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE = "http://localhost:4237";
const API = "http://127.0.0.1:8837";

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

test.beforeAll(async () => {
  test.setTimeout(420_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  if (!existsSync(join(ROOT, "apps/api/dist/server.mjs"))) throw new Error("apps/api n'est pas construit : npm run build");
  tmp = mkdtempSync(join(tmpdir(), "amis-"));
  // Le site comme sur la recette et les aperçus (portail, DailyTrack sous /track/, DailyJump sous /jump/).
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  // La recette garnie le 24/10 : « Démo », sa vingtaine de joueurs du classement et ses amis (`seedAmisDemo`, par le vrai `createApi`).
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  const child = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: "8837", DB_PATH: join(tmp, "recette.sqlite"), ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(T24 - Date.now()) },
    stdio: "ignore",
  });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  servers.push(await startSite(join(tmp, "site"), 4237, 8837));
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

interface AmiVu {
  ref: string;
  pseudo: string;
}
interface LigneVue {
  rang: number;
  pseudo: string;
  ref?: string;
  moi?: true;
}

test("classement du 24/10 : toucher un joueur › Ajouter en ami › « Amis » le montre avec son rang entre amis ; « Amis » n'est lu qu'au choix", async ({ browser }) => {
  // La vérité du serveur : les amis de « Démo » avant, et le classement « Tous » (de quoi choisir un joueur qui n'est pas son ami).
  const entetes = { "X-Player-Id": DEMO_ID };
  const avant = (await (await fetch(`${API}/api/amis`, { headers: entetes })).json()) as { amis: AmiVu[]; total: number };
  expect(avant.total).toBeGreaterThanOrEqual(1);
  const tous = (await (await fetch(`${API}/api/portail/classement`, { headers: entetes })).json()) as { top: LigneVue[]; classes: number };
  const amisRefs = new Set(avant.amis.map((a) => a.ref));
  const cible = tous.top.find((l) => !l.moi && l.ref && !amisRefs.has(l.ref));
  expect(cible, "un joueur du classement qui n'est pas l'ami de « Démo »").toBeDefined();

  const context = await newContextAt(browser, T24, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "fr-FR" });
  // L'identité de « Démo » est installée par le lien de démonstration de Nathan (`/classement/?demo=joueur`) : l'identifiant reste dans le stockage et dans l'en-tête, jamais dans une adresse.
  const page = await context.newPage();
  const requetes: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) requetes.push(`${r.method()} ${u.pathname}${u.search}`);
  });

  await page.goto(`${SITE}/classement/?demo=joueur`);
  await expect(page.locator("#classement-liste li")).not.toHaveCount(0);
  // Le sélecteur : « Tous · N » (le classement lu) et « Amis · 5 » (une seule lecture de la liste, au premier affichage).
  const selecteur = page.locator("#classement-selecteur");
  await expect(selecteur.getByRole("radio", { name: `Tous · ${tous.classes}` })).toHaveAttribute("aria-checked", "true");
  await expect(selecteur.getByRole("radio", { name: `Amis · ${avant.total}` })).toHaveAttribute("aria-checked", "false");
  expect(requetes.filter((r) => r.includes("filtre=amis")), "« Amis » n'est pas lu avant d'être choisi").toEqual([]);
  expect(requetes.filter((r) => r === "GET /api/amis")).toHaveLength(1);

  // Toucher la ligne du joueur : sa feuille s'ouvre (rang général, temps par jeu), « Ajouter en ami ».
  await page.locator(`button[data-cle="ligne-${cible!.ref}"]`).click();
  const feuille = page.locator(".dj-feuille");
  await expect(feuille).toBeVisible();
  await expect(feuille.locator(".dj-feuille__titre")).toHaveText(cible!.pseudo);
  await expect(feuille.locator(".dj-feuille__rang")).toContainText(`sur ${tous.classes}`);
  await expect(feuille.locator(".dj-feuille__tableau tbody tr")).not.toHaveCount(0);
  await feuille.locator(".dj-feuille__principal").click();
  await expect(feuille).toContainText(`${cible!.pseudo} est dans tes amis.`);
  await expect(feuille.locator(".dj-feuille__principal")).toHaveText("Retirer");
  await feuille.locator(".dj-feuille__fermer").click();
  await expect(feuille).toHaveCount(0);
  // Le compteur du sélecteur suit, sans relire la liste.
  await expect(selecteur.getByRole("radio", { name: `Amis · ${avant.total + 1}` })).toBeVisible();
  expect(requetes.filter((r) => r === "GET /api/amis")).toHaveLength(1);

  // « Amis » : une requête filtrée, l'adresse la garde, le nouvel ami est là avec son rang entre amis, ta ligne en moutarde.
  await selecteur.getByRole("radio", { name: /^Amis/ }).click();
  await expect(page).toHaveURL(`${SITE}/classement/?filtre=amis`);
  await expect(page.locator("#classement-selecteur").getByRole("radio", { name: /^Amis/ })).toHaveAttribute("aria-checked", "true");
  const filtre = (await (await fetch(`${API}/api/portail/classement?filtre=amis`, { headers: entetes })).json()) as { top: LigneVue[]; absents: AmiVu[]; amis: number };
  expect(filtre.amis).toBe(avant.total + 1);
  const attendu = filtre.top.findIndex((l) => l.ref === cible!.ref);
  expect(attendu, "le nouvel ami est dans le classement « Amis »").toBeGreaterThanOrEqual(0);
  const lignes = page.locator("#classement-liste li");
  await expect(lignes).toHaveCount(filtre.top.length);
  const ligne = page.locator(`#classement-liste li:has(button[data-cle="ligne-${cible!.ref}"])`);
  await expect(ligne).toHaveAttribute("data-rang", String(attendu + 1)); // le rang entre amis, pas le rang général
  await expect(ligne.locator(".classement-rang")).toHaveText(String(attendu + 1));
  await expect(ligne.locator(".classement-pseudo")).toContainText(cible!.pseudo);
  await expect(page.locator('#classement-liste li[data-moi="oui"]')).toHaveCount(1);
  const pseudos = await lignes.locator(".classement-pseudo").evaluateAll((els) => els.map((e) => (e.firstChild?.textContent ?? "").trim()));
  expect([...pseudos].sort()).toEqual(filtre.top.map((l) => l.pseudo).sort()); // toi et tes amis, personne d'autre
  // Les amis qui n'ont rien fini sont en bas, sans temps.
  if (filtre.absents.length) await expect(page.locator("#classement-absents li")).toHaveCount(filtre.absents.length);
  expect(requetes.filter((r) => r.includes("filtre=amis"))).toEqual(["GET /api/portail/classement?filtre=amis"]);

  // L'identifiant secret n'est dans aucune adresse (ni de la page, ni d'une requête).
  expect(page.url()).not.toContain(DEMO_ID);
  expect(requetes.join("\n")).not.toContain(DEMO_ID);

  await page.goto(`${SITE}/amis/`);
  await expect(page.locator("#amis-cartes li.amis-carte")).toHaveCount(avant.total + 1); // lot U3 : tes amis en cartes
  await page.goto(`${SITE}/classement/?filtre=amis`);
  await expect(page.locator("#classement-liste li")).not.toHaveCount(0);

  // Retour à « Tous » : l'adresse perd le filtre.
  await page.locator("#classement-selecteur").getByRole("radio", { name: /^Tous/ }).click();
  await expect(page).toHaveURL(`${SITE}/classement/`);
  await expect(page.locator("#classement-liste li")).toHaveCount(tous.top.length);
});
