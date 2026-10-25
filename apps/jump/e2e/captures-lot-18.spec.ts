import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { hasWebGL } from "./phone";

// Captures du README du lot 18 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-18 --project=chromium` (dans `apps/jump` ; `OUT=…` change le
// dossier). Chromium, paysage 844 × 390 : la jauge des blocs de la nuit (pleine, à moitié, presque vide, absent pointillé, contour qui se remplit) sur le morceau
// `nuit-opposition` v5, et les feuilles de la forêt (pleine vitesse, ralenti, arrêt) sur `vent-rafale`. Le monde est avancé pas à pas jusqu'au pas voulu.
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
  blocks: { phases: number[]; cycles: ({ cycle: number; solid: number; shift: number } | null)[] } | null;
  wind: { phases: number[]; list: { gust: { cycle: number; active: number; shift: number } | null }[] } | null;
}

async function ouvrir(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.input(2);
    j.advance(36);
    j.input(0);
  });
  return true;
}

const frames = (page: Page, n = 3) => page.evaluate((k) => new Promise<void>((done) => { let left = k; const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);

test("la jauge de la nuit", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, locale: "fr-FR" });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
  try {
    const page = await context.newPage();
    test.skip(!(await ouvrir(page, "/?module=nuit-opposition&variante=5&debug&accueil=0")), "WebGL indisponible");
    // Avance jusqu'à ce qu'il reste `left` pas au groupe `b` (plein sur [0, solide) de son cycle), selon qu'il est plein (`solid`) ou absent.
    const jusqua = (solid: boolean, left: number) =>
      page.evaluate(([s, l]) => {
        const j = (window as unknown as { __jump: J }).__jump;
        for (let t = 0; t < 4000; t++) {
          const c = j.blocks!.cycles.find(Boolean)!;
          const q = (((j.blocks!.phases[0]! + c.shift) % c.cycle) + c.cycle) % c.cycle;
          const plein = q < c.solid;
          const restant = plein ? c.solid - q : c.cycle - q;
          if (plein === s && restant === l) return true;
          j.advance(1);
        }
        return false;
      }, [solid, left] as const);
    const vues: [string, boolean, number][] = [
      ["1-plein", true, 150],
      ["2-vide-a-moitie", true, 36],
      ["3-presque-vide", true, 4],
      ["4-absent-pointille", false, 170],
      ["5-contour-se-remplit", false, 24],
      ["6-presque-plein", false, 3],
      ["7-plein-a-nouveau", true, 179],
    ];
    for (const [nom, plein, restant] of vues) {
      await jusqua(plein, restant);
      await frames(page);
      await page.screenshot({ path: join(OUT, `lot-18-nuit-${nom}.png`) });
    }
  } finally {
    await context.close();
  }
});

test("les feuilles de la forêt", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, locale: "fr-FR" });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
  try {
    const page = await context.newPage();
    test.skip(!(await ouvrir(page, "/?module=vent-rafale&variante=0&debug&accueil=0")), "WebGL indisponible");
    const jusqua = (souffle: boolean, left: number) =>
      page.evaluate(([b, l]) => {
        const j = (window as unknown as { __jump: J }).__jump;
        for (let t = 0; t < 2000; t++) {
          const g = j.wind!.list[0]!.gust!;
          const q = (((j.wind!.phases[0]! + g.shift) % g.cycle) + g.cycle) % g.cycle;
          const souffle = q < g.active;
          const restant = souffle ? g.active - q : g.cycle - q;
          if (souffle === b && restant === l) return true;
          j.advance(1);
        }
        return false;
      }, [souffle, left] as const);
    const vues: [string, boolean, number][] = [
      ["1-fremissement", false, 24],
      ["2-pleine-vitesse", true, 80],
      ["3-ralentit", true, 24],
      ["4-a-larret", false, 100],
    ];
    for (const [nom, souffle, restant] of vues) {
      await jusqua(souffle, restant);
      await frames(page);
      await page.screenshot({ path: join(OUT, `lot-18-foret-${nom}.png`) });
    }
  } finally {
    await context.close();
  }
});
