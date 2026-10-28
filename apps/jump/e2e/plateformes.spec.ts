import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { bridgeModuleIds, buildModule, dailyLevel, jumpThemeForDay, laserModuleIds, moduleSolutions, mushroomModuleIds, pressModuleIds, stalactiteModuleIds } from "@cdj/jump-sim";
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
  expect(daily.level.simVersion).toBe(11); // lot 27 : le générateur en vigueur (g21) est en v11
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
  // `__jump.presses.warn` est celui de la **simulation** (il écrase celui du dessin) : il est juste dès la fin de `advance` et n'atteste aucune image. C'est donc
  // l'empreinte, posée par le dessin lui-même, qu'on attend (run 40413669420 : sous WebKit la lecture tombait avant la première image, `footprint` valait encore 0,08).
  await page.waitForFunction((hold) => {
    const p = (window as unknown as { __jump: JP }).__jump.presses;
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
  expect(daily.level.simVersion).toBe(11); // lot 27 : le générateur en vigueur (g21) est en v11
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

/** Un jour sans fichier figé dont le niveau (g19, v9, forêt) a au moins deux morceaux à champignons. */
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
  expect(daily.level.simVersion).toBe(11);
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

/** Un jour sans fichier figé dont le niveau (g19, v9, glace) a au moins deux morceaux à stalactites. */
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
  expect(daily.level.simVersion).toBe(11);
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

// ——— Lot 25 : les lasers (dans ce fichier, pour la même raison) ———
// Un rayon fixe dessiné aux pas exacts où la simulation l'allume, précédé d'une visée neutre qui s'intensifie pendant les 0,5 s qui le précèdent (60 pas) ; une barre coulissante
// dessinée là où la simulation la met, dont la vitesse (ralentie aux extrémités) est celle de la simulation. Tout se lit en pas à pas (l'état dessiné, lui, s'attend, jamais après un délai).
// Le niveau du jour de néon (g19) : sa preuve passe ses lasers sans mourir (dernier test du fichier).

interface LasersDebug {
  count: number;
  bars: number;
  /** Ce que le dessin a posé. */
  on?: boolean[];
  warn?: number[];
  rayOpacity?: number[];
  aimOpacity?: number[];
  barX?: number[];
  barY?: number[];
  barSpeed?: number[];
  opacity?: number;
  /** La simulation : boîtes mortelles (unités), phases, rayons allumés, annonce. */
  sim: { x: number; y: number; w: number; h: number }[];
  phases: number[];
  simOn: boolean[];
  simWarn: number[];
  simBars: { x: number; y: number; w: number; h: number }[];
  barPhases: number[];
  simBarSpeeds: number[];
}
interface JL {
  phase: string;
  lasers: LasersDebug | null;
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
}
const lasers = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JL }).__jump.lasers!);

/**
 * Met la section d'un morceau en marche (en v3, son horloge part quand le personnage y entre) : il marche vers la droite jusqu'à ce que la phase de sa section soit non nulle, puis
 * s'arrête. Le palier d'entrée et le début du morceau sont du sol plein, loin des rayons.
 */
async function startClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: JL }).__jump;
    j.manual(true);
    j.restart();
    j.input(2);
    for (let t = 0; t < 300 && Math.max(0, ...(j.lasers!.phases.concat(j.lasers!.barPhases))) === 0; t++) j.advance(1);
    j.input(0);
  });
  expect(await page.evaluate(() => Math.max(0, ...((window as unknown as { __jump: JL }).__jump.lasers!.phases.concat((window as unknown as { __jump: JL }).__jump.lasers!.barPhases))))).toBeGreaterThan(0);
}

