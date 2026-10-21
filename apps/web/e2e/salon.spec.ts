import { expect, test, type Page } from "@playwright/test";
import { encodeReplay, runPilot, salonCircuit, salonTheme } from "@cdj/sim";
import { boxes, expectCentreLibre, expectNoOverlap } from "./layout";

// Le Salon (lot 26) en mode démonstration : `?mode=salon&api=demo`, sessions de 2 minutes (`salonMinutes=2`) et horloge pilotable
// (`salonAt=` au chargement, `__cdj.salon.setNow(ms)` ensuite : outils `?debug`). Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(240_000);

// Deux durées de session : 10 minutes (la vraie : tout ce qui n'a pas besoin de voir la fin d'une session, sans craindre qu'elle se
// termine pendant le test, même sur une CI lente) et 3 minutes (le podium et la bascule, où l'on avance l'horloge soi-même).
// Pas 2 minutes (retouche 31b) : le circuit suivant se prépare dans les 2 dernières minutes d'une session (`PREPARE_MS`) — dès la première
// seconde d'une session de 2 minutes, donc. Sa scène se construisait alors sur le fil principal juste quand on repart après le podium (tâche
// longue de 725 à 754 ms en CI, profil à l'appui), ce qui n'arrive jamais avec les vraies sessions de 10 minutes (préparation à la 8e minute).
// Durée du classement final (lot 33) : `PODIUM_MS` de `src/salon.ts` (non importée : le projet TypeScript des e2e ne contient pas `src/`).
const PODIUM_MS = 8_000;
const LONG = 10 * 60_000;
const SHORT = 3 * 60_000;
const T0 = 1791549980000;
const SESSION = Math.floor(T0 / LONG);
const START = SESSION * LONG;
const SESSION2 = Math.floor(T0 / SHORT);
const END = START + LONG;
const START2 = SESSION2 * SHORT;
const END2 = START2 + SHORT;
const salonUrl = (at: number, extra = "") => `/?mode=salon&api=demo&debug&salonMinutes=10&salonAt=${at}${extra}`;
const salonUrl2 = (at: number, extra = "") => `/?mode=salon&api=demo&debug&salonMinutes=3&salonAt=${at}${extra}`;

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
  // Les joueurs fictifs sont calculés un à un (fil de travail) : le premier du classement CHANGE tant que le dernier n'est pas arrivé, et les
  // fantômes suivent le classement avec un temps de retard. On attend donc l'état stable — les fantômes sont ceux du classement courant —
  // avant de comparer (« Démo Sirocco » attendu, « Démo Bouchon » reçu en CI : deux lectures à des moments différents).
  // Retouche 31b : une course déjà partie GARDE ses fantômes (un changement de classement attend le prochain départ, voulu) ; si le dernier
  // joueur fictif arrive après le départ, l'état stable n'arrive donc jamais seul (vu en CI : 2 min de course sur place, échec). Un nouveau
  // départ (Entrée) prend le classement du moment : on en relance un tant que le premier fantôme n'est pas le premier du classement.
  const settled = () =>
    page.evaluate(() => {
      const s = window.__cdj.salon!;
      const rows = s.board?.rows ?? [];
      return { same: rows.length >= 3 && (s.ghosts?.count ?? 0) >= 1 && s.ghosts!.names[0] === rows[0]!.name, racing: window.__cdj.phase === "racing" };
    });
  await expect
    .poll(
      async () => {
        const st = await settled();
        if (!st.same && st.racing) await page.keyboard.press("Enter");
        return st.same;
      },
      { timeout: 120_000, intervals: [2000] },
    )
    .toBe(true);
  const s = await page.evaluate(() => window.__cdj.salon!);
  expect(s.demo).toBe(true);
  expect(s.sessionMs).toBe(LONG);
  expect(s.trackId).toBe(circuit.id); // le même circuit que le serveur et le générateur
  expect(s.theme).toBe(salonTheme(SESSION));
  await expect(page.locator("#meta")).toContainText("Salon");
  await expect(page.locator("#medals")).toContainText(/0[45]:\d\d/);
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
  await expect(page.locator("#finish .rank")).toContainText(/\d+(er|e) sur \d+/, { timeout: 20_000 });
  const s = await page.evaluate(() => window.__cdj.salon!);
  expect(s.best).toBe(pilot.finishMs); // le temps du rejeu
  expect(s.board!.me).toMatchObject({ name: "Testeur", ms: pilot.finishMs });
  expect(s.stats.submits).toBe(1);
  await expect(page.locator("#finish .share")).toHaveText(/^Salon \d\d:\d\d — \d+,\d{3}\u00a0s — \d+(er|e)\/\d+$/);
  // Aucun record du circuit du jour ou de la session n'est écrit.
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => k.startsWith("cdj:best:") || k.startsWith("cdj:sub:"))).toEqual([]);
  // Rejouer : ton meilleur tour devient un fantôme (« Toi »), avec les autres.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cdj.salon!.ghosts!.names.includes("Toi"), undefined, { timeout: 30_000 });
});

