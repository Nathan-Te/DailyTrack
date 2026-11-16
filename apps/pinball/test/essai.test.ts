import { afterEach, describe, expect, it, vi } from "vitest";
import { lireEssai } from "../src/essai";
import { contenuDuJour } from "../src/niveau";
import { IDS_PLANS, dailyPinball } from "@cdj/pinball-sim";
import { CATALOGUE_FR } from "../src/catalogue.fr";
import { CATALOGUE_EN } from "../src/catalogue.en";
import { nomDuModule } from "../src/noms";

// Les options d'essai de l'adresse (lots PB2 et PB3) : jamais sur la production, et toute option qui change la partie la rend non classable.
describe("les options d'essai de l'adresse", () => {
  it("`?essai=mission` met la partie au but moins un : un essai, donc non classable", () => {
    expect(lireEssai("?essai=mission", false)).toMatchObject({ mission: true, essai: true });
  });
  it("une autre valeur de `essai`, ou aucune, ne change rien (classable)", () => {
    expect(lireEssai("?essai=autre", false)).toMatchObject({ mission: false, essai: false });
    expect(lireEssai("", false)).toMatchObject({ mission: false, essai: false });
  });
  it("sur la production (`restreint`), aucune option n'existe : `?essai=mission` ne fait rien", () => {
    expect(lireEssai("?essai=mission&debug&tune&qualite=basse&plan=boucle", true)).toEqual({ tune: false, fps: false, qualite: null, reglages: null, mission: false, robot: null, plan: null, essai: false });
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

// Lot PBG1 : `?plan=<id>` joue un plan donné (hors production, jamais classé), combinable avec `?theme=`.
describe("`?plan=` : la table de ce plan, seule ou avec un thème", () => {
  afterEach(() => vi.unstubAllGlobals());
  const avec = (recherche: string): void => void vi.stubGlobal("location", { search: recherche });

  it("`?plan=<id>` est lu tel quel (des lettres), c'est un essai : non classable ; sur la production il n'existe pas", () => {
    expect(lireEssai("?plan=boucle", false)).toMatchObject({ plan: "boucle", essai: true });
    expect(lireEssai("?plan=boucle&theme=volcan", false)).toMatchObject({ plan: "boucle", essai: true });
    expect(lireEssai("?plan=", false)).toMatchObject({ plan: null, essai: false });
    expect(lireEssai("?plan=<script>", false)).toMatchObject({ plan: null, essai: false });
    expect(lireEssai("?plan=boucle", true)).toMatchObject({ plan: null, essai: false });
  });

  it("chaque plan donne sa table ce jour-là, avec le thème du jour ; un plan inconnu est ignoré (la table du jour)", async () => {
    const jour = 20850;
    const duJour = dailyPinball(jour);
    for (const plan of IDS_PLANS) {
      avec(`?plan=${plan}`);
      const c = await contenuDuJour(jour, "", duJour.theme);
      expect(c.plan).toBe(plan);
      expect(c.theme).toBe(duJour.theme);
      expect(c.modules).toEqual(dailyPinball(jour, undefined, duJour.theme, plan).modules);
      expect(c.seuilsFiges).toBeDefined();
    }
    avec("?plan=inconnu");
    const ignore = await contenuDuJour(jour, "", duJour.theme);
    expect(ignore.plan).toBe(duJour.plan);
    expect(ignore.modules).toEqual(duJour.modules);
  });

  it("`?plan=` se combine avec `?theme=` : le thème et le plan demandés, tous les deux", async () => {
    const jour = 20850;
    for (const theme of ["foire", "ocean", "espace", "volcan"] as const) {
      for (const plan of IDS_PLANS) {
        avec(`?plan=${plan}&theme=${theme}`);
        const c = await contenuDuJour(jour, "", theme);
        expect([c.theme, c.plan]).toEqual([theme, plan]);
        expect(c.modules).toEqual(dailyPinball(jour, undefined, theme, plan).modules);
      }
    }
  });
});

describe("les noms des rails et des plans (lot PBG1)", () => {
  it("chaque rampe, l'orbite et chaque plan ont un nom en français et en anglais, par thème pour les rails", () => {
    for (const cat of [CATALOGUE_FR, CATALOGUE_EN] as Record<string, string>[]) {
      for (const theme of ["foire", "ocean", "espace", "volcan"]) {
        for (const genre of ["rampe", "orbite"]) expect(nomDuModule((k) => cat[k]!, theme, genre), `${genre} ${theme}`).toBeTruthy();
      }
      for (const plan of IDS_PLANS) expect(cat[`plan.${plan}`], plan).toBeTruthy();
    }
    expect(nomDuModule((k) => k, "foire", "rampe")).toBe("module.rampe.foire");
  });
});
