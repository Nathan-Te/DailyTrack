import { describe, expect, it } from "vitest";
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
  it("les six scénarios sont reconnus (coup-de-pouce depuis le lot B8c), un autre nom non", () => {
    for (const n of ["presque-plein", "blocage", "plateau-vide", "combo", "ordre", "coup-de-pouce"]) expect(lireEssai(`?scenario=${n}`, false).scenario).toBe(n);
    expect(lireEssai("?scenario=inconnu", false)).toEqual({ scenario: null, reglage: null, bot: null });
  });
  it("`?debug&tune` règle le tirage (le décalage n'existe plus : le paramètre est ignoré) et la partie n'est pas classable ; sans `tune` ou sans `debug`, rien", () => {
    const e = lireEssai("?debug&tune&rampe=2,40&decalage=1.8", false);
    expect(e).toEqual({ scenario: null, reglage: { rampe: { pente: 2, rangMax: 40 } }, bot: null });
    expect(e).not.toHaveProperty("decalage");
    expect(DEFINITION.classable!("?debug&tune&rampe=2,40")).toBe(false);
    expect(lireEssai("?debug&tune&rampe=7", false).reglage).toEqual({ rampe: { pente: 7 } }); // ce qui n'est pas dit garde la valeur du jeu
    expect(lireEssai("?tune&rampe=2,40", false).reglage).toBeNull();
    expect(DEFINITION.classable!("?debug&rampe=2,40")).toBe(true);
    expect(lireEssai("?debug&tune&rampe=x,y&decalage=abc", false)).toMatchObject({ reglage: null });
  });
  it("`?debug&tune` règle aussi le tirage adapté à la grille (lot B8c) : les essais, l'exigence « série posable », le coup de pouce, la pente d'après rangMax", () => {
    expect(lireEssai("?debug&tune&essais=10", false).reglage).toEqual({ essais: 10 });
    expect(lireEssai("?debug&tune&essais=0", false).reglage).toBeNull();
    expect(lireEssai("?debug&tune&essais=9999", false).reglage).toEqual({ essais: 400 });
    expect(lireEssai("?debug&tune&posable=40,100,10", false).reglage).toEqual({ posable: { jusqua: 40, rang: 100, pct: 10 } });
    expect(lireEssai("?debug&tune&posable=,,0", false).reglage).toEqual({ posable: { pct: 0 } });
    expect(lireEssai("?debug&tune&pouce=100,100,80", false).reglage).toEqual({ pouce: { pct: 100, pctFin: 100, rang: 80 } });
    expect(lireEssai("?debug&tune&rampe=1,80,0.25&essais=5", false).reglage).toEqual({ rampe: { pente: 1, rangMax: 80, apres: 0.25 }, essais: 5 });
    for (const a of ["?debug&tune&essais=10", "?debug&tune&posable=40,100,10", "?debug&tune&pouce=100,100,80", "?debug&tune&rampe=1,80,0.25"]) expect(DEFINITION.classable!(a), a).toBe(false);
    expect(DEFINITION.classable!("?essais=10&posable=40,100,10")).toBe(true); // sans `debug&tune`, rien
  });
  it("sur la production (restreint), aucune option d'essai ne s'applique", () => {
    expect(lireEssai("?scenario=presque-plein&debug&tune&rampe=1,1", true)).toEqual({ scenario: null, reglage: null, bot: null });
    expect(lireEssai("?bot&seed=2026-11-02", true)).toEqual({ scenario: null, reglage: null, bot: null });
  });
  it("`?theme=` n'est plus une option de Blocks : le kit le lit (tous les jeux), la définition n'en dit rien", () => {
    expect(lireEssai("?theme=nuit", false)).toEqual({ scenario: null, reglage: null, bot: null });
    expect(DEFINITION.classable!("?theme=nuit")).toBe(true); // c'est le kit qui fait d'un thème forcé un essai
  });
  it("`&bot` : le bot Diamant joue, à 3 poses par seconde ; `&bot=<n>` règle la vitesse (1 à 30) ; la partie n'est pas classable", () => {
    expect(lireEssai("?seed=2026-11-02&bot", false)).toEqual({ scenario: null, reglage: null, bot: { vitesse: 3 } });
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

describe("`classable` (la définition, courte) est d'accord avec `lireEssai` (le corps du jeu) sur toute adresse d'essai", () => {
  it("scénarios, partage, bot, rampe réglée ou mal réglée, thème, seed : mêmes réponses", () => {
    const adresses = ["", "?seed=2026-11-02", "?theme=nuit", "?scenario=presque-plein", "?scenario=blocage&seed=2026-11-02", "?scenario=ordre", "?scenario=coup-de-pouce", "?scenario=suivantes", "?scenario=inconnu", "?scenario=fantome", "?scenario=partage", "?scenario=partage&medaille=or", "?bot", "?bot=12", "?bot=vite", "?seed=2026-11-02&bot", "?scenario=combo&bot", "?debug&tune&rampe=2,40", "?debug&tune&rampe=7", "?debug&tune&rampe=,9", "?debug&tune&rampe=x,y", "?debug&tune&rampe=x", "?debug&tune", "?debug&rampe=2,40", "?tune&rampe=2,40", "?debug&tune&rampe=1.5,2.5"];
    for (const a of adresses) {
      const e = lireEssai(a, false);
      expect(DEFINITION.classable!(a), a).toBe(e.scenario === null && e.reglage === null && e.bot === null && e.mode === undefined);
    }
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
