import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { demoAttempts, encodeReplay, replayAttempt } from "@cdj/jump-sim";
import { FIXED_NOW, atInstant } from "./clock";
import { Fingers, hasWebGL } from "./phone";
import { pageLevel } from "./jours";

// Lot P3 (plateforme) : les morts de tout le monde, avec la démonstration (`?api=demo` : les vies des joueurs fictifs, validées par le vrai
// serveur à la fabrication du jeu de données). Les taches de tout le monde sont visibles (la carte du jour), le réglage « Taches de tout le
// monde » les coupe (mémorisé) ; à l'arrivée, après ton carnage, « Le carnage de tout le monde » rejoue l'échantillon avec ton essai en héros
// et affiche son compteur ; une archive montre la carte figée de son jour ; au doigt en paysage, les cibles font au moins 44 px.

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const TODAY_DEMO = "2026-10-30";
type DemoFile = { deaths: { players: number; deaths: number; tiles: number[][] }; carnage: { lives: unknown[] } };
const demoDay = (date: string) => JSON.parse(readFileSync(new URL(`../public/demo/${date}.json`, import.meta.url), "utf8")) as DemoFile;

interface Others {
  date: string | null;
  enabled: boolean;
  loaded: boolean;
  tiles: number;
  drawn: number;
  discs: number;
  visible: boolean;
  players: number;
  deaths: number;
  miss: string;
  closest: number;
}
interface J {
  phase: string;
  othersStains: Others;
  everyone: { loaded: boolean; lives: number; players: number; button: string | null };
  carnage: { state: { active: boolean; everyone: boolean; label: string; lives: number }; skip(): void };
  settings: { othersStains: boolean };
  home: { ready: boolean };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
  setMenu(open: boolean): void;
}
const w = (page: Page) => page.evaluate(() => (window as unknown as { __jump: J }).__jump.othersStains);
const loaded = (page: Page) => page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.othersStains.loaded === true);
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));

/** Un essai du jour de la démonstration qui arrive (une perturbation de la preuve de l'auteur, avec des morts). */
function arrivingRun(date: string): string {
  const d = pageLevel(date); // le niveau que la page joue (figé s'il l'est, sinon généré)
  for (const a of demoAttempts(d.level, d.replay, 0xa11, { attempts: 40 })) {
    if (a.end !== "arrivée") continue;
    const r = replayAttempt(d.level, a.replay, d.id);
    if (r.finished && r.deaths.length > 0) return encodeReplay(a.replay);
  }
  throw new Error("aucun essai qui arrive");
}

/** Joue une rediffusion (pas à pas) jusqu'au carnage ; `pass` le passe (sinon une touche) : l'écran d'arrivée s'ouvre. */
async function play(page: Page, code: string, pass?: () => Promise<void>): Promise<void> {
  const ticks = await page.evaluate((c) => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay(c);
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") return t;
    }
    return -1;
  }, code);
  expect(ticks).toBeGreaterThan(0);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(0);
    j.advance(1);
    j.input(null);
  });
  if (pass) await pass();
  else
    await page.evaluate(() => {
      const j = (window as unknown as { __jump: J }).__jump;
      j.input(2);
      j.advance(1);
      j.input(null);
    });
  await expect(page.locator("#arrival")).toBeVisible();
}

