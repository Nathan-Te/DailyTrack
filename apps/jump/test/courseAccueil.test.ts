import { describe, expect, it } from "vitest";
import { nomDeLaCourse } from "../src/homeLogic";

// Lot 31 (retouche) : « Voir la course du n° 1 » sur l'accueil, à côté de « Tout le classement » — présent avec au moins un classé, absent sans.
describe("nomDeLaCourse (accueil et classement)", () => {
  it("avec un premier lu et au moins un classé : son pseudo (le bouton est présent)", () => {
    expect(nomDeLaCourse("Léa", 3)).toBe("Léa");
    expect(nomDeLaCourse("Léa", 1)).toBe("Léa");
  });
  it("sans classé (ou sans classement lu : aucune ligne), sans premier ou pendant un carnage : null (le bouton est absent)", () => {
    expect(nomDeLaCourse("Léa", 0)).toBeNull();
    expect(nomDeLaCourse(null, 3)).toBeNull();
    expect(nomDeLaCourse("Léa", 3, true)).toBeNull();
  });
});
