import { expect, test, type Page } from "@playwright/test";
import { dailyCircuit, encodeReplay, parseDay, runPilot, salonCircuit } from "@cdj/sim";
import { boxes, expectNoOverlap } from "./layout";

// Revoir le meilleur tour (lot 27b) : mode spectateur. Rendu 3D : Chromium seulement. `timescale=N` (outil `?debug`) accélère le temps
// de l'horloge ; la simulation reste pas à pas (la lecture finit sur le même temps qu'à vitesse normale).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

const DAY = "2026-10-21"; // un jour du jeu de démonstration (du 13/10 au 26/10/2026)
const DAY_URL = `/?api=demo&day=${DAY}&watch=best&debug`;
const ready = (page: Page) => page.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
const state = (page: Page) => page.evaluate(() => window.__cdj.watch!);
const finished = (page: Page) => page.waitForFunction(() => window.__cdj.watch?.phase === "finished", undefined, { timeout: 120_000 });

test("depuis les archives (démo) : la lecture finit sur exactement le temps du premier", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  await page.goto("/?api=demo&debug&timescale=8");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.keyboard.press("KeyH");
  const row = page.locator(`#archive .day[data-date="${DAY}"]`);
  const link = row.locator(".watch");
  await expect(link).toBeVisible({ timeout: 20_000 }); // les détails (nombre de pilotes) arrivent après la liste
  await link.click();
  await page.waitForURL(/watch=best/);
  expect(new URL(page.url()).searchParams.get("seed")).toBe(DAY);
  expect(new URL(page.url()).searchParams.get("api")).toBe("demo"); // les réglages suivent
  await page.goto(`${page.url()}&timescale=8`.replace(/&debug&timescale=8(?=.*timescale)/, "&debug")); // (le lien ne porte pas timescale : on l'ajoute)
  await ready(page);
  const w = await state(page);
  expect(w.name).toMatch(/^Démo /);
  expect(w.mode).toBe("first");
  expect(w.total).toBeGreaterThan(1500);
  await expect(page.locator("#ghostinfo")).toContainText("Rediffusion de Démo");
  await expect(page.locator("#ghostinfo")).toContainText(/\d+,\d{3}\u00a0s/);
  await expect(page.locator("body")).toHaveClass(/watch/);
  expect(w.carVisible).toBe(true);
  await finished(page);
  const end = await state(page);
  expect(end.finishMs).toBe(end.announcedMs); // le temps rejoué = le temps du classement, à la milliseconde
  await expect(page.locator("#finish")).toContainText("Rediffusion de Démo");
  await expect(page.locator("#finish .big")).toHaveText(await page.evaluate((ms) => `${(ms / 1000).toFixed(3).replace(".", ",")}\u00a0s`, end.finishMs));
  // Rien n'est envoyé au serveur, rien n'est enregistré.
  expect(requests.filter((r) => r.startsWith("POST") || /\/api\/(submit|rename)/.test(r))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cdj:best:")))).toEqual([]);
  expect(errors).toEqual([]);
});

test("pause, ralenti, accéléré et retour de 5 s ne changent pas le temps final", async ({ page }) => {
  await page.goto(`${DAY_URL}&timescale=6`);
  await ready(page);
  const announced = (await state(page)).announcedMs!;
  await page.waitForFunction(() => window.__cdj.watch!.tick > 900, undefined, { timeout: 60_000 });
  // Pause : le pas ne bouge plus.
  await page.locator("#watch-play").click();
  await page.waitForFunction(() => window.__cdj.watch!.paused);
  const paused = (await state(page)).tick;
  await page.waitForTimeout(600);
  expect((await state(page)).tick).toBe(paused);
  await expect(page.locator("#watch-play")).toHaveAttribute("data-etat", "pause"); // lot I4 : une icône, plus un texte ; l'état est dans data-etat
  // Retour de 5 s (600 pas exactement) pendant la pause.
  await page.locator("#watch-back").click();
  expect((await state(page)).tick).toBe(Math.max(0, paused - 600));
  // Vitesses : chaque bouton règle le rapport du temps.
  for (const speed of [0.25, 0.5, 2, 1]) {
    await page.locator(`[data-speed="${speed}"]`).click();
    expect((await state(page)).speed).toBe(speed);
    await expect(page.locator(`[data-speed="${speed}"]`)).toHaveClass(/on/);
  }
  // Ralenti réel : à ×0,25, le pas avance quatre fois moins vite qu'à ×1.
  await page.locator("#watch-play").click();
  // Le rapport se mesure sur l'horloge de la PAGE (performance.now) et sur trois secondes : en rendu logiciel une image dure 0,3 s ou plus,
  // une fenêtre de 0,7 s ne contient que deux ou trois images et le rapport sortait au hasard (0,2 relevé en CI).
  const rate = async (speed: number) => {
    await page.locator(`[data-speed="${speed}"]`).click();
    await page.waitForFunction((s) => window.__cdj.watch!.speed === s, speed);
    const from = await page.evaluate(() => ({ tick: window.__cdj.watch!.tick, at: performance.now() }));
    await page.waitForTimeout(3000);
    const to = await page.evaluate(() => ({ tick: window.__cdj.watch!.tick, at: performance.now() }));
    return (to.tick - from.tick) / (to.at - from.at);
  };
  const slow = await rate(0.25);
  const normal = await rate(1);
  expect(slow).toBeGreaterThan(0);
  expect(normal / slow).toBeGreaterThan(1.5); // (même seuil qu'avant : le vrai rapport est de 4 ; les fenêtres plus longues ne le brouillent plus)
  // Un second retour de 5 s en marche, puis accéléré jusqu'au bout.
  await page.locator("#watch-back").click();
  await page.locator("#watch-speed-2").click();
  await finished(page);
  expect((await state(page)).finishMs).toBe(announced);
  // À l'arrivée, revenir de 5 s relance la lecture et finit encore sur le même temps (barre de lecture masquée, touche ←).
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__cdj.watch!.phase === "racing", undefined, { timeout: 10_000 });
  await finished(page);
  expect((await state(page)).finishMs).toBe(announced);
});

