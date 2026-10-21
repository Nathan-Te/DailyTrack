import { expect, test, type Browser, type CDPSession, type Page } from "@playwright/test";
import { createAutopilot, decodeReplay, parseTrack, replayRace, type RaceState } from "@cdj/sim";
import { boxes, expectNoOverlap } from "./layout";

// Commandes tactiles (lot 10, refaites à la retouche 2 du lot I4 : boutons par défaut, aux bords de l'écran, zones de toucher qui épousent les boutons, plus de barre du
// bas : caméra, graphismes et plein écran sont dans la pause, point de contrôle et recommencer en haut à gauche). Gestes synthétiques envoyés par le protocole du navigateur (`Input.dispatchTouchEvent`) :
// ce sont de vrais événements tactiles, qui deviennent des « pointer events » comme sur un téléphone.
// Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

/** Gabarits de téléphone (paysage) : un Android et un iPhone. */
const PHONES = [
  {
    name: "Android (Pixel 7)",
    viewport: { width: 851, height: 393 },
    deviceScaleFactor: 2.625,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  },
  {
    name: "iPhone 14",
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
] as const;

/**
 * Un téléphone. Depuis la retouche 18b, le défaut est à deux pédales, et depuis la retouche 2 du lot I4 aux boutons ← → ; la plupart de ces tests
 * conduisent au glissement avec l'accélérateur automatique, qu'on enregistre donc d'entrée (au premier chargement seulement : un rechargement
 * garde ce que le joueur a choisi). `fresh` : aucun réglage enregistré, c'est le vrai défaut ; `stored` : un réglage précis.
 */
async function phone(browser: Browser, p: (typeof PHONES)[number] | { viewport: { width: number; height: number } }, opts: { fresh?: boolean; stored?: object } = {}) {
  const context = await browser.newContext({ ...p, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  if (!opts.fresh) {
    const stored = JSON.stringify(opts.stored ?? { steerMode: "drag", autoThrottle: true, version: 2 });
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

/** Doigts posés sur l'écran, envoyés au navigateur comme sur un écran tactile (plusieurs doigts à la fois). */
class Fingers {
  private readonly points = new Map<number, { x: number; y: number }>();
  constructor(private readonly cdp: CDPSession) {}
  private send(type: "touchStart" | "touchMove" | "touchEnd", points = this.points) {
    return this.cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [...points].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
  }
  async down(id: number, x: number, y: number) {
    this.points.set(id, { x, y });
    await this.send("touchStart");
  }
  async move(id: number, x: number, y: number) {
    this.points.set(id, { x, y });
    await this.send("touchMove");
  }
  async up(id: number) {
    // Pour `touchEnd`, le protocole attend le ou les doigts qu'on lève (et non ceux qui restent posés).
    const lifted = new Map([[id, this.points.get(id)!]]);
    this.points.delete(id);
    await this.send("touchEnd", lifted);
  }
}

const fingersOf = async (page: Page) => new Fingers(await page.context().newCDPSession(page));
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
    test("l'interface tactile se met en place toute seule ; accélérateur automatique, direction au glissement, frein au second doigt", async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await racing(page, "/?debug&scenario=plat");
      expect(await page.evaluate(() => window.__cdj.touch)).toBe(true);
      await expect(page.locator("body")).toHaveClass(/touch/);
      await expect(page.locator("#touch .hint")).toHaveCount(0); // plus d'aide sur la scène : le centre reste libre (l'aide de départ est une ligne du HUD)

      // Sans doigt : plein gaz tout seul, tout droit ; la voiture avance.
      await polled(page, (i) => i.throttle).toBe(64);
      expect(await page.evaluate(() => window.__cdj.car.z)).toBeGreaterThanOrEqual(0);
      await expect.poll(() => page.evaluate(() => window.__cdj.car.z), { timeout: 5_000 }).toBeGreaterThan(5);
      expect((await input(page)).steer).toBe(0);

      const f = await fingersOf(page);
      // Glissement à droite depuis le point de pose (moitié gauche) : braquage proportionnel, analogique.
      await f.down(1, 120, 250);
      await f.move(1, 120 + 40, 250);
      await polled(page, (i) => i.steer).toBeGreaterThan(25);
      expect((await input(page)).steer).toBeLessThan(45); // (40/70 − 0,08) / 0,92 ≈ 0,54 → ≈ 34
      await f.move(1, 120 + 25, 250);
      // La commande n'est relue qu'à l'image suivante : on attend qu'elle ait changé (le rendu logiciel de la CI est lent).
      await polled(page, (i) => i.steer).toBeLessThan(25);
      expect((await input(page)).steer).toBeGreaterThan(5);
      // À gauche : négatif. Très loin : plein braquage seulement (le point de pose suit le doigt).
      await f.move(1, 120 - 30, 250);
      await polled(page, (i) => i.steer).toBeLessThan(-15);
      await f.move(1, 120 + 200, 250);
      await polled(page, (i) => i.steer).toBe(64);
      // Revenir de quelques pixels suffit à redresser (le point de pose a suivi) : on n'a pas à refaire 200 px.
      await f.move(1, 120 + 200 - 30, 250);
      await polled(page, (i) => i.steer).toBeLessThan(64);

      // Second doigt dans la moitié droite : frein ; l'accélérateur automatique se coupe ; on dirige toujours.
      await f.down(2, 700, 250);
      await polled(page, (i) => i.brake).toBe(64);
      expect((await input(page)).throttle).toBe(0);
      expect((await input(page)).steer).toBeGreaterThan(0);
      // On lâche le frein : le gaz revient ; on lâche la direction : tout droit.
      await f.up(2);
      await polled(page, (i) => i.brake).toBe(0);
      expect((await input(page)).throttle).toBe(64);
      await f.up(1);
      await polled(page, (i) => i.steer).toBe(0);
      await context.close();
    });

    test("par défaut : les boutons ← → et deux pédales ; ni gaz ni frein tant qu'on ne touche pas ; le milieu de l'écran ne répond à rien", async ({ browser }) => {
      const { context, page } = await phone(browser, p, { fresh: true });
      await racing(page, "/?debug&scenario=plat");
      await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons"); // retouche 2 du lot I4 : les boutons, plus le joystick
      await expect(page.locator("#touch")).toHaveAttribute("data-throttle", "manual");
      for (const cls of ["steer-left", "steer-right", "pedal-brake", "pedal-gas"]) await expect(page.locator(`#touch .${cls}`)).toBeVisible();
      await polled(page, (i) => i.throttle).toBe(0);
      const f = await fingersOf(page);
      const gas = await centre(page, "#touch .pedal-gas");
      await f.down(1, gas.x, gas.y); // le bouton GAZ, tout à droite
      await polled(page, (i) => i.throttle).toBe(64);
      await f.up(1);
      await polled(page, (i) => i.throttle).toBe(0);
      const brake = await centre(page, "#touch .pedal-brake");
      await f.down(1, brake.x, brake.y); // le bouton FREIN, à sa gauche
      await polled(page, (i) => i.brake).toBe(64);
      await f.up(1);
      await polled(page, (i) => i.brake).toBe(0);
      // Le milieu de l'écran (devant la voiture) n'a aucune zone : un appui y est ignoré.
      const { width: W, height: H } = p.viewport;
      for (const [x, y] of [[W * 0.5, H * 0.5], [W * 0.4, H * 0.8], [W * 0.6, H * 0.3]] as const) {
        await f.down(1, x, y);
        await page.waitForTimeout(150);
        expect(await input(page), `appui au milieu en (${Math.round(x)}, ${Math.round(y)})`).toMatchObject({ steer: 0, throttle: 0, brake: 0 });
        await f.up(1);
      }
      await context.close();
    });

    test("les boutons sont aux bords, jamais devant la voiture, dans les trois tailles", async ({ browser }) => {
      for (const size of ["small", "medium", "large"] as const) {
        const { context, page } = await phone(browser, p, { stored: { steerMode: "buttons", autoThrottle: false, buttonSize: size, version: 2 } });
        await racing(page, "/?debug&scenario=plat");
        const { width: W, height: H } = p.viewport;
        for (const cls of ["steer-left", "steer-right", "pedal-brake", "pedal-gas"]) {
          const b = (await page.locator(`#touch .${cls}`).boundingBox())!;
          const label = `${size} ${cls} (${Math.round(b.x)}, ${Math.round(b.y)}, ${Math.round(b.width)}×${Math.round(b.height)})`;
          expect(b.x, label).toBeGreaterThanOrEqual(EDGE_MARGIN_PX - 0.5);
          expect(b.x + b.width, label).toBeLessThanOrEqual(W - EDGE_MARGIN_PX + 0.5);
          expect(b.y + b.height, label).toBeLessThanOrEqual(H - EDGE_MARGIN_PX + 0.5);
          expect(b.width, label).toBeGreaterThanOrEqual(43.5);
          expect(b.height, label).toBeGreaterThanOrEqual(43.5);
          // le rectangle central de la course (x de 32 % à 68 %, y de 20 % à 88 %) reste libre
          const dedans = b.x < W * 0.68 && b.x + b.width > W * 0.32 && b.y < H * 0.88 && b.y + b.height > H * 0.2;
          expect(dedans, `${label} dans le rectangle central`).toBe(false);
          expect(b.x + b.width <= W * CENTER_FREE.x0 + 0.5 || b.x >= W * CENTER_FREE.x1 - 0.5, `${label} dans le tiers central`).toBe(true);
        }
        await context.close();
      }
    });

    test("un réglage enregistré avec l'ancien défaut (automatique) est remis une fois aux deux pédales ; on peut repasser en automatique", async ({ browser }) => {
      const { context, page } = await phone(browser, p, { stored: { steerMode: "buttons", sensitivity: 1.5, autoThrottle: true } });
      await racing(page, "/?debug&scenario=plat");
      await expect(page.locator("#touch")).toHaveAttribute("data-throttle", "manual"); // migré
      await expect(page.locator("#touch")).toHaveAttribute("data-mode", "buttons"); // le reste est gardé
      await polled(page, (i) => i.throttle).toBe(0);
      // Le joueur choisit l'accélérateur automatique : la sauvegarde porte la version, un rechargement le garde.
      await openSettings(page); // la pause, puis Réglages › Commandes (plus de barre du bas)
      await page.getByRole("radio", { name: "Automatique" }).click();
      await closeSettings(page);
      await polled(page, (i) => i.throttle).toBe(64);
      await page.reload();
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
      await expect(page.locator("#touch")).toHaveAttribute("data-throttle", "auto");
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!));
      expect(saved).toMatchObject({ autoThrottle: true, version: 2 });
      await context.close();
    });

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

    test("réglages : boutons ← →, accélérateur manuel, gardés d'une visite à l'autre ; cibles de 44 px", async ({ browser }) => {
      const { context, page } = await phone(browser, p);
      await racing(page, "/?debug&scenario=plat");
      await openSettings(page);
      await expect(page.locator("#page-controls")).toBeVisible(); // Réglages › Commandes (lot 29) ; on y arrive par la pause
      // La fenêtre figé la partie ; ses cibles font au moins 44 px.
      for (const b of await page.locator("#page-controls button:visible").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
      await page.getByRole("radio", { name: "Boutons ← →" }).click();
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

    test("mise en page : paysage, rien ne se chevauche ; boutons de menu et d'action ≥ 44 px", async ({ browser }) => {
      const { context, page } = await phone(browser, p, { stored: { steerMode: "drag", autoThrottle: false, version: 2 } }); // joystick et deux pédales : tout est à l'écran
      await racing(page, "/?debug&scenario=pilotage");
      await page.addStyleTag({ content: "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }" });
      const f = await fingersOf(page);
      await f.down(1, 100, 250); // le curseur du doigt est aussi à l'écran
      await f.move(1, 150, 250);
      const names = ["#meta", "#timer", "#menu", "#speed", "#touch .steer-left", "#touch .steer-right", "#touch .pedal-brake", "#touch .pedal-gas", "#touch .ring", "#touch .knob"];
      const list = await boxes(page, names);
      expect(list.map((b) => b.name)).toEqual(expect.arrayContaining(["#timer", "#menu", "#touch .pedal-gas"]));
      // Le curseur de glissement est volontairement sous le doigt, où il veut : on ne le compare pas aux autres.
      expectNoOverlap(list.filter((b) => !b.name.startsWith("#touch .ring") && !b.name.startsWith("#touch .knob")), p.viewport);
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

test("portrait : invitation à tourner le téléphone, qu'on peut écarter ; rien ne dépasse", async ({ browser }) => {
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

test("?touch=1 : sur ordinateur, la souris simule le doigt ; ?touch=0 coupe l'interface tactile", async ({ page }) => {
  // Accélérateur automatique (le défaut est à deux pédales depuis la 18b) : sans doigt, plein gaz.
  await page.addInitScript(() => {
    if (localStorage.getItem("cdj:touch") === null) localStorage.setItem("cdj:touch", JSON.stringify({ steerMode: "drag", autoThrottle: true, version: 2 }));
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

test("un téléphone est reconnu sans option, et une course au doigt est une vraie course : le serveur rejouerait le même temps", async ({ browser }) => {
  const spec = "S@start S S S S S S@finish";
  const { context, page } = await phone(browser, PHONES[0]);
  await racing(page, "/?debug&spec=" + encodeURIComponent(spec)); // aucune option tactile dans l'adresse
  expect(await page.evaluate(() => window.__cdj.touch)).toBe(true);
  // Accélérateur automatique : sans toucher l'écran, on franchit la ligne.
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 40_000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:best:test")!));
  expect(stored.ms).toBeGreaterThan(3_000);
  // Même chaîne de commandes que le clavier : la rediffusion enregistrée, rejouée par `sim`, redonne le même temps.
  const result = replayRace(parseTrack("test", spec), decodeReplay(stored.replay));
  expect(result.finishMs).toBe(stored.ms);
  expect(decodeReplay(stored.replay).runs.every((r) => Number.isInteger(r.steer) && r.throttle <= 64 && r.brake <= 64)).toBe(true);
  // L'écran d'arrivée se range : boutons ≥ 44 px.
  for (const b of await page.locator("#finish .actions button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await context.close();
});

test("on finit un tour au doigt : glissement pour tourner, accélérateur automatique", async ({ browser }) => {
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
  const X0 = 150;
  const RANGE = 70;
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

test("vibration au point de contrôle et au choc, désactivable", async ({ browser }) => {
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
  { steerMode: "drag", autoThrottle: true },
  { steerMode: "buttons", autoThrottle: true },
  { steerMode: "buttons", autoThrottle: false },
  { steerMode: "drag", autoThrottle: false },
] as const;
const SCREENS = [
  { name: "paysage Android", viewport: { width: 851, height: 393 } },
  { name: "paysage iPhone", viewport: { width: 844, height: 390 } },
  { name: "paysage petit", viewport: { width: 667, height: 375 } },
  { name: "portrait", viewport: { width: 390, height: 844 } },
  { name: "petit portrait", viewport: { width: 360, height: 640 } },
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
    test("un appui en n'importe quel point de chaque zone (coins à 8 px du bord compris) déclenche la bonne commande ; au milieu, aucune", async ({ browser }) => {
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

    test("aucun point de la moitié basse de l'écran de jeu n'est hors zone (la couche tactile reçoit le toucher partout)", async ({ browser }) => {
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

    test("?zones=1 dessine les zones et un point par doigt, de la couleur de la zone ; gris au milieu, rouge hors de la zone de jeu", async ({ browser }) => {
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

    test("taille des boutons : réglage mémorisé, boutons plus grands, toujours aux bords ; ?steer= force le mode", async ({ browser }) => {
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
