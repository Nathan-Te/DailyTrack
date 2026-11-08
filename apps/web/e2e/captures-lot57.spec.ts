import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { GRAMMAIRE_LOT57, bestPilotRun, createAutopilot, createFigureTrack, createRace, encodeReplay, stepRace, type PilotRun, type Track } from "@cdj/sim";

// Lot 57 (outil, pas un test de CI) : la grammaire des sauts et des transitions. Pour chaque saut, deux images : l'appel (un peu avant le bord : on doit
// y voir la réception) et la réception (juste avant le contact) ; pour une transition, une image au milieu de l'élément. Caméra loin.
//   CAPTURES=1 npx playwright test captures-lot57 --project=chromium   → docs/lots/lot-57-sauts-transitions/captures/
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(1_800_000);
test.use({ viewport: { width: 640, height: 360 } });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-57-sauts-transitions/captures");
const SCENE_SEULE = "body > *:not(canvas) { visibility: hidden !important; }";

/** Les pas à montrer : décollage − 0,3 s et contact − 0,1 s du premier vrai vol ; sans vol, le milieu de la course. */
function moments(track: Track, run: PilotRun): { appel: number; reception: number } | { milieu: number } {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  let depart = -1;
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    if (!race.car.grounded && depart < 0) depart = t;
    if (race.car.grounded && depart >= 0) {
      if (t - depart > 30) return { appel: Math.max(1, depart - 36), reception: Math.max(1, t - 12) };
      depart = -1;
    }
  }
  return { milieu: Math.floor(run.ticks * 0.55) };
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

for (const e of GRAMMAIRE_LOT57) {
  test(`capture : ${e.name}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const track = createFigureTrack(e.name, 0, false)!;
    const run = bestPilotRun(track)!;
    const code = encodeReplay(run.replay);
    const url = `/?debug&scenario=${e.name}&quality=2&ghost=off&shake=0&home=0`;
    const m = moments(track, run);
    if ("appel" in m) {
      await image(page, url, code, m.appel, join(OUT, `${e.name}-appel.jpg`));
      await image(page, url, code, m.reception, join(OUT, `${e.name}-reception.jpg`));
    } else await image(page, url, code, m.milieu, join(OUT, `${e.name}.jpg`));
  });
}
