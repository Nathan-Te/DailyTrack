import { readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { dayId } from "./jours";
import { decodeReplay, fromRuns, jumpThemeForDay, moduleSolutions } from "@cdj/jump-sim";
import { FIXED_NOW, atInstant } from "./clock";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 12 : nuit (blocs clignotants) et néon (blocs alternés). (a) un niveau du jour nuit et un niveau néon, joués par leur rediffusion d'auteur
// (`&solution`), finissent au temps de l'auteur, avec les événements de blocs et aucune erreur de shader ; (b) un morceau de chaque se joue au
// doigt, en paysage, la solution stockée posée doigt par doigt ; (c) mouvement réduit : le vacillement reste lisible (rien ne clignote, le
// contour s'épaissit) ; (d) `?debug&hitbox` dessine les blocs sans erreur ; (e) `?metronome=off` coupe le tempo.
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
  /** Lot 18 : jauges en cours (dessinées), contours pointillés, hauteur de face dessinée et niveau de la simulation de chaque clignotant. */
  draining: number;
  refilling: number;
  dotted: number;
  fills: number[];
  simFills: number[];
  alt: number;
  flash: number;
  phases: number[];
  cycles: ({ cycle: number; solid: number; shift: number } | null)[];
  states: boolean[];
}
interface Jump {
  phase: string;
  daily: { date: string; id: string; mode: string; theme: string; forcedTheme: boolean; authorTicks: number; pieces: { id: string; mechanic: string | null }[]; code: string; lastMedal: string | null } | null;
  theme: { name: string };
  module: { id: string; variant: number; reference: number | null } | null;
  attempt: { status: string; time: number; deaths: number };
  blocks: Blocks | null;
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
  return { phase: j.phase, daily: j.daily, theme: j.theme, module: j.module, attempt: j.attempt, blocks: j.blocks, tuned: j.tuned };
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

/** Avance pas à pas jusqu'à `finished` ; rend les noms d'événements vus, le nombre de pas, et les valeurs vues de la parité (`alt`). */
async function playToEnd(page: Page, max = 6000): Promise<{ ticks: number; kinds: string[]; alts: number[]; maxDraining: number }> {
  return page.evaluate((limit) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    const kinds = new Set<string>();
    const alts = new Set<number>();
    let maxDraining = 0;
    for (let t = 1; t <= limit; t++) {
      j.advance(1);
      for (const e of j.events.slice(-8)) kinds.add(e.kind);
      const b = j.blocks;
      if (b) {
        if (b.alt >= 0) alts.add(b.alt);
        // Lot 23 : la jauge se lit sur la simulation (`simFills`, relue à chaque pas) : `draining` est ce que le dernier rendu a dessiné, et un pas à pas sans rendu n'en
        // produit pas — il ne montrait la jauge que si l'image du départ tombait dans une annonce, ce qui dépend de la composition du jour.
        const draining = b.simFills.filter((f) => f > 0 && f < 1).length;
        if (draining > maxDraining) maxDraining = draining;
      }
      if (j.phase === "finished" || j.phase === "carnage") return { ticks: t, kinds: [...kinds], alts: [...alts], maxDraining };
    }
    return { ticks: -1, kinds: [...kinds], alts: [...alts], maxDraining };
  }, max);
}

