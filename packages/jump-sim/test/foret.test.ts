import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  MAX_REST_EXIGENCE,
  MODULES,
  PREMIER_JOUR_JUMP,
  SIGNATURE_MIN_PIECES,
  SIGNATURE_SHARE_MAX,
  SIGNATURE_SHARE_MIN,
  buildModuleDef,
  dailyLevel,
  dailyProblems,
  jumpThemeForDay,
  moduleSolutions,
  variantExigence,
  variantTheme,
  type DailyLevel,
} from "../src/index";

// Lot 13 — la forêt et ses courants d'air dans le générateur : morceaux `theme: foret` (étiquette `vent`), mutateur `+vent:<sens>` réservé à
// la forêt, quota de signature, et **les quatre autres thèmes gardent exactement leurs niveaux** (référence prise avec le code d'avant le
// lot 13 : `fixtures/themes-avant-lot13.json`, 89 dates sur 120 hors forêt ; seuls l'identifiant et la preuve, qui le porte, changent avec g9).

const BEFORE = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/themes-avant-lot13.json"), "utf8")) as Record<string, { theme: string; pieces: string[]; hash: string; authorTicks: number }>;

describe("les quatre autres thèmes inchangés", () => {
  it("usine, glace, nuit et néon : mêmes morceaux, même niveau, même temps de l'auteur, date par date (120 dates)", () => {
    let n = 0;
    for (let d = PREMIER_JOUR_JUMP; d < PREMIER_JOUR_JUMP + 120; d++) {
      const theme = jumpThemeForDay(d);
      if (theme === "foret") continue;
      const ref = BEFORE[formatDay(d)];
      expect(ref, formatDay(d)).toBeDefined();
      // Lot 15 : la référence est celle du générateur v3 (g9), que `dailyLevel(jour, null, 3)` rend encore.
      const L = dailyLevel(d, null, 3);
      expect(L.theme).toBe(ref!.theme);
      expect(L.pieces.map((p) => `${p.id}:${p.variant}`), formatDay(d)).toEqual(ref!.pieces);
      expect(L.hash, formatDay(d)).toBe(ref!.hash);
      expect(L.authorTicks, formatDay(d)).toBe(ref!.authorTicks);
      n++;
    }
    expect(n).toBe(Object.keys(BEFORE).length);
  }, 120_000);
});

describe("morceaux de la forêt", () => {
  const forest = MODULES.filter((d) => d.theme === "foret");

  it("au moins six morceaux `theme: foret`, étiquette `vent` ; un enchaînement long et une respiration", () => {
    expect(forest.length).toBeGreaterThanOrEqual(6);
    for (const d of forest) expect(d.tags, d.id).toContain("vent");
    expect(forest.some((d) => d.long)).toBe(true);
    expect(forest.some((d) => d.tags.includes("respiration"))).toBe(true);
    for (const d of MODULES) expect(d.tags.includes("vent"), d.id).toBe(d.theme === "foret");
  });

  it("chaque variante d'un morceau de forêt a des zones de vent, une solution à chaque entrée, et une exigence non nulle", () => {
    for (const d of forest) {
      for (let v = 0; v < d.variants.length; v++) {
        const m = buildModuleDef(d, v);
        expect(m.level.winds.length, `${d.id} v${v}`).toBeGreaterThan(0);
        expect(variantExigence(moduleSolutions(d.id, v)), `${d.id} v${v}`).toBeGreaterThan(0);
      }
    }
  });

  it("la respiration de la forêt n'est jamais exigeante (2 au plus)", () => {
    for (const d of forest.filter((x) => x.tags.includes("respiration"))) {
      for (let v = 0; v < d.variants.length; v++) expect(variantExigence(moduleSolutions(d.id, v)), `${d.id} v${v}`).toBeLessThanOrEqual(MAX_REST_EXIGENCE);
    }
  });

  it("mutateur `+vent:<sens>` : sur des morceaux ordinaires, une zone de vent, la variante réservée à la forêt", () => {
    const muted = MODULES.flatMap((d) => d.mutations.map((ms, v) => ({ d, v, ms })).filter((x) => x.ms.some((m) => m.name === "vent")));
    expect(muted.length).toBeGreaterThanOrEqual(3);
    for (const { d, v } of muted) {
      expect(d.theme, d.id).toBeNull();
      expect(variantTheme(d, v), `${d.id} v${v}`).toBe("foret");
      expect(buildModuleDef(d, v).level.winds.length).toBeGreaterThan(0);
      expect(variantExigence(moduleSolutions(d.id, v)), `${d.id} v${v}`).toBeGreaterThan(0);
      // Respirations exclues si leur exigence dépasse 2.
      if (d.tags.includes("respiration")) expect(variantExigence(moduleSolutions(d.id, v))).toBeLessThanOrEqual(MAX_REST_EXIGENCE);
    }
    // Les autres variantes de ces morceaux n'ont pas de vent.
    for (const { d } of muted) {
      d.mutations.forEach((ms, v) => {
        if (!ms.some((m) => m.name === "vent")) expect(buildModuleDef(d, v).level.winds.length, `${d.id} v${v}`).toBe(0);
      });
    }
  });
});

describe("niveau du jour en forêt", () => {
  const days: DailyLevel[] = [];
  for (let d = PREMIER_JOUR_JUMP; days.length < 12; d++) if (jumpThemeForDay(d) === "foret") days.push(dailyLevel(d));

  it(`quota de signature : au moins ${SIGNATURE_MIN_PIECES} morceaux de vent, de ${SIGNATURE_SHARE_MIN / 10} à ${SIGNATURE_SHARE_MAX / 10} % du temps de l'auteur ; toutes les règles`, () => {
    for (const L of days) {
      const mech = L.pieces.filter((p) => p.mechanic === "vent");
      const t = mech.reduce((n, p) => n + (p.end - p.start), 0);
      expect(mech.length, L.date).toBeGreaterThanOrEqual(SIGNATURE_MIN_PIECES);
      expect(t * 1000, L.date).toBeGreaterThanOrEqual(SIGNATURE_SHARE_MIN * L.authorTicks);
      expect(t * 1000, L.date).toBeLessThanOrEqual(SIGNATURE_SHARE_MAX * L.authorTicks);
      expect(L.level.winds.length, L.date).toBeGreaterThan(0);
      expect(L.fallback, L.date).toBe(false);
      expect(dailyProblems(L), L.date).toEqual([]);
    }
  });

  it("aucun morceau d'une autre mécanique en forêt, et aucun vent hors de la forêt (thème forcé)", () => {
    for (const L of days) for (const p of L.pieces) expect(p.mechanic === null || p.mechanic === "vent", `${L.date} ${p.id}`).toBe(true);
    const d = parseDay("2027-03-28")!;
    expect(jumpThemeForDay(d)).toBe("usine");
    expect(dailyLevel(d).level.winds.length).toBe(0);
    const forced = dailyLevel(d, "foret");
    expect(forced.forcedTheme).toBe(true);
    expect(forced.id).toMatch(/-tforet$/);
    expect(forced.level.winds.length).toBeGreaterThan(0);
  });
});
