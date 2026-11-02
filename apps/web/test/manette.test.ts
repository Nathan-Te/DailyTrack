import { describe, expect, it } from "vitest";
import { ECRAN_MANETTE_FEUILLE } from "../../../packages/ui/src/amis";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { ECRANS_MANETTE } from "../src/manette";

// Lot M1 : chaque écran de Track déclare son action principale (`src/manette.ts`) et ce qu'il nomme existe encore.
describe("les menus de Track à la manette", () => {
  it("chaque écran déclare son action principale, et les éléments nommés existent", () => {
    // Lot F2 : la feuille d'un joueur vient de `@cdj/ui` (le fichier des composants des amis est lu en plus, ses classes y sont écrites).
    verifierEcrans(ECRANS_MANETTE, ["apps/web/src", "apps/web/index.html", "packages/ui/src/amis.ts"]);
  });

  it("lot F2 : la feuille d'un joueur est déclarée telle que le socle la donne (A valide, B ferme)", () => {
    const ligne = ECRANS_MANETTE.find((e) => e.ecran === ECRAN_MANETTE_FEUILLE.ecran);
    expect(ligne).toEqual(ECRAN_MANETTE_FEUILLE);
  });
});
