import { describe, expect, it } from "vitest";
import { estHauteur } from "../src/jour";
import { formatDeVue } from "../src/jeuxFiches";

// Lot K4d — le portail sait afficher un score en `points` (en plus du temps et de la hauteur en mm) : l'unité vient du serveur, le format de la fiche du jeu. Un jeu qui n'est pas dans les fiches publiées
// (un jeu neuf avant sa fiche) retombe sur la hauteur, comme avant ; Track, Jump et Tower ne changent pas d'un caractère.

describe("score en points au portail", () => {
  it("un jeu classé à un score (mm ou points) est un jeu « à la hauteur » : il n'entre jamais dans le cumul au temps", () => {
    expect(estHauteur({ unite: "mm" })).toBe(true);
    expect(estHauteur({ unite: "points" })).toBe(true);
    expect(estHauteur({})).toBe(false);
  });
  it("le format d'un score est celui de la fiche du jeu ; au temps, toujours le temps", () => {
    expect(formatDeVue("track", "temps")).toBe("temps");
    expect(formatDeVue("jump", "temps")).toBe("temps");
    expect(formatDeVue("tower", "hauteur")).toBe("hauteur");
    expect(formatDeVue("jeu-inconnu", "hauteur")).toBe("hauteur");
  });
});
