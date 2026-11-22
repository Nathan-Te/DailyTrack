import { describe, expect, it } from "vitest";
import { definitionDeParty, THEME_UNIQUE } from "../src/jeu/types";
import { meilleurScore, statutParty, texteParty } from "../src/jeu/party";

// Lot PA1b — ce qu'un jeu Party ajoute à l'accueil : la ligne d'état (fr et en), le record de l'appareil (le meilleur, tous jours confondus). Pur, sans DOM.

describe("la ligne d'état d'un jeu Party", () => {
  it("« Classé aujourd'hui » quand il est le jeu du jour", () => {
    expect(statutParty({ classe: true, prochain: null }, "fr")).toBe("Classé aujourd'hui");
    expect(statutParty({ classe: true, prochain: "2026-11-30" }, "en")).toBe("Ranked today");
  });
  it("« Jeu libre · classé le <date> » avec la prochaine date, « Jeu libre » seul sans elle", () => {
    const fr = statutParty({ classe: false, prochain: "2026-11-30" }, "fr");
    expect(fr).toMatch(/^Jeu libre · classé le 30 nov/);
    expect(statutParty({ classe: false, prochain: "2026-11-30" }, "en")).toMatch(/^Free play · ranked on (Nov 30|30 Nov)/);
    expect(statutParty({ classe: false, prochain: null }, "fr")).toBe("Jeu libre");
    expect(statutParty({ classe: false, prochain: "pas une date" }, "fr")).toBe("Jeu libre");
  });
  it("chaque texte existe en français et en anglais", () => {
    for (const cle of ["kit.party.classe", "kit.party.libre", "kit.party.record", "kit.party.finLibre"]) {
      expect(texteParty(cle, "fr"), cle).not.toBe("");
      expect(texteParty(cle, "en"), cle).not.toBe(texteParty(cle, "fr"));
    }
  });
});

describe("le record personnel d'un jeu Party (sur l'appareil, tous jours confondus)", () => {
  const garde = (jours: Record<string, number[]>) => JSON.stringify({ v: 1, jours: Object.fromEntries(Object.entries(jours).map(([d, s]) => [d, { s, m: null, r: "x", e: 1 }])) });
  it("le meilleur score de tous les jours gardés, dans le sens de la colonne", () => {
    expect(meilleurScore(garde({ "2026-11-01": [100], "2026-11-02": [340], "2026-11-03": [220] }), ["desc"])).toEqual([340]);
    expect(meilleurScore(garde({ "2026-11-01": [100], "2026-11-02": [340] }), ["asc"])).toEqual([100]);
  });
  it("la première colonne qui diffère décide", () => {
    expect(meilleurScore(garde({ a: [10, 5], b: [10, 3] }), ["desc", "asc"])).toEqual([10, 3]);
  });
  it("sans record, ou avec un enregistrement abîmé : rien", () => {
    expect(meilleurScore(null, ["desc"])).toBeNull();
    expect(meilleurScore("pas du JSON", ["desc"])).toBeNull();
    expect(meilleurScore(garde({ a: [1, 2] }), ["desc"])).toBeNull(); // le nombre de colonnes ne correspond pas
  });
});

describe("la définition complète d'un jeu Party (réexportée par types.ts)", () => {
  it("un thème, aucune médaille, aucun fantôme", () => {
    const complete = definitionDeParty({} as never);
    expect(complete.themeDuJour(1)).toBe(THEME_UNIQUE);
    expect(complete.medaille([1], complete.seuils(null as never))).toBeNull();
    expect(complete.sansMedaille).toBe(true);
    expect(complete.sansFantome).toBe(true);
  });
});
