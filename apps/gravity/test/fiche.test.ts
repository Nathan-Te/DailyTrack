import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, dailyGravity, numeroGravity, ordreDesThemes, PREMIER_JOUR_GRAVITY, seuilsSurLePapier, themeDuJour, VARIANTE } from "@cdj/gravity-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_GRAVITY } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";

// Lot K4f — le client de « Gravity » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/gravity.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Gravity » : le client suit sa fiche", () => {
  it("l'identifiant, le nom, les thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_GRAVITY).toBe(parseDay(fiche.premierJour));
  });
  it("l'étiquette générique ; ses versions sont celles de la simulation", () => {
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/GRAVITY_SIM_VERSION$/);
  });
  it("le catalogue a les textes que le kit lit au jeu : le nom de chaque thème, sa réplique, l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_GRAVITY[lang];
      for (const t of FICHE.themes) for (const k of [`theme.${t}`, `accueil.phrase.${t}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème, médaille, texte du score et du partage, aucun fantôme", () => {
    const J = PREMIER_JOUR_GRAVITY + 3;
    expect(DEFINITION.numero(J)).toBe(numeroGravity(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    expect(DEFINITION.themeDuJour(J)).toBe(ordreDesThemes(J)[0]);
    const c = dailyGravity(J);
    // Les seuils sont écrits dans le contenu quand le niveau est lu (`niveau.ts`) : la définition les rend tels quels.
    const s = DEFINITION.seuils({ ...c, seuilsFiges: seuilsSurLePapier(c) });
    expect(s).toEqual(seuilsSurLePapier(c));
    expect(DEFINITION.medaille([s.author, 100], s)).toBe("author");
    expect(DEFINITION.medaille([s.bronze, 100], s)).toBe("bronze");
    expect(DEFINITION.medaille([0, 100], s)).toBeNull();
    const exemple = VARIANTE.score({ score: 4582, ticks: 3600 });
    expect(DEFINITION.formatScore(exemple, "fr", (cle) => cle)).toBe(VARIANTE.formatScore(exemple, "fr"));
    expect(DEFINITION.scorePartage(exemple, "en", (cle) => cle)).toBe("4,582");
    expect(DEFINITION.sansFantome).toBe(true);
  });
  it("une seule action : toucher (Espace, flèches, W, S, A à la manette) ; ?theme= est un essai, jamais classé", () => {
    expect(DEFINITION.actions.map((a) => a.id)).toEqual(["toucher"]);
    expect(DEFINITION.actions[0]!.clavier).toEqual(expect.arrayContaining(["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"]));
    expect(DEFINITION.actions[0]!.manette).toBe("b0");
    expect(DEFINITION.classable!("?debug&manuel")).toBe(true);
    expect(DEFINITION.classable!("")).toBe(true);
    expect(DEFINITION.classable!("?theme=glace")).toBe(false);
  });
  it("les textes que la scène lit existent dans les deux langues : bandeau de thème, causes de mort, ligne du HUD", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_GRAVITY[lang];
      for (const t of FICHE.themes) expect(c, `${lang} theme.${t}.meca`).toHaveProperty([`theme.${t}.meca`]);
      for (const k of ["vide", "pique", "bord", "temps"]) expect(c, `${lang} mort.${k}`).toHaveProperty([`mort.${k}`]);
      expect(c).toHaveProperty(["hud.detail"]);
    }
  });
});
