import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLINK_PHASE_MIN,
  BLINK_PROFILES,
  JUMP_GENERATOR_VERSION,
  MAX_VARIANTS,
  MODULES,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  PREMIER_JOUR_JUMP,
  SECTION_CLOCK_VERSION,
  SINGLE_CLOCK_VERSION,
  TICK_RATE,
  V4_ONLY_VARIANTS,
  blinkPhases,
  blinkRhythmProblems,
  blinkTooFast,
  buildModuleDef,
  dailyLevel,
  fallbackFor,
  moduleSolutions,
  parseLevel,
  parseModule,
  variantExigence,
} from "../src/index";
import type { PhasesFile } from "../tools/phasesFile";

// Lot 18 (g13) — **le rythme de la nuit** : chaque phase d'un bloc clignotant, présente ou absente, dure au moins 1,5 s (180 pas). Une variante
// trop rapide est refusée par le générateur à une seule horloge (elle garde sa place, son texte et ses solutions : la référence v3 ne change pas) ;
// sa remplaçante, plus lente, est ajoutée au bout de la liste (`V4_ONLY_VARIANTS`) et passe toutes les validations.

const PHASES = JSON.parse(readFileSync(join(import.meta.dirname, "../modules/phases.json"), "utf8")) as PhasesFile;

/** Les remplaçantes, par morceau : variante refusée → variante ajoutée (la méthode du lot 17). `nuit-opposition` v4 l'était déjà (v5, lot 17). */
const REPLACED: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  "nuit-cheminee": { 0: 4, 1: 5, 2: 6, 3: 7 },
  "nuit-escalier": { 0: 4, 1: 5, 2: 6, 3: 7 },
  "nuit-marelle": { 0: 4, 1: 5, 2: 6, 3: 7 },
  "nuit-opposition": { 0: 6, 1: 7, 2: 8, 3: 9, 4: 5 },
  "nuit-pont": { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9 },
  "nuit-portes": { 0: 4, 1: 5, 2: 6, 3: 7 },
  "nuit-relais": { 0: 3, 2: 5 }, // v1 : aucune remplaçante plus lente n'a passé (voir NOT_REPLACED et EXTRA)
  marelle: { 5: 6 },
  piliers: { 5: 6 },
};

/**
 * Les variantes refusées **sans remplaçante plus lente** : `nuit-relais` v1 (cycle 330, présent 200, absent 130) — dix-sept cycles essayés (de 380 à 480
 * pas, présent de 180 à 300, plusieurs décalages) sont injouables au sens du lot 8c (la seule solution est « au pas près »), refusés par la validation
 * toutes phases, ou plus longs que 6 s ; la règle ne se relâche pas. Le morceau reçoit à la place une variante en plus (`EXTRA`) : cycle 360, présent
 * 180 (donc moins long que les 200 de v1 : ce n'est pas une remplaçante), décalage 330, qui passe les mêmes validations.
 */
const NOT_REPLACED: Readonly<Record<string, readonly number[]>> = { "nuit-relais": [1] };
const EXTRA: Readonly<Record<string, readonly number[]>> = { "nuit-relais": [4] };

const def = (id: string) => MODULES.find((d) => d.id === id)!;
const phasesOf = (id: string, v: number) => blinkPhases(buildModuleDef(def(id), v).level);
const shortest = (id: string, v: number) => Math.min(...phasesOf(id, v).flatMap((p) => [p.present, p.absent]));

