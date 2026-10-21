import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dailyCircuit, encodeReplay, formatDay, medalFor, runPilot, salonCircuit, SIM_VERSION, THEME_NAMES, themeForDay, type ThemeName } from "@cdj/sim";
import { expect, test, TODAY, newClockedContext, type BrowserContext, type Page } from "./fixtures";

// Captures du README du lot I4 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-i4` (`OUT=…` change le dossier).
// Chromium, portrait 390 × 844 et paysage 844 × 390, **français et anglais** : accueil, pause, arrivée (médaille, sans médaille, « Jeu suivant du jour »),
// classement du jour, archives, réglages, Salon (course, finale, résultats), puis le HUD en course **sur chaque thème**. Une API simulée (aucune requête
// vers un vrai serveur) donne un classement de 212 pilotes où le joueur est 14e.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

const VUES = [
  { slug: "portrait", width: 390, height: 844 },
  { slug: "paysage", width: 844, height: 390 },
] as const;
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;

const circuit = dailyCircuit(TODAY);
const pilote = runPilot(circuit.track, { grip: 0.9 });
const codeOr = encodeReplay(pilote.replay);
// Un tour sans médaille : la même trajectoire après 17 s d'immobilité (le chrono part au « PARTEZ ! », voiture immobile ou non).
const lent = { ...pilote.replay, runs: [{ count: 2000, steer: 0, throttle: 0, brake: 0, respawn: 0 }, ...pilote.replay.runs] };
const codeLent = encodeReplay(lent);

const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Player-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
const NOMS = ["Kiwi", "Léa_V", "TurboMamie", "Pistache", "Gégé", "Moustique", "Zorglub", "Nina", "Nathan", "Brindille", "Coyote"];

async function simulerApi(context: BrowserContext, ms: number, rang = 14, total = 212) {
  const top = NOMS.filter((n) => n !== "Nathan").slice(0, 8).map((name, i) => ({ rank: i + 1, name, ms: circuit.medals.author - 600 + i * 380, medal: i === 0 ? "author" : "gold" }));
  const me = { rank: rang, name: "Nathan", ms, medal: medalFor(ms, circuit.medals) };
  await context.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id }));
    if (url.pathname === "/api/name") return route.fulfill(json({ available: true }));
    if (url.pathname === "/api/submit") return route.fulfill(json({ accepted: true, improved: true, ms, splits: [], respawns: 0, bestMs: ms, rank: rang, participants: total, medal: me.medal }));
    if (url.pathname.endsWith("/leaderboard")) return route.fulfill(json({ date: circuit.date, participants: total, top, me }));
    if (url.pathname.endsWith("/ghost")) return route.fulfill(json({ error: "no_ghost", message: "Aucun fantôme" }, 404));
    if (url.pathname === "/api/portail/jour") {
      const fini = { statut: "fini", tempsMs: ms, medaille: me.medal, rang, classes: total };
      return route.fulfill(json({ date: circuit.date, jeux: [{ jeu: "cdj", site: "track", nom: "Track", etat: fini }, { jeu: "jump", site: "jump", nom: "Jump", etat: { statut: "pas_joue" } }] }));
    }
    if (url.pathname === "/api/salon/now") return route.fulfill(json({ error: "not_found", message: "" }, 404));
    return route.fulfill(json({ error: "not_found", message: "" }, 404));
  });
}

async function nouveauContexte(browser: Parameters<typeof newClockedContext>[0], vue: (typeof VUES)[number], langue: (typeof LANGUES)[number]) {
  const context = await newClockedContext(browser, { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([id, replay, ms, simVersion]) => {
      localStorage.setItem("cdj:name", "Nathan");
      localStorage.setItem("cdj:howto", "1");
      localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion, medal: "gold" }));
    },
    [circuit.track.id, codeOr, pilote.finishMs, SIM_VERSION] as const,
  );
  await simulerApi(context, pilote.finishMs);
  return context;
}

async function ouvrir(page: Page, query: string) {
  await page.goto(`/?api=${encodeURIComponent(API)}${query}`);
  await page.waitForSelector("#splash", { state: "detached", timeout: 90_000 });
}

const photo = (page: Page, nom: string, vue: (typeof VUES)[number], langue: (typeof LANGUES)[number]) => page.screenshot({ path: join(OUT, `lot-I4-${nom}-${vue.slug}-${langue.slug}.png`) });

