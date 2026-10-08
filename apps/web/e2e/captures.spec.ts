import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { CELL, THEME_NAMES, bestPilotRun, cellKey, createAutopilot, createBasCotesTrack, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, isCurve, stepRace, themeForDay, type PilotRun, type Track } from "@cdj/sim";

// Captures du README du lot 21 (outil, pas un test) : `CAPTURES=1 npm run e2e -w @cdj/web -- captures`. Une image par thème (un circuit du
// jour, la voiture du pilote d'auteur juste avant un virage bordé de son bas-côté), plus le scénario `bas-cotes`. Rendu logiciel : lent.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(600_000);

const OUT = join(import.meta.dirname, "../../../docs/lots/img");

/** Pas de la course du pilote où la voiture arrive au premier virage bordé (bas-côté, ou vide pour Nuit), moins `lead` pas. */
function momentOf(track: Track, run: PilotRun, lead = 70, skip = 0): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  let seen = 0;
  let inside = false;
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    const hit = !!b && isCurve(b.kind) && (!!b.shoulder || b.open);
    if (hit && !inside && seen++ >= skip) return Math.max(60, t - lead);
    inside = hit;
  }
  return Math.floor(run.ticks / 3);
}

async function shoot(page: import("@playwright/test").Page, url: string, code: string, tick: number, file: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  // Décompte, puis la course jusqu'au pas visé (le rendu suit chaque avance en mode pas à pas).
  for (let guard = 0; guard < 400; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(60, tick - at));
  }
  // Le pas à pas ne dessine pas : on met en pause (le jeu dessine mais n'avance plus), on cache le panneau de pause, on capture.
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.manual(false));
  await page.waitForTimeout(500);
  await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
  console.info(file, tick, await page.evaluate(() => JSON.stringify({ x: window.__cdj.car.x, z: window.__cdj.car.z, t: (window.__cdj.car as unknown as { tick: number }).tick, phase: window.__cdj.phase })));
  writeFileSync(join(OUT, file), await page.screenshot());
}

test("une capture par thème, et le scénario bas-cotes", async ({ page }) => {
  const from = daysFromCivil(2026, 10, 10);
  for (const name of ["stade", "nuit", ...THEME_NAMES.filter((n) => n !== "stade" && n !== "nuit")]) {
    let day = from;
    while (themeForDay(day).name !== name) day++;
    const c = dailyCircuit(day);
    const run = bestPilotRun(c.track)!;
    expect(run).toBeTruthy();
    const tick = momentOf(c.track, run);
    await shoot(page, `/?debug&seed=${formatDay(day)}&quality=2&ghost=off&shake=0&fx=off`, encodeReplay(run.replay), tick, `lot-21-${name}.png`);
    console.info(`${name} : ?seed=${formatDay(day)}`);
  }
  const t = createBasCotesTrack();
  const run = bestPilotRun(t)!;
  for (const [k, label] of [[0, "herbe"], [2, "neige"], [3, "vide"]] as const) {
    await shoot(page, "/?debug&scenario=bas-cotes&quality=2&shake=0&fx=off", encodeReplay(run.replay), momentOf(t, run, 60, k), `lot-21-bas-cotes-${label}.png`);
  }
});
