import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  INPUT_RIGHT,
  MODULES,
  PHASE_REFUSED,
  PREMIER_JOUR_JUMP,
  SECTION_CLOCK_VERSION,
  SINGLE_CLOCK_VERSION,
  TICK_RATE,
  V4_ONLY_VARIANTS,
  attemptReplay,
  buildModuleDef,
  dailyLevel,
  decodeReplay,
  encodeReplay,
  fromRuns,
  moduleSolutions,
  moduleSpan,
  variantExigence,
} from "../src/index";
import { PHASE_WAIT_MAX, phaseOk, phaseWait, phasesOf, singleClockModule, variantOk, waitOf, type PhaseResult, type PhasesFile } from "../tools/phasesFile";

// Lot 17 — **attente maximale** : une reprise ne demande jamais plus de 12 s d'attente sur le palier, à aucune phase ; une variante qui la
// dépasse est refusée, comme celle qui n'a pas de solution jouable. Et les trois variantes refusées au lot 15 sont corrigées par une variante
// ajoutée (la refusée garde son texte : la référence v3 reste au bit près) qui passe toutes les phases.

const PHASES = JSON.parse(readFileSync(join(import.meta.dirname, "../modules/phases.json"), "utf8")) as PhasesFile;

/** Un résultat de phase fabriqué : `wait` pas sans commande, puis la droite tenue. */
function fake(wait: number, exigence = 3): PhaseResult {
  const inputs = [...new Array<number>(wait).fill(0), ...new Array<number>(240).fill(INPUT_RIGHT)];
  return { phase: 0, code: encodeReplay(attemptReplay("module:test:0", inputs, 0, 0, SINGLE_CLOCK_VERSION)), exitTick: wait + 240, gigue: [1000, 1000, 1000], exigence };
}

describe("lot 17 — la règle des 12 s", () => {
  it("l'attente est le nombre de pas sans commande avant la première", () => {
    expect(waitOf([])).toBe(0);
    expect(waitOf([2, 0, 2])).toBe(0);
    expect(waitOf([0, 0, 0, 2, 0])).toBe(3);
    expect(phaseWait(fake(500))).toBe(500);
    expect(PHASE_WAIT_MAX).toBe(12 * TICK_RATE);
  });

  it("refuse une phase qui attend plus de 12 s, même jouable, et accepte exactement 12 s", () => {
    expect(phaseOk(fake(PHASE_WAIT_MAX))).toBe(true);
    expect(phaseOk(fake(PHASE_WAIT_MAX + 1))).toBe(false);
    expect(phaseOk(fake(0, 0))).toBe(false); // sans attente mais injouable : toujours refusée
  });

  it("refuse un morceau dont une seule phase dépasse la règle", () => {
    const ok = [fake(0), fake(300), fake(PHASE_WAIT_MAX)];
    expect(variantOk({ phases: ok })).toBe(true);
    expect(variantOk({ phases: [...ok, fake(PHASE_WAIT_MAX + 1)] })).toBe(false);
    expect(variantOk({ phases: [] })).toBe(false);
  });

  it("sur le catalogue : une variante est admise exactement quand toutes ses phases ont une note ≥ 1 et attendent au plus 12 s", () => {
    let cyclic = 0;
    const longWait: string[] = [];
    for (const [id, m] of Object.entries(PHASES.modules)) {
      m.variants.forEach((v, k) => {
        if (!v) return;
        cyclic++;
        expect(v.ok, `${id} v${k}`).toBe(v.phases.every((p) => p.exigence >= 1 && phaseWait(p) <= PHASE_WAIT_MAX));
        expect(PHASE_REFUSED[id]?.includes(k) ?? false, `${id} v${k}`).toBe(!v.ok);
        if (v.phases.some((p) => p.exigence >= 1 && phaseWait(p) > PHASE_WAIT_MAX)) longWait.push(`${id}:${k}`);
      });
    }
    expect(cyclic).toBeGreaterThan(50);
    // La règle ne refuse, par l'attente, que `scie-sol` v3 (deux scies de cycles 330 et 200 : période commune de 6 600 pas, 55 s).
    expect(longWait).toEqual(["scie-sol:3"]);
    const worst = Math.max(...PHASES.modules["scie-sol"]!.variants[3]!.phases.map(phaseWait));
    expect(worst).toBeGreaterThan(40 * TICK_RATE);
    // Toutes les autres reprises du catalogue attendent bien moins (6 s au plus mesurées).
    for (const [id, m] of Object.entries(PHASES.modules)) {
      m.variants.forEach((v, k) => {
        if (!v || (id === "scie-sol" && k === 3)) return;
        for (const p of v.phases) expect(phaseWait(p), `${id} v${k} phase ${p.phase}`).toBeLessThanOrEqual(8 * TICK_RATE);
      });
    }
  });
});

