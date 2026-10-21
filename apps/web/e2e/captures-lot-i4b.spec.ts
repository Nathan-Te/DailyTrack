import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dailyCircuit, encodeReplay, medalFor, runPilot, salonCircuit, SIM_VERSION } from "@cdj/sim";
import { expect, test, TODAY, newClockedContext, type BrowserContext, type Page } from "./fixtures";

// Captures du README du lot I4b (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-i4b --project=chromium` (`OUT=…` change le dossier).
// Chromium, paysage 844 × 390 (le format du jeu), portrait 390 × 844 et ordinateur 1440 × 900, **français et anglais** : chaque écran déplacé sur la scène
// (charte rév. 8 § 9 : « on reste dans le jeu ») — accueil, classement du jour, archives, réglages (depuis l'accueil et depuis la pause), « Comment jouer »
// (un seul voile), arrivée (« Jeu suivant du jour » sous l'étiquette), arrivée du Salon et podium. API simulée : aucune requête vers un vrai serveur.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

const VUES = [
  { slug: "paysage", width: 844, height: 390, mobile: true },
  { slug: "portrait", width: 390, height: 844, mobile: true },
  { slug: "bureau", width: 1440, height: 900, mobile: false },
] as const;
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;
type Vue = (typeof VUES)[number];
type Langue = (typeof LANGUES)[number];

const circuit = dailyCircuit(TODAY);
const pilote = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(pilote.replay);

const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Player-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
const NOMS = ["Kiwi", "Léa_V", "TurboMamie", "Pistache", "Gégé", "Moustique", "Zorglub", "Nina"];

async function simulerApi(context: BrowserContext, ms: number, rang = 14, total = 212) {
  const top = NOMS.map((name, i) => ({ rank: i + 1, name, ms: circuit.medals.author - 600 + i * 380, medal: i === 0 ? "author" : "gold" }));
  const me = { rank: rang, name: "Nathan", ms, medal: medalFor(ms, circuit.medals) };
  await context.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id }));
    if (url.pathname === "/api/name") return route.fulfill(json({ available: true }));
    if (url.pathname === "/api/submit") return route.fulfill(json({ accepted: true, improved: true, ms, splits: [], respawns: 0, bestMs: ms, rank: rang, participants: total, medal: me.medal }));
    if (url.pathname.endsWith("/leaderboard")) return route.fulfill(json({ date: circuit.date, participants: total, top, me }));
    if (url.pathname === "/api/portail/jour") {
      const fini = { statut: "fini", tempsMs: ms, medaille: me.medal, rang, classes: total };
      return route.fulfill(json({ date: circuit.date, jeux: [{ jeu: "cdj", site: "track", nom: "Track", etat: fini }, { jeu: "jump", site: "jump", nom: "Jump", etat: { statut: "pas_joue" } }] }));
    }
    return route.fulfill(json({ error: "not_found", message: "" }, 404));
  });
}

async function contexte(browser: Parameters<typeof newClockedContext>[0], vue: Vue, langue: Langue, aide = true) {
  const context = await newClockedContext(browser, { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: vue.mobile, hasTouch: vue.mobile, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([id, replay, ms, simVersion, vue]) => {
      localStorage.setItem("cdj:name", "Nathan");
      if (vue) localStorage.setItem("cdj:howto", "1");
      localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion, medal: "gold" }));
    },
    [circuit.track.id, code, pilote.finishMs, SIM_VERSION, aide] as const,
  );
  await simulerApi(context, pilote.finishMs);
  return context;
}

async function ouvrir(page: Page, query: string) {
  await page.goto(`/?api=${encodeURIComponent(API)}${query}`);
  await page.waitForSelector("#splash", { state: "detached", timeout: 90_000 });
}

const photo = (page: Page, nom: string, vue: Vue, langue: Langue) => page.screenshot({ path: join(OUT, `lot-I4b-${nom}-${vue.slug}-${langue.slug}.png`) });

for (const vue of VUES) {
  for (const langue of LANGUES) {
    test(`écrans sur la scène — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
      const context = await contexte(browser, vue, langue);
      const page = await context.newPage();
      await ouvrir(page, "&home=1&debug");
      await expect(page.locator("#home .home-classement .ligne").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      await photo(page, "accueil", vue, langue);
      await page.locator("#home-board-all").click();
      await expect(page.locator("#board-screen")).toBeVisible();
      await page.waitForTimeout(600);
      await photo(page, "classement", vue, langue);
      await page.keyboard.press("Escape");
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
      await page.locator("#home-howto").click();
      await expect(page.locator("#howto")).toBeVisible();
      await page.waitForTimeout(400);
      await photo(page, "comment-jouer", vue, langue);
      await page.keyboard.press("Escape");
      // En course : la pause, puis les réglages ouverts depuis la pause (la pause s'efface dessous).
      await page.locator("#home-daily").click();
      await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
      await page.locator("#btn-pause").click();
      await expect(page.locator("#pause")).toBeVisible();
      await page.locator("#pause-settings").click();
      await expect(page.locator("#settings")).toBeVisible();
      await page.waitForTimeout(400);
      await photo(page, "reglages-pause", vue, langue);
      await context.close();
    });

    test(`arrivée sur la scène — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
      const context = await contexte(browser, vue, langue);
      const page = await context.newPage();
      await ouvrir(page, "&home=0&debug&timescale=8");
      await page.evaluate((c) => window.__cdj.autoplay(c), code);
      await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 240_000 });
      await expect(page.locator("#finish .online .rank")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("#finish-next-game")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500); // les confettis de l'annonce passent
      await photo(page, "arrivee", vue, langue);
      await page.locator("#finish .etiquette__corps").evaluate((e) => e.scrollTo(0, e.scrollHeight));
      await page.waitForTimeout(300);
      await photo(page, "arrivee-bas", vue, langue);
      await context.close();
    });
  }
}

// Le Salon : l'arrivée d'une course de la session, puis le podium de fin de session (par-dessus : l'arrivée s'efface dessous).
const LEN = 2 * 60_000;
const SESSION = Math.floor(1791549980000 / LEN);
const START = SESSION * LEN;
const END = START + LEN;
const codeSalon = encodeReplay(runPilot(salonCircuit(SESSION).track, { grip: 0.9 }).replay);

for (const vue of VUES.slice(0, 2)) {
  for (const langue of LANGUES) {
    test(`Salon : arrivée et podium — ${vue.slug} ${langue.slug}`, async ({ browser }) => {
      const context = await newClockedContext(browser, { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        localStorage.setItem("cdj:name", "Nathan");
        localStorage.setItem("cdj:howto", "1");
      });
      const page = await context.newPage();
      await page.goto(`/?mode=salon&api=demo&debug&timescale=6&salonMinutes=2&salonAt=${START + 10_000}`);
      await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
      await page.evaluate((c) => window.__cdj.autoplay(c), codeSalon);
      await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 240_000 });
      await expect(page.locator("#finish")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      await photo(page, "salon-arrivee", vue, langue);
      await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 100);
      await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(900);
      await photo(page, "salon-podium", vue, langue);
      await context.close();
    });
  }
}