for (const [theme, mechanic, expected] of [
  ["nuit", "clignotant", ["blocApparait", "blocDisparait", "blocVacille", "metronome"]],
  ["neon", "alterne", ["bascule"]],
] as const) {
  test(`niveau du jour ${theme} : sa rediffusion d'auteur finit au temps de l'auteur, avec ses blocs (${expected.join(", ")}) et aucune erreur de shader`, { tag: "@regression" }, async ({ browser }) => {
    test.setTimeout(120_000);
    await atInstant(browser, FIXED_NOW, async (page) => {
      const errors = watchErrors(page);
      const date = dayWith(theme);
      test.skip(!(await open(page, `/?seed=${date}&solution&debug`)), SKIP);
      const start = await J(page);
      expect(start.theme.name).toBe(theme);
      expect(start.daily).toMatchObject({ date, theme, forcedTheme: false, id: dayId(date) });
      expect(start.daily!.pieces.filter((p) => p.mechanic === mechanic).length).toBeGreaterThanOrEqual(2);
      expect(start.blocks).not.toBeNull();
      expect(mechanic === "clignotant" ? start.blocks!.blinks : start.blocks!.alts).toBeGreaterThan(0);
      const { ticks, kinds, alts, maxDraining } = await playToEnd(page);
      expect(ticks).toBe(start.daily!.authorTicks);
      const end = await J(page);
      expect(end.attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
      expect(end.daily!.lastMedal).toBe("author");
      for (const k of expected) expect(kinds, k).toContain(k);
      if (mechanic === "alterne") expect(alts.sort()).toEqual([0, 1]); // la parité a bien changé pendant la partie
      else expect(maxDraining, "une jauge s'est vidée pendant la partie (lot 18)").toBeGreaterThan(0);
      await frames(page);
      expect(errors).toEqual([]);
    });
  });
}

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

  for (const [id, theme] of [
    ["nuit-opposition", "nuit"],
    ["neon-couloir", "neon"],
  ] as const) {
    test(`?module=${id} se joue au doigt : la solution posée doigt par doigt finit au temps de la solution, dans le thème ${theme}`, async ({ browser }) => {
      test.setTimeout(180_000);
      await withPhone(browser, VIEW, async (page) => {
        const errors = watchErrors(page);
        const { bits, ticks } = solutionBits(id, 0);
        test.skip(!(await open(page, `/?module=${id}&variante=0&touch=1&debug`)), SKIP);
        const start = await J(page);
        // Le morceau d'une mécanique s'ouvre dans son thème, même sans `&theme=` dans l'adresse.
        expect(start.theme.name).toBe(theme);
        expect(start.module).toMatchObject({ id, variant: 0, reference: ticks });
        expect(start.blocks).not.toBeNull();
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
  }
});

test("la jauge de la nuit (lot 18) : la face se vide sans clignoter, avec ou sans mouvement réduit ; le contour d'un bloc absent est pointillé", { tag: "@regression" }, async ({ browser }) => {
  for (const reduced of [true, false]) {
    const context = await browser.newContext({ reducedMotion: reduced ? "reduce" : "no-preference", viewport: { width: 900, height: 600 } });
    const page = await context.newPage();
    const errors = watchErrors(page);
    try {
      if (!(await open(page, "/?module=nuit-pont&variante=0&debug"))) {
        test.skip(true, SKIP);
        return;
      }
      expect((await J(page)).blocks!.blinks).toBeGreaterThan(0);
      // On avance jusqu'à ce qu'une jauge se vide (les derniers instants d'un bloc plein), puis on regarde plusieurs images.
      const found = await page.evaluate(() => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        // On court jusqu'à la section (le monde se met en marche), puis on attend sur place : le cycle de la section tourne.
        j.input(2);
        j.advance(36); // le centre passe dans la section (le palier fait deux tuiles) ; la corniche d'entrée est plus loin
        j.input(0);
        for (let t = 0; t < 600; t++) {
          j.advance(1);
          if (j.blocks!.simFills.some((f) => f > 0 && f < 1)) {
            j.advance(10);
            return true;
          }
        }
        return false;
      });
      expect(found).toBe(true);
      // Le monde ne bouge plus (on n'avance pas) : seules les images (l'horloge) changent. La face dessinée est celle de la jauge, à chaque image.
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        await frames(page, 1);
        const b = (await J(page)).blocks!;
        const drained = b.simFills.findIndex((f) => f > 0 && f < 1);
        expect(drained).toBeGreaterThanOrEqual(0);
        expect(b.fills[drained]).toBeCloseTo(b.simFills[drained]!, 5); // le dessin montre la jauge de la simulation, ni plus ni moins
        seen.add(b.simFills.map((f) => f.toFixed(4)).join(",") + "/" + b.fills.map((f) => f.toFixed(4)).join(","));
        expect(b.draining).toBeGreaterThan(0);
        expect(b.dotted, "chaque clignotant absent a un contour pointillé (sauf celui qui attend la sortie du personnage)").toBe(b.absent - b.waiting);
      }
      expect(seen.size, reduced ? "mouvement réduit" : "effets normaux : rien ne clignote d'une image à l'autre").toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test("?debug&hitbox dessine l'état des blocs (plein, absent, jeu actif) sans erreur de shader, pour les deux mécaniques", { tag: "@regression" }, async ({ page }) => {
  const errors = watchErrors(page);
  // Lot R13 : un morceau au doigt (le néon) ; la nuit au doigt est retirée (même code des doigts, même solution posée).
  for (const id of ["neon-couloir"]) {
    test.skip(!(await open(page, `/?module=${id}&variante=0&debug&hitbox`)), SKIP);
    await frames(page, 3);
    const b = (await J(page)).blocks!;
    expect(b.solid + b.absent).toBe(b.blinks + b.alts);
    expect(b.states.length).toBe(b.blinks + b.alts);
  }
  expect(errors).toEqual([]);
});

test("le métronome de la nuit bat sur les phases du cycle de la section ; `?metronome=off` le coupe sans couper les autres sons", { tag: "@regression" }, async ({ page }) => {
  for (const off of [false, true]) {
    test.skip(!(await open(page, `/?module=nuit-pont&variante=0&debug${off ? "&metronome=off" : ""}`)), SKIP);
    const run = await page.evaluate(() => {
      const j = (window as unknown as { __jump: Jump }).__jump;
      j.input(2);
      j.advance(36);
      j.input(0);
      const beats: boolean[] = [];
      for (let t = 0; t < 420; t++) {
        j.advance(1);
        for (const e of j.events.slice(-6)) if (e.kind === "metronome" && !beats.includes(e.accent!) ) beats.push(e.accent!);
      }
      return { beats, requested: j.audio.requested };
    });
    // Le jeu produit toujours les événements du tempo (accent sur les bascules, temps faibles entre) ; c'est le son qui est coupé.
    expect(run.beats.sort()).toEqual([false, true]);
    if (off) {
      expect(run.requested.metronome ?? 0).toBe(0);
      expect(Object.keys(run.requested).length, "les autres sons restent demandés").toBeGreaterThan(0);
    } else {
      expect(run.requested.metronome ?? 0).toBeGreaterThan(3);
    }
  }
});
