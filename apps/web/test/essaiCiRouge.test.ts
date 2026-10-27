import { describe, expect, it } from "vitest";

// Lot R12 — branche `essai/ci-rouge` SEULEMENT (jamais de PR, jamais fusionnée) : un seul test volontairement rouge, pour le scénario 2 de Nathan.
// « Mettre en production » en mode `essai` sur cette branche doit s'arrêter AVANT toute répétition ou sauvegarde, avec la phrase
// « Lance le lot de mise en production avec ce run : <lien> » (docs/plateforme/lots/lot-R12-un-seul-bouton.md, § 8).
describe("essai : une CI complète rouge", () => {
  it("ce test échoue exprès (branche essai/ci-rouge)", () => {
    expect("rouge").toBe("vert");
  });
});
