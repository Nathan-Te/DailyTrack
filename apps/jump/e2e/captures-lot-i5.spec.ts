import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { demoAttempts, encodeReplay, JUMP_THEME_NAMES, replayAttempt } from "@cdj/jump-sim";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { pageLevel } from "./jours";

// Captures du README du lot I5 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-i5 --project=chromium` (dans `apps/jump` ; `OUT=…` change
// le dossier). Chromium, **français et anglais** : l'accueil (portrait, paysage, 1440 × 900), « Comment jouer », le HUD en partie **sur chaque thème**
// (paysage), la pause, l'arrivée (avec médaille, sans médaille, « Jeu suivant du jour », « Journée parfaite ! »), le carnage, le classement du jour, les
// archives, les réglages. La démonstration (`?api=demo` : de vraies rediffusions de joueurs fictifs) donne le classement et le carnage ; la suite de la
// journée (qui vient du serveur, `GET /api/portail/jour`) est posée par `__jump.showSuite` (outil de `?debug`).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;
const PORTRAIT = { slug: "portrait", width: 390, height: 844 } as const;
const PAYSAGE = { slug: "paysage", width: 844, height: 390 } as const;
const BUREAU = { slug: "bureau", width: 1440, height: 900 } as const;
type Vue = typeof PORTRAIT | typeof PAYSAGE | typeof BUREAU;
type Langue = (typeof LANGUES)[number];

/** Le jour de la démonstration (`DEMO_TODAY`) : son niveau, et un essai qui arrive **sans médaille** (plus lent que le bronze). */
const DEMO = "2026-10-30";
const lent = (() => {
  const d = pageLevel(DEMO);
  for (const a of demoAttempts(d.level, d.replay, 0xf1, { attempts: 300 })) {
    if (a.end !== "arrivée") continue;
    const r = replayAttempt(d.level, a.replay, d.id);
    if (r.finished && r.time > d.medals.bronze) return encodeReplay(a.replay);
  }
  throw new Error("aucun essai sans médaille");
})();

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
  showSuite(s: unknown): void;
  rank: { state: { status: string } };
}

async function contexte(browser: Browser, vue: Vue, langue: Langue, aideVue = true): Promise<BrowserContext> {
  const tactile = vue !== BUREAU;
  const context = await browser.newContext({ viewport: { width: vue.width, height: vue.height }, locale: langue.locale, hasTouch: tactile, isMobile: tactile, deviceScaleFactor: 1 });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript((vu) => {
    localStorage.setItem("cdj:name", "Nathan");
    if (vu) for (const k of ["jump:aide", "demo:jump:aide"]) localStorage.setItem(k, "1");
  }, aideVue);
  return context;
}

/** La surimpression `?debug` (pièces, version) n'est pas l'interface : cachée pour les captures. */
const sansDebug = (page: Page) => page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
const images = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

async function photo(page: Page, nom: string, vue: Vue, langue: Langue): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await images(page);
  await page.screenshot({ path: join(OUT, `lot-I5-${nom}-${vue.slug}-${langue.slug}.png`) });
}

async function accueil(page: Page, query = "") {
  await page.goto(`/?api=demo&debug&pieces=off${query}`);
  await page.waitForFunction(() => (window as unknown as { __jump?: { home: { ready: boolean } } }).__jump?.home.ready === true, undefined, { timeout: 90_000 });
  await sansDebug(page);
}

/** Joue une rediffusion comme les commandes du joueur (pas à pas), passe le carnage et attend l'écran d'arrivée classé. */
async function finir(page: Page, code?: string) {
  await page.evaluate((c) => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay(c ?? undefined);
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") break;
    }
    j.input(0);
    j.advance(1);
    j.input(2);
    j.advance(1);
    j.input(null);
  }, code ?? null);
  await expect(page.locator("#arrival")).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.rank.state.status === "ranked", undefined, { timeout: 30_000 });
}

const basDuCadre = (page: Page, id: string) => page.locator(`#${id} .cadre__defile`).evaluate((e) => e.scrollTo(0, e.scrollHeight));

