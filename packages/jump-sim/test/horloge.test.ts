import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  DEFAULT_JUMP_PARAMS,
  JUMP_THEME_NAMES,
  fallbackFor,
  INPUT_RIGHT,
  JUMP_GENERATOR_VERSION,
  LevelError,
  PLATFORM_GENERATOR,
  PLATFORM_VERSION,
  MUSHROOM_VERSION,
  PRESS_GENERATOR,
  PRESS_VERSION,
  SINGLE_CLOCK_GENERATOR,
  MODULES,
  PALIER_GUARD,
  PHASE_REFUSED,
  RESPAWN_TICKS,
  SECTION_CLOCK_VERSION,
  SINGLE_CLOCK_VERSION,
  reassemble,
  PALIER_LENGTH,
  buildModule,
  centerCol,
  checkpointAttempt,
  cycleMod,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  demoAttempts,
  encodeReplay,
  fromRuns,
  initialAttempt,
  isCleanRun,
  lifeReplay,
  moduleSolutions,
  parseLevel,
  readyAttempt,
  replayAttempt,
  replayFingerprint,
  respawnAttempt,
  respawnProblems,
  sawCenters,
  sectionPeriod,
  sectionPhases,
  stepAttempt,
  variantExigence,
  withSingleClock,
  type AttemptState,
  type DailyLevel,
  type Level,
} from "../src/index";
import { modulePeriod, phasesOf, phasesSource, variantOk, type PhasesFile } from "../tools/phasesFile";

// Lot 15 — **horloge unique des dangers**. Dans un niveau en version 4, tout ce qui tourne vaut `f(t + phase)` : rien n'attend le joueur, rien
// ne revient à zéro à la mort, le chrono part à heure fixe. Le générateur (g10) cale la phase de chaque section sur la référence (elle passe
// sans attendre) et ne pose que des variantes qui passent la **validation toutes phases** (`npm run phases:modules`). Les niveaux en version 3
// (essai, morceaux, jours figés jusqu'au 22/10/2026) gardent leurs règles au bit près (golden v3 : `golden.test.ts`, `replay-golden.test.ts`,
// `daily-golden.json`, `apps/jump/test/figes.test.ts`).

const T = 4096;
const P = DEFAULT_JUMP_PARAMS;

/** Un petit niveau à une scie qui patrouille au-dessus d'un sol, un point de passage au milieu, une fosse au bout (on y meurt). */
const V4_ASCII = `
##############################
#............................#
#............................#
#............................#
#............................#
#S.........C.................F
##########################...#

version 4
section a 1-9 phase 30
section b 10-28 phase 7
scie s1 o 120 aller-retour 4,2 8,2
scie s2 o 90 boucle 14,4 20,4 20,2
`;

const run = (s: AttemptState, inputs: readonly number[], lv: Level) => inputs.reduce((a, b) => stepAttempt(a, b, lv, P), s);

describe("lot 15 — lecture d'un niveau v4 (bloc annexe)", () => {
  const lv = parseLevel(V4_ASCII);

  it("`version 4` et la phase de chaque section ; absente, la version est 3", () => {
    expect(lv.simVersion).toBe(SINGLE_CLOCK_VERSION);
    expect(lv.sections.map((s) => s.phase)).toEqual([30, 7]);
    expect(parseLevel(V4_ASCII.replace("version 4\n", "").replace(/ phase \d+/g, "")).simVersion).toBe(SECTION_CLOCK_VERSION);
  });

  it("une phase n'existe qu'en version 4 ; une version inconnue est refusée", () => {
    expect(() => parseLevel(V4_ASCII.replace("version 4\n", ""))).toThrow(LevelError);
    expect(() => parseLevel(V4_ASCII.replace("version 4", "version 8"))).toThrow(/version/);
    expect(() => parseLevel(V4_ASCII.replace("version 4", "version 2"))).toThrow(/version/);
    expect(() => parseLevel(V4_ASCII.replace("version 4", "version 4\nversion 4"))).toThrow(/déjà/);
  });

  it("withSingleClock : un niveau v3 mis à l'heure unique (phases sur les sections, `version 4`)", () => {
    const v3 = V4_ASCII.replace("version 4\n", "").replace(/ phase \d+/g, "");
    expect(parseLevel(withSingleClock(v3.trim() + "\n", [30, 7])).sections.map((s) => s.phase)).toEqual([30, 7]);
    expect(() => withSingleClock(v3.trim(), [1])).toThrow(/phase par section/);
    expect(sectionPeriod(lv, 0)).toBe(120);
    expect(sectionPeriod(lv, 1)).toBe(90);
  });
});

