import { expect, test, TODAY, newClockedContext } from "./fixtures";
import { SIM_VERSION, dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { boxes, expectCentreLibre, expectNoOverlap } from "./layout";

// Téléphone : rien ne se chevauche et tout reste dans l'écran, en portrait comme en paysage.
// (Le rendu 3D demande WebGL : Chromium seulement.)
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const day = TODAY;
const circuit = dailyCircuit(day);
const pilot = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(pilot.replay);
// API simulée : ces tests ne doivent rien envoyer au vrai serveur (les rangs des autres tests en dépendent).
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Player-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

for (const viewport of [
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
  { name: "paysage compact", width: 740, height: 360 },
  { name: "petit portrait", width: 360, height: 640 },
]) {
  test(`téléphone ${viewport.name} (${viewport.width}×${viewport.height}) : en course puis à l'arrivée, rien ne se chevauche`, async ({ browser }) => {
    const context = await newClockedContext(browser, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    // Un fantôme et un classement : le bandeau est au complet.
    await context.addInitScript(
      ([id, replay, ms, simVersion]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion })),
      [circuit.track.id, code, pilot.finishMs, SIM_VERSION] as const,
    );
    await context.route(`${API}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const me = { rank: 3, name: "Mobile", ms: pilot.finishMs, medal: null };
      if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id })); // planning (lot 14)
      if (url.pathname === "/api/name") return route.fulfill(json({ available: true })); // pseudo libre (lot 30 : le serveur dit si un pseudo est pris)
      if (url.pathname === "/api/submit") {
        return route.fulfill(json({ accepted: true, improved: true, ms: pilot.finishMs, splits: [], respawns: 0, bestMs: pilot.finishMs, rank: 3, participants: 12, medal: null }));
      }
      if (url.pathname.endsWith("/leaderboard")) {
        const top = [{ rank: 1, name: "Alice", ms: pilot.finishMs - 3000, medal: "author" }, { rank: 2, name: "Bob", ms: pilot.finishMs - 1000, medal: "gold" }, me];
        return route.fulfill(json({ date: circuit.date, participants: 12, top, me }));
      }
      // Lot I3 : « Jeu suivant du jour » (la lecture de l'arrivée) : Track fini, Jump pas joué.
      if (url.pathname === "/api/portail/jour") {
        const fini = { statut: "fini", tempsMs: pilot.finishMs, medaille: null, rang: 3, classes: 12 };
        return route.fulfill(json({ date: circuit.date, jeux: [{ jeu: "cdj", site: "track", nom: "Track", etat: fini }, { jeu: "jump", site: "jump", nom: "Jump", etat: { statut: "pas_joue" } }] }));
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

    // En course, après deux points de contrôle : les plaques au complet (titre, objectif, chrono, point de contrôle, fantôme, pause, vitesse). Lot I4 : la plaque
    // du point de contrôle ne montre que le dernier (« PC 2/5 » collé à son écart), plus une ligne par point.
    await expect(page.locator("#splits .pc")).toContainText("2/", { timeout: 60_000 });
    await page.waitForTimeout(300);
    // Charte rév. 7 : la bande du haut (30 px), trois boutons de 44 px en haut à gauche, l'objectif et la pastille du rang en haut à droite, les commandes aux bords, la vitesse
    // en bas au centre ; le titre et l'aide ont disparu (ils ne sont là qu'au départ), le classement est replié (la pastille l'ouvre).
    const paysage = viewport.width > viewport.height;
    const racing = ["#hud-centre", "#menu", "#medals", "#rang", "#speed", "#touch .steer-left", "#touch .steer-right", "#touch .pedal-brake", "#touch .pedal-gas"]; // les commandes sont tactiles : le téléphone est tactile
    const racingBoxes = await boxes(page, racing);
    expect(racingBoxes.map((b) => b.name)).toEqual(expect.arrayContaining(racing));
    expectNoOverlap(racingBoxes, viewport);
    if (paysage) expectCentreLibre(racingBoxes, viewport);
    expect((await page.locator("#hud-centre").boundingBox())!.height, "la bande fait 30 px de haut").toBeLessThanOrEqual(31);
    for (const b of await page.locator("#menu button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5); // pause, point de contrôle, recommencer
    await expect(page.locator("#meta")).toBeHidden(); // le titre du circuit ne s'affiche qu'au départ
    await expect(page.locator("#ghostinfo")).toBeHidden();
    // Le classement est replié sur téléphone ; la pastille du rang (« 3e ˅ ») l'ouvre, dans le coin du haut à droite, hors de la zone centrale.
    await expect(page.locator("#board")).toBeHidden();
    await expect(page.locator("#rang")).toContainText("3e");
    expect((await page.locator("#rang").boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await page.locator("#rang").click();
    await expect(page.locator("#board")).toBeVisible();
    await expect(page.locator("#board .row")).toHaveCount(3);
    const withBoard = await boxes(page, [...racing, "#board"]);
    expectNoOverlap(withBoard, viewport);
    if (paysage) expectCentreLibre(withBoard, viewport);
    await page.locator("#rang").click();
    await expect(page.locator("#board")).toBeHidden();

    // À l'arrivée : panneau, boutons (au moins 34 px de haut : on les touche du doigt), classement.
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
    await page.locator("#finish .online input").fill("Mobile");
    await page.locator("#finish .online button[type=submit]").click();
    await expect(page.locator("#finish .online .rank")).toBeVisible({ timeout: 20_000 });
    // Lot I4 : l'arrivée est un cadre plein écran, le classement du coin de la course disparaît derrière (les tests de son coin, repliable, sont plus haut, en course).
    await page.waitForTimeout(500);
    await expect(page.locator("#board")).toBeHidden();
    // Lot I3 : « Jeu suivant du jour : Jump › » s'ajoute au panneau d'arrivée sans rien cacher de ce qu'il montrait (cible de 44 px, tout reste dans l'écran).
    const next = page.locator("#finish-next-game");
    await expect(next).toBeVisible({ timeout: 20_000 });
    await expect(next).toHaveText("Jeu suivant du jour : Jump ›");
    await expect(next).toHaveAttribute("href", "../jump/");
    await page.locator("#finish").evaluate((e) => e.scrollTo(0, 0));
    expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    // Lot I4 : l'arrivée est un cadre qui couvre tout l'écran (barre des jeux, étiquette Track, puis « Jeu suivant du jour » dessous) : plus de plaques de course à
    // éviter ; ses blocs ne se chevauchent pas et restent dans l'écran (la page défile dans l'étiquette si besoin).
    const blocs = ["#finish .dj-barre-jeu", "#finish .etiquette", "#finish .arrivee__pied"];
    const blocBoxes = await boxes(page, blocs);
    expect(blocBoxes.map((b) => b.name)).toEqual(expect.arrayContaining(blocs));
    expectNoOverlap(blocBoxes, viewport);
    // Tout ce que l'arrivée montrait déjà reste visible et touchable (le panneau défile, rien n'est masqué par le nouveau bouton).
    for (const sel of ["#finish .big", "#finish .online .rank", "#finish .actions button:first-child"]) await expect(page.locator(sel).first()).toBeVisible();
    for (const b of await page.locator("#finish .actions button").all()) {
      await b.scrollIntoViewIfNeeded(); // lot I4 : le cadre défile dans l'étiquette (360×640 ne montre pas tout d'un coup) : chaque bouton, amené à l'écran, doit y tenir
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(34);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await context.close();
  });
}