test("finale (lot 31) : à fin − 15 s plus aucun départ, grand compte à rebours, classement affiché d'office ; la course en cours continue", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(salonUrl(START + 60_000));
  await loaded(page);
  await withRows(page, 1);
  await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown");
  await expect(page.locator("#medals")).not.toContainText("Dernière chance");
  await expect(page.locator("#finale")).toBeHidden();
  expect(await page.evaluate(() => window.__cdj.salon!.startLocked)).toBe(false);
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - FINALE - 400);
  await expect(page.locator("#finale")).toBeHidden(); // 400 ms avant la finale
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 10_500);
  await expect(page.locator("#medals")).toContainText("Dernière chance");
  await expect(page.locator("#medals")).toHaveClass(/last/);
  await expect(page.locator("#finale")).toBeVisible();
  // Le nombre décroît en temps réel pendant l'attente (rendu logiciel lent) : il est entre 1 et 11 (jamais 15 : la finale a commencé à 10,5 s de la fin).
  const shownCount = Number(await page.locator("#finale").textContent());
  expect(shownCount).toBeGreaterThanOrEqual(0);
  expect(shownCount).toBeLessThanOrEqual(11);
  await expect(page.locator("#board")).not.toHaveClass(/folded/);
  const during = await page.evaluate(() => ({ locked: window.__cdj.salon!.startLocked, finale: window.__cdj.salon!.finaleOn, phase: window.__cdj.phase }));
  expect(during).toMatchObject({ locked: true, finale: true });
  // Le départ est refusé : la tentative en cours n'est pas remise à zéro.
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(() => window.__cdj.car.tick > 120, undefined, { timeout: 60_000 });
  const tick = await page.evaluate(() => window.__cdj.car.tick);
  await page.keyboard.press("Enter");
  await expect(page.locator("#banner")).toContainText("plus de départ");
  expect(await page.evaluate(() => window.__cdj.car.tick)).toBeGreaterThanOrEqual(tick);
  await page.keyboard.up("ArrowUp");
});

