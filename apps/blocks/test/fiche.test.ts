import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, dailyBlocks, medailleDe, numeroBlocks, PREMIER_JOUR_BLOCKS, themeDuJour } from "@cdj/blocks-sim";
import { jouerDiamant, seuilsDe } from "@cdj/blocks-sim/diamant";
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
  it("la définition : numéro, thème, médailles du bot Diamant, texte du score et du partage", async () => {
    vi.stubGlobal("location", { search: "", pathname: "/" });
    const J = PREMIER_JOUR_BLOCKS + 3;
    expect(DEFINITION.numero(J)).toBe(numeroBlocks(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    const c = await DEFINITION.contenuDuJour(J, "http://localhost/blocks/"); // charge le corps du jeu (palette, bot), comme l'accueil
    expect(c.suite).toEqual(dailyBlocks(J).suite);
    const s = DEFINITION.seuils(c);
    expect(s).toEqual(seuilsDe(c)); // les seuils du serveur : le Diamant est la partie du bot
    expect(DEFINITION.medaille([jouerDiamant(c).resultat.score, 0], s)).toBe("author");
    expect(DEFINITION.medaille([s.silver, 0], s)).toBe(medailleDe([s.silver, 0], s));
    expect(DEFINITION.medaille([0, 0], s)).toBeNull();
    expect(DEFINITION.classable!("?seed=2026-11-02&bot")).toBe(false); // `&bot` : jamais classée
    expect(DEFINITION.classable!("?seed=2026-11-02")).toBe(true);
    expect(DEFINITION.classable!("?theme=nuit")).toBe(true); // un thème forcé ne change rien à la partie
    expect(DEFINITION.classable!("?scenario=fantome")).toBe(true); // lot B5 : l'essai du fantôme n'existe plus, ce n'est qu'une partie ordinaire
    expect(DEFINITION.classable!("?scenario=partage")).toBe(false); // lot B4 : l'essai du partage n'est jamais classé
    // Sans traducteur (Node) : le français du catalogue, « 4 582 pts » (le nombre au format de la langue est celui de `remplir`).
    expect(DEFINITION.formatScore([120, 3], "fr")).toBe("120 pts");
    expect(DEFINITION.scorePartage([120, 3], "en")).toBe("120 pts — combo ×3"); // lot B4 : la ligne à partager porte le combo maximal (seed § 5) ; avant, elle ne portait que le score
    vi.unstubAllGlobals();
  });
});
