import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN, PRESETS, buildQuery, gameHref, gameKeys, parseAdmin } from "../src/adminLogic";

describe("adresse du jeu construite par /admin", () => {
  it("par défaut : le jeu tel quel", () => {
    expect(buildQuery(DEFAULT_ADMIN)).toBe("");
    expect(gameHref(DEFAULT_ADMIN)).toBe("../");
  });
  it("circuit du jour : date et thème", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, date: "2026-10-07", theme: "nuit" })).toBe("seed=2026-10-07&theme=nuit");
  });
  it("les autres scénarios ignorent date et thème", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "surfaces", date: "2026-10-07", theme: "nuit" })).toBe("scenario=surfaces");
  });
  it("le panneau de réglages et le temps accéléré sous-entendent debug", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "pilotage", tune: true })).toBe("scenario=pilotage&debug&tune");
    expect(buildQuery({ ...DEFAULT_ADMIN, timescale: "4" })).toBe("debug&timescale=4");
  });
  it("les options d'effets, de tactile et d'API", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, demo: true, fxOff: true, quality: "1", shakeOff: true, ghostOff: true, touch: "1", api: " http://x " })).toBe(
      "demo&fx=off&quality=1&shake=0&ghost=off&touch=1&api=http%3A%2F%2Fx",
    );
  });
  it("miniatures des archives", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, thumbs: "2d" })).toBe("thumbs=2d");
    expect(parseAdmin('{"thumbs":"top"}').thumbs).toBe("top");
    expect(parseAdmin('{"thumbs":"x"}').thumbs).toBe("");
  });
  it("chaque raccourci produit une adresse que le jeu sait lire", () => {
    for (const p of PRESETS) expect(gameHref({ ...DEFAULT_ADMIN, ...p.state })).toMatch(/^\.\.\/(\?[a-z=&0-9]+)?$/);
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
