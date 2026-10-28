import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { echantillonnerTrajectoire, encoderTrajectoire } from "@cdj/jump-sim";
import { FIXED_NOW, shiftDate } from "./clock";
import { pageLevel } from "./jours";
import { hasWebGL } from "./phone";

// Captures du README du lot G1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-g1 --project=chromium` (dans `apps/jump` ; `OUT=…` change le dossier).
// Chromium, **français et anglais**, paysage 844 × 390 : la partie avec le bouton fantôme (après le plein écran), et une course avec le fantôme Diamant dessiné — la vraie
// trajectoire de l'auteur du niveau (rejouée ici, côté Node, comme le fait le serveur) posée par l'outil `__jump.diamond.inject`.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;
const DATE = "2026-10-20"; // le jour de l'horloge des tests (FIXED_NOW)

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  cycleGhost(): string;
  diamond: { inject(trajectoire: string, ticks: number): boolean; visible: boolean; shown: boolean };
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

  test(`course avec le fantôme Diamant (${l.slug})`, async ({ browser }) => {
    const niveau = pageLevel(DATE);
    const trajectoire = encoderTrajectoire(echantillonnerTrajectoire(niveau.level, niveau.replay));
    const context = await telephone(browser, l.locale);
    try {
      const page = await context.newPage();
      await page.goto("/?accueil=0&touch=1");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.goto("/?accueil=0&debug&touch=1&pieces=off");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready");
      await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
      const ok = await page.evaluate(([t, n]) => (window as unknown as { __jump: J }).__jump.diamond.inject(t as string, n as number), [trajectoire, niveau.authorTicks]);
      expect(ok).toBe(true);
      // Le Diamant est le troisième choix : le tien → aucun (sans premier) …, jusqu'au Diamant.
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        for (let i = 0; i < 4 && j.cycleGhost() !== "diamant"; i++);
        j.manual(true);
        j.input(2); // la course : on court, le Diamant roule avec nous
        j.advance(340);
        j.input(0);
      });
      await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.diamond.visible);
      await expect(page.locator("#ghostbtn")).toHaveAttribute("aria-label", l.slug === "fr" ? "Fantôme : Diamant" : "Ghost: Diamond");
      await page.screenshot({ path: join(OUT, `lot-G1-jump-diamant-${l.slug}.png`) });
    } finally {
      await context.close();
    }
  });
}
