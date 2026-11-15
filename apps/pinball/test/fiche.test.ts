import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, dailyPinball, numeroPinball, PREMIER_JOUR_PINBALL, seuilsDe, themeDuJour, VARIANTE } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_PINBALL } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";
import { ACTIONS_KIT } from "@cdj/kit/jeu/commandes";

// Lot K4f — le client de « Pinball » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/pinball.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Pinball » : le client suit sa fiche", () => {
  it("l'identifiant, le nom, les thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_PINBALL).toBe(parseDay(fiche.premierJour));
  });
  it("l'étiquette générique ; ses versions sont celles de la simulation ; les trois commandes tenues", () => {
    expect(DEFINITION.actions.map((a) => a.id)).toEqual(["gauche", "droite", "lanceur"]);
    expect(DEFINITION.actions.map((a) => a.clavier)).toEqual([["ArrowLeft", "KeyQ", "KeyA"], ["ArrowRight", "KeyD"], ["Space", "ArrowDown"]]);
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: PINBALL_SIM_VERSION, generatorVersion: PINBALL_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/PINBALL_SIM_VERSION$/);
  });
  it("aucune touche n'est liée à deux actions, celles du kit comprises (sinon un réglage enregistré est refusé au rechargement)", () => {
    const touches = [...DEFINITION.actions, ...ACTIONS_KIT].flatMap((a) => a.clavier);
    expect(touches.filter((t, i) => touches.indexOf(t) !== i)).toEqual([]);
  });
  it("le catalogue a les textes que le kit lit au jeu : le nom de chaque thème, sa réplique, l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_PINBALL[lang];
      for (const t of FICHE.themes) for (const k of [`theme.${t}`, `accueil.phrase.${t}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème, médaille, texte du score et du partage", () => {
    const J = PREMIER_JOUR_PINBALL + 3;
    expect(DEFINITION.numero(J)).toBe(numeroPinball(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    const c = dailyPinball(J);
    const s = seuilsDe(c); // la définition lit les seuils écrits dans le contenu par `niveau.ts` (`seuilsFiges`) ; ici le calcul provisoire
    // La médaille et les textes du score viennent de la variante du jeu (`variante.ts`) : la définition ne fait que les brancher.
    expect(DEFINITION.medaille([s.author, 100], s)).toBe("author");
    expect(DEFINITION.medaille([0, 900], s)).toBeNull();
    expect(DEFINITION.seuils({ ...c, seuilsFiges: s })).toEqual(s);
    const exemple = VARIANTE.score({ score: 4582, ticks: 3600 });
    expect(DEFINITION.formatScore(exemple, "fr", (cle) => cle)).toBe(VARIANTE.formatScore(exemple, "fr"));
    expect(DEFINITION.scorePartage(exemple, "en", (cle) => cle)).toBe(VARIANTE.scorePartage(exemple, "en"));
  });
});
