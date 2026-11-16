import { describe, expect, it } from "vitest";
import { MORCEAUX_PAR_BOUCLE } from "@cdj/gravity-sim";
import { DEFINITION } from "../src/definition";
import { COLONNES_AVANT_MORCEAU, DISTANCE_DU_ROBOT, PARAMETRES_D_ESSAI, distanceAvantMorceau, libellesDesReglages, lireEssais, lireReglagesEssai } from "../src/essai";

// Les essais de recette du lot GR2 : `?robot` (on regarde le robot jouer le niveau du jour) et `?morceau=<n>` (on commence juste avant le morceau n). Hors production seulement, jamais classés.
describe("la lecture de ?robot et ?morceau=", () => {
  it("lit les deux, ensemble ou séparément", () => {
    expect(lireEssais("?robot", false)).toEqual({ robot: true, morceau: null });
    expect(lireEssais("?morceau=12", false)).toEqual({ robot: false, morceau: 12 });
    expect(lireEssais("?jour=2026-11-09&robot&morceau=40", false)).toEqual({ robot: true, morceau: 40 });
    expect(lireEssais("", false)).toEqual({ robot: false, morceau: null });
    expect(lireEssais("?robot=0", false).robot).toBe(false);
  });
  it("ignore un numéro qui n'est pas un entier de 1 à deux tours des cinq thèmes", () => {
    for (const mauvais of ["0", "-3", "1.5", "abc", "", "1e2", "99999", String(2 * MORCEAUX_PAR_BOUCLE + 1)]) expect(lireEssais(`?morceau=${mauvais}`, false).morceau, mauvais).toBeNull();
    expect(lireEssais(`?morceau=${2 * MORCEAUX_PAR_BOUCLE}`, false).morceau).toBe(2 * MORCEAUX_PAR_BOUCLE);
  });
  it("**ne fait rien en production** : ni le robot, ni le morceau", () => {
    expect(lireEssais("?robot&morceau=12", true)).toEqual({ robot: false, morceau: null });
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

// Lot GR5 — les réglages d'essai (le calibrage du GR6) : vitesse de départ, plafond, pente, gravité, longueur d'un thème, pourcentage des médailles. Hors production seulement, jamais classés, jamais envoyés.
describe("lot GR5 : la lecture des réglages d'essai", () => {
  it("lit les six paramètres et les met en unités entières de la simulation", () => {
    expect(PARAMETRES_D_ESSAI.map((p) => p.nom)).toEqual(["vitesse", "plafond", "pente", "gravite", "longueur", "medailles"]);
    expect(lireReglagesEssai("?vitesse=8&plafond=14&pente=180&gravite=40&longueur=12&medailles=55", false)).toEqual({ vitesseBase: 32768, vitesseMax: 57344, distanceParCran: 180, gravite: 1365, morceauxParTheme: 12, pourcent: 55 });
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
    expect(lireEssais("?vitesse=8", true)).toEqual({ robot: false, morceau: null });
  });
  it("la mention dit ce qui a changé, pas ce qui est comme d'habitude", () => {
    expect(libellesDesReglages(lireReglagesEssai("?vitesse=8&gravite=46&medailles=55&longueur=19", false)!)).toEqual([
      { cle: "vitesse", valeur: 8 },
      { cle: "medailles", valeur: 55 },
    ]);
    expect(libellesDesReglages(lireReglagesEssai("?plafond=14&pente=180&gravite=40&longueur=12", false)!).map((l) => `${l.cle}=${l.valeur}`)).toEqual(["plafond=14", "pente=180", "gravite=40", "longueur=12"]);
  });
  it("une partie avec un réglage d'essai n'est jamais classable ; un réglage invalide est ignoré", () => {
    for (const a of ["?vitesse=8", "?gravite=40&debug", "?longueur=12", "?medailles=50"]) expect(DEFINITION.classable?.(a), a).toBe(false);
    expect(DEFINITION.classable?.("?vitesse=1")).toBe(true);
  });
});
