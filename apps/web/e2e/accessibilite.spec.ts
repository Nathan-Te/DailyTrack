import { SIM_VERSION, dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { expect, hasWebGL, newClockedContext, test, TODAY, type Page } from "./fixtures";
import { auditAxe, focusDans, focusSur } from "./axe";

// Lot I6 (plateforme) : l'accessibilité de Track, en français et en anglais.
//   1. axe (apps/web/e2e/axe.ts : WCAG 2.x A et AA, bonnes pratiques) sur l'accueil, les réglages, la pause et l'arrivée : aucune violation grave ;
//   2. les écrans en surimpression sont des dialogues pour un lecteur d'écran : `role="dialog"`, un nom, le focus mis dedans à l'ouverture et rendu
//      à la fermeture (Réglages → le bouton qui les a ouverts ; la pause et l'arrivée rendent la main à la partie : le focus revient à la page).
// Les écrans du portail (accueil, profil, classement du jour) : portail-journee.spec.ts ; mentions et 404 : domaine.spec.ts ; Jump : apps/jump/e2e.
test.setTimeout(150_000);

const circuit = dailyCircuit(TODAY);
const pilot = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(pilot.replay);
// API simulée (comme mobile.spec.ts) : rien n'est envoyé au vrai serveur.
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Player-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

/** Un écran ouvert est un dialogue nommé. */
async function dialogueNomme(page: Page, selecteur: string): Promise<void> {
  const d = page.locator(selecteur);
  await expect(d).toHaveAttribute("role", "dialog");
  expect((await d.getAttribute("aria-label"))?.trim().length ?? 0, `${selecteur} : un nom pour le lecteur d'écran`).toBeGreaterThan(2);
}

for (const [langue, locale] of [["fr", "fr-FR"], ["en", "en-US"]] as const) {
  test(`Track (${langue}) : accueil, réglages et pause — axe, dialogues et focus`, async ({ browser }) => {
    const page = await (await newClockedContext(browser, { locale })).newPage();
    await page.goto("/?home=1&debug&api=demo");
    test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
    await expect(page.locator("#home")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", langue);
    await dialogueNomme(page, "#home");
    await expect.poll(() => focusDans(page, "#home"), { message: "le focus est dans l'accueil" }).toBe(true);
    await auditAxe(page, `track-accueil-${langue}`);

    // Réglages, ouverts depuis l'accueil : le focus y entre, puis revient au bouton « Réglages » à la fermeture (Échap).
    await page.locator("#home-settings").click();
    await expect(page.locator("#settings")).toBeVisible();
    await dialogueNomme(page, "#settings");
    await expect.poll(() => focusDans(page, "#settings"), { message: "le focus est dans les réglages" }).toBe(true);
    await auditAxe(page, `track-reglages-${langue}`);
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings")).toBeHidden();
    await expect.poll(() => focusSur(page), { message: "le focus revient au bouton qui a ouvert les réglages" }).toBe("home-settings");

    // La pause, en course : un dialogue nommé, le focus sur « Reprendre » ; fermée, le focus revient à la partie (la page).
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("#pause")).toBeVisible();
    await dialogueNomme(page, "#pause [role=dialog]");
    await expect.poll(() => focusSur(page)).toBe("pause-resume");
    await auditAxe(page, `track-pause-${langue}`);
    // Réglages depuis la pause : le focus revient à « Réglages » de la pause.
    await page.locator("#pause-settings").click();
    await expect(page.locator("#settings")).toBeVisible();
    await expect.poll(() => focusDans(page, "#settings")).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings")).toBeHidden();
    await expect.poll(() => focusSur(page)).toBe("pause-settings");
    await page.keyboard.press("Escape");
    await expect(page.locator("#pause")).toBeHidden();
    await expect.poll(() => focusSur(page), { message: "la pause fermée rend le clavier à la partie" }).toBe("BODY");
  });

  test(`Track (${langue}) : l'arrivée — axe, dialogue et focus`, async ({ browser }) => {
    const context = await newClockedContext(browser, { locale });
    await context.addInitScript(
      ([id, replay, ms, simVersion]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion })),
      [circuit.track.id, code, pilot.finishMs, SIM_VERSION] as const,
    );
    await context.route(`${API}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const me = { rank: 3, name: "Axe", ms: pilot.finishMs, medal: null };
      if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id }));
      if (url.pathname === "/api/name") return route.fulfill(json({ available: true }));
      if (url.pathname === "/api/submit") return route.fulfill(json({ accepted: true, improved: true, ms: pilot.finishMs, splits: [], respawns: 0, bestMs: pilot.finishMs, rank: 3, participants: 12, medal: null }));
      if (url.pathname.endsWith("/leaderboard")) {
        const top = [{ rank: 1, name: "Alice", ms: pilot.finishMs - 3000, medal: "author" }, { rank: 2, name: "Bob", ms: pilot.finishMs - 1000, medal: "gold" }, me];
        return route.fulfill(json({ date: circuit.date, participants: 12, top, me }));
      }
      if (url.pathname === "/api/portail/jour") {
        const fini = { statut: "fini", tempsMs: pilot.finishMs, medaille: null, rang: 3, classes: 12 };
        return route.fulfill(json({ date: circuit.date, jeux: [{ jeu: "cdj", site: "track", nom: "Track", etat: fini }, { jeu: "jump", site: "jump", nom: "Jump", etat: { statut: "pas_joue" } }] }));
      }
      return route.fulfill(json({ error: "no_ghost" }, 404));
    });
    const page = await context.newPage();
    await page.goto(`/?debug&timescale=4&api=${encodeURIComponent(API)}`);
    test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
    await expect(page.locator("#finish")).toBeVisible();
    await dialogueNomme(page, "#finish");
    await expect.poll(() => focusDans(page, "#finish"), { message: "le focus est dans l'arrivée" }).toBe(true);
    await page.locator("#finish .online input").fill("Axe");
    await page.locator("#finish .online button[type=submit]").click();
    await expect(page.locator("#finish .online .rank")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#finish-next-game")).toBeVisible({ timeout: 20_000 });
    await auditAxe(page, `track-arrivee-${langue}`);
    // « Recourir » : l'arrivée se ferme, le focus revient à la partie.
    await page.locator("#finish .restart").click();
    await expect(page.locator("#finish")).toBeHidden();
    await expect.poll(() => focusDans(page, "#finish")).toBe(false);
  });
}
