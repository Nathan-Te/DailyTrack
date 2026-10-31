import "./legacy";
import { legacyCatalog } from "../src/legacyRegistry";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ALT_B_REFUSED,
  MIN_HOLD_VERSION,
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  MODULES,
  PALIER_LENGTH,
  buildModule,
  centerCol,
  checkpointAttempt,
  cycleMod,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  fromRuns,
  initialAttempt,
  isCleanRun,
  jumpThemeForDay,
  moduleSolutions,
  moduleSpan,
  parseLevel,
  pressProblems,
  sectionPeriod,
  sectionPhases,
  stepAttempt,
  swapAlternes,
  variantExigence,
} from "../src/index";
import { ETATS_RULE_VERSION, etatsSource, moveWait, phaseOkB, swappedModule, variantOkB } from "../tools/etatsFile";
import { PHASE_WAIT_MAX, modulePeriod, phasesOf, singleClockModule, type PhasesFile } from "../tools/phasesFile";

// Lot 28 — la **validation de la reprise depuis l'état B** (`npm run etats:modules`, `tools/etatsFile.ts`, `modules/etats.json`, `src/etats.ts`). Depuis la version 12 la reprise sur un point de
// passage garde l'état des blocs alternés : chaque variante à blocs alternés doit pouvoir être reprise du palier d'entrée en B, à chaque phase de son horloge, avec une solution jouable par un
// humain (règle du lot 8c) qui ne reste pas plus de 12 s sur le palier. Le générateur g22 ne pose jamais une variante refusée.

const ETATS = JSON.parse(readFileSync(join(import.meta.dirname, "../modules/etats.json"), "utf8")) as PhasesFile;
const P = DEFAULT_JUMP_PARAMS;