describe("lot 18 — la règle des 1,5 s par phase", () => {
  it("1,5 s = 180 pas", () => {
    expect(BLINK_PHASE_MIN).toBe(1.5 * TICK_RATE);
  });

  it("refuse un niveau dont une phase, présente ou absente, est plus courte ; accepte exactement 180 pas", () => {
    const grid = "#######\n#S.b.F#\n#######\n\n";
    const cycle = (c: number, solid: number) => parseLevel(`${grid}section a 0-6\nclignote a ${c} ${solid} 0\n`);
    expect(blinkRhythmProblems(cycle(360, 180))).toEqual([]);
    expect(blinkRhythmProblems(cycle(420, 240))).toEqual([]);
    expect(blinkRhythmProblems(cycle(359, 179)).join()).toMatch(/présente de 179/); // présente trop courte
    expect(blinkRhythmProblems(cycle(360, 181)).join()).toMatch(/absente de 179/); // absente trop courte
    expect(blinkRhythmProblems(cycle(300, 150))).toHaveLength(2);
    expect(blinkRhythmProblems(parseLevel("#####\n#S.F#\n#####\n"))).toEqual([]); // sans clignotant : rien à refuser
  });

  it("refuse une variante trop rapide du catalogue : nuit-portes à 240 pas de cycle", () => {
    const fast = parseModule(readFileSync(join(import.meta.dirname, "../modules/nuit-portes.txt"), "utf8"));
    expect(blinkRhythmProblems(buildModuleDef(fast, 0).level)).toHaveLength(2); // cycle=240 solide=120 : 120 pas de chaque côté
    expect(blinkTooFast()["nuit-portes"]).toEqual([0, 1, 2, 3]);
    // Le générateur à une seule horloge ne la pose jamais, et ses remplaçantes (plus lentes) passent la règle.
    for (const v of [4, 5, 6, 7]) expect(shortest("nuit-portes", v)).toBeGreaterThanOrEqual(BLINK_PHASE_MIN);
  });

  it("la liste des refusées : toutes les variantes à clignotants sauf celles qui tiennent la règle ; 31 refusées, 30 remplacées par une plus lente (sauf `nuit-relais` v1)", () => {
    const refused = blinkTooFast();
    expect(Object.values(refused).reduce((n, l) => n + l.length, 0)).toBe(31);
    for (const [id, list] of Object.entries(refused)) {
      for (const v of list) {
        expect(shortest(id, v), `${id} v${v}`).toBeLessThan(BLINK_PHASE_MIN);
        if (NOT_REPLACED[id]?.includes(v)) continue;
        const by = REPLACED[id]?.[v];
        expect(by, `${id} v${v} n'a pas de remplaçante`).toBeDefined();
        // La remplaçante est ajoutée au bout de la liste, propre au catalogue v4, et plus lente : chaque phase dure au moins autant, et au moins 1,5 s.
        expect(V4_ONLY_VARIANTS[id]?.includes(by!), `${id} v${by}`).toBe(true);
        expect(by!).toBeGreaterThan(v);
        expect(refused[id]?.includes(by!) ?? false).toBe(false);
        expect(shortest(id, by!)).toBeGreaterThanOrEqual(BLINK_PHASE_MIN);
        const slow = phasesOf(id, by!)[0]!;
        const old = phasesOf(id, v)[0]!;
        expect(slow.present, `${id} v${v} → v${by}`).toBeGreaterThanOrEqual(old.present);
        expect(slow.absent, `${id} v${v} → v${by}`).toBeGreaterThanOrEqual(old.absent);
      }
    }
    // Toute variante à clignotants hors de la liste tient la règle (rien n'est refusé à tort).
    for (const d of MODULES) {
      for (let v = 0; v < d.variants.length; v++) {
        const ps = phasesOf(d.id, v);
        if (ps.length === 0) continue;
        expect(refused[d.id]?.includes(v) ?? false, `${d.id} v${v}`).toBe(shortest(d.id, v) < BLINK_PHASE_MIN);
      }
    }
  });

  it("le profil `calme` remplace `lent` pour le mutateur clignotant (`lent` reste pour la référence v3)", () => {
    expect(BLINK_PROFILES.lent).toEqual({ cycle: 360, solid: 216, shift: 0 });
    const c = BLINK_PROFILES.calme!;
    expect(Math.min(c.solid, c.cycle - c.solid)).toBeGreaterThanOrEqual(BLINK_PHASE_MIN);
  });

  it("chaque remplaçante garde la place de la refusée : ajoutée au bout, `MAX_VARIANTS` relevé à 10 (signalé au rapport)", () => {
    expect(MAX_VARIANTS).toBe(10);
    for (const [id, list] of Object.entries(V4_ONLY_VARIANTS)) {
      const n = def(id).variants.length;
      expect(n, id).toBeLessThanOrEqual(MAX_VARIANTS);
      // Les variantes ajoutées sont au bout de la liste (et chacune après la plus tardive des refusées).
      expect(Math.max(...list), id).toBe(n - 1);
    }
  });
});

