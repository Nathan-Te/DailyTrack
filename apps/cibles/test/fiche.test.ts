import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CIBLES_GENERATOR_VERSION, CIBLES_SIM_VERSION, dailyCibles, numeroCibles, PREMIER_JOUR_CIBLES, themeDuJour } from "@cdj/cibles-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_CIBLES } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";

// Lot K4f — le client de « Cibles » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/cibles.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  temoin: boolean;
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Cibles » : le client suit sa fiche", () => {
  it("l'identifiant, le nom, les thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_CIBLES).toBe(parseDay(fiche.premierJour));
  });
  it("un jeu témoin, à l'étiquette générique ; ses versions sont celles de la simulation", () => {
    expect(fiche.temoin).toBe(true);
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: CIBLES_SIM_VERSION, generatorVersion: CIBLES_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/CIBLES_SIM_VERSION$/);
  });
  it("le catalogue a les textes que le kit lit au jeu : le nom de chaque thème, sa réplique, l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_CIBLES[lang];
      for (const t of FICHE.themes) for (const k of [`theme.${t}`, `accueil.phrase.${t}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème, médaille, texte du score et du partage", () => {
    const J = PREMIER_JOUR_CIBLES + 3;
    expect(DEFINITION.numero(J)).toBe(numeroCibles(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    const c = dailyCibles(J);
    const s = DEFINITION.seuils(c);
    expect([20, 10, 6, 3, 2].map((n) => DEFINITION.medaille([n, 100], s))).toEqual(["author", "gold", "silver", "bronze", null]);
    expect(DEFINITION.formatScore([17, 300], "fr")).toBe("17 / 20");
    expect(DEFINITION.scorePartage([17, 300], "en")).toBe("17/20");
  });
});
