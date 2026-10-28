import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { hasWebGL } from "./phone";

// Captures du README du lot 27 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-27 --project=chromium` (dans `apps/jump` ; `OUT=…` change le dossier).
// Chromium : le décompte « 3, 2, 1, Partez ! » et les plaques tactiles (paysage 844 × 390 au doigt), puis le résultat posé sur la scène pendant la rediffusion et le carnage
// (paysage 844 × 390 au doigt, portrait 390 × 844 au doigt, ordinateur 1280 × 720). Le monde est avancé pas à pas.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/jump/lots/img");
mkdirSync(OUT, { recursive: true });

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  autoplay(code?: string): number;
  respawn(): void;
}

const FORMATS = {
  paysage: { viewport: { width: 844, height: 390 }, touch: true },
  portrait: { viewport: { width: 390, height: 844 }, touch: true },
  ordinateur: { viewport: { width: 1280, height: 720 }, touch: false },
} as const;

async function ouvrir(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
  return true;
}
const frames = (page: Page, n = 3) => page.evaluate((k) => new Promise<void>((done) => { let left = k; const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);

for (const [nom, f] of Object.entries(FORMATS)) {
  test(`${nom} : le décompte, les plaques tactiles, le résultat pendant le carnage`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: f.viewport, deviceScaleFactor: 2, locale: "fr-FR", hasTouch: f.touch, isMobile: f.touch });
    await shiftDate(context, FIXED_NOW);
    await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
    try {
      const page = await context.newPage();
      test.skip(!(await ouvrir(page, `/?seed=2026-12-09&accueil=0&debug${f.touch ? "&touch=1" : ""}`)), "WebGL indisponible");
      // Le décompte : « 3 », « 2 », « 1 », « Partez ! ».
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.manual(true);
        j.restart();
        j.advance(20);
      });
      await frames(page);
      await page.screenshot({ path: join(OUT, `lot-27-${nom}-decompte-3.png`) });
      await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(80));
      await frames(page);
      await page.screenshot({ path: join(OUT, `lot-27-${nom}-decompte-1.png`) });
      await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(80));
      await frames(page);
      await page.screenshot({ path: join(OUT, `lot-27-${nom}-decompte-partez.png`) });
      // Le résultat : la preuve de l'auteur jouée jusqu'à l'arrivée, puis le carnage (2 s plus tard).
      const n = await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.restart();
        const n = j.autoplay();
        for (let t = 1; t <= n + 10; t++) {
          j.advance(1);
          if (j.phase === "carnage") return t;
        }
        return -1;
      });
      if (n < 0) throw new Error("pas de carnage");
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.input(0);
        j.advance(240);
        j.input(null);
      });
      await frames(page);
      await page.screenshot({ path: join(OUT, `lot-27-${nom}-resultat-carnage.png`) });
    } finally {
      await context.close();
    }
  });
}
