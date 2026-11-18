import { describe, expect, it } from "vitest";
import { CASE, COURBE_LINEAIRE, CROISIERE_PLUS, DISTANCE_PAR_CRAN, MORCEAUX_PAR_BOUCLE, REGLES_COURANTES, VITESSE_BASE, VITESSE_MAX, VITESSE_PLAFOND, reglesDe, vitesseCamera, vitesseNormale, GRAVITY_SIM_VERSION, MORCEAUX_PAR_THEME, LARGEUR_MORCEAU } from "../src/index";

// Lot GR7 — **la courbe de vitesse** : départ à 8 cases/s, la croisière de la première boucle (12,5) atteinte vers 550 m (avant : 1 210 m), vite au début puis plus doucement ; chaque boucle relève la croisière (+1,5 puis +1), sous le plafond
// absolu. Les constantes sont nommées (`constantes.ts`) ; la courbe d'avant (linéaire) reste jouable par `?courbe=1` (réglages d'essai).
const enCases = (cam: number, r = REGLES_COURANTES): number => vitesseNormale(cam, r) / CASE;
const metres = (m: number): number => m * CASE;
const LONGUEUR_BOUCLE = MORCEAUX_PAR_BOUCLE * LARGEUR_MORCEAU * CASE;

describe("la courbe de vitesse de la première boucle", () => {
  it("part de 8 cases/s et atteint la croisière (12,5) vers 550 m, puis ne dépasse plus", () => {
    expect(VITESSE_BASE).toBe(8 * CASE);
    expect(VITESSE_MAX).toBe(12.5 * CASE);
    expect(vitesseNormale(0, REGLES_COURANTES)).toBe(8 * CASE);
    const fin = (VITESSE_MAX - VITESSE_BASE) * DISTANCE_PAR_CRAN;
    expect(fin / CASE).toBeGreaterThan(540);
    expect(fin / CASE).toBeLessThan(560);
    expect(vitesseNormale(fin, REGLES_COURANTES)).toBe(VITESSE_MAX);
    expect(vitesseNormale(metres(700), REGLES_COURANTES)).toBe(VITESSE_MAX);
    expect(vitesseNormale(metres(1400), REGLES_COURANTES)).toBe(VITESSE_MAX);
  });
  it("monte vite au début, puis plus doucement : chaque tranche de 100 m gagne moins que la précédente, et la première plus de 3 cases/s", () => {
    const gains: number[] = [];
    for (let m = 0; m < 500; m += 100) gains.push(enCases(metres(m + 100)) - enCases(metres(m)));
    for (let i = 1; i < gains.length; i++) expect(gains[i]!, `tranche ${i}`).toBeLessThan(gains[i - 1]!);
    expect(gains[0]!).toBeGreaterThan(1.4);
    // Plus tôt qu'avant : à 300 m on a déjà dépassé 11 cases/s (l'ancienne courbe : 8,4).
    expect(enCases(metres(300))).toBeGreaterThan(11);
  });
  it("ne baisse jamais", () => {
    let avant = 0;
    for (let m = 0; m < 4000; m += 10) {
      const v = vitesseCamera(metres(m));
      expect(v).toBeGreaterThanOrEqual(avant);
      avant = v;
    }
  });
});

describe("chaque boucle relève la croisière", () => {
  it("+1,5 cases/s à la 2e boucle, +2,5 à la 3e et après, atteint après la rampe du début de boucle", () => {
    expect(CROISIERE_PLUS).toEqual([0, 6144, 10240]);
    const cr = (b: number): number => enCases(b * LONGUEUR_BOUCLE + metres(b === 0 ? 700 : 400));
    expect(cr(0)).toBeCloseTo(12.5, 5);
    expect(cr(1)).toBeCloseTo(14, 5);
    expect(cr(2)).toBeCloseTo(15, 5);
    expect(cr(5)).toBeCloseTo(15, 5);
    // Pas d'à-coup au passage d'une boucle : la croisière monte en 150 m.
    expect(enCases(LONGUEUR_BOUCLE)).toBeCloseTo(12.5, 2);
    expect(enCases(LONGUEUR_BOUCLE + metres(75))).toBeGreaterThan(13);
    expect(enCases(LONGUEUR_BOUCLE + metres(75))).toBeLessThan(13.5);
  });
  it("le plafond absolu (17 cases/s) borne tout, portails compris", () => {
    expect(VITESSE_PLAFOND).toBe(17 * CASE);
    for (const facteur of [80, 100, 115, 130, 150]) for (const m of [0, 300, 1500, 3000, 6000]) expect(vitesseCamera(metres(m), REGLES_COURANTES, facteur)).toBeLessThanOrEqual(VITESSE_PLAFOND);
  });
});

describe("l'ancienne courbe reste jouable par les réglages d'essai (`?vitesse=7&pente=220&courbe=1`)", () => {
  const ancienne = reglesDe(GRAVITY_SIM_VERSION, MORCEAUX_PAR_THEME, { vitesseBase: 7 * CASE, distanceParCran: 220, courbe: COURBE_LINEAIRE });
  it("7 cases/s plus 1 case/s tous les 220 m, la croisière de 12,5 atteinte à 1 210 m", () => {
    expect(enCases(0, ancienne)).toBe(7);
    expect(enCases(metres(220), ancienne)).toBeCloseTo(8, 1);
    expect(enCases(metres(660), ancienne)).toBeCloseTo(10, 1);
    expect(enCases(metres(1210), ancienne)).toBeCloseTo(12.5, 1);
    expect(enCases(metres(1400), ancienne)).toBeCloseTo(12.5, 5);
  });
  it("la nouvelle est devant l'ancienne partout avant la croisière", () => {
    for (let m = 20; m < 1200; m += 40) expect(enCases(metres(m))).toBeGreaterThan(enCases(metres(m), ancienne));
  });
  it("la table vitesse / distance du rapport du lot (README GR7)", () => {
    const table = [0, 100, 200, 300, 400, 550, 1000, 1520, 1700, 3040, 3190].map((m) => `${m} m : ${enCases(metres(m)).toFixed(2)} (avant ${enCases(metres(m), ancienne).toFixed(2)})`);
    expect(table).toHaveLength(11);
  });
});