describe("lot 15 — une seule horloge (v4)", () => {
  const lv = parseLevel(V4_ASCII);

  it("le chrono part au premier pas, commandé ou non ; les scies valent f(t + phase) dès le départ", () => {
    const s0 = initialAttempt(lv);
    expect(s0.status).toBe(ATTEMPT_READY);
    expect(s0.sections).toEqual([]);
    const s1 = stepAttempt(s0, 0, lv, P);
    expect([s1.status, s1.time]).toEqual([ATTEMPT_RUNNING, 1]);
    // Aucune scie n'attend : à t, elles sont là où les met leur horloge, que le personnage soit entré dans leur section ou non.
    const s = run(s0, new Array(50).fill(0), lv);
    expect(sectionPhases(lv, s)).toEqual([50 + 30, 50 + 7]);
    expect(sawCenters(lv, s)).not.toEqual(sawCenters(lv, s0));
  });

  it("une mort sans point de passage fait reprendre au départ, chrono qui continue ; rien ne revient à zéro", () => {
    // Courir tout droit jusqu'à la fosse du bout (le point de passage est pris en route) : mort, puis reprise sur le point.
    let s = initialAttempt(lv);
    let t = 0;
    while (s.status !== ATTEMPT_DEAD && t < 2000) {
      s = stepAttempt(s, INPUT_RIGHT, lv, P);
      t++;
    }
    expect(s.status).toBe(ATTEMPT_DEAD);
    // Sans point de passage pris (un essai neuf, mort tout de suite dans la scie du départ) : forgé directement.
    const dead: AttemptState = { ...initialAttempt(lv), status: ATTEMPT_DEAD, time: 200, deathTicks: 0, deathCause: 2 };
    const back = run(dead, new Array(RESPAWN_TICKS).fill(0), lv);
    expect(back.status).toBe(ATTEMPT_RUNNING);
    expect(back.time).toBe(200 + RESPAWN_TICKS);
    expect(back.player).toEqual(initialAttempt(lv).player);
    expect(back).toEqual(respawnAttempt(lv, { ...dead, time: 200 + RESPAWN_TICKS }));
    expect(sectionPhases(lv, back)).toEqual([200 + RESPAWN_TICKS + 30, 200 + RESPAWN_TICKS + 7]);
  });

  it("la reprise sur un point de passage ne remet aucune horloge à l'arrêt", () => {
    const s = checkpointAttempt(lv, { ...initialAttempt(lv), checkpoint: 0, time: 777 });
    expect(s.sections).toEqual([]);
    expect(sectionPhases(lv, s)).toEqual([777 + 30, 777 + 7]);
  });

  it("avant le départ (« Prêt… »), l'état montré a un chrono négatif et les dangers bougent déjà ; à 0, c'est l'état de départ", () => {
    expect(readyAttempt(lv, 0)).toEqual(initialAttempt(lv));
    const seen = new Set<string>();
    for (let t = -120; t <= 0; t++) seen.add(JSON.stringify(sawCenters(lv, readyAttempt(lv, t))));
    expect(seen.size).toBeGreaterThan(60);
    // Aucun saut au départ : la scie au pas −1 et au pas 0 sont voisines (le pas d'une scie, jamais un bond).
    const a = sawCenters(lv, readyAttempt(lv, -1))[0]!;
    const b = sawCenters(lv, initialAttempt(lv))[0]!;
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThan(T);
  });
});

