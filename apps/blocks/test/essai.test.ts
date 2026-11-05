import { describe, expect, it } from "vitest";
import { RAMPE_PAR_DEFAUT } from "@cdj/blocks-sim";
import { lireEssai } from "../src/essai";
import { DEFINITION } from "../src/definition";

// Les options d'essai de Blocks. Lot « manques de Blocks » : un essai n'est plus « mis en archive » (le détour par `?seed=` de la veille est supprimé) — c'est `classable` de la définition qui le dit au kit ; et `?theme=`
// n'est plus lu ici (le kit le lit pour tous les jeux).
describe("les options d'essai", () => {
  it("un scénario est un essai : reconnu, jamais classable, sans réécrire l'adresse (le jour reste celui d'aujourd'hui)", () => {
    const e = lireEssai("?scenario=presque-plein", false);
    expect(e.scenario).toBe("presque-plein");
    expect(e).not.toHaveProperty("adresse");
    expect(DEFINITION.classable!("?scenario=presque-plein")).toBe(false);
    expect(DEFINITION.classable!("?scenario=blocage&seed=2026-11-02")).toBe(false);
  });
  it("les quatre scénarios sont reconnus, un autre nom non", () => {
    for (const n of ["presque-plein", "blocage", "plateau-vide", "combo", "suivantes"]) expect(lireEssai(`?scenario=${n}`, false).scenario).toBe(n);
    expect(lireEssai("?scenario=inconnu", false)).toEqual({ scenario: null, rampe: null, bot: null });
  });
  it("`?debug&tune` règle la rampe (le décalage n'existe plus : le paramètre est ignoré) et la partie n'est pas classable ; sans `tune` ou sans `debug`, rien", () => {
    const e = lireEssai("?debug&tune&rampe=2,40&decalage=1.8", false);
    expect(e).toEqual({ scenario: null, rampe: { pente: 2, rangMax: 40 }, bot: null });
    expect(e).not.toHaveProperty("decalage");
    expect(DEFINITION.classable!("?debug&tune&rampe=2,40")).toBe(false);
    expect(lireEssai("?debug&tune&rampe=7", false).rampe).toEqual({ pente: 7, rangMax: RAMPE_PAR_DEFAUT.rangMax });
    expect(lireEssai("?tune&rampe=2,40", false).rampe).toBeNull();
    expect(DEFINITION.classable!("?debug&rampe=2,40")).toBe(true);
    expect(lireEssai("?debug&tune&rampe=x,y&decalage=abc", false)).toMatchObject({ rampe: null });
  });
  it("sur la production (restreint), aucune option d'essai ne s'applique", () => {
    expect(lireEssai("?scenario=presque-plein&debug&tune&rampe=1,1", true)).toEqual({ scenario: null, rampe: null, bot: null });
    expect(lireEssai("?bot&seed=2026-11-02", true)).toEqual({ scenario: null, rampe: null, bot: null });
  });
  it("`?theme=` n'est plus une option de Blocks : le kit le lit (tous les jeux), la définition n'en dit rien", () => {
    expect(lireEssai("?theme=nuit", false)).toEqual({ scenario: null, rampe: null, bot: null });
    expect(DEFINITION.classable!("?theme=nuit")).toBe(true); // c'est le kit qui fait d'un thème forcé un essai
  });
  it("`&bot` : le bot Diamant joue, à 3 poses par seconde ; `&bot=<n>` règle la vitesse (1 à 30) ; la partie n'est pas classable", () => {
    expect(lireEssai("?seed=2026-11-02&bot", false)).toEqual({ scenario: null, rampe: null, bot: { vitesse: 3 } });
    expect(lireEssai("?bot=12", false).bot).toEqual({ vitesse: 12 });
    expect(lireEssai("?bot=0", false).bot).toEqual({ vitesse: 1 });
    expect(lireEssai("?bot=500", false).bot).toEqual({ vitesse: 30 });
    expect(lireEssai("?bot=vite", false).bot).toEqual({ vitesse: 3 });
    expect(lireEssai("?seed=2026-11-02", false).bot).toBeNull();
    expect(lireEssai("?scenario=combo&bot", false)).toMatchObject({ scenario: "combo", bot: { vitesse: 3 } });
    expect(DEFINITION.classable!("?seed=2026-11-02&bot")).toBe(false);
    expect(DEFINITION.classable!("?seed=2026-11-02")).toBe(true);
  });
});

describe("l'essai du lot B4 : `?scenario=partage` (lot B5 : `?scenario=fantome` n'existe plus)", () => {
  it("`?scenario=fantome` n'est plus un essai : la partie du jour, ordinaire (le fantôme est retiré)", () => {
    const e = lireEssai("?scenario=fantome", false);
    expect(e.mode).toBeUndefined();
    expect(e.scenario).toBeNull();
  });
  it("`partage` : la médaille d'exemple vaut « argent » par défaut, `&medaille=` en choisit une autre, un mot inconnu retombe sur l'argent", () => {
    expect(lireEssai("?scenario=partage", false)).toMatchObject({ mode: "partage", exemple: "argent" });
    for (const m of ["aucune", "bronze", "argent", "or", "diamant"]) expect(lireEssai(`?scenario=partage&medaille=${m}`, false).exemple).toBe(m);
    expect(lireEssai("?scenario=partage&medaille=platine", false).exemple).toBe("argent");
    expect(DEFINITION.classable!("?scenario=partage")).toBe(false);
  });
  it("sur la production (`restreint`) rien ne s'ouvre", () => {
    expect(lireEssai("?scenario=partage", true).mode).toBeUndefined();
  });
});