describe("lot 18 — les remplaçantes passent toutes les validations", () => {
  const added = Object.entries(V4_ONLY_VARIANTS).flatMap(([id, list]) => list.filter((v) => (REPLACED[id] && Object.values(REPLACED[id]!).includes(v)) || EXTRA[id]?.includes(v)).map((variant) => ({ id, variant })));

  it("il y a 30 variantes ajoutées pour la nuit : 29 remplaçantes (31 refusées : `nuit-opposition` v4 était déjà remplacée au lot 17, `nuit-relais` v1 n'a pas de remplaçante plus lente) et une variante en plus pour `nuit-relais`", () => {
    expect(added.filter((a) => !(a.id === "nuit-opposition" && a.variant === 5))).toHaveLength(30);
  });

  for (const { id, variant } of added) {
    it(`${id} v${variant} : solutions jouables aux deux entrées, toutes phases (attente ≤ 12 s), rien de refusé, aucune voie parasite`, () => {
      const s = moduleSolutions(id, variant);
      expect(s?.arret && s.elan && variantExigence(s) >= 1, "solutions jouables (note ≥ 1)").toBeTruthy();
      expect(PHASE_REFUSED[id]?.includes(variant) ?? false).toBe(false);
      expect(PARASITE_CLOSED[id]?.includes(variant) ?? false).toBe(false);
      expect(blinkTooFast()[id]?.includes(variant) ?? false).toBe(false);
      expect(PHASES.modules[id]!.variants[variant]?.ok, "validation toutes phases").toBe(true);
    });
  }
});

describe("lot 18 — le générateur (g13, puis g14 au lot 19) ne pose que des phases de 1,5 s au moins", () => {
  it("version du générateur : 18 (lot 24 ; la règle du lot 18 est inchangée)", () => {
    expect(JUMP_GENERATOR_VERSION).toBe(18);
  });

  it("120 dates, tous thèmes : chaque clignotant posé (nuit, mais aussi `marelle` / `piliers` mutés) a des phases d'au moins 180 pas", () => {
    let blinking = 0;
    for (let d = 0; d < 120; d++) {
      const day = PREMIER_JOUR_JUMP + 8 + d;
      const L = dailyLevel(day);
      for (const c of L.level.blinkCycles) {
        if (!c) continue;
        blinking++;
        expect(Math.min(c.solid, c.cycle - c.solid), `${L.date} ${L.theme}`).toBeGreaterThanOrEqual(BLINK_PHASE_MIN);
      }
      expect(L.fallback, L.date).toBe(false);
    }
    expect(blinking).toBeGreaterThan(5); // la nuit revient : on a bien regardé des clignotants
  }, 240_000);

  it("la référence v3 (g9) reste ce qu'elle était : elle pose encore des phases plus courtes que 1,5 s", () => {
    let short = 0;
    for (let d = 0; d < 60; d++) {
      const L = dailyLevel(PREMIER_JOUR_JUMP + d, null, SECTION_CLOCK_VERSION);
      for (const c of L.level.blinkCycles) if (c && Math.min(c.solid, c.cycle - c.solid) < BLINK_PHASE_MIN) short++;
    }
    expect(short).toBeGreaterThan(0);
  }, 240_000);

  it("le secours de la nuit (v4) tient la règle ; celui de la référence v3 est inchangé", () => {
    for (const p of fallbackFor("nuit", SINGLE_CLOCK_VERSION)) {
      expect(blinkTooFast()[p.id]?.includes(p.variant) ?? false, `${p.id}:${p.variant}`).toBe(false);
      expect(PHASE_REFUSED[p.id]?.includes(p.variant) ?? false, `${p.id}:${p.variant}`).toBe(false);
    }
    expect(fallbackFor("nuit", SECTION_CLOCK_VERSION)).not.toEqual(fallbackFor("nuit", SINGLE_CLOCK_VERSION));
  });
});
