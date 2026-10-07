import { expect, test } from "@playwright/test";
import { PREMIER_JOUR, dailyTrackId, formatDay } from "@cdj/sim";

// Panneau d'admin et planning (lot 14), en mode démo : sans serveur, remplacements gardés dans ce navigateur.
// DEMO_TODAY = PREMIER_JOUR + 14 (src/demo.ts) ; le test Vitest de la démo vérifie ce nombre.
const DEMO_TODAY = PREMIER_JOUR + 14;
const J2 = DEMO_TODAY + 2;
const J2_DATE = formatDay(J2);

test.setTimeout(150_000);

const ready = (page: import("@playwright/test").Page) => page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 40_000 });

test("admin en démo : bandeau, planning de 14 cartes, aujourd'hui et historique", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/admin/?api=demo");
  await expect(page.locator("#demo-banner")).toBeVisible();
  await expect(page.locator("#conn-state")).toContainText("Connecté");
  const cards = page.locator("#planning .card");
  await expect(cards).toHaveCount(14);
  await expect(cards.first()).toContainText("demain");
  await expect(cards.first()).toContainText(formatDay(DEMO_TODAY + 1));
  await expect(cards.nth(1)).toContainText("J+2");
  // les chiffres d'un circuit arrivent quand il est généré (fil de travail)
  await expect(cards.first().locator("dl.stats")).toContainText("Temps de l'auteur", { timeout: 60_000 });
  await expect(cards.first().locator("dl.stats")).toContainText("Largeurs");
  await expect(cards.first().locator("dl.stats")).toContainText("Virages serrés");
  await expect(cards.first().getByRole("link", { name: "Jouer" })).toHaveAttribute("href", new RegExp(`seed=${formatDay(DEMO_TODAY + 1)}&variant=0`));
  await expect(cards.first().getByRole("link", { name: "Regarder le pilote" })).toHaveAttribute("href", /&demo$/);
  // historique : les 14 jours passés de la démo
  await expect(page.locator("#history .hrow")).toHaveCount(14);
  await expect(page.locator("#history .hrow").first()).toContainText(formatDay(DEMO_TODAY - 1));
  // aujourd'hui : pas de joueur en démo
  await expect(page.locator("#daynow")).toContainText(/0\s*joueur/);
  expect(errors).toEqual([]);
});

test("remplacer J+2 dans le panneau, puis ouvrir le jeu sur ce jour : c'est la variante choisie", async ({ page }) => {
  await page.goto("/admin/?api=demo");
  await page.evaluate(() => localStorage.removeItem("cdj:demo-plan"));
  await page.reload();
  const card = page.locator(`#planning .card[data-date="${J2_DATE}"]`);
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Remplacer" }).click();
  const candidates = page.locator("#candidates .candidate");
  await expect(candidates).toHaveCount(5);
  // chaque variante a ses chiffres, ses liens Jouer / Regarder ; le thème est modifiable
  await expect(candidates.nth(2).locator("dl.stats")).toContainText("Temps de l'auteur", { timeout: 60_000 });
  await expect(candidates.nth(2).getByRole("link", { name: "Jouer" })).toHaveAttribute("href", new RegExp(`seed=${J2_DATE}&variant=3`));
  // choisir demande une confirmation
  await candidates.nth(2).getByRole("button", { name: "Choisir" }).click();
  await expect(candidates.nth(2)).toContainText(`Remplacer le ${J2_DATE} par la variante 3`);
  await candidates.nth(2).getByRole("button", { name: "Annuler" }).click();
  expect(await page.evaluate(() => localStorage.getItem("cdj:demo-plan"))).toBeNull();
  await candidates.nth(2).getByRole("button", { name: "Choisir" }).click();
  await candidates.nth(2).getByRole("button", { name: "Confirmer" }).click();
  await expect(page.locator("#replace")).toBeHidden();
  await expect(card).toHaveAttribute("data-variant", "3");
  await expect(card.locator(".badge")).toHaveText("variante 3");
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("cdj:demo-plan")))!)).toEqual({ [J2_DATE]: { variant: 3, theme: null } });

  // Le jeu en démo respecte le remplacement : même identifiant de circuit que le panneau.
  await page.goto(`/?api=demo&day=${J2_DATE}&debug`);
  await ready(page);
  expect(await page.evaluate(() => window.__cdj.trackId)).toBe(dailyTrackId(J2, null, 3));
  await expect(page.locator("#meta")).toContainText("mode démo");
  expect((await page.evaluate(() => window.__cdj.plan)).variant).toBe(3);
  // un autre jour reste le circuit d'origine
  await page.goto(`/?api=demo&day=${formatDay(J2 + 1)}&debug`);
  await ready(page);
  expect(await page.evaluate(() => window.__cdj.trackId)).toBe(dailyTrackId(J2 + 1));
});