test("fin de session : podium (trois premiers) sur l'ancien circuit, puis un autre circuit s'installe tout seul, sans gel ni calcul sur le fil principal", async ({ page }) => {
  await page.addInitScript(() => {
    // Plus longue tâche du fil principal (outil de mesure : `PerformanceObserver` « longtask »).
    (window as unknown as { __long: { at: number; ms: number }[] }).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __long: { at: number; ms: number }[] }).__long.push({ at: e.startTime, ms: e.duration }))).observe({ entryTypes: ["longtask"] });
    // Diagnostic (retouche 31b) : qui occupe une image longue (« long-animation-frame » : scripts responsables) et quand des shaders se compilent.
    const w = window as unknown as { __frames: unknown[]; __links: number[] };
    w.__frames = [];
    w.__links = [];
    try {
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => {
          const f = e as PerformanceEntry & { blockingDuration?: number; renderStart?: number; scripts?: { invoker: string; sourceFunctionName: string; duration: number }[] };
          w.__frames.push({ at: Math.round(f.startTime), ms: Math.round(f.duration), blocking: Math.round(f.blockingDuration ?? 0), render: Math.round((f.startTime + f.duration) - (f.renderStart || f.startTime)), scripts: (f.scripts ?? []).map((s) => `${s.invoker}|${s.sourceFunctionName}|${Math.round(s.duration)}`) });
        }),
      ).observe({ type: "long-animation-frame", buffered: false });
    } catch {
      /* navigateur sans cette mesure */
    }
    const link = WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram = function (program) {
      w.__links.push(Math.round(performance.now()));
      return link.call(this, program);
    };
  });
  // Qualité figée (`quality=2`, celle où démarre la qualité automatique : la scène la plus lourde). Lot R3 : la saccade de 300 ms vue en CI
  // après le podium (runs `push`) n'était pas la bascule mais la PREMIÈRE décision de la qualité automatique (`QualityGovernor`) : le jeu a
  // roulé quelques secondes seulement avant la fin de session, la qualité descend donc juste après le podium (2 → 1 → 0, mesuré : 1,5 s et
  // 3,4 s en local, plus tôt sur un runner plus lent) et le passage à 0 coupe les ombres, ce qui recompile 5 shaders d'un coup (journal
  // « shaders compilés à … », sans `USE_SHADOWMAP`). Ce test mesure la bascule : la qualité automatique a son propre moment, hors de lui.
  await page.goto(salonUrl2(START2 + 100_000, "&quality=2"));
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
  // Lot 33 : pendant le classement final le circuit ne change pas (même identifiant, même session) ; le suivant s'installe ensuite.
  const behind = await page.evaluate(() => ({ id: window.__cdj.salon!.trackId, state: window.__cdj.salon!.state, session: window.__cdj.salon!.session }));
  expect(behind.id).toBe(before.id);
  expect(behind.session).toBe(SESSION2);
  expect(behind.state).toBe("podium");
  await page.waitForFunction((id) => window.__cdj.salon!.trackId !== id && window.__cdj.salon!.state === "playing", before.id, { timeout: 30_000 });
  const after = await page.evaluate(() => ({ ...window.__cdj.salon!, board: null, long: (window as unknown as { __long: { at: number; ms: number }[] }).__long }));
  expect(after.session).toBe(SESSION2 + 1);
  expect(after.trackId).toBe(`salon-${SESSION2 + 1}-g${before.id.split("-g")[1]}`);
  expect(after.theme).not.toBe(before.theme);
  expect(after.podiumVisible).toBe(false);
  expect(after.stats.swaps).toBe(1);
  // Pas de gel à la bascule : le circuit vient du fil de travail (jamais du fil principal) et sa scène était déjà construite pendant le podium.
  expect(after.stats.mainThreadGenerations).toBe(0);
  expect(after.stats.prebuilt + after.stats.builtInSwap).toBe(1); // construite d'avance si personne ne roulait, sinon à l'heure pile, derrière le podium
  // Tâches longues (> 50 ms) du fil principal : à l'heure pile (la première image de la nouvelle scène, derrière le podium : la course est coupée et
  // le jeu gelé, personne ne conduit) puis, ce qui compte, quand le podium se ferme et que le joueur repart (rendu logiciel de la CI : lent par nature).
  const around = after.long.filter((t) => t.at >= after.stats.swapAt - 50 && t.at <= after.stats.swapAt + 3000);
  console.log(`bascule : ${after.stats.swapMs.toFixed(1)} ms (scène construite : ${after.stats.buildMs.toFixed(0)} ms) ; tâches longues autour de la bascule (début relatif, durée) : ${JSON.stringify(around.map((t) => [Math.round(t.at - after.stats.swapAt), Math.round(t.ms)]))} ; construites d'avance : ${after.stats.prebuilt}`);
  if (after.stats.prebuilt === 1) expect(after.stats.swapMs).toBeLessThan(120);
  const closedAt = await page.evaluate(() => performance.now()); // le podium vient de se fermer : le décompte de départ commence
  await page.waitForTimeout(3000); // fenêtre de mesure (rien d'autre à attendre)
  const afterClose = (await page.evaluate(() => (window as unknown as { __long: { at: number; ms: number }[] }).__long)).filter((t) => t.at >= closedAt - 50 && t.at <= closedAt + 3000);
  console.log(`après le podium : tâches longues ${JSON.stringify(afterClose.map((t) => [Math.round(t.at - closedAt), Math.round(t.ms)]))}`);
  const diag = await page.evaluate((c) => {
    const w = window as unknown as { __frames: { at: number }[]; __links: number[] };
    return { frames: w.__frames.filter((f) => f.at >= c - 50 && f.at <= c + 3000).map((f) => ({ ...f, at: f.at - Math.round(c) })), links: w.__links.filter((t) => t >= c - 50 && t <= c + 3000).map((t) => t - Math.round(c)) };
  }, closedAt);
  console.log(`après le podium : images longues ${JSON.stringify(diag.frames)} ; shaders compilés à ${JSON.stringify(diag.links)} ms`);
  expect(Math.max(0, ...afterClose.map((t) => t.ms))).toBeLessThan(250); // aucune saccade de plus d'un quart de seconde quand on repart
  await expect(page.locator("#meta")).toContainText("Salon");
  await page.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
});

