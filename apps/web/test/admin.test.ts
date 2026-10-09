import { describe, expect, it } from "vitest";
import { FIGURE_NAMES } from "@cdj/sim";
import { DEFAULT_ADMIN, PRESETS, buildQuery, gameHref, gameKeys, parseAdmin } from "../src/adminLogic";

describe("adresse du jeu construite par /admin", () => {
  it("par défaut : le jeu tel quel", () => {
    expect(buildQuery(DEFAULT_ADMIN)).toBe("");
    expect(gameHref(DEFAULT_ADMIN)).toBe("../");
  });
  it("circuit du jour : date et thème", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, date: "2026-10-07", theme: "nuit" })).toBe("seed=2026-10-07&theme=nuit");
  });
  it("le scénario des largeurs (lot 12) a son adresse et son raccourci", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "largeurs" })).toBe("scenario=largeurs");
    expect(parseAdmin(JSON.stringify({ scenario: "largeurs" })).scenario).toBe("largeurs");
    expect(PRESETS.some((p) => p.state.scenario === "largeurs")).toBe(true);
  });
  it("le scénario du relief (lot 17) a son adresse et son raccourci", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "relief" })).toBe("scenario=relief");
    expect(parseAdmin(JSON.stringify({ scenario: "relief" })).scenario).toBe("relief");
    expect(PRESETS.some((p) => p.state.scenario === "relief")).toBe(true);
  });

  it("le scénario de l'air (lot 19) a son adresse et son raccourci", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "air" })).toBe("scenario=air");
    expect(parseAdmin(JSON.stringify({ scenario: "air" })).scenario).toBe("air");
    expect(PRESETS.some((p) => p.state.scenario === "air")).toBe(true);
  });

  it("les scénarios des figures (lot 20) : le tour, et une figure avec sa variante et son miroir", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "figures" })).toBe("scenario=figures");
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "figure" })).toBe(`scenario=figure&f=${FIGURE_NAMES[0]}`);
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "figure", figure: "slalom-glace", figureVariant: "1", figureMirror: true })).toBe("scenario=figure&f=slalom-glace&v=1&m=1");
    // le choix d'une figure n'a de sens que pour le scénario « une figure »
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "figures", figure: "slalom-glace" })).toBe("scenario=figures");
    expect(parseAdmin(JSON.stringify({ scenario: "figure", figure: "pincement", figureVariant: "2", figureMirror: true }))).toMatchObject({ scenario: "figure", figure: "pincement", figureVariant: "2", figureMirror: true });
    // une figure inconnue ou une variante illisible retombent sur les valeurs par défaut
    expect(parseAdmin(JSON.stringify({ figure: "n-importe-quoi", figureVariant: "abc" }))).toMatchObject({ figure: "", figureVariant: "" });
    expect(PRESETS.some((p) => p.state.scenario === "figures")).toBe(true);
    expect(PRESETS.some((p) => p.state.scenario === "figure")).toBe(true);
  });

  it("le scénario des cuves (lot 18) a son adresse et son raccourci", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "cuves" })).toBe("scenario=cuves");
    expect(parseAdmin(JSON.stringify({ scenario: "cuves" })).scenario).toBe("cuves");
    expect(PRESETS.some((p) => p.state.scenario === "cuves")).toBe(true);
  });

  it("le scénario de la glace (lot 16) a son adresse et son raccourci", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "glace" })).toBe("scenario=glace");
    expect(parseAdmin(JSON.stringify({ scenario: "glace" })).scenario).toBe("glace");
    expect(PRESETS.some((p) => p.state.scenario === "glace")).toBe(true);
  });

  it("le scénario de la vitesse (lot 15) a son adresse et son raccourci", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "vitesse" })).toBe("scenario=vitesse");
    expect(parseAdmin(JSON.stringify({ scenario: "vitesse" })).scenario).toBe("vitesse");
    expect(PRESETS.some((p) => p.state.scenario === "vitesse")).toBe(true);
  });
  it("les autres scénarios ignorent date et thème", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "surfaces", date: "2026-10-07", theme: "nuit" })).toBe("scenario=surfaces");
  });
  it("le panneau de réglages et le temps accéléré sous-entendent debug", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "pilotage", tune: true })).toBe("scenario=pilotage&debug&tune");
    expect(buildQuery({ ...DEFAULT_ADMIN, timescale: "4" })).toBe("debug&timescale=4");
  });
  it("les options d'effets, de tactile et d'API", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, demo: true, fxOff: true, quality: "1", camera: "capot", shakeOff: true, ghostOff: true, touch: "1", api: " http://x " })).toBe(
      "demo&fx=off&quality=1&camera=capot&shake=0&ghost=off&touch=1&api=http%3A%2F%2Fx",
    );
  });
  it("le Salon (lot 26) : ?mode=salon, durée de session, remplace date et thème", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, salon: true, api: "demo" })).toBe("mode=salon&api=demo");
    expect(buildQuery({ ...DEFAULT_ADMIN, salon: true, salonMinutes: "2", api: "demo", date: "2026-10-07", theme: "nuit" })).toBe("mode=salon&salonMinutes=2&api=demo");
    expect(buildQuery({ ...DEFAULT_ADMIN, salonMinutes: "2" })).toBe(""); // la durée ne sert qu'au Salon
    expect(parseAdmin('{"salon":true,"salonMinutes":"2"}')).toMatchObject({ salon: true, salonMinutes: "2" });
    expect(parseAdmin('{"salonMinutes":"abc"}').salonMinutes).toBe("");
    expect(PRESETS.some((p) => p.state.salon === true && p.state.api === "demo")).toBe(true);
  });
  it("miniatures des archives", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, thumbs: "2d" })).toBe("thumbs=2d");
    expect(parseAdmin('{"thumbs":"top"}').thumbs).toBe("top");
    expect(parseAdmin('{"thumbs":"x"}').thumbs).toBe("");
  });
  it("chaque raccourci produit une adresse que le jeu sait lire", () => {
    for (const p of PRESETS) expect(gameHref({ ...DEFAULT_ADMIN, ...p.state })).toMatch(/^\.\.\/(\?[a-zA-Z=&0-9-]+)?$/);
  });
});

describe("choix mémorisés", () => {
  it("illisibles ou hors limites : valeurs par défaut", () => {
    expect(parseAdmin(null)).toEqual(DEFAULT_ADMIN);
    expect(parseAdmin("pas du json")).toEqual(DEFAULT_ADMIN);
    expect(parseAdmin('{"scenario":"x","date":"demain","theme":"lave","quality":"9","timescale":"abc"}')).toEqual(DEFAULT_ADMIN);
  });
  it("valeurs valides conservées", () => {
    const s = parseAdmin('{"scenario":"essai","date":"2026-10-07","theme":"nuit","tune":true,"quality":"0","touch":"1","timescale":"4"}');
    expect(s).toMatchObject({ scenario: "essai", date: "2026-10-07", theme: "nuit", tune: true, quality: "0", touch: "1", timescale: "4" });
  });
  it("données du jeu : seulement cdj:*, sans les choix de l'admin", () => {
    expect(gameKeys(["cdj:best:x", "cdj:admin", "autre", "cdj:audio"])).toEqual(["cdj:audio", "cdj:best:x"]);
  });
});
