import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { CELL, THEMES, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, stepRace, themeForDay, type PilotRun, type ThemeName, type Track } from "@cdj/sim";

// Captures du README du lot 23 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot23` (`OUT=…` change le dossier).
// Une image par thème : la voiture du pilote d'auteur un peu avant le premier panneau de direction, puis une capture en caméra capot.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/img");
mkdirSync(OUT, { recursive: true });

/** Pas de la course du pilote où la voiture arrive au bloc `block`, moins `lead` pas. */
function momentAtBlock(track: Track, run: PilotRun, block: number, lead: number): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    if (b && b.index >= block) return Math.max(60, t - lead);
  }
  return Math.floor(run.ticks / 3);
}

async function shoot(page: import("@playwright/test").Page, url: string, code: string, tick: number, file: string, width = 1280, height = 720, camera = "") {
  await page.setViewportSize({ width, height });
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  if (camera) await page.evaluate((c) => localStorage.setItem("cdj:camera", c), camera);
  if (camera) await page.reload().then(() => page.waitForFunction(() => window.__cdj?.phase));
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 900; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(30, tick - at));
  }
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.manual(false));
  await page.waitForTimeout(700);
  await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
  writeFileSync(join(OUT, file), await page.screenshot());
}

const NAMES = Object.keys(THEMES) as ThemeName[];
const ONLY = process.env.ONLY?.split(",");

test("une capture par thème", async ({ page }) => {
  const from = daysFromCivil(2026, 10, 10);
  for (const name of NAMES) {
    if (ONLY && !ONLY.includes(name)) continue;
    let day = from;
    while (themeForDay(day).name !== name) day++;
    const c = dailyCircuit(day);
    const run = bestPilotRun(c.track)!;
    expect(run).toBeTruthy();
    // Le premier virage du circuit : son panneau est posé juste avant.
    const curve = c.track.blocks.filter((b, i) => i > 2 && /^(curve|wide|grand)/.test(b.kind))[Number(process.env.SIGN ?? 0)];
    const tick = momentAtBlock(c.track, run, curve ? curve.index - 1 : 6, Number(process.env.LEAD ?? 90));
    await shoot(page, `/?debug&seed=${formatDay(day)}&quality=${process.env.Q ?? 2}&ghost=off&shake=0&fx=off`, encodeReplay(run.replay), tick, `lot-23-${name}.png`);
    console.info(`${name} : ?seed=${formatDay(day)}`);
  }
});

test("caméra capot", async ({ page }) => {
  const day = daysFromCivil(2026, 10, 10);
  let d = day;
  while (themeForDay(d).name !== "stade") d++;
  const c = dailyCircuit(d);
  const run = bestPilotRun(c.track)!;
  const tick = momentAtBlock(c.track, run, 6, 40);
  await shoot(page, `/?debug&seed=${formatDay(d)}&quality=2&ghost=off&shake=0&fx=off`, encodeReplay(run.replay), tick, "lot-23-capot.png", 1280, 720, "capot");
});