// Sessions d'une minute (lot 31) : la finale commence à 45 s, le circuit change à la 60e seconde pour tout le monde.
const MIN1 = 60_000;
const SESSION1 = Math.floor(T0 / MIN1);
const START1 = SESSION1 * MIN1;
const END1 = START1 + MIN1;
const circuit1 = salonCircuit(SESSION1);
const code1 = encodeReplay(runPilot(circuit1.track, { grip: 0.9 }).replay);
const finishMs1 = runPilot(circuit1.track, { grip: 0.9 }).finishMs;
const salonUrl1 = (at: number, extra = "") => `/?mode=salon&api=demo&debug&salonMinutes=1&salonAt=${at}${extra}`;
const FINALE = 15_000;

test("une course commencée avant la fin et finie avant l'heure pile est acceptée et compte (podium)", async ({ page }) => {
  await named(page);
  await page.goto(salonUrl(START + 300_000, "&timescale=4"));
  await loaded(page);
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  // La voiture doit VRAIMENT rouler (1 s de simulation) : « phase = racing » est déjà vrai avant que la course lancée par autoplay ait démarré.
  await page.waitForFunction(() => window.__cdj.phase === "racing" && window.__cdj.car.tick > 120, undefined, { timeout: 60_000 });
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 40_000); // 40 s réelles pour finir (le tour dure ≈ 35 s de simulation, ×4)
  await expect(page.locator("#finish")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#finish .rank")).toContainText(/\d+(er|e) sur \d+/, { timeout: 20_000 }); // envoyée avant la fin : acceptée
  expect((await page.evaluate(() => window.__cdj.salon!.best))).toBe(pilot.finishMs);
  // À l'heure pile, le podium s'affiche avec ta place.
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END - 300);
  await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#podium .mine")).toContainText("Ta place");
  // Lot 33 : « Copier » met la ligne du Salon et le lien du Salon dans le presse-papiers.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#podium").getByRole("button", { name: "Copier" }).click();
  await expect(page.locator("#podium").getByRole("button", { name: "Copié" })).toBeVisible();
  const [ligne, lien] = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
  expect(ligne).toMatch(/^Salon \d\d:\d\d — \d+,\d{3}\ss — \d+(er|e)\/\d+$/);
  expect(lien).toBe(`${new URL(page.url()).origin}/?mode=salon`);
});

