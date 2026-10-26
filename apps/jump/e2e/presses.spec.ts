import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { dailyLevel, pressModuleIds } from "@cdj/jump-sim";
import { generatedDay } from "./jours";
import { hasWebGL } from "./phone";

// Lot 22 — les presses dans le vrai jeu : une presse dessinée là où la simulation la met, qui frémit pendant les 0,5 s avant sa chute pendant que son empreinte
// s'assombrit, la galerie `?modules` qui les filtre, et le niveau du jour d'usine dont la preuve de l'auteur passe sous les presses sans mourir. Tout se lit en pas à
// pas (`manual` + `advance`), jamais sur une durée.

interface PressesDebug {
  count: number;
  y?: number[];
  warn?: number[];
  footprint?: number[];
  dust?: number[];
  opacity?: number;
  /** La simulation : rectangles mortels (unités), phase de la section. */
  sim: { x: number; y: number; w: number; h: number }[];
  phases: number[];
}
interface J {
  phase: string;
  presses: PressesDebug | null;
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  autoplay(code?: string): number;
}

const T = 4096;

async function open(page: Page, search: string): Promise<boolean> {
  await page.goto(`/${search}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
  return true;
}

test("un morceau à presse (`?module=presse-promenade`) : la presse est dessinée où la simulation la met, frémit avant de tomber, son empreinte s'assombrit", async ({ page }) => {
  test.skip(!(await open(page, "?module=presse-promenade&variante=1&entree=arret&debug")), "pas de WebGL dans ce navigateur");
  const HOLD = 240; // variante 1 : la première presse attend 240 pas en haut
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.restart();
    // Le monde attend la première commande (morceau seul, version 3) : une direction lance l'horloge de la section dès que le personnage y entre.
    j.input(2);
  });
  await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.phase === "ready");
  // Quelques pas jusqu'à ce que la section soit en marche (phase > 0), puis on se place à 30 pas de la fin de l'attente : la moitié de l'annonce.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(30));
  const phase = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.presses!.phases[0]!);
  expect(phase).toBeGreaterThan(0);
  const early = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.presses!.sim[0]!);
  await page.evaluate((n) => (window as unknown as { __jump: J }).__jump.advance(n), HOLD - 30 - phase);
  // `advance` joue sans rendu : le dessin rattrape la simulation à l'image suivante. On attend cet état (jamais une durée), puis on le lit d'un bloc.
  await page.waitForFunction((hold) => {
    const p = (window as unknown as { __jump: J }).__jump.presses;
    return !!p && p.phases[0] === hold - 30 && Math.abs((p.warn?.[0] ?? -1) - 0.5) < 1e-9;
  }, HOLD);
  const mid = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.presses!);
  // L'annonce dessinée est celle de la simulation (30 pas sur 60), l'empreinte est plus sombre qu'au repos, la presse n'a pas bougé.
  expect(mid.warn![0]).toBeCloseTo(0.5, 9);
  expect(mid.footprint![0]).toBeGreaterThan(0.08);
  expect(mid.sim[0]!.y).toBe(early.y);
  // Jusqu'à l'impact : la chute part au pas prévu (60 pas : 30 d'attente puis 30 de chute), le dessin pose la presse où la simulation la met, des poussières montent.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(30 + 30));
  await page.waitForFunction((unit) => {
    const p = (window as unknown as { __jump: J }).__jump.presses;
    return !!p && p.sim[0]!.y > 0 && Math.abs(p.y![0]! - p.sim[0]!.y / unit) < 1e-6 && (p.dust?.[0] ?? 0) > 0;
  }, T);
  const down = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.presses!);
  expect(down.sim[0]!.y).toBeGreaterThan(early.y);
  expect(down.opacity).toBe(1);
});

test("la galerie `?modules` filtre par l'étiquette « presse » : au moins six morceaux", async ({ page }) => {
  await page.goto("/?modules&debug");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
  await page.selectOption('select[name="etiquette"]', "presse");
  await page.waitForFunction(() => {
    const g = (window as unknown as { __jump: { gallery: { shown: number; filter: { tag: string | null } } } }).__jump.gallery;
    return g.filter.tag === "presse";
  });
  const shown = await page.evaluate(() => (window as unknown as { __jump: { gallery: { shown: number } } }).__jump.gallery.shown);
  expect(shown).toBeGreaterThanOrEqual(6);
  await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(shown);
});

/** Un jour sans fichier figé dont le niveau (g16, v6) a au moins deux morceaux à presses. */
function dayWithPresses(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 60; k++, day++) {
    const d = dailyLevel(day);
    if (d.pieces.filter((p) => pressModuleIds().has(p.id)).length >= 2) return d.date;
  }
  throw new Error("aucun jour généré avec deux morceaux à presses");
}

test("niveau du jour d'usine (v6) : la preuve de l'auteur, jouée pas à pas dans la page, passe sous les presses et arrive sans mourir", async ({ page }) => {
  const date = dayWithPresses();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(6);
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const total = j.autoplay(code);
    let deaths = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if (j.attempt.status === "mort") deaths++;
    }
    return { deaths, presses: j.presses?.count ?? 0 };
  }, daily.code);
  expect(result.presses).toBeGreaterThanOrEqual(2);
  expect(result.deaths).toBe(0);
});
