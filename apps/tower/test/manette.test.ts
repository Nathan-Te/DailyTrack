import { describe, it } from "vitest";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { ECRANS_MANETTE } from "../src/manetteEcrans";

// Lot M1 : chaque écran de Tower déclare son action principale (`src/manette.ts`) et ce qu'il nomme existe encore.
describe("les menus de Tower à la manette", () => {
  it("chaque écran déclare son action principale, et les éléments nommés existent", () => {
    verifierEcrans(ECRANS_MANETTE, ["apps/tower/src", "apps/tower/index.html"]);
  });
});
