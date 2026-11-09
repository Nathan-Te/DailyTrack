import { describe, expect, it } from "vitest";
import {
  FIGURES,
  GENERATOR_GRAMMAIRE,
  GRAMMAIRE_LOT57,
  GRAMMAIRE_V23,
  PARTIES_LOT57,
  SAUTS_LOT57,
  SIGNATURE_FIGURE,
  TECHNICITE_MAX,
  THEMES,
  THEME_NAMES,
  TRANSITIONS_LOT57,
  classerSauts,
  combinaison,
  fauteSauts,
  figureByName,
  parseTrack,
  sautDansLAxe,
  sautsDansLAxe,
  technicite,
  themeOfVersion,
  vedetteOf,
  type ElementGrammaire,
  type SautClasse,
  type ThemeName,
} from "../src/index";

// Lot 57b : la grammaire dans le générateur (v23) — ses données (les thèmes, les tours, les vedettes), ses règles de compatibilité et de variété, son budget de technicité.

/** Les blocs d'une figure sans sa droite d'amorce (celle qui la précède dans le cadre d'essai). */
const sansAmorce = (body: readonly string[]): string[] => (body[0] === "S" ? body.slice(1) : [...body]);
const piste = (spec: string) => parseTrack("t", `S/n@start ${spec} S@finish`);
const sauts = (spec: string): SautClasse[] => classerSauts(piste(spec));

describe("lot 57b : les données de la grammaire dans le générateur", () => {
  it("chaque saut et chaque transition est une figure `grammaire`, `since` 23, propre à ses thèmes, avec un nom connu de la bibliothèque", () => {
    expect(GENERATOR_GRAMMAIRE).toBe(23);
    for (const e of GRAMMAIRE_LOT57) {
      const f = figureByName(e.name)!;
      expect(f, e.name).toBe(e);
      expect(f.grammaire, e.name).toBe(true);
      expect(f.since, e.name).toBe(23);
      expect(f.only, e.name).toEqual(e.only!);
      expect(f.technicite, e.name).toBeGreaterThanOrEqual(1);
      expect(f.bloc, `${e.name} n'est pas une famille du lot 58`).toBeFalsy();
    }
    expect(FIGURES.filter((f) => f.grammaire).length).toBe(GRAMMAIRE_LOT57.length);
    expect(SAUTS_LOT57.length).toBe(12);
    expect(TRANSITIONS_LOT57.length).toBe(7);
  });

  it("chaque thème a des sauts et des transitions de la grammaire, tous propres à ce thème, et des vedettes de la grammaire", () => {
    for (const theme of THEME_NAMES) {
      const g = GRAMMAIRE_V23[theme];
      expect(g.sauts.length, theme).toBeGreaterThan(0);
      expect(g.transitions.length, theme).toBeGreaterThan(0);
      for (const nom of g.sauts) {
        const f = figureByName(nom) as ElementGrammaire;
        expect(f.genre, `${theme} : ${nom}`).toBe("saut");
        expect(f.only, `${theme} : ${nom}`).toContain(theme);
      }
      for (const nom of g.transitions) {
        const f = figureByName(nom) as ElementGrammaire;
        expect(f.genre, `${theme} : ${nom}`).toBe("transition");
        expect(f.only, `${theme} : ${nom}`).toContain(theme);
      }
      for (const nom of g.vedettes) expect([...g.sauts, ...g.transitions], `${theme} : la vedette ${nom} est un de ses sauts ou de ses transitions`).toContain(nom);
    }
  });

  it("la v22 et les versions d'avant ne connaissent rien de la grammaire (leurs thèmes ne changent pas)", () => {
    for (const theme of THEME_NAMES) {
      const t22 = themeOfVersion(THEMES[theme], 22);
      expect(t22.figures.sauts, theme).toBeUndefined();
      expect(t22.figures.transitions, theme).toBeUndefined();
      expect(t22.figures.vedettes?.some((v) => figureByName(v)?.grammaire) ?? false, theme).toBe(false);
      const t23 = themeOfVersion(THEMES[theme], 23);
      expect(t23.figures.sauts, theme).toEqual(GRAMMAIRE_V23[theme].sauts);
    }
  });

  it("une vedette de la grammaire revient à tour de rôle sans jamais se suivre elle-même, dans chaque thème", () => {
    for (const theme of THEME_NAMES) {
      const t = themeOfVersion(THEMES[theme], 23);
      const nouvelles = new Set(GRAMMAIRE_V23[theme].vedettes);
      const vus = new Set<string>();
      let precedente = "";
      for (let k = 0; k < 40; k++) {
        const v = vedetteOf(t, k)!;
        expect(v, `${theme} apparition ${k}`).not.toBe(precedente);
        precedente = v;
        if (nouvelles.has(v)) vus.add(v);
      }
      expect([...vus].sort(), theme).toEqual([...nouvelles].sort());
    }
  });

  it("la signature et chaque vedette d'un thème tiennent ensemble la règle du saut « droite → tremplin → axe » (sinon le jour de cette vedette n'aurait aucun circuit)", () => {
    for (const theme of THEME_NAMES) {
      const t = themeOfVersion(THEMES[theme], 23);
      const signature = figureByName(SIGNATURE_FIGURE[t.signature])!;
      for (const v of t.figures.vedettes ?? []) {
        const f = figureByName(v)!;
        expect(sautsDansLAxe(signature).min + sautsDansLAxe(f).min, `${theme} : ${signature.name} + ${v}`).toBeLessThanOrEqual(1);
        expect(technicite(signature) + technicite(f), `${theme} : ${signature.name} + ${v}`).toBeLessThanOrEqual(TECHNICITE_MAX);
      }
    }
  });

  it("le Rallye n'a plus la voiture fragile (elle ferait un second saut dans l'axe avec sa signature), le Canyon plus la falaise en vedette", () => {
    expect(themeOfVersion(THEMES.rallye, 22).figures.blocs).toContain("effet-fragile");
    expect(themeOfVersion(THEMES.rallye, 23).figures.blocs).toBeUndefined();
    expect(themeOfVersion(THEMES.canyon, 22).figures.vedettes).toContain("saut-falaise");
    expect(themeOfVersion(THEMES.canyon, 23).figures.vedettes).not.toContain("saut-falaise");
  });
});

