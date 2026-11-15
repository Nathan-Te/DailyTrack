import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUREE_MAX_TICKS, MAX_EVENEMENTS, PINBALL_BOT_VERSION, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, THEMES_PINBALL, TICKS_PAR_SECONDE, VARIANTE, dureeEnTexte, grouper, scoreParColonnes } from "../src/index";

// `variante.ts` dit comment le jeu se classe ; la fiche (`config/jeux/pinball.json`) le dit aussi : ils doivent s'accorder.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/pinball.json", import.meta.url), "utf8")) as {
  classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string; cumul: boolean };
  categorie: string;
  medailles: { methode: string };
  themes: string[];
  nomsThemes: { fr: Record<string, string>; en: Record<string, string> };
  rejeu: { maxTicks: number; ticksParUnite?: number };
  versions: { sim: string; generateur: string; medailles?: string };
  musique: { scenes: string[] };
};

describe("l'accord de la variante et de la fiche", () => {
  it("le classement : le score du plus grand au plus petit, puis le plus rapide ; arcade, hors du cumul", () => {
    const colonnes = fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id");
    expect(colonnes).toEqual(VARIANTE.fiche.colonnes);
    expect(colonnes).toEqual([{ nom: "score", sens: "desc" }, { nom: "ticks", sens: "asc" }]);
    expect(fiche.classement.colonnes.map((c) => c.nom).slice(-2)).toEqual(["submitted_at", "player_id"]);
    expect({ unite: fiche.classement.unite, format: fiche.classement.format }).toEqual({ unite: VARIANTE.fiche.unite, format: VARIANTE.fiche.format });
    expect(fiche.categorie).toBe("arcade");
    expect(fiche.classement.cumul).toBe(false);
  });
  it("les médailles sont figées avec la table ; les versions nomment des constantes qui existent", () => {
    expect(fiche.medailles.methode).toBe("figees-niveau");
    expect(fiche.versions.medailles).toContain("PINBALL_BOT_VERSION");
    expect([PINBALL_SIM_VERSION, PINBALL_GENERATOR_VERSION, PINBALL_BOT_VERSION].every(Number.isInteger)).toBe(true);
  });
  it("les quatre thèmes, leurs noms français et anglais, leurs scènes de musique", () => {
    expect(fiche.themes).toEqual([...THEMES_PINBALL]);
    expect(fiche.nomsThemes.fr).toEqual({ foire: "Fête foraine", ocean: "Océan", espace: "Espace", volcan: "Volcan" });
    expect(fiche.nomsThemes.en).toEqual({ foire: "Funfair", ocean: "Ocean", espace: "Space", volcan: "Volcano" });
    expect(fiche.musique.scenes).toEqual(["menu", ...THEMES_PINBALL.map((t) => `theme:${t}`)]);
  });
  it("le rejeu de la fiche borne la partie : la durée maximale, et un coût qui suit la durée", () => {
    expect(fiche.rejeu.maxTicks).toBe(DUREE_MAX_TICKS);
    expect(fiche.rejeu.ticksParUnite).toBeGreaterThan(0);
    expect(DUREE_MAX_TICKS / TICKS_PAR_SECONDE).toBe(900);
    expect(MAX_EVENEMENTS).toBeGreaterThan(DUREE_MAX_TICKS / TICKS_PAR_SECONDE); // plus d'un événement par seconde
  });
  it("le score classé : le score, puis la durée en pas (jamais au-delà de la durée maximale)", () => {
    expect(VARIANTE.score({ score: 4582, ticks: 3600 })).toEqual([4582, 3600]);
    expect(VARIANTE.score({ score: 1, ticks: DUREE_MAX_TICKS + 40 })).toEqual([1, DUREE_MAX_TICKS]);
    expect(scoreParColonnes({ score: 4582, ticks: 3600 })).toEqual({ score: 4582, ticks: 3600 });
  });
  it("les nombres se groupent par trois chiffres, sans toLocaleString ; les durées en m:ss", () => {
    expect(grouper(4582, "fr")).toBe("4 582");
    expect(grouper(4582, "en")).toBe("4,582");
    expect(grouper(12, "fr")).toBe("12");
    expect(grouper(1234567, "en")).toBe("1,234,567");
    expect(dureeEnTexte(600 * (5 * 60 + 7))).toBe("5:07");
  });
});
