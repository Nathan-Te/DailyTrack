import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { dailyLevel, moduleSolutions, mushroomModuleIds, pressModuleIds, stalactiteModuleIds } from "@cdj/jump-sim";
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

test("niveau du jour (v8 depuis le lot 24) à plateformes : la preuve de l'auteur, jouée pas à pas dans la page, est portée par une plateforme et arrive sans mourir", async ({ page }) => {
  const date = dayWithPlatform();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(8); // lot 24 : le générateur en vigueur (g18) est en v8
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

// ——— Lot 22 : les presses (dans ce fichier : un spec de plus ne peut pas s'ajouter à `e2e/zones.json` depuis une PR de jeu) ———
// Une presse dessinée là où la simulation la met, qui frémit pendant les 0,5 s avant sa chute pendant que son empreinte s'assombrit, la galerie `?modules` qui
// les filtre, et le niveau du jour d'usine dont la preuve de l'auteur passe sous les presses sans mourir. Tout se lit en pas à pas, jamais sur une durée.

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
interface JP {
  phase: string;
  presses: PressesDebug | null;
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  autoplay(code?: string): number;
}


async function openP(page: Page, search: string): Promise<boolean> {
  return open(page, search);
}

test("un morceau à presse (`?module=presse-promenade`) : la presse est dessinée où la simulation la met, frémit avant de tomber, son empreinte s'assombrit", async ({ page }) => {
  test.skip(!(await openP(page, "?module=presse-promenade&variante=1&entree=arret&debug")), "pas de WebGL dans ce navigateur");
  const HOLD = 240; // variante 1 : la première presse attend 240 pas en haut
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: JP }).__jump;
    j.manual(true);
    j.restart();
    // Le monde attend la première commande (morceau seul, version 3) : une direction lance l'horloge de la section dès que le personnage y entre.
    j.input(2);
  });
  await page.waitForFunction(() => (window as unknown as { __jump: JP }).__jump.phase === "ready");
  // Quelques pas jusqu'à ce que la section soit en marche (phase > 0), puis on se place à 30 pas de la fin de l'attente : la moitié de l'annonce.
  await page.evaluate(() => (window as unknown as { __jump: JP }).__jump.advance(30));
  const phase = await page.evaluate(() => (window as unknown as { __jump: JP }).__jump.presses!.phases[0]!);
  expect(phase).toBeGreaterThan(0);
  const early = await page.evaluate(() => (window as unknown as { __jump: JP }).__jump.presses!.sim[0]!);
  await page.evaluate((n) => (window as unknown as { __jump: JP }).__jump.advance(n), HOLD - 30 - phase);
  // `advance` joue sans rendu : le dessin rattrape la simulation à l'image suivante. On attend cet état (jamais une durée), puis on le lit d'un bloc.
  await page.waitForFunction((hold) => {
    const p = (window as unknown as { __jump: JP }).__jump.presses;
    // `warn` vient de la simulation (lue à l'instant), `footprint` de la dernière image dessinée : on attend aussi que le dessin ait rattrapé.
    return !!p && p.phases[0] === hold - 30 && Math.abs((p.warn?.[0] ?? -1) - 0.5) < 1e-9 && (p.footprint?.[0] ?? 0) > 0.08;
  }, HOLD);
  const mid = await page.evaluate(() => (window as unknown as { __jump: JP }).__jump.presses!);
  // L'annonce dessinée est celle de la simulation (30 pas sur 60), l'empreinte est plus sombre qu'au repos, la presse n'a pas bougé.
  expect(mid.warn![0]).toBeCloseTo(0.5, 9);
  expect(mid.footprint![0]).toBeGreaterThan(0.08);
  expect(mid.sim[0]!.y).toBe(early.y);
  // Jusqu'à l'impact : la chute part au pas prévu (60 pas : 30 d'attente puis 30 de chute), le dessin pose la presse où la simulation la met, des poussières montent.
  await page.evaluate(() => (window as unknown as { __jump: JP }).__jump.advance(30 + 30));
  await page.waitForFunction((unit) => {
    const p = (window as unknown as { __jump: JP }).__jump.presses;
    return !!p && p.sim[0]!.y > 0 && Math.abs(p.y![0]! - p.sim[0]!.y / unit) < 1e-6 && (p.dust?.[0] ?? 0) > 0;
  }, T);
  const down = await page.evaluate(() => (window as unknown as { __jump: JP }).__jump.presses!);
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