describe("lot 57b : les règles de compatibilité d'un saut de la grammaire (approche, appel, vol, réception, sortie)", () => {
  // Les règles écrites au lot 57b pour les combinaisons : un saut qui les enfreint ne peut pas se poser sur toute sa fenêtre ou se lit mal.
  const compatible = (s: SautClasse): string | null => {
    // Un appel qui fait tourner la caisse (dévers, virage-tremplin) ne retombe jamais sur une route qui se resserre : la dérive de 2 à 4 m n'y a pas sa place.
    if (s.vol === "tournant" && s.reception.includes("etroite")) return "vol tournant vers une route qui se resserre";
    // Un appel sur une crête ne tourne pas (rien ne penche, rien ne tourne).
    if (s.appel === "bosse" && s.vol === "tournant") return "crête et vol tournant";
    // Une réception dans un virage (relevé ou en angle) n'est pas suivie d'une chicane : deux virages de suite, la voiture est encore en l'air du premier.
    if ((s.reception.includes("virage") || s.reception.includes("angle")) && s.sortie === "chicane") return "réception dans un virage puis chicane";
    // Un saut vers plus haut a besoin de vitesse : un élan de descente ou une poussée, jamais une droite plate sans rien.
    if (s.reception.includes("haute") && s.vitesse === "elan" && s.approche === "droite" && s.appel !== "bosse") return "plus haut sans élan";
    return null;
  };

  it("chaque saut de la grammaire, dans chacune de ses variantes, respecte les règles de compatibilité", () => {
    for (const e of SAUTS_LOT57) {
      for (let v = 0; v < e.variants; v++) {
        const track = parseTrack("t", [`S/n@start`, "S", "S", "S", "S", ...sansAmorce(figureByName(e.name)!.build({ L: "L", R: "R", wall: "ML", width: "n", variant: v })!), "S", "S@finish"].join(" "));
        for (const s of classerSauts(track)) expect(compatible(s), `${e.name} v${v} : ${combinaison(s)}`).toBeNull();
      }
    }
  });

  it("la règle repère un saut qui l'enfreint", () => {
    expect(compatible({ appelBloc: 0, approche: "droite", appel: "bosse", vol: "tournant", reception: ["basse"], sortie: "droite", vitesse: "elan" })).not.toBeNull();
    expect(compatible({ appelBloc: 0, approche: "droite", appel: "plat", vol: "axe", reception: ["haute"], sortie: "droite", vitesse: "elan" })).not.toBeNull();
    expect(compatible({ appelBloc: 0, approche: "virage", appel: "plat", vol: "axe", reception: ["virage"], sortie: "chicane", vitesse: "elan" })).not.toBeNull();
  });
});

