import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUREE_MAX_TICKS, VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, numeroVertige, PREMIER_JOUR_VERTIGE, themeDuJour, VARIANTE } from "@cdj/vertige-sim";
import { parseDay } from "@cdj/core";
import { CATALOGUE_VERTIGE } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { FICHE } from "../src/fiche";

// Lot K4f — le client de « Vertige » dit ce que dit sa fiche (les fiches ne se lisent pas à l'exécution : le jeu passe son nom, son préfixe, ses colonnes ; ce test garde l'accord).
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/vertige.json", import.meta.url), "utf8")) as {
  id: string;
  nom: { fr: string };
  themes: string[];
  premierJour: string;
  classement: { colonnes: { nom: string; sens: "asc" | "desc" }[] };
  donnees: { stockage: { prefixe: string } };
  etiquette: { dessin: string };
  versions: { sim: string; generateur: string };
};

describe("« Vertige » : le client suit sa fiche", () => {
  it("l'identifiant, le nom, les thèmes, le préfixe de stockage, le premier jour et les colonnes de classement", () => {
    expect(FICHE.id).toBe(fiche.id);
    expect(FICHE.nom).toBe(fiche.nom.fr);
    expect([...FICHE.themes]).toEqual(fiche.themes);
    expect(FICHE.prefixe).toBe(fiche.donnees.stockage.prefixe);
    expect(FICHE.premierJour).toBe(fiche.premierJour);
    expect(FICHE.colonnes).toEqual(fiche.classement.colonnes.filter((c) => c.nom !== "submitted_at" && c.nom !== "player_id"));
    expect(PREMIER_JOUR_VERTIGE).toBe(parseDay(fiche.premierJour));
  });
  it("l'étiquette générique ; ses versions sont celles de la simulation", () => {
    expect(fiche.etiquette.dessin).toBe("generique");
    expect(DEFINITION.versions).toEqual({ simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION });
    expect(fiche.versions.sim).toMatch(/VERTIGE_SIM_VERSION$/);
  });
  it("le catalogue a les textes que le kit lit au jeu : le nom de chaque thème, sa réplique, l'aide, le nom de chaque action", () => {
    for (const lang of ["fr", "en"] as const) {
      const c = CATALOGUE_VERTIGE[lang];
      for (const t of FICHE.themes) for (const k of [`theme.${t}`, `accueil.phrase.${t}`]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
      for (const k of [...DEFINITION.aide, "page.titre", "scene.aria", ...DEFINITION.actions.map((a) => `commandes.action.${a.id}`)]) expect(c, `${lang} ${k}`).toHaveProperty([k]);
    }
  });
  it("la définition : numéro, thème, texte du score et du partage ; pas de médaille ni de fantôme au prototype", () => {
    const J = PREMIER_JOUR_VERTIGE + 3;
    expect(DEFINITION.numero(J)).toBe(numeroVertige(J));
    expect(DEFINITION.numero(J)).toBe(4);
    expect(DEFINITION.themeDuJour(J)).toBe(themeDuJour(J));
    expect(DEFINITION.sansMedaille).toBe(true);
    expect(DEFINITION.sansFantome).toBe(true);
    // Les textes du score viennent de la variante du jeu (`variante.ts`) : la définition ne fait que les brancher.
    const exemple = VARIANTE.score({ arrive: true, ticks: 741 });
    expect(DEFINITION.formatScore(exemple, "fr", (cle) => cle)).toBe("6,175 s");
    expect(DEFINITION.scorePartage(exemple, "en", (cle) => cle)).toBe("6.175 s");
    expect(DEFINITION.formatScore(VARIANTE.score({ arrive: false, ticks: 0 }), "fr", (cle) => cle)).toBe(VARIANTE.formatScore([DUREE_MAX_TICKS], "fr"));
  });
  it("tourne à 120 pas par seconde et déclare les actions qu'il lit (touches tenues, relance, styles)", () => {
    expect(DEFINITION.ticksParSeconde).toBe(120);
    expect(DEFINITION.actions.map((a) => a.id)).toEqual(["avant", "arriere", "gauche", "droite", "saut", "dash", "relancer", "style1", "style2"]);
    // Les touches sont des codes de touche (la position) : ZQSD d'un AZERTY et WASD d'un QWERTY sont KeyW, KeyA, KeyS, KeyD.
    expect(DEFINITION.actions.find((a) => a.id === "avant")!.clavier).toContain("KeyW");
    expect(DEFINITION.actions.find((a) => a.id === "saut")!.manette).toBe("b0");
    expect(DEFINITION.actions.find((a) => a.id === "dash")!.manette).toBe("b5");
  });
});
