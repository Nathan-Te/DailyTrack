import { describe, expect, it } from "vitest";
import { PIERRE, PIERRE_CLAIRE, PIERRE_POING, PIERRE_SOMBRE, PIERRE_TETE } from "../src/acteurs";
import { COULEURS, PALETTES } from "../src/palette";

// La LISIBILITÉ sur chaque thème (lot BR1) : le golem, les ennemis, le chevalier et les cercles d'annonce se détachent du sol de CHAQUE thème. Sans navigateur : l'écart de couleur CIELAB (ΔE76, un écart de 2,3 se voit à peine,
// au-delà de 25 la couleur est franchement autre) entre chaque ton de sol et la couleur de base de chaque personnage. Le cercle d'annonce est le corail mélangé à 55 % sur le sol (il est translucide).
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
export function lab(hex: number): [number, number, number] {
  const r = lin((hex >> 16) & 255);
  const g = lin((hex >> 8) & 255);
  const b = lin(hex & 255);
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const ecart = (a: number, b: number): number => {
  const x = lab(a);
  const y = lab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const melange = (a: number, b: number, t: number): number => {
  const c = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const plusPetit = (couleur: number, p: (typeof PALETTES)[string]): number => Math.min(ecart(couleur, p.sol), ecart(couleur, p.sol2));

describe("la lisibilité sur chaque thème (lot BR1)", () => {
  it("il y a trois thèmes", () => {
    expect(Object.keys(PALETTES).sort()).toEqual(["carriere", "prairie", "sous-bois"]);
  });
  for (const [nom, p] of Object.entries(PALETTES)) {
    describe(nom, () => {
      it("le golem (ses pierres principales) se détache nettement du sol : écart ≥ 40", () => {
        for (const [pierre, c] of Object.entries({ PIERRE, PIERRE_SOMBRE, PIERRE_POING, PIERRE_CLAIRE, PIERRE_TETE })) expect(plusPetit(c.couleur, p), `${pierre} sur ${nom}`).toBeGreaterThanOrEqual(40);
      });
      it("la gelée et la chauve-souris se détachent du sol : écart ≥ 25", () => {
        expect(plusPetit(COULEURS.gelee, p), "gelée").toBeGreaterThanOrEqual(25);
        expect(plusPetit(COULEURS.chauve, p), "chauve-souris").toBeGreaterThanOrEqual(25);
      });
      it("l'armure du chevalier se détache du sol : écart ≥ 25", () => {
        expect(plusPetit(COULEURS.armure, p)).toBeGreaterThanOrEqual(25);
      });
      it("le cercle d'annonce (corail à 55 % sur le sol) se détache du sol : écart ≥ 25", () => {
        for (const sol of [p.sol, p.sol2]) expect(ecart(melange(sol, COULEURS.corail, 0.55), sol)).toBeGreaterThanOrEqual(25);
      });
      it("les murs bas se distinguent du sol (on ne les prend pas pour du chemin)", () => {
        expect(plusPetit(p.mur, p)).toBeGreaterThanOrEqual(25);
      });
    });
  }
});
