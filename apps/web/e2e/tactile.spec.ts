import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createAutopilot, dailyCircuit, decodeReplay, parseTrack, replayRace, type RaceState } from "@cdj/sim";
import { boxes, expectNoOverlap } from "./layout";
import { fingersOf } from "./doigts";
import { newClockedContext, TODAY } from "./fixtures";

// Commandes tactiles (lot 10, refaites à la retouche 2 du lot I4 : boutons par défaut, aux bords de l'écran, zones de toucher qui épousent les boutons, plus de barre du
// bas : caméra, graphismes et plein écran sont dans la pause, point de contrôle et recommencer en haut à gauche). Gestes synthétiques envoyés par le protocole du navigateur (`Input.dispatchTouchEvent`) :
// ce sont de vrais événements tactiles, qui deviennent des « pointer events » comme sur un téléphone.
// Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

/**
 * Gabarit de téléphone (paysage). Lot R13 (docs/tests.md) : un seul, Android — il porte la vibration ; sous Chromium le gabarit « iPhone 14 » n'en différait
 * que par la taille et la densité (le jeu ne lit l'agent utilisateur que pour l'astuce de l'iPhone, testée par plein-ecran.spec.ts).
 */
const PHONES = [
  {
    name: "Android (Pixel 7)",
    viewport: { width: 851, height: 393 },
    deviceScaleFactor: 2.625,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  },
] as const;

/**
 * Un téléphone. Depuis la retouche 18b, le défaut est à deux pédales, et depuis la retouche 2 du lot I4 aux boutons ← → ; la plupart de ces tests
 * conduisent à la glissière (lot 52 : l'ancien joystick) avec l'accélérateur automatique, qu'on enregistre donc d'entrée (au premier chargement seulement : un rechargement
 * garde ce que le joueur a choisi). `fresh` : aucun réglage enregistré, c'est le vrai défaut ; `stored` : un réglage précis.
 */
async function phone(browser: Browser, p: (typeof PHONES)[number] | { viewport: { width: number; height: number } }, opts: { fresh?: boolean; stored?: object } = {}) {
  const context = await browser.newContext({ ...p, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  if (!opts.fresh) {
    const stored = JSON.stringify(opts.stored ?? { steerMode: "slider", autoThrottle: true, version: 2 });
    await page.addInitScript((value) => {
      try {
        if (localStorage.getItem("cdj:touch") === null) localStorage.setItem("cdj:touch", value);
      } catch {
        /* stockage indisponible */
      }
    }, stored);
  }
  return { context, page };
}

const racing = async (page: Page, url: string) => {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
};
const input = (page: Page) => page.evaluate(() => ({ ...window.__cdj.input }));
/** Le centre d'un bouton dessiné (là où tombe un pouce). */
const centre = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** Ouvre les réglages depuis la pause (la barre du bas n'existe plus). */
const openSettings = async (page: Page) => {
  await page.locator("#btn-pause").click();
  await page.locator("#pause-settings").click();
  await expect(page.locator("#settings")).toBeVisible();
  await page.getByRole("tab", { name: "Commandes" }).click(); // la pause ouvre l'onglet par défaut : les réglages tactiles sont dans « Commandes »
  await expect(page.locator("#page-controls")).toBeVisible();
};
/** Ferme les réglages, puis reprend la course (la pause, dont on était parti, revient dessous). */
const closeSettings = async (page: Page) => {
  await page.locator("#settings .dj-barre-jeu__retour").click();
  await expect(page.locator("#settings")).toBeHidden();
  await page.locator("#pause-resume").click();
  await expect(page.locator("#pause")).toBeHidden();
};
const polled = (page: Page, read: (i: { steer: number; throttle: number; brake: number }) => number) =>
  expect.poll(async () => read(await input(page)), { timeout: 5_000 });

for (const p of PHONES) {
  test.describe(p.name, () => {

    test("pause, reprise au point de contrôle et départ se font au toucher, et la pause fige la course", async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await racing(page, "/?debug&spec=" + encodeURIComponent("S@start S S@cp S S S S S S S@finish"));
      // Ne pas arriver pendant le test : on freine d'un doigt (l'accélérateur automatique se coupe).
      // Lot R3 : pas à pas. Tenir le frein, c'est freiner PUIS reculer (le frein sert de marche arrière) jusqu'au mur du départ, où la voiture
      // se pose à vz = +0,035 m/s, immobile (vx = 0) : vérifié en Node, la valeur exacte des deux échecs de CI (runs 38916380755, 38971947774).
      // Lue en temps réel, vz donnait « < 0,01 » pendant le recul, ou 0,035 pour toujours si la première lecture tombait après le choc :
      // la réussite dépendait de l'heure de la lecture. Ici on lit vz tous les 10 pas depuis l'appui : la voiture doit cesser d'avancer
      // (vz < 0,01) dans les 5 s de simulation, comme avant, sans dépendre de la vitesse de la machine.
      const f = await fingersOf(page);
      await page.evaluate(() => window.__cdj.manual(true));
      await f.down(2, 700, 250);
      let vz = Infinity;
      for (let i = 0; i < 60 && vz >= 0.01; i++) {
        await page.evaluate(() => window.__cdj.advance(10));
        vz = await page.evaluate(() => window.__cdj.car.vz);
      }
      expect(vz).toBeLessThan(0.01);
      expect(await input(page)).toMatchObject({ throttle: 0, brake: 64 }); // le doigt freine, l'accélérateur automatique est coupé
      await f.up(2);
      await page.evaluate(() => window.__cdj.manual(false));

      const tick = () => page.evaluate(() => window.__cdj.car.tick);
      await page.getByRole("button", { name: "Pause" }).click();
      await expect(page.locator("#pause")).toBeVisible();
      expect(await page.evaluate(() => window.__cdj.paused)).toBe(true);
      const frozen = await tick();
      await page.waitForTimeout(600);
      expect(await tick()).toBe(frozen); // rien ne bouge
      await page.locator("#pause-resume").click();
      await expect(page.locator("#pause")).toBeHidden();
      await expect.poll(tick, { timeout: 5_000 }).toBeGreaterThan(frozen + 20);

      // Retouche 2 du lot I4 : dernier point de contrôle et recommencer sont deux boutons de 44 px en haut à gauche, à côté de la pause (plus de barre du bas).
      const pauseBox = (await page.getByRole("button", { name: "Pause" }).boundingBox())!;
      for (const name of ["Recommencer au dernier point de contrôle", "Recommencer depuis le départ"]) {
        const b = (await page.getByRole("button", { name }).boundingBox())!;
        expect(b.height, name).toBeGreaterThanOrEqual(43.5);
        expect(b.width, name).toBeGreaterThanOrEqual(43.5);
        expect(b.x, name).toBeLessThan(p.viewport.width * 0.3);
        expect(b.y, name).toBeLessThan(p.viewport.height * 0.2);
        expect(Math.abs(b.y - pauseBox.y), `${name} : sur la même ligne que la pause`).toBeLessThan(8);
      }
      // Reprise au point de contrôle (bouton drapeau) : sans point franchi, c'est le départ ; le compteur de reprises monte.
      const respawns = () => page.evaluate(() => (window.__cdj.race as { respawns: number }).respawns);
      await page.getByRole("button", { name: "Recommencer au dernier point de contrôle" }).click();
      await expect.poll(respawns, { timeout: 5_000 }).toBe(1);
      // Recommencer depuis le départ (bouton ⟲) : nouveau décompte.
      await page.getByRole("button", { name: "Recommencer depuis le départ" }).click();
      await page.waitForFunction(() => window.__cdj.phase === "countdown", undefined, { timeout: 5_000 });
      await context.close();
    });

    test("réglages : boutons ← →, accélérateur manuel, gardés d'une visite à l'autre ; cibles de 44 px", { tag: "@regression" }, async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await racing(page, "/?debug&scenario=plat");
      await openSettings(page);
      await expect(page.locator("#page-controls")).toBeVisible(); // Réglages › Commandes (lot 29) ; on y arrive par la pause
      // La fenêtre figé la partie ; ses cibles font au moins 44 px.
      for (const b of await page.locator("#page-controls button:visible").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
      await page.getByRole("radio", { name: "Boutons" }).click();
      await page.getByRole("radio", { name: "Bouton gaz" }).click();
      await closeSettings(page);
      await expect(page.locator("#settings")).toBeHidden();
      await expect(page.locator("#touch .steer-left")).toBeVisible();
      await expect(page.locator("#touch .pedal-gas")).toBeVisible();

      // Accélérateur manuel : sans doigt, pas de gaz.
      await polled(page, (i) => i.throttle).toBe(0);
      const f = await fingersOf(page);
      const gas = await centre(page, "#touch .pedal-gas");
      await f.down(1, gas.x, gas.y); // le bouton GAZ
      await polled(page, (i) => i.throttle).toBe(64);
      await f.up(1);
      const brake = await centre(page, "#touch .pedal-brake");
      await f.down(1, brake.x, brake.y); // le bouton FREIN
      await polled(page, (i) => i.brake).toBe(64);
      expect((await input(page)).throttle).toBe(0);
      await f.up(1);
      // Boutons ← → : chacun sa zone, plein braquage.
      const left = await centre(page, "#touch .steer-left");
      const right = await centre(page, "#touch .steer-right");
      await f.down(2, left.x, left.y);
      await polled(page, (i) => i.steer).toBe(-64);
      await f.move(2, right.x, right.y); // on glisse du ← au →
      await polled(page, (i) => i.steer).toBe(64);
      await f.up(2);
      await polled(page, (i) => i.steer).toBe(0);

      // Gardé : un rechargement garde les réglages.
      await page.reload();
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
      await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons");
      await expect(page.locator("#touch")).toHaveAttribute("data-throttle", "manual");
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!));
      expect(saved).toMatchObject({ steerMode: "buttons", autoThrottle: false });
      await context.close();
    });

    test("mise en page : paysage, rien ne se chevauche ; boutons de menu et d'action ≥ 44 px", { tag: "@regression" }, async ({ browser }) => {
      const { context, page } = await phone(browser, p, { stored: { steerMode: "slider", autoThrottle: false, version: 2 } }); // glissière et deux pédales : tout est à l'écran
      await racing(page, "/?debug&scenario=pilotage");
      await page.addStyleTag({ content: "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }" });
      const f = await fingersOf(page);
      await f.down(1, 100, 250); // le curseur de la glissière suit le doigt
      await f.move(1, 150, 250);
      const names = ["#meta", "#timer", "#menu", "#speed", "#touch .glissiere", "#touch .pedal-brake", "#touch .pedal-gas"];
      const list = await boxes(page, names);
      expect(list.map((b) => b.name)).toEqual(expect.arrayContaining(["#timer", "#menu", "#touch .glissiere", "#touch .pedal-gas"]));
      expectNoOverlap(list, p.viewport);
      await f.up(1);
      for (const sel of ["#menu button:visible"]) {
        for (const b of await page.locator(sel).all()) {
          const box = (await b.boundingBox())!;
          expect(box.height, sel).toBeGreaterThanOrEqual(43.5);
          expect(box.width, sel).toBeGreaterThanOrEqual(43.5);
        }
      }
      // Aucun zoom ni défilement possible.
      expect(await page.evaluate(() => document.querySelector("meta[name=viewport]")!.getAttribute("content"))).toMatch(/user-scalable=no/);
      expect(await page.evaluate(() => [document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollHeight <= innerHeight])).toEqual([true, true]);
      await context.close();
    });
  });
}

