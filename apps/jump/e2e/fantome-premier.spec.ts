import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { demoAttempts, encodeReplay, replayAttempt } from "@cdj/jump-sim";
import { FIXED_NOW, atInstant } from "./clock";
import { Fingers, hasWebGL } from "./phone";
import { pageLevel } from "./jours";

// Lot P2 (plateforme) : le fantôme du premier, avec la démonstration (`?api=demo` : la rediffusion du premier de chaque jour, validée par le vrai
// serveur à la fabrication du jeu de données, puis par le rejeu du jeu à la lecture). Visible avec son pseudo à côté de ton fantôme ; le
// réglage « Fantôme du premier » le coupe (mémorisé) ; `?ghost=best` aussi ; `?watch=first` rejoue l'essai du premier ; une archive montre le
// premier de ce jour-là ; au doigt en paysage, les cibles du profil, du réglage et de l'arrivée font au moins 44 px. Horloge maîtrisée.
// Lot I5 : le réglage est dans Réglages (cadre crème), le profil dans le portail (`/profil/`) ; l'étiquette du premier s'écrit « Nom · 1er ».

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const firstOf = (date: string) => (JSON.parse(readFileSync(new URL(`../public/demo/${date}.json`, import.meta.url), "utf8")) as { first: { name: string; ticks: number } }).first;
const TODAY_DEMO = "2026-10-30";

interface FirstView {
  date: string | null;
  enabled: boolean;
  loaded: boolean;
  shown: boolean;
  visible: boolean;
  labelled: boolean;
  name: string | null;
  label: string | null;
  ticks: number | null;
  mine: boolean;
  miss: string;
  tick: number;
}
interface J {
  phase: string;
  watching: boolean;
  firstGhost: FirstView;
  ghost: { visible: boolean };
  ghostColors: { own: number; first: number };
  banner: boolean;
  home: { ready: boolean };
  settings: { firstGhost: boolean };
  manual(on: boolean): void;
  go(): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
  setMenu(open: boolean): void;
}
const j = (page: Page) => page.evaluate(() => (window as unknown as { __jump: J }).__jump.firstGhost);
const loaded = (page: Page) => page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.firstGhost.loaded === true);
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));

async function stubSharing(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __copied?: string; __shared?: string };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void (w.__copied = t) } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d: { text: string }) => void (w.__shared = d.text) });
  });
}

/** Joue une rediffusion (pas à pas) jusqu'au carnage, puis le passe : l'écran d'arrivée s'ouvre. */
async function play(page: Page, code: string, pass?: () => Promise<void>): Promise<void> {
  const ticks = await page.evaluate((c) => {
    const w = (window as unknown as { __jump: J }).__jump;
    w.manual(true);
    const n = w.autoplay(c);
    for (let t = 1; t <= n + 10; t++) {
      w.advance(1);
      if (w.phase === "carnage" || w.phase === "finished") return t;
    }
    return -1;
  }, code);
  expect(ticks).toBeGreaterThan(0);
  await page.evaluate(() => {
    const w = (window as unknown as { __jump: J }).__jump;
    w.input(0);
    w.advance(1);
    w.input(null);
  });
  if (pass) await pass();
  else
    await page.evaluate(() => {
      const w = (window as unknown as { __jump: J }).__jump;
      w.input(2);
      w.advance(1);
      w.input(null);
    });
  await expect(page.locator("#arrival")).toBeVisible();
}

/** Un essai du jour de la démonstration plus lent que le premier (une perturbation de la preuve qui arrive). */
function slowerRun(date: string): { code: string; ticks: number } {
  const d = pageLevel(date); // le niveau que la page joue (figé s'il l'est, sinon généré)
  for (const a of demoAttempts(d.level, d.replay, 0xf1, { attempts: 40 })) {
    if (a.end !== "arrivée") continue;
    const r = replayAttempt(d.level, a.replay, d.id);
    if (r.finished && r.time > d.authorTicks) return { code: encodeReplay(a.replay), ticks: r.time };
  }
  throw new Error("aucun essai plus lent");
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

test("démo : le fantôme du premier est visible avec son pseudo, à côté du tien ; le réglage le coupe (mémorisé), `?ghost=best` aussi", async ({ browser }) => {
  test.setTimeout(120_000);
  const first = firstOf(TODAY_DEMO);
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/?debug&api=demo&accueil=0");
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    await loaded(page);
    let f = await j(page);
    expect(f).toMatchObject({ date: TODAY_DEMO, enabled: true, loaded: true, shown: true, labelled: true, name: first.name, label: `${first.name} · 1er`, ticks: first.ticks, mine: false, miss: "" });
    // Deux couleurs distinctes, ni le jaune du personnage.
    const colors = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.ghostColors);
    expect(colors.own).not.toBe(colors.first);
    expect([colors.own, colors.first]).not.toContain(0xffd23f);
    // Il court avec le chrono de l'essai : quelques pas joués, il a avancé ; il est dessiné.
    await page.evaluate(() => {
      const w = (window as unknown as { __jump: J }).__jump;
      w.manual(true);
      w.go(); // lot 15 : le jour de la démo est en v4 ; sans le départ, une partie des pas joués irait au « Prêt… » (selon la vitesse de la page)
      w.input(1 << 1);
      w.advance(120);
      w.input(null);
    });
    await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.firstGhost.visible);
    f = await j(page);
    expect(f.tick).toBeGreaterThan(100);

    // Le réglage le coupe, tout de suite ; mémorisé. Lot I5 : il est dans Réglages (ouverts depuis la pause), un choix « Montrer / Cacher ».
    await page.evaluate(() => (window as unknown as { __jump: J }).__jump.setMenu(true));
    await page.locator("#menu-settings").click();
    await expect(page.locator('#reglages-premier [data-value="true"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('#reglages-premier [data-value="false"]').click();
    await expect(page.locator('#reglages-premier [data-value="false"]')).toHaveAttribute("aria-pressed", "true");
    await page.waitForFunction(() => !(window as unknown as { __jump: J }).__jump.firstGhost.visible);
    expect((await j(page)).enabled).toBe(false);
    await page.reload();
    await ready(page);
    await loaded(page);
    expect(await j(page)).toMatchObject({ enabled: false, visible: false, loaded: true });
    // Rallumé ; puis `?ghost=best` le cache sans toucher au réglage.
    await page.evaluate(() => (window as unknown as { __jump: J }).__jump.setMenu(true));
    await page.locator("#menu-settings").click();
    await page.locator('#reglages-premier [data-value="true"]').click();
    await page.goto("/?debug&api=demo&accueil=0&ghost=best");
    await ready(page);
    await loaded(page);
    expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.settings.firstGhost)).toBe(true);
    expect(await j(page)).toMatchObject({ enabled: false, visible: false, shown: true });
  });
});