// ——— Le niveau du jour (générateur g10) ———

/** Les jours régénérés par le lot : de J+2 (la PR date du 21/10/2026) sur deux semaines. */
const FIRST_REGENERATED = parseDay("2026-10-23")!;
/** Lot 20 : la référence v4 (g14, `dailyLevel(jour, thème, 4)`) et le générateur en vigueur (g15, version 5) passent les mêmes vérifications. */
// Lot 22 : la référence v5 (g15) passe aussi les mêmes vérifications ; lot 23 : la référence v6 (g16) aussi, le générateur en vigueur est g17 (version 7).
const GENERATORS = [
  { version: SINGLE_CLOCK_VERSION, generator: SINGLE_CLOCK_GENERATOR },
  { version: PLATFORM_VERSION, generator: PLATFORM_GENERATOR },
  { version: PRESS_VERSION, generator: PRESS_GENERATOR },
  { version: MUSHROOM_VERSION, generator: JUMP_GENERATOR_VERSION },
] as const;

/** Les jours régénérés du générateur en vigueur (g17, version 7). */
const REGENERATED: DailyLevel[] = Array.from({ length: 14 }, (_, k) => dailyLevel(FIRST_REGENERATED + k));

for (const { version, generator } of GENERATORS) {
  const DAYS_OF: DailyLevel[] = Array.from({ length: 14 }, (_, k) => dailyLevel(FIRST_REGENERATED + k, null, version));

  describe(`lot 15 — les jours régénérés (g${generator}, une seule horloge, sim v${version})`, () => {
    it(`sont des niveaux v${version} du générateur g${generator}, sans problème (règles, points de reprise sûrs à toute phase)`, () => {
      for (const L of DAYS_OF) {
        expect(L.level.simVersion, L.date).toBe(version);
        expect(L.id, L.date).toBe(`jour-${L.date}-g${generator}`);
        expect(L.fallback, L.date).toBe(false);
        expect(dailyProblems(L), L.date).toEqual([]);
        expect(respawnProblems(L.level), L.date).toEqual([]);
        for (const p of L.pieces) expect(PHASE_REFUSED[p.id]?.includes(p.variant) ?? false, `${L.date} ${p.id}:${p.variant}`).toBe(false);
      }
    });

    it("la référence passe sans attente : les mêmes commandes qu'en v3 (solutions des morceaux bout à bout), au même temps, sans mort", () => {
      for (const L of DAYS_OF) {
        // Lot 16 : le même assemblage (avec les voies lentes), en version 3.
        const v3 = reassemble(L);
        const asV3 = replayAttempt(v3.level, { ...L.replay, simVersion: SECTION_CLOCK_VERSION }, L.id);
        const asV4 = replayAttempt(L.level, L.replay, L.id);
        expect([asV4.finished, asV4.deaths.length], L.date).toEqual([true, 0]);
        expect(asV4.time, L.date).toBe(asV3.time);
        expect(asV4.time, L.date).toBe(L.authorTicks);
        // Les phases sont celles qui font tourner chaque section comme la référence la rencontrait en v3 (entrée = départ de son horloge).
        L.level.sections.forEach((s, i) => {
          const period = sectionPeriod(L.level, i);
          if (period > 0) expect(cycleMod(s.phase + asV3.final.sections[i]!, period), `${L.date} section ${i}`).toBe(0);
        });
      }
    });
  });
}

// ——— Validation toutes phases ———

const PHASES = JSON.parse(readFileSync(join(import.meta.dirname, "../modules/phases.json"), "utf8")) as PhasesFile;

