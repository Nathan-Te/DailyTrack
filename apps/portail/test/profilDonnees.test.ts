import { describe, expect, it } from "vitest";
import { medaillesTotales, rangerLesJeux } from "../src/profilDonnees";

// Lot U3 : la page « Profil » — les médailles de tous les jeux et le rangement des jeux (jour, puis arcade).
describe("lot U3 : les médailles de tous les jeux", () => {
  it("la somme, type par type ; une clé absente vaut zéro", () => {
    expect(medaillesTotales([{ medailles: { author: 1, gold: 4, silver: 4, bronze: 2 } }, { medailles: { gold: 2, silver: 4 } }, { medailles: {} }])).toEqual({ author: 1, gold: 6, silver: 8, bronze: 2 });
  });
  it("sans jeu : quatre zéros ; jamais de valeur négative ni fractionnaire", () => {
    expect(medaillesTotales([])).toEqual({ author: 0, gold: 0, silver: 0, bronze: 0 });
    expect(medaillesTotales([{ medailles: { gold: -3, silver: 2.7 } }])).toEqual({ author: 0, gold: 0, silver: 2, bronze: 0 });
  });
});

describe("lot U3 : les jeux du profil", () => {
  it("les jeux du jour d'abord, l'arcade ensuite, chacun dans l'ordre du serveur", () => {
    const jeux = [{ jeu: "cdj" }, { jeu: "tower" }, { jeu: "jump" }, { jeu: "blocks" }];
    const r = rangerLesJeux(jeux, (j) => (j.jeu === "tower" || j.jeu === "blocks" ? "arcade" : "jour"));
    expect(r.jour.map((j) => j.jeu)).toEqual(["cdj", "jump"]);
    expect(r.arcade.map((j) => j.jeu)).toEqual(["tower", "blocks"]);
  });
});