test("niveau du jour d'usine (v8 depuis le lot 24) : la preuve de l'auteur, jouée pas à pas dans la page, passe sous les presses et arrive sans mourir", async ({ page }) => {
  const date = dayWithPresses();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await openP(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(8); // lot 24 : le générateur en vigueur (g18) est en v8
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: JP }).__jump;
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


// ——— Lot 23 : les champignons (dans ce fichier, pour la même raison) ———
// Un champignon dessiné où la simulation le met et tourné vers où il lance, qui s'écrase au rebond (plus fort sur un rebond renforcé) **sans secousse de caméra**, la galerie
// `?modules` qui les filtre, et le niveau du jour de forêt dont la preuve de l'auteur rebondit sur ses champignons sans mourir. Tout se lit en pas à pas.

interface MushroomsDebug {
  count: number;
  list: { col: number; row: number; dir: number; name: string }[];
  rotation?: number[];
  squash?: number[];
  boosted?: boolean[];
  bounces?: number;
}
interface JM {
  phase: string;
  mushrooms: MushroomsDebug | null;
  events: { kind: string; index?: number; boost?: boolean }[];
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  autoplay(code?: string): number;
  go?(): void;
}

test("un morceau à champignon (`?module=champignon-falaise`) : la solution rebondit sur un rebond renforcé, le champignon s'écrase plus fort, aucune secousse", async ({ page }) => {
  test.skip(!(await open(page, "?module=champignon-falaise&variante=0&entree=arret&debug&accueil=0")), "pas de WebGL dans ce navigateur");
  const code = moduleSolutions("champignon-falaise", 0)!.arret!.code;
  const first = await page.evaluate(() => (window as unknown as { __jump: JM }).__jump.mushrooms);
  expect(first!.count).toBeGreaterThanOrEqual(1);
  // Chaque champignon est dessiné tourné vers où il lance : sol 0, plafond π, mur de gauche −π/2, mur de droite π/2.
  const rotations: Record<string, number> = { sol: 0, plafond: Math.PI, "mur gauche": -Math.PI / 2, "mur droit": Math.PI / 2 };
  const result = await page.evaluate((c) => {
    const j = (window as unknown as { __jump: JM & { fx?: { shaking?: boolean } } }).__jump;
    j.manual(true);
    const total = j.autoplay(c);
    let deaths = 0;
    let shaken = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if (j.attempt.status === "mort") deaths++;
      shaken += j.fx?.shaking ? 1 : 0;
    }
    const bounces = j.events.filter((e) => e.kind === "champignon");
    return { deaths, drawnBoost: (j.mushrooms?.boosted ?? []).some(Boolean), shaken, bounces: bounces.length, boosted: bounces.filter((e) => e.boost).length, drawn: j.mushrooms?.bounces ?? 0, rotation: j.mushrooms?.rotation ?? [] };
  }, code);
  expect(result.deaths).toBe(0);
  expect(result.bounces).toBeGreaterThanOrEqual(1);
  expect(result.boosted).toBeGreaterThanOrEqual(1); // la falaise ne se passe qu'avec le rebond renforcé
  expect(result.drawn).toBe(result.bounces);
  expect(result.drawnBoost).toBe(true); // le dessin a reçu un rebond renforcé (l'écrasement lui-même est une fonction pure de l'âge : `test/champignons.test.ts`, aucun rendu en pas à pas)
  expect(result.shaken).toBe(0); // règle du lot 14 : aucune secousse
  for (const [i, m] of first!.list.entries()) expect(result.rotation[i], m.name).toBeCloseTo(rotations[m.name] ?? 0, 6);
});

