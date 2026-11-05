import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, dailyRush, numeroRush, partieDuBot, PREMIER_JOUR_RUSH, seuilsDe, themeDuJour, VARIANTE } from "@cdj/rush-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_RUSH } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";

// Lot K4f, lot BR0 — le client de « Rush » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/rush.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Rush » : le client suit sa fiche", () => {
  it("l'identifiant, le nom, les thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_RUSH).toBe(parseDay(fiche.premierJour));
  });
  it("l'étiquette générique ; ses versions sont celles de la simulation", () => {
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: RUSH_SIM_VERSION, generatorVersion: RUSH_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/RUSH_SIM_VERSION$/);
  });
  it("le catalogue a les textes que le kit lit au jeu : le nom de chaque thème, sa réplique, l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_RUSH[lang];
      for (const t of FICHE.themes) for (const k of [`theme.${t}`, `accueil.phrase.${t}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème, médaille, texte du score et du partage", () => {
    const J = PREMIER_JOUR_RUSH + 3;
    expect(DEFINITION.numero(J)).toBe(numeroRush(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    const c = dailyRush(J);
    const s = seuilsDe(c); // (la définition les lit dans le corps du jeu, à la demande : il n'est pas chargé ici)
    // La médaille et les textes du score viennent de la variante du jeu (`variante.ts`) : la définition ne fait que les brancher.
    expect(DEFINITION.medaille(VARIANTE.score(partieDuBot(c)), s)).toBe("author");
    expect(DEFINITION.medaille(VARIANTE.score({ victoire: false, ticks: 500 }), s)).toBeNull();
    const exemple = VARIANTE.score({ victoire: true, ticks: 3600 });
    expect(DEFINITION.formatScore(exemple, "fr", (cle) => cle)).toBe(VARIANTE.formatScore(exemple, "fr"));
    expect(DEFINITION.scorePartage(exemple, "en", (cle) => cle)).toBe(VARIANTE.scorePartage(exemple, "en"));
  });
});
