import { expect, test, type Page } from "@playwright/test";
import { encodeReplay, runPilot, salonCircuit, salonTheme } from "@cdj/sim";
import { boxes, expectNoOverlap } from "./layout";

// Le Salon (lot 26) en mode démonstration : `?mode=salon&api=demo`, sessions de 2 minutes (`salonMinutes=2`) et horloge pilotable
// (`salonAt=` au chargement, `__cdj.salon.setNow(ms)` ensuite : outils `?debug`). Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(240_000);

// Deux durées de session : 10 minutes (la vraie : tout ce qui n'a pas besoin de voir la fin d'une session, sans craindre qu'elle se
// termine pendant le test, même sur une CI lente) et 2 minutes (le podium et la bascule, où l'on avance l'horloge soi-même).
const LONG = 10 * 60_000;
const SHORT = 2 * 60_000;
const T0 = 1791549980000;
const SESSION = Math.floor(T0 / LONG);
const START = SESSION * LONG;
const SESSION2 = Math.floor(T0 / SHORT);
const END = START + LONG;
const START2 = SESSION2 * SHORT;
const END2 = START2 + SHORT;
const salonUrl = (at: number, extra = "") => `/?mode=salon&api=demo&debug&salonMinutes=10&salonAt=${at}${extra}`;
const salonUrl2 = (at: number, extra = "") => `/?mode=salon&api=demo&debug&salonMinutes=2&salonAt=${at}${extra}`;

// La rediffusion d'un bon pilote sur le circuit de la session (calculée ici, rejouée dans le navigateur).
const circuit = salonCircuit(SESSION);
const pilot = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(pilot.replay);
const circuit2 = salonCircuit(SESSION2);
const pilot2 = runPilot(circuit2.track, { grip: 0.9 });
const code2 = encodeReplay(pilot2.replay);

const loaded = (page: Page) => page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 60_000 });
/** Attend que le Salon de démonstration ait calculé au moins `n` joueurs fictifs (fil de travail) à l'heure courante. */
const withRows = (page: Page, n: number) => page.waitForFunction((k) => (window.__cdj.salon!.board?.rows.length ?? 0) >= k, n, { timeout: 120_000, polling: 500 });
const named = (page: Page) => page.addInitScript(() => localStorage.setItem("cdj:name", "Testeur"));

test("on arrive en cours de session : compte à rebours, joueurs fictifs au classement, fantômes avec leur pseudo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(salonUrl(START + 300_000));
  await loaded(page);
  await withRows(page, 3);
  const s = await page.evaluate(() => window.__cdj.salon!);
  expect(s.demo).toBe(true);
  expect(s.sessionMs).toBe(LONG);
  expect(s.trackId).toBe(circuit.id); // le même circuit que le serveur et le générateur
  expect(s.theme).toBe(salonTheme(SESSION));
  await expect(page.locator("#meta")).toContainText("Salon");
  await expect(page.locator("#medals")).toContainText(/⏱ 0[45]:\d\d/);
  await expect(page.locator("#medals")).toContainText("joueurs");
  // classement : trié, premier à écart nul, pseudos fictifs
  const rows = s.board!.rows;
  expect(rows.map((r) => r.ms)).toEqual([...rows.map((r) => r.ms)].sort((a, b) => a - b));
  expect(rows[0]!.gap).toBe(0);
  expect(rows.every((r) => r.name.startsWith("Démo "))).toBe(true);
  await expect(page.locator("#board .row")).not.toHaveCount(0);
  // fantômes : les premiers du classement, chacun avec son pseudo, au plus cinq
  await page.waitForFunction(() => (window.__cdj.salon!.ghosts?.count ?? 0) >= 1, undefined, { timeout: 30_000 });
  const g = await page.evaluate(() => window.__cdj.salon!.ghosts!);
  expect(g.count).toBeGreaterThanOrEqual(1);
  expect(g.count).toBeLessThanOrEqual(5);
  expect(g.names.every((n) => n.startsWith("Démo "))).toBe(true);
  expect(g.names[0]).toBe(rows[0]!.name);
  expect(g.rejected).toBe(0);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__cdj.salon!.ghosts!.labels >= 1, undefined, { timeout: 30_000 }); // dessinés avec leur étiquette
  expect(errors).toEqual([]);
});

