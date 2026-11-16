import { describe, expect, it } from "vitest";
import { lireEssai } from "../src/essai";
import { contenuDuJour } from "../src/niveau";
import { dailyPinball } from "@cdj/pinball-sim";

// Les options d'essai de l'adresse (lots PB2 et PB3) : jamais sur la production, et toute option qui change la partie la rend non classable.
describe("les options d'essai de l'adresse", () => {
  it("`?essai=mission` met la partie au but moins un : un essai, donc non classable", () => {
    expect(lireEssai("?essai=mission", false)).toMatchObject({ mission: true, essai: true });
  });
  it("une autre valeur de `essai`, ou aucune, ne change rien (classable)", () => {
    expect(lireEssai("?essai=autre", false)).toMatchObject({ mission: false, essai: false });
    expect(lireEssai("", false)).toMatchObject({ mission: false, essai: false });
  });
  it("`?debug&sons` ouvre la table des sons (lot PBS1) : il faut `debug`, et elle ne change pas la partie (classable)", () => {
    expect(lireEssai("?debug&sons", false)).toMatchObject({ sons: true, essai: false });
    expect(lireEssai("?sons", false)).toMatchObject({ sons: false });
    expect(lireEssai("?debug", false)).toMatchObject({ sons: false });
  });
  it("sur la production (`restreint`), aucune option n'existe : `?essai=mission` ne fait rien", () => {
    expect(lireEssai("?essai=mission&debug&tune&sons&qualite=basse", true)).toEqual({ tune: false, fps: false, sons: false, qualite: null, reglages: null, mission: false, robot: null, essai: false });
  });
});

describe("`?theme=` : la table de ce thème, avec ses éléments et sa mission", () => {
  it("le thème du jour garde la table du jour ; un autre thème donne la table de ce thème ce jour-là", async () => {
    const jour = 20850;
    const duJour = dailyPinball(jour);
    const sien = await contenuDuJour(jour, "", duJour.theme);
    expect(sien.modules).toEqual(duJour.modules);
    for (const theme of ["foire", "ocean", "espace", "volcan"] as const) {
      const c = await contenuDuJour(jour, "", theme);
      expect(c.theme).toBe(theme);
      expect(c.modules).toEqual(dailyPinball(jour, undefined, theme).modules);
      expect(c.seuilsFiges).toBeDefined();
    }
    const volcan = await contenuDuJour(jour, "", "volcan");
    expect(volcan.modules).toContain("geyser");
    expect((await contenuDuJour(jour, "", "espace")).modules).toContain("trouNoir");
  });
});