test("la barre de progression saute n'importe où ; Entrée et « Rejouer la rediffusion » repartent du début", async ({ page }) => {
  // timescale=2 et non 6 : une image fait avancer la lecture de 0,5 s × timescale au plus (120 pas ici, 360 à ×6) ; à ×6 une image enjambait
  // toute la fenêtre « pas < 200 » du départ, qu'on ne voyait donc jamais (test bloqué 180 s en CI, à chaque essai).
  await page.goto(`${DAY_URL}&timescale=2`);
  await ready(page);
  const { total, announcedMs } = await state(page);
  await page.locator("#watch-play").click(); // pause
  await page.locator("#watch-progress").fill("500");
  await page.waitForFunction((t) => Math.abs(window.__cdj.watch!.tick - t / 2) <= 1, total);
  await page.locator("#watch-progress").fill("1000"); // tout au bout : la lecture est à l'arrivée (même en pause), la barre cède la place au panneau
  await finished(page);
  await expect(page.locator("#watchbar")).toBeHidden();
  expect((await state(page)).finishMs).toBe(announcedMs);
  await page.locator("#watch-replay").click();
  await page.waitForFunction(() => window.__cdj.watch!.phase === "racing" && window.__cdj.watch!.tick < 200);
  await finished(page);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cdj.watch!.phase === "racing" && window.__cdj.watch!.tick < 200);
  await finished(page);
  expect((await state(page)).finishMs).toBe(announcedMs);
});

test("« Courir contre ce fantôme » lance une course normale avec le bon fantôme", async ({ page }) => {
  await page.goto(`${DAY_URL}&timescale=8`);
  await ready(page);
  const { name, announcedMs } = await state(page);
  await finished(page);
  await page.locator("#watch-race").click();
  await expect(page.locator("body")).not.toHaveClass(/watch/);
  expect(await page.evaluate(() => window.__cdj.watch)).toBeNull();
  await expect(page.locator("#ghostinfo")).toContainText(`premier : ${name}`);
  await expect(page.locator("#ghostinfo")).toContainText(/\d+,\d{3}\u00a0s/);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await page.waitForFunction(() => (window.__cdj.ghost?.tick ?? 0) > 60, undefined, { timeout: 30_000 });
  expect(announcedMs).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.has("watch")).toBe(false); // un rechargement ne revient pas en spectateur
  // Ton propre pilotage marche de nouveau.
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(() => window.__cdj.car.vz > 3 || Math.hypot(window.__cdj.car.vx, window.__cdj.car.vz) > 3, undefined, { timeout: 20_000 });
  await page.keyboard.up("ArrowUp");
});

