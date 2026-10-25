import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { CELL, FIGURES_LOT49, bestPilotRun, cellKey, createAutopilot, createFigureTrack, createRace, encodeReplay, figureByName, stepRace, type PilotRun, type Track } from "@cdj/sim";

// Lot 49 (outil, pas un test de CI) : une image de chaque nouvelle figure (variante 1, caméra loin), sur la palette de son thème. Pour un saut : quand la
// voiture vole ; sinon : au troisième bloc de la figure.
//   CAPTURES=1 npx playwright test captures-lot49 --project=chromium   → docs/lots/lot-49-identite/captures/
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(1_800_000);
test.use({ viewport: { width: 640, height: 360 } });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-49-identite/captures");
const SCENE_SEULE = "body > *:not(canvas) { visibility: hidden !important; }";

/** Le pas à montrer : le milieu du premier vol (un saut), ou l'entrée dans le troisième bloc de la figure (six blocs de lancement devant elle). */
function moment(track: Track, run: PilotRun, saut: boolean): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    if (saut && !race.car.grounded && race.car.air >= 40) return t;
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    if (!saut && b && b.index >= 8) return t;
  }
  return Math.floor(run.ticks / 2);
}

async function image(page: Page, url: string, code: string, tick: number, file: string) {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.keyboard.press("c");
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 1200; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : tick - at > 120 ? Math.min(30, tick - at - 120) : Math.min(2, tick - at));
  }
  await page.keyboard.press("p");
  await page.waitForFunction(() => window.__cdj.paused);
  await page.evaluate(() => window.__cdj.manual(false));
  await page.addStyleTag({ content: SCENE_SEULE });
  await page.waitForTimeout(900);
  writeFileSync(file, await page.screenshot({ type: "jpeg", quality: 85 }));
}

for (const nom of FIGURES_LOT49) {
  test(`capture : ${nom}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const track = createFigureTrack(nom, 0, false)!;
    const run = bestPilotRun(track)!;
    const tick = moment(track, run, !!figureByName(nom)!.jump);
    await image(page, `/?debug&scenario=figure-${nom}&quality=2&ghost=off&shake=0&home=0`, encodeReplay(run.replay), tick, join(OUT, `${nom}.jpg`));
  });
}
