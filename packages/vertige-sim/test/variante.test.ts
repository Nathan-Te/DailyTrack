import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUREE_MAX_TICKS, VARIANTE, ecrireTemps, scoreParColonnes } from "../src/index";

// La variante dit comment le jeu se classe : elle doit dire la même chose que sa fiche.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/vertige.json", import.meta.url), "utf8")) as { classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string } };

describe("variante de Vertige", () => {
  it("dit la même chose que la fiche (colonnes, unité, format)", () => {
    const reelles = fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id");
    expect(VARIANTE.fiche.colonnes).toEqual(reelles);
    expect(fiche.classement.unite).toBe(VARIANTE.fiche.unite);
    expect(fiche.classement.format).toBe(VARIANTE.fiche.format);
  });
  it("classe le temps de l'arrivée, ou le pire temps", () => {
    expect(scoreParColonnes({ arrive: true, ticks: 741 })).toEqual({ temps: 741 });
    expect(scoreParColonnes({ arrive: false, ticks: 0 })).toEqual({ temps: DUREE_MAX_TICKS });
  });
  it("écrit les temps (120 pas par seconde)", () => {
    expect(ecrireTemps(741, "fr")).toBe("6,175 s");
    expect(ecrireTemps(741, "en")).toBe("6.175 s");
    expect(ecrireTemps(12000, "fr")).toBe("1:40,000");
    expect(VARIANTE.formatScore([DUREE_MAX_TICKS], "fr")).toBe("2:00,000");
  });
});
