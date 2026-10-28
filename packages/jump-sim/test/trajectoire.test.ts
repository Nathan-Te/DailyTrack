import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ReplayRunner,
  TRAJECTOIRE_PAS,
  TRAJECTOIRE_POINTS_MAX,
  TRAJECTOIRE_RESOLUTION,
  TrajectoireError,
  UNITS_PER_TILE,
  dailyLevel,
  decoderTrajectoire,
  echantillonnerTrajectoire,
  encoderTrajectoire,
  trajectoireDuree,
  trajectoirePose,
} from "../src/index";

// Lot G1 : le fantôme Diamant de Jump est une trajectoire (positions échantillonnées), jamais des entrées.

const NIVEAU = dailyLevel(daysFromCivil(2026, 10, 30));

describe("trajectoire du Diamant (lot G1)", () => {
  const pts = echantillonnerTrajectoire(NIVEAU.level, NIVEAU.replay);
  const texte = encoderTrajectoire(pts);
  const t = decoderTrajectoire(texte);

  it("échantillonne à 30 points par seconde, du départ à l'arrivée", () => {
    expect(TRAJECTOIRE_PAS).toBe(4);
    const pas = NIVEAU.authorTicks;
    expect(t.x.length).toBe(Math.ceil(pas / TRAJECTOIRE_PAS) + 1);
    expect(trajectoireDuree(t)).toBeGreaterThanOrEqual(pas);
    expect(trajectoireDuree(t)).toBeLessThan(pas + TRAJECTOIRE_PAS);
  });

  it("garde les positions du rejeu au 1/64 de tuile près", () => {
    const runner = new ReplayRunner(NIVEAU.level, NIVEAU.replay);
    const demi = 0.5 / TRAJECTOIRE_RESOLUTION + 1e-9;
    expect(Math.abs(t.x[0]! - runner.state.player.x / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
    let n = 0;
    while (runner.step()) {
      if (runner.tick % TRAJECTOIRE_PAS === 0) {
        n++;
        expect(Math.abs(t.x[n]! - runner.state.player.x / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
        expect(Math.abs(t.y[n]! - runner.state.player.y / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
      }
    }
    // Le dernier point est celui de l'arrivée.
    const fin = t.x.length - 1;
    expect(Math.abs(t.x[fin]! - runner.state.player.x / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
  });

  it("ne porte aucune entrée : le texte ne contient ni la rediffusion ni ses séries", () => {
    expect(texte).not.toContain(NIVEAU.code);
    expect(texte.length).toBeLessThan(NIVEAU.code.length * 12);
    // Le format n'a que des positions : un point par échantillon, rien d'autre (octets = 2 + varint + deltas).
    expect(Object.keys(t).sort()).toEqual(["pas", "x", "y"]);
  });

  it("a une taille bornée : quelques ko pour un niveau de 25 à 40 s", () => {
    expect(texte.length).toBeLessThan(8_000);
    expect(pts.length / 2).toBeLessThanOrEqual(TRAJECTOIRE_POINTS_MAX);
  });

  it("s'interpole entre deux échantillons et s'arrête au dernier", () => {
    const a = trajectoirePose(t, 0);
    expect(a).toEqual({ x: t.x[0], y: t.y[0], fini: false });
    const milieu = trajectoirePose(t, 2, 0); // deux pas = la moitié d'un intervalle de 4
    expect(milieu.x).toBeCloseTo((t.x[0]! + t.x[1]!) / 2, 12);
    expect(milieu.y).toBeCloseTo((t.y[0]! + t.y[1]!) / 2, 12);
    const quart = trajectoirePose(t, 1, 0);
    expect(quart.x).toBeCloseTo(t.x[0]! + (t.x[1]! - t.x[0]!) * 0.25, 12);
    const alpha = trajectoirePose(t, 1, 0.5);
    expect(alpha.x).toBeCloseTo(t.x[0]! + (t.x[1]! - t.x[0]!) * 0.375, 12);
    const fin = trajectoirePose(t, trajectoireDuree(t) + 50);
    expect(fin).toEqual({ x: t.x.at(-1), y: t.y.at(-1), fini: true });
    // Avant le départ (chrono négatif, décompte) : le premier point.
    expect(trajectoirePose(t, -30)).toEqual({ x: t.x[0], y: t.y[0], fini: false });
  });

  it("refuse un texte mal formé ou hors limites", () => {
    expect(() => decoderTrajectoire("")).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire("é")).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire(texte.slice(0, 10))).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire(`${texte}AA`)).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire("AAAAAA")).toThrow(TrajectoireError); // format 0
    expect(() => encoderTrajectoire([])).toThrow(TrajectoireError);
  });

  it("encode et décode sans perte des positions négatives et d'un seul point", () => {
    const x = decoderTrajectoire(encoderTrajectoire([-64, 128, 0, -5]));
    expect(x.x).toEqual([-1, 0]);
    expect(x.y).toEqual([2, -5 / 64]);
  });
  it("étirée (lot G1) : même départ, même arrivée, mêmes positions vues plus lentement, finissant au chrono demandé", () => {
    const cible = Math.ceil((NIVEAU.authorTicks * 105) / 100);
    const etiree = decoderTrajectoire(encoderTrajectoire(echantillonnerTrajectoire(NIVEAU.level, NIVEAU.replay, cible)));
    expect(trajectoireDuree(etiree)).toBeGreaterThanOrEqual(cible);
    expect(trajectoireDuree(etiree)).toBeLessThan(cible + TRAJECTOIRE_PAS);
    expect(etiree.x[0]).toBe(t.x[0]);
    expect(etiree.y[0]).toBe(t.y[0]);
    expect(etiree.x[etiree.x.length - 1]).toBe(t.x[t.x.length - 1]);
    expect(etiree.y[etiree.y.length - 1]).toBe(t.y[t.y.length - 1]);
    // au chrono k × t, la position étirée est celle d'origine au chrono t (à l'interpolation près : un échantillon de 4 pas, au plus 0,35 tuile de l'écart de la course)
    const k = cible / NIVEAU.authorTicks;
    for (const f of [0.1, 0.35, 0.5, 0.8]) {
      const t0 = Math.floor(NIVEAU.authorTicks * f);
      const origine = trajectoirePose(t, t0);
      const vue = trajectoirePose(etiree, t0 * k);
      expect(Math.hypot(vue.x - origine.x, vue.y - origine.y), `à ${f}`).toBeLessThan(0.35);
    }
    // ne dépasse jamais l'avance de l'original : à chaque chrono, le fantôme étiré n'a pas plus avancé que l'auteur
    expect(trajectoirePose(etiree, NIVEAU.authorTicks * 0.5).x).toBeLessThanOrEqual(trajectoirePose(t, NIVEAU.authorTicks * 0.5).x + 1e-9);
  });

  it("un chrono cible plus court ou égal à celui de la rediffusion n'étire rien", () => {
    expect(echantillonnerTrajectoire(NIVEAU.level, NIVEAU.replay, NIVEAU.authorTicks)).toEqual(pts);
    expect(echantillonnerTrajectoire(NIVEAU.level, NIVEAU.replay, NIVEAU.authorTicks - 100)).toEqual(pts);
  });
});
