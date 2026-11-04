import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRACTIONS_MEDAILLES, scoreParColonnes, THEMES_BLOCKS, VARIANTE } from "../src/index";

// La variante `score` dit ce que dit la fiche (config/jeux/blocks.json) : score ↓, combo maximal ↓, puis les départages de la plateforme.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as { classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string }; medailles: { methode: string; bareme: number[]; plafondDiamant?: number }; themes: string[]; versions: Record<string, string>; musique: { scenes: string[] } };

describe("la variante de Blocks", () => {
  it("les colonnes, l'unité et le format sont ceux de la fiche ; les départages ultimes suivent", () => {
    expect(fiche.classement.colonnes).toEqual([...VARIANTE.fiche.colonnes, { nom: "submitted_at", sens: "asc" }, { nom: "player_id", sens: "asc" }]);
    expect(fiche.classement.unite).toBe(VARIANTE.fiche.unite);
    expect(fiche.classement.format).toBe(VARIANTE.fiche.format);
  });
  it("les médailles : le Diamant (bot) et les fractions entières d'or, d'argent et de bronze sont celles de la fiche (`pourcentage-diamant`)", () => {
    expect(fiche.medailles.methode).toBe("pourcentage-diamant");
    expect(fiche.medailles.bareme).toEqual([FRACTIONS_MEDAILLES.gold, FRACTIONS_MEDAILLES.silver, FRACTIONS_MEDAILLES.bronze]);
    expect(fiche.medailles.bareme).toEqual([...VARIANTE.fiche.bareme]);
    expect(fiche.medailles.plafondDiamant).toBeUndefined(); // aucun plafond : le Diamant est le score du bot, sans borne
    expect(fiche.versions.medailles).toBe("packages/blocks-sim/src/constantes.ts:BLOCKS_BOT_VERSION");
  });
  it("les six thèmes de la fiche sont ceux de la simulation, avec leur scène de musique", () => {
    expect(fiche.themes).toEqual([...THEMES_BLOCKS]);
    expect(fiche.musique.scenes).toEqual(["menu", ...THEMES_BLOCKS.map((t) => `theme:${t}`)]);
  });
  it("le score d'un résultat : le score puis le combo maximal", () => {
    expect(VARIANTE.score({ score: 4582, combo: 7 })).toEqual([4582, 7]);
    expect(scoreParColonnes({ score: 4582, combo: 7 })).toEqual({ score: 4582, combo: 7 });
  });
});
