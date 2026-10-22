import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { dailyLevel, decodeReplay, type DailyLevel } from "@cdj/jump-sim";
import { generatedDay } from "./jours";
import { hasWebGL } from "./phone";

// Lot 16 — la seconde voie dans le jeu. Un niveau du jour généré (g11) qui a une voie lente : la page la connaît (`__jump.daily.slowRoutes`,
// mêmes temps que le générateur), et la voie lente enregistrée, jouée pas à pas dans la vraie page, passe la portion dure par la cage et la
// galerie sans mourir et rejoint le parcours au palier suivant ; avec `?debug`, la surimpression dit les deux temps.

interface J {
  phase: string;
  attempt: { status: string; time: number; deaths: number; checkpoint: number };
  player: { x: number; y: number };
  daily: { id: string; slowTicks: number; authorTicks: number; slowRoutes: { piece: number; zone: number; fastTicks: number; slowTicks: number; code: string }[] } | null;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  go(): void;
}

/** Un jour généré (sans fichier figé) dont le niveau a au moins une voie lente. */
function dayWithSlowRoute(): DailyLevel {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 30; k++, day++) if (dailyLevel(day).slowRoutes.length > 0) return dailyLevel(day);
  throw new Error("aucun jour généré avec une voie lente");
}

async function open(page: Page, date: string): Promise<boolean> {
  await page.goto(`./?seed=${date}&debug&accueil=0`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  return true;
}

test("une voie lente jouée pas à pas dans la page : par la cage et la galerie, sans mourir, jusqu'au palier suivant ; la page a les mêmes voies et temps que le générateur", async ({ page }) => {
  const L = dayWithSlowRoute();
  test.skip(!(await open(page, L.date)), "pas de WebGL dans ce navigateur");
  const daily = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.daily);
  expect(daily!.id).toBe(L.id);
  expect(daily!.slowTicks).toBe(L.slowTicks);
  expect(daily!.slowRoutes.map((r) => [r.piece, r.zone, r.fastTicks, r.slowTicks, r.code])).toEqual(L.slowRoutes.map((r) => [r.piece, r.zone, r.fastTicks, r.slowTicks, r.code]));
  const r = L.slowRoutes[0]!;
  // Départ donné tout de suite (pas de « Prêt… » à attendre), puis la rediffusion de la voie lente, série par série.
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.go();
  });
  const runs = decodeReplay(r.code).runs;
  let top = Infinity;
  let played = 0;
  for (const run of runs) {
    const s = await page.evaluate(
      ([bits, count]) => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.input(bits);
        j.advance(count);
        return { attempt: j.attempt, player: j.player };
      },
      [run.bits, run.count] as const,
    );
    played += run.count;
    if (played > r.fork) top = Math.min(top, s.player.y);
    expect(s.attempt.deaths, `pas ${played}`).toBe(0);
  }
  const end = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { attempt: j.attempt, player: j.player };
  });
  // Au bout : au-delà du palier où la voie rejoint le parcours (son point de passage pris), sans mort, au chrono de la voie enregistrée.
  expect(end.player.x + 0.375).toBeGreaterThan(r.palierOut.col1 + 1);
  expect(end.attempt.time).toBe(r.fork + r.slowTicks);
  // Elle est passée au-dessus du haut du morceau contourné (la galerie).
  expect(top).toBeLessThan(L.pieces[r.piece]!.top);
});