// L'accueil sur grand écran (1440 × 900, souris) : trois colonnes centrées sur la vue 3D du départ (lot I4, retour de Nathan).
for (const langue of LANGUES) {
  test(`accueil — bureau ${langue.slug}`, async ({ browser }) => {
    const context = await newClockedContext(browser, { viewport: { width: 1440, height: 900 }, locale: langue.locale, deviceScaleFactor: 1 });
    await context.addInitScript(
      ([id, replay, ms, simVersion]) => {
        localStorage.setItem("cdj:name", "Nathan");
        localStorage.setItem("cdj:howto", "1");
        localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion, medal: "gold" }));
      },
      [circuit.track.id, codeOr, pilote.finishMs, SIM_VERSION] as const,
    );
    await simulerApi(context, pilote.finishMs);
    const page = await context.newPage();
    await ouvrir(page, "&home=1&debug");
    await expect(page.locator("#home .home-classement .ligne").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `lot-I4-accueil-bureau-${langue.slug}.png`) });
  });
}

for (const vue of VUES) {
  for (const langue of LANGUES) {
    test(`écrans hors partie — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
      const context = await nouveauContexte(browser, vue, langue);
      const page = await context.newPage();
      // Accueil
      await ouvrir(page, "&home=1&debug");
      await expect(page.locator("#home .board-card .row, #home .home-classement .ligne").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      await photo(page, "accueil", vue, langue);
      // Classement du jour (page), archives, réglages
      if ((await page.locator("#home-board-all").count()) > 0) {
        await page.locator("#home-board-all").click();
        await expect(page.locator("#board-screen")).toBeVisible();
        await page.waitForTimeout(600);
        await photo(page, "classement", vue, langue);
        await page.keyboard.press("Escape");
      }
      await page.locator("#home-archive").click();
      await expect(page.locator("#archive")).toBeVisible();
      await page.waitForTimeout(2500); // miniatures
      await photo(page, "archives", vue, langue);
      await page.keyboard.press("Escape");
      await page.locator("#home-settings").click();
      await expect(page.locator("#settings")).toBeVisible();
      await page.waitForTimeout(400);
      await photo(page, "reglages", vue, langue);
      await page.keyboard.press("Escape");
      // En course : pause
      await page.locator("#home-daily").click();
      await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
      await page.locator("#btn-pause").click();
      await expect(page.locator("#pause")).toBeVisible();
      await page.waitForTimeout(300);
      await photo(page, "pause", vue, langue);
      await context.close();
    });

    test(`arrivée — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
      for (const [nom, code] of [["arrivee-medaille", codeOr], ["arrivee-sans-medaille", codeLent]] as const) {
        const context = await nouveauContexte(browser, vue, langue);
        if (nom === "arrivee-sans-medaille") await context.addInitScript(() => localStorage.removeItem("cdj:best:none")); // (le record de l'essai précédent reste : le rang vient de l'API simulée)
        const page = await context.newPage();
        await ouvrir(page, "&home=0&debug&timescale=8");
        await page.evaluate((c) => window.__cdj.autoplay(c), code);
        await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 240_000 });
        await expect(page.locator("#finish .online .rank")).toBeVisible({ timeout: 30_000 });
        if (nom === "arrivee-medaille") await expect(page.locator("#finish-next-game")).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(1500); // les confettis de l'annonce passent
        await photo(page, nom, vue, langue);
        if (nom === "arrivee-medaille") await photo(page, "arrivee-jeu-suivant", vue, langue);
        await context.close();
      }
    });
  }
}

// Le HUD en course sur chaque thème (un jour passé de chaque thème : aucune notice « essai » dans la plaque du titre).
const JOURS_PAR_THEME = new Map<ThemeName, number>();
for (let d = TODAY - 1; d > TODAY - 200 && JOURS_PAR_THEME.size < THEME_NAMES.length; d--) {
  const nom = themeForDay(d).name;
  if (!JOURS_PAR_THEME.has(nom)) JOURS_PAR_THEME.set(nom, d);
}

