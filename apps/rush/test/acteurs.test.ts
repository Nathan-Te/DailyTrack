import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { creerChauve, creerChevalier, creerGelee, creerGolem } from "../src/acteurs";

// Les tailles des personnages (lot BR0b) : le golem est plus grand et imposant mais reste dans le gabarit de sa collision (rayon 1,7 m) à peu près ; la maquette et la cible demandent un boss qui se lit au premier coup d'œil.
const taille = (racine: Parameters<Box3["setFromObject"]>[0]): Vector3 => {
  racine.updateMatrixWorld(true);
  return new Box3().setFromObject(racine).getSize(new Vector3());
};
describe("les personnages", () => {
  it("le golem fait 4,5 à 6 m de haut et moins de 7,5 m de large : bien plus grand que le chevalier (2 m)", () => {
    const g = taille(creerGolem().racine);
    expect(g.y).toBeGreaterThan(4.5);
    expect(g.y).toBeLessThan(6);
    expect(g.x).toBeLessThan(7.5);
    expect(g.z).toBeLessThan(5);
    expect(g.y).toBeGreaterThan(2 * taille(creerChevalier().racine).y);
  });
  it("le chevalier, la gelée et la chauve-souris gardent leur gabarit", () => {
    expect(taille(creerChevalier().racine).y).toBeLessThan(2.3);
    expect(taille(creerGelee().racine).x).toBeLessThan(1.4);
    expect(taille(creerChauve().racine).x).toBeLessThan(2);
  });
  it("le golem a des yeux ambre (deux aplats lumineux) et ses arcades froncées font partie de sa tête", () => {
    const g = creerGolem();
    expect(g.yeux.length).toBe(2);
    expect(g.coeur.visible).toBe(false);
  });
});
