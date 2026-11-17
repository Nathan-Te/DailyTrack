import { describe, expect, it } from "vitest";
import { GROSSISSEMENT_ETIQUETTE, largeurPlaque, largeurTexte, styleEtiquette } from "../src/dessin";

// Les plaques (lots PBV2, PBL1) : l'estimation de leur largeur et leur style. **La mise en place des plaques — lesquelles, où, collées à leur élément, jamais sur un rail — est gardée par `test/lisibilite.test.ts`** (lot PBL1 : plus
// que l'élément de la mission, le verrou et la porte ; l'ancien test de non-chevauchement des neuf plaques de chaque table n'a plus d'objet).
const THEMES = ["foire", "ocean", "espace", "volcan"] as const;

describe("les plaques : largeur et style", () => {
  

  it("chaque thème a son style de plaque : encre, bois, métal riveté, pierre gravée", () => {
    expect(THEMES.map(styleEtiquette)).toEqual(["encre", "bois", "metal", "pierre"]);
    for (const t of THEMES) expect(largeurPlaque("ABC", styleEtiquette(t))).toBeGreaterThan(largeurTexte("ABC"));
  });

  it("le grossissement des plaques est celui du curseur par défaut (140 %) avec la perspective", () => {
    expect(GROSSISSEMENT_ETIQUETTE).toBeGreaterThanOrEqual(1.4);
    expect(GROSSISSEMENT_ETIQUETTE).toBeLessThanOrEqual(1.5);
  });
});