test("la galerie `?modules` filtre par l'étiquette « champignon » : au moins six morceaux", async ({ page }) => {
  await page.goto("/?modules&debug");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
  await page.selectOption('select[name="etiquette"]', "champignon");
  await page.waitForFunction(() => (window as unknown as { __jump: { gallery: { filter: { tag: string | null } } } }).__jump.gallery.filter.tag === "champignon");
  const shown = await page.evaluate(() => (window as unknown as { __jump: { gallery: { shown: number } } }).__jump.gallery.shown);
  expect(shown).toBeGreaterThanOrEqual(6);
  await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(shown);
});

/** Un jour sans fichier figé dont le niveau (g18, v8, forêt) a au moins deux morceaux à champignons. */
function dayWithMushrooms(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 90; k++, day++) {
    const d = dailyLevel(day);
    if (d.pieces.filter((p) => mushroomModuleIds().has(p.id)).length >= 2) return d.date;
  }
  throw new Error("aucun jour généré avec deux morceaux à champignons");
}

test("niveau du jour de forêt (v8 depuis le lot 24) : la preuve de l'auteur, jouée pas à pas dans la page, rebondit sur ses champignons et arrive sans mourir", async ({ page }) => {
  const date = dayWithMushrooms();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(8);
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: JM }).__jump;
    j.manual(true);
    const total = j.autoplay(code);
    let deaths = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if (j.attempt.status === "mort") deaths++;
    }
    return { deaths, phase: j.phase, count: j.mushrooms?.count ?? 0, bounces: j.events.filter((e) => e.kind === "champignon").length };
  }, daily.code);
  expect(result.count).toBeGreaterThanOrEqual(2);
  expect(result.bounces).toBeGreaterThanOrEqual(1);
  expect(result.deaths).toBe(0);
  expect(["finished", "carnage"]).toContain(result.phase); // arrivée sans mort : l'écran d'arrivée passe par le carnage
});

// ——— Lot 24 : les stalactites (dans ce fichier, pour la même raison) ———
// Une stalactite déclenchée au pas prévu, qui tremble 60 pas (le dessin reçoit son âge, ses gouttes de glace), tombe puis se brise **sans secousse de caméra**, la galerie `?modules` qui
// les filtre, et le niveau du jour de glace dont la preuve de l'auteur déclenche ses stalactites sans mourir. Tout se lit en pas à pas (l'état dessiné, lui, s'attend).

interface StalactitesDebug {
  count: number;
  list: { id: string; col: number; row: number; before: number; after: number; zone: [number, number] }[];
  ages: number[];
  age?: number[];
  shake?: number[];
  drips?: number[];
  visible?: boolean[];
  opacity?: number;
}
interface JS {
  phase: string;
  stalactites: StalactitesDebug | null;
  events: { kind: string; index?: number }[];
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  autoplay(code?: string): number;
  go?(): void;
}

test("un morceau à stalactite (`?module=stalactite-decroche`) : la solution la déclenche, elle tremble 60 pas puis tombe et se brise, sans mourir ni secousse de caméra", async ({ page }) => {
  test.skip(!(await open(page, "?module=stalactite-decroche&variante=0&entree=arret&debug&accueil=0")), "pas de WebGL dans ce navigateur");
  const code = moduleSolutions("stalactite-decroche", 0)!.arret!.code;
  const first = await page.evaluate(() => (window as unknown as { __jump: JS }).__jump.stalactites);
  expect(first!.count).toBe(1);
  expect(first!.ages).toEqual([0]);
  const run = await page.evaluate((c) => {
    const j = (window as unknown as { __jump: JS & { fx?: { shaking?: boolean } } }).__jump;
    j.manual(true);
    const total = j.autoplay(c);
    const ages: number[] = [];
    let deaths = 0;
    let shaken = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      ages.push(j.stalactites!.ages[0]!);
      if (j.attempt.status === "mort") deaths++;
      shaken += j.fx?.shaking ? 1 : 0;
    }
    return { deaths, shaken, ages, events: j.events.filter((e) => e.kind.startsWith("stalactite")).map((e) => e.kind) };
  }, code);
  expect(run.deaths).toBe(0);
  expect(run.shaken).toBe(0); // règle du lot 14 : ni secousse au déclenchement ni à la casse
  // L'état : intacte, puis l'âge 1, 2, … 60 (tremblement), la chute, enfin brisée (−1) jusqu'à la fin.
  const start = run.ages.findIndex((a) => a > 0);
  expect(start).toBeGreaterThan(0);
  for (let k = 0; k < 60; k++) expect(run.ages[start + k], `âge ${k + 1}`).toBe(k + 1);
  const broken = run.ages.indexOf(-1);
  expect(broken).toBeGreaterThan(start + 60);
  expect(run.ages.slice(broken).every((a) => a === -1)).toBe(true);
  expect(run.events).toEqual(["stalactiteTremble", "stalactiteCasse"]);
});