test("portrait : invitation à tourner le téléphone, qu'on peut écarter ; rien ne dépasse", { tag: "@regression" }, async ({ browser }) => {
  const { context, page } = await phone(browser, { viewport: { width: 390, height: 844 } });
  await racing(page, "/?debug&scenario=plat");
  await expect(page.locator("#rotate")).toBeVisible();
  await expect(page.locator("#rotate .card")).toContainText("Tourne ton téléphone");
  const card = (await page.locator("#rotate .card").boundingBox())!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(390);
  expectNoOverlap(await boxes(page, ["#meta", "#timer", "#menu", "#speed"]), { width: 390, height: 844 });
  await page.getByRole("button", { name: "Jouer quand même" }).click();
  await expect(page.locator("#rotate")).toBeHidden();
  await context.close();
});

test("?touch=1 : sur ordinateur, la souris simule le doigt ; ?touch=0 coupe l'interface tactile", { tag: "@regression" }, async ({ page }) => {
  // Accélérateur automatique (le défaut est à deux pédales depuis la 18b) : sans doigt, plein gaz.
  await page.addInitScript(() => {
    if (localStorage.getItem("cdj:touch") === null) localStorage.setItem("cdj:touch", JSON.stringify({ steerMode: "slider", autoThrottle: true, version: 2 }));
  });
  await racing(page, "/?debug&scenario=plat&touch=1");
  expect(await page.evaluate(() => window.__cdj.touch)).toBe(true);
  await polled(page, (i) => i.throttle).toBe(64);
  await page.mouse.move(200, 400);
  await page.mouse.down();
  await page.mouse.move(250, 400);
  await polled(page, (i) => i.steer).toBeGreaterThan(20);
  await page.mouse.up();
  await polled(page, (i) => i.steer).toBe(0);
  await page.goto("/?debug&scenario=plat&touch=0");
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__cdj.touch)).toBe(false);
  await expect(page.locator("#touch")).toBeHidden();
  // Ordinateur sans option : pas de tactile.
  await page.goto("/?debug&scenario=plat");
  expect(await page.evaluate(() => window.__cdj.touch)).toBe(false);
});

