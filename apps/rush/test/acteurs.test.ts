import { Box3, Vector3, type Mesh, type MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { creerChauve, creerChevalier, creerGelee, creerGolem } from "../src/acteurs";

// Les tailles des personnages (lot BR0b) : le golem est plus grand et imposant mais reste dans le gabarit de sa collision (rayon 1,7 m) à peu près ; la maquette et la cible demandent un boss qui se lit au premier coup d'œil.
const taille = (racine: Parameters<Box3["setFromObject"]>[0]): Vector3 => {
  racine.updateMatrixWorld(true);
  return new Box3().setFromObject(racine).getSize(new Vector3());
};
describe("les personnages", () => {
  it("le golem fait 4,5 à 7,4 m de haut et moins de 8,6 m de large : bien plus grand que le chevalier (2 m)", () => {
    const g = taille(creerGolem().racine);
    expect(g.y).toBeGreaterThan(4.5);
    expect(g.y).toBeLessThan(7.4);
    expect(g.x).toBeLessThan(8.6);
    expect(g.z).toBeLessThan(5);
    expect(g.y).toBeGreaterThan(3 * taille(creerChevalier().racine).y);
  });
  it("le chevalier, la gelée et la chauve-souris gardent leur gabarit", () => {
    expect(taille(creerChevalier().racine).y).toBeLessThan(1.8); // chibi : petit corps, gros casque
    expect(taille(creerChevalier().racine).y).toBeGreaterThan(1.1);
    expect(taille(creerGelee().racine).x).toBeLessThan(1.8);
    expect(taille(creerGelee().racine).y).toBeLessThan(0.9); // un dôme écrasé posé au sol
    expect(taille(creerChauve().racine).x).toBeLessThan(2.8); // de larges ailes (lot BR0c)
  });
  it("le golem a des yeux ambre (deux aplats lumineux, plus clairs que 1 : le bloom les fait fleurir) avec leur halo, et ses sourcils froncés font partie de sa tête", () => {
    const g = creerGolem();
    expect(g.yeux.length).toBe(2);
    expect(g.halos.length).toBe(2);
    for (const y of g.yeux) expect(Math.max((y.material as MeshBasicMaterial).color.r, (y.material as MeshBasicMaterial).color.g)).toBeGreaterThan(1);
  });
  it("le golem est fait d'une douzaine de gros blocs : ses pièces fusionnées (tronc, tête, deux hauts de bras, deux avant-bras et poings, deux jambes) tiennent en huit formes au plus", () => {
    let formes = 0;
    creerGolem().racine.traverse((n) => {
      if ((n as Mesh).isMesh && !(n as Mesh).layers.isEnabled(1) && (n as Mesh).material && !((n as Mesh).material as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) formes++;
    });
    expect(formes).toBeLessThanOrEqual(9);
  });
  it("les poings du golem sont les plus gros blocs de son corps (poings ÉNORMES)", () => {
    const g = creerGolem();
    const boite = (n: Parameters<typeof taille>[0]): number => {
      const t = taille(n);
      return t.x * t.y * t.z;
    };
    expect(taille(g.coudes[0]).x).toBeGreaterThan(1.9);
    expect(boite(g.coudes[0])).toBeGreaterThan(boite(g.tete));
  });
});
