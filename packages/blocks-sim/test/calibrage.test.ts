import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, PLAFOND_PIECES, SEUILS_MEDAILLES } from "../src/index";
import { jouerGlouton } from "../src/glouton";
import { jouerDiamant } from "../src/diamant";

// Les contrôles de bon sens du calibrage des médailles (lot B8b, seed § 5), sur un échantillon de jours (la mesure complète est sur 1 000 jours : `npm run calibrer:medailles`, README du lot B8b). **Il n'y a plus de cible de survie
// des bots** (lot B8b ; les cibles du lot B8 — le bot faible tient 40 séries, le moyen 80 à 150, le Diamant presque toujours jusqu'au plafond — pilotaient les poids du tirage et ont été retirées avec eux : elles ne sont pas affaiblies, elles
// n'ont plus d'objet). On vérifie ce qui reste : une première partie hésitante reste sous le bronze, et le tirage ne fait pas mourir le Diamant tout de suite.
const PREMIER = daysFromCivil(2026, 11, 2);
const mediane = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

describe("les contrôles de bon sens des médailles (tirage v5)", () => {
  it("le bot moyen à 30 pièces (une première partie hésitante) reste sous le bronze, en médiane et presque tous les jours", () => {
    const scores = Array.from({ length: 200 }, (_, i) => jouerGlouton(dailyBlocks(PREMIER + i), 30).resultat.score);
    expect(mediane(scores)).toBeLessThan(SEUILS_MEDAILLES.bronze);
    expect(scores.filter((v) => v >= SEUILS_MEDAILLES.bronze).length / scores.length).toBeLessThan(0.1); // 0,9 % sur 1 000 jours
  });

  it("le Diamant joué sans arrêt ne touche presque jamais le plafond de pièces, et son score est plus grand que celui qu'il a à son arrêt", () => {
    const parties = Array.from({ length: 40 }, (_, i) => {
      const c = dailyBlocks(PREMIER + i);
      return { entier: jouerDiamant(c).resultat, arrete: jouerDiamant(c, undefined, 210).resultat };
    });
    expect(parties.filter((p) => p.entier.poses >= PLAFOND_PIECES).length / parties.length).toBeLessThan(0.05);
    for (const p of parties) expect(p.entier.score).toBeGreaterThanOrEqual(p.arrete.score);
    // Le score à l'arrêt est celui d'un humain qui tient longtemps : en médiane, il est du côté du Diamant.
    expect(Math.abs(mediane(parties.map((p) => p.arrete.score)) - SEUILS_MEDAILLES.author) / SEUILS_MEDAILLES.author).toBeLessThanOrEqual(0.25);
  }, 120_000);
});
