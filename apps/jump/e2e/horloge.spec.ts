import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { dailyLevel } from "@cdj/jump-sim";
import { FROZEN_DATES, generatedDay, pageLevel } from "./jours";
import { hasWebGL } from "./phone";

// Lot 15 — l'horloge unique dans le jeu. Un niveau du jour en v4 (généré : un jour sans fichier figé) : le « Prêt… » (1 s) pendant lequel les
// dangers bougent déjà (dessinés au chrono négatif), puis le chrono part à heure fixe, que le joueur bouge ou non ; la pause fige tout. Un
// jour figé en v3 garde l'ancien départ (le monde attend la première commande). Tout se lit en pas à pas, sauf la pause (« rien ne change »).

interface J {
  phase: string;
  pret: { ticks: number; total: number; level: number };
  attempt: { status: string; time: number; saws: { x: number; y: number }[] };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  setMenu(open: boolean): void;
}

const jump = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { phase: j.phase, pret: j.pret, attempt: j.attempt };
  });

/**
 * Un jour dont le niveau, de la version demandée, a au moins une scie mobile : de quoi voir un danger bouger avant le départ. La v4 (horloge unique, générateurs
 * g10 à g14) ne se génère plus depuis le lot 20 : on prend un jour **figé** en v4 ; la v8 (stalactites, g18 ; v7 : champignons, g17 ; v6 : presses, g16 ; v5 : plateformes mobiles, g15) est celle d'un jour sans fichier figé.
 */
function dayWithSaw(version: 4 | 8): string {
  const movingSaw = (date: string) => pageLevel(date).level.saws.some((s) => s.cycle > 0);
  if (version === 4) {
    const date = FROZEN_DATES.filter((d) => pageLevel(d).level.simVersion === 4).find(movingSaw);
    if (!date) throw new Error("aucun jour figé en v4 avec une scie mobile");
    return date;
  }
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 30; k++, day++) if (dailyLevel(day).level.saws.some((s) => s.cycle > 0)) return dailyLevel(day).date;
  throw new Error("aucun jour généré avec une scie mobile");
}

async function open(page: Page, date: string): Promise<boolean> {
  await page.goto(`./?seed=${date}&debug&accueil=0`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  return true;
}

for (const version of [4, 8] as const) test(`niveau v${version} : pendant le « Prêt… » les dangers bougent déjà, puis le chrono part à heure fixe sans commande ; « recommencer » relance le « Prêt… »`, async ({ page }) => {
  const date = dayWithSaw(version);
  test.skip(!(await open(page, date)), "pas de WebGL dans ce navigateur");
  // Un « Prêt… » neuf : jusqu'à `manual(true)` la boucle tourne en temps réel et a pu en consommer une partie en se chargeant (WebKit : 20 pas).
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.restart();
  });
  const s0 = await jump(page);
  expect(s0.pret.level).toBe(version);
  expect(s0.pret.ticks).toBe(s0.pret.total);
  expect(s0.pret.total).toBe(120);
  expect(s0.attempt.time).toBe(-s0.pret.total);
  // Avant le départ : le chrono (de l'état montré) est négatif, la partie n'a pas commencé, mais au moins une scie a bougé.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(30));
  const s1 = await jump(page);
  expect(s1.attempt.time).toBe(-s0.pret.total + 30);
  expect(s1.attempt.status).toBe("attend");
  expect(s1.phase).toBe("ready");
  expect(s1.attempt.saws).not.toEqual(s0.attempt.saws);
  // Fin du « Prêt… » : le chrono part, sans aucune commande.
  await page.evaluate((n) => (window as unknown as { __jump: J }).__jump.advance(n), s0.pret.total - 30);
  const s2 = await jump(page);
  expect([s2.pret.ticks, s2.attempt.time]).toEqual([0, 0]);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(0);
    j.advance(12);
  });
  const s3 = await jump(page);
  expect([s3.attempt.status, s3.attempt.time]).toEqual(["course", 12]);
  // Recommencer : un nouveau « Prêt… » (chrono négatif), l'horloge repart de là.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.restart());
  const s4 = await jump(page);
  expect([s4.pret.ticks, s4.attempt.time]).toEqual([s0.pret.total, -s0.pret.total]);
});

for (const version of [4, 8] as const) test(`niveau v${version} : la pause fige tout, « Prêt… » compris ; le « Prêt… » reprend à la fermeture`, async ({ page }) => {
  const date = dayWithSaw(version);
  test.skip(!(await open(page, date)), "pas de WebGL dans ce navigateur");
  // Un « Prêt… » neuf (la page a pu le consommer en se chargeant), puis la pause tout de suite, boucle en temps réel.
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.restart();
    j.setMenu(true);
    j.manual(false);
  });
  const before = await jump(page);
  expect(before.pret.ticks).toBe(before.pret.total);
  // « Rien ne doit changer pendant N ms » : la seule attente sur une durée permise.
  await page.waitForTimeout(500);
  const after = await jump(page);
  expect(after.pret.ticks).toBe(before.pret.ticks);
  expect(after.attempt.saws).toEqual(before.attempt.saws);
  expect(after.attempt.time).toBe(before.attempt.time);
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.setMenu(false));
  await page.waitForFunction((t) => (window as unknown as { __jump: J }).__jump.pret.ticks < t, before.pret.ticks);
});

test("jour figé en v3 : pas de « Prêt… », le monde attend la première commande (comportement d'avant le lot 15)", async ({ page }) => {
  // Lot 16 : le dernier jour figé peut être en v4 (un jour figé par un générateur g10 ou plus) : on prend le dernier figé en v3.
  const date = FROZEN_DATES.filter((d) => pageLevel(d).level.simVersion === 3).at(-1)!;
  test.skip(!(await open(page, date)), "pas de WebGL dans ce navigateur");
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.input(0);
    j.advance(60);
  });
  const s = await jump(page);
  expect(s.pret).toMatchObject({ ticks: 0, level: 3 });
  expect([s.attempt.status, s.attempt.time]).toEqual(["attend", 0]);
});
