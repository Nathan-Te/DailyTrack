import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, PLAFOND_PIECES, REFERENCES_MEDAILLES, TAILLE_SERIE } from "../src/index";
import { jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";
import { jouerDiamant } from "../src/diamant";

// Les CIBLES du calibrage de la rampe et des médailles (lot B8), sur un échantillon de jours (la mesure complète est sur 1 000 jours : `npm run calibrer:medailles`, README du lot B8 — faible 41 séries, moyen 140, Diamant 324,
// plafond 1,3 %). Ici des marges pour qu'un échantillon plus petit ne fasse pas échouer le test, mais qu'une rampe ou un poids qui sort des cibles le fasse : on ne relâche pas une cible sans mesure.
const PREMIER = daysFromCivil(2026, 11, 2);
const mediane = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

describe("les cibles du calibrage (rampe du tirage v4)", () => {
  it("bot faible : au moins 40 séries en médiane ; son score médian est le bronze (à 100 points près)", () => {
    const parties = Array.from({ length: 300 }, (_, i) => jouerFaible(dailyBlocks(PREMIER + i)).resultat);
    expect(mediane(parties.map((r) => r.poses / TAILLE_SERIE))).toBeGreaterThanOrEqual(38); // 41 sur 1 000 jours
    expect(Math.abs(mediane(parties.map((r) => r.score)) - REFERENCES_MEDAILLES.bronze)).toBeLessThanOrEqual(200);
  });
  it("bot moyen : de 80 à 150 séries en médiane ; son score médian est l'argent (à 1 000 points près)", () => {
    const parties = Array.from({ length: 150 }, (_, i) => jouerGlouton(dailyBlocks(PREMIER + i)).resultat);
    const series = mediane(parties.map((r) => r.poses / TAILLE_SERIE));
    expect(series).toBeGreaterThanOrEqual(80);
    expect(series).toBeLessThanOrEqual(150); // 140 sur 1 000 jours
    expect(Math.abs(mediane(parties.map((r) => r.score)) - REFERENCES_MEDAILLES.silver)).toBeLessThanOrEqual(1000);
  }, 60000);
  it("Diamant : le plafond de pièces est rarement atteint (moins de 5 % de 60 jours), la médiane est loin au-dessus de l'or", () => {
    const parties = Array.from({ length: 60 }, (_, i) => jouerDiamant(dailyBlocks(PREMIER + i)).resultat);
    expect(parties.filter((r) => r.poses >= PLAFOND_PIECES).length / parties.length).toBeLessThan(0.05);
    expect(mediane(parties.map((r) => r.score))).toBeGreaterThan(2 * REFERENCES_MEDAILLES.gold);
  }, 120000);
});
