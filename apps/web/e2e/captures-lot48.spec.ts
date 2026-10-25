import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { CELL, bestPilotRun, cellKey, createAutopilot, createHerbeTrack, createRace, dailyCircuit, encodeReplay, parseDay, stepRace, type BlockSurface, type PilotRun, type Track } from "@cdj/sim";

// Lot 48 (outil, pas un test de CI) : l'herbe de course de la Campagne, avant / après. Pour chaque circuit : au premier bloc d'herbe, depuis la voiture (caméra
// proche) et de plus haut (caméra loin), plus la miniature aérienne (vue de haut).
//   (avant) `main` servi à côté : npx vite preview --port 4174 --outDir <dist de main>
//   CAPTURES=1 LABEL=avant BASE=http://localhost:4174 npx playwright test captures-lot48 --project=chromium   → docs/lots/lot-48/avant/
//   CAPTURES=1 LABEL=apres npx playwright test captures-lot48 --project=chromium                              → docs/lots/lot-48/apres/
// « Avant » : le 25/10/2026 (Campagne v15, une zone d'herbe d'avant) ; « après » : le même jour (le décor plus sombre autour de l'herbe d'avant), le 04/11/2026
// (le premier jour de la v17, sur l'herbe de course) et le scénario `herbe`.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(1_800_000);
test.use({ viewport: { width: 640, height: 360 } });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-48");
const BASE = process.env.BASE ?? "";
const LABEL = process.env.LABEL ?? "apres";
const SCENE_SEULE = "body > *:not(canvas) { visibility: hidden !important; }";

/** Le pas où le pilote entre dans le premier bloc de ce revêtement (un peu avant). */
function auRevetement(track: Track, run: PilotRun, surface: BlockSurface): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    if (b?.surface === surface) return t + 40;
  }
  return Math.floor(run.ticks / 3);
}

async function image(page: Page, url: string, code: string, tick: number, file: string, loin: boolean) {
  await page.goto(BASE + url);
  await page.waitForFunction(() => window.__cdj?.phase);
  if (loin) await page.keyboard.press("c");
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
  writeFileSync(file, await page.screenshot({ type: "jpeg", quality: 88 }));
}

const CAS = [
  { nom: "campagne-2026-10-25", date: "2026-10-25", surface: "grass" as BlockSurface, avant: true },
  { nom: "campagne-2026-11-04", date: "2026-11-04", surface: "turf" as BlockSurface, avant: false },
  { nom: "scenario-herbe", date: null, surface: "turf" as BlockSurface, avant: false },
];

for (const cas of CAS) {
  test(`captures ${LABEL} : ${cas.nom}`, async ({ page }) => {
    test.skip(LABEL === "avant" && !cas.avant, "pas d'« avant » pour l'herbe de course");
    const dir = join(OUT, LABEL);
    mkdirSync(dir, { recursive: true });
    const track = cas.date ? dailyCircuit(parseDay(cas.date)!).track : createHerbeTrack();
    const run = bestPilotRun(track)!;
    const tick = auRevetement(track, run, cas.surface);
    const url = cas.date ? `/?debug&seed=${cas.date}&quality=2&ghost=off&shake=0&home=0` : `/?debug&scenario=herbe&quality=2&ghost=off&shake=0&home=0`;
    await image(page, url, encodeReplay(run.replay), tick, join(dir, `${cas.nom}-voiture.jpg`), false);
    await image(page, url, encodeReplay(run.replay), tick, join(dir, `${cas.nom}-loin.jpg`), true);
    if (cas.date) {
      await page.goto(`${BASE}/?debug&seed=${cas.date}&home=0&thumbs=off`);
      await page.waitForFunction(() => window.__cdj?.phase);
      const octets = await page.evaluate(async (date) => {
        const r = await window.__cdj.thumbnail(date, { scale: 1 });
        return Array.from(new Uint8Array(await (await fetch(r.url)).arrayBuffer()));
      }, cas.date);
      writeFileSync(join(dir, `${cas.nom}-de-haut.png`), Buffer.from(octets));
    }
  });
}
