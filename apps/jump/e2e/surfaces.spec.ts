import { readFileSync, readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { decodeReplay, fromRuns, moduleSolutions } from "@cdj/jump-sim";
import { FIXED_NOW, PUBLISHED, TODAY, atInstant, servePublished } from "./clock";
import { Fingers, hasWebGL, withPhone } from "./phone";
import { dayId } from "./jours";

// Lot 11 (partie jeu) : tapis roulants et glace. (a) un niveau du jour **usine** et un niveau **glace**, joués par leur rediffusion d'auteur
// (`&solution`), finissent au temps de l'auteur, avec les événements de surface, les chevrons construits et aucune erreur de shader ;
// (b) un morceau à tapis et un morceau à glace se jouent **au doigt, en paysage**, la solution stockée posée doigt par doigt (pas à pas) ;
// (c) un thème forcé (`?theme=`) est un essai : rien n'est enregistré (ni historique, ni série, ni mémoire du jour) ; (d) le ronronnement des
// tapis est spatialisé (voix, distance) et se tait en pause ; les chevrons sont figés avec `?fx=off`.
// Horloge maîtrisée par décalage de `Date` (`clock.ts`), jamais `page.clock.install` ; tout résultat qui dépend du nombre de pas se lit en pas à pas.

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const GENERATOR = (JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/daily-golden-v11.json", import.meta.url), "utf8")) as { jumpGeneratorVersion: number }).jumpGeneratorVersion;

/** Les thèmes des 400 premières dates du lot 9 (le thème d'une date ne change pas : fixture de `jump-sim`). */
const THEMES = JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/themes-lot9.json", import.meta.url), "utf8")) as { first: number; count: number; names: string };
const NAMES = THEMES.names.split(" ");
/** Les jours figés (`public/levels/`) : leur niveau est celui d'un générateur d'avant, jamais celui de cette version. */
const FROZEN = new Set(readdirSync(new URL("../public/levels", import.meta.url)).map((f) => f.slice(0, 10)));
/** La première date (AAAA-MM-JJ) à partir du 18/10/2026 dont le thème naturel est `theme`, hors des jours figés. */
function dayWith(theme: string, from = "2026-10-18"): string {
  for (let d = Date.parse(from) / 86_400_000; d < THEMES.first + THEMES.count; d++) {
    const date = new Date(d * 86_400_000).toISOString().slice(0, 10);
    if (NAMES[d - THEMES.first] === theme && !FROZEN.has(date)) return date;
  }
  throw new Error(`aucune date de thème ${theme}`);
}

interface Jump {
  phase: string;
  daily: { date: string; id: string; mode: string; theme: string; forcedTheme: boolean; authorTicks: number; pieces: { id: string; mechanic: string | null }[]; code: string; lastMedal: string | null } | null;
  theme: { name: string; ofDay: string; forced: boolean; stats: { beltTiles: number; beltTriangles: number; beltPhase: number } | null };
  module: { id: string; variant: number; reference: number | null } | null;
  attempt: { status: string; time: number; deaths: number };
  history: unknown[];
  streak: number;
  arrival: { shown: boolean };
  storage: { memory: { best: number | null; lives: number; deaths: number } };
  audio: { belts: { index: number; gain: number; pan: number }[]; saws: unknown[] };
  events: { kind: string; side?: number }[];
  touch: { bits: number };
  tuned: boolean;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  autoplay(code?: string): number;
  setMenu(open: boolean): void;
}
const J = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: Jump }).__jump;
  return { phase: j.phase, daily: j.daily, theme: j.theme, module: j.module, attempt: j.attempt, history: j.history, streak: j.streak, arrival: j.arrival, memory: j.storage.memory, audio: j.audio, tuned: j.tuned };
});
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
/** Deux images de la page : ce que le dessin et le son d'une image calculent est alors à jour. */
const frames = (page: Page, n = 2) => page.evaluate((k) => new Promise<void>((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

/** Les erreurs de la console et de la page (un shader qui ne compile pas s'y voit : « THREE.WebGLProgram: Shader Error »). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /shader error|WebGLProgram/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Ouvre une adresse en `?debug`, pas à pas, repartie du départ (une lecture démarre d'elle-même : on la relance, comme R) ; faux sans WebGL. */
async function open(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  if (!(await hasWebGL(page))) return false;
  await ready(page);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.manual(true);
    j.restart();
  });
  await page.waitForFunction(() => (window as unknown as { __jump: Jump }).__jump.phase === "ready");
  return true;
}

/** Avance pas à pas jusqu'à `finished` (ou `carnage`) ; chaque pas lit le journal d'événements : rend les noms vus et le nombre de pas. */
async function playToEnd(page: Page, max = 6000): Promise<{ ticks: number; kinds: string[] }> {
  return page.evaluate((limit) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    const kinds = new Set<string>();
    for (let t = 1; t <= limit; t++) {
      j.advance(1);
      // Le journal garde les 200 derniers événements : un pas en produit quelques-uns, on lit les derniers à chaque pas.
      const list = j.events;
      for (const e of list.slice(-6)) kinds.add(e.kind);
      if (j.phase === "finished" || j.phase === "carnage") return { ticks: t, kinds: [...kinds] };
    }
    return { ticks: -1, kinds: [...kinds] };
  }, max);
}

