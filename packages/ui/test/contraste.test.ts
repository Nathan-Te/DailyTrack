import { describe, expect, it } from "vitest";
import { PAIRES, SEUILS, rapportContraste, verifierPaire } from "../src/contraste";

// Lot I1 (charte § 10) : chaque paire texte / fond déclarée passe son seuil — 4,5:1 pour tout texte, 3:1 pour le texte de 24 px et plus.
describe("contrastes des paires de couleurs de la charte", () => {
  it("le calcul suit WCAG (noir sur blanc 21:1, une couleur sur elle-même 1:1, valeurs de la charte)", () => {
    expect(rapportContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(rapportContraste("#EDE3CF", "#EDE3CF")).toBeCloseTo(1, 5);
    // La charte annonce 5,3:1 (encre douce sur crème) et 4,8:1 (texte sur terre cuite).
    expect(rapportContraste("#6B5847", "#EDE3CF")).toBeCloseTo(5.3, 1);
    expect(rapportContraste("#FFF4E0", "#C2401F")).toBeGreaterThan(4.7);
    expect(() => rapportContraste("rouge", "#000000")).toThrow();
  });

  it("chaque paire déclarée passe son seuil", () => {
    expect(PAIRES.length).toBeGreaterThan(25);
    const echecs = PAIRES.map((p) => ({ p, ...verifierPaire(p) })).filter((r) => !r.ok);
    expect(echecs.map((r) => `${r.p.couleur} sur ${r.p.fond} : ${r.rapport.toFixed(2)} < ${r.seuil}`)).toEqual([]);
    expect(SEUILS).toEqual({ normal: 4.5, grand: 3 });
  });

  it("aucune paire en double", () => {
    const cles = PAIRES.map((p) => `${p.couleur}/${p.fond}`);
    expect(new Set(cles).size).toBe(cles.length);
  });
});
