import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, POURCENT_ARGENT, POURCENT_BRONZE, POURCENT_OR, TICKS_PAR_SECONDE, analyserTable, dailyPinball, graineDuRobot, seuilsDesScores, seuilsDuRobot, seuilsValides } from "../src/index";

// Lot PB4 — les seuils des médailles viennent du robot : Diamant = son meilleur score, les trois autres des pourcentages (constantes nommées, que Nathan règle).
const JOUR = daysFromCivil(2026, 11, 9);

describe("les seuils d'après les scores du robot", () => {
  it("Diamant est le meilleur score (à la centaine près), les autres sont des pourcentages de lui", () => {
    const s = seuilsDesScores([61234, 98765, 70001, 40000]);
    expect(s.author).toBe(98800);
    expect(s.gold).toBe(Math.trunc(((Math.trunc((98800 * POURCENT_OR) / 100) + 50) / 100)) * 100);
    expect(s.silver).toBe(Math.trunc((Math.trunc((98800 * POURCENT_ARGENT) / 100) + 50) / 100) * 100);
    expect(s.bronze).toBe(Math.trunc((Math.trunc((98800 * POURCENT_BRONZE) / 100) + 50) / 100) * 100);
    expect(POURCENT_BRONZE).toBeLessThan(POURCENT_ARGENT);
    expect(POURCENT_ARGENT).toBeLessThan(POURCENT_OR);
    expect(POURCENT_OR).toBeLessThan(100);
  });
  it("toujours quatre entiers strictement croissants, même avec des scores minuscules ou nuls", () => {
    for (const scores of [[0, 0, 0, 0], [3], [250, 10, 500], [100, 100, 100, 100], [1_000_000, 5, 0]]) {
      const s = seuilsDesScores(scores);
      expect(seuilsValides(s), JSON.stringify(scores)).toBe(true);
      expect(Object.values(s).every((v) => v % 100 === 0)).toBe(true);
    }
  });
  it("ne dépend ni de l'ordre ni de la répétition des scores", () => {
    expect(seuilsDesScores([10_000, 40_000, 20_000])).toEqual(seuilsDesScores([20_000, 10_000, 40_000, 40_000]));
  });
});

describe("le robot donne les seuils d'une table", () => {
  const c = dailyPinball(JOUR);
  it(`${PARTIES_DU_ROBOT} parties de ${DUREE_PARTIE_ROBOT / TICKS_PAR_SECONDE} secondes, chacune avec sa graine fixée d'avance : les seuils sont valides, toujours les mêmes, et Diamant est le meilleur score`, () => {
    const a = analyserTable(c);
    expect(a.scores).toHaveLength(PARTIES_DU_ROBOT);
    expect(a.ticks.every((t) => t <= DUREE_PARTIE_ROBOT)).toBe(true);
    expect(new Set([...Array(PARTIES_DU_ROBOT).keys()].map(graineDuRobot)).size).toBe(PARTIES_DU_ROBOT);
    expect(seuilsValides(a.seuils)).toBe(true);
    expect(a.seuils).toEqual(seuilsDesScores(a.scores));
    expect(a.seuils.author).toBeGreaterThanOrEqual(Math.max(...a.scores) - 50);
    expect(seuilsDuRobot(c)).toEqual(a.seuils); // le calcul d'un trait, en mémoire par table, donne les mêmes
    expect(seuilsDuRobot({ ...c, jour: c.jour + 400 })).toEqual(a.seuils); // le verdict ne dépend que de la table, pas du jour
  }, 120_000); // lot PBG2 : quatre parties de six minutes (≈ 13 s), jouées deux fois

});