test("un morceau à portails (`?module=laser-allee`) : la visée croît pendant les 60 pas avant l'allumage, le rayon rouge est dessiné aux pas exacts où la simulation l'allume", async ({ page }) => {
  test.skip(!(await open(page, "?module=laser-allee&variante=0&entree=arret&debug&accueil=0")), "pas de WebGL dans ce navigateur");
  const first = buildModule("laser-allee", 0).level.lasers[0]!;
  await startClock(page);
  const at = async (q: number) => {
    // Avance jusqu'au pas où `q = (phase + décalage) mod cycle` vaut `q` (le portail n'est pas franchi : le personnage attend sur son palier).
    const phase = (await lasers(page)).phases[0]!;
    const here = (((phase + first.shift) % first.cycle) + first.cycle) % first.cycle;
    const wait = (q - here + first.cycle) % first.cycle;
    await page.evaluate((n) => (window as unknown as { __jump: JL }).__jump.advance(n), wait);
    // Le dessin rattrape la simulation à l'image suivante : on attend l'état voulu.
    await page.waitForFunction((want) => {
      const l = (window as unknown as { __jump: JL }).__jump.lasers;
      return !!l && l.on !== undefined && l.simOn[0] === want.on && l.on[0] === want.on && Math.abs((l.warn?.[0] ?? -1) - want.warn) < 1e-9;
    }, expected(q));
    return lasers(page);
  };
  const expected = (q: number) => {
    const warn = q <= first.cycle - 60 || q < first.on ? 0 : (q - (first.cycle - 60)) / 59;
    return { on: q < first.on, warn };
  };
  // Avant l'annonce : rien (0 exactement, visée cachée).
  let l = await at(first.cycle - 60);
  expect(l.warn![0]).toBe(0);
  expect(l.aimOpacity![0]).toBe(0);
  expect(l.on![0]).toBe(false);
  // Le premier pas annoncé : la visée apparaît, très faible.
  l = await at(first.cycle - 59);
  expect(l.warn![0]).toBeCloseTo(1 / 59, 9);
  expect(l.aimOpacity![0]).toBeGreaterThan(0);
  // À mi-annonce : plus intense.
  const mid = await at(first.cycle - 30);
  expect(mid.aimOpacity![0]).toBeGreaterThan(l.aimOpacity![0]!);
  // Le dernier pas éteint : la visée est pleine, le rayon rouge n'est pas encore là.
  l = await at(first.cycle - 1);
  expect(l.warn![0]).toBe(1);
  expect(l.aimOpacity![0]).toBeCloseTo(0.85, 9);
  expect(l.rayOpacity![0]).toBe(0);
  expect(l.simOn[0]).toBe(false);
  // Le pas d'après : le rayon rouge, la visée a disparu.
  l = await at(0);
  expect(l.on![0]).toBe(true);
  expect(l.simOn[0]).toBe(true);
  expect(l.rayOpacity![0]).toBe(1);
  expect(l.aimOpacity![0]).toBe(0);
  expect(l.opacity).toBe(1);
  // Et il s'éteint au pas voulu, sans annonce.
  l = await at(first.on);
  expect(l.on![0]).toBe(false);
  expect(l.warn![0]).toBe(0);
  expect(Math.min(l.sim[0]!.w, l.sim[0]!.h)).toBe(1024); // l'épaisseur de la bande mortelle (le portail est vertical : sa largeur)
});

test("un morceau à barre (`?module=laser-balayage`) : la barre est dessinée où la simulation la met, sa vitesse est celle de la simulation et ralentit aux extrémités", async ({ page }) => {
  test.skip(!(await open(page, "?module=laser-balayage&variante=0&entree=arret&debug&accueil=0")), "pas de WebGL dans ce navigateur");
  const bar = buildModule("laser-balayage", 0).level.laserBars[0]!;
  await startClock(page);
  const half = bar.cycle / 2;
  const speeds: number[] = [];
  for (const target of [half / 2, half, half + half / 2, 0]) {
    const phase = (await lasers(page)).barPhases[0]!;
    const wait = (target - (phase % bar.cycle) + bar.cycle) % bar.cycle;
    await page.evaluate((n) => (window as unknown as { __jump: JL }).__jump.advance(n), wait);
    await page.waitForFunction(
      (w) => {
        const l = (window as unknown as { __jump: JL }).__jump.lasers;
        return !!l && l.barSpeed !== undefined && l.simBars[0] !== undefined && Math.abs(l.barSpeed[0]! - l.simBarSpeeds[0]!) < 1e-9 && Math.abs(l.barY![0]! - (l.simBars[0].y - w.gap) / w.unit) < 1e-6;
      },
      { gap: (T - 1024) / 2, unit: T },
    );
    const l = await lasers(page);
    // Le dessin : la bande dessinée est la bande mortelle de la simulation (coin haut-gauche de la première tuile = la bande moins le décalage qui la centre).
    expect(l.barX![0]).toBeCloseTo(l.simBars[0]!.x / T, 6);
    expect(l.simBars[0]!.h).toBe(1024);
    expect(l.simBars[0]!.w).toBe(bar.length * T);
    speeds.push(l.barSpeed![0]!);
  }
  // Pleine vitesse au quart et aux trois quarts du cycle, presque à l'arrêt aux deux extrémités.
  expect(speeds[0]).toBeGreaterThan(0.95);
  expect(speeds[1]).toBeLessThan(0.1);
  expect(speeds[2]).toBeGreaterThan(0.95);
  expect(speeds[3]).toBeLessThan(0.1);
});

