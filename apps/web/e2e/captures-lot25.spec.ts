import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { CELL, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, isCurve, stepRace, type Block, type PilotRun, type Track } from "@cdj/sim";

// Captures du README du lot 25 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot25` (dans apps/web). Une image par thème
// reformé (Rallye, Canyon, Banquise, Col alpin), sur le circuit du jour du lien « À tester », au moment qui montre son format ; plus la vue
// de départ plongeante du Col. Rendu logiciel : lent.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(900_000);

const OUT = join(import.meta.dirname, "../../../docs/lots/img");

/** Pas de la course du pilote où la voiture entre pour la `skip`+1-ième fois dans un bloc qui vérifie `hit`, moins `lead` pas. */
function momentOf(track: Track, run: PilotRun, hit: (b: Block) => boolean, lead = 60, skip = 0): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  let seen = 0;
  let inside = false;
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    const now = !!b && hit(b);
    if (now && !inside && seen++ >= skip) return Math.max(60, t - lead);
    inside = now;
  }
  return Math.floor(run.ticks / 3);
}

async function shoot(page: import("@playwright/test").Page, url: string, code: string, tick: number, file: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 400; guard++) {
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

const SHOTS: { name: string; date: [number, number, number]; hit: (b: Block) => boolean; lead?: number; skip?: number }[] = [
  // Rallye : dans la spéciale, virages enchaînés sur la terre.
  { name: "rallye", date: [2026, 10, 13], hit: (b) => isCurve(b.kind) && b.surface === "dirt", lead: 30, skip: 1 },
  // Canyon : au bord de la rampe d'un long saut.
  { name: "canyon", date: [2026, 10, 10], hit: (b) => b.kind === "gap", lead: 40 },
  // Banquise : une grande courbe sur la glace.
  { name: "banquise", date: [2026, 11, 2], hit: (b) => isCurve(b.kind) && b.surface === "ice", lead: 40, skip: 1 },
  // Col alpin : en pleine descente raide, avant une épingle.
  { name: "col", date: [2026, 10, 12], hit: (b) => b.kind === "down" && b.rise <= -12, lead: 20, skip: 2 },
];

test("une capture par thème reformé, et la vue de départ du Col", async ({ page }) => {
  for (const s of SHOTS) {
    const c = dailyCircuit(daysFromCivil(...s.date));
    expect(c.theme).toBe(s.name);
    const run = bestPilotRun(c.track)!;
    await shoot(page, `/?debug&seed=${c.date}&quality=2&ghost=off&shake=0&fx=off`, encodeReplay(run.replay), momentOf(c.track, run, s.hit, s.lead, s.skip), `lot-25-${s.name}.png`);
  }
  // La vue de départ plongeante : pendant le décompte, mise en pause tout de suite.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?debug&seed=2026-10-12&quality=2&ghost=off&shake=0&fx=off");
  await page.waitForFunction(() => window.__cdj?.phase === "countdown");
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(800);
  const cam = await page.evaluate(() => window.__cdj.camera as unknown as { plunge: number; y: number });
  expect(cam.plunge).toBeGreaterThan(0.9);
  await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
  writeFileSync(join(OUT, "lot-25-col-depart.png"), await page.screenshot());
});
