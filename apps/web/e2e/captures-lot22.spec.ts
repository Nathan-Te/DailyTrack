import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { CELL, SIGNATURE_FIGURE, THEMES, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, stepRace, themeForDay, type PilotRun, type ThemeName, type Track } from "@cdj/sim";

// Captures du README du lot 22 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot22`. Une image par nouveau thème : la
// voiture du pilote d'auteur juste avant le passage signature du thème (paroi et long saut, lacets, angles droits). Rendu logiciel : lent.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(600_000);

const OUT = join(import.meta.dirname, "../../../docs/lots/img");

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

async function shoot(page: import("@playwright/test").Page, url: string, code: string, tick: number, file: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 600; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(60, tick - at));
  }
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.manual(false));
  await page.waitForTimeout(500);
  await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
  writeFileSync(join(OUT, file), await page.screenshot());
}

const LEAD: Record<string, number> = { canyon: 170, col: 90, ville: 110 };

test("une capture par nouveau thème (Canyon, Col alpin, Ville)", async ({ page }) => {
  const from = daysFromCivil(2026, 10, 10);
  for (const name of ["canyon", "col", "ville"] as ThemeName[]) {
    let day = from;
    while (themeForDay(day).name !== name) day++;
    const c = dailyCircuit(day);
    const run = bestPilotRun(c.track)!;
    expect(run).toBeTruthy();
    const sig = c.figures.find((f) => f.name === SIGNATURE_FIGURE[THEMES[name].signature]);
    const tick = momentAtBlock(c.track, run, sig ? sig.from + 1 : 8, LEAD[name]!);
    await shoot(page, `/?debug&seed=${formatDay(day)}&quality=2&ghost=off&shake=0&fx=off`, encodeReplay(run.replay), tick, `lot-22-${name}.png`);
    console.info(`${name} : ?seed=${formatDay(day)}`);
  }
});