describe("lot 28 — modules/etats.json et src/etats.ts", () => {
  it("src/etats.ts est celui qu'écrirait etats:modules (sinon : relancer etats:modules)", () => {
    expect(readFileSync(join(import.meta.dirname, "../src/etats.ts"), "utf8"), "relancer etats:modules").toBe(etatsSource(ETATS));
    expect(ETATS.rule).toBe(ETATS_RULE_VERSION);
  });

  it("chaque variante utilisable à blocs alternés a son verdict, pour sa grille, à toutes les phases essayées ; les autres n'en ont pas", () => {
    let withAlts = 0;
    for (const def of MODULES) {
      def.variants.forEach((_, v) => {
        const s = moduleSolutions(def.id, v);
        const m = buildModule(def.id, v);
        const entry = ETATS.modules[def.id]?.variants[v] ?? null;
        if (m.level.alts.length === 0 || !s?.arret || !s.elan || variantExigence(s) < 1) {
          expect(entry, `${def.id} v${v}`).toBeNull();
          return;
        }
        withAlts++;
        const period = modulePeriod(m);
        expect(entry, `${def.id} v${v} : relancer etats:modules`).not.toBeNull();
        expect(entry!.grid, `${def.id} v${v} : relancer etats:modules`).toBe(m.hash);
        expect(entry!.period).toBe(period);
        expect(entry!.phases.map((p) => p.phase)).toEqual(period === 0 ? [0] : phasesOf(period));
        expect(entry!.ok).toBe(variantOkB(entry!));
        expect(ALT_B_REFUSED[def.id]?.includes(v) ?? false, `${def.id} v${v}`).toBe(!entry!.ok);
      });
    }
    // Les huit morceaux du néon et les deux morceaux génériques à `+alterne` : 40 variantes au lot 28 ; lot 30 : 37 (trois sont écartées par la règle des appuis de 10 pas).
    expect(withAlts).toBeGreaterThanOrEqual(35);
  });

  it("chaque solution gardée, rejouée sur le morceau aux jeux échangés (= l'état B du morceau), arrive à la sortie, sans mort, jouable au clavier, et ne reste pas plus de 12 s sur le palier", () => {
    let checked = 0;
    for (const [id, entry] of Object.entries(ETATS.modules)) {
      entry.variants.forEach((v, variant) => {
        if (!v) return;
        const base = buildModule(id, variant);
        for (const ph of v.phases) {
          if (!phaseOkB(ph)) continue;
          const m = swappedModule(base.level.sections.length === 0 ? base : singleClockModule(base, ph.phase));
          const inputs = fromRuns(decodeReplay(ph.code!).runs);
          const where = `${id} v${variant} phase ${ph.phase}`;
          expect(pressProblems(inputs), where).toBeNull();
          expect(typeof moduleSpan(m, "arret", inputs), where).toBe("object");
          expect(moveWait(inputs), where).toBeLessThanOrEqual(PHASE_WAIT_MAX);
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(60);
  });

  it("une variante refusée est écartée du catalogue g22 et suivants mais garde sa place (les références d'avant la connaissent) ; la liste d'avant (legacy) garde `laser-alterne-portes` v6", () => {
    // Lot 30 : avec le maintien minimal, plus aucune variante n'est refusée à la reprise en B (la liste est vide) ; celle du catalogue d'avant est dans `src/legacy/refuses.ts`.
    expect(legacyCatalog().altBRefused).toEqual({ "laser-alterne-portes": [6] });
    const refused = Object.entries(ALT_B_REFUSED);
    for (const [id, variants] of refused) {
      const def = MODULES.find((d) => d.id === id)!;
      for (const v of variants) expect(def.variants.length, `${id} v${v}`).toBeGreaterThan(v);
    }
    // Aucun des jours g22 sur 60 dates ne la pose.
    const from = daysFromCivil(2026, 10, 28);
    for (let k = 0; k < 60; k++) {
      const L = dailyLevel(from + k, null, MIN_HOLD_VERSION);
      for (const p of L.pieces) expect(ALT_B_REFUSED[p.id]?.includes(p.variant) ?? false, `${L.date} ${p.id}:${p.variant}`).toBe(false);
    }
  }, 120_000);

  it("swapAlternes échange A et B de la grille, jamais le bloc annexe", () => {
    const text = "#####\n#AB.#\n#S.F#\n\nversion 3\nsection a 1-3\n";
    const swapped = swapAlternes(text);
    expect(swapped).toBe("#####\n#BA.#\n#S.F#\n\nversion 3\nsection a 1-3\n");
    expect(swapAlternes(swapped)).toBe(text);
    const a = parseLevel(text);
    const b = parseLevel(swapped);
    expect(a.alts.map((x) => x.set)).toEqual([0, 1]);
    expect(b.alts.map((x) => x.set)).toEqual([1, 0]);
  });
});

describe("lot 28 — sur les jours de néon g22, la reprise en B traverse chaque morceau à blocs alternés, à chaque phase essayée", () => {
  it("repartir du point de passage qui précède un morceau à alternés, les jeux en B, a une solution : elle le traverse", () => {
    let checked = 0;
    const from = daysFromCivil(2026, 10, 28);
    for (let d = 0; d < 40; d++) {
      if (jumpThemeForDay(from + d) !== "neon") continue;
      const L = dailyLevel(from + d, null, MIN_HOLD_VERSION);
      const lv = L.level;
      expect(dailyProblems(L), L.date).toEqual([]);
      L.pieces.forEach((p, k) => {
        const entry = ETATS.modules[p.id]?.variants[p.variant];
        if (!entry || k === 0) return;
        const period = sectionPeriod(lv, k);
        for (const ph of entry.phases) {
          const where = `${L.date} ${p.id}:${p.variant} phase ${ph.phase}`;
          expect(ph.code, where).not.toBeNull();
          // Une reprise après une mort, au chrono où l'horloge du morceau est à cette phase, les jeux en B.
          const time = 1000 + (period === 0 ? 0 : cycleMod(ph.phase - lv.sections[k]!.phase - 1000, period));
          let s = checkpointAttempt(lv, { ...initialAttempt(lv), checkpoint: k - 1, time, alt: 1 });
          expect(s.alt, where).toBe(1);
          if (period > 0) expect(cycleMod(sectionPhases(lv, s)[k]!, period), where).toBe(ph.phase);
          if (L.slowRoutes.some((r) => r.piece === k)) s = { ...s, player: { ...s.player, x: s.player.x + (p.col0 - PALIER_LENGTH - L.paliers[k]!.col0) * 4096 } };
          const inputs = fromRuns(decodeReplay(ph.code!).runs);
          const last = k === L.pieces.length - 1;
          const exitCol = !last && L.slowRoutes.some((r) => r.piece === k + 1) ? L.paliers[k + 1]!.col1 - 1 : last ? 0 : L.paliers[k + 1]!.col1;
          let out = false;
          for (let t = 0; t < inputs.length && !out; t++) {
            s = stepAttempt(s, inputs[t]!, lv, P);
            expect(s.status, where).not.toBe(ATTEMPT_DEAD);
            if (s.status === ATTEMPT_FINISHED) out = true;
            else if (!last && centerCol(s.player) > exitCol) {
              if (exitCol === L.paliers[k + 1]!.col1) expect(isCleanRun(s.player), where).toBe(true);
              out = true;
            }
          }
          expect(out, where).toBe(true);
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(20);
  }, 120_000);
});

