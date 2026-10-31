import "./legacy";
import { readFileSync } from "node:fs";
import { formatDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ALT_B_REFUSED,
  MODULES,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  V4_ONLY_VARIANTS,
  LASER_VERSION,
  STALACTITE_VERSION,
  VARIETY_DAYS,
  VARIETY_DAYS_BEFORE_LASERS,
  varietyDays,
  DAILY_MAX_ATTEMPTS_LASERS,
  DAILY_MAX_ATTEMPTS_V4,
  VARIETY_EPOCH,
  VARIETY_FROZEN,
  VARIETY_ORIGIN,
  blinkTooFast,
  dailyBaseIds,
  dailyLevel,
  forgetDailyLevels,
  moduleSolutions,
  variantExigence,
  varietyExcluded,
  varietyNeighbours,
  varietyPosition,
  variantUsable,
} from "../src/index";
import { figesPath, figesSource, frozenBaseIds } from "../tools/figes";

// Lot 19 — **variété** : un morceau de base ne revient pas avant `VARIETY_DAYS` jours (toutes variantes confondues), par époques bornées,
// déterministe par date ; les jours figés avant la première époque comptent avec leur contenu réel (`VARIETY_FROZEN`, vérifié contre les
// fichiers par `apps/jump/test/variete.test.ts`).

const N = 365;
const DAYS = Array.from({ length: N }, (_, k) => VARIETY_ORIGIN + k);

describe("lot 25 — W = 4 depuis la version 9 (g19), W = 3 avant", () => {
  it("la règle en vigueur est à 4 jours ; les références v4 à v8 gardent 3 (au bit près : les golden)", () => {
    expect(VARIETY_DAYS).toBe(4);
    expect(VARIETY_DAYS_BEFORE_LASERS).toBe(3);
    expect(varietyDays()).toBe(4);
    expect(varietyDays(LASER_VERSION)).toBe(4);
    for (const v of [4, 5, 6, 7, STALACTITE_VERSION]) expect(varietyDays(v), `v${v}`).toBe(3);
  });

  it("un jour regarde 3 jours de chaque côté à W = 4 (au plus), 2 à W = 3 ; les jours d'une époque sont les mêmes", () => {
    for (const d of DAYS.slice(0, 60)) {
      const w4 = varietyNeighbours(d);
      const w3 = varietyNeighbours(d, STALACTITE_VERSION);
      for (const x of w3) expect(w4.includes(x), `${formatDay(d)} ← ${formatDay(x)}`).toBe(true);
      expect(w4.length).toBeGreaterThanOrEqual(w3.length);
      for (const x of w4) expect(Math.abs(x - d)).toBeLessThan(4);
      for (const x of w3) expect(Math.abs(x - d)).toBeLessThan(3);
    }
  });

  it("jusqu'à 1 000 tentatives par jour en v9 (120 avant : les jours qui réussissaient s'arrêtent au même tirage)", () => {
    expect(DAILY_MAX_ATTEMPTS_V4).toBe(120);
    expect(DAILY_MAX_ATTEMPTS_LASERS).toBe(1000);
  });
});

