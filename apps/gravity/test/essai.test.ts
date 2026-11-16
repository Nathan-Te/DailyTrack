import { describe, expect, it } from "vitest";
import { MORCEAUX_PAR_BOUCLE } from "@cdj/gravity-sim";
import { DEFINITION } from "../src/definition";
import { COLONNES_AVANT_MORCEAU, DISTANCE_DU_ROBOT, distanceAvantMorceau, lireEssais } from "../src/essai";

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
