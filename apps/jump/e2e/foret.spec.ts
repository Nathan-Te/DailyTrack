import { readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { dayId } from "./jours";
import { decodeReplay, fromRuns, jumpThemeForDay, moduleSolutions } from "@cdj/jump-sim";
import { FIXED_NOW, atInstant } from "./clock";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 13 : la forêt et ses courants d'air. (a) un niveau du jour en forêt, joué par sa rediffusion d'auteur (`&solution`), finit au temps de
// l'auteur, avec ses zones de vent, les événements du vent et aucune erreur de shader ; (b) un morceau de vent se joue au doigt, en paysage, la
// solution stockée posée doigt par doigt ; (c) mouvement réduit : des flèches fixes remplacent les feuilles et le pollen (allumées quand la zone
// souffle) ; avec les effets, ce sont les particules ; (d) `?debug&hitbox` et `?scenario=vent` se dessinent sans erreur.
// Horloge maîtrisée par décalage de `Date` (`clock.ts`), jamais `page.clock.install` ; tout résultat qui dépend du nombre de pas se lit en pas à pas.

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";

/** Les jours figés (`public/levels/`) : leur niveau est celui d'un générateur d'avant, jamais celui de cette version. */
const FROZEN = new Set(readdirSync(new URL("../public/levels", import.meta.url)).map((f) => f.slice(0, 10)));
/** La première date (AAAA-MM-JJ) à partir du 18/10/2026 dont le thème naturel est `theme`, hors des jours figés (lot V1 : le thème du sac ; `./jours` déclare les niveaux figés d'avant, comme la page le fait). */
function dayWith(theme: string, from = "2026-10-18"): string {
  for (let d = Date.parse(from) / 86_400_000; d < Date.parse(from) / 86_400_000 + 400; d++) {
    const date = new Date(d * 86_400_000).toISOString().slice(0, 10);
    if (jumpThemeForDay(d) === theme && !FROZEN.has(date)) return date;
  }
  throw new Error(`aucune date de thème ${theme}`);
}

interface Blocks {
  blinks: number;
  alts: number;
  solid: number;
  absent: number;
  waiting: number;
  thick: number;
  alt: number;
  flash: number;
  phases: number[];
  cycles: ({ cycle: number; solid: number; shift: number } | null)[];
  states: boolean[];
}
interface Wind {
  zones: number;
  list: { gust: { cycle: number; active: number; shift: number } | null }[];
  mode?: "particules" | "fleches";
  particles?: number;
  arrows?: number;
  lit?: number;
  blowing?: boolean[];
  announce?: number[];
  flow?: number[];
  intensity?: number[];
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
    expect(start.daily).toMatchObject({ date, theme: "foret", forcedTheme: false, id: dayId(date) });
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

test("annonce d'une rafale (lot 18) : les feuilles ralentissent pendant les 0,4 s qui précèdent la fin et sont à l'arrêt pile quand elle cesse ; les flèches s'éteignent de même", async ({ browser }) => {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ reducedMotion: reduced ? "reduce" : "no-preference", viewport: { width: 900, height: 600 } });
    const page = await context.newPage();
    const errors = watchErrors(page);
    try {
      if (!(await open(page, "/?module=vent-rafale&variante=0&debug"))) {
        test.skip(true, SKIP);
        return;
      }
      // On court jusqu'au bord (la section se met en marche), puis on attend sur place. À chaque étape on avance pas à pas jusqu'à ce qu'il reste `left` pas à la
      // rafale (lus sur l'état de la simulation : `phases` et le cycle), puis on laisse le dessin passer deux images.
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        j.input(2);
        j.advance(30);
        j.input(0);
      });
      const leftOf = `(() => { const w = window.__jump.wind; const g = w.list[0].gust; const q = (((w.phases[0] + g.shift) % g.cycle) + g.cycle) % g.cycle; return q < g.active ? { blowing: true, left: g.active - q } : { blowing: false, left: g.cycle - q }; })()`;
      const reach = (blowing: boolean, left: number) =>
        page.evaluate(
          ([b, l, expr]) => {
            const j = (window as unknown as { __jump: Jump }).__jump;
            for (let t = 0; t < 2000; t++) {
              const s = eval(expr as string) as { blowing: boolean; left: number };
              if (s.blowing === b && s.left === l) return true;
              j.advance(1);
            }
            return false;
          },
          [blowing, left, leftOf] as const,
        );
      let w: Wind;
      // Hors du ralenti (49 pas avant la fin de la rafale) : pleine vitesse.
      expect(await reach(true, 49)).toBe(true);
      await frames(page, 2);
      w = (await J(page)).wind!;
      expect(w.flow![0]).toBe(1);
      // Dix pas avant la fin : 10 / (48 + 1) de la pleine vitesse ; les flèches, entre éteintes et allumées.
      expect(await reach(true, 10)).toBe(true);
      await frames(page, 2);
      w = (await J(page)).wind!;
      expect(w.active[0]).toBe(true);
      expect(w.flow![0]!).toBeCloseTo(10 / 49, 5);
      if (reduced) {
        expect(w.arrowOpacity![0]!).toBeGreaterThan(0.22);
        expect(w.arrowOpacity![0]!).toBeLessThan(0.8);
      }
      // Le dernier pas de la rafale : presque à l'arrêt ; le pas suivant, elle a cessé et les feuilles sont à l'arrêt pile.
      expect(await reach(true, 1)).toBe(true);
      await frames(page, 2);
      w = (await J(page)).wind!;
      expect(w.flow![0]!).toBeCloseTo(1 / 49, 5);
      await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.advance(1));
      await frames(page, 2);
      w = (await J(page)).wind!;
      expect(w.active[0], "la rafale a cessé").toBe(false);
      expect(w.flow![0], "à l'arrêt pile au pas où la rafale cesse").toBe(0);
      if (reduced) expect(w.arrowOpacity![0]!).toBeCloseTo(0.22, 5); // flèches éteintes (WIND_ARROW_IDLE)
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

