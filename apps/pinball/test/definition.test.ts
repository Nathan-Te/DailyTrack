import { describe, expect, it } from "vitest";
import { DEFINITION } from "../src/definition";

// Lot PB4 — **pas de fantôme Diamant en partie** : une bille fantôme sur la table serait illisible. Le robot donne les seuils des médailles et se regarde avec `?robot`, jamais autre chose.
describe("la définition de Pinball", () => {
  it("n'a pas de fantôme : `sansFantome`, et la rediffusion du Diamant est vide", () => {
    expect(DEFINITION.sansFantome).toBe(true);
    expect(DEFINITION.rediffusionDiamant({} as never)).toBe("");
  });
  it("une partie où l'on regarde le robot (`?robot`) n'est pas classable, ni une partie d'essai", () => {
    expect(DEFINITION.classable?.("?robot")).toBe(false);
    expect(DEFINITION.classable?.("?jour=2026-11-09&robot=2")).toBe(false);
    expect(DEFINITION.classable?.("?essai=mission")).toBe(false);
    expect(DEFINITION.classable?.("")).toBe(true);
  });
});
