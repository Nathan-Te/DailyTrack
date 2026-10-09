import { describe, expect, it } from "vitest";
import { AUTHOR_MAX_MS, AUTHOR_MIN_MS, GENERATOR_VERSION, SALON_SEED_BASE, SALON_SESSION_MS, THEME_NAMES, dailyCircuit, replayRace, runFictional, salonCircuit, salonSessionAt, salonSessionEnd, salonSessionStart, salonTheme, salonTrackId, styleFor, decodeReplay } from "../src/index";

// Le Salon (lot 26) : un circuit par session de 10 minutes, calculé à partir du seul numéro de session.

describe("sessions", () => {
  it("le numéro de session est la partie entière de l'heure UTC divisée par la durée", () => {
    const t = Date.UTC(2026, 9, 9, 14, 23, 17);
    const s = salonSessionAt(t);
    expect(salonSessionStart(s)).toBe(Date.UTC(2026, 9, 9, 14, 20, 0));
    expect(salonSessionEnd(s)).toBe(Date.UTC(2026, 9, 9, 14, 30, 0));
    expect(salonSessionAt(salonSessionStart(s))).toBe(s);
    expect(salonSessionAt(salonSessionEnd(s) - 1)).toBe(s);
    expect(salonSessionAt(salonSessionEnd(s))).toBe(s + 1);
  });

  it("une durée raccourcie (essais) aligne les sessions sur ses multiples", () => {
    const two = 2 * 60_000;
    const t = Date.UTC(2026, 9, 9, 14, 23, 17);
    expect(salonSessionStart(salonSessionAt(t, two), two)).toBe(Date.UTC(2026, 9, 9, 14, 22, 0));
    expect(SALON_SESSION_MS).toBe(600_000);
  });
});

describe("thème de session", () => {
  it("deux sessions de suite n'ont jamais le même thème (1 000 sessions consécutives, plusieurs époques)", () => {
    for (const from of [0, 2_970_000, 2_970_001, 1_234_567, 99_999_998]) {
      for (let s = from; s < from + 1000; s++) expect(salonTheme(s + 1), `session ${s}`).not.toBe(salonTheme(s));
    }
  });

  it("les huit thèmes apparaissent, à des fréquences comparables", () => {
    const count = new Map<string, number>();
    for (let s = 2_970_000; s < 2_970_000 + 8000; s++) count.set(salonTheme(s), (count.get(salonTheme(s)) ?? 0) + 1);
    expect([...count.keys()].sort()).toEqual([...THEME_NAMES].sort());
    for (const n of count.values()) expect(n).toBeGreaterThan(700); // 1 000 en moyenne
  });

  it("est déterministe", () => {
    expect(salonTheme(2_970_123)).toBe(salonTheme(2_970_123));
    expect(salonTheme(-3)).toBe(salonTheme(-3));
  });
});

describe("circuit de session", () => {
  const session = 2_970_001;

  it("a l'identifiant salon-<session>-g<GENERATOR_VERSION> et ne dépend que du numéro", () => {
    const a = salonCircuit(session);
    const b = salonCircuit(session);
    expect(a.id).toBe(`salon-${session}-g${GENERATOR_VERSION}`);
    expect(a.id).toBe(salonTrackId(session));
    expect(a.track.id).toBe(a.id);
    expect(b.spec).toBe(a.spec);
    expect(b.authorMs).toBe(a.authorMs);
    expect(a.theme).toBe(salonTheme(session));
    expect(a.fallback).toBe(false);
  });

  it("n'est pas un circuit du jour : graine distincte", () => {
    expect(SALON_SEED_BASE).toBeGreaterThan(1_000_000);
    // même numéro pris pour un jour : un autre circuit, et jamais l'identifiant d'un circuit du jour
    const s = salonCircuit(20_000);
    const d = dailyCircuit(20_000);
    expect(s.id.startsWith("salon-")).toBe(true);
    expect(s.spec).not.toBe(d.spec);
  });

  it("dure 30 à 40 s (temps de l'auteur) et se génère vite : 16 sessions, temps mesuré", () => {
    const times: number[] = [];
    const themes = new Set<string>();
    for (let k = 0; k < 16; k++) {
      const t0 = performance.now();
      const c = salonCircuit(2_970_000 + k);
      times.push(performance.now() - t0);
      themes.add(c.theme);
      expect(c.fallback, `session ${c.session}`).toBe(false);
      expect(c.authorMs).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
      expect(c.authorMs).toBeLessThanOrEqual(AUTHOR_MAX_MS);
    }
    times.sort((a, b) => a - b);
    console.log(`salonCircuit : médiane ${times[8]!.toFixed(0)} ms, pire ${times[15]!.toFixed(0)} ms (thèmes vus : ${[...themes].join(", ")})`);
    expect(themes.size).toBeGreaterThanOrEqual(5);
    expect(times[15]!).toBeLessThan(5000);
  }, 90_000);
});

describe("pilotes fictifs (partagés avec l'historique du lot 11)", () => {
  it("une course fictive est rejouée à l'identique par le rejeu de référence", () => {
    const c = salonCircuit(2_970_002);
    const run = runFictional(c.track, styleFor(0.9), 7);
    expect(run).not.toBeNull();
    const replayed = replayRace(c.track, decodeReplay(run!.code));
    expect(replayed.finished).toBe(true);
    expect(replayed.finishMs).toBe(run!.finishMs);
  });
});