test("ta course est rejouée et classée dans la session ; le Salon ne touche ni aux records ni au circuit du jour", async ({ page }) => {
  await named(page);
  await page.goto(salonUrl(START + 300_000, "&timescale=4"));
  await loaded(page);
  await withRows(page, 2);
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await expect(page.locator("#finish")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("#finish .rank")).toContainText("Rang", { timeout: 20_000 });
  const s = await page.evaluate(() => window.__cdj.salon!);
  expect(s.best).toBe(pilot.finishMs); // le temps du rejeu
  expect(s.board!.me).toMatchObject({ name: "Testeur", ms: pilot.finishMs });
  expect(s.stats.submits).toBe(1);
  await expect(page.locator("#finish .share")).toHaveText(/^Salon \d\d:\d\d — \d+,\d{3} s — \d+(er|e)\/\d+$/);
  // Aucun record du circuit du jour ou de la session n'est écrit.
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => k.startsWith("cdj:best:") || k.startsWith("cdj:sub:"))).toEqual([]);
  // Rejouer : ton meilleur tour devient un fantôme (« Toi »), avec les autres.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cdj.salon!.ghosts!.names.includes("Toi"), undefined, { timeout: 30_000 });
});

test("à 30 s de la fin : bandeau « dernier essai »", async ({ page }) => {
  await page.goto(salonUrl(START + 60_000));
  await loaded(page);
  await expect(page.locator("#medals")).not.toContainText("DERNIER ESSAI");
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 20_000);
  await expect(page.locator("#medals")).toContainText("DERNIER ESSAI");
  await expect(page.locator("#medals")).toHaveClass(/last/);
});

test("fin de session : podium (trois premiers), puis un autre circuit s'installe tout seul, sans gel ni calcul sur le fil principal", async ({ page }) => {
  await page.addInitScript(() => {
    // Plus longue tâche du fil principal (outil de mesure : `PerformanceObserver` « longtask »).
    (window as unknown as { __long: { at: number; ms: number }[] }).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __long: { at: number; ms: number }[] }).__long.push({ at: e.startTime, ms: e.duration }))).observe({ entryTypes: ["longtask"] });
  });
  await page.goto(salonUrl2(START2 + 100_000));
  await loaded(page);
  await withRows(page, 3);
  const before = await page.evaluate(() => ({ id: window.__cdj.salon!.trackId, theme: window.__cdj.salon!.theme }));
  await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown");
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END2 - 800);
  await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#podium")).toContainText("terminé");
  await expect(page.locator("#podium .place")).toHaveCount(3);
  await expect(page.locator("#podium .place .who").first()).toContainText("Démo ");
  await expect(page.locator("#podium")).toContainText("Circuit suivant dans");
  // Le circuit suivant : un autre identifiant, un autre thème, la page n'a pas été rechargée.
  await page.waitForFunction((id) => window.__cdj.salon!.trackId !== id && window.__cdj.salon!.state === "playing", before.id, { timeout: 30_000 });
  const after = await page.evaluate(() => ({ ...window.__cdj.salon!, board: null, long: (window as unknown as { __long: { at: number; ms: number }[] }).__long }));
  expect(after.session).toBe(SESSION2 + 1);
  expect(after.trackId).toBe(`salon-${SESSION2 + 1}-g${before.id.split("-g")[1]}`);
  expect(after.theme).not.toBe(before.theme);
  expect(after.podiumVisible).toBe(false);
  expect(after.stats.swaps).toBe(1);
  // Pas de gel à la bascule : le circuit vient du fil de travail (jamais du fil principal) et sa scène était déjà construite pendant le podium.
  expect(after.stats.mainThreadGenerations).toBe(0);
  expect(after.stats.prebuilt).toBe(1);
  expect(after.stats.builtInSwap).toBe(0);
  // Tâches longues (> 50 ms) du fil principal pendant la bascule et les secondes qui suivent (rendu logiciel de la CI : lent par nature).
  const around = after.long.filter((t) => t.at >= after.stats.swapAt - 50 && t.at <= after.stats.swapAt + 3000);
  console.log(`bascule : ${after.stats.swapMs.toFixed(1)} ms (scène construite pendant le podium : ${after.stats.buildMs.toFixed(0)} ms) ; tâches longues autour de la bascule : ${JSON.stringify(around.map((t) => Math.round(t.ms)))}`);
  expect(after.stats.swapMs).toBeLessThan(120);
  expect(Math.max(0, ...around.map((t) => t.ms))).toBeLessThan(250); // aucune saccade de plus d'un quart de seconde autour de la bascule
  await expect(page.locator("#meta")).toContainText("Salon");
  await page.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
});

test("une course commencée avant la fin, finie après, est acceptée ; le podium attend son résultat", async ({ page }) => {
  await named(page);
  await page.goto(salonUrl(START + 300_000, "&timescale=4"));
  await loaded(page);
  await withRows(page, 2);
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 1500);
  await page.waitForFunction(() => window.__cdj.salon!.state === "overrun", undefined, { timeout: 15_000 });
  await expect(page.locator("#podium")).toBeHidden(); // la course continue
  await expect(page.locator("#finish")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#finish .rank")).toContainText("Rang", { timeout: 20_000 }); // envoyée après la fin : acceptée
  await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#podium .mine")).toContainText("Ta place");
  expect((await page.evaluate(() => window.__cdj.salon!.best))).toBe(pilot.finishMs);
});