test("niveau du jour usine : sa rediffusion d'auteur finit au temps de l'auteur, avec ses tapis (chevrons construits, événements, aucune erreur de shader)", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const errors = watchErrors(page);
    const date = dayWith("usine");
    test.skip(!(await open(page, `/?seed=${date}&solution&debug`)), SKIP);
    const start = await J(page);
    expect(start.theme).toMatchObject({ name: "usine", ofDay: "usine", forced: false });
    expect(start.daily).toMatchObject({ date, theme: "usine", forcedTheme: false, id: `jour-${date}-g${GENERATOR}` });
    expect(start.daily!.pieces.filter((p) => p.mechanic === "tapis").length).toBeGreaterThanOrEqual(2);
    expect(start.theme.stats!.beltTiles).toBeGreaterThan(0);
    expect(start.theme.stats!.beltTriangles).toBe(start.theme.stats!.beltTiles * 2);
    const { ticks, kinds } = await playToEnd(page);
    expect(ticks).toBe(start.daily!.authorTicks);
    const end = await J(page);
    expect(end.attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
    expect(end.daily!.lastMedal).toBe("author");
    expect(kinds).toContain("tapisDebut");
    await frames(page);
    expect(errors).toEqual([]);
  });
});

test("niveau du jour glace : sa rediffusion d'auteur finit au temps de l'auteur, avec de la glace (début et fin de contact)", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const errors = watchErrors(page);
    const date = dayWith("glace");
    test.skip(!(await open(page, `/?seed=${date}&solution&debug`)), SKIP);
    const start = await J(page);
    expect(start.theme).toMatchObject({ name: "glace", ofDay: "glace", forced: false });
    expect(start.daily).toMatchObject({ date, theme: "glace", forcedTheme: false, id: `jour-${date}-g${GENERATOR}` });
    expect(start.daily!.pieces.filter((p) => p.mechanic === "glace").length).toBeGreaterThanOrEqual(2);
    // La glace est dessinée dans les tuiles pleines (aucun chevron : pas de tapis dans ce thème).
    expect(start.theme.stats!.beltTiles).toBe(0);
    const { ticks, kinds } = await playToEnd(page);
    expect(ticks).toBe(start.daily!.authorTicks);
    expect((await J(page)).attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
    expect(kinds).toContain("glaceDebut");
    await frames(page);
    expect(errors).toEqual([]);
  });
});

/** Lit les commandes de la solution stockée d'un morceau (`arrêt`) : la liste des 3 bits de chaque pas, et son temps. */
function solutionBits(id: string, variant: number): { bits: number[]; ticks: number } {
  const s = moduleSolutions(id, variant)!.arret!;
  return { bits: fromRuns(decodeReplay(s.code).runs), ticks: s.ticks };
}

/** Compresse les commandes en séries [bits, nombre de pas]. */
function runsOf(bits: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const b of bits) {
    const last = out[out.length - 1];
    if (last && last[0] === b) last[1]++;
    else out.push([b, 1]);
  }
  return out;
}

test("ronronnement des tapis : une voix par plage proche (au plus trois), plus faible quand on s'éloigne, muette en pause", async ({ page }) => {
  test.skip(!(await open(page, "/?module=tapis-respiration&variante=0&debug")), SKIP);
  // Du départ jusqu'au tapis : le personnage court vers la droite.
  const reachedBelt = await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.input(2);
    for (let t = 0; t < 600; t++) {
      j.advance(1);
      if (j.events.some((e) => e.kind === "tapisDebut")) return true;
    }
    return false;
  });
  expect(reachedBelt).toBe(true);
  await frames(page);
  const near = (await J(page)).audio.belts;
  expect(near.length).toBeGreaterThanOrEqual(1);
  expect(near.length).toBeLessThanOrEqual(3);
  expect(near[0]!.gain).toBeGreaterThan(0.005);
  expect(Math.abs(near[0]!.pan)).toBeLessThanOrEqual(1);
  // En pause (menu ouvert) : plus aucune voix.
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.setMenu(true));
  await frames(page);
  expect((await J(page)).audio.belts).toEqual([]);
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.setMenu(false));
  await frames(page);
  expect((await J(page)).audio.belts.length).toBeGreaterThanOrEqual(1);
});

