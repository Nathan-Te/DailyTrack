import { describe, it } from "vitest";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { ECRANS_MANETTE } from "../src/manette";

// Lot M1 : chaque écran de Jump déclare son action principale (`src/manette.ts`) et ce qu'il nomme existe encore.
describe("les menus de Jump à la manette", () => {
  it("chaque écran déclare son action principale, et les éléments nommés existent", () => {
    verifierEcrans(ECRANS_MANETTE, ["apps/jump/src", "apps/jump/index.html"]);
  });
});