describe("lot 17 — les variantes réadmises (V4_ONLY_VARIANTS)", () => {
  const added = Object.entries(V4_ONLY_VARIANTS).flatMap(([id, list]) => list.map((variant) => ({ id, variant })));

  it("sont trois, chacune à la suite des variantes du morceau, et leurs jumelles refusées restent refusées", () => {
    expect(added).toEqual([
      { id: "scie-sol", variant: 6 },
      { id: "cheminee-scie", variant: 4 },
      { id: "nuit-opposition", variant: 5 },
    ]);
    for (const { id, variant } of added) expect(MODULES.find((d) => d.id === id)!.variants.length, id).toBe(variant + 1);
    expect(PHASE_REFUSED["scie-sol"]).toEqual([3]);
    expect(PHASE_REFUSED["cheminee-scie"]).toEqual([3]);
    expect(PHASE_REFUSED["nuit-opposition"]).toEqual([4]);
  });

  for (const { id, variant } of added) {
    it(`${id} v${variant} : hors de PHASE_REFUSED, toutes les phases ont une solution jouable qui attend au plus 12 s, rejouée dans le morceau`, () => {
      expect(PHASE_REFUSED[id]?.includes(variant) ?? false).toBe(false);
      const s = moduleSolutions(id, variant);
      expect(s?.arret && s.elan && variantExigence(s) >= 1, "solutions jouables aux deux entrées").toBeTruthy();
      const entry = PHASES.modules[id]!.variants[variant]!;
      expect(entry.ok).toBe(true);
      const base = buildModuleDef(MODULES.find((d) => d.id === id)!, variant);
      expect(entry.phases.map((p) => p.phase)).toEqual(phasesOf(entry.period));
      for (const p of entry.phases) {
        expect(p.exigence, `phase ${p.phase}`).toBeGreaterThanOrEqual(1);
        expect(phaseWait(p), `phase ${p.phase}`).toBeLessThanOrEqual(PHASE_WAIT_MAX);
        // La solution gardée, rejouée dans le morceau seul à cette phase, sort vraiment.
        const inputs = fromRuns(decodeReplay(p.code!).runs);
        const span = moduleSpan(singleClockModule(base, p.phase), "arret", inputs);
        expect(typeof span, `phase ${p.phase} : ${String(span)}`).not.toBe("string");
        expect((span as { exitTick: number }).exitTick).toBe(p.exitTick);
      }
    });
  }

  it("la référence v3 ne les connaît pas (aucun niveau v3 n'en pose) ; le générateur g12 en pose (mesuré sur 365 dates)", () => {
    const posed = (day: string, sim: number) => dailyLevel(parseDay(day)!, null, sim).pieces.filter((p) => V4_ONLY_VARIANTS[p.id]?.includes(p.variant)).map((p) => `${p.id}:${p.variant}`);
    expect(posed("2026-10-26", SINGLE_CLOCK_VERSION)).toEqual(["cheminee-scie:4"]);
    expect(posed("2026-11-06", SINGLE_CLOCK_VERSION)).toEqual(["scie-sol:6"]);
    // Les mêmes jours en v3 (g9) : le morceau y est tiré parmi les variantes d'avant seulement.
    for (const day of ["2026-10-26", "2026-11-06"]) expect(posed(day, SECTION_CLOCK_VERSION)).toEqual([]);
    for (let d = 0; d < 30; d++) {
      const pieces = dailyLevel(PREMIER_JOUR_JUMP + d, null, SECTION_CLOCK_VERSION).pieces;
      for (const p of pieces) expect(V4_ONLY_VARIANTS[p.id]?.includes(p.variant) ?? false, `${p.id}:${p.variant}`).toBe(false);
    }
  }, 120_000);
});
