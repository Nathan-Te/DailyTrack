import { expect, test } from "@playwright/test";
import { SIM_VERSION, dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { boxes, expectNoOverlap } from "./layout";

// Téléphone : rien ne se chevauche et tout reste dans l'écran, en portrait comme en paysage.
// (Le rendu 3D demande WebGL : Chromium seulement.)
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const day = Math.floor(Date.now() / 86_400_000);
const circuit = dailyCircuit(day);
const pilot = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(pilot.replay);
// API simulée : ces tests ne doivent rien envoyer au vrai serveur (les rangs des autres tests en dépendent).
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

for (const viewport of [
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
  { name: "petit portrait", width: 360, height: 640 },
]) {
  test(`téléphone ${viewport.name} (${viewport.width}×${viewport.height}) : en course puis à l'arrivée, rien ne se chevauche`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    // Un fantôme et un classement : le bandeau est au complet.
    await context.addInitScript(
      ([id, replay, ms, simVersion]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion })),
      [circuit.track.id, code, pilot.finishMs, SIM_VERSION] as const,
    );
    await context.route(`${API}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const me = { rank: 3, name: "Mobile", ms: pilot.finishMs, medal: null };
      if (url.pathname === "/api/submit") {
        return route.fulfill(json({ accepted: true, improved: true, ms: pilot.finishMs, splits: [], respawns: 0, bestMs: pilot.finishMs, rank: 3, participants: 12, medal: null }));
      }
      if (url.pathname.endsWith("/leaderboard")) {
        const top = [{ rank: 1, name: "Alice", ms: pilot.finishMs - 3000, medal: "author" }, { rank: 2, name: "Bob", ms: pilot.finishMs - 1000, medal: "gold" }, me];
        return route.fulfill(json({ date: circuit.date, participants: 12, top, me }));
      }
      return route.fulfill(json({ error: "no_ghost", message: "Aucun fantôme" }, 404));
    });
    const page = await context.newPage();
    await page.goto(`/?debug&timescale=4&api=${encodeURIComponent(API)}`);
    await page.waitForFunction(() => window.__cdj?.phase);
    // Police large imposée : la police par défaut change d'une machine à l'autre (étroite en local, DejaVu Sans sur la CI)
    // et c'est la plus large qui décide si une ligne déborde.
    await page.addStyleTag({ content: "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }" });
    await page.evaluate((c) => window.__cdj.autoplay(c), code);

    // En course, après deux points de contrôle : bandeau complet (titre, médailles, chrono, intermédiaires, fantôme, menu, vitesse).
    await expect(page.locator("#splits div")).toHaveCount(2, { timeout: 60_000 });
    await page.waitForTimeout(700); // la bannière de point de contrôle disparaît
    const racing = ["#meta", "#medals", "#timer", "#splits", "#ghostinfo", "#menu", "#speed", "#tbar"]; // #tbar : boutons tactiles (le téléphone est tactile)
    const racingBoxes = await boxes(page, racing);
    expect(racingBoxes.map((b) => b.name)).toEqual(expect.arrayContaining(racing));
    expectNoOverlap(racingBoxes, viewport);

    // À l'arrivée : panneau, boutons (au moins 34 px de haut : on les touche du doigt), classement.
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
    await page.locator("#finish .online input").fill("Mobile");
    await page.locator("#finish .online button[type=submit]").click();
    await expect(page.locator("#finish .online .rank")).toBeVisible({ timeout: 20_000 });
    // Sur petit écran, le classement ne recouvre pas le panneau d'arrivée : il s'ouvre au toucher du bouton 🏆.
    await expect(page.locator("#board")).toBeHidden();
    await page.waitForTimeout(500);
    const finished = ["#meta", "#medals", "#timer", "#menu", "#ghostinfo", "#finish"];
    expectNoOverlap(await boxes(page, finished), viewport);
    await page.locator("#btn-board").click();
    await expect(page.locator("#board")).toBeVisible();
    await expect(page.locator("#board .row")).toHaveCount(3);
    expectNoOverlap(await boxes(page, ["#board"]), viewport); // tient dans l'écran
    await page.locator("#board").click(); // un toucher la ferme
    await expect(page.locator("#board")).toBeHidden();
    for (const b of await page.locator("#finish .actions button").all()) {
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(34);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await context.close();
  });
}
