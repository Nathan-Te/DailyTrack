import { describe, expect, it } from "vitest";
import { cleNomFantome, etatInitial, etatValide, suivant } from "../src/fantomeEtat";

// Lot T4 — le bouton fantôme a trois états : Aucun → Ma meilleure → Diamant → Aucun… ; le Diamant n'est offert qu'une fois classé.
const tout = { meilleure: true, diamant: true };

describe("la séquence du fantôme", () => {
  it("avec tout de disponible : Aucun, Ma meilleure, Diamant, puis Aucun", () => {
    expect(suivant("aucun", tout)).toBe("meilleure");
    expect(suivant("meilleure", tout)).toBe("diamant");
    expect(suivant("diamant", tout)).toBe("aucun");
  });

  it("le Diamant n'est pas offert tant qu'on n'est pas classé : Ma meilleure ↔ Aucun", () => {
    const sansDiamant = { meilleure: true, diamant: false };
    expect(suivant("aucun", sansDiamant)).toBe("meilleure");
    expect(suivant("meilleure", sansDiamant)).toBe("aucun");
  });

  it("sans « Ma meilleure » (première partie du jour) mais classé : Aucun ↔ Diamant", () => {
    const seulDiamant = { meilleure: false, diamant: true };
    expect(suivant("aucun", seulDiamant)).toBe("diamant");
    expect(suivant("diamant", seulDiamant)).toBe("aucun");
  });

  it("rien de disponible : le fantôme reste Aucun", () => {
    expect(suivant("aucun", { meilleure: false, diamant: false })).toBe("aucun");
    expect(suivant("diamant", { meilleure: false, diamant: false })).toBe("aucun");
  });

  it("l'état de départ : Ma meilleure si elle existe, sinon Aucun (jamais le Diamant sans qu'on le choisisse)", () => {
    expect(etatInitial(tout)).toBe("meilleure");
    expect(etatInitial({ meilleure: false, diamant: true })).toBe("aucun");
  });

  it("un état qui n'est plus disponible retombe sur Aucun", () => {
    expect(etatValide("diamant", { meilleure: true, diamant: false })).toBe("aucun");
    expect(etatValide("meilleure", { meilleure: false, diamant: false })).toBe("aucun");
    expect(etatValide("meilleure", tout)).toBe("meilleure");
    expect(etatValide("aucun", { meilleure: false, diamant: false })).toBe("aucun");
  });

  it("le nom lu : « Fantôme : {nom} », le nom vient du catalogue", () => {
    expect(["aucun", "meilleure", "diamant"].map((e) => cleNomFantome(e as never))).toEqual(["fantome.aucun", "fantome.meilleure", "fantome.diamant"]);
  });
});

describe("le fantôme au départ (Réglages › Affichage, lot T7)", () => {
  it("« Ma meilleure » par défaut si elle existe ; « Aucun » si le joueur ne la veut pas au départ ; jamais une meilleure qui n'existe pas", () => {
    expect(etatInitial({ meilleure: true, diamant: true })).toBe("meilleure");
    expect(etatInitial({ meilleure: true, diamant: true }, "meilleure")).toBe("meilleure");
    expect(etatInitial({ meilleure: true, diamant: true }, "aucun")).toBe("aucun");
    expect(etatInitial({ meilleure: false, diamant: true }, "meilleure")).toBe("aucun");
  });
});