describe("lot 19 — la règle bornée", () => {
  it("chaque paire de jours à moins de VARIETY_DAYS jours est couverte par l'un des deux, et un jour ne dépend que de son époque et des premiers jours de la suivante", () => {
    for (const d of [...DAYS, VARIETY_ORIGIN - 6, VARIETY_ORIGIN - 1]) {
      for (let j = 1; j < VARIETY_DAYS; j++) {
        const e = d + j;
        if (d < VARIETY_ORIGIN - (VARIETY_DAYS - 1)) continue;
        expect(varietyNeighbours(e).includes(d) || varietyNeighbours(d).includes(e), `${formatDay(d)} / ${formatDay(e)}`).toBe(true);
      }
      // Bornée : la fermeture des dépendances (sans les jours figés) ne sort pas de l'époque et des premiers jours de la suivante.
      const seen = new Set<number>([d]);
      const todo = [d];
      while (todo.length > 0) {
        const x = todo.pop()!;
        for (const y of varietyNeighbours(x)) {
          if (y < VARIETY_ORIGIN && d >= VARIETY_ORIGIN) continue; // jour figé : son contenu est écrit, aucune dépendance
          if (!seen.has(y)) {
            seen.add(y);
            todo.push(y);
          }
        }
      }
      expect(seen.size, formatDay(d)).toBeLessThanOrEqual(VARIETY_EPOCH + VARIETY_DAYS - 1);
    }
    // Les premiers jours d'une époque ne regardent jamais en avant ; seuls les derniers regardent la suivante.
    for (const d of DAYS) {
      const ahead = varietyNeighbours(d).filter((x) => x > d);
      if (varietyPosition(d) < VARIETY_EPOCH - (VARIETY_DAYS - 1)) expect(ahead).toEqual([]);
      for (const x of ahead) expect(varietyPosition(x)).toBeLessThan(VARIETY_DAYS - 1);
    }
  });

  it(`sur ${N} dates à partir du ${formatDay(VARIETY_ORIGIN)} : aucun morceau de base ne revient avant ${VARIETY_DAYS} jours (jours figés compris), secours 0`, () => {
    const ids = new Map<number, Set<string>>();
    for (let d = VARIETY_ORIGIN - (VARIETY_DAYS - 1); d < VARIETY_ORIGIN + N; d++) ids.set(d, new Set(dailyBaseIds(d)));
    for (const d of DAYS) {
      const L = dailyLevel(d);
      expect(L.fallback, formatDay(d)).toBe(false);
      // Lot 28 (g22) : des blocs alternés dans le néon seulement ; jamais une variante qu'on ne peut pas reprendre en B.
      expect(L.level.alts.length > 0, `${formatDay(d)} (${L.theme})`).toBe(L.theme === "neon");
      for (const p of L.pieces) expect(ALT_B_REFUSED[p.id]?.includes(p.variant) ?? false, `${formatDay(d)} ${p.id}:${p.variant}`).toBe(false);
      expect(new Set(L.pieces.map((p) => p.id))).toEqual(ids.get(d));
      for (let j = 1; j < VARIETY_DAYS; j++) {
        const common = [...ids.get(d)!].filter((id) => ids.get(d - j)!.has(id));
        expect(common, `${formatDay(d - j)} → ${formatDay(d)}`).toEqual([]);
      }
      // Ce que le jour écarte, il ne le pose pas.
      for (const id of varietyExcluded(d)) expect(ids.get(d)!.has(id), `${formatDay(d)} ${id}`).toBe(false);
    }
  }, 600_000);

  it("déterministe par date : le même niveau, calculé à froid, quel que soit l'ordre (seul, après ses voisins, ou en remontant le temps)", () => {
    const sample = [0, 5, 6, 40].map((k) => VARIETY_ORIGIN + k);
    const ref = new Map(sample.map((d) => [d, dailyLevel(d).hash]));
    forgetDailyLevels();
    for (const d of [...sample].reverse()) expect(dailyLevel(d).hash, formatDay(d)).toBe(ref.get(d));
    for (const d of sample) {
      forgetDailyLevels();
      expect(dailyLevel(d).hash, `${formatDay(d)} à froid`).toBe(ref.get(d));
      forgetDailyLevels();
      for (const x of varietyNeighbours(d)) dailyLevel(x);
      expect(dailyLevel(d).hash, `${formatDay(d)} après ses voisins`).toBe(ref.get(d));
    }
  }, 300_000);

  it("les jours figés d'avant la première époque sont écrits pour chaque jour à moins de VARIETY_DAYS jours de l'origine", () => {
    for (let j = 1; j < VARIETY_DAYS; j++) expect(VARIETY_FROZEN[formatDay(VARIETY_ORIGIN - j)], formatDay(VARIETY_ORIGIN - j)).toBeDefined();
    for (const list of Object.values(VARIETY_FROZEN)) for (const id of list) expect(MODULES.some((m) => m.id === id), id).toBe(true);
  });
});

