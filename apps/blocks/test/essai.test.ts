import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { lireEssai } from "../src/essai";

const AUJOURDHUI = daysFromCivil(2026, 11, 6);
const hier = formatDay(AUJOURDHUI - 1);

describe("les options d'essai", () => {
  it("un scénario met la page en archive (la veille) et ne s'envoie jamais", () => {
    const e = lireEssai("?scenario=presque-plein", false, AUJOURDHUI);
    expect(e.scenario).toBe("presque-plein");
    expect(new URLSearchParams(e.adresse!).get("seed")).toBe(hier);
    expect(new URLSearchParams(e.adresse!).get("scenario")).toBe("presque-plein");
  });
  it("un jour déjà passé nommé par l'adresse est gardé ; un jour d'aujourd'hui ou futur est remplacé par la veille", () => {
    expect(lireEssai("?scenario=blocage&seed=2026-11-02", false, AUJOURDHUI).adresse).toBeNull();
    expect(new URLSearchParams(lireEssai(`?scenario=blocage&seed=${formatDay(AUJOURDHUI)}`, false, AUJOURDHUI).adresse!).get("seed")).toBe(hier);
    expect(new URLSearchParams(lireEssai("?scenario=blocage&seed=2030-01-01", false, AUJOURDHUI).adresse!).get("seed")).toBe(hier);
  });
  it("les quatre scénarios sont reconnus, un autre nom non", () => {
    for (const n of ["presque-plein", "blocage", "plateau-vide", "combo"]) expect(lireEssai(`?scenario=${n}`, false, AUJOURDHUI).scenario).toBe(n);
    expect(lireEssai("?scenario=inconnu", false, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, adresse: null });
  });
  it("`?debug&tune` règle la rampe (le décalage n'existe plus : le paramètre est ignoré), et met la page en archive ; sans `tune` ou sans `debug`, rien", () => {
    const e = lireEssai("?debug&tune&rampe=2,40&decalage=1.8", false, AUJOURDHUI);
    expect(e).toEqual({ scenario: null, rampe: { pente: 2, rangMax: 40 }, adresse: e.adresse });
    expect(e).not.toHaveProperty("decalage");
    expect(new URLSearchParams(e.adresse!).get("seed")).toBe(hier);
    expect(lireEssai("?debug&tune&rampe=7", false, AUJOURDHUI).rampe).toEqual({ pente: 7, rangMax: 80 });
    expect(lireEssai("?tune&rampe=2,40", false, AUJOURDHUI).rampe).toBeNull();
    expect(lireEssai("?debug&rampe=2,40", false, AUJOURDHUI).adresse).toBeNull();
    expect(lireEssai("?debug&tune&rampe=x,y&decalage=abc", false, AUJOURDHUI)).toMatchObject({ rampe: null });
  });
  it("sur la production (restreint), aucune option d'essai ne s'applique", () => {
    expect(lireEssai("?scenario=presque-plein&debug&tune&rampe=1,1", true, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, adresse: null });
  });
});
