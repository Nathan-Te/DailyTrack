import { describe, expect, it } from "vitest";
import { lireOptions } from "../src/urlOptions";

// Lot T1 — règle R9 : `?scenario`, `?debug` et `?tune` ne servent à rien en production (`restreint`) ; l'interface tactile reste réglable (aucun effet sur une partie).
describe("paramètres d'adresse de Tower", () => {
  it("hors production : la suite d'essai par défaut, la démonstration du lot T0, les outils de Nathan", () => {
    expect(lireOptions("", false)).toEqual({ scenario: "essai", debug: false, tune: false, tactile: null });
    expect(lireOptions("?scenario=essai&debug&tune&tactile=1", false)).toEqual({ scenario: "essai", debug: true, tune: true, tactile: "1" });
    expect(lireOptions("?scenario=banc&engine=b", false).scenario).toBe("banc");
    expect(lireOptions("?tune", false).tune).toBe(false); // `tune` ne va pas sans `debug`
    expect(lireOptions("?tactile=2", false).tactile).toBeNull();
  });

  it("en production : ni scénario de démonstration, ni ?debug, ni ?tune", () => {
    expect(lireOptions("?scenario=banc&debug&tune", true)).toEqual({ scenario: "essai", debug: false, tune: false, tactile: null });
  });
});
