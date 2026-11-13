import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { VARIANTE, VERTIGE_BOT_VERSION, VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, seuilsDuJour, seuilsValides } from "../src/index";
import { dailyVertige, figerJour, lireJourFige } from "../src/modulesIndex";

// Les jours figés (lot V3) : le fichier d'un jour porte la liste des modules, le temps du robot, les SEUILS des médailles et les versions ; il ne porte jamais de date calculée par le générateur (c'est la date qu'on lui demande de figer).
const JOUR = daysFromCivil(2026, 11, 20);

describe("le fichier d'un jour figé", () => {
  it("se relit, avec les seuils qu'on a servis ; le barème de la fiche s'applique quand on n'en donne pas", () => {
    const f = figerJour(JOUR);
    const c = dailyVertige(JOUR);
    expect(f).toMatchObject({ format: 2, jeu: "vertige", date: formatDay(JOUR), g: VERTIGE_GENERATOR_VERSION, sim: VERTIGE_SIM_VERSION, bot: VERTIGE_BOT_VERSION, contenu: { modules: c.modules, ticksRobot: c.ticksRobot } });
    expect(f.seuils).toEqual(VARIANTE.seuils(c.ticksRobot!));
    expect(seuilsValides(f.seuils)).toBe(true);
    const lu = lireJourFige(JSON.parse(JSON.stringify(f)))!;
    expect({ ...lu, seuilsFiges: undefined }).toEqual({ ...c, seuilsFiges: undefined });
    expect(lu.seuilsFiges).toEqual(f.seuils);
  });
  it("garde ses seuils même si ceux du barème changent : un jour figé ne bouge plus", () => {
    const autres = { author: 100, gold: 150, silver: 200, bronze: 300 };
    const lu = lireJourFige(figerJour(JOUR, VERTIGE_GENERATOR_VERSION, autres))!;
    expect(seuilsDuJour(lu)).toEqual(autres);
    expect(seuilsDuJour(dailyVertige(JOUR))).toEqual(VARIANTE.seuils(dailyVertige(JOUR).ticksRobot!));
  });
  it("refuse ce qui ne se relit pas : des seuils invalides, un autre contenu, une autre version, le format 1, une autre forme", () => {
    const f = figerJour(JOUR);
    expect(() => figerJour(JOUR, VERTIGE_GENERATOR_VERSION, { author: 10, gold: 5, silver: 20, bronze: 30 })).toThrowError(/seuils invalides/);
    expect(lireJourFige({ ...f, seuils: { ...f.seuils, gold: f.seuils.author } })).toBeNull();
    expect(lireJourFige({ ...f, contenu: { ...f.contenu, ticksRobot: f.contenu.ticksRobot + 1 } })).toBeNull();
    expect(lireJourFige({ ...f, contenu: { ...f.contenu, modules: ["saut-1"] } })).toBeNull();
    expect(lireJourFige({ ...f, sim: VERTIGE_SIM_VERSION + 1 })).toBeNull();
    expect(lireJourFige({ ...f, g: 99 })).toBeNull();
    expect(lireJourFige({ format: 1, jeu: "vertige", date: f.date, g: 1, sim: VERTIGE_SIM_VERSION, contenu: { niveau: "parcours" } })).toBeNull();
    expect(lireJourFige({ ...f, jeu: "autre" })).toBeNull();
    expect(lireJourFige(null)).toBeNull();
    expect(lireJourFige("x")).toBeNull();
    expect(() => figerJour(JOUR, 1)).toThrowError(/ne fige pas/);
  });
});