test("revenir à l'original ; aujourd'hui et le passé n'ont pas de bouton de remplacement", async ({ page }) => {
  await page.goto("/admin/?api=demo");
  await page.evaluate((d) => localStorage.setItem("cdj:demo-plan", JSON.stringify({ [d]: { variant: 2, theme: null } })), J2_DATE);
  await page.reload();
  const card = page.locator(`#planning .card[data-date="${J2_DATE}"]`);
  await expect(card.locator(".badge")).toHaveText("variante 2");
  await card.getByRole("button", { name: "Remplacer" }).click();
  await page.getByRole("button", { name: "Revenir à l'original" }).click();
  await page.locator("#replace").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.locator("#replace")).toBeHidden();
  await expect(card).toHaveAttribute("data-variant", "0");
  expect(await page.evaluate(() => localStorage.getItem("cdj:demo-plan"))).toBeNull();
  // le planning ne propose que les jours à venir : ni aujourd'hui ni les jours passés
  const dates = await page.locator("#planning .card").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.date));
  expect(dates).not.toContain(formatDay(DEMO_TODAY));
  expect(dates).not.toContain(formatDay(DEMO_TODAY - 1));
});

test("les outils d'essai : la variante devient ?variant=N, et un essai de variante n'est jamais classé", async ({ page }) => {
  await page.goto("/admin/");
  await page.locator("#date").fill("2026-10-20");
  await page.locator("#variant").fill("2");
  await expect(page.locator("#url")).toContainText("seed=2026-10-20&variant=2");
  // sans API configurée, le planning montre les circuits d'origine mais ne permet pas de les remplacer
  await expect(page.locator("#conn-state")).toContainText("Aucune API");
  await expect(page.locator("#planning .card").first().getByRole("button", { name: "Remplacer" })).toBeDisabled();
});

test("le jeu : variante d'essai (?variant=) jouable, jamais classée ; sans API : hors ligne, non classé", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "WebGL : Chromium seulement");
  await page.goto(`/?seed=${J2_DATE}&variant=2&debug`);
  await ready(page);
  expect(await page.evaluate(() => window.__cdj.trackId)).toBe(dailyTrackId(J2, null, 2));
  expect(await page.evaluate(() => window.__cdj.plan)).toMatchObject({ variant: 2, trial: true, ranked: false });
  await expect(page.locator("#meta")).toContainText("variante 2");
  await expect(page.locator("#meta")).toContainText("non classé");
  await page.goto("/?debug");
  await ready(page);
  expect(await page.evaluate(() => window.__cdj.plan)).toMatchObject({ known: false, ranked: false });
  await expect(page.locator("#meta")).toContainText("hors ligne, non classé");
});

// --- Avec le vrai serveur (celui du conteneur Docker, base en mémoire, ADMIN_TOKEN fixé par playwright.config.ts) -----------
const API = "http://127.0.0.1:8787";
const TOKEN = "e2e-admin-token-0123456789";
const REAL_TODAY = Math.floor(Date.now() / 86_400_000);