test("démo : `?watch=first` rejoue l'essai du premier, seul, sans jouer ; à son arrivée, « Rediffusion du premier »", async ({ browser }) => {
  test.setTimeout(120_000);
  const first = firstOf(TODAY_DEMO);
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/?debug&api=demo&watch=first");
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.watching)).toBe(true);
    await expect(page.locator("#home")).toBeHidden();
    const finished = await page.evaluate((n) => {
      const w = (window as unknown as { __jump: J }).__jump;
      w.manual(true);
      for (let t = 0; t < n + 5; t++) {
        w.advance(1);
        if (w.phase === "finished") return t + 1;
      }
      return -1;
    }, first.ticks);
    expect(finished).toBeGreaterThan(0);
    // Le chrono de la lecture est celui du premier (rejoué par le jeu).
    expect(await page.evaluate(() => (window as unknown as { __jump: { attempt: { time: number } } }).__jump.attempt.time)).toBe(first.ticks);
    await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.banner);
    await expect(page.locator("body")).toContainText(`Rediffusion du premier : ${first.name}`);
    // Pas de second fantôme pendant une lecture.
    expect((await j(page)).shown).toBe(false);
  });
});

test("démo : une archive montre le fantôme du premier de ce jour-là", async ({ browser }) => {
  test.setTimeout(90_000);
  const date = "2026-10-20";
  const first = firstOf(date);
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto(`/?debug&api=demo&seed=${date}`);
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    await loaded(page);
    expect(await j(page)).toMatchObject({ date, shown: true, name: first.name, ticks: first.ticks });
  });
});

test("démo, au doigt en paysage : « Regarder le premier » à l'arrivée, Réglages › Profil, réglage du fantôme, carte du profil ; cibles ≥ 44 px", async ({ browser }) => {
  test.setTimeout(150_000);
  const chromium = browser.browserType().name() === "chromium";
  const viewport = { width: 844, height: 390 };
  const slow = slowerRun(TODAY_DEMO);
  await atInstant(
    browser,
    FIXED_NOW,
    async (page, context) => {
      await stubSharing(context);
      await context.addInitScript(() => {
        if (!localStorage.getItem("cdj:name")) localStorage.setItem("cdj:name", "Paysage");
      });
      await page.goto("/?debug&touch=1&api=demo");
      test.skip(!(await hasWebGL(page)), SKIP);
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      if (await page.locator("#help").isVisible()) await page.locator("#help-close").tap();
      // Lot I5 : plus de profil dans le jeu. L'accueil et les Réglages mènent au profil commun du portail (« Mon profil Du Jour › », avec le retour
      // vers Jump) ; le réglage du fantôme du premier est dans les Réglages.
      await expect(page.locator("#home-profil")).toHaveText("Mon profil Du Jour ›");
      await expect(page.locator("#home-profil")).toHaveAttribute("href", "../profil/?retour=%2F");
      await page.locator("#home-settings").tap();
      await expect(page.locator("#settings")).toBeVisible();
      for (const sel of ["#settings-profil", '#reglages-premier [data-value="true"]', '#reglages-premier [data-value="false"]']) await bigEnough(page.locator(sel), viewport, sel);
      await page.locator("#settings .dj-barre-jeu__retour").tap();
      await expect(page.locator("#settings")).toBeHidden();
      await page.locator("#home-play").tap();
      await loaded(page);
      const fingers = await Fingers.on(page);
      await play(page, slow.code, async () => {
        await fingers.down(1, viewport.width * 0.2, viewport.height * 0.7);
        await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(1));
        await fingers.up(1);
      });
      // Ton essai est plus lent que le premier : son fantôme reste, et l'arrivée propose de le regarder.
      const button = page.locator("#arrival-first");
      await expect(button).toHaveText(`Regarder le premier (${firstOf(TODAY_DEMO).name})`);
      await bigEnough(button, viewport, "Regarder le premier");
      expect((await j(page)).shown).toBe(true);
      await button.tap();
      await page.waitForURL(/watch=first/);
      await ready(page);
      expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.watching)).toBe(true);
    },
    { viewport, hasTouch: true, ...(chromium ? { isMobile: true, deviceScaleFactor: 2 } : {}) },
  );
});
