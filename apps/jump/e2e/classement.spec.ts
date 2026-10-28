import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";
import { Fingers, hasWebGL } from "./phone";

// Lot P1 (plateforme) : le classement du jour, avec la démonstration (`?api=demo` : des joueurs fictifs, de vraies rediffusions validées par le
// vrai serveur, lues dans `demo/`). On finit le niveau (la preuve de l'auteur jouée comme les commandes du joueur, en pas à pas) → premier
// pseudo → rang et top 10 → Partager (le texte contient le rang) → l'accueil montre le rang ; serveur injoignable → message, puis envoi au
// retour du réseau ; au doigt en paysage (cibles ≥ 44 px). Horloge maîtrisée (`clock.ts`) ; la démonstration joue son propre « aujourd'hui ».
// Lot I5 : les lignes du classement sont celles du socle (`.ligne`, ta ligne `.ligne--moi` en encre), les rangs s'écrivent « 2e » (`formatRang`).

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";

interface J {
  phase: string;
  daily: { date: string; number: number; id: string; authorTicks: number; mode: string } | null;
  home: { ready: boolean; open: boolean };
  arrival: { shown: boolean; share: string; rank: { shown: boolean; status: string; rows: number } };
  rank: { enabled: boolean; demo: boolean; state: { status: string; message: string }; pending: { date: string; tries: number }[]; known: { rank: number; participants: number } | null };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
}
const jump = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { phase: j.phase, daily: j.daily, arrival: j.arrival, rank: j.rank };
  });
const homeReady = (page: Page) => page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
const rankStatus = (page: Page, status: string) => page.waitForFunction((s) => (window as unknown as { __jump: J }).__jump.rank.state.status === s, status);

async function stubSharing(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __copied?: string; __shared?: string };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void (w.__copied = t) } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d: { text: string }) => void (w.__shared = d.text) });
  });
}

/** Un pseudo de la plateforme déjà là (créé par DailyTrack dans ce navigateur) : la démonstration le reprend tel quel. */
async function withName(context: BrowserContext, name: string): Promise<void> {
  await context.addInitScript((n) => {
    if (!localStorage.getItem("cdj:name")) localStorage.setItem("cdj:name", n);
  }, name);
}

/** Joue la preuve de l'auteur (pas à pas) jusqu'au carnage, puis le passe (`pass`, ou une commande) : l'écran d'arrivée s'ouvre. */
async function playAuthor(page: Page, pass?: () => Promise<void>): Promise<void> {
  const ticks = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay();
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") return t;
    }
    return -1;
  });
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

