import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreParColonnes, VARIANTE } from "../src/index";

// La variante `score` dit ce que dit la fiche (config/jeux/blocks.json) : score ↓, combo maximal ↓, puis les départages de la plateforme.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as { classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string } };

describe("la variante de Blocks", () => {
  it("les colonnes, l'unité et le format sont ceux de la fiche ; les départages ultimes suivent", () => {
    expect(fiche.classement.colonnes).toEqual([...VARIANTE.fiche.colonnes, { nom: "submitted_at", sens: "asc" }, { nom: "player_id", sens: "asc" }]);
    expect(fiche.classement.unite).toBe(VARIANTE.fiche.unite);
    expect(fiche.classement.format).toBe(VARIANTE.fiche.format);
  });
  it("le score d'un résultat : le score puis le combo maximal", () => {
    expect(VARIANTE.score({ score: 4582, combo: 7 })).toEqual([4582, 7]);
    expect(scoreParColonnes({ score: 4582, combo: 7 })).toEqual({ score: 4582, combo: 7 });
  });
});