test("admin avec le vrai serveur : mauvais jeton refusé, bon jeton accepté, remplacement puis retour à l'original", async ({ page, request }) => {
  await page.goto(`/admin/?api=${encodeURIComponent(API)}`);
  await page.evaluate(() => localStorage.removeItem("cdj:admin-token"));
  await page.reload();
  await expect(page.locator("#token-form")).toBeVisible();
  await page.locator("#token").fill("un-mauvais-jeton-0123456789");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("#conn-state")).toContainText("Jeton refusé");
  await expect(page.locator("#token-form")).toBeVisible();

  await page.locator("#token").fill(TOKEN);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("#conn-state")).toContainText("Connecté");
  await expect(page.locator("#token-form")).toBeHidden();
  await expect(page.locator("#demo-banner")).toBeHidden();
  await expect(page.locator("#planning .card")).toHaveCount(14);
  // le jeton survit au rechargement (gardé dans ce navigateur)
  await page.reload();
  await expect(page.locator("#conn-state")).toContainText("Connecté");

  const date = formatDay(REAL_TODAY + 2);
  const card = page.locator(`#planning .card[data-date="${date}"]`);
  await card.getByRole("button", { name: "Remplacer" }).click();
  const first = page.locator("#candidates .candidate").first();
  await expect(first.locator("dl.stats")).toContainText("Temps de l'auteur", { timeout: 60_000 });
  await first.getByRole("button", { name: "Choisir" }).click();
  await first.getByRole("button", { name: "Confirmer" }).click();
  await expect(card).toHaveAttribute("data-variant", "1", { timeout: 30_000 });
  const overview = await request.get(`${API}/api/admin/overview`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  expect((await overview.json()).plan).toMatchObject([{ date, variant: 1, theme: null }]);

  // aujourd'hui : refusé par le serveur, même avec le bon jeton
  const refused = await request.put(`${API}/api/admin/planning/${formatDay(REAL_TODAY)}`, { headers: { Authorization: `Bearer ${TOKEN}` }, data: { variant: 1 } });
  expect(refused.status()).toBe(409);
  // sans jeton : refusé
  expect((await request.put(`${API}/api/admin/planning/${date}`, { data: { variant: 2 } })).status()).toBe(401);

  await card.getByRole("button", { name: "Remplacer" }).click();
  await page.getByRole("button", { name: "Revenir à l'original" }).click();
  await page.locator("#replace").getByRole("button", { name: "Confirmer" }).click();
  await expect(card).toHaveAttribute("data-variant", "0", { timeout: 30_000 });
  expect((await (await request.get(`${API}/api/admin/overview`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()).plan).toEqual([]);
});

test("le jeu avec le vrai serveur : le circuit du jour vient du planning, course classable", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "WebGL : Chromium seulement");
  await page.goto(`/?api=${encodeURIComponent(API)}&debug`);
  await ready(page);
  expect(await page.evaluate(() => window.__cdj.trackId)).toBe(dailyTrackId(REAL_TODAY));
  expect(await page.evaluate(() => window.__cdj.plan)).toMatchObject({ variant: 0, known: true, trial: false, ranked: true });
  await expect(page.locator("#meta")).not.toContainText("hors ligne");
});

test("le jeu : API muette → circuit d'origine, jouable, marqué hors ligne et non classé", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "WebGL : Chromium seulement");
  await page.goto("/?api=http://127.0.0.1:9&debug"); // personne n'écoute
  await ready(page);
  expect(await page.evaluate(() => window.__cdj.trackId)).toBe(dailyTrackId(REAL_TODAY));
  expect(await page.evaluate(() => window.__cdj.plan)).toMatchObject({ variant: 0, known: false, ranked: false });
  await expect(page.locator("#meta")).toContainText("hors ligne, non classé");
});
