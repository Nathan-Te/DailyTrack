import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dailyCircuit } from "@cdj/sim";
import { expect, test, TODAY, clockNow, newClockedContext, type BrowserContext, type Page } from "./fixtures";

// Captures du lot N2 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-n2-track --project=chromium` (`OUT=…` change le dossier).
// Le message en direct dans Track, paysage 844 × 390, français : l'accueil avec un message « information », l'accueil avec un « important » et la pause en course.
// API simulée par `page.route` : `GET /api/annonce` rend le message, le reste le strict nécessaire à l'accueil.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

const circuit = dailyCircuit(TODAY);
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Player-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

async function simulerApi(context: BrowserContext, ton: "information" | "important") {
  await context.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === "/api/annonce") {
      const maintenant = clockNow();
      const texte = ton === "important" ? { fr: "Maintenance du serveur ce soir à 23 h : le classement sera en lecture seule vingt minutes.", en: "Server maintenance tonight at 11 pm: the leaderboard will be read-only for twenty minutes." } : { fr: "Nouveau : le Garage compte une voiture de plus, à gagner en jouant.", en: "New: the Garage has one more car to win by playing." };
      return route.fulfill(json({ annonce: { id: 1, ...texte, ou: ["track"], ton, fin: maintenant + 3_600_000 }, maintenant: new Date(maintenant).toISOString() }));
    }
    if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id }));
    if (url.pathname.endsWith("/leaderboard")) return route.fulfill(json({ date: circuit.date, participants: 0, top: [], me: null }));
    return route.fulfill(json({ error: "not_found" }, 404));
  });
}

async function ouvrir(browser: Parameters<typeof newClockedContext>[0], ton: "information" | "important"): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newClockedContext(browser, { viewport: { width: 844, height: 390 }, locale: "fr-FR", isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem("cdj:name", "Nathan");
    localStorage.setItem("cdj:howto", "1");
  });
  await simulerApi(context, ton);
  const page = await context.newPage();
  await page.goto(`/?api=${encodeURIComponent(API)}&home=1&debug`);
  await page.waitForSelector("#splash", { state: "detached", timeout: 90_000 });
  return { context, page };
}

for (const ton of ["information", "important"] as const) {
  test(`message en direct sur l'accueil de Track — ${ton}`, async ({ browser }) => {
    const { context, page } = await ouvrir(browser, ton);
    await expect(page.locator("#home .dj-bandeau.annonce-track")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `lot-N2-track-accueil-${ton}.png`) });
    if (ton === "information") {
      // En course : plus de bandeau ; en pause : il revient.
      await page.locator("#home-daily").click();
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 60_000 });
      await expect(page.locator(".dj-bandeau.annonce-track")).toHaveCount(0);
      await page.locator("#btn-pause").click();
      await expect(page.locator("#pause .dj-bandeau.annonce-track")).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: join(OUT, "lot-N2-track-pause-information.png") });
    }
    await context.close();
  });
}
