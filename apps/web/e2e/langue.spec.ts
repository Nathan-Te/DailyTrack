import { SIM_VERSION, dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { expect, test, TODAY, newClockedContext } from "./fixtures";

// Lot I4 : DailyTrack en français et en anglais, avec la langue de la plateforme (`cdj:langue`, la même clé que le portail).
//   - la langue vient du navigateur à la première visite, puis du choix du joueur (qui l'emporte) ;
//   - changer de langue dans Réglages › Langue met tout l'écran à jour **sans recharger** (`<html lang>`, titre, textes, formats) et l'écrit pour toute la plateforme ;
//   - l'arrivée, le HUD et la ligne à partager sont en anglais aussi (mêmes émojis).
// Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const circuit = dailyCircuit(TODAY);
const pilot = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(pilot.replay);
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Player-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

async function ouvrir(page: import("@playwright/test").Page, url: string) {
  await page.goto(url);
  await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
}

test("la première visite suit la langue du navigateur ; le choix du joueur l'emporte", async ({ browser }) => {
  for (const [locale, attendu, texte] of [["fr-FR", "fr", "Courir"], ["fr-CA", "fr", "Courir"], ["en-US", "en", "Race"], ["de-DE", "en", "Race"]] as const) {
    const ctx = await newClockedContext(browser, { locale });
    const page = await ctx.newPage();
    await ouvrir(page, "/?api=demo&home=1");
    await expect(page.locator("html")).toHaveAttribute("lang", attendu);
    await expect(page.locator("#home-daily")).toContainText(texte);
    await expect(page).toHaveTitle("Track — Du Jour");
    expect(await page.evaluate(() => localStorage.getItem("cdj:langue")), "rien n'est écrit tant que le joueur n'a pas choisi").toBeNull();
    await ctx.close();
  }
  // Un choix mémorisé (le même que celui du portail : cdj:langue) l'emporte sur la langue du navigateur.
  const ctx = await newClockedContext(browser, { locale: "fr-FR" });
  await ctx.addInitScript(() => localStorage.setItem("cdj:langue", "en"));
  const page = await ctx.newPage();
  await ouvrir(page, "/?api=demo&home=1");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#home-daily")).toContainText("Race");
  await ctx.close();
});

test("Réglages › Langue : FR ↔ EN sans recharger, l'écran se met à jour, le choix est écrit pour toute la plateforme", async ({ browser }) => {
  const ctx = await newClockedContext(browser, { locale: "en-US" });
  const page = await ctx.newPage();
  await ouvrir(page, "/?api=demo&home=1&debug");
  await page.evaluate(() => ((window as unknown as { __marque: number }).__marque = 1)); // preuve qu'on ne recharge pas
  await expect(page.locator("#home h1")).toHaveText("TRACK");
  await expect(page.locator("#home-daily")).toContainText("Race");
  await expect(page.locator("#home .dj-barre-jeu")).toContainText("#"); // « #15 » (n° 15 en français)
  await page.locator("#home-settings").click();
  await expect(page.locator("#settings h1")).toHaveText(/settings/i);
  await page.locator('#settings .dj-choix-langue [data-langue="fr"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("#settings h1")).toHaveText(/réglages/i);
  await expect(page.locator('#settings .dj-choix-langue [data-langue="fr"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-langue")), "le focus reste sur le choix de langue").toBe("fr");
  expect(await page.evaluate(() => localStorage.getItem("cdj:langue"))).toBe("fr");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home-daily")).toContainText("Courir");
  await expect(page.locator("#home .dj-barre-jeu")).toContainText("n°");
  await expect(page).toHaveTitle("Track — Du Jour");
  expect(await page.evaluate(() => (window as unknown as { __marque?: number }).__marque), "la page n'a pas été rechargée").toBe(1);
  // La pause (HTML fixe, `data-t`) suit aussi, puis retour à l'anglais.
  await page.locator("#home-daily").click();
  await page.waitForFunction(() => window.__cdj?.phase !== undefined);
  await page.keyboard.press("p");
  await expect(page.locator("#pause-resume")).toHaveText("Reprendre");
  await page.locator("#pause-settings").click();
  await page.locator('#settings .dj-choix-langue [data-langue="en"]').click();
  await expect(page.locator("#pause-resume")).toHaveText("Resume");
  await expect(page.locator("#pause-home")).toHaveText("Track home");
  expect(await page.evaluate(() => localStorage.getItem("cdj:langue"))).toBe("en");
  expect(await page.evaluate(() => (window as unknown as { __marque?: number }).__marque)).toBe(1);
  await ctx.close();
});

test("en anglais : le HUD, l'arrivée (médaille, rang, « Next game of the day »), la ligne à partager et ses émojis", async ({ browser }) => {
  const ctx = await newClockedContext(browser, { locale: "en-US", viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(
    ([id, replay, ms, simVersion]) => {
      localStorage.setItem("cdj:howto", "1");
      localStorage.setItem("cdj:name", "Nathan");
      localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion }));
    },
    [circuit.track.id, code, pilot.finishMs + 800, SIM_VERSION] as const,
  );
  await ctx.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id }));
    if (url.pathname === "/api/name") return route.fulfill(json({ available: true }));
    if (url.pathname === "/api/submit") return route.fulfill(json({ accepted: true, improved: true, ms: pilot.finishMs, splits: [], respawns: 0, bestMs: pilot.finishMs, rank: 14, participants: 212, medal: "gold" }));
    if (url.pathname.endsWith("/leaderboard")) return route.fulfill(json({ date: circuit.date, participants: 212, top: [{ rank: 1, name: "Kiwi", ms: pilot.finishMs - 900, medal: "gold" }], me: { rank: 14, name: "Nathan", ms: pilot.finishMs, medal: "gold" } }));
    if (url.pathname === "/api/portail/jour") {
      const fini = { statut: "fini", tempsMs: pilot.finishMs, medaille: "gold", rang: 14, classes: 212 };
      return route.fulfill(json({ date: circuit.date, jeux: [{ jeu: "cdj", site: "track", nom: "Track", etat: fini }, { jeu: "jump", site: "jump", nom: "Jump", etat: { statut: "pas_joue" } }] }));
    }
    return route.fulfill(json({ error: "no_ghost", message: "" }, 404));
  });
  const page = await ctx.newPage();
  await ouvrir(page, `/?debug&home=0&timescale=6&api=${encodeURIComponent(API)}`);
  await expect(page.locator("#medals")).toHaveAttribute("aria-label", /Diamond/); // objectif : la médaille au-dessus de celle du record (ici un record à +0,8 s de l'auteur : or, donc l'auteur)
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await expect(page.locator("#splits .pc")).toContainText(/CP \d\/\d/, { timeout: 90_000 }); // « CP 1/3 » : point de contrôle
  await expect(page.locator("#splits .ecart")).toContainText(/^[+−]\d[.]\d{3}$/); // écart signé, virgule anglaise
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
  await expect(page.locator("#finish h1")).toHaveText("Finish");
  await expect(page.locator("#finish .online .rank")).toHaveText("14th of 212", { timeout: 30_000 });
  await expect(page.locator("#finish .medal")).toContainText(/medal|Faster than the author/i);
  await expect(page.locator("#finish-next-game")).toHaveText("Next game of the day: Jump ›");
  await expect(page.locator("#finish .restart")).toHaveText("Race again");
  await expect(page.locator("#finish .share")).toContainText(/Du Jour · Track #\d+ — \d+\.\d{3}\ss/); // « 39.331 s » : le point anglais, l'espace insécable du socle
  await expect(page.locator("#finish .share")).toContainText(/🥇|🏆/);
  await expect(page.locator("#finish .share")).toContainText("14th/212");
  await ctx.close();
});