test("on finit un tour au doigt : glissière pour tourner, accélérateur automatique", async ({ browser }) => {
  // Deux grands virages (rayon 48 m) : pris à pleine vitesse, ils tiennent dans l'adhérence ; il faut les tourner au doigt.
  const spec = "S@start S S S L2 S S@cp S R2 S S S@finish";
  const track = parseTrack("test", spec);
  const { context, page } = await phone(browser, PHONES[0]);
  await racing(page, "/?debug&spec=" + encodeURIComponent(spec));
  // Pas à pas : la simulation n'avance que de 10 pas (1/12 s) à chaque tour de boucle, quelle que soit la vitesse de la
  // machine. Les doigts, eux, sont de vrais événements tactiles lus par le jeu à chaque image.
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate(() => window.__cdj.advance(1));
  await page.evaluate(() => window.__cdj.advance(1));
  const f = await fingersOf(page);
  const drive = createAutopilot(track);
  // Lot 52 : la glissière est en position absolue (le curseur va sous le doigt) ; la course du pouce est celle du rail dessiné (demi-largeur moins 34 px).
  const rail = (await page.locator("#touch .glissiere").boundingBox())!;
  const X0 = rail.x + rail.width / 2;
  const RANGE = rail.width / 2 - 34;
  const DEAD = 0.08;
  await f.down(1, X0, 250);
  let last = 0;
  let lapTicks = 0;
  for (let i = 0; i < 3000; i++) {
    const s = await page.evaluate(async () => {
      await window.__cdj.advance(10);
      return { car: window.__cdj.car, phase: window.__cdj.phase };
    });
    if (s.phase === "finished") break;
    if (s.phase !== "racing") continue; // décompte
    lapTicks += 10;
    // Ce que ferait un joueur : lire la route et pousser le pouce, ici en suivant la direction du pilote automatique.
    const want = drive({ car: s.car } as unknown as RaceState).steer / 64;
    const d = want === 0 ? 0 : Math.sign(want) * RANGE * (DEAD + Math.abs(want) * (1 - DEAD));
    if (d !== last) await f.move(1, X0 + d, 250);
    last = d;
  }
  await f.up(1);
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("finished");
  expect(lapTicks).toBeLessThan(120 * 60); // moins d'une minute de jeu
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:best:test")!));
  expect(stored.ms).toBeLessThan(60_000);
  expect((await page.evaluate(() => (window.__cdj.race as { respawns: number }).respawns))).toBe(0); // sans sortie de route
  expect(replayRace(track, decodeReplay(stored.replay)).finishMs).toBe(stored.ms);
  await context.close();
});

test("vibration au point de contrôle et au choc, désactivable", { tag: "@regression" }, async ({ browser }) => {
  const { context, page } = await phone(browser, PHONES[0]);
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vibrations: unknown[] }).__vibrations = calls;
    navigator.vibrate = (pattern) => (calls.push(pattern), true);
  });
  // Tout droit dans un virage : point de contrôle, puis choc contre le rebord extérieur.
  await racing(page, "/?debug&spec=" + encodeURIComponent("S@start S S@cp S S R S S@finish"));
  // Point de contrôle (25 ms), puis choc contre le rebord extérieur (40 ms, éventuellement plusieurs fois en longeant le rebord).
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations.slice()), { timeout: 60_000 })
    .toEqual(expect.arrayContaining([25, 40]));
  const calls = (await page.evaluate(() => (window as unknown as { __vibrations: number[] }).__vibrations)) as number[];
  expect(calls[0]).toBe(25);
  await context.close();

  // Désactivée dans les réglages : aucune vibration.
  const second = await phone(browser, PHONES[0], { stored: { vibration: false, autoThrottle: true, version: 2 } });
  await second.page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vibrations: unknown[] }).__vibrations = calls;
    navigator.vibrate = (pattern) => (calls.push(pattern), true);
  });
  await racing(second.page, "/?debug&spec=" + encodeURIComponent("S@start S S@cp S S R S S@finish"));
  await second.page.waitForFunction(() => window.__cdj.race && (window.__cdj.race as { splits: number[] }).splits.length >= 1, undefined, { timeout: 30_000 });
  await second.page.waitForTimeout(3_000);
  expect(await second.page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations)).toEqual([]);
  await second.context.close();
});

// Chaque bouton dessiné doit être entièrement « chaud » : toucher son centre ou l'un de ses coins déclenche la commande
// qu'il annonce (et pas celle du voisin). Les zones tactiles sont des fractions de l'écran ; si le dessin ne les suit pas,
// une partie du bouton déclenche le mauvais bouton (défaut vu sur téléphone en paysage).
const COMBOS = [
  { steerMode: "slider", autoThrottle: true },
  { steerMode: "wheel", autoThrottle: false },
  { steerMode: "buttons", autoThrottle: false, mirrored: true },
  { steerMode: "buttons", autoThrottle: true },
  { steerMode: "buttons", autoThrottle: false },
  { steerMode: "slider", autoThrottle: false },
] as const;
const SCREENS = [
  // Lot R13 : le téléphone en paysage seulement (en portrait, la course n'affiche que l'invitation à tourner le téléphone : test « portrait » ci-dessus).
  { name: "paysage Android", viewport: { width: 851, height: 393 } },
] as const;

for (const screen of SCREENS) {
  test(`zones tactiles = boutons dessinés : ${screen.name}`, async ({ browser }) => {
    const { context, page } = await phone(browser, { viewport: screen.viewport });
    const wrong: string[] = [];
    let first = true;
    for (const combo of COMBOS) {
      await page.addInitScript((c) => localStorage.setItem("cdj:touch", JSON.stringify(c)), combo);
      await racing(page, first ? "/?debug&scenario=plat" : "/?debug&scenario=plat&r=" + Math.random());
      first = false;
      await page.evaluate(() => window.__cdj.manual(true)); // pas à pas : on lit la commande juste après le toucher, sans attendre
      await page.getByRole("button", { name: "Jouer quand même" }).click({ timeout: 500 }).catch(() => undefined); // portrait : invitation
      const f = await fingersOf(page);
      const expected: Record<string, (i: { steer: number; throttle: number; brake: number }) => boolean> = {
        "steer-left": (i) => i.steer === -64,
        "steer-right": (i) => i.steer === 64,
        "pedal-brake": (i) => i.brake === 64,
        "pedal-gas": (i) => i.throttle === 64 && i.brake === 0,
      };
      for (const [cls, ok] of Object.entries(expected)) {
        const el = page.locator(`#touch .${cls}`);
        if (!(await el.isVisible())) continue;
        const b = (await el.boundingBox())!;
        const m = 6; // un doigt n'est pas au pixel près : on teste le centre et les coins, rentrés de 6 px
        const points = [
          [b.x + b.width / 2, b.y + b.height / 2],
          [b.x + m, b.y + m],
          [b.x + b.width - m, b.y + m],
          [b.x + m, b.y + b.height - m],
          [b.x + b.width - m, b.y + b.height - m],
        ] as const;
        for (const [x, y] of points) {
          await f.down(1, x, y);
          await page.evaluate(() => window.__cdj.advance(1));
          const got = await input(page);
          if (!ok(got)) wrong.push(`${combo.steerMode}/${combo.autoThrottle ? "auto" : "manuel"} : ${cls} touché en (${Math.round(x)}, ${Math.round(y)}) → ${JSON.stringify(got)}`);
          await f.up(1);
          await page.evaluate(() => window.__cdj.advance(1));
        }
      }
    }
    expect(wrong, `commandes inattendues sur ${screen.name}`).toEqual([]);
    await context.close();
  });
}