/** Un jour sans fichier figé dont le niveau (g19, v9, néon) a au moins deux morceaux à lasers. */
function dayWithLasers(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 120; k++, day++) {
    const d = dailyLevel(day);
    if (d.pieces.filter((p) => laserModuleIds().has(p.id)).length >= 2) return d.date;
  }
  throw new Error("aucun jour généré avec deux morceaux à lasers");
}

test("niveau du jour de néon (v9) : la preuve de l'auteur, jouée pas à pas dans la page, traverse ses lasers et ses barres et arrive sans mourir", async ({ page }) => {
  const date = dayWithLasers();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(11);
  expect(daily.theme).toBe("neon");
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: JL }).__jump;
    j.manual(true);
    const total = (j as unknown as { autoplay(code?: string): number }).autoplay(code);
    let deaths = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if (j.attempt.status === "mort") deaths++;
    }
    return { deaths, phase: j.phase, count: j.lasers?.count ?? 0, bars: j.lasers?.bars ?? 0 };
  }, daily.code);
  expect(result.count + result.bars).toBeGreaterThanOrEqual(2);
  expect(result.deaths).toBe(0);
  expect(["finished", "carnage"]).toContain(result.phase); // arrivée sans mort : l'écran d'arrivée passe par le carnage
});

// ——— Lot 26 : les ponts à interrupteur (dans ce fichier, pour la même raison) ———
// Éteint, un pont n'est qu'un contour pointillé ; le pas où le personnage se pose sur l'interrupteur, toutes ses tuiles sont pleines (dessinées comme la simulation les tient) ; chaque tuile se
// vide comme une jauge pendant les 48 pas qui précèdent son extinction (vide pile au pas où la simulation l'éteint) ; la reprise le remet éteint. Tout se lit en pas à pas.

interface BridgesDebug {
  count: number;
  list: { id: string; switchCol: number; switchRow: number; delay: number; tiles: number }[];
  ages: number[];
  simSolid: boolean[];
  simFills: number[];
  /** Ce que le dessin a posé. */
  tiles?: number;
  solid?: number;
  dotted?: number;
  draining?: number;
  fills?: number[];
  opacity?: number;
}
interface JB {
  phase: string;
  bridges: BridgesDebug | null;
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  autoplay(code?: string): number;
}
const bridges = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JB }).__jump.bridges!);

