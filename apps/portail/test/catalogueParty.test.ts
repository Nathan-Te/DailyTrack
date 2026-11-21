import { describe, expect, it } from "vitest";
import { CATALOGUE_PARTY } from "../src/catalogueParty";

// Lot PA1b — les textes de la section « Party » de l'accueil (fichier à part, voir `catalogueParty.ts`) : mêmes clés en français et en anglais, aucun texte vide.
describe("catalogue de la section Party", () => {
  it("le français et l'anglais ont les mêmes clés, toutes écrites", () => {
    expect(Object.keys(CATALOGUE_PARTY.en).sort()).toEqual(Object.keys(CATALOGUE_PARTY.fr).sort());
    for (const l of ["fr", "en"] as const) for (const [k, v] of Object.entries(CATALOGUE_PARTY[l])) expect(v, `${l} ${k}`).not.toBe("");
  });
});
