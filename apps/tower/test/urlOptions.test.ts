import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { choisirJour, lireOptions } from "../src/urlOptions";

// Lots T1 et T2 — règle R9 : `?scenario`, `?effet`, `?debug` et `?tune` ne servent à rien en production (`restreint`) ; l'interface tactile reste réglable (aucun effet sur une partie).
// `?seed=` suit la règle de `?seed=` de Jump : sur la production une date FUTURE est refusée, ailleurs toutes les dates s'ouvrent.
const J = (d: string): number => parseDay(d)!;

describe("paramètres d'adresse de Tower", () => {
  it("hors production : le contenu du jour par défaut, la suite d'essai, les paliers, la démonstration du lot T0, les outils de Nathan", () => {
    expect(lireOptions("", false)).toEqual({ scenario: "jour", seed: null, effet: "lierre", debug: false, tune: false, bot: false, tirage: 0, theme: null, tactile: null, api: null });
    expect(lireOptions("?scenario=essai&debug&tune&tactile=1", false)).toEqual({ scenario: "essai", seed: null, effet: "lierre", debug: true, tune: true, bot: false, tirage: 0, theme: null, tactile: "1", api: null });
    expect(lireOptions("?scenario=banc&engine=b", false).scenario).toBe("banc");
    expect(lireOptions("?scenario=inconnu", false).scenario).toBe("jour");
    expect(lireOptions("?tune", false).tune).toBe(false); // `tune` ne va pas sans `debug`
    expect(lireOptions("?tactile=2", false).tactile).toBeNull();
  });

  it("?seed=AAAA-MM-JJ : une date lisible donne son numéro de jour, une date illisible n'ouvre rien d'autre que le jour courant", () => {
    expect(lireOptions("?seed=2026-11-02", false).seed).toBe(J("2026-11-02"));
    expect(lireOptions("?seed=2026-02-30", false).seed).toBeNull();
    expect(lireOptions("?seed=demain", false).seed).toBeNull();
    expect(lireOptions("?seed=2026-11-02&scenario=essai", false)).toMatchObject({ scenario: "essai", seed: J("2026-11-02") });
  });

  it("?scenario=paliers&effet=… : chacun des six effets, lierre par défaut, un effet inconnu retombe sur lierre", () => {
    for (const e of ["lierre", "figee", "petite", "geante", "vent", "glissante"]) expect(lireOptions(`?scenario=paliers&effet=${e}`, false)).toMatchObject({ scenario: "paliers", effet: e });
    expect(lireOptions("?scenario=paliers", false).effet).toBe("lierre");
    expect(lireOptions("?scenario=paliers&effet=pluie", false).effet).toBe("lierre");
  });

  it("en production : ni scénario, ni effet, ni ?debug, ni ?tune ; seul ?seed= reste lu (sa date future est refusée par choisirJour)", () => {
    expect(lireOptions("?scenario=banc&debug&tune&bot&theme=nuit", true)).toEqual({ scenario: "jour", seed: null, effet: "lierre", debug: false, tune: false, bot: false, tirage: 0, theme: null, tactile: null, api: null });
    expect(lireOptions("?scenario=paliers&effet=vent", true)).toMatchObject({ scenario: "jour", effet: "lierre" });
    expect(lireOptions("?seed=2026-11-02", true).seed).toBe(J("2026-11-02"));
  });
});

describe("lot T3 : ?bot et ?theme=", () => {
  it("hors production : ?bot regarde le bot (le contenu d'un jour seulement), ?theme= force un des six thèmes", () => {
    expect(lireOptions("?seed=2026-11-05&bot", false)).toMatchObject({ bot: true, scenario: "jour", seed: J("2026-11-05") });
    expect(lireOptions("?scenario=essai&bot", false).bot).toBe(false);
    for (const th of ["port", "chantier", "canyon", "banquise", "jungle", "nuit"]) expect(lireOptions(`?theme=${th}`, false).theme).toBe(th);
    expect(lireOptions("?theme=volcan", false).theme).toBeNull();
  });
  it("en production (R9) : ni ?bot, ni ?theme= — la preuve de l'auteur n'y est pas publiée", () => {
    expect(lireOptions("?seed=2026-11-05&bot&theme=banquise", true)).toMatchObject({ bot: false, theme: null });
  });
});

describe("choisirJour : le jour à jouer", () => {
  const AUJOURDHUI = J("2026-11-02");
  it("sans ?seed= : aujourd'hui", () => {
    expect(choisirJour(null, AUJOURDHUI, false)).toEqual({ jour: AUJOURDHUI, refuse: false });
    expect(choisirJour(null, AUJOURDHUI, true)).toEqual({ jour: AUJOURDHUI, refuse: false });
  });
  it("hors production (aperçu, local) : toutes les dates s'ouvrent, futures comprises", () => {
    expect(choisirJour(J("2026-11-03"), AUJOURDHUI, false)).toEqual({ jour: J("2026-11-03"), refuse: false });
    expect(choisirJour(J("2026-10-30"), AUJOURDHUI, false)).toEqual({ jour: J("2026-10-30"), refuse: false });
  });
  it("sur la production : une date passée s'ouvre (archive), une date future est refusée et c'est aujourd'hui qui s'ouvre", () => {
    expect(choisirJour(J("2026-10-30"), AUJOURDHUI, true)).toEqual({ jour: J("2026-10-30"), refuse: false });
    expect(choisirJour(AUJOURDHUI, AUJOURDHUI, true)).toEqual({ jour: AUJOURDHUI, refuse: false });
    expect(choisirJour(J("2026-11-03"), AUJOURDHUI, true)).toEqual({ jour: AUJOURDHUI, refuse: true });
  });
});

describe("lot T3b : ?tirage=", () => {
  it("hors production : le tirage d'un jour sans fichier, de 0 à TIRAGES_MAX − 1 ; illisible ou hors bornes = 0", () => {
    expect(lireOptions("", false).tirage).toBe(0);
    for (const t of [1, 2, 3]) expect(lireOptions(`?seed=2026-11-17&tirage=${t}`, false)).toMatchObject({ tirage: t, seed: J("2026-11-17") });
    for (const mauvais of ["0", "4", "99", "-1", "x", ""]) expect(lireOptions(`?tirage=${mauvais}`, false).tirage, mauvais).toBe(0);
  });
  it("en production (R9) : fermé — le contenu d'un jour est toujours le tirage 0 (ou celui de son fichier)", () => {
    expect(lireOptions("?seed=2026-11-05&tirage=2", true).tirage).toBe(0);
  });
});

describe("lot T4 : ?api=", () => {
  it("l'adresse du serveur est lue telle quelle (la règle R7 s'applique à baseApi) ; en production elle est lue aussi, jamais crue", () => {
    expect(lireOptions("?api=http://localhost:8791", false).api).toBe("http://localhost:8791");
    expect(lireOptions("?api=/", true).api).toBe("/");
    expect(lireOptions("", false).api).toBeNull();
  });
});
