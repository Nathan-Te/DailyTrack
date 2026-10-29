import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { hasWebGL } from "./phone";

// Captures du README du lot G1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-g1 --project=chromium` (dans `apps/jump` ; `OUT=…` change le dossier).
// Chromium, **français et anglais**, paysage 844 × 390 : la partie avec le bouton fantôme (après le plein écran).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
}

async function telephone(browser: Browser, locale: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
  return context;
}

for (const l of LANGUES) {
  test(`partie avec le bouton fantôme (${l.slug})`, async ({ browser }) => {
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
      await expect(page.locator("#ghostbtn")).toBeVisible();
      await page.screenshot({ path: join(OUT, `lot-G1-jump-hud-${l.slug}.png`) });
    } finally {
      await context.close();
    }
  });
}