test("caméras : proche, loin, capot, puis la caméra libre (glisser tourne, molette zoome) ; le pseudo flotte au-dessus", async ({ page }) => {
  await page.goto(`${DAY_URL}&timescale=1`);
  await ready(page);
  // La touche est lue à l'image suivante : un appui à la fois, puis on ATTEND que la caméra ait changé (jamais une durée : en rendu logiciel
  // une image dure plus d'une demi-seconde et un appui suivant arrivait avant que le précédent soit lu).
  const label = () => page.evaluate(() => (window.__cdj.watch!.free ? "libre" : window.__cdj.camera.name));
  const next = async () => {
    const before = await label();
    await page.keyboard.press("KeyC");
    await page.waitForFunction((b) => (window.__cdj.watch!.free ? "libre" : window.__cdj.camera.name) !== b, before, { timeout: 30_000 });
  };
  const names: string[] = [];
  for (let i = 0; i < 5; i++) {
    names.push(await label());
    await next();
  }
  // Les trois caméras de la touche C, puis la caméra libre, puis on reboucle (le départ dépend de la caméra mémorisée : on part de « proche »).
  expect(names.slice(0, 4)).toEqual(["proche", "loin", "capot", "libre"]);
  expect(names[4]).toBe("proche");
  expect((await state(page)).free).toBe(false);
  // (le dernier appui de la boucle a mené à « loin »)
  await next(); // → capot
  await next(); // → libre
  expect((await state(page)).free).toBe(true);
  const before = (await state(page)).orbit;
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 30, { steps: 6 });
  await page.mouse.up();
  const dragged = (await state(page)).orbit;
  expect(dragged.yaw).not.toBeCloseTo(before.yaw, 2);
  expect(dragged.pitch).toBeGreaterThan(before.pitch);
  await page.mouse.wheel(0, 400);
  expect((await state(page)).orbit.dist).toBeGreaterThan(dragged.dist);
  // Le pseudo est au-dessus de la voiture (visible en caméra libre, masqué à l'intérieur de la vue capot).
  expect((await state(page)).label).toBe(true);
  await next(); // → proche
  await next(); // → loin
  await next(); // → capot
  expect(await page.evaluate(() => window.__cdj.camera.name)).toBe("capot");
  expect((await state(page)).label).toBe(false);
});

test("classement du jour : le lien « Revoir le meilleur tour » mène à la rediffusion du premier", async ({ page }) => {
  await page.goto(`/?api=demo&day=${DAY}&debug`);
  await page.waitForFunction(() => window.__cdj?.phase);
  const link = page.locator("#board .watchlink");
  await expect(link).toBeVisible({ timeout: 20_000 });
  await expect(link).toHaveAttribute("href", /watch=best/);
  await link.click();
  await page.waitForURL(/watch=best/);
  await ready(page);
  expect((await state(page)).mode).toBe("first");
});

test("écran d'arrivée : « Revoir le meilleur tour » (sans API : ton record) ; la lecture finit sur ton temps", async ({ page }) => {
  const day = parseDay("2026-10-01")!;
  const circuit = dailyCircuit(day);
  const pilot = runPilot(circuit.track, { grip: 0.9 });
  expect(pilot.valid).toBe(true);
  await page.goto("/?debug&seed=2026-10-01&timescale=10");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.addInitScript(() => localStorage.setItem("cdj:name", "Testeur"));
  await page.evaluate((code) => window.__cdj.autoplay(code), encodeReplay(pilot.replay));
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
  await page.locator("#finish-watch").click();
  await page.waitForURL(/watch=best/);
  await ready(page);
  const w = await state(page);
  expect(w.mode).toBe("mine");
  expect(w.announcedMs).toBe(pilot.finishMs);
  await finished(page);
  expect((await state(page)).finishMs).toBe(pilot.finishMs);
});

test("rien à revoir : course normale et un mot d'explication (pas de blocage)", async ({ page }) => {
  await page.goto("/?debug&seed=2026-10-02&watch=best");
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__cdj.watch)).toBeNull();
  await expect(page.locator("body")).not.toHaveClass(/watch/);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await expect(page.locator("#banner")).toContainText(/Aucun tour à revoir/);
});

// --- Salon -------------------------------------------------------------------------------------------------------------------
const LONG = 10 * 60_000;
const T0 = 1791549980000;
const SESSION = Math.floor(T0 / LONG);
const START = SESSION * LONG;
const salon = salonCircuit(SESSION);
const salonUrl = (extra = "") => `/?mode=salon&api=demo&debug&salonMinutes=10&salonAt=${START + 300_000}&timescale=8${extra}`;

