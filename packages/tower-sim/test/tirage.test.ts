import { describe, expect, it } from "vitest";
import { choisirTirage, dansLaPlage, ecartALaPlage, type Essai, PLAFOND_DIAMANT_MM, PLAGE_DIAMANT_MM, TIRAGES_MAX } from "../src";

// Lot T3b — la règle de choix du tirage : le premier tirage dont le Diamant tombe dans la plage [25 m ; 60 m], sinon le plus proche ; au plus TIRAGES_MAX essais.
const e = (...d: number[]): Essai[] => d.map((diamantMm, tirage) => ({ tirage, diamantMm }));

describe("les constantes du tirage", () => {
  it("la plage est de 25 m à 60 m, le plafond du Diamant est le haut de la plage, quatre tirages au plus", () => {
    expect(PLAGE_DIAMANT_MM).toEqual({ min: 25_000, max: 60_000 });
    expect(PLAFOND_DIAMANT_MM).toBe(PLAGE_DIAMANT_MM.max);
    expect(TIRAGES_MAX).toBe(4);
  });
});

describe("dansLaPlage et ecartALaPlage : aux bords, au millimètre", () => {
  it("les bornes sont dans la plage, un millimètre au-delà non", () => {
    expect(dansLaPlage(24_999)).toBe(false);
    expect(dansLaPlage(25_000)).toBe(true);
    expect(dansLaPlage(60_000)).toBe(true);
    expect(dansLaPlage(60_001)).toBe(false);
    expect(ecartALaPlage(25_000)).toBe(0);
    expect(ecartALaPlage(60_000)).toBe(0);
    expect(ecartALaPlage(24_999)).toBe(1);
    expect(ecartALaPlage(4_100)).toBe(20_900);
    expect(ecartALaPlage(60_001)).toBe(1);
  });
});

describe("choisirTirage : le premier dans la plage, sinon le plus proche", () => {
  it("le tirage 0 dans la plage est gardé, même si un suivant serait « meilleur »", () => {
    expect(choisirTirage(e(25_000, 40_000))).toEqual({ essai: { tirage: 0, diamantMm: 25_000 }, dedans: true });
  });
  it("un tirage hors plage est écarté : on prend le premier qui y entre, pas le plus proche du milieu", () => {
    expect(choisirTirage(e(4_100, 14_700, 26_000, 58_000))).toEqual({ essai: { tirage: 2, diamantMm: 26_000 }, dedans: true });
    expect(choisirTirage(e(4_100, 60_000)).essai.tirage).toBe(1);
  });
  it("aucun tirage dans la plage : le plus proche (ici le plus haut sous la plage), dedans = false", () => {
    expect(choisirTirage(e(4_100, 14_700, 24_999, 9_000))).toEqual({ essai: { tirage: 2, diamantMm: 24_999 }, dedans: false });
  });
  it("à écart égal, le premier tirage l'emporte", () => {
    expect(choisirTirage(e(20_000, 20_000, 10_000, 20_000)).essai.tirage).toBe(0);
  });
  it("un seul essai : c'est lui, dedans ou non", () => {
    expect(choisirTirage(e(4_100))).toEqual({ essai: { tirage: 0, diamantMm: 4_100 }, dedans: false });
    expect(() => choisirTirage([])).toThrow();
  });
});
