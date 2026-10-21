import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { hasWebGL } from "./phone";

// Captures du README du lot I7 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-i7 --project=chromium` (dans `apps/jump` ; `OUT=…` change le
// dossier). Chromium, **français et anglais**, paysage 844 × 390 : la partie avec le plein écran juste après la pause, l'accueil avec le plein écran dans la barre
// des jeux, et l'accueil sur iPhone (la ligne « Partager › Sur l'écran d'accueil »).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  home: { ready: boolean };
}

async function telephone(browser: Browser, locale: string, userAgent?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale, userAgent });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
  return context;
}

for (const l of LANGUES) {
  test(`partie (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, l.locale);
    try {
      const page = await context.newPage();
      await page.goto("/?accueil=0&touch=1");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.goto("/?accueil=0&debug&touch=1&pieces=off");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready");
      await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.manual(true);
        j.input(2);
        j.advance(200);
        j.input(0);
      });
      await expect(page.locator("#fullscreenbtn")).toBeVisible();
      await page.screenshot({ path: join(OUT, `lot-I7-jump-partie-${l.slug}.png`) });
    } finally {
      await context.close();
    }
  });

  test(`accueil (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, l.locale);
    try {
      const page = await context.newPage();
      await page.goto("/?debug");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home .dj-plein-ecran")).toBeVisible();
      await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
      await page.screenshot({ path: join(OUT, `lot-I7-jump-accueil-${l.slug}.png`) });
    } finally {
      await context.close();
    }
  });

  test(`accueil iPhone (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, l.locale, IPHONE_UA);
    try {
      await context.addInitScript(() => {
        for (const k of ["fullscreenEnabled", "webkitFullscreenEnabled"]) Object.defineProperty(Document.prototype, k, { configurable: true, get: () => false });
      });
      const page = await context.newPage();
      await page.goto("/?debug");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home .dj-astuce")).toBeVisible();
      await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
      await page.screenshot({ path: join(OUT, `lot-I7-jump-accueil-iphone-${l.slug}.png`) });
    } finally {
      await context.close();
    }
  });
}
