import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, newClockedContext, hasWebGL, type BrowserContext, type Page } from "./fixtures";

// Captures du README du lot I7 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-i7 --project=chromium` (`OUT=…` change le dossier).
// Chromium, **français et anglais**, paysage : la course avec la caméra et le plein écran (844 × 390 : dans la rangée ; 740 × 360 : la caméra passe devant
// l'objectif), l'accueil avec le plein écran dans la barre des jeux, et l'accueil sur iPhone (la ligne « Partager › Sur l'écran d'accueil »).
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

async function telephone(browser: Parameters<typeof newClockedContext>[0], viewport: { width: number; height: number }, locale: string, userAgent?: string): Promise<BrowserContext> {
  const context = await newClockedContext(browser, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale, userAgent });
  await context.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
  return context;
}

for (const l of LANGUES) {
  for (const viewport of [
    { slug: "paysage", width: 844, height: 390 },
    { slug: "compact", width: 740, height: 360 },
  ]) {
    test(`course ${viewport.slug} (${l.slug})`, async ({ browser }) => {
      const context = await telephone(browser, viewport, l.locale);
      await context.route(/\/api\//, (route) => route.abort());
      const page = await context.newPage();
      await page.goto("/?debug&home=0");
      await page.waitForFunction(() => window.__cdj?.phase);
      await page.evaluate(() => window.__cdj.manual(true));
      await page.evaluate(() => window.__cdj.advance(3 * 120 + 40 + 2 * 120));
      await expect(page.locator("#btn-camera")).toBeVisible();
      await page.screenshot({ path: join(OUT, `lot-I7-track-course-${viewport.slug}-${l.slug}.png`) });
      await context.close();
    });
  }

  test(`accueil (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, { width: 844, height: 390 }, l.locale);
    const page: Page = await context.newPage();
    await page.goto("/?home=1&debug&api=demo");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(page.locator("#home .dj-plein-ecran")).toBeVisible();
    await page.screenshot({ path: join(OUT, `lot-I7-track-accueil-${l.slug}.png`) });
    await context.close();
  });

  test(`accueil iPhone (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, { width: 844, height: 390 }, l.locale, IPHONE_UA);
    await context.addInitScript(() => {
      for (const k of ["fullscreenEnabled", "webkitFullscreenEnabled"]) Object.defineProperty(Document.prototype, k, { configurable: true, get: () => false });
    });
    const page = await context.newPage();
    await page.goto("/?home=1&debug&api=demo");
    test.skip(!(await hasWebGL(page)), "WebGL indisponible");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(page.locator("#home .dj-astuce")).toBeVisible();
    await page.screenshot({ path: join(OUT, `lot-I7-track-accueil-iphone-${l.slug}.png`) });
    await context.close();
  });
}
