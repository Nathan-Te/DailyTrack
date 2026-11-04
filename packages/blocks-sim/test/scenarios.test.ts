import { describe, expect, it } from "vitest";
import { estScenario, jouer, Partie, SCENARIOS, contenuDeScenario, estClassable } from "../src/index";

describe("les scénarios d'essai", () => {
  it("trois scénarios, jamais classables, une suite complète", () => {
    expect([...SCENARIOS]).toEqual(["presque-plein", "blocage", "plateau-vide"]);
    for (const nom of SCENARIOS) {
      const c = contenuDeScenario(nom);
      expect(c.scenario).toBe(nom);
      expect(estClassable(c)).toBe(false);
      expect(c.suite).toHaveLength(2000);
      expect(estScenario(nom)).toBe(true);
    }
    expect(estScenario("autre")).toBe(false);
  });
  it("presque-plein : une pose, 2 lignes et 1 colonne ; blocage : fin immédiate ; plateau-vide : la grille se vide", () => {
    const a = new Partie(contenuDeScenario("presque-plein"));
    expect(a.poser(5, 6)).toMatchObject({ n: 3 });
    expect(new Partie(contenuDeScenario("blocage")).finie).toBe(true);
    const c = new Partie(contenuDeScenario("plateau-vide"));
    expect(c.poser(7, 6)).toMatchObject({ plateauVide: true });
  });
  it("le blocage se rejoue sans aucune pose", () => {
    expect(jouer(contenuDeScenario("blocage"), []).raison).toBe("bloquee");
  });
});
