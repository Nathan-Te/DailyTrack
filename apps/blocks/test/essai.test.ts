import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { RAMPE_PAR_DEFAUT } from "@cdj/blocks-sim";
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
    expect(lireEssai("?scenario=inconnu", false, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, theme: null, bot: null, adresse: null });
  });
  it("`?debug&tune` règle la rampe (le décalage n'existe plus : le paramètre est ignoré), et met la page en archive ; sans `tune` ou sans `debug`, rien", () => {
    const e = lireEssai("?debug&tune&rampe=2,40&decalage=1.8", false, AUJOURDHUI);
    expect(e).toEqual({ scenario: null, rampe: { pente: 2, rangMax: 40 }, theme: null, bot: null, adresse: e.adresse });
    expect(e).not.toHaveProperty("decalage");
    expect(new URLSearchParams(e.adresse!).get("seed")).toBe(hier);
    expect(lireEssai("?debug&tune&rampe=7", false, AUJOURDHUI).rampe).toEqual({ pente: 7, rangMax: RAMPE_PAR_DEFAUT.rangMax });
    expect(lireEssai("?tune&rampe=2,40", false, AUJOURDHUI).rampe).toBeNull();
    expect(lireEssai("?debug&rampe=2,40", false, AUJOURDHUI).adresse).toBeNull();
    expect(lireEssai("?debug&tune&rampe=x,y&decalage=abc", false, AUJOURDHUI)).toMatchObject({ rampe: null });
  });
  it("sur la production (restreint), aucune option d'essai ne s'applique", () => {
    expect(lireEssai("?scenario=presque-plein&debug&tune&rampe=1,1", true, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, theme: null, bot: null, adresse: null });
    expect(lireEssai("?theme=nuit&bot&seed=2026-11-02", true, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, theme: null, bot: null, adresse: null }); // ni thème forcé, ni bot
  });
  it("`?theme=` force un des six thèmes (un autre nom est ignoré), sans changer la page ni la partie : pas d'archive, pas d'essai", () => {
    for (const th of ["port", "chantier", "canyon", "banquise", "jungle", "nuit"]) expect(lireEssai(`?theme=${th}`, false, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, theme: th, bot: null, adresse: null });
    for (const faux of ["clair", "sombre", "Port", "", "nuit,port"]) expect(lireEssai(`?theme=${faux}`, false, AUJOURDHUI).theme).toBeNull();
    expect(lireEssai("?theme=jungle&scenario=combo", false, AUJOURDHUI)).toMatchObject({ scenario: "combo", theme: "jungle" }); // se cumule avec un scénario
  });
  it("`&bot` : le bot Diamant joue, à 3 poses par seconde ; `&bot=<n>` règle la vitesse (1 à 30) ; il ne met pas la page en archive (c'est la définition qui rend la partie non classable)", () => {
    expect(lireEssai("?seed=2026-11-02&bot", false, AUJOURDHUI)).toEqual({ scenario: null, rampe: null, theme: null, bot: { vitesse: 3 }, adresse: null });
    expect(lireEssai("?bot=12", false, AUJOURDHUI).bot).toEqual({ vitesse: 12 });
    expect(lireEssai("?bot=0", false, AUJOURDHUI).bot).toEqual({ vitesse: 1 });
    expect(lireEssai("?bot=500", false, AUJOURDHUI).bot).toEqual({ vitesse: 30 });
    expect(lireEssai("?bot=vite", false, AUJOURDHUI).bot).toEqual({ vitesse: 3 });
    expect(lireEssai("?seed=2026-11-02", false, AUJOURDHUI).bot).toBeNull();
    expect(lireEssai("?scenario=combo&bot", false, AUJOURDHUI)).toMatchObject({ scenario: "combo", bot: { vitesse: 3 } });
  });
});
