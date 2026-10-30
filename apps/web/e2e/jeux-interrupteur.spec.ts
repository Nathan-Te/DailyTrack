import { expect, newClockedContext, test } from "./fixtures";
import { ADRESSE_ADMIN, demarrerPanneau, type Panneau } from "./adminPanneau";

// Lot P (plateforme) : **un seul test dans le navigateur** (règle R13) — l'interrupteur des jeux. Nathan passe Jump à `off` depuis l'administration › l'accueil l'a perdu et `/jump/` dit
// « Bientôt » › il le repasse à `on` › il revient. Tout le reste est testé en unitaire : les trois états, le jeu inconnu, la clé d'aperçu, les résultats d'aperçu, `live_from` et les séries
// (`apps/api/test/jeux.test.ts`, `packages/core/test/jeux.test.ts`, `packages/profile/test/jeux.test.ts`). Le portail, Track et Jump sont servis sur une même origine avec l'API (vérificateur
// factice, jamais en ligne), comme en production. Ports 4198 et 8818 réservés.
test.setTimeout(150_000);

let panneau: Panneau;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  panneau = await demarrerPanneau({ portSite: 4198, portApi: 8818, track: true, jump: true });
  await fetch("http://127.0.0.1:8818/api/health");
});

test.afterAll(async () => {
  await panneau?.arreter();
});

/** L'éditeur passe un jeu dans un état, comme le fait le panneau : session factice, puis `POST /api/admin/jeux/<jeu>/etat` (confirmé, avec les en-têtes d'écriture). */
async function interrupteur(jeu: string, etat: "off" | "preview" | "on"): Promise<void> {
  const entetes = { Origin: panneau.site, "X-Cdj-Admin": "1", "Content-Type": "application/json" };
  const session = await fetch(`${panneau.site}/api/admin/session`, { method: "POST", headers: entetes, body: JSON.stringify({ credential: `factice:${ADRESSE_ADMIN}` }) });
  expect(session.status).toBe(200);
  const cookie = /__session=([^;]+)/.exec(session.headers.get("set-cookie") ?? "")![1]!;
  const r = await fetch(`${panneau.site}/api/admin/jeux/${jeu}/etat`, { method: "POST", headers: { ...entetes, Cookie: `__session=${cookie}` }, body: JSON.stringify({ etat, confirmer: true }) });
  expect(r.status, await r.text()).toBe(200);
}

test("Jump `off` › l'accueil l'a perdu et /jump/ dit « Bientôt » › `on` : il revient", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "fr-FR", viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  const cartes = page.locator("#jeux .dj-cartouche[data-jeu]");

  // Avant : les deux jeux à l'accueil.
  await page.goto(`${panneau.site}/`);
  await expect(cartes).toHaveCount(2);
  await expect(page.locator('[data-jeu="jump"]')).toBeVisible();

  // Jump `off` : l'accueil ne le montre plus…
  await interrupteur("jump", "off");
  await page.goto(`${panneau.site}/`);
  await expect(page.locator('[data-jeu="track"]')).toBeVisible();
  await expect(cartes).toHaveCount(1);
  await expect(page.locator('[data-jeu="jump"]')).toHaveCount(0);

  // … et sa page dit « Bientôt » (le jeu n'est pas là), avec un lien vers le portail.
  const jeux = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/jeux");
  await page.goto(`${panneau.site}/jump/?api=/`);
  expect((await (await jeux).json()).jeux).toMatchObject({ jump: "off", track: "on" });
  const bientot = page.locator(".dj-bientot");
  await expect(bientot.locator(".dj-bientot__titre")).toHaveText("Bientôt");
  await expect(bientot.locator(".dj-bientot__texte")).toHaveText("Jump n'est pas encore ouvert. Reviens bientôt !");
  await expect(bientot.locator("a")).toHaveAttribute("href", "../");

  // Track, lui, s'ouvre toujours.
  await page.goto(`${panneau.site}/track/?api=/`);
  await expect(page.locator(".dj-bientot")).toHaveCount(0);

  // Jump `on` : il revient, résultats compris (rien n'a été supprimé).
  await interrupteur("jump", "on");
  await page.goto(`${panneau.site}/`);
  await expect(cartes).toHaveCount(2);
  const revient = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/jeux");
  await page.goto(`${panneau.site}/jump/?api=/`);
  expect((await (await revient).json()).jeux.jump).toBe("on");
  await expect(page.locator(".dj-bientot")).toHaveCount(0);
});
