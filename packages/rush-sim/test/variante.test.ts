import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VARIANTE } from "../src/index";

// La variante de Rush est unique (le temps) ; ce test garde son accord avec la fiche `config/jeux/rush.json`.
describe("la variante de ce jeu et sa fiche", () => {
  const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/rush.json", import.meta.url), "utf8")) as {
    classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string; cumul: boolean };
    medailles: { methode: string; bareme: number[]; plafondDiamant?: number };
  };
  it("colonnes, unité, format et barème sont ceux de config/jeux/rush.json", () => {
    expect(fiche.classement.colonnes.slice(0, VARIANTE.fiche.colonnes.length)).toEqual(VARIANTE.fiche.colonnes);
    expect(fiche.classement.colonnes.slice(VARIANTE.fiche.colonnes.length).map((k) => k.nom)).toEqual(["submitted_at", "player_id"]);
    expect({ unite: fiche.classement.unite, format: fiche.classement.format }).toEqual({ unite: VARIANTE.fiche.unite, format: VARIANTE.fiche.format });
    expect(fiche.medailles.bareme).toEqual([...VARIANTE.fiche.bareme]);
  });
});
