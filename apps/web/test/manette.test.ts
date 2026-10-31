import { describe, it } from "vitest";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { ECRANS_MANETTE } from "../src/manette";

// Lot M1 : chaque écran de Track déclare son action principale (`src/manette.ts`) et ce qu'il nomme existe encore.
describe("les menus de Track à la manette", () => {
  it("chaque écran déclare son action principale, et les éléments nommés existent", () => {
    verifierEcrans(ECRANS_MANETTE, ["apps/web/src", "apps/web/index.html"]);
  });
});
