import { describe, expect, it } from "vitest";
import { REGLAGES_DEFAUT } from "@cdj/rush-sim";
import { ACTIONS_RUSH } from "../src/actions";
import { directionAnalogique, directionDe8 } from "../src/controles";
import { lireEssai } from "../src/essai";
import { sensationsDe, SENSATIONS_DEFAUT } from "../src/sensations";

// Les commandes et les options d'essai de Rush, sans navigateur : les directions (clavier à 8 directions, stick à 32), les actions déclarées au kit, l'adresse d'essai (jamais lue sur la production).
describe("les directions", () => {
  it("le clavier donne les huit directions de la croix (0 vers la droite, 8 vers le bas, 16 vers la gauche, 24 vers le haut)", () => {
    expect(directionDe8(0, 0)).toBe(-1);
    expect([directionDe8(1, 0), directionDe8(1, 1), directionDe8(0, 1), directionDe8(-1, 1), directionDe8(-1, 0), directionDe8(-1, -1), directionDe8(0, -1), directionDe8(1, -1)]).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
  });
  it("le stick donne 32 directions, avec une zone morte", () => {
    expect(directionAnalogique(0.1, 0.1)).toBe(-1);
    expect([directionAnalogique(1, 0), directionAnalogique(0, 1), directionAnalogique(-1, 0), directionAnalogique(0, -1)]).toEqual([0, 8, 16, 24]);
    const vues = new Set<number>();
    for (let a = 0; a < 360; a += 3) vues.add(directionAnalogique(Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)));
    expect(vues.size).toBe(32);
  });
});

describe("les actions du jeu", () => {
  it("six actions, chacune avec des touches d'origine ; le coup et l'esquive ont un bouton de manette qui laisse X, Y et Start au kit", () => {
    expect(ACTIONS_RUSH.map((a) => a.id)).toEqual(["haut", "bas", "gauche", "droite", "coup", "esquive"]);
    for (const a of ACTIONS_RUSH) expect(a.clavier.length).toBeGreaterThanOrEqual(1);
    const boutons = ACTIONS_RUSH.map((a) => a.manette).filter(Boolean);
    expect(boutons).toEqual(["b0", "b1"]);
    expect(boutons).not.toContain("b2"); // « Recommencer » du kit
    expect(boutons).not.toContain("b3"); // « Fantôme » du kit
  });
});

describe("l'adresse d'essai", () => {
  it("sur la production, aucune option d'essai n'est lue", () => {
    const e = lireEssai("?debug&tune&scenario=boss&reglages=%7B%22vitesse%22%3A900%7D", true);
    expect(e).toMatchObject({ scenario: null, tune: false, reglages: null, essai: false });
  });
  it("un scénario, ses options et les réglages collés font une partie d'essai (non classable)", () => {
    expect(lireEssai("", false).essai).toBe(false);
    expect(lireEssai("?debug", false).essai).toBe(false);
    expect(lireEssai("?scenario=boss&phase=2", false)).toMatchObject({ scenario: "boss", phase2: true, essai: true });
    expect(lireEssai("?scenario=arene&monstres=30", false)).toMatchObject({ scenario: "arene", monstres: 30 });
    expect(lireEssai("?scenario=arene&monstres=999", false).monstres).toBe(40);
    expect(lireEssai("?scenario=inconnu", false).scenario).toBeNull();
    expect(lireEssai("?debug&tune", false)).toMatchObject({ tune: true, essai: true });
    expect(lireEssai("?tune", false).tune).toBe(false); // il faut `?debug`
    const json = encodeURIComponent(JSON.stringify({ reglages: { vitesse: 700, portee: 99999 }, sensations: { arretImage: 120 } }));
    const e = lireEssai(`?reglages=${json}`, false);
    expect(e.reglages).toEqual({ ...REGLAGES_DEFAUT, vitesse: 700, portee: 400 }); // une valeur hors bornes est ramenée dans ses bornes
    expect(e.essai).toBe(true);
    expect(sensationsDe(e.sensations).arretImage).toBe(120);
    expect(lireEssai("?reglages=pas-du-json", false).reglages).toBeNull();
    // des réglages égaux aux défauts ne font pas une partie d'essai
    expect(lireEssai(`?reglages=${encodeURIComponent(JSON.stringify(REGLAGES_DEFAUT))}`, false).essai).toBe(false);
  });
  it("les sensations collées restent dans leurs bornes", () => {
    expect(sensationsDe(null)).toEqual(SENSATIONS_DEFAUT);
    expect(sensationsDe({ secousse: 9999, vue: 1, inconnu: 3 })).toEqual({ ...SENSATIONS_DEFAUT, secousse: 300, vue: 9 });
  });
});
