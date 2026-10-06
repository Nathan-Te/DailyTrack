import { expect, test, type Page } from "@playwright/test";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";

// Téléphone : rien ne se chevauche et tout reste dans l'écran, en portrait comme en paysage.
// (Le rendu 3D demande WebGL : Chromium seulement.)
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const day = Math.floor(Date.now() / 86_400_000);
const circuit = dailyCircuit(day);
const pilot = runPilot(circuit.track, { curveSpeed: 26 });
const code = encodeReplay(pilot.replay);
// API simulée : ces tests ne doivent rien envoyer au vrai serveur (les rangs des autres tests en dépendent).
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

type Box = { name: string; x: number; y: number; w: number; h: number };

async function boxes(page: Page, selectors: string[]): Promise<Box[]> {
  const out: Box[] = [];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    if ((await loc.count()) === 0 || !(await loc.first().isVisible())) continue;
    const b = await loc.first().boundingBox();
    if (b && b.width > 0 && b.height > 0) out.push({ name: sel, x: b.x, y: b.y, w: b.width, h: b.height });
  }
  return out;
}

function expectNoOverlap(list: Box[], viewport: { width: number; height: number }) {
  for (const b of list) {
    expect(b.x, `${b.name} dépasse à gauche`).toBeGreaterThanOrEqual(-1);
    expect(b.y, `${b.name} dépasse en haut`).toBeGreaterThanOrEqual(-1);
    expect(b.x + b.w, `${b.name} dépasse à droite`).toBeLessThanOrEqual(viewport.width + 1);
    expect(b.y + b.h, `${b.name} dépasse en bas`).toBeLessThanOrEqual(viewport.height + 1);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(overlapX > 2 && overlapY > 2, `${a.name} chevauche ${b.name} (${JSON.stringify(a)} / ${JSON.stringify(b)})`).toBe(false);
    }
  }
}

for (const viewport of [
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
  { name: "petit portrait", width: 360, height: 640 },
]) {
  test(`téléphone ${viewport.name} (${viewport.width}×${viewport.height}) : en course puis à l'arrivée, rien ne se chevauche`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    // Un fantôme et un classement : le bandeau est au complet.
    await context.addInitScript(
      ([id, replay, ms]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion: 1 })),
      [circuit.track.id, code, pilot.finishMs] as const,
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
    await page.evaluate((c) => window.__cdj.autoplay(c), code);

    // En course, après deux points de contrôle : bandeau complet (titre, médailles, chrono, intermédiaires, fantôme, menu, vitesse).
    await expect(page.locator("#splits div")).toHaveCount(2, { timeout: 60_000 });
    await page.waitForTimeout(700); // la bannière de point de contrôle disparaît
    const racing = ["#meta", "#medals", "#timer", "#splits", "#ghostinfo", "#menu", "#speed"];
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
