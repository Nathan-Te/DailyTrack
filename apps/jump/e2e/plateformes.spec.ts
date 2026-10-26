import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { dailyLevel } from "@cdj/jump-sim";
import { generatedDay } from "./jours";
import { hasWebGL } from "./phone";

// Lot 20 — les plateformes mobiles dans le vrai jeu : une dalle dessinée là où la simulation la met, qui avance avec le chrono (pas à pas), des chevrons dont le
// sens et la vitesse suivent le ralenti de la table, la galerie `?modules` qui les filtre, et le niveau du jour (v5) dont la preuve de l'auteur est portée par
// une plateforme. Tout se lit en pas à pas (`manual` + `advance`), jamais sur une durée.

interface PlatformsDebug {
  count: number;
  /** Ce que le dessin a posé (tuiles) : position, vitesse en part de la pointe, sens du chevron, opacité. */
  x?: number[];
  y?: number[];
  speed?: number[];
  dir?: number[];
  opacity?: number;
  /** La simulation : unités, phase de la section, plateforme qui porte le personnage (−1 : aucune). */
  sim: { x: number; y: number }[];
  phases: number[];
  ride: number;
}
interface J {
  phase: string;
  platforms: PlatformsDebug | null;
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  go?(): void;
  autoplay(code?: string): number;
}

const T = 4096;
const state = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { phase: j.phase, platforms: j.platforms, attempt: j.attempt };
  });

async function open(page: Page, search: string): Promise<boolean> {
  await page.goto(`/${search}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
  return true;
}

test("un morceau à plateforme (`?module=chaland`) : la dalle est dessinée où la simulation la met, avance avec le chrono, ses chevrons suivent le ralenti", async ({ page }) => {
  test.skip(!(await open(page, "?module=chaland&variante=2&entree=arret&debug")), "pas de WebGL dans ce navigateur");
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.restart();
    // Le monde attend la première commande (morceau seul, version 3) : une direction suffit à lancer l'horloge de la section.
    j.input(2);
  });
  await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.phase === "ready");
  const s0 = await state(page);
  expect(s0.platforms!.count).toBe(2);
  expect(s0.platforms!.sim).toHaveLength(2);
  // Une section démarre à l'entrée du personnage : quelques pas, puis les dalles ont bougé et le dessin les a posées au même endroit que la simulation.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(20));
  const early = await state(page);
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(40));
  // `advance` joue sans rendu : le dessin rattrape la simulation à l'image suivante. On attend cet état (jamais une durée), puis on le lit d'un bloc.
  await page.waitForFunction((unit) => {
    const p = (window as unknown as { __jump: J }).__jump.platforms;
    return !!p && p.sim.every((q, i) => Math.abs(p.x![i]! - q.x / unit) < 1e-6 && Math.abs(p.y![i]! - q.y / unit) < 1e-6);
  }, T);
  const later = await state(page);
  expect(later.platforms!.sim).not.toEqual(early.platforms!.sim);
  later.platforms!.sim.forEach((p, i) => {
    expect(later.platforms!.x![i]).toBeCloseTo(p.x / T, 6);
    expect(later.platforms!.y![i]).toBeCloseTo(p.y / T, 6);
  });
  // Les chevrons : un sens (1 vers la droite pour la dalle du bas, −1 vers la gauche pour celle du haut) et une vitesse entre 0 et 1.
  expect(later.platforms!.dir).toEqual([1, -1]);
  for (const v of later.platforms!.speed!) expect(v).toBeGreaterThan(0);
  for (const v of later.platforms!.speed!) expect(v).toBeLessThanOrEqual(1);
  expect(later.platforms!.opacity).toBe(1);
});

test("la galerie `?modules` filtre par l'étiquette « plateforme mobile » : au moins six morceaux", async ({ page }) => {
  await page.goto("/?modules&debug");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
  await page.selectOption('select[name="etiquette"]', "plateforme");
  await page.waitForFunction(() => {
    const g = (window as unknown as { __jump: { gallery: { shown: number; filter: { tag: string | null } } } }).__jump.gallery;
    return g.filter.tag === "plateforme";
  });
  const shown = await page.evaluate(() => (window as unknown as { __jump: { gallery: { shown: number } } }).__jump.gallery.shown);
  expect(shown).toBeGreaterThanOrEqual(6);
  await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(shown);
});

/** Un jour sans fichier figé dont le niveau (v6, g16) a une plateforme. */
function dayWithPlatform(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 40; k++, day++) if (dailyLevel(day).level.platforms.length > 0) return dailyLevel(day).date;
  throw new Error("aucun jour généré avec une plateforme");
}

test("niveau du jour (v6 depuis le lot 22) à plateformes : la preuve de l'auteur, jouée pas à pas dans la page, est portée par une plateforme et arrive sans mourir", async ({ page }) => {
  const date = dayWithPlatform();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(6);
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    // La rediffusion part tout de suite (chrono 0) ; on la suit pas à pas et on note si une plateforme porte le personnage.
    const total = j.autoplay(code);
    let rode = 0;
    let deaths = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if ((j.platforms?.ride ?? -1) >= 0) rode++;
      if (j.attempt.status === "mort") deaths++;
    }
    return { rode, deaths, phase: j.phase, status: j.attempt.status };
  }, daily.code);
  expect(result.rode).toBeGreaterThan(0);
  expect(result.deaths).toBe(0);
});