test("une course non finie à l'heure pile est coupée pour tous et ne compte pas ; le circuit suivant s'installe après le classement final", async ({ page }) => {
  await named(page);
  await page.goto(salonUrl1(START1 + 20_000, "&timescale=4"));
  await loaded(page);
  await page.evaluate((c) => window.__cdj.autoplay(c), code1);
  await page.waitForFunction(() => window.__cdj.phase === "racing" && window.__cdj.car.tick > 120, undefined, { timeout: 60_000 });
  expect(finishMs1).toBeGreaterThan(20_000); // le tour dure plus que ce qu'il reste : il ne peut pas finir avant l'heure pile
  await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), END1 - 3000);
  await page.waitForFunction(() => window.__cdj.salon!.startLocked, undefined, { timeout: 15_000 }); // finale : plus de départ (tant que l'heure pile n'est pas passée)
  await expect(page.locator("#podium")).toBeVisible({ timeout: 15_000 });
  const s = await page.evaluate(() => ({ ...window.__cdj.salon!, board: null }));
  expect(s.session).toBe(SESSION1); // lot 33 : sous le classement final, toujours l'ancien circuit
  expect(s.trackId).toBe(circuit1.id);
  expect(s.stats.submits).toBe(0); // rien n'a été envoyé : la course coupée ne compte pas
  await expect(page.locator("#podium .mine")).toContainText("pas de temps");
  expect(await page.evaluate(() => window.__cdj.salon!.startLocked)).toBe(false); // la finale est finie : on pourra repartir à la fermeture du podium
  await page.waitForFunction((id) => window.__cdj.salon!.state === "playing" && window.__cdj.salon!.trackId !== id, circuit1.id, { timeout: 30_000 });
  const apres = await page.evaluate(() => ({ session: window.__cdj.salon!.session, trackId: window.__cdj.salon!.trackId, best: window.__cdj.salon!.best }));
  expect(apres.session).toBe(SESSION1 + 1);
  expect(apres.trackId).toBe(`salon-${SESSION1 + 1}-g${circuit1.id.split("-g")[1]}`);
  expect(apres.best).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cdj:best:")))).toEqual([]);
});

