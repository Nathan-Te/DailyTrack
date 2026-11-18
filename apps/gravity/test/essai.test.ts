import { describe, expect, it } from "vitest";
import { MORCEAUX_PAR_BOUCLE } from "@cdj/gravity-sim";
import { DEFINITION } from "../src/definition";
import { COLONNES_AVANT_MORCEAU, DISTANCE_DU_ROBOT, NOMS_DES_REGLAGES, aUnReglageDEssai, distanceAvantMorceau, lireEssais } from "../src/essai";
import { PARAMETRES_D_ESSAI, libellesDesReglages, lireReglagesEssai } from "../src/reglagesEssai";

// Les essais de recette du lot GR2 : `?robot` (on regarde le robot jouer le niveau du jour) et `?morceau=<n>` (on commence juste avant le morceau n). Hors production seulement, jamais classés.
describe("la lecture de ?robot et ?morceau=", () => {
  it("lit les deux, ensemble ou séparément", () => {
    expect(lireEssais("?robot", false)).toEqual({ robot: true, morceau: null, mode: null, danger: null });
    expect(lireEssais("?morceau=12", false)).toEqual({ robot: false, morceau: 12, mode: null, danger: null });
    expect(lireEssais("?jour=2026-11-09&robot&morceau=40", false)).toEqual({ robot: true, morceau: 40, mode: null, danger: null });
    expect(lireEssais("", false)).toEqual({ robot: false, morceau: null, mode: null, danger: null });
    expect(lireEssais("?robot=0", false).robot).toBe(false);
  });
  it("ignore un numéro qui n'est pas un entier de 1 à deux tours des cinq thèmes", () => {
    for (const mauvais of ["0", "-3", "1.5", "abc", "", "1e2", "99999", String(2 * MORCEAUX_PAR_BOUCLE + 1)]) expect(lireEssais(`?morceau=${mauvais}`, false).morceau, mauvais).toBeNull();
    expect(lireEssais(`?morceau=${2 * MORCEAUX_PAR_BOUCLE}`, false).morceau).toBe(2 * MORCEAUX_PAR_BOUCLE);
  });
  it("**ne fait rien en production** : ni le robot, ni le morceau", () => {
    expect(lireEssais("?robot&morceau=12&mode=avion", true)).toEqual({ robot: false, morceau: null, mode: null, danger: null });
  });
  it("commence douze colonnes avant le morceau, trois colonnes de départ comprises", () => {
    expect(COLONNES_AVANT_MORCEAU).toBe(12);
    expect(distanceAvantMorceau(10)).toBe(10 * 16 - 3 - 12);
    expect(distanceAvantMorceau(1)).toBeGreaterThanOrEqual(1);
    expect(DISTANCE_DU_ROBOT).toBe(2280);
  });
  it("une partie d'essai n'est jamais classable (hors production, vitest) ; une partie normale l'est", () => {
    expect(DEFINITION.classable?.("")).toBe(true);
    expect(DEFINITION.classable?.("?debug&manuel")).toBe(true);
    expect(DEFINITION.classable?.("?theme=neon")).toBe(false);
    expect(DEFINITION.classable?.("?robot")).toBe(false);
    expect(DEFINITION.classable?.("?morceau=30")).toBe(false);
    expect(DEFINITION.classable?.("?morceau=zéro")).toBe(true); // un numéro invalide est ignoré : la page est celle d'un joueur
  });
});

// Lot GR6 — `?mode=avion|onde|ressort` : la partie commence juste avant la première section de ce mode du jour. Hors production seulement, jamais classée.
describe("lot GR6 : la lecture de ?mode=", () => {
  it("lit les trois modes de vol, ensemble avec ?robot, ?morceau= ou ?jour=", () => {
    for (const mode of ["avion", "onde", "ressort"] as const) expect(lireEssais(`?mode=${mode}`, false)).toEqual({ robot: false, morceau: null, mode, danger: null });
    expect(lireEssais("?jour=2026-11-09&mode=onde&robot", false)).toEqual({ robot: true, morceau: null, mode: "onde", danger: null });
    expect(lireEssais("?mode=ressort&morceau=40", false)).toEqual({ robot: false, morceau: 40, mode: "ressort", danger: null }); // `?morceau=` l'emporte, niveau.ts
  });
  it("ignore un mode inconnu (la gravité est le mode de base, pas un essai) ; **rien en production**", () => {
    for (const mauvais of ["", "gravite", "Avion", "vol", "1", "avion,onde"]) expect(lireEssais(`?mode=${mauvais}`, false).mode, mauvais).toBeNull();
    expect(lireEssais("?mode=avion", true).mode).toBeNull();
  });
  it("une page avec ?mode= n'est jamais classable (hors production : le paramètre suffit, même illisible), jamais en production", () => {
    for (const a of ["?mode=avion", "?mode=onde&robot", "?mode=ressort", "?mode=inconnu", "?debug&mode=avion"]) expect(DEFINITION.classable?.(a), a).toBe(false);
    expect(aUnReglageDEssai("?mode=avion", false)).toBe(true);
    expect(aUnReglageDEssai("?mode=avion", true)).toBe(false);
    expect(DEFINITION.classable?.("?debug&manuel")).toBe(true);
  });
});