// Constantes de la charte rév. 7 (touch.ts : `EDGE_MARGIN_PX`, `CENTER_FREE`) ; le spec ne les importe pas (e2e/tsconfig.json ne liste pas `src/`), un test unitaire les vérifie.
const EDGE_MARGIN_PX = 12;
const CENTER_FREE = { x0: 0.3, x1: 0.7 } as const;
type Zone = "left" | "right" | "brake" | "gas";

// --- Retouche 10b (zones de toucher en paysage), refaite à la retouche 2 du lot I4 --------------------------------------------------
// Les zones du mode boutons ne sont plus quatre quarts de la largeur : chaque zone **épouse son bouton dessiné** (← de 0 à la frontière entre les deux flèches, → un peu
// au-delà de la flèche, frein et gaz de même jusqu'au bord droit), sur toute la hauteur, et **le milieu de l'écran n'a aucune zone**. Les zones attendues se déduisent des boutons
// dessinés (lus dans la page) ; `touch.test.ts` vérifie la définition elle-même (`zoneSpans`) sur d'autres écrans.
type Cmd = { steer: number; throttle: number; brake: number };
const COMMANDES: Record<Zone, (i: Cmd) => boolean> = {
  left: (i) => i.steer === -64,
  right: (i) => i.steer === 64,
  brake: (i) => i.brake === 64 && i.throttle === 0,
  gas: (i) => i.throttle === 64 && i.brake === 0,
};
async function settle(page: Page, ok: (i: Cmd) => boolean): Promise<Cmd> {
  let got = await input(page);
  for (let n = 0; n < 20 && !ok(got); n++) {
    await page.waitForTimeout(50);
    await page.evaluate(() => window.__cdj.advance(1));
    got = await input(page);
  }
  return got;
}
const BUTTONS_URL = "/?debug&scenario=plat&touch=1&steer=boutons&r=";
const NOM = { left: "←", right: "→", brake: "frein", gas: "gaz" } as const;

for (const p of PHONES) {
  test.describe(`${p.name} — zones 10b`, () => {
    test("un appui en n'importe quel point de chaque zone (coins à 8 px du bord compris) déclenche la bonne commande ; au milieu, aucune", { tag: "@regression" }, async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      const reglage = { steerMode: "buttons", autoThrottle: false };
      await page.addInitScript((r) => localStorage.setItem("cdj:touch", JSON.stringify(r)), reglage);
      await racing(page, BUTTONS_URL + Math.random());
      await page.evaluate(() => window.__cdj.manual(true));
      const { width: W, height: H } = p.viewport;
      const f = await fingersOf(page);
      const wrong: string[] = [];
      const m = 8;
      // Les petits boutons du HUD (pause, point de contrôle, recommencer, rang) attirent les appuis voisins (le navigateur corrige le toucher vers eux, ~12 px) : on ne
      // teste pas sous leurs doigts.
      const hudButtons = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button")]
          .filter((b) => !b.closest("#touch, .voile, .cadre") && b.getClientRects().length > 0)
          .map((b) => b.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }),
      );
      const nearButton = (x: number, y: number) => hudButtons.some((b) => x > b.x - 14 && x < b.x + b.width + 14 && y > b.y - 14 && y < b.y + b.height + 14);
      // Zones attendues, déduites des boutons dessinés : chaque zone va du bord (ou de la frontière avec son voisin, au milieu de l'écart) au bord du bouton + 14 px côté centre.
      const rect = async (cls: string) => (await page.locator(`#touch .${cls}`).boundingBox())!;
      const [bl, br, bb, bg] = [await rect("steer-left"), await rect("steer-right"), await rect("pedal-brake"), await rect("pedal-gas")];
      const spans: { zone: Zone; x0: number; x1: number }[] = [
        { zone: "left", x0: 0, x1: (bl.x + bl.width + br.x) / 2 },
        { zone: "right", x0: (bl.x + bl.width + br.x) / 2, x1: br.x + br.width + 14 },
        { zone: "brake", x0: bb.x - 14, x1: (bb.x + bb.width + bg.x) / 2 },
        { zone: "gas", x0: (bb.x + bb.width + bg.x) / 2, x1: W },
      ];
      for (const sp of spans) {
        const x0 = sp.x0;
        const x1 = sp.x1;
        // les bords entre deux zones sont exacts : on reste à 2 px de chaque côté de la frontière intérieure ; les bords de l'écran à 8 px
        const xs = [sp.x0 === 0 ? m : x0 + 2, (x0 + x1) / 2, sp.x1 === W ? W - m : x1 - 2];
        const ys = [m, H * 0.25, H * 0.5, H * 0.75, H - m];
        for (const x of xs) {
          for (const y of ys) {
            if (nearButton(x, y)) continue;
            await f.down(1, x, y);
            // l'événement tactile arrive au jeu un peu après le retour du protocole : on avance pas à pas jusqu'à le voir (≤ 1 s)
            const ok = COMMANDES[sp.zone];
            const got = await settle(page, ok);
            if (!ok(got)) {
              const under = await page.evaluate(([px, py]) => { const t = document.elementFromPoint(px!, py!); return t ? `${t.tagName}#${t.id}.${t.className}` : "rien"; }, [x, y]);
              wrong.push(`${NOM[sp.zone]} touché en (${Math.round(x)}, ${Math.round(y)}) sous ${under} → ${JSON.stringify(got)}`);
            }
            await f.up(1);
            await page.evaluate(() => window.__cdj.advance(1));
          }
        }
      }
      // Le milieu de l'écran, entre les deux groupes de boutons : aucune commande, à toute hauteur.
      for (const x of [W * 0.4, W * 0.5, W * 0.6]) {
        for (const y of [m, H * 0.25, H * 0.5, H * 0.75, H - m]) {
          if (nearButton(x, y)) continue;
          await f.down(1, x, y);
          await page.evaluate(() => window.__cdj.advance(2));
          const got = await input(page);
          if (got.steer !== 0 || got.throttle !== 0 || got.brake !== 0) wrong.push(`milieu touché en (${Math.round(x)}, ${Math.round(y)}) → ${JSON.stringify(got)}`);
          await f.up(1);
          await page.evaluate(() => window.__cdj.advance(1));
        }
      }
      expect(wrong).toEqual([]);
      await context.close();
    });

    test("aucun point de la moitié basse de l'écran de jeu n'est hors zone (la couche tactile reçoit le toucher partout)", { tag: "@regression" }, async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await page.addInitScript(() => localStorage.setItem("cdj:touch", JSON.stringify({ steerMode: "buttons", autoThrottle: false })));
      await racing(page, BUTTONS_URL + Math.random());
      const { width: W, height: H } = p.viewport;
      const holes = await page.evaluate(
        ({ W, H }) => {
          const bad: string[] = [];
          for (let x = 4; x < W; x += 20) {
            for (let y = Math.floor(H / 2); y < H; y += 12) {
              const t = document.elementFromPoint(x, y);
              // les petits boutons du HUD (pause, actions de course) reçoivent leur propre toucher : seuls eux ont le droit d'être là
              if (!t || (!t.closest("#touch") && !t.closest("button"))) bad.push(`(${x}, ${y}) → ${t?.id || t?.tagName}`);
            }
          }
          return bad;
        },
        { W, H },
      );
      expect(holes).toEqual([]);
      await context.close();
    });

    test("glisser de ← à → sans lever le doigt change la direction ; diriger et accélérer en même temps", async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await page.addInitScript(() => localStorage.setItem("cdj:touch", JSON.stringify({ steerMode: "buttons", autoThrottle: false })));
      await racing(page, BUTTONS_URL + Math.random());
      await page.evaluate(() => window.__cdj.manual(true));
      const f = await fingersOf(page);
      const step = async () => {
        await page.evaluate(() => window.__cdj.advance(1));
        return input(page);
      };
      const left = await centre(page, "#touch .steer-left");
      const right = await centre(page, "#touch .steer-right");
      const gas = await centre(page, "#touch .pedal-gas");
      const brake = await centre(page, "#touch .pedal-brake");
      await f.down(1, left.x, left.y);
      expect((await step()).steer).toBe(-64);
      await f.move(1, right.x, right.y);
      expect((await step()).steer).toBe(64);
      await f.move(1, left.x, left.y);
      expect((await step()).steer).toBe(-64);
      // second doigt sur le gaz : on dirige et on accélère en même temps ; glisser du gaz au frein change la pédale
      await f.down(2, gas.x, gas.y);
      let i = await step();
      expect(i.steer).toBe(-64);
      expect(i.throttle).toBe(64);
      await f.move(2, brake.x, brake.y);
      i = await step();
      expect(i).toMatchObject({ steer: -64, brake: 64, throttle: 0 });
      await context.close();
    });

    test("?zones=1 dessine les zones et un point par doigt, de la couleur de la zone ; gris au milieu, rouge hors de la zone de jeu", { tag: "@regression" }, async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await racing(page, "/?debug&scenario=plat&touch=1&steer=boutons&zones=1&r=" + Math.random());
      await expect(page.locator("#touch .zspan")).toHaveCount(3); // ←, →, frein (accélérateur automatique)
      const f = await fingersOf(page);
      await f.down(1, 40, 200);
      await expect(page.locator(".fdot")).toHaveCount(1);
      expect(await page.locator(".fdot").evaluate((e) => (e as HTMLElement).style.background)).toContain("76, 201, 240"); // couleur de ←
      await f.up(1);
      await expect(page.locator(".fdot")).toHaveCount(0);
      // le milieu de l'écran n'a aucune zone : point gris
      await f.down(1, p.viewport.width * 0.5, 200);
      expect(await page.locator(".fdot").evaluate((e) => (e as HTMLElement).style.background)).toContain("154, 160, 166");
      await f.up(1);
      // un doigt sur un bouton du HUD (hors zone de jeu) : point rouge
      const b = (await page.getByRole("button", { name: "Pause" }).boundingBox())!;
      await f.down(2, b.x + b.width / 2, b.y + b.height / 2);
      expect(await page.locator(".fdot").evaluate((e) => (e as HTMLElement).style.background)).toContain("229, 50, 45");
      await f.up(2);
      await context.close();
    });

    test("taille des boutons : réglage mémorisé, boutons plus grands, toujours aux bords ; ?steer= force le mode", { tag: "@regression" }, async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await racing(page, BUTTONS_URL + Math.random());
      await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons"); // forcé par ?steer=boutons
      const width = async () => (await page.locator("#touch .steer-left").boundingBox())!.width;
      const medium = await width();
      await openSettings(page);
      await page.getByRole("radio", { name: "Grands" }).click();
      await closeSettings(page);
      expect(await width()).toBeGreaterThan(medium);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!).buttonSize)).toBe("large");
      await openSettings(page);
      await page.getByRole("radio", { name: "Petits" }).click();
      await closeSettings(page);
      expect(await width()).toBeLessThan(medium);
      // le visuel respecte les marges des bords
      const b = (await page.locator("#touch .steer-left").boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(EDGE_MARGIN_PX - 0.5);
      await context.close();
    });
  });
}

