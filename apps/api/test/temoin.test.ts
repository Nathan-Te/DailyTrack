import { describe, expect, it } from "vitest";
import { JEUX_DU_REGISTRE } from "../src/registre.generated";
import { FICHES_SERVEUR } from "../src/fiches.generated";
import { CODES_TEMOINS, GAMES, jeuxPourEnvironnement, retenirPourEnvironnement } from "../src/registry";
import { makeApi } from "./helpers";

// Lot K4e — le registre du serveur vient des fiches, et un jeu témoin (`temoin: true`) n'est jamais dans celui d'un serveur de production.
describe("le registre vient des fiches (lot K4e)", () => {
  it("un jeu du registre par fiche, dans l'ordre des fiches, avec le drapeau `temoin` de la fiche", () => {
    expect(JEUX_DU_REGISTRE.map((j) => j.code)).toEqual(FICHES_SERVEUR.map((f) => f.code));
    expect(JEUX_DU_REGISTRE.map((j) => j.jeu.code)).toEqual(JEUX_DU_REGISTRE.map((j) => j.code));
    expect(JEUX_DU_REGISTRE.map((j) => j.temoin)).toEqual(FICHES_SERVEUR.map((f) => ("temoin" in f ? f.temoin === true : false)));
    expect(GAMES.map((g) => g.code)).toEqual(FICHES_SERVEUR.map((f) => f.code));
  });

  it("un témoin n'est retenu que hors production (règle pure, faux jeux)", () => {
    const jeux = [{ code: "cdj", temoin: false }, { code: "essai", temoin: true }, { code: "tower", temoin: false }];
    expect(retenirPourEnvironnement(jeux, "production").map((j) => j.code)).toEqual(["cdj", "tower"]);
    expect(retenirPourEnvironnement(jeux, "recette").map((j) => j.code)).toEqual(["cdj", "essai", "tower"]);
    expect(retenirPourEnvironnement(jeux, "local").map((j) => j.code)).toEqual(["cdj", "essai", "tower"]);
  });

  it("le registre d'un serveur de production ne contient aucun jeu témoin des fiches ; ceux de la recette et du local les contiennent tous", () => {
    const prod = jeuxPourEnvironnement("production").map((g) => g.code);
    for (const code of CODES_TEMOINS) {
      expect(prod, code).not.toContain(code);
      expect(jeuxPourEnvironnement("recette").map((g) => g.code), code).toContain(code);
      expect(jeuxPourEnvironnement("local").map((g) => g.code), code).toContain(code);
    }
    expect(prod.length).toBe(GAMES.length - CODES_TEMOINS.length);
  });

  it("un serveur créé en production (`environment`) ne répond pas pour un jeu témoin : 404", async () => {
    const t = await makeApi({ environment: "production" });
    for (const code of CODES_TEMOINS) {
      const r = await t.call("GET", `/api/${code}/info`);
      expect(r.status, code).toBe(404);
    }
  });
});