describe("lot 57b : les règles de variété (`fauteSauts`) et le budget de technicité", () => {
  it("deux sauts « droite → tremplin → axe » dans un circuit sont une faute, un seul non", () => {
    expect(fauteSauts(["S/n@start", "S", "S", "K", "G", "D", "S", "S", "S@finish"])).toBeNull();
    expect(fauteSauts(["S/n@start", "S", "S", "K", "G", "D", "S", "S", "S", "K", "GD", "S", "S", "S@finish"])).not.toBeNull();
  });

  it("une `reserve` compte les sauts que les figures encore à poser ne peuvent éviter", () => {
    const spec = ["S/n@start", "S", "S", "K", "G", "D", "S", "S", "S@finish"];
    expect(fauteSauts(spec, 0)).toBeNull();
    expect(fauteSauts(spec, 1)).not.toBeNull();
  });

  it("deux sauts de la même combinaison sont une faute, même quand aucun n'est « droite → tremplin → axe »", () => {
    // Deux fois « virage → tremplin → axe → plus bas → droite » (une chicane avant chaque rampe).
    const un = ["L2", "R2", "S", "K", "GD", "S", "S", "S"];
    const faute = fauteSauts(["S/n@start", "S", ...un, ...un, "S@finish"]);
    expect(faute).not.toBeNull();
    // Un virage avant la première rampe, une pente avant la seconde : deux combinaisons.
    const autre = ["D", "D", "K", "GD", "S", "S", "S"];
    expect(fauteSauts(["S/n@start", "S", "L2", "S", "S", "K", "GD", "S", "S", "S", ...autre, "S@finish"])).toBeNull();
  });

  it("le budget de technicité d'un circuit est celui de la grammaire : un saut le plus technique et une transition tiennent", () => {
    const sauts_ = SAUTS_LOT57.map((e) => e.technicite!);
    const transitions = TRANSITIONS_LOT57.map((e) => e.technicite!);
    expect(Math.max(...sauts_) + Math.max(...transitions)).toBeLessThanOrEqual(TECHNICITE_MAX);
    for (const e of GRAMMAIRE_LOT57) expect(technicite(e), e.name).toBe(e.technicite);
  });

  it("une figure sans saut ne compte aucun saut dans l'axe ni aucune technicité ; le saut simple en compte un", () => {
    expect(sautsDansLAxe(figureByName("slalom-route")!)).toEqual({ min: 0, max: 0 });
    expect(technicite(figureByName("slalom-route")!)).toBe(0);
    expect(sautsDansLAxe(figureByName("saut-simple")!).min).toBe(1);
  });
});

describe("lot 57b : le rangement des sauts de la grammaire correspond à leurs parties annoncées", () => {
  it("l'approche et la réception annoncées sont celles que `classerSauts` lit (première variante, route normale)", () => {
    for (const e of SAUTS_LOT57) {
      const body = e.build({ L: "L", R: "R", wall: "ML", width: "n", variant: 0 })!;
      const s = sauts(["S", "S", "S", "S", ...sansAmorce(body)].join(" "))[0]!;
      expect(s.appel, e.name).toBe(PARTIES_LOT57[e.name]!.appel);
      expect(s.vol, e.name).toBe(PARTIES_LOT57[e.name]!.vol);
      expect(s.approche, e.name).toBe(PARTIES_LOT57[e.name]!.approche);
      // Les « sauts dans l'axe » de la grammaire sont ceux qu'elle annonce comme tels : un élan, un double saut… (le reste demande un geste de plus).
      const axe = sautDansLAxe(s);
      const annonce = PARTIES_LOT57[e.name]!.approche === "droite" && PARTIES_LOT57[e.name]!.appel === "plat" && PARTIES_LOT57[e.name]!.vol === "axe" && PARTIES_LOT57[e.name]!.reception.every((r) => r === "axe" || r === "basse" || r === "haute");
      expect(axe, e.name).toBe(annonce);
    }
  });
});

describe("lot 57b : une figure se pose avec son thème", () => {
  it("l'herbe de course n'est qu'à la Campagne et la glace qu'à la Banquise et au Col alpin, pour chaque saut et chaque transition de la grammaire", () => {
    for (const e of GRAMMAIRE_LOT57)
      for (const theme of e.only!)
        for (let v = 0; v < e.variants; v++) {
          const body = e.build({ L: "L", R: "R", wall: "ML", width: "n", variant: v, theme });
          if (!body) continue;
          const jetons = body.join(" ");
          if (theme !== "campagne") expect(jetons, `${e.name} v${v} (${theme})`).not.toMatch(/\/[a-z]*z/);
          if (!["banquise", "col"].includes(theme)) expect(jetons, `${e.name} v${v} (${theme})`).not.toMatch(/\/[a-z]*g/);
        }
  });

  it("chaque élément a, dans chacun de ses thèmes, au moins une variante qui se construit", () => {
    for (const e of GRAMMAIRE_LOT57)
      for (const theme of e.only!) {
        const variantes = Array.from({ length: e.variants }, (_, v) => e.build({ L: "L", R: "R", wall: "ML", width: "n", variant: v, theme })).filter(Boolean);
        expect(variantes.length, `${e.name} (${theme})`).toBeGreaterThan(0);
      }
  });
});