// --- Lot 52 : glissière, volant, gyroscope -------------------------------------------------------------------------------------------------------------------------
// Les quatre façons de tourner sur téléphone : Boutons (inchangé, ci-dessus), Glissière, Volant, Gyroscope. Chacune donne la même direction analogique (−64 à 64) : la simulation, la
// rediffusion et le classement ne changent pas. Doigts : de vrais évènements tactiles (`Input.dispatchTouchEvent`, e2e/doigts.ts) ; capteur : des évènements `deviceorientation`
// simulés par la page (un minuteur de 16 ms, comme un téléphone). Les calculs (doigt → direction, angle, calibrage, filtrage) sont des tests unitaires (`test/steer*.test.ts`) : ici, le
// parcours du joueur dans le vrai jeu. **Famille « Régression »** : la CI de PR de Track n'a plus de marge dans son budget de 900 s de specs (`ciZones.test.ts` : moins de 3 s), et un
// nouveau spec demanderait une ligne dans `e2e/zones.json` (zone de la plateforme) ; ces tests tournent la nuit et par « Run workflow » (ou `npm run verifier -- --regression`).
const API = "http://127.0.0.1:8787";
/** Un vrai départ (il y a un décompte, et « recommencer » en relance un), sur une ligne droite assez longue pour tout un test. */
const LIGNE_DROITE = "S@start " + "S ".repeat(200) + "S@finish";
const TELEPHONE = {
  viewport: { width: 851, height: 393 },
  deviceScaleFactor: 2.625,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  isMobile: true,
  hasTouch: true,
} as const;

const ouverts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(ouverts.splice(0).map((c) => c.close().catch(() => undefined)));
});

type Reglage = { steerMode: string; autoThrottle?: boolean; wheelAngle?: number; mirrored?: boolean };

/**
 * `capteur` : « ok » (Android : aucune demande, le capteur répond), « muet » (aucun évènement), « ios » et « refuse » (iPhone : `requestPermission` n'aboutit qu'au geste du
 * joueur, sinon elle est rejetée ; accordée dans le premier cas, refusée dans le second).
 */