test("le dessin d'une stalactite qui tremble est celui de la simulation : son âge, son amplitude, ses gouttes de glace (attendus, jamais lus après un délai)", async ({ page }) => {
  test.skip(!(await open(page, "?module=stalactite-decroche&variante=0&entree=arret&debug&accueil=0")), "pas de WebGL dans ce navigateur");
  const code = moduleSolutions("stalactite-decroche", 0)!.arret!.code;
  // On avance jusqu'à l'âge 30 (la moitié du tremblement) et on s'arrête : la page dessine cet état.
  await page.evaluate((c) => {
    const j = (window as unknown as { __jump: JS }).__jump;
    j.manual(true);
    const total = j.autoplay(c);
    for (let t = 0; t < total && (j.stalactites!.ages[0] ?? 0) < 30; t++) j.advance(1);
  }, code);
  await page.waitForFunction(() => (window as unknown as { __jump: JS }).__jump.stalactites?.age?.[0] === 30);
  const drawn = await page.evaluate(() => (window as unknown as { __jump: JS }).__jump.stalactites!);
  expect(drawn.ages).toEqual([30]);
  expect(drawn.shake![0]).toBeCloseTo(0.5, 9);
  expect(drawn.drips![0]).toBe(4); // quatre gouttes décalées, toujours : un signe continu
  expect(drawn.visible![0]).toBe(true);
  expect(drawn.opacity).toBe(1);
});

test("la galerie `?modules` filtre par l'étiquette « stalactite » : au moins six morceaux", async ({ page }) => {
  await page.goto("/?modules&debug");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
  await page.selectOption('select[name="etiquette"]', "stalactite");
  await page.waitForFunction(() => (window as unknown as { __jump: { gallery: { filter: { tag: string | null } } } }).__jump.gallery.filter.tag === "stalactite");
  const shown = await page.evaluate(() => (window as unknown as { __jump: { gallery: { shown: number } } }).__jump.gallery.shown);
  expect(shown).toBeGreaterThanOrEqual(6);
  await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(shown);
});

/** Un jour sans fichier figé dont le niveau (g18, v8, glace) a au moins deux morceaux à stalactites. */
function dayWithStalactites(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 120; k++, day++) {
    const d = dailyLevel(day);
    if (d.pieces.filter((p) => stalactiteModuleIds().has(p.id)).length >= 2) return d.date;
  }
  throw new Error("aucun jour généré avec deux morceaux à stalactites");
}

test("niveau du jour de glace (v8) : la preuve de l'auteur, jouée pas à pas dans la page, déclenche ses stalactites et arrive sans mourir", async ({ page }) => {
  const date = dayWithStalactites();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(8);
  expect(daily.theme).toBe("glace");
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: JS }).__jump;
    j.manual(true);
    const total = j.autoplay(code);
    let deaths = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if (j.attempt.status === "mort") deaths++;
    }
    return { deaths, phase: j.phase, count: j.stalactites?.count ?? 0, tremblements: j.events.filter((e) => e.kind === "stalactiteTremble").length };
  }, daily.code);
  expect(result.count).toBeGreaterThanOrEqual(2);
  expect(result.tremblements).toBeGreaterThanOrEqual(2);
  expect(result.deaths).toBe(0);
  expect(["finished", "carnage"]).toContain(result.phase); // arrivée sans mort : l'écran d'arrivée passe par le carnage
});
