import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { BLOCS_LOT58, CELL, bestPilotRun, cellKey, createAutopilot, createFigureTrack, createRace, encodeReplay, stepRace, type PilotRun, type Track } from "@cdj/sim";

// Lot 58 (outil, pas un test de CI) : les prototypes des blocs plus complexes. Pour chacun, deux images : l'approche (≈ 1 s avant le premier bloc
// nouveau : sa signalétique doit déjà se lire) et le passage (≈ 0,6 s après son entrée). Caméra loin.
//   CAPTURES=1 npx playwright test captures-lot58 --project=chromium   → docs/lots/lot-58-blocs-complexes/captures/
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(1_800_000);
test.use({ viewport: { width: 640, height: 360 } });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-58-blocs-complexes/captures");
const SCENE_SEULE = "body > *:not(canvas) { visibility: hidden !important; }";

/** Le pas où la voiture entre dans le premier bloc nouveau (effet, bombé, très relevé, eau). */
function entree(track: Track, run: PilotRun): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    if (b && (b.fx !== undefined || b.crown || b.steep || b.surface === "water")) return t;
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

for (const e of BLOCS_LOT58) {
  for (let v = 0; v < e.variants; v++) {
    test(`capture : ${e.name} v${v}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      const track = createFigureTrack(e.name, v, false)!;
      const run = bestPilotRun(track)!;
      const code = encodeReplay(run.replay);
      const url = `/?debug&scenario=${e.name}${v ? `&v=${v}` : ""}&quality=2&ghost=off&shake=0&home=0`;
      const t = entree(track, run);
      await image(page, url, code, Math.max(1, t - 120), join(OUT, `${e.name}-v${v}-approche.jpg`));
      await image(page, url, code, t + 72, join(OUT, `${e.name}-v${v}-passage.jpg`));
    });
  }
}