async function telephone(browser: Browser, reglage: Reglage | null, capteur?: "ok" | "muet" | "ios" | "refuse") {
  const context = await newClockedContext(browser, TELEPHONE);
  ouverts.push(context);
  const page = await context.newPage();
  await page.addInitScript(
    ({ reglage, capteur }) => {
      // `cdj:touch` est écrit une fois, au premier chargement : un rechargement garde ce que le joueur a choisi.
      if (reglage && localStorage.getItem("cdj:touch") === null) localStorage.setItem("cdj:touch", JSON.stringify({ autoThrottle: true, ...reglage, version: 2 }));
      const w = window as unknown as { __gyro: { beta: number; gamma: number }; __angle: number };
      w.__gyro = { beta: 0, gamma: -90 }; // paysage, haut du téléphone à gauche (angle 90), téléphone droit
      w.__angle = 90;
      Object.defineProperty(screen.orientation, "angle", { get: () => w.__angle, configurable: true });
      // Comme Safari : la demande n'aboutit que pendant la seconde qui suit un vrai toucher (un clic), sinon elle est rejetée sans rien afficher.
      let geste = false;
      for (const e of ["touchend", "pointerup", "click"]) addEventListener(e, () => { geste = true; setTimeout(() => (geste = false), 1000); }, true);
      const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      D.requestPermission = capteur === "ios" || capteur === "refuse" ? () => (geste ? Promise.resolve(capteur === "ios" ? "granted" : "denied") : Promise.reject(new DOMException("geste", "NotAllowedError"))) : undefined;
      if (capteur === "ok" || capteur === "ios" || capteur === "refuse") setInterval(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: w.__gyro.beta, gamma: w.__gyro.gamma })), 16);
    },
    { reglage, capteur },
  );
  return { context, page };
}
/** Incline le « téléphone » de `deg` degrés vers la droite de l'écran, dans le paysage voulu (90 ou 270 : ce que dit `screen.orientation.angle`). */
const incliner = (page: Page, deg: number, paysage: 90 | 270 = 90) =>
  page.evaluate(([d, a]) => {
    const w = window as unknown as { __gyro: { beta: number; gamma: number }; __angle: number };
    w.__angle = a;
    w.__gyro = a === 90 ? { beta: d, gamma: -90 } : { beta: -d, gamma: 90 };
  }, [deg, paysage] as const);
const sonde = (page: Page, lire: (i: { steer: number; throttle: number; brake: number }) => number) => expect.poll(async () => lire(await input(page)), { timeout: 8_000 });
const boite = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};

test.describe("glissière", () => {
  test("un pouce la fait glisser, la voiture tourne ; un ancien « joystick » est la glissière ; gaz et frein en même temps", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "drag", autoThrottle: false });
    await racing(page, "/?debug&scenario=plat");
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "slider"); // l'ancien choix « joystick » (drag) est devenu la glissière
    const rail = await boite(page, "#touch .glissiere");
    expect(rail.x - rail.w / 2).toBeLessThan(851 * 0.1); // au bord gauche, jamais devant la voiture
    expect(rail.x + rail.w / 2).toBeLessThan(851 * 0.3);
    const course = rail.w / 2 - 34;
    const f = await fingersOf(page);
    await f.down(1, rail.x, rail.y);
    await sonde(page, (i) => i.steer).toBe(0);
    await f.move(1, rail.x + course, rail.y - 150); // au bout du rail, et bien au-dessus : la hauteur ne compte pas, le doigt ne lâche pas
    await sonde(page, (i) => i.steer).toBe(64);
    await f.move(1, rail.x - course / 2, rail.y);
    await sonde(page, (i) => i.steer).toBeLessThan(-20);
    // plusieurs doigts : on dirige, on accélère, puis on freine, sans lâcher la glissière
    const gas = await boite(page, "#touch .pedal-gas");
    const brake = await boite(page, "#touch .pedal-brake");
    await f.down(2, gas.x, gas.y);
    await sonde(page, (i) => i.throttle).toBe(64);
    await f.move(2, brake.x, brake.y);
    await sonde(page, (i) => i.brake).toBe(64);
    expect((await input(page)).steer).toBeLessThan(-20);
    await f.up(2);
    await f.up(1);
    await sonde(page, (i) => i.steer).toBe(0); // au lâcher, retour au centre
    await expect(page.locator("#touch .glissiere__curseur")).not.toHaveClass(/on/);
  });
});

test.describe("volant", () => {
  test("on le tourne au doigt, autour de son centre : butoir, doigt hors de la jante, retour au centre", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "wheel", autoThrottle: false });
    await racing(page, "/?debug&scenario=plat");
    const roue = await boite(page, "#touch .volant");
    expect(roue.x - roue.w / 2).toBeLessThan(851 * 0.1);
    expect(roue.x + roue.w / 2).toBeLessThan(851 * 0.3); // jamais devant la voiture
    const sur = (deg: number, rayon: number) => ({ x: roue.x + rayon * Math.sin((deg * Math.PI) / 180), y: roue.y - rayon * Math.cos((deg * Math.PI) / 180) });
    const f = await fingersOf(page);
    // Pris à 3 h : pas de saut ; tourné de 45° vers le haut puis vers la droite : la direction suit l'angle balayé.
    await f.down(1, sur(90, 50).x, sur(90, 50).y);
    await sonde(page, (i) => i.steer).toBe(0);
    for (const deg of [100, 120, 135]) await f.move(1, sur(deg, 50).x, sur(deg, 50).y); // 45° balayés
    await sonde(page, (i) => i.steer).toBeGreaterThan(20);
    await sonde(page, (i) => i.steer).toBeLessThan(44);
    expect(await page.locator("#touch .volant__roue").evaluate((e) => (e as SVGElement).style.transform)).toMatch(/rotate\(4[0-9.]*deg\)/);
    // Butoir à 90° : on balaie beaucoup plus, la direction reste 64 ; le doigt sort de la jante et de l'écran, elle ne lâche pas.
    for (const deg of [150, 180, 210, 240]) await f.move(1, sur(deg, 400).x, Math.min(sur(deg, 400).y, 380));
    await sonde(page, (i) => i.steer).toBe(64);
    // Plusieurs doigts : le gaz en même temps que le volant.
    const gas = await boite(page, "#touch .pedal-gas");
    await f.down(2, gas.x, gas.y);
    await sonde(page, (i) => i.throttle).toBe(64);
    await sonde(page, (i) => i.steer).toBe(64);
    await f.up(2);
    await f.up(1);
    await sonde(page, (i) => i.steer).toBe(0); // retour au centre
    await expect(page.locator("#touch .volant")).not.toHaveClass(/on/);
  });

  test("aucun conflit avec la pause, le point de contrôle et recommencer ; la pause lève les doigts posés", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "wheel", autoThrottle: false });
    await racing(page, "/?debug&spec=" + encodeURIComponent(LIGNE_DROITE)); // un vrai départ : « recommencer » relance un décompte
    const roue = await boite(page, "#touch .volant");
    const sur = (deg: number, rayon: number) => ({ x: roue.x + rayon * Math.sin((deg * Math.PI) / 180), y: roue.y - rayon * Math.cos((deg * Math.PI) / 180) });
    const f = await fingersOf(page);
    // Leurs boutons sont au-dessus de la zone du volant (le toucher d'un de ces points va au bouton, pas au volant), même quand la zone de direction passe derrière eux.
    for (const nom of ["Pause", "Recommencer au dernier point de contrôle", "Recommencer depuis le départ"]) {
      const c = (await page.getByRole("button", { name: nom }).boundingBox())!;
      expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest("button")?.getAttribute("aria-label"), [c.x + c.width / 2, c.y + c.height / 2] as const), nom).toBe(nom);
    }
    // La pause lève les doigts posés : un doigt tenu sur le volant au moment de la pause ne reste pas « posé » dessous.
    await f.down(1, sur(0, 50).x, sur(0, 50).y);
    for (const deg of [30, 60, 90]) await f.move(1, sur(deg, 50).x, sur(deg, 50).y);
    await sonde(page, (i) => i.steer).toBeGreaterThan(30);
    await page.getByRole("button", { name: "Pause" }).tap();
    await expect(page.locator("#pause")).toBeVisible();
    await page.locator("#pause-resume").tap();
    await expect(page.locator("#pause")).toBeHidden();
    await sonde(page, (i) => i.steer).toBe(0);
    await f.up(1);
    await page.getByRole("button", { name: "Recommencer depuis le départ" }).tap();
    await page.waitForFunction(() => window.__cdj.phase === "countdown", undefined, { timeout: 5_000 });
  });

  test("butoir à 135° : la même course de doigt braque moins, jusqu'au bout", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "wheel", wheelAngle: 135 });
    await racing(page, "/?debug&scenario=plat");
    const roue = await boite(page, "#touch .volant");
    const sur = (deg: number) => ({ x: roue.x + 50 * Math.sin((deg * Math.PI) / 180), y: roue.y - 50 * Math.cos((deg * Math.PI) / 180) });
    const f = await fingersOf(page);
    await f.down(1, sur(0).x, sur(0).y);
    for (const deg of [30, 60, 90]) await f.move(1, sur(deg).x, sur(deg).y);
    await sonde(page, (i) => i.steer).toBeGreaterThan(30); // 90° sur 135° : les deux tiers
    await sonde(page, (i) => i.steer).toBeLessThan(50);
    for (const deg of [120, 150, 180, 210]) await f.move(1, sur(deg).x, sur(deg).y);
    await sonde(page, (i) => i.steer).toBe(64);
    await f.up(1);
  });
});