for (const langue of LANGUES) {
  test(`accueil (portrait, paysage, 1440 × 900) et « Comment jouer » — ${langue.slug}`, async ({ browser }) => {
    for (const vue of [PORTRAIT, PAYSAGE, BUREAU]) {
      const context = await contexte(browser, vue, langue);
      const page = await context.newPage();
      await accueil(page, vue === BUREAU ? "" : "&touch=1");
      await photo(page, "accueil", vue, langue);
      await context.close();
    }
    // La première visite : « Comment jouer » s'ouvre dans le jeu, par-dessus l'accueil posé sur la scène (au doigt : le schéma des zones).
    for (const vue of [PAYSAGE, PORTRAIT]) {
      const context = await contexte(browser, vue, langue, false);
      const page = await context.newPage();
      await accueil(page, "&touch=1");
      await expect(page.locator("#help")).toBeVisible();
      await photo(page, "aide", vue, langue);
      await context.close();
    }
  });

  test(`le HUD en partie sur chaque thème (paysage), puis la pause — ${langue.slug}`, async ({ browser }) => {
    for (const theme of JUMP_THEME_NAMES) {
      const context = await contexte(browser, PAYSAGE, langue);
      const page = await context.newPage();
      await page.goto(`/?api=demo&debug&pieces=off&accueil=0&touch=1&theme=${theme}`);
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready", undefined, { timeout: 90_000 });
      await sansDebug(page);
      // Un toucher pour que les boutons tactiles s'affichent (ils attendent le premier toucher), puis quelques pas de course.
      await page.touchscreen.tap(PAYSAGE.width * 0.9, PAYSAGE.height * 0.8);
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.manual(true);
        j.input(2);
        j.advance(150);
        j.input(0);
        j.advance(2);
      });
      // Le titre du niveau ne se montre qu'au départ : on attend qu'il s'efface (horloge de la page).
      await page.waitForFunction(() => document.getElementById("dayline")!.hidden, undefined, { timeout: 15_000 });
      await photo(page, `hud-${theme}`, PAYSAGE, langue);
      if (theme === "foret") {
        await page.locator("#pausebtn").tap();
        await expect(page.locator("#menu")).toBeVisible();
        await photo(page, "pause", PAYSAGE, langue);
        await page.locator("#menu-settings").tap();
        await expect(page.locator("#settings")).toBeVisible();
        await photo(page, "reglages", PAYSAGE, langue);
      }
      await context.close();
    }
  });

  test(`l'arrivée (médaille, jeu suivant, journée parfaite, sans médaille), le carnage, le classement, les archives, les réglages — ${langue.slug}`, async ({ browser }) => {
    for (const vue of [PORTRAIT, PAYSAGE]) {
      const context = await contexte(browser, vue, langue);
      const page = await context.newPage();
      await accueil(page, "&touch=1&accueil=0");
      await finir(page);
      await photo(page, "arrivee-medaille", vue, langue);
      await page.evaluate(() => (window as unknown as { __jump: J }).__jump.showSuite({ kind: "suivant", jeu: "cdj", nom: "Track", href: "../track/" }));
      await basDuCadre(page, "arrival");
      await photo(page, "arrivee-jeu-suivant", vue, langue);
      await page.evaluate(() => (window as unknown as { __jump: J }).__jump.showSuite({ kind: "parfaite", href: "../" }));
      await basDuCadre(page, "arrival");
      await photo(page, "arrivee-journee-parfaite", vue, langue);
      // Le carnage de ses vies (un seul essai sans mort : la vie du héros) — la barre de lecture et le titre en autocollant.
      await page.locator("#arrival .cadre__defile").evaluate((e) => e.scrollTo(0, 0));
      await page.locator("#arrival-carnage").tap();
      await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(240));
      await photo(page, "carnage", vue, langue);
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.input(0);
        j.advance(1);
        j.input(2);
        j.advance(1);
        j.input(null);
      });
      await expect(page.locator("#arrival")).toBeVisible();
      // L'accueil après l'arrivée (REJOUER, record, rang), le classement du jour (ta ligne en encre), les archives, les réglages.
      await page.locator("#arrival-home").tap();
      await expect(page.locator("#home")).toBeVisible();
      await photo(page, "accueil-fini", vue, langue);
      await page.locator("#home-board").tap();
      await expect(page.locator("#leaderboard")).toBeVisible();
      await photo(page, "classement", vue, langue);
      await page.locator("#leaderboard .dj-barre-jeu__retour").tap();
      await page.locator("#home-archives").tap();
      await expect(page.locator("#archives")).toBeVisible();
      await photo(page, "archives", vue, langue);
      await page.locator("#archives .dj-barre-jeu__retour").tap();
      await page.locator("#home-settings").tap();
      await expect(page.locator("#settings")).toBeVisible();
      await photo(page, "reglages", vue, langue);
      await context.close();
    }
    // Sans médaille : un essai plus lent que le bronze (avec des morts).
    for (const vue of [PORTRAIT, PAYSAGE]) {
      const context = await contexte(browser, vue, langue);
      const page = await context.newPage();
      await accueil(page, "&touch=1&accueil=0");
      await finir(page, lent);
      await photo(page, "arrivee-sans-medaille", vue, langue);
      await context.close();
    }
  });
}