test("le classement final reste 8 s sur l'ancien circuit, puis le circuit change au même instant pour deux navigateurs (heure du serveur, pas la fin de leur course)", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    await Promise.all(pages.map((p) => p.goto(salonUrl1(START1 + 20_000))));
    await Promise.all(pages.map(loaded));
    // État stable avant de mesurer (retouche 31b) : les fantômes fictifs (calculés en fil de travail) déjà dessinés — leur première image
    // compile leurs shaders, 2,5 à 4,6 s de fil principal en rendu logiciel — et le circuit suivant prêt, sa scène construite d'avance (avec des
    // sessions d'une minute cette préparation commence dès le chargement ; avec les vraies, deux minutes avant la fin). Sans cette attente,
    // l'une ou l'autre tombait dans les 2 s mesurées : 2 à 5 images au lieu de plus de 5 (CI et local sur 2 cœurs).
    await Promise.all(
      pages.map((p) => p.waitForFunction(() => window.__cdj.salon!.stats.prebuilds >= 1 && (window.__cdj.salon!.ghosts?.shown ?? 0) >= 1, undefined, { timeout: 90_000 })),
    );
    expect(await pages[0]!.evaluate(() => window.__cdj.salon!.session), "la session n'est pas encore finie (chargement trop lent)").toBe(SESSION1);
    // Les deux horloges sont réglées sur le même instant, 8 s avant l'heure pile (dans la finale) ; chaque page note (heure du Salon, session)
    // à chaque image. 8 s et non 2 (retouche 31b) : en rendu logiciel sur 2 cœurs, une page du Salon seule dessine une image toutes les 0,5 à
    // 0,75 s, deux pages côte à côte toutes les 1,3 s environ (mesuré) — 2 s ne donnaient que 2 à 5 images, pas de quoi mesurer un écart.
    await Promise.all(pages.map((p) => p.evaluate((end) => {
      const w = window as unknown as { __samples: [number, number, string, boolean][] };
      w.__samples = [];
      window.__cdj.salon!.setNow(end - 3000);
      const sample = () => {
        const s = window.__cdj.salon!;
        w.__samples.push([s.now, s.session, s.trackId, s.podiumVisible]);
        if (w.__samples.length < 4000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, END1)));
    // Lot R3 : on attend dans la page la bascule ET plus de 5 images notées (avant : la bascule seule, puis « plus de 5 » compté à la lecture,
    // côté Node — 4 ou 5 images certains runs, 7 occurrences en CI : deux pages en rendu logiciel, ≈ 1,3 s par image). L'image de plus arrive
    // après la bascule ; elle ne relâche rien : les écarts entre images sont pris seulement jusqu'à la première image basculée.
    await Promise.all(pages.map((p) => p.waitForFunction((s) => window.__cdj.salon!.session > s && (window as unknown as { __samples: unknown[] }).__samples.length > 5, SESSION1, { timeout: 45_000 })));
    for (const p of pages) {
      const samples = await p.evaluate(() => (window as unknown as { __samples: [number, number, string, boolean][] }).__samples);
      expect(samples.length).toBeGreaterThan(5);
      const SWITCH = END1 + PODIUM_MS; // la fin de session, puis le classement final : le circuit change à cet instant (horloge du Salon)
      // Jamais avant (sur l'horloge du Salon) ; et pas plus tard qu'une image (en rendu logiciel une image dure 0,3 s ou plus) :
      // la bascule ne dépend ni d'une course ni d'un podium, seulement de l'heure.
      for (const [now, session] of samples) if (session > SESSION1) expect(now, "bascule avant la fin du classement final").toBeGreaterThanOrEqual(SWITCH - 50);
      const switchedAt = samples.findIndex(([, session]) => session > SESSION1);
      expect(switchedAt, "au moins une image avant la bascule").toBeGreaterThan(0);
      const firstSwitched = samples[switchedAt]!;
      const upToSwitch = samples.slice(0, switchedAt + 1);
      const gaps = upToSwitch.slice(1).map(([t], i) => t - upToSwitch[i]![0]);
      const margin = Math.max(...gaps) + 600;
      expect(firstSwitched[0] - SWITCH, "retard de la bascule").toBeLessThan(margin);
      // Entre la fin de session et la bascule : le classement final est affiché et l'identifiant du circuit n'a pas bougé ; il dure ≈ 8 s.
      const entre = upToSwitch.slice(0, -1).filter(([now]) => now >= END1 + margin);
      expect(entre.length, "images pendant le classement final").toBeGreaterThan(0);
      for (const [, , id, podium] of entre) {
        expect(id, "identifiant du circuit pendant le classement final").toBe(circuit1.id);
        expect(podium, "classement final visible").toBe(true);
      }
      expect(upToSwitch.some(([now, , , podium]) => podium && now >= SWITCH - margin), "le classement final dure jusqu'à la bascule").toBe(true);
      expect(firstSwitched[2]).toBe(`salon-${SESSION1 + 1}-g${circuit1.id.split("-g")[1]}`);
      expect(await p.evaluate(() => window.__cdj.salon!.trackId)).toBe(`salon-${SESSION1 + 1}-g${circuit1.id.split("-g")[1]}`);
    }
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("touche G : tous → premiers seulement → aucun ; Tab ouvre et ferme le classement", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(salonUrl(START + 300_000));
  await loaded(page);
  await withRows(page, 3);
  await expect(page.locator("#board")).toBeVisible(); // le classement est affiché d'office (lot 29)
  await expect(page.locator("#board")).not.toHaveClass(/folded/);
  await page.keyboard.press("Tab"); // replié : l'en-tête reste, les lignes disparaissent
  await expect(page.locator("#board")).toHaveClass(/folded/);
  await page.keyboard.press("Tab");
  await expect(page.locator("#board")).not.toHaveClass(/folded/);
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("all");
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("top");
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("off");
  await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown");
  // Les fantômes disparaissent à la prochaine image : on attend cet état, pas une durée (la CI dessine lentement).
  await page.waitForFunction(() => window.__cdj.salon!.ghosts!.shown === 0, undefined, { timeout: 20_000 });
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => window.__cdj.salon!.ghostMode)).toBe("all");
});

test("sans API : message clair et circuit du jour", async ({ page }) => {
  await page.goto("/?mode=salon&debug");
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__cdj.salon)).toBeNull();
  await expect(page.locator("#meta")).toContainText("Circuit n°");
  await expect(page.locator("#meta")).toContainText("Le Salon a besoin du serveur");
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await expect(page.locator("#banner")).toContainText("Le Salon a besoin du serveur"); // et rappelé au départ
  await expect(page.locator("#btn-mode")).toHaveCount(0); // plus de bouton Salon dans la barre (lot 29)
});