test("un morceau à pont (`?module=pont-coude`) : pointillés éteint, plein dès la pose sur l'interrupteur, jauge qui se vide 48 pas avant chaque extinction, dessin = simulation", async ({ page }) => {
  test.skip(!(await open(page, "?module=pont-coude&variante=0&entree=arret&debug&accueil=0")), "pas de WebGL dans ce navigateur");
  const built = buildModule("pont-coude", 0).level.bridges[0]!;
  const total = built.tiles.length;
  // Éteint : toutes les tuiles pointillées (le dessin les attend), aucune pleine.
  await page.waitForFunction((n) => ((window as unknown as { __jump: JB }).__jump.bridges?.dotted ?? 0) === n, total);
  const off = await bridges(page);
  expect(off).toMatchObject({ count: 1, ages: [0], tiles: total, solid: 0 });
  expect(off.simSolid.every((v) => !v)).toBe(true);
  // Le personnage court vers l'interrupteur ; le pas où il s'y pose, le pont est allumé (âge 1), puis il s'arrête.
  const age = await page.evaluate(() => {
    const j = (window as unknown as { __jump: JB }).__jump;
    j.manual(true);
    j.restart();
    j.input(2);
    for (let t = 0; t < 600 && (j.bridges?.ages[0] ?? 0) === 0; t++) j.advance(1);
    const a = j.bridges!.ages[0]!;
    j.input(0);
    return a;
  });
  expect(age).toBe(1);
  const lit = await bridges(page);
  expect(lit.simSolid.every((v) => v)).toBe(true);
  await page.waitForFunction((n) => ((window as unknown as { __jump: JB }).__jump.bridges?.solid ?? 0) === n, total);
  // Âge 100 : les tuiles de rang 0 et 1 sont dans les 48 derniers pas (jauges 21/49 et 37/49), la suivante est encore pleine ; la jauge dessinée est celle de la simulation.
  const sim = await page.evaluate((delay) => {
    const j = (window as unknown as { __jump: JB }).__jump;
    j.advance(delay - 20 - 1);
    return { ages: j.bridges!.ages, fills: j.bridges!.simFills.slice(0, 3), status: j.attempt.status };
  }, built.delay);
  expect(sim.status).not.toBe("mort");
  expect(sim.ages[0]).toBe(built.delay - 20);
  expect(sim.fills[0]).toBeCloseTo(21 / 49, 9);
  expect(sim.fills[1]).toBeCloseTo(37 / 49, 9);
  expect(sim.fills[2]).toBe(1);
  await page.waitForFunction(() => Math.abs(((window as unknown as { __jump: JB }).__jump.bridges?.fills?.[0] ?? 9) - 21 / 49) < 1e-9);
  expect((await bridges(page)).fills!.slice(0, 3)).toEqual([sim.fills[0], sim.fills[1], 1]);
  // Au pas de l'extinction de la tuile 0 (âge délai + 1) : elle est vide dans la simulation et pointillée à l'écran.
  const gone = await page.evaluate(() => {
    const j = (window as unknown as { __jump: JB }).__jump;
    j.advance(21);
    return { age: j.bridges!.ages[0], solid0: j.bridges!.simSolid[0], solid1: j.bridges!.simSolid[1] };
  });
  expect(gone).toEqual({ age: built.delay + 1, solid0: false, solid1: true });
  await page.waitForFunction(() => ((window as unknown as { __jump: JB }).__jump.bridges?.dotted ?? 0) === 1);
});

/** Un jour de nuit sans fichier figé dont le niveau (g21, v11) a au moins deux morceaux à ponts. */
function dayWithBridges(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 200; k++, day++) {
    if (jumpThemeForDay(day) !== "nuit") continue;
    const d = dailyLevel(day);
    if (d.pieces.filter((p) => bridgeModuleIds().has(p.id)).length >= 2) return d.date;
  }
  throw new Error("aucun jour généré avec deux morceaux à ponts");
}

test("niveau du jour de nuit (v10) : la preuve de l'auteur, jouée pas à pas dans la page, allume ses ponts et arrive sans mourir", async ({ page }) => {
  const date = dayWithBridges();
  const daily = dailyLevel(parseDay(date)!);
  test.skip(!(await open(page, `?seed=${date}&debug&accueil=0`)), "pas de WebGL dans ce navigateur");
  expect(daily.level.simVersion).toBe(11);
  expect(daily.theme).toBe("nuit");
  const result = await page.evaluate((code) => {
    const j = (window as unknown as { __jump: JB }).__jump;
    j.manual(true);
    const total = j.autoplay(code);
    let deaths = 0;
    let lit = 0;
    for (let t = 0; t < total + 5 && j.phase !== "finished"; t++) {
      j.advance(1);
      if (j.attempt.status === "mort") deaths++;
      if (j.bridges?.ages.some((a) => a === 1)) lit++;
    }
    return { deaths, lit, phase: j.phase, count: j.bridges?.count ?? 0 };
  }, daily.code);
  expect(result.count).toBeGreaterThanOrEqual(2);
  expect(result.lit).toBeGreaterThanOrEqual(2); // chaque pont est allumé au moins une fois par la preuve
  expect(result.deaths).toBe(0);
  expect(["finished", "carnage"]).toContain(result.phase);
});