describe("lot 20 — VARIETY_FROZEN est déduit des fichiers figés (plus une table tenue à la main)", () => {
  it("`src/figes.ts` est exactement celui que `npm run figes:jump` écrirait d'après `apps/jump/public/levels/` (sinon : relancer figes:jump)", () => {
    expect(readFileSync(figesPath(), "utf8")).toBe(figesSource(frozenBaseIds()));
  });

  it("la table est le contenu des fichiers figés : chaque jour à moins de VARIETY_DAYS jours d'avant l'origine, morceau pour morceau, dans l'ordre du niveau", () => {
    const files = frozenBaseIds();
    expect(VARIETY_FROZEN).toEqual(files);
    expect(Object.keys(files)).toEqual(Array.from({ length: VARIETY_DAYS - 1 }, (_, k) => formatDay(VARIETY_ORIGIN - (VARIETY_DAYS - 1) + k)));
    for (const ids of Object.values(files)) expect(ids.length).toBeGreaterThanOrEqual(6);
  });

  it("la règle lit ces morceaux : le premier jour de la première époque ne reprend aucun morceau des deux jours figés d'avant, et un jour d'avant l'origine rend son contenu figé", () => {
    const first = dailyLevel(VARIETY_ORIGIN).pieces.map((p) => p.id);
    for (let j = 1; j < VARIETY_DAYS; j++) {
      const frozen = dailyBaseIds(VARIETY_ORIGIN - j);
      expect(frozen).toEqual(VARIETY_FROZEN[formatDay(VARIETY_ORIGIN - j)]);
      for (const id of first) expect(frozen.includes(id), `${id} (${formatDay(VARIETY_ORIGIN - j)})`).toBe(false);
    }
  });
});

describe("lot 19 — les variantes ajoutées", () => {
  const LOT19 = ["hausse", "ecart", "decale", "echange", "surface", "clignotant", "alterne", "vent"];
  const added = MODULES.flatMap((def) => (V4_ONLY_VARIANTS[def.id] ?? []).filter((v) => (def.mutations[v] ?? []).some((m) => ["hausse", "ecart", "decale", "echange"].includes(m.name)) || (def.theme === null && (def.mutations[v] ?? []).some((m) => LOT19.includes(m.name)))).map((v) => ({ def, v })));

  it("au moins un emploi de chaque mutateur de silhouette, et chaque variante passe les règles du générateur v4 (phases, voies, rythme)", () => {
    for (const name of ["hausse", "ecart", "decale", "echange"]) expect(added.some(({ def, v }) => def.mutations[v]!.some((m) => m.name === name)), name).toBe(true);
    for (const { def, v } of added) {
      const where = `${def.id} v${v}`;
      // Lot 30 : une variante ajoutée dont la solution (re-résolue pour le maintien minimal) ne tient pas les règles est écartée de la version 13.
      if (!variantUsable(def.id, v)) continue;
      expect(variantExigence(moduleSolutions(def.id, v)), where).toBeGreaterThanOrEqual(1);
      expect(PHASE_REFUSED[def.id]?.includes(v) ?? false, where).toBe(false);
      expect(PARASITE_CLOSED[def.id]?.includes(v) ?? false, where).toBe(false);
      expect(blinkTooFast()[def.id]?.includes(v) ?? false, where).toBe(false);
    }
  });

  it("un échange de danger garde l'exigence de la variante d'origine (mêmes paramètres, sans l'échange)", () => {
    const swaps = added.filter(({ def, v }) => def.mutations[v]!.some((m) => m.name === "echange"));
    expect(swaps.length).toBeGreaterThan(0);
    for (const { def, v } of swaps) {
      const rest = def.mutations[v]!.filter((m) => m.name !== "echange");
      const origin = def.variants.findIndex((vals, k) => k !== v && JSON.stringify(vals) === JSON.stringify(def.variants[v]) && JSON.stringify(def.mutations[k]) === JSON.stringify(rest));
      expect(origin, `${def.id} v${v} : variante d'origine`).toBeGreaterThanOrEqual(0);
      // Lot 30 : les solutions sont re-résolues une à une (la variante échangée peut tomber sur une autre solution que son origine) : à deux notes près (une au premier essai du lot, deux avec le maintien à 6 pas), plus identique.
      if (!variantUsable(def.id, v) || !variantUsable(def.id, origin)) continue;
      expect(Math.abs(variantExigence(moduleSolutions(def.id, v)) - variantExigence(moduleSolutions(def.id, origin))), `${def.id} v${v}`).toBeLessThanOrEqual(2);
    }
  });
});
