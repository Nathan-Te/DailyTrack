import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PILEPOIL_GENERATOR_VERSION, PILEPOIL_SIM_VERSION, dailyPilepoil, numeroPilepoil, PREMIER_JOUR_PILEPOIL } from "@cdj/pilepoil-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_PILEPOIL } from "../src/catalogue";
import { definitionDeParty, THEME_UNIQUE } from "@cdj/kit/jeu/types";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";

// Lots K4f et PA2 — le client de « Pile poil » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/pilepoil.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  categorie: string;
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Pile poil » : le client suit sa fiche", () => {
  it("la catégorie Party, l'identifiant, le nom, l'absence de thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(fiche.themes).toEqual([]); // lot PA1 : un jeu Party n'a pas de thème
    expect(FICHE.categorie).toBe("party");
    expect(fiche.categorie).toBe("party");
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_PILEPOIL).toBe(parseDay(fiche.premierJour));
  });
  it("l'étiquette générique ; ses versions sont celles de la simulation", () => {
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: PILEPOIL_SIM_VERSION, generatorVersion: PILEPOIL_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/PILEPOIL_SIM_VERSION$/);
  });
  it("le catalogue a les textes que le kit lit au jeu : le thème unique du kit (nom et réplique), l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_PILEPOIL[lang];
      for (const k of [`theme.${THEME_UNIQUE}`, `accueil.phrase.${THEME_UNIQUE}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème unique, aucune médaille, aucun fantôme, texte du score et du partage", () => {
    const J = PREMIER_JOUR_PILEPOIL + 3;
    expect(DEFINITION.numero(J)).toBe(numeroPilepoil(J));
    expect(DEFINITION.numero(J)).toBe(4);
    // Le kit complète la définition d'un jeu Party : un seul thème, ni médaille ni fantôme.
    const complete = definitionDeParty(DEFINITION);
    expect(complete.themeDuJour(J)).toBe(THEME_UNIQUE);
    expect(complete.sansMedaille).toBe(true);
    expect(complete.sansFantome).toBe(true);
    expect(dailyPilepoil(J).graine).toBeGreaterThan(0);
    // Le score s'écrit par le catalogue (les points, au format de la langue) ; la ligne à partager ajoute les « pile ».
    const t = (cle: string, p?: Readonly<Record<string, string | number>>) => `${cle}:${p?.n ?? ""}`;
    expect(DEFINITION.formatScore([1167, 5], "fr", t)).toBe("score.valeur:1167");
    expect(DEFINITION.scorePartage([1167, 5], "en", t)).toBe("partage.score:1167");
    expect(DEFINITION.extrasPartage!([1167, 5], "fr", t)).toEqual(["partage.piles:5"]);
    expect(DEFINITION.extrasPartage!([80, 0], "fr", t)).toEqual([]);
  });
  it("une seule commande (Espace, Entrée, le bouton A) ; `?debug&tune` n'est jamais classé", () => {
    expect(DEFINITION.actions).toEqual([{ id: "arreter", clavier: ["Space", "Enter"], manette: "b0" }]);
    expect(DEFINITION.classable!("?debug&tune")).toBe(false);
    expect(DEFINITION.classable!("?debug")).toBe(true);
    expect(DEFINITION.classable!("")).toBe(true);
  });
});