test("Salon (démo) : « Revoir le meilleur tour » d'une session en cours ; le premier du classement, sans autre fantôme", async ({ page }) => {
  await page.goto(salonUrl());
  await page.waitForFunction(() => (window.__cdj?.salon?.board?.rows.length ?? 0) >= 1, undefined, { timeout: 120_000, polling: 500 });
  const link = page.locator("#board .watchlink");
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(/watch=best/);
  expect(new URL(page.url()).searchParams.get("mode")).toBe("salon");
  await page.waitForFunction(() => window.__cdj?.watch && !window.__cdj.watch.waiting && !!window.__cdj.watch.name, undefined, { timeout: 120_000, polling: 500 }); // (les courses des joueurs fictifs se recalculent au chargement)
  const w = await state(page);
  expect(w.mode).toBe("salon");
  expect(w.name).toBeTruthy();
  // Les courses des joueurs fictifs se terminent l'une après l'autre : au rechargement, le premier tour disponible peut être celui d'un pilote
  // moins rapide que le premier vu avant. Ce qui doit tenir : le tour regardé est une vraie ligne du classement, avec le temps du serveur.
  await page.evaluate(() => window.__cdj.salon!.refresh());
  const rows = await page.evaluate(() => window.__cdj.salon!.board!.rows.map((r) => ({ name: r.name, ms: r.ms })));
  expect(rows.some((r) => r.name === w.name && r.ms === w.announcedMs), `${w.name} ${w.announcedMs} dans ${JSON.stringify(rows)}`).toBe(true);
  expect(await page.evaluate(() => window.__cdj.salon!.ghosts!.count)).toBe(0); // un spectateur ne court pas : pas de fantômes autour
  expect(salon.id).toBe(await page.evaluate(() => window.__cdj.trackId));
  await finished(page);
  expect((await state(page)).finishMs).toBe((await state(page)).announcedMs);
});

test("Salon (démo) : ?mode=salon&watch=best attend le premier temps de la session s'il n'y en a pas encore", async ({ page }) => {
  await page.goto(`/?mode=salon&api=demo&debug&salonMinutes=10&salonAt=${START + 1000}&timescale=8&watch=best`);
  await page.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
  const first = await state(page);
  if (first.waiting) await expect(page.locator("#banner")).toContainText("En attente");
  // Dès qu'un joueur fictif a un temps (avance de l'horloge du Salon), la lecture démarre.
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), START + 400_000);
  await page.waitForFunction(() => window.__cdj?.watch && !window.__cdj.watch.waiting && !!window.__cdj.watch.name, undefined, { timeout: 120_000, polling: 500 });
  expect((await state(page)).mode).toBe("salon");
});

test("Salon (démo, sessions de 2 minutes) : la session regardée finit, retour au Salon normal sans rediffusion", async ({ page }) => {
  const SHORT = 2 * 60_000;
  const s2 = Math.floor(T0 / SHORT);
  const start2 = s2 * SHORT;
  await page.goto(`/?mode=salon&api=demo&debug&salonMinutes=2&salonAt=${start2 + 90_000}&timescale=8&watch=best`);
  await page.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
  if ((await state(page)).waiting) await page.waitForFunction(() => !!window.__cdj.watch?.name, undefined, { timeout: 120_000, polling: 500 });
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), start2 + SHORT + 500);
  await page.waitForFunction(() => window.__cdj.salon!.state === "podium", undefined, { timeout: 30_000 });
  await expect(page.locator("#podium")).toBeVisible();
  await page.waitForURL((u) => !u.searchParams.has("watch"), { timeout: 40_000 }); // podium 10 s, puis le Salon normal
  expect(new URL(page.url()).searchParams.get("mode")).toBe("salon");
});

test("téléphone : barre de lecture dans l'écran, aucune commande de conduite (donc aucune zone tactile), rien ne se chevauche", async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 360, height: 640 },
  ]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`${DAY_URL}&timescale=1&zones=1`);
    await ready(page);
    await page.addStyleTag({ content: "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }" });
    await page.waitForFunction(() => window.__cdj.watch!.tick > 120);
    // `?zones=1` ne dessine rien : en spectateur, il n'y a pas de zones de conduite.
    expect(await page.locator("#touch > *").count()).toBe(0);
    expect(await page.locator("#tbar > *").count()).toBe(0);
    const list = await boxes(page, ["#watchbar", "#meta", "#ghostinfo", "#timer", "#splits", "#menu", "#speed"]);
    expect(list.some((b) => b.name === "#watchbar")).toBe(true);
    expectNoOverlap(list, viewport);
    // Chaque bouton de lecture est assez grand pour un doigt, et tient dans la barre.
    const bar = (await page.locator("#watchbar").boundingBox())!;
    for (const b of await page.locator("#watchbar button").all()) {
      const r = (await b.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(43);
      expect(r.width).toBeGreaterThanOrEqual(39);
      expect(r.x).toBeGreaterThanOrEqual(bar.x - 1);
      expect(r.x + r.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
    }
    // Un toucher sur la pause arrête bien la lecture (vrai événement tactile).
    await page.locator("#watch-play").tap();
    expect((await state(page)).paused).toBe(true);
    await context.close();
  }
});
