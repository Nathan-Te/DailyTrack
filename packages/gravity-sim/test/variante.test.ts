import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRAVITY_BOT_VERSION, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, VARIANTE, grouper, scoreParColonnes } from "../src/index";

// `variante.ts` dit comment le jeu se classe ; la fiche (`config/jeux/gravity.json`) le dit aussi : ils doivent s'accorder.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/gravity.json", import.meta.url), "utf8")) as {
  classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string; cumul: boolean };
  categorie: string;
  medailles: { methode: string };
  themes: string[];
  rejeu: { maxTicks: number };
  versions: { sim: string; generateur: string; medailles?: string };
};

describe("l'accord de la variante et de la fiche", () => {
  it("le classement : le score du plus grand au plus petit, puis le plus rapide ; arcade, hors du cumul", () => {
    const colonnes = fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id");
    expect(colonnes).toEqual(VARIANTE.fiche.colonnes);
    expect(colonnes).toEqual([{ nom: "score", sens: "desc" }, { nom: "ticks", sens: "asc" }]);
    expect({ unite: fiche.classement.unite, format: fiche.classement.format }).toEqual({ unite: VARIANTE.fiche.unite, format: VARIANTE.fiche.format });
    expect(fiche.categorie).toBe("arcade");
    expect(fiche.classement.cumul).toBe(false);
  });
  it("les médailles sont figées avec le niveau ; les versions nomment des constantes qui existent", () => {
    expect(fiche.medailles.methode).toBe("figees-niveau");
    expect(fiche.versions.medailles).toContain("GRAVITY_BOT_VERSION");
    expect([GRAVITY_SIM_VERSION, GRAVITY_GENERATOR_VERSION, GRAVITY_BOT_VERSION].every(Number.isInteger)).toBe(true);
  });
  it("le rejeu d'une partie de dix minutes est dans la limite de la fiche", () => {
    expect(fiche.rejeu.maxTicks).toBe(72000);
  });
  it("le score classé : le score, puis la durée en pas", () => {
    expect(VARIANTE.score({ score: 4582, ticks: 3600 })).toEqual([4582, 3600]);
    expect(scoreParColonnes({ score: 4582, ticks: 3600 })).toEqual({ score: 4582, ticks: 3600 });
  });
  it("les nombres se groupent par trois chiffres, sans toLocaleString", () => {
    expect(grouper(4582, "fr")).toBe("4 582");
    expect(grouper(4582, "en")).toBe("4,582");
    expect(grouper(12, "fr")).toBe("12");
    expect(grouper(1234567, "en")).toBe("1,234,567");
  });
});