test("démo : finir le niveau → premier pseudo → rang et top 10 → Partager (avec le rang) → l'accueil montre le rang", async ({ browser }) => {
  test.setTimeout(120_000);
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await stubSharing(context);
    await page.goto("/?debug&api=demo");
    test.skip(!(await hasWebGL(page)), SKIP);
    await homeReady(page);
    let j = await jump(page);
    // La démonstration joue son « aujourd'hui » (le niveau du 30/10/2026, n° 15) comme niveau du jour.
    expect(j.daily).toMatchObject({ date: "2026-10-30", number: 15, mode: "jour" });
    expect(j.rank).toMatchObject({ enabled: true, demo: true, known: null, pending: [] });
    await expect(page.locator("#home-rank")).toBeHidden();
    if (await page.locator("#help").isVisible()) await page.locator("#help-close").click();
    await page.locator("#home-play").click();
    await playAuthor(page);

    // Premier envoi : pas de pseudo → le formulaire ; un pseudo de démonstration est pris (suggestions), un autre passe.
    await expect(page.locator("#arrival-rank")).toHaveText("Choisis ton pseudo pour entrer au classement");
    // Le top 10 des joueurs fictifs est déjà là, sans ta ligne.
    await expect(page.locator("#arrival .arrivee__classement li.ligne:not(.ligne--trou)").first()).toBeVisible();
    await expect(page.locator("#arrival .arrivee__classement li.ligne--moi")).toHaveCount(0);
    j = await jump(page);
    expect(j.rank.pending).toHaveLength(1);
    await page.locator("#arrival-name").fill("Démo Renard");
    await page.locator("#arrival-name-ok").click();
    await expect(page.locator("#arrival .arrivee__erreur")).toHaveText("Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.");
    await expect(page.locator("#arrival .arrivee__suggestion").first()).toHaveText("Renard2");
    await page.locator("#arrival-name").fill("Testeuse");
    await page.locator("#arrival-name-ok").click();

    // Rang et top 10 : le temps de l'auteur, à égalité avec le premier (qui a envoyé avant) → 2e.
    await rankStatus(page, "ranked");
    await expect(page.locator("#arrival-rank")).toHaveText(/^2e sur \d+$/);
    const participants = Number((await page.locator("#arrival-rank").textContent())!.split(" sur ")[1]);
    expect(participants).toBeGreaterThanOrEqual(4);
    await expect(page.locator("#arrival .arrivee__classement li.ligne:not(.ligne--trou)")).toHaveCount(Math.min(10, participants));
    await expect(page.locator("#arrival .arrivee__classement li.ligne--moi")).toHaveCount(1);
    await expect(page.locator("#arrival .arrivee__classement li.ligne--moi .ligne__nom")).toHaveText("Testeuse");
    await expect(page.locator("#arrival .arrivee__classement li.ligne--moi .ligne__rang")).toHaveText("2");
    await expect(page.locator("#arrival-name")).toBeHidden();

    // Partager : le rang est au bout de la ligne.
    await page.locator("#arrival-share").click();
    await expect(page.locator("#arrival .arrivee__message")).toHaveText("Copié dans le presse-papiers");
    const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
    expect(copied).toMatch(new RegExp(`^Du Jour · Jump #15 — \\d+,\\d{3}\\u00a0s — 💎 — 0 💀 — 2e/${participants}\\n`));
    // Le lien est celui de la page, sans paramètre (lot 10) : la démonstration ne se partage pas.
    expect(copied).toMatch(/\nhttp:\/\/localhost:4174\/$/);
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/p1-arrivee.png` });

    // L'accueil montre le rang du jour ; rechargée, la page s'en souvient (stockage de la démonstration).
    await page.locator("#arrival-home").click();
    await expect(page.locator("#home-rank")).toHaveText(`Ton rang du jour : 2e sur ${participants}`);
    await page.reload();
    await homeReady(page);
    await expect(page.locator("#home-rank")).toHaveText(`Ton rang du jour : 2e sur ${participants}`);
    // Rien du vrai jeu n'a été écrit : tout est sous `demo:`.
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => !k.startsWith("demo:"))).toEqual([]);
  });
});

test("démo, au doigt en paysage : pseudo, rang, top 10, Partager ; cibles ≥ 44 px", { tag: "@regression" }, async ({ browser }) => {
  test.setTimeout(120_000);
  const chromium = browser.browserType().name() === "chromium";
  const viewport = { width: 844, height: 390 };
  await atInstant(
    browser,
    FIXED_NOW,
    async (page, context) => {
      await stubSharing(context);
      await page.goto("/?debug&touch=1&api=demo");
      test.skip(!(await hasWebGL(page)), SKIP);
      await homeReady(page);
      if (await page.locator("#help").isVisible()) await page.locator("#help-close").tap();
      await page.locator("#home-play").tap();
      const fingers = await Fingers.on(page);
      await playAuthor(page, async () => {
        await fingers.down(1, viewport.width * 0.2, viewport.height * 0.7);
        await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(1));
        await fingers.up(1);
      });
      await expect(page.locator("#arrival-rank")).toHaveText("Choisis ton pseudo pour entrer au classement");
      await bigEnough(page.locator("#arrival-name"), viewport, "champ du pseudo");
      await bigEnough(page.locator("#arrival-name-ok"), viewport, "OK du pseudo");
      await page.locator("#arrival-name").tap();
      await page.locator("#arrival-name").fill("Démo Lynx");
      await page.locator("#arrival-name-ok").tap();
      const suggestion = page.locator("#arrival .arrivee__suggestion").first();
      await expect(suggestion).toHaveText("Lynx2");
      await bigEnough(suggestion, viewport, "pseudo proposé");
      await suggestion.tap();
      await rankStatus(page, "ranked");
      await expect(page.locator("#arrival-rank")).toHaveText(/^2e sur \d+$/);
      await expect(page.locator("#arrival .arrivee__classement li.ligne--moi .ligne__nom")).toHaveText("Lynx2");
      for (const id of ["replay", "share", "carnage", "home"]) await bigEnough(page.locator(`#arrival-${id}`), viewport, `#arrival-${id}`);
      if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/p1-arrivee-paysage.png` });
      await page.locator("#arrival-share").tap();
      await expect(page.locator("#arrival .arrivee__message")).toHaveText("Partagé");
      const shared = await page.evaluate(() => (window as unknown as { __shared?: string }).__shared);
      expect(shared).toMatch(/ — 2e\/\d+\n/);
      await page.locator("#arrival-home").tap();
      await expect(page.locator("#home-rank")).toHaveText(/^Ton rang du jour : 2e sur \d+$/);
    },
    { viewport, hasTouch: true, ...(chromium ? { isMobile: true, deviceScaleFactor: 2 } : {}) },
  );
});

test("démo : une archive montre son classement figé, rien n'est envoyé", { tag: "@regression" }, async ({ browser }) => {
  test.setTimeout(90_000);
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/?debug&api=demo&seed=2026-10-20");
    test.skip(!(await hasWebGL(page)), SKIP);
    await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
    expect((await jump(page)).daily).toMatchObject({ date: "2026-10-20", mode: "archive" });
    await playAuthor(page);
    await expect(page.locator("#arrival .arrivee__classement > .legende")).toHaveText("Classement figé du mar. 20 oct.");
    await expect(page.locator("#arrival-rank")).toHaveText(/^\d+ classés · tu n'as pas été classé ce jour-là$/);
    await expect(page.locator("#arrival .arrivee__classement li.ligne:not(.ligne--trou)").first()).toBeVisible();
    await expect(page.locator("#arrival .arrivee__classement li.ligne--moi")).toHaveCount(0);
    await expect(page.locator("#arrival-name")).toBeHidden();
    const j = await jump(page);
    expect(j.rank.pending).toEqual([]);
    expect(j.rank.state.status).toBe("idle");
  });
});