test.describe("gyroscope", () => {
  test("incliner le téléphone tourne la voiture : calage au décompte, les deux paysages, « recentrer » depuis la pause", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "gyro" }, "ok");
    await page.goto("/?debug&spec=" + encodeURIComponent(LIGNE_DROITE));
    await page.waitForFunction(() => window.__cdj?.phase === "countdown", undefined, { timeout: 30_000 });
    await page.waitForTimeout(400);
    await incliner(page, 12); // le joueur tient le téléphone à 12° : c'est sa position neutre, prise à la fin du décompte
    await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 20_000 });
    await expect(page.locator(".gyro-jauge--course")).toBeVisible(); // la jauge d'inclinaison, à côté de la vitesse
    await sonde(page, (i) => i.steer).toBe(0); // sans calage, 12° donneraient déjà un tiers de braquage
    await incliner(page, 12 + 35);
    await sonde(page, (i) => i.steer).toBe(64);
    await incliner(page, 12 - 35);
    await sonde(page, (i) => i.steer).toBe(-64);
    await incliner(page, 12 + 17);
    await sonde(page, (i) => i.steer).toBeGreaterThan(20);
    await sonde(page, (i) => i.steer).toBeLessThan(44);
    // L'autre paysage : la même pose réelle donne le même sens (gamma +90 et beta de signe contraire).
    await incliner(page, 12 + 35, 270);
    await sonde(page, (i) => i.steer).toBe(64);
    await incliner(page, 12 - 35, 270);
    await sonde(page, (i) => i.steer).toBe(-64);
    // Les deux pouces restent libres pour les pédales : le frein à gauche, le gaz à droite (sans gaz automatique, deux pédales).
    await incliner(page, 12);
    await page.getByRole("button", { name: "Pause" }).tap();
    await expect(page.locator("#pause-recentrer")).toBeVisible();
    await incliner(page, 40); // le joueur repose le téléphone plus incliné, puis « Recentrer »
    await page.locator("#pause-recentrer").tap();
    await expect(page.locator("#pause-recentrer")).toBeDisabled(); // 1,5 s : le temps de reposer le téléphone
    await expect(page.locator("#pause-recentrer")).toBeEnabled({ timeout: 5_000 });
    await page.locator("#pause-resume").tap();
    await sonde(page, (i) => i.steer).toBe(0); // 40° est devenu le « tout droit »
    await incliner(page, 40 + 35);
    await sonde(page, (i) => i.steer).toBe(64);
  });

  test("le frein à gauche et le gaz à droite se tiennent en même temps que l'inclinaison", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "gyro", autoThrottle: false }, "ok");
    await racing(page, "/?debug&scenario=plat");
    const frein = await boite(page, "#touch .pedal-brake");
    const gaz = await boite(page, "#touch .pedal-gas");
    expect(frein.x).toBeLessThan(851 * 0.3);
    expect(gaz.x).toBeGreaterThan(851 * 0.7);
    const f = await fingersOf(page);
    await f.down(1, frein.x, frein.y);
    await f.down(2, gaz.x, gaz.y);
    await incliner(page, 30);
    await sonde(page, (i) => i.brake).toBe(64);
    await sonde(page, (i) => i.throttle).toBe(64);
    await sonde(page, (i) => i.steer).toBeGreaterThan(20);
  });

  test("iPhone : la demande d'autorisation attend le premier toucher ; accordée, l'inclinaison tourne la voiture", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "gyro" }, "ios");
    await racing(page, "/?debug&scenario=plat");
    await expect(page.locator("#page-controls")).toHaveCount(1); // (le réglage n'est pas ouvert : la carte « Autoriser » est dans Réglages › Commandes)
    await incliner(page, 30);
    await expect(page.locator(".gyro-jauge--course")).toHaveAttribute("data-capteur", "attente"); // rien n'est autorisé : le capteur n'est pas écouté
    await sonde(page, (i) => i.steer).toBe(0);
    await page.locator("body").tap({ position: { x: 425, y: 200 } }); // le premier toucher est le geste : la fenêtre du système (ici accordée)
    await expect(page.locator(".gyro-jauge--course")).toHaveAttribute("data-capteur", "ok");
    await incliner(page, 30 + 35); // le neutre était la première mesure, à 30°
    await sonde(page, (i) => i.steer).toBeGreaterThan(40);
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "gyro");
  });

  test("autorisation refusée : un message clair, et le jeu reprend le mode d'avant", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "gyro" }, "refuse");
    await racing(page, "/?debug&scenario=plat");
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "gyro"); // en attente : sur iPhone, la demande se fait au geste du joueur
    await page.locator("body").tap({ position: { x: 425, y: 200 } }); // le premier toucher est le geste
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons", { timeout: 8_000 });
    await expect(page.locator("#banner")).toContainText("Gyroscope refusé. Retour au mode Boutons."); // même avec le gaz automatique : le message ne s'efface pas à la première seconde
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!).steerMode)).toBe("buttons");
    await expect(page.locator("#touch .steer-left")).toBeVisible(); // les flèches sont revenues
    // Dans Réglages › Commandes, la carte dit pourquoi et comment l'autoriser plus tard.
    await page.getByRole("button", { name: "Pause" }).tap();
    await page.locator("#pause-settings").tap();
    await page.getByRole("tab", { name: "Commandes" }).tap();
    await expect(page.locator("#page-controls .gyro-carte--refus")).toContainText("Gyroscope refusé. Retour au mode Boutons.");
    await expect(page.getByRole("radio", { name: "Boutons" })).toHaveAttribute("aria-checked", "true");
  });

  test("capteur absent : le jeu le dit et reprend le mode d'avant, sans jamais rester sur un mode qui ne tourne pas", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, { steerMode: "gyro" }, "muet");
    await racing(page, "/?debug&scenario=plat");
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons");
    await page.getByRole("button", { name: "Pause" }).tap();
    await page.locator("#pause-settings").tap();
    await page.getByRole("tab", { name: "Commandes" }).tap();
    await expect(page.locator("#page-controls .gyro-carte--refus")).toContainText("Ce téléphone n'a pas de capteur d'inclinaison utilisable. Retour au mode Boutons.");
  });
});

