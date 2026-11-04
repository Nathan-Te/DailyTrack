import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, dailyBlocks, numeroBlocks, PREMIER_JOUR_BLOCKS, themeDuJour } from "@cdj/blocks-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_BLOCKS } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";

// Lot K4f — le client de « Blocks » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Blocks » : le client suit sa fiche", () => {
  it("l'identifiant, le nom, les thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_BLOCKS).toBe(parseDay(fiche.premierJour));
  });
  it("l'étiquette générique ; ses versions sont celles de la simulation", () => {
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/BLOCKS_SIM_VERSION$/);
  });
  it("le catalogue a les textes que le kit lit au jeu : le nom de chaque thème, sa réplique, l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_BLOCKS[lang];
      for (const t of FICHE.themes) for (const k of [`theme.${t}`, `accueil.phrase.${t}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème, pas de médaille avant B3, texte du score et du partage", () => {
    const J = PREMIER_JOUR_BLOCKS + 3;
    expect(DEFINITION.numero(J)).toBe(numeroBlocks(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    const c = dailyBlocks(J);
    expect(DEFINITION.medaille([4582, 7], DEFINITION.seuils(c))).toBeNull();
    // Sans traducteur (Node) : le français du catalogue, « 4 582 pts » (le nombre au format de la langue est celui de `remplir`).
    expect(DEFINITION.formatScore([120, 3], "fr")).toBe("120 pts");
    expect(DEFINITION.scorePartage([120, 3], "en")).toBe("120 pts");
  });
});
