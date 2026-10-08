import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  GENERATOR_VERSION,
  MAX_VARIANT,
  THEME_NAMES,
  dailyCircuit,
  dailyTrackId,
  isVariant,
  parseDay,
  parseTrack,
  themeForDay,
} from "../src/index";

// Variantes du planning (lot 14) : la variante 0 est exactement le circuit d'avant ; une variante n est un autre circuit,
// validé par le pilote comme les autres, avec son propre identifiant.

const DAYS = ["2026-10-07", "2026-10-13", "2026-10-21"].map((d) => parseDay(d)!);

describe("variantes d'un circuit du jour", () => {
  it("la variante 0 est le circuit d'avant : même texte, même identifiant (sans suffixe)", () => {
    for (const day of DAYS) {
      const a = dailyCircuit(day);
      const b = dailyCircuit(day, 0);
      expect(b.spec).toBe(a.spec);
      expect(b.track.id).toBe(a.track.id);
      expect(b.variant).toBe(0);
      expect(a.track.id).toBe(`jour-${a.date}-g${GENERATOR_VERSION}`);
      expect(dailyTrackId(day)).toBe(a.track.id);
    }
  }, 30_000);

  it("une variante n ≥ 1 est un autre circuit, identifié à part, validé par le pilote, reproductible", () => {
    const day = DAYS[0]!;
    const base = dailyCircuit(day);
    const seen = new Set<string>([base.spec]);
    for (const n of [1, 2, 3]) {
      const v = dailyCircuit(day, n);
      expect(v.fallback).toBe(false);
      expect(v.variant).toBe(n);
      expect(v.forcedTheme).toBe(false);
      expect(v.track.id).toBe(`${base.track.id}-v${n}`);
      expect(v.track.id).toMatch(/^[a-z0-9_-]{1,32}$/);
      expect(v.theme).toBe(base.theme); // même thème que la date
      expect(v.authorMs).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
      expect(v.authorMs).toBeLessThanOrEqual(AUTHOR_MAX_MS);
      expect(dailyCircuit(day, n).spec).toBe(v.spec);
      expect(seen.has(v.spec)).toBe(false);
      seen.add(v.spec);
      // le texte se relit tel quel avec l'identifiant annoncé
      expect(parseTrack(dailyTrackId(day, null, n), v.spec).id).toBe(v.track.id);
    }
  }, 30_000);

  it("le thème peut être imposé avec une variante : id `-v<n>-<thème>`, palette du thème", () => {
    const day = DAYS[1]!;
    const natural = themeForDay(day).name;
    const other = THEME_NAMES.find((t) => t !== natural)!;
    const c = dailyCircuit(day, 2, other);
    expect(c.theme).toBe(other);
    expect(c.forcedTheme).toBe(true);
    expect(c.track.id).toBe(`${dailyTrackId(day)}-v2-${other}`);
    expect(c.track.id).toBe(dailyTrackId(day, other, 2));
    expect(c.track.id.length).toBeLessThanOrEqual(32);
    expect(dailyCircuit(day, 2, other).spec).toBe(c.spec);
    expect(dailyCircuit(day, 2).spec).not.toBe(c.spec);
  }, 30_000);

  it("les variantes ne recoupent pas les tentatives : aucune tentative d'une variante n'est celle d'une autre", () => {
    // La graine d'une variante décale de 1000 tentatives, et le générateur n'en tente que MAX_ATTEMPTS (40).
    const day = DAYS[2]!;
    const specs = [0, 1, 2, 3, 4].map((n) => dailyCircuit(day, n).spec);
    expect(new Set(specs).size).toBe(5);
  }, 30_000);

  it("numéros de variante valides", () => {
    for (const ok of [0, 1, 7, MAX_VARIANT]) expect(isVariant(ok)).toBe(true);
    for (const bad of [-1, 1.5, MAX_VARIANT + 1, "1", null, undefined, NaN]) expect(isVariant(bad)).toBe(false);
  });
});