test.describe("modes chargés à la demande", () => {
  test("les boutons ne chargent aucun mode ; la glissière, le volant et le gyroscope se chargent quand on les choisit", { tag: "@regression" }, async ({ browser }) => {
    const { page } = await telephone(browser, null, "ok");
    const chargees = new Set<string>();
    page.on("request", (r) => {
      const m = /\/assets\/(steer\w+)-[\w-]+\.js/.exec(r.url());
      if (m) chargees.add(m[1]!);
    });
    await racing(page, "/?debug&scenario=plat");
    await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons");
    expect([...chargees]).toEqual([]); // par défaut : aucun module de direction dans le premier chargement
    await page.getByRole("button", { name: "Pause" }).tap();
    await page.locator("#pause-settings").tap();
    await page.getByRole("tab", { name: "Commandes" }).tap();
    await page.getByRole("radio", { name: "Volant" }).tap();
    await expect(page.locator("#touch .volant")).toHaveCount(1);
    expect([...chargees].sort()).toEqual(["steerMath", "steerWheel"]);
    await expect(page.getByText("Angle maximal")).toBeVisible(); // les réglages du volant viennent avec lui
    await page.getByRole("radio", { name: "Glissière" }).tap();
    await expect(page.locator("#touch .glissiere")).toHaveCount(1);
    await expect(page.locator("#touch .volant")).toHaveCount(0);
    await page.getByRole("radio", { name: "Gyroscope" }).tap();
    await expect(page.locator(".gyro-jauge--course")).toHaveCount(1);
    await expect(page.locator("#page-controls .gyro-carte--ok")).toBeVisible({ timeout: 8_000 }); // Android : aucune demande, le capteur répond
    expect([...chargees].sort()).toEqual(["steerGyro", "steerMath", "steerSlider", "steerWheel"]);
    await page.getByRole("radio", { name: "Boutons" }).tap();
    await expect(page.locator(".gyro-jauge--course")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!).steerMode)).toBe("buttons");
    // L'inversion gauche / droite : les pédales passent à gauche, les flèches à droite.
    await page.getByRole("radio", { name: "Oui" }).first().tap();
    await expect.poll(async () => (await boite(page, "#touch .pedal-gas")).x).toBeLessThan(851 * 0.3);
    expect((await boite(page, "#touch .steer-left")).x).toBeGreaterThan(851 * 0.7);
  });
});

test.describe("une course au volant, rejouée par le serveur", () => {
  test("jouée au volant, rejouée par le serveur : le même temps", { tag: "@regression" }, async ({ browser }) => {
    test.setTimeout(300_000);
    const circuit = dailyCircuit(TODAY);
    const { page } = await telephone(browser, { steerMode: "wheel", autoThrottle: false });
    await page.goto(`/?debug&api=${encodeURIComponent(API)}`);
    await page.waitForFunction(() => window.__cdj?.phase === "racing" || window.__cdj?.phase === "countdown", undefined, { timeout: 30_000 });
    await page.evaluate(() => window.__cdj.manual(true));
    await page.waitForFunction(() => window.__cdj.input !== undefined);
    const roue = await boite(page, "#touch .volant");
    const gaz = await boite(page, "#touch .pedal-gas");
    const frein = await boite(page, "#touch .pedal-brake");
    const sur = (deg: number) => ({ x: roue.x + 55 * Math.sin((deg * Math.PI) / 180), y: roue.y - 55 * Math.cos((deg * Math.PI) / 180) });
    const f = await fingersOf(page);
    const pilote = createAutopilot(circuit.track);
    await f.down(1, sur(0).x, sur(0).y);
    await f.down(2, gaz.x, gaz.y);
    let angle = 0;
    let freine = false;
    for (let i = 0; i < 6000; i++) {
      const s = await page.evaluate(async () => {
        await window.__cdj.advance(10);
        return { car: window.__cdj.car, phase: window.__cdj.phase };
      });
      if (s.phase === "finished") break;
      if (s.phase !== "racing") continue; // décompte
      // Ce que ferait un joueur : lire la route et tourner le volant (le doigt balaie l'angle voulu, 90° au butoir) ; le gaz tenu, le frein quand il le faut.
      const veut = pilote({ car: s.car } as unknown as RaceState);
      const v = veut.steer / 64;
      const voulu = v === 0 ? 0 : Math.sign(v) * 90 * (0.06 + Math.abs(v) * (1 - 0.06));
      if (Math.abs(voulu - angle) > 0.5) {
        angle = voulu;
        await f.move(1, sur(angle).x, sur(angle).y);
      }
      if (veut.brake > 0 !== freine) {
        freine = veut.brake > 0;
        if (freine) await f.down(3, frein.x, frein.y);
        else await f.up(3);
      }
    }
    await f.up(1);
    await f.up(2);
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("finished");
    const jour = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cdj:best:")));
    expect(jour.length).toBeGreaterThan(0);
    const stocke = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), jour[0]!);
    // La rediffusion enregistrée, jouée par la simulation, redonne le temps affiché : rien n'a changé dans le format des commandes.
    expect(replayRace(circuit.track, decodeReplay(stocke.replay)).finishMs).toBe(stocke.ms);
    // Premier temps : le jeu demande un pseudo, puis l'envoie ; le serveur le rejoue et retrouve exactement le même temps.
    await page.locator("#finish .online input").fill("Volant");
    await page.locator("#finish .online button[type=submit]").click();
    await expect(page.locator("#finish .online .rank")).toHaveText("1er sur 1", { timeout: 20_000 });
    const lb = await (await fetch(`${API}/api/day/${circuit.date}/leaderboard`)).json();
    expect(lb.top.map((r: { name: string; ms: number }) => [r.name, r.ms])).toContainEqual(["Volant", stocke.ms]);
  });
});