test("touche G : tous → premiers seulement → aucun ; Tab ouvre et ferme le classement", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(salonUrl(START + 300_000));
  await loaded(page);
  await withRows(page, 3);
  await expect(page.locator("#board")).toBeVisible(); // grand écran : le classement est ouvert d'office
  await page.keyboard.press("Tab");
  await expect(page.locator("#board")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(page.locator("#board")).toBeVisible();
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("all");
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("top");
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("off");
  await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown");
  await page.waitForTimeout(500);
  expect((await page.evaluate(() => window.__cdj.salon!.ghosts!.shown))).toBe(0);
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("all");
});

test("sans API : message clair et circuit du jour", async ({ page }) => {
  await page.goto("/?mode=salon&debug");
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__cdj.salon)).toBeNull();
  await expect(page.locator("#meta")).toContainText("Circuit du Jour");
  await expect(page.locator("#meta")).toContainText("Le Salon a besoin du serveur");
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await expect(page.locator("#banner")).toContainText("Le Salon a besoin du serveur"); // et rappelé au départ
  await expect(page.locator("#btn-mode")).toBeHidden(); // pas d'API : pas de bouton Salon
});

test("bouton Salon / Jour : on passe de l'un à l'autre en gardant l'API", async ({ page }) => {
  await page.goto("/?api=demo&debug");
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
  await expect(page.locator("#btn-mode")).toBeVisible();
  await page.locator("#btn-mode").click();
  await page.waitForURL(/mode=salon/);
  expect(new URL(page.url()).searchParams.get("api")).toBe("demo");
  await loaded(page);
  await expect(page.locator("#btn-mode .txt")).toHaveText("Jour");
  await page.locator("#btn-mode").click();
  await page.waitForFunction(() => !location.search.includes("mode=salon"));
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toContainText("Circuit du Jour");
  // Même entrée dans la fenêtre de pause (c'est elle qu'on a sur téléphone, où le menu est plein).
  await page.keyboard.press("KeyP");
  await expect(page.locator("#pause-mode")).toHaveText("Salon");
  await page.locator("#pause-mode").click();
  await page.waitForURL(/mode=salon/);
  await loaded(page);
  await page.keyboard.press("KeyP");
  await expect(page.locator("#pause-mode")).toHaveText("Circuit du jour");
});

for (const viewport of [
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
  { name: "petit portrait", width: 360, height: 640 },
]) {
  test(`téléphone ${viewport.name} : le Salon (compte à rebours, menu, classement, podium) ne chevauche rien`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(salonUrl(START + 300_000, "&zones=1"));
    await loaded(page);
    await withRows(page, 3);
    // Même police large que la CI (voir mobile.spec.ts).
    await page.addStyleTag({ content: "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }" });
    await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
    expectNoOverlap(await boxes(page, ["#meta", "#medals", "#timer", "#menu", "#speed"]), viewport);
    // Classement : une fenêtre qu'on ouvre avec le bouton 🏆 (cible d'au moins 44 px au toucher).
    const board = page.locator("#btn-board");
    await expect(board).toBeVisible();
    const b = await board.boundingBox();
    expect(b!.width).toBeGreaterThanOrEqual(43);
    expect(b!.height).toBeGreaterThanOrEqual(43);
    await board.tap();
    await expect(page.locator("#board")).toBeVisible();
    expectNoOverlap(await boxes(page, ["#board"]), viewport);
    await page.locator("#board").tap();
    await expect(page.locator("#board")).toBeHidden();
    // Arrivée d'un tour complet (pas à pas, indépendant de la vitesse de la machine) : le panneau et ses boutons restent dans l'écran.
    await page.evaluate((n) => localStorage.setItem("cdj:name", n), "Mobile");
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    for (let guard = 0; guard < 100 && (await page.evaluate(() => window.__cdj.phase)) !== "finished"; guard++) await page.evaluate(() => window.__cdj.advance(240));
    await page.evaluate(() => window.__cdj.manual(false));
    await expect(page.locator("#finish .rank")).toContainText("Rang", { timeout: 30_000 });
    expectNoOverlap(await boxes(page, ["#meta", "#medals", "#timer", "#menu", "#finish"]), viewport);
    for (const b of await page.locator("#finish .actions button:visible").all()) {
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(34);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    // Podium : dans l'écran, boutons de 44 px.
    await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END + 100);
    await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#podium .place")).toHaveCount(3, { timeout: 15_000 });
    expectNoOverlap(await boxes(page, ["#podium"]), viewport);
    await context.close();
  });
}