test("accueil ⇄ Salon : on passe de l'un à l'autre en gardant l'API, par l'accueil", async ({ page }) => {
  await page.goto("/?api=demo&debug&home=1");
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
  await page.locator("#home-salon").click();
  await page.waitForURL(/mode=salon/);
  expect(new URL(page.url()).searchParams.get("api")).toBe("demo");
  await loaded(page);
  await page.locator("#btn-pause").click();
  await page.locator("#pause-home").click(); // retour à l'accueil depuis le Salon
  await page.waitForURL(/home=1/);
  expect(new URL(page.url()).searchParams.get("api")).toBe("demo");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#home")).toBeVisible();
  await page.locator("#home-daily").click();
  await expect(page.locator("#meta")).toContainText("Circuit n°");
  // La pause du Salon propose aussi l'accueil.
  await page.goto("/?api=demo&debug&mode=salon");
  await loaded(page);
  await page.locator("#btn-pause").click(); // (la touche P pressée dès le chargement pouvait précéder l'écoute du clavier : le bouton attend qu'il soit actionnable)
  await expect(page.locator("#pause-home")).toBeVisible();
  await expect(page.locator("#pause-archive")).toBeHidden(); // pas d'archives dans le Salon
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
    // Charte rév. 7 : la bande du haut, les boutons de 44 px, le compte à rebours du Salon (pastille compacte) ; le titre n'est là qu'au départ ; le centre reste libre.
    await page.waitForTimeout(1700);
    const paysage = viewport.width > viewport.height;
    const hud = await boxes(page, ["#hud-centre", "#medals", "#menu", "#speed"]);
    expectNoOverlap(hud, viewport);
    if (paysage) expectCentreLibre(hud, viewport);
    // Classement : replié sur téléphone (la touche L ou la pastille du rang l'ouvre) ; ouvert, il reste dans le coin du haut à droite, et son en-tête le replie (cible d'au moins 44 px).
    await expect(page.locator("#board")).toBeHidden();
    await page.keyboard.press("l");
    const board = page.locator("#board .bhead");
    await expect(page.locator("#board")).toBeVisible();
    const b = await board.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(43);
    await page.addStyleTag({ content: "#banner { display: none !important; }" });
    const withBoard = await boxes(page, ["#hud-centre", "#medals", "#menu", "#speed", "#board"]);
    expectNoOverlap(withBoard, viewport);
    if (paysage) expectCentreLibre(withBoard, viewport);
    await board.tap();
    await expect(page.locator("#board")).toHaveClass(/folded/);
    // Arrivée d'un tour complet (pas à pas, indépendant de la vitesse de la machine) : le panneau et ses boutons restent dans l'écran.
    await page.evaluate((n) => localStorage.setItem("cdj:name", n), "Mobile");
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    for (let guard = 0; guard < 100 && (await page.evaluate(() => window.__cdj.phase)) !== "finished"; guard++) await page.evaluate(() => window.__cdj.advance(240));
    await page.evaluate(() => window.__cdj.manual(false));
    await expect(page.locator("#finish .rank")).toContainText(/\d+(er|e) sur \d+/, { timeout: 30_000 });
    // Lot I4 : l'arrivée est un cadre plein écran (barre des jeux, étiquette) ; la page défile dans l'étiquette, chaque bouton amené à l'écran doit y tenir.
    expectNoOverlap(await boxes(page, ["#finish .dj-barre-jeu", "#finish .etiquette"]), viewport);
    for (const b of await page.locator("#finish .actions button:visible").all()) {
      await b.scrollIntoViewIfNeeded();
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
