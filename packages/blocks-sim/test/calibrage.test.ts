import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, PIECES_DU_DIAMANT, PLAFOND_PIECES } from "../src/index";
import { CALIBRATION } from "./aide";
import { jouerGlouton } from "../src/glouton";
import { jouerDiamant } from "../src/diamant";

// Les contrôles de bon sens du calibrage des médailles (lots B8b et B8c, seed § 5), sur un échantillon de jours (la mesure complète est sur 1 000 jours : `npm run calibrer:medailles`, README du lot B8c). **Il n'y a plus de cible de survie
// des bots** (lot B8b ; les cibles du lot B8 — le bot faible tient 40 séries, le moyen 80 à 150, le Diamant presque toujours jusqu'au plafond — pilotaient les poids du tirage et ont été retirées avec eux : elles ne sont pas affaiblies, elles
// n'ont plus d'objet). On vérifie ce qui reste : une première partie hésitante reste sous le bronze, et le tirage ne fait pas mourir le Diamant tout de suite.
const PREMIER = daysFromCivil(2026, 11, 2);
const mediane = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

describe("les contrôles de bon sens des médailles (tirage v6)", () => {
  it("le bot moyen à 24 pièces (une première partie hésitante) reste sous le bronze de la calibration, en médiane et presque tous les jours", () => {
    const scores = Array.from({ length: 200 }, (_, i) => jouerGlouton(dailyBlocks(PREMIER + i), 24).resultat.score);
    expect(mediane(scores)).toBeLessThan(CALIBRATION.bronze);
    expect(scores.filter((v) => v >= CALIBRATION.bronze).length / scores.length).toBeLessThan(0.1);
  });

  it("une partie finit toujours (lot B8c, seed § 3) : le Diamant joué sans arrêt ne touche jamais le plafond de 2 000 pièces, sa médiane de survie est de 150 à 350 pièces (200 jours), et son score est plus grand que celui qu'il a à son arrêt", () => {
    const parties = Array.from({ length: 200 }, (_, i) => {
      const c = dailyBlocks(PREMIER + i);
      return { entier: jouerDiamant(c).resultat, arrete: jouerDiamant(c, undefined, PIECES_DU_DIAMANT).resultat };
    });
    expect(parties.filter((p) => p.entier.poses >= PLAFOND_PIECES)).toHaveLength(0);
    const survie = mediane(parties.map((p) => p.entier.poses));
    expect(survie, `médiane de survie : ${survie} pièces`).toBeGreaterThanOrEqual(150);
    expect(survie, `médiane de survie : ${survie} pièces`).toBeLessThanOrEqual(350);
    for (const p of parties) expect(p.entier.score).toBeGreaterThanOrEqual(p.arrete.score);
    // Le score à l'arrêt est celui d'un humain qui tient longtemps : en médiane, il est du côté du Diamant de la calibration.
    expect(Math.abs(mediane(parties.map((p) => p.arrete.score)) - CALIBRATION.author) / CALIBRATION.author).toBeLessThanOrEqual(0.25);
  }, 180_000);
});
