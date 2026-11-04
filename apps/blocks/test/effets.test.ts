import { describe, expect, it } from "vitest";
import { bosse, DUREE_GAIN, DUREE_ILLUMINATION, eclater, etatAnnonce, etatGain, etatParticule, hasardAffichage, illumination, illuminationFinie, PARTICULES_MAX } from "../src/effets";

const cases = (n: number) => Array.from({ length: n }, (_, i) => ({ col: i % 8, ligne: Math.floor(i / 8), couleur: "#E5534B" }));

describe("les effets (purs)", () => {
  it("le hasard d'affichage est déterministe et dans [0, 1)", () => {
    const a = hasardAffichage(42);
    const b = hasardAffichage(42);
    const va = Array.from({ length: 50 }, a);
    expect(va).toEqual(Array.from({ length: 50 }, b));
    expect(va.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it("l'illumination monte de 0 à 1 puis la case éclate à DUREE_ILLUMINATION", () => {
    expect(illumination(0)).toBe(0);
    expect(illumination(DUREE_ILLUMINATION)).toBe(1);
    expect(illuminationFinie(DUREE_ILLUMINATION - 0.01)).toBe(false);
    expect(illuminationFinie(DUREE_ILLUMINATION)).toBe(true);
  });
  it("les particules sont de la couleur de leur case, jamais plus de PARTICULES_MAX (même avec une grille entière)", () => {
    const p = eclater(cases(16), 1, hasardAffichage(1));
    expect(p.length).toBe(16 * 5);
    expect(p.every((x) => x.couleur === "#E5534B" && x.t0 === 1)).toBe(true);
    expect(eclater(cases(64), 0, hasardAffichage(1)).length).toBeLessThanOrEqual(PARTICULES_MAX);
    expect(eclater(cases(64), 0, hasardAffichage(1), PARTICULES_MAX - 10).length).toBeLessThanOrEqual(10);
    expect(eclater(cases(8), 0, hasardAffichage(1), PARTICULES_MAX)).toEqual([]);
  });
  it("une particule tombe, rétrécit et disparaît à la fin de sa vie", () => {
    const [p] = eclater(cases(1), 0, hasardAffichage(3));
    const debut = etatParticule(p!, 0)!;
    const fin = etatParticule(p!, p!.vie - 0.001)!;
    expect(fin.taille).toBeLessThan(debut.taille);
    expect(fin.alpha).toBeLessThan(debut.alpha);
    expect(etatParticule(p!, p!.vie)).toBeNull();
    expect(etatParticule(p!, -1)).toBeNull();
  });
  it("une annonce apparaît en rebondissant (0,6 → plus de 1 → 1) et s'efface avant sa fin", () => {
    const a = { texte: "Combo ×3 !", t0: 0, duree: 1, genre: "combo" as const };
    expect(etatAnnonce(a, 0)!.echelle).toBeCloseTo(0.6);
    expect(etatAnnonce(a, 0.21)!.echelle).toBeGreaterThan(1);
    expect(etatAnnonce(a, 0.5)!.echelle).toBe(1);
    expect(etatAnnonce(a, 0.95)!.alpha).toBeLessThan(1);
    expect(etatAnnonce(a, 1.01)).toBeNull();
    expect(etatAnnonce(a, -0.1)).toBeNull();
  });
  it("un gain flottant monte et s'efface", () => {
    const g = { texte: "+270", x: 3, y: 4, t0: 0, grand: false };
    expect(etatGain(g, 0)!.y).toBe(4);
    expect(etatGain(g, DUREE_GAIN * 0.9)!.y).toBeLessThan(3);
    expect(etatGain(g, DUREE_GAIN * 0.95)!.alpha).toBeLessThan(1);
    expect(etatGain(g, DUREE_GAIN + 0.01)).toBeNull();
  });
  it("la bosse du compteur vaut 0 hors de son instant", () => {
    expect(bosse(-1)).toBe(0);
    expect(bosse(0.14)).toBeCloseTo(1);
    expect(bosse(0.3)).toBe(0);
  });
});
