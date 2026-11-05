import { describe, expect, it } from "vitest";
import { BRIDAGE_FENETRE_MS, DetecteurBridage, bridePar30, mediane, type EchantillonImage } from "@cdj/core/bridage";

/** `secondes` de rendu à `intervalle` ms par image, `travail` ms de fil principal chacune. */
const serie = (intervalle: number, travail: number, secondes = 2): EchantillonImage[] =>
  Array.from({ length: Math.ceil((secondes * 1000) / intervalle) }, () => ({ intervalleMs: intervalle, travailMs: travail }));

const nourrir = (d: DetecteurBridage, images: readonly EchantillonImage[]) => {
  for (const i of images) d.observe(i.intervalleMs, i.travailMs);
};

describe("bridePar30 (lot Q1) : un appareil bridé n'est pas un appareil lent", () => {
  it("la médiane", () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([4, 1, 2, 3])).toBe(2.5);
    expect(mediane([])).toBeNaN();
  });
  it("16 ms (60 i/s) : pas bridé", () => {
    expect(bridePar30(serie(16.7, 4))).toBe(false);
  });
  it("33 ms avec peu de travail : bridé", () => {
    expect(bridePar30(serie(33.3, 3))).toBe(true);
    expect(bridePar30(serie(31, 3))).toBe(true);
    expect(bridePar30(serie(36, 3))).toBe(true);
  });
  it("33 ms avec un fil principal chargé : lent, pas bridé", () => {
    expect(bridePar30(serie(33.3, 25))).toBe(false);
    expect(bridePar30(serie(33.3, 10))).toBe(false); // 10 ms : pas « sous 10 ms »
  });
  it("hors de la plage 31 à 36 ms : pas bridé (20 i/s, 25 i/s, 45 ms, 120 Hz)", () => {
    for (const ms of [8.3, 20, 25, 30.5, 36.5, 45, 66]) expect(bridePar30(serie(ms, 2)), `${ms} ms`).toBe(false);
  });
  it("moins de 2 s de rendu : pas de verdict", () => {
    expect(bridePar30(serie(33.3, 3, 1.5))).toBe(false);
    expect(bridePar30([])).toBe(false);
  });
  it("la médiane tient aux rares images longues (un à-coup ne change pas le verdict)", () => {
    const images = serie(33.3, 3);
    images[5] = { intervalleMs: 120, travailMs: 3 };
    images[9] = { intervalleMs: 90, travailMs: 3 };
    expect(bridePar30(images)).toBe(true);
  });
});

describe("DetecteurBridage", () => {
  it("passe à vrai après 2 s de rendu à 33 ms, une seule fois", () => {
    const d = new DetecteurBridage();
    let changes = 0;
    for (const i of serie(33.3, 3, 6)) if (d.observe(i.intervalleMs, i.travailMs)) changes++;
    expect(d.bride).toBe(true);
    expect(changes).toBe(1);
  });
  it("ne dit rien avant la fenêtre de 2 s", () => {
    const d = new DetecteurBridage();
    nourrir(d, serie(33.3, 3, BRIDAGE_FENETRE_MS / 1000 - 0.3));
    expect(d.bride).toBe(false);
  });
  it("reste faux à 60 images/s et quand l'appareil est chargé", () => {
    const rapide = new DetecteurBridage();
    nourrir(rapide, serie(16.7, 4, 10));
    expect(rapide.bride).toBe(false);
    const charge = new DetecteurBridage();
    nourrir(charge, serie(33.3, 25, 10));
    expect(charge.bride).toBe(false);
  });
  it("redevient faux quand le mode économie d'énergie est coupé", () => {
    const d = new DetecteurBridage();
    nourrir(d, serie(33.3, 3, 4));
    expect(d.bride).toBe(true);
    nourrir(d, serie(16.7, 3, 4));
    expect(d.bride).toBe(false);
  });
  it("ignore une image d'onglet caché et une mesure invalide", () => {
    const d = new DetecteurBridage();
    nourrir(d, serie(33.3, 3, 4));
    for (let i = 0; i < 20; i++) d.observe(2000, 1);
    d.observe(-1, 1);
    d.observe(16, -1);
    expect(d.bride).toBe(true);
  });
  it("reset : repart de zéro", () => {
    const d = new DetecteurBridage();
    nourrir(d, serie(33.3, 3, 4));
    d.reset();
    expect(d.bride).toBe(false);
  });
});
