import { readFileSync, readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { decodeReplay, fromRuns, moduleSolutions } from "@cdj/jump-sim";
import { FIXED_NOW, atInstant } from "./clock";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 13 : la forêt et ses courants d'air. (a) un niveau du jour en forêt, joué par sa rediffusion d'auteur (`&solution`), finit au temps de
// l'auteur, avec ses zones de vent, les événements du vent et aucune erreur de shader ; (b) un morceau de vent se joue au doigt, en paysage, la
// solution stockée posée doigt par doigt ; (c) mouvement réduit : des flèches fixes remplacent les feuilles et le pollen (allumées quand la zone
// souffle) ; avec les effets, ce sont les particules ; (d) `?debug&hitbox` et `?scenario=vent` se dessinent sans erreur.
// Horloge maîtrisée par décalage de `Date` (`clock.ts`), jamais `page.clock.install` ; tout résultat qui dépend du nombre de pas se lit en pas à pas.

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const GENERATOR = (JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/daily-golden-v4.json", import.meta.url), "utf8")) as { jumpGeneratorVersion: number }).jumpGeneratorVersion;

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

interface Blocks {
  blinks: number;
  alts: number;
  solid: number;
  absent: number;
  wobbling: number;
  waiting: number;
  thick: number;
  wobbleOpacity: number;
  alt: number;
  flash: number;
  phases: number[];
  cycles: ({ cycle: number; solid: number; shift: number } | null)[];
  states: boolean[];
}
interface Wind {
  zones: number;
  mode?: "particules" | "fleches";
  particles?: number;
  arrows?: number;
  lit?: number;
  blowing?: boolean[];
  announce?: number[];
  arrowOpacity?: number[];
  inside: number;
  pushed: boolean;
  active: boolean[];
  phases: number[];
}
interface Jump {
  phase: string;
  daily: { date: string; id: string; mode: string; theme: string; forcedTheme: boolean; authorTicks: number; pieces: { id: string; mechanic: string | null }[]; code: string; lastMedal: string | null } | null;
  theme: { name: string };
  module: { id: string; variant: number; reference: number | null } | null;
  attempt: { status: string; time: number; deaths: number };
  blocks: Blocks | null;
  wind: Wind | null;
  audio: { played: Record<string, number>; requested: Record<string, number> };
  events: { kind: string; count?: number; alt?: number; reset?: boolean; accent?: boolean }[];
  touch: { bits: number };
  tuned: boolean;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
}
const J = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: Jump }).__jump;
  return { phase: j.phase, daily: j.daily, theme: j.theme, module: j.module, attempt: j.attempt, blocks: j.blocks, wind: j.wind, tuned: j.tuned };
});
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
/** Deux images de la page : ce que le dessin d'une image calcule est alors à jour. */
const frames = (page: Page, n = 2) => page.evaluate((k) => new Promise<void>((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

/** Les erreurs de la console et de la page (un shader qui ne compile pas s'y voit). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /shader error|WebGLProgram/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Ouvre une adresse en `?debug`, pas à pas, repartie du départ ; faux sans WebGL. */
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

/** Avance pas à pas jusqu'à `finished` ; rend les noms d'événements vus, le nombre de pas et le nombre de pas passés poussé par le vent. */
async function playToEnd(page: Page, max = 6000): Promise<{ ticks: number; kinds: string[]; pushed: number }> {
  return page.evaluate((limit) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    const kinds = new Set<string>();
    let pushed = 0;
    for (let t = 1; t <= limit; t++) {
      j.advance(1);
      for (const e of j.events.slice(-8)) kinds.add(e.kind);
      if (j.wind?.pushed) pushed++;
      if (j.phase === "finished" || j.phase === "carnage") return { ticks: t, kinds: [...kinds], pushed };
    }
    return { ticks: -1, kinds: [...kinds], pushed };
  }, max);
}


test("niveau du jour en forêt : sa rediffusion d'auteur finit au temps de l'auteur, poussée par le vent (ventDebut, ventFin), sans erreur de shader", async ({ browser }) => {
  test.setTimeout(120_000);
  await atInstant(browser, FIXED_NOW, async (page) => {
    const errors = watchErrors(page);
    const date = dayWith("foret");
    test.skip(!(await open(page, `/?seed=${date}&solution&debug`)), SKIP);
    const start = await J(page);
    expect(start.theme.name).toBe("foret");
    expect(start.daily).toMatchObject({ date, theme: "foret", forcedTheme: false, id: `jour-${date}-g${GENERATOR}` });
    expect(start.daily!.pieces.filter((p) => p.mechanic === "vent").length).toBeGreaterThanOrEqual(2);
    expect(start.wind).not.toBeNull();
    expect(start.wind!.zones).toBeGreaterThan(0);
    const { ticks, kinds, pushed } = await playToEnd(page);
    expect(ticks).toBe(start.daily!.authorTicks);
    const end = await J(page);
    expect(end.attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
    expect(end.daily!.lastMedal).toBe("author");
    expect(kinds).toContain("ventDebut");
    expect(kinds).toContain("ventFin");
    expect(pushed).toBeGreaterThan(60);
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

test.describe("au doigt (téléphone en paysage)", () => {
  const VIEW = { width: 844, height: 390 };
  // Zones : ← dans le premier quart, → dans le deuxième, saut dans la moitié droite (voir `touch.ts` et `mobile.spec.ts`).
  const at = { left: [VIEW.width * 0.12, VIEW.height * 0.75], right: [VIEW.width * 0.37, VIEW.height * 0.75], jump: [VIEW.width * 0.75, VIEW.height * 0.75] } as const;
  const LEFT = 1;
  const RIGHT = 2;
  const JUMP = 4;

  /** Pose la solution doigt par doigt : un doigt de direction (glissé d'une zone à l'autre), un doigt de saut ; chaque série est jouée pas à pas. */
  async function playByFingers(page: Page, bits: readonly number[]): Promise<void> {
    const fingers = await Fingers.on(page);
    let dir = 0;
    let jump = false;
    for (const [b, n] of runsOf(bits)) {
      const wantDir = b & LEFT && !(b & RIGHT) ? LEFT : b & RIGHT && !(b & LEFT) ? RIGHT : 0;
      if (wantDir !== dir) {
        if (dir === 0) await fingers.down(1, ...(wantDir === LEFT ? at.left : at.right));
        else if (wantDir === 0) await fingers.up(1);
        else await fingers.move(1, ...(wantDir === LEFT ? at.left : at.right));
        dir = wantDir;
      }
      const wantJump = (b & JUMP) !== 0;
      if (wantJump !== jump) {
        if (wantJump) await fingers.down(2, ...at.jump);
        else await fingers.up(2);
        jump = wantJump;
      }
      expect((await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.touch.bits)), "les doigts donnent les commandes de la solution").toBe(b === (LEFT | RIGHT) ? 0 : b);
      const phase = await page.evaluate((k) => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        for (let t = 0; t < k; t++) {
          j.advance(1);
          if (j.phase === "finished" || j.phase === "carnage") break;
        }
        return j.phase;
      }, n);
      if (phase === "finished" || phase === "carnage") break;
    }
    if (dir !== 0) await fingers.up(1);
    if (jump) await fingers.up(2);
  }

  test("?module=vent-pont se joue au doigt : la solution posée doigt par doigt finit au temps de la solution, dans le thème forêt", async ({ browser }) => {
    test.setTimeout(180_000);
    await withPhone(browser, VIEW, async (page) => {
      const errors = watchErrors(page);
      const { bits, ticks } = solutionBits("vent-pont", 0);
      test.skip(!(await open(page, "/?module=vent-pont&variante=0&touch=1&debug")), SKIP);
      const start = await J(page);
      // Le morceau d'une mécanique s'ouvre dans son thème, même sans `&theme=` dans l'adresse.
      expect(start.theme.name).toBe("foret");
      expect(start.module).toMatchObject({ id: "vent-pont", variant: 0, reference: ticks });
      expect(start.wind!.zones).toBeGreaterThan(0);
      await playByFingers(page, bits);
      const end = await J(page);
      expect(end.attempt.status).toBe("arrivé");
      expect(end.attempt.deaths).toBe(0);
      expect(end.attempt.time).toBe(ticks);
      expect(end.tuned).toBe(false);
      await frames(page);
      expect(errors).toEqual([]);
    });
  });
});

test("mouvement réduit : des flèches fixes remplacent les feuilles et le pollen, allumées quand la rafale souffle ; avec les effets, les particules", async ({ browser }) => {
  for (const reduced of [true, false]) {
    const context = await browser.newContext({ reducedMotion: reduced ? "reduce" : "no-preference", viewport: { width: 900, height: 600 } });
    const page = await context.newPage();
    const errors = watchErrors(page);
    try {
      if (!(await open(page, "/?module=vent-rafale&variante=0&debug"))) {
        test.skip(true, SKIP);
        return;
      }
      await frames(page, 3);
      let w = (await J(page)).wind!;
      expect(w.zones).toBe(1);
      if (reduced) {
        expect(w.mode).toBe("fleches");
        expect(w.particles).toBe(0);
        expect(w.arrows).toBeGreaterThan(0);
      } else {
        expect(w.mode).toBe("particules");
        expect(w.particles).toBeGreaterThan(0);
        expect(w.arrows).toBe(0);
      }
      // On court jusqu'au bord (la section se met en marche : la rafale ne souffle pas encore), puis on attend : elle part.
      const seen = await page.evaluate(() => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        j.input(2);
        j.advance(30);
        j.input(0);
        const states: boolean[] = [];
        for (let t = 0; t < 300; t++) {
          j.advance(1);
          const a = j.wind!.active[0]!;
          if (states[states.length - 1] !== a) states.push(a);
        }
        return states;
      });
      expect(seen).toContain(true);
      expect(seen).toContain(false);
      // Le monde ne bouge plus : l'aspect posé par le dessin suit l'état de la rafale (le temps de deux images), et ne clignote pas.
      const now = (await J(page)).wind!;
      await frames(page, 2);
      const opacities = new Set<number>();
      for (let i = 0; i < 12; i++) {
        await frames(page, 1);
        w = (await J(page)).wind!;
        opacities.add(Math.round((w.arrowOpacity?.[0] ?? -1) * 100));
        expect(w.blowing![0]).toBe(now.active[0]);
      }
      if (reduced) {
        expect(opacities.size, "mouvement réduit : des flèches fixes, rien ne clignote").toBe(1);
        expect([...opacities][0]!).toBeGreaterThan(0);
      } else expect([...opacities]).toEqual([-100]); // pas de flèches avec les particules
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test("?debug&hitbox et ?scenario=vent (galerie des courants d'air, dans le thème forêt) se dessinent sans erreur de shader", async ({ page }) => {
  const errors = watchErrors(page);
  test.skip(!(await open(page, "/?module=vent-relais&variante=0&debug&hitbox")), SKIP);
  await frames(page, 3);
  expect((await J(page)).wind!.zones).toBe(3);
  test.skip(!(await open(page, "/?scenario=vent&debug")), SKIP);
  await frames(page, 3);
  const s = await J(page);
  expect(s.theme.name).toBe("foret");
  expect(s.wind!.zones).toBe(4);
  expect(errors).toEqual([]);
});

test("?debug&tune : la section « Courants d'air » a ses trois curseurs ; en modifier un marque la partie (rien n'est enregistré), « Réinitialiser » le retire", async ({ page }) => {
  test.skip(!(await open(page, "/?scenario=vent&debug&tune")), SKIP);
  await page.evaluate(() => localStorage.removeItem("jump:tune"));
  await page.reload();
  await ready(page);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.manual(true);
    j.restart();
  });
  await expect(page.locator("#tune .winds")).toContainText("Courants d'air");
  for (const key of ["windAccel", "windRise", "windDrift"]) await expect(page.locator(`#tune .winds input[data-key="${key}"]`)).toHaveCount(1);
  // Les valeurs par défaut sont montrées (réglages absents de `DEFAULT_JUMP_PARAMS`) et la partie n'est pas marquée.
  await expect(page.locator('#tune input[data-key="windRise"]').locator("xpath=ancestor::label[1]")).toContainText("(205)");
  await expect(page.locator("#tuned")).toBeEmpty();
  const rise = page.locator('#tune input[data-key="windRise"]');
  await rise.evaluate((el: HTMLInputElement) => {
    el.value = "300";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.advance(1));
  await expect(page.locator("#tuned")).toHaveText("réglages modifiés : rien n'est enregistré");
  expect(await page.evaluate(() => (window as unknown as { __jump: { params: { windRise?: number } } }).__jump.params.windRise)).toBe(300);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jump:tune") ?? "{}").windRise)).toBe(300);
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  expect(await page.evaluate(() => localStorage.getItem("jump:tune"))).toBeNull();
  expect(await page.evaluate(() => (window as unknown as { __jump: { params: { windRise?: number } } }).__jump.params.windRise)).toBeUndefined();
  await expect(page.locator('#tune input[data-key="windRise"]').locator("xpath=ancestor::label[1]")).toContainText("(205)");
});