test("les chevrons défilent avec les effets, figés avec ?fx=off ; ?debug&hitbox montre les surfaces sans erreur", async ({ page }) => {
  const errors = watchErrors(page);
  test.skip(!(await open(page, "/?module=tapis-respiration&variante=0&debug&hitbox")), SKIP);
  await frames(page, 6);
  const moving = (await J(page)).theme.stats!;
  expect(moving.beltTiles).toBeGreaterThan(0);
  expect(moving.beltPhase).toBeGreaterThan(0);
  const before = moving.beltPhase;
  await frames(page, 6);
  expect((await J(page)).theme.stats!.beltPhase).toBeGreaterThan(before);
  expect(await open(page, "/?module=tapis-respiration&variante=0&debug&fx=off")).toBe(true);
  await frames(page, 6);
  const still = (await J(page)).theme.stats!;
  expect(still.beltTiles).toBeGreaterThan(0); // les chevrons restent dessinés
  expect(still.beltPhase).toBe(0); // mais immobiles
  expect(errors).toEqual([]);
});

test("?modules (téléphone) : le filtre « Thème » (cible ≥ 44 px) isole les morceaux de mécanique, et leurs liens portent &theme=<nom> ; « Jouer » ouvre le morceau dans son thème", async ({ browser }) => {
  await withPhone(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto("/?modules&debug");
    await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
    const select = page.locator("#gallery select[name=theme]");
    const box = (await select.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const all = await page.locator("#gallery .card").count();
    await select.selectOption("usine");
    const usine = await page.locator("#gallery .card:not([hidden])").count();
    expect(usine).toBeGreaterThanOrEqual(5);
    expect(usine).toBeLessThan(all);
    await expect(page.locator("#gallery .count")).toContainText(`sur ${all}`);
    for (const card of await page.locator("#gallery .card:not([hidden])").all()) {
      // Un morceau de mécanique a (au moins) une variante de ce thème ; ses liens portent le thème, ceux d'une variante sans mécanique non.
      await expect(card.locator(".tag.theme[data-theme=usine]").first()).toBeVisible();
      for (const row of await card.locator(".variant").all()) {
        const themed = (await row.locator(".tag.theme").count()) > 0 ? await row.locator(".tag.theme").first().getAttribute("data-theme") : null;
        for (const a of await row.locator("a.play, a.watch").all()) {
          if (themed) expect(await a.getAttribute("href")).toContain(`theme=${themed}`);
          else expect(await a.getAttribute("href")).not.toContain("theme=");
        }
      }
    }
    await select.selectOption("glace");
    expect(await page.locator("#gallery .card:not([hidden])").count()).toBeGreaterThanOrEqual(5);
    // Lot 19 : un morceau générique peut avoir une variante glace (`corniches` v6) : la première carte n'est plus forcément un morceau de glace,
    // et sa première variante n'a pas de thème. Le lien d'une variante de glace, lui, porte le thème.
    await expect(page.locator("#gallery .card:not([hidden]) .variant:has(.tag.theme[data-theme=glace]) a.play").first()).toHaveAttribute("href", /theme=glace/);
    // « sans mécanique » : les morceaux de tous les thèmes ; aucun lien ne force de thème pour une variante sans mécanique.
    await select.selectOption("sans");
    const plain = page.locator("#gallery .card:not([hidden])").first();
    const href = await plain.locator("a.play").first().getAttribute("href");
    expect(href).not.toMatch(/theme=/);
    // « Jouer » sur un morceau à tapis ouvre le niveau dans le thème usine.
    await select.selectOption("usine");
    await page.locator("#gallery .card:not([hidden]) .variant:has(.tag.theme[data-theme=usine]) a.play").first().tap();
    await page.waitForURL(/theme=usine/);
    test.skip(!(await hasWebGL(page)), SKIP);
    await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
    expect((await J(page)).theme.name).toBe("usine");
    expect((await J(page)).module).not.toBeNull();
  });
});
