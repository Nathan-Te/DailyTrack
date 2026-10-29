import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION, daysFromCivil, parseTrack } from "@cdj/sim";
import { blocsDuMotif, carteDuJour, planDuCircuit } from "../src/galerie/galerieLogique";

// Lot V2 : la logique de la galerie des circuits à venir (`?debug&galerie=30`). La page elle-même n'a pas de test de navigateur (outil interne, règle R13).
describe("galerie des circuits (logique)", () => {
  it("repère les blocs du motif « boost → longue ligne droite → virage serré », de la poussée au virage", () => {
    expect([...blocsDuMotif("S@start P S S S L S S@finish".split(" "))]).toEqual([1, 2, 3, 4, 5]);
    expect(blocsDuMotif("S@start P S S L2 S S@finish".split(" ")).size).toBe(0);
  });

  it("le plan d'un circuit couvre exactement ses cellules, chacune avec l'élément de son bloc", () => {
    const spec = "S@start S P S S S L S R2 S U D K GD S S S@finish";
    const track = parseTrack("essai", spec);
    const plan = planDuCircuit(track, spec);
    expect(plan.length).toBe(track.cells.size);
    expect(plan[0]!.element).toBe("depart");
    expect(plan.filter((c) => c.element === "serré")).toHaveLength(1);
    expect(plan.filter((c) => c.element === "large").length).toBeGreaterThan(1); // un virage large occupe plusieurs cellules
    expect(plan.filter((c) => c.motif)).toHaveLength(5);
  });

  it("la carte d'un jour : biome, rythme de la dernière version (aucun avant), temps, motifs et suites partagées avec la veille", { timeout: 60_000 }, () => {
    const day = daysFromCivil(2028, 3, 1);
    const veille = carteDuJour(day - 1, GENERATOR_VERSION);
    const c = carteDuJour(day, GENERATOR_VERSION, veille);
    expect(c.date).toBe("2028-03-01");
    expect(c.rythme).not.toBeNull();
    expect(c.pilotMs).toBeGreaterThan(c.auteurMs);
    expect(c.plan.length).toBeGreaterThan(30);
    expect(c.communsVeille.every((s) => veille.suites.has(s))).toBe(true);
    expect(carteDuJour(day, GENERATOR_VERSION - 1).rythme).toBeNull();
  });
});
