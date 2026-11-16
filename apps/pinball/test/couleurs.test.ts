import { describe, expect, it } from "vitest";
import { dansQuad, mesurerCouleurs } from "./couleurs";

// Lot PBV3 : l'outil qui compare une capture à sa cible (`test/couleurs.ts`) mesure ce qu'il dit, sur des images connues.
const image = (l: number, h: number, couleur: (x: number, y: number) => [number, number, number]): Uint8ClampedArray => {
  const d = new Uint8ClampedArray(l * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const [r, g, b] = couleur(x, y);
      d.set([r, g, b, 255], (y * l + x) * 4);
    }
  }
  return d;
};
const tout = [[0, 0], [40, 0], [40, 40], [0, 40]] as const;

describe("la mesure des couleurs (lot PBV3)", () => {
  it("un gris uni : luminance, aucune saturation, aucun contraste", () => {
    const c = mesurerCouleurs(image(40, 40, () => [128, 128, 128]), 40, 40, tout, 1);
    expect(c.luminance).toBeCloseTo(50.2, 1);
    expect(c.saturation).toBe(0);
    expect(c.contraste).toBeCloseTo(0, 5);
  });

  it("moitié noire, moitié blanche : luminance 50, contraste 50", () => {
    const c = mesurerCouleurs(image(40, 40, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255])), 40, 40, tout, 1);
    expect(c.luminance).toBeCloseTo(50, 0);
    expect(c.contraste).toBeCloseTo(50, 0);
  });

  it("la teinte d'un orangé et d'un turquoise", () => {
    expect(mesurerCouleurs(image(40, 40, () => [255, 128, 0]), 40, 40, tout).teinte).toBeCloseTo(30, 0);
    expect(mesurerCouleurs(image(40, 40, () => [0, 200, 210]), 40, 40, tout).teinte).toBeCloseTo(183, 0);
    expect(mesurerCouleurs(image(40, 40, () => [255, 0, 0]), 40, 40, tout).saturation).toBeCloseTo(100, 5);
  });

  it("seuls les pixels du quadrilatère comptent", () => {
    const q = [[0, 0], [20, 0], [20, 40], [0, 40]] as const;
    expect(dansQuad(q, 10, 10)).toBe(true);
    expect(dansQuad(q, 30, 10)).toBe(false);
    const c = mesurerCouleurs(image(40, 40, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255])), 40, 40, q, 1);
    expect(c.luminance).toBeLessThan(1);
  });
});