async function bigEnough(locator: Locator, viewport: { width: number; height: number }, name: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  expect(box, name).not.toBeNull();
  expect(box.width, `${name} : largeur`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${name} : hauteur`).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width, `${name} : à l'écran`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height, `${name} : à l'écran`).toBeLessThanOrEqual(viewport.height + 0.5);
}

test("démo : les taches de tout le monde sont visibles, loin des dangers et des fanions ; le réglage les coupe (mémorisé)", async ({ browser }) => {
  test.setTimeout(120_000);
  const day = demoDay(TODAY_DEMO);
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/?debug&api=demo&accueil=0");
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    await loaded(page);
    const o = await w(page);
    expect(o).toMatchObject({ date: TODAY_DEMO, enabled: true, loaded: true, visible: true, players: day.deaths.players, deaths: day.deaths.deaths, tiles: day.deaths.tiles.length, miss: "" });
    expect(o.drawn).toBeGreaterThan(5);
    expect(o.discs).toBeGreaterThan(o.drawn);
    expect(o.closest).toBeGreaterThanOrEqual(1);

    // Le réglage du menu les coupe, tout de suite ; mémorisé.
    await page.evaluate(() => (window as unknown as { __jump: J }).__jump.setMenu(true));
    await expect(page.locator("#menu-others-stains")).toHaveText("Taches de tout le monde : oui");
    await page.locator("#menu-others-stains").click();
    await expect(page.locator("#menu-others-stains")).toHaveText("Taches de tout le monde : non");
    await page.waitForFunction(() => !(window as unknown as { __jump: J }).__jump.othersStains.visible);
    await page.reload();
    await ready(page);
    await loaded(page);
    expect(await w(page)).toMatchObject({ enabled: false, visible: false, loaded: true });
    expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.settings.othersStains)).toBe(false);
  });
});

test("démo : après ton carnage, « Le carnage de tout le monde » se joue, ton essai en héros, avec son compteur", async ({ browser }) => {
  test.setTimeout(150_000);
  const code = arrivingRun(TODAY_DEMO);
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await context.addInitScript(() => {
      if (!localStorage.getItem("cdj:name")) localStorage.setItem("cdj:name", "Témoin");
    });
    await page.goto("/?debug&api=demo&accueil=0");
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    await play(page, code);
    const button = page.locator("#arrival-everyone");
    await expect(button).toHaveText("Le carnage de tout le monde");
    const e = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.everyone);
    expect(e.loaded).toBe(true);
    expect(e.lives).toBeGreaterThan(5);
    await button.click();
    await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.carnage.state.active);
    const state = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.carnage.state);
    expect(state.everyone).toBe(true);
    expect(state.label).toMatch(/^\d+ vies? de \d+ joueurs?$/);
    await expect(page.locator("#carnage")).toContainText(state.label);
    // Le carnage se déroule (pas à pas), puis se passe : l'écran d'arrivée revient, « Revoir le carnage » rejoue toujours le tien.
    await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(600));
    expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.carnage.state.label)).toBe(state.label);
    await page.evaluate(() => (window as unknown as { __jump: J }).__jump.carnage.skip());
    await expect(page.locator("#arrival")).toBeVisible();
    await page.locator("#arrival-carnage").click();
    await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.carnage.state.active);
    expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.carnage.state.everyone)).toBe(false);
  });
});

// Lot P4 (plateforme) : le carnage de tout le monde s'adapte à l'appareil (`carnageGovernor.ts`). Un palier imposé (`__jump.carnage.govern`,
// comme le ferait le gouverneur sur un téléphone lent), en pas à pas : moins de vies en course, le compteur garde le vrai total.
test("démo : le carnage de tout le monde adaptatif — au palier 60 vies, jamais plus de 60 en course ; le compteur dit toujours le vrai total", async ({ browser }) => {
  test.setTimeout(150_000);
  const code = arrivingRun(TODAY_DEMO);
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await context.addInitScript(() => {
      if (!localStorage.getItem("cdj:name")) localStorage.setItem("cdj:name", "Témoin");
    });
    await page.goto("/?debug&api=demo&accueil=0");
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    await play(page, code);
    await expect(page.locator("#arrival-everyone")).toHaveText("Le carnage de tout le monde");
    const run = (level: number) =>
      page.evaluate((palier) => {
        type G = { level: number; maxLives: number; particles: number } | null;
        const j = (window as unknown as {
          __jump: J & { startEveryone(max?: number): boolean; carnage: { govern(l: number | null): void; state: { running: number; governor?: G } } };
        }).__jump;
        j.manual(true);
        j.carnage.govern(palier);
        if (!j.startEveryone(150)) return null;
        const label = j.carnage.state.label;
        let max = 0;
        for (let t = 0; t < 900 && j.carnage.state.active; t++) {
          j.advance(1);
          max = Math.max(max, j.carnage.state.running);
          if (j.carnage.state.label !== label) return { label, changed: j.carnage.state.label, max, governor: j.carnage.state.governor ?? null };
        }
        const governor = j.carnage.state.governor ?? null;
        j.carnage.skip();
        j.carnage.govern(null);
        return { label, changed: null, max, governor };
      }, level);
    const light = await run(2);
    expect(light).not.toBeNull();
    expect(light!.label).toMatch(/^150 vies de \d+ joueurs?$/); // le vrai total (l'échantillon repris jusqu'à 150 vies)
    expect(light!.changed).toBeNull();
    expect(light!.governor).toMatchObject({ level: 2, maxLives: 60, particles: 1 });
    expect(light!.max).toBeGreaterThan(0);
    expect(light!.max).toBeLessThanOrEqual(60);
    // Le carnage complet (palier 0) : plus de 60 vies en course à la fois, le même compteur.
    await expect(page.locator("#arrival")).toBeVisible();
    const full = await run(0);
    expect(full!.label).toBe(light!.label);
    expect(full!.governor).toMatchObject({ level: 0, maxLives: 150, particles: 1 });
    expect(full!.max).toBeGreaterThan(60);
  });
});

test("démo : une archive montre la carte figée de son jour", async ({ browser }) => {
  test.setTimeout(90_000);
  const date = "2026-10-20";
  const day = demoDay(date);
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto(`/?debug&api=demo&seed=${date}`);
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    await loaded(page);
    expect(await w(page)).toMatchObject({ date, loaded: true, visible: true, players: day.deaths.players, deaths: day.deaths.deaths, tiles: day.deaths.tiles.length });
  });
});

test("démo, au doigt en paysage : le réglage des taches et « Le carnage de tout le monde » ; cibles ≥ 44 px", async ({ browser }) => {
  test.setTimeout(150_000);
  const chromium = browser.browserType().name() === "chromium";
  const viewport = { width: 844, height: 390 };
  const code = arrivingRun(TODAY_DEMO);
  await atInstant(
    browser,
    FIXED_NOW,
    async (page, context) => {
      await context.addInitScript(() => {
        if (!localStorage.getItem("cdj:name")) localStorage.setItem("cdj:name", "Paysage");
      });
      await page.goto("/?debug&touch=1&api=demo");
      test.skip(!(await hasWebGL(page)), SKIP);
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      if (await page.locator("#help").isVisible()) await page.locator("#help-close").tap();
      await page.locator("#home-play").tap();
      await loaded(page);
      await page.evaluate(() => (window as unknown as { __jump: J }).__jump.setMenu(true));
      await bigEnough(page.locator("#menu-others-stains"), viewport, "Taches de tout le monde");
      await page.locator("#menu-others-stains").tap();
      await expect(page.locator("#menu-others-stains")).toHaveText("Taches de tout le monde : non");
      await page.locator("#menu-others-stains").tap();
      await page.locator("#menu-resume").tap();
      const fingers = await Fingers.on(page);
      await play(page, code, async () => {
        await fingers.down(1, viewport.width * 0.2, viewport.height * 0.7);
        await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(1));
        await fingers.up(1);
      });
      const button = page.locator("#arrival-everyone");
      await expect(button).toHaveText("Le carnage de tout le monde");
      await bigEnough(button, viewport, "Le carnage de tout le monde");
      await button.tap();
      await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.carnage.state.active);
      expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.carnage.state.everyone)).toBe(true);
    },
    { viewport, hasTouch: true, ...(chromium ? { isMobile: true, deviceScaleFactor: 2 } : {}) },
  );
});
