import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLONNES_CLASSEMENT, maxPas, scoreDe, scoreParColonnes } from "../src/index";

// Le classement de « Pile poil » et sa fiche disent la même chose : le score (↓), les « pile » (↓), puis les deux départages ultimes.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/pilepoil.json", import.meta.url), "utf8")) as { classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string }; rejeu: { maxTicks: number } };

describe("le classement de Pile poil", () => {
  it("les colonnes sont celles de config/jeux/pilepoil.json", () => {
    expect(fiche.classement.colonnes).toEqual([...COLONNES_CLASSEMENT, { nom: "submitted_at", sens: "asc" }, { nom: "player_id", sens: "asc" }]);
    expect({ unite: fiche.classement.unite, format: fiche.classement.format }).toEqual({ unite: "points", format: "entier" });
  });
  it("la plus longue partie (chaque jauge attendue jusqu'au bout) est le `rejeu.maxTicks` de la fiche", () => {
    expect(fiche.rejeu.maxTicks).toBe(maxPas());
  });
  it("le score d'un résultat, dans l'ordre et par nom de colonne", () => {
    expect(scoreDe({ score: 1167, piles: 5 })).toEqual([1167, 5]);
    expect(scoreParColonnes({ score: 1167, piles: 5 })).toEqual({ score: 1167, piles: 5 });
  });
});