describe("lot 15 — validation toutes phases (modules/phases.json, src/phases.ts)", () => {
  it("src/phases.ts est celui qu'écrirait phases:modules (sinon : relancer phases:modules)", () => {
    const src = readFileSync(join(import.meta.dirname, "../src/phases.ts"), "utf8");
    expect(src, "relancer phases:modules").toBe(phasesSource(PHASES));
  });

  it("chaque variante utilisable dont l'horloge tourne a son verdict, pour sa grille, à toutes les phases essayées", () => {
    let cyclic = 0;
    for (const def of MODULES) {
      def.variants.forEach((_, v) => {
        const s = moduleSolutions(def.id, v);
        if (!s?.arret || !s.elan || variantExigence(s) < 1) return;
        const m = buildModule(def.id, v);
        const period = modulePeriod(m);
        const entry = PHASES.modules[def.id]?.variants[v] ?? null;
        if (period === 0) {
          expect(entry, `${def.id} v${v}`).toBeNull();
          return;
        }
        cyclic++;
        expect(entry, `${def.id} v${v} : relancer phases:modules`).not.toBeNull();
        expect(entry!.grid, `${def.id} v${v} : relancer phases:modules`).toBe(m.hash);
        expect(entry!.period).toBe(period);
        expect(entry!.phases.map((p) => p.phase)).toEqual(phasesOf(period));
        expect(entry!.ok).toBe(variantOk(entry!)); // lot 17 : note ≥ 1 et attente ≤ 12 s à chaque phase
        expect(PHASE_REFUSED[def.id]?.includes(v) ?? false).toBe(!entry!.ok);
      });
    }
    expect(cyclic).toBeGreaterThan(50);
  });

  it("sur chaque jour régénéré, repartir du point de passage d'un morceau qui tourne, à chaque phase essayée, a une solution : elle le traverse", () => {
    let checked = 0;
    for (const L of REGENERATED) {
      const lv = L.level;
      L.pieces.forEach((p, k) => {
        const entry = PHASES.modules[p.id]?.variants[p.variant];
        if (!entry) return;
        const m = buildModule(p.id, p.variant);
        expect(m.palierIn.col0).toBe(PALIER_GUARD);
        const period = sectionPeriod(lv, k);
        expect(period, `${L.date} ${p.id}`).toBe(entry.period);
        for (const ph of entry.phases) {
          const where = `${L.date} ${p.id}:${p.variant} phase ${ph.phase}`;
          expect(ph.code, where).not.toBeNull();
          // Une reprise après une mort, au chrono où l'horloge du morceau est à cette phase (`chrono + phase de la section ≡ φ`).
          const time = 1000 + cycleMod(ph.phase - lv.sections[k]!.phase - 1000, period);
          let s = k === 0 ? respawnAttempt(lv, { ...initialAttempt(lv), time }) : checkpointAttempt(lv, { ...initialAttempt(lv), checkpoint: k - 1, time });
          // Lot 16 : devant une portion dure, on attend sur le palier « bis » de sa zone (l'entrée du morceau seul, à l'identique).
          if (L.slowRoutes.some((r) => r.piece === k)) s = { ...s, player: { ...s.player, x: s.player.x + (p.col0 - PALIER_LENGTH - L.paliers[k]!.col0) * T } };
          expect(cycleMod(sectionPhases(lv, s)[k]!, period), where).toBe(ph.phase);
          const inputs = fromRuns(decodeReplay(ph.code!).runs);
          const last = k === L.pieces.length - 1;
          let out = false;
          for (let t = 0; t < inputs.length && !out; t++) {
            s = stepAttempt(s, inputs[t]!, lv, P);
            expect(s.status, where).not.toBe(ATTEMPT_DEAD);
            if (s.status === ATTEMPT_FINISHED) out = true;
            else if (!last && centerCol(s.player) > L.paliers[k + 1]!.col1) {
              expect(isCleanRun(s.player), where).toBe(true);
              out = true;
            }
          }
          expect(out, where).toBe(true);
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(50);
  }, 120_000);
});

describe("lot 15 — les suites de secours v4 n'ont aucune variante refusée", () => {
  it("chaque thème", () => {
    for (const theme of JUMP_THEME_NAMES) {
      for (const p of fallbackFor(theme)) expect(PHASE_REFUSED[p.id]?.includes(p.variant) ?? false, `${theme} ${p.id}:${p.variant}`).toBe(false);
    }
  });
});

// ——— Déterminisme v4 (référence) ———

/**
 * Lot 20 : deux références. `replay-golden-v4.json` : **la référence v4, intacte** (g14, écrite au lot 19) — `dailyLevel(jour, thème, 4)` doit encore la rendre au bit près,
 * et ses rediffusions rejouer les mêmes états ; elle ne se régénère jamais. `replay-golden-v5.json` : le générateur en vigueur (g15, sim v5) ; `UPDATE_GOLDEN=1` n'écrit que celle-là.
 */
const GOLDEN_FILES = {
  [SINGLE_CLOCK_VERSION]: join(import.meta.dirname, "fixtures/replay-golden-v4.json"),
  [PLATFORM_VERSION]: join(import.meta.dirname, "fixtures/replay-golden-v5.json"),
  [PRESS_VERSION]: join(import.meta.dirname, "fixtures/replay-golden-v6.json"),
  [MUSHROOM_VERSION]: join(import.meta.dirname, "fixtures/replay-golden-v7.json"),
} as const;
// Lot 18 (g13) : le 25/10 n'a plus de mort avant le premier point de passage parmi les 24 essais fictifs (la couverture « reprise au départ » du test
// manquerait) ; le 31/10, une nuit aussi, en a 28. La couverture exigée ci-dessous ne change pas. Lot 19 (g14) : le 31/10 n'en a plus aucune ; le 09/11,
// une nuit (46 blocs clignotants, 8 scies), en a 21 (mesuré sur les jours g14 du 27/10 au 19/11). Lot 20 : la journée de référence v5 est le 08/11 (une forêt à 2 plateformes : 63 reprises au départ, 40 sur un point parmi les essais fictifs).
// Lot 22 : la journée de référence v6 est le 03/12 (une usine à deux presses, `presse-ilot` : des morts avant le premier point et sur un point parmi les 24 essais fictifs ; les 06/11 et 23/11 n'avaient pas de reprise au départ).
// Lot 23 : la journée de référence v7 est le 28/11 (une forêt à champignons de sol et de mur, un courant d'air et un puits en zigzag : 19 reprises au départ et 10 sur un point parmi les 24 essais fictifs). La v6 (g16, 03/12) est intacte.
const GOLDEN_DAYS = { [SINGLE_CLOCK_VERSION]: parseDay("2026-11-09")!, [PLATFORM_VERSION]: parseDay("2026-11-08")!, [PRESS_VERSION]: parseDay("2026-12-03")!, [MUSHROOM_VERSION]: parseDay("2026-11-28")! } as const;

interface GoldenV4 {
  jumpSimVersion: number;
  jumpGeneratorVersion: number;
  level: string;
  /** Le texte du niveau : les navigateurs le rejouent (`apps/jump/e2e/replay.spec.ts`, `verify.html`). */
  ascii: string;
  replays: { name: string; code: string; hash: string; finished: boolean; ticks: number; time: number; deaths: number }[];
}

function goldenReplays(version: 4 | 5 | 6 | 7): GoldenV4["replays"] {
  const L = dailyLevel(GOLDEN_DAYS[version], null, version);
  const codes: { name: string; code: string }[] = [{ name: "preuve de l'auteur", code: L.code }];
  const essais = demoAttempts(L.level, L.replay, 15, { attempts: 24, maxLives: 8 });
  essais.forEach((r, i) => codes.push({ name: `essai fictif ${i} (${r.end})`, code: encodeReplay(r.replay) }));
  // Trois vies reprises au départ (chrono qui continue) et trois reprises sur un point de passage.
  const taken = { start: 0, point: 0 };
  let lives = 0;
  for (const r of essais) {
    for (const life of replayAttempt(L.level, r.replay).lives) {
      const kind = life.start.checkpoint < 0 ? "start" : "point";
      if (life.start.time === 0 || taken[kind] >= 3) continue;
      taken[kind]++;
      const at = kind === "start" ? "départ" : `point ${life.start.checkpoint}`;
      codes.push({ name: `vie ${lives} (reprise : ${at}, ${life.end})`, code: encodeReplay(lifeReplay(r.replay, life)) });
      lives++;
    }
  }
  return codes.map((c) => ({ ...c, ...replayFingerprint(L.level, decodeReplay(c.code)) }));
}

if (process.env.UPDATE_GOLDEN) {
  const L = dailyLevel(GOLDEN_DAYS[MUSHROOM_VERSION], null, MUSHROOM_VERSION);
  const golden: GoldenV4 = { jumpSimVersion: MUSHROOM_VERSION, jumpGeneratorVersion: JUMP_GENERATOR_VERSION, level: L.hash, ascii: L.ascii, replays: goldenReplays(MUSHROOM_VERSION) };
  writeFileSync(GOLDEN_FILES[MUSHROOM_VERSION], JSON.stringify(golden, null, 2) + "\n");
}

for (const [version, generator] of [[SINGLE_CLOCK_VERSION, SINGLE_CLOCK_GENERATOR], [PLATFORM_VERSION, PLATFORM_GENERATOR], [PRESS_VERSION, PRESS_GENERATOR], [MUSHROOM_VERSION, JUMP_GENERATOR_VERSION]] as const) {
  describe(`lot 15/20/22/23 — déterminisme v${version} (fixtures/replay-golden-v${version}.json)`, () => {
    const golden = JSON.parse(readFileSync(GOLDEN_FILES[version], "utf8")) as GoldenV4;
    const day = GOLDEN_DAYS[version];

    it(`le niveau du ${formatDay(day)} et ses rediffusions (preuve, essais fictifs, vies reprises au départ et aux points) rejouent les mêmes états`, () => {
      expect(golden.jumpSimVersion).toBe(version);
      expect(golden.jumpGeneratorVersion, "JUMP_GENERATOR_VERSION a changé : UPDATE_GOLDEN=1").toBe(generator);
      expect(dailyLevel(day, null, version).hash).toBe(golden.level);
      expect(dailyLevel(day, null, version).ascii).toBe(golden.ascii);
      expect(goldenReplays(version)).toEqual(golden.replays);
      // La référence couvre des morts, des reprises au départ (chrono qui continue) et sur un point de passage.
      expect(golden.replays.some((r) => r.deaths >= 2)).toBe(true);
      expect(golden.replays.some((r) => r.name.includes("reprise : départ"))).toBe(true);
      expect(golden.replays.some((r) => r.name.includes("reprise : point"))).toBe(true);
    }, 60_000); // génération du jour, 24 essais fictifs et ~30 rejeux : ≈ 3 s seul, plus de 5 s sur le runner chargé de la CI

    it("deux rejeux de la même rediffusion donnent les mêmes états, et une rediffusion d'une autre version est refusée", () => {
      const L = dailyLevel(day, null, version);
      expect(replayFingerprint(L.level, L.replay)).toEqual(replayFingerprint(L.level, decodeReplay(L.code)));
      expect(() => replayAttempt(L.level, { ...L.replay, simVersion: SECTION_CLOCK_VERSION }, L.id)).toThrow(/version/);
      expect(() => replayAttempt(L.level, { ...L.replay, simVersion: version === SINGLE_CLOCK_VERSION ? PLATFORM_VERSION : SINGLE_CLOCK_VERSION }, L.id)).toThrow(/version/);
    });
  });
}