// Lot GR5 — les réglages d'essai (le calibrage du GR6) : vitesse de départ, plafond, pente, gravité, longueur d'un thème, pourcentage des médailles. Hors production seulement, jamais classés, jamais envoyés.
describe("lot GR5 : la lecture des réglages d'essai", () => {
  it("lit les sept paramètres et les met en unités entières de la simulation", () => {
    expect(PARAMETRES_D_ESSAI.map((p) => p.nom)).toEqual(["vitesse", "plafond", "pente", "courbe", "gravite", "longueur", "medailles"]); // lot GR7 : + la forme de la courbe de vitesse
    expect([...NOMS_DES_REGLAGES]).toEqual(PARAMETRES_D_ESSAI.map((p) => p.nom)); // le test du premier chargement (`aUnReglageDEssai`) et la lecture parlent des mêmes paramètres
    expect(lireReglagesEssai("?vitesse=8&plafond=14&pente=180&gravite=40&longueur=12&medailles=55", false)).toEqual({ vitesseBase: 32768, vitesseMax: 57344, distanceParCran: 180, gravite: 1365, morceauxParTheme: 12, pourcent: 55 });
    expect(lireReglagesEssai("?courbe=1&vitesse=7&pente=220", false)).toEqual({ courbe: 1, vitesseBase: 28672, distanceParCran: 220 }); // l'ancienne courbe (lot GR7)
    expect(lireReglagesEssai("?courbe=3", false)).toBeNull();
    expect(lireReglagesEssai("?gravite=46", false)).toEqual({ gravite: 1570 }); // 46 cases/s² : la valeur de la simulation
    expect(lireReglagesEssai("?vitesse=7.5", false)).toEqual({ vitesseBase: 30720 });
  });
  it("sans paramètre, ou avec des paramètres hors plage, illisibles ou non entiers là où il le faut : rien (la page est celle d'un joueur)", () => {
    expect(lireReglagesEssai("", false)).toBeNull();
    expect(lireReglagesEssai("?jour=2026-11-09&robot&theme=neon", false)).toBeNull();
    for (const mauvais of ["?vitesse=1", "?vitesse=99", "?vitesse=abc", "?vitesse=-3", "?vitesse=", "?vitesse=1e1", "?pente=19", "?pente=180.5", "?longueur=2", "?longueur=41", "?longueur=12.5", "?medailles=9", "?medailles=101", "?gravite=9", "?gravite=121"]) expect(lireReglagesEssai(mauvais, false), mauvais).toBeNull();
  });
  it("**ne fait rien en production** : aucun réglage n'est lu, la partie est celle d'un joueur", () => {
    expect(lireReglagesEssai("?vitesse=8&gravite=40&longueur=12&medailles=55", true)).toBeNull();
    expect(lireEssais("?vitesse=8", true)).toEqual({ robot: false, morceau: null, mode: null, danger: null });
  });
  it("lot GR7 — `?danger=scies|fragiles|lasers` : la partie commence juste avant la première rencontre ; inconnu : ignoré ; rien en production ; jamais classable", () => {
    expect(lireEssais("?danger=scies", false)).toEqual({ robot: false, morceau: null, mode: null, danger: "scies" });
    expect(lireEssais("?danger=lasers&robot", false)).toEqual({ robot: true, morceau: null, mode: null, danger: "lasers" });
    expect(lireEssais("?danger=fragiles&morceau=30", false)).toEqual({ robot: false, morceau: 30, mode: null, danger: "fragiles" }); // `?morceau=` l'emporte, niveau.ts
    expect(lireEssais("?danger=ecraseurs", false).danger).toBeNull(); // les écraseurs sont pour le GR8
    expect(lireEssais("?danger=scies", true).danger).toBeNull();
    expect(DEFINITION.classable?.("?danger=scies")).toBe(false);
    expect(aUnReglageDEssai("?danger=scies", false)).toBe(true);
    expect(aUnReglageDEssai("?danger=scies", true)).toBe(false);
  });
  it("la mention dit ce qui a changé, pas ce qui est comme d'habitude", () => {
    expect(libellesDesReglages(lireReglagesEssai("?vitesse=9&gravite=46&medailles=55&longueur=19", false)!)).toEqual([
      { cle: "vitesse", valeur: 9 },
      { cle: "medailles", valeur: 55 },
    ]);
    expect(libellesDesReglages(lireReglagesEssai("?plafond=14&pente=180&courbe=1&gravite=40&longueur=12", false)!).map((l) => `${l.cle}=${l.valeur}`)).toEqual(["plafond=14", "pente=180", "courbe=1", "gravite=40", "longueur=12"]);
  });
  it("une partie avec un réglage d'essai n'est jamais classable (hors production : un paramètre de réglage, même illisible, suffit : la lecture des valeurs n'est pas du premier chargement)", () => {
    for (const a of ["?vitesse=8", "?gravite=40&debug", "?longueur=12", "?medailles=50", "?vitesse=1"]) expect(DEFINITION.classable?.(a), a).toBe(false);
    expect(DEFINITION.classable?.("?debug&manuel")).toBe(true);
    expect(aUnReglageDEssai("?vitesse=8", true)).toBe(false); // en production, rien
    expect(aUnReglageDEssai("?vitesse=8", false)).toBe(true);
    expect(aUnReglageDEssai("?jour=2026-11-09&robot", false)).toBe(false);
  });
});