for (const [vue, langue] of [[VUES[0], LANGUES[0]], [VUES[1], LANGUES[1]], [VUES[0], LANGUES[1]], [VUES[1], LANGUES[0]]] as const) {
  test(`HUD en course sur chaque thème — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
    expect(JOURS_PAR_THEME.size).toBe(THEME_NAMES.length);
    for (const [theme, jour] of JOURS_PAR_THEME) {
      if (vue.slug !== "paysage") continue; // charte rév. 7 : le jeu se joue en paysage (le portrait n'a plus de capture de HUD)
      const context = await newClockedContext(browser, { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        localStorage.setItem("cdj:name", "Nathan");
        localStorage.setItem("cdj:howto", "1");
      });
      const jourCircuit = dailyCircuit(jour);
      const run = runPilot(jourCircuit.track, { grip: 0.9 });
      const page = await context.newPage();
      await page.goto(`/?debug&seed=${formatDay(jour)}&home=0&timescale=3&quality=2`);
      await page.waitForSelector("#splash", { state: "detached", timeout: 90_000 });
      await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
      await expect(page.locator("#splits .pc")).toBeVisible({ timeout: 120_000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `lot-I4-hud-${theme}-${vue.slug}-${langue.slug}.png`) });
      await context.close();
    }
  });
}

// Le HUD compact au départ (titre du circuit et aide d'une ligne sous la bande), puis en course, puis avec le classement ouvert par la pastille du rang (paysage, charte rév. 7).
for (const langue of LANGUES) {
  test(`HUD au départ, en course et classement ouvert — paysage ${langue.slug}`, async ({ browser }) => {
    const vue = VUES[1];
    const context = await nouveauContexte(browser, vue, langue);
    const page = await context.newPage();
    await ouvrir(page, "&home=0&debug");
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate(() => window.__cdj.advance(3 * 120 + 40));
    await expect(page.locator("#aide")).toBeVisible();
    await page.waitForTimeout(500);
    await photo(page, "hud-depart", vue, langue);
    await page.evaluate(() => window.__cdj.advance(7 * 120));
    await expect(page.locator("#rang")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    await photo(page, "hud-course", vue, langue);
    await page.locator("#rang").click();
    await expect(page.locator("#board")).toBeVisible();
    await page.waitForTimeout(300);
    await photo(page, "hud-classement", vue, langue);
    await context.close();
  });
}

// Le Salon : la course (compte à rebours de la session dans la plaque en haut à droite), la finale, les résultats.
const LEN = 2 * 60_000;
const SESSION = Math.floor(1791549980000 / LEN);
const START = SESSION * LEN;
const END = START + LEN;
const codeSalon = encodeReplay(runPilot(salonCircuit(SESSION).track, { grip: 0.9 }).replay);

for (const vue of VUES) {
  for (const langue of LANGUES) {
    test(`Salon — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
      const context = await newClockedContext(browser, { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        localStorage.setItem("cdj:name", "Nathan");
        localStorage.setItem("cdj:howto", "1");
      });
      const page = await context.newPage();
      await page.goto(`/?mode=salon&api=demo&debug&salonMinutes=2&salonAt=${START + 30_000}`);
      await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
      await page.waitForFunction(() => (window.__cdj.salon!.board?.rows.length ?? 0) >= 5, undefined, { timeout: 180_000, polling: 500 });
      await page.evaluate((c) => window.__cdj.autoplay(c), codeSalon);
      await page.waitForFunction(() => window.__cdj.phase === "racing" && window.__cdj.car.tick > 240, undefined, { timeout: 60_000 });
      await page.waitForTimeout(500);
      await photo(page, "salon-course", vue, langue);
      await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 9_400);
      await page.waitForFunction(() => window.__cdj.salon!.finaleOn, undefined, { timeout: 15_000 });
      await expect(page.locator("#finale")).toBeVisible();
      await page.waitForTimeout(600);
      await photo(page, "salon-finale", vue, langue);
      await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 100);
      await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(900);
      await photo(page, "salon-resultats", vue, langue);
      await context.close();
    });
  }
}

// « Comment jouer » dans le jeu (retouche du lot I4, charte rév. 7) : paysage 844 × 390, l'étiquette asphalte posée sur la scène sous le voile à rayures, à la première
// visite (aucun souvenir `cdj:howto`) ; fichier `lot-I4-comment-jouer-paysage-<fr|en>.png`.
for (const langue of LANGUES) {
  test(`Comment jouer — paysage ${langue.slug}`, async ({ browser }) => {
    const context = await newClockedContext(browser, { viewport: { width: 844, height: 390 }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await simulerApi(context, pilote.finishMs);
    const page = await context.newPage();
    await ouvrir(page, "&home=0");
    await expect(page.locator("#howto")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `lot-I4-comment-jouer-paysage-${langue.slug}.png`) });
    await context.close();
  });
}
