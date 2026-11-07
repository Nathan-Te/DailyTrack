import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { DUREE_TICKS, dailyRush, diamantDuJour } from "../src/index";

// Lot BR4 — « un Diamant tous les jours » : sur 365 jours, au moins une des trois stratégies du pilote de référence gagne (sinon c'est un défaut du pilote ou du niveau, à corriger — pas à contourner). Un fichier à part : il joue
// 365 × 3 parties (≈ 30 s) et tourne en parallèle des autres tests.
const J0 = daysFromCivil(2026, 11, 2);

describe("un Diamant tous les jours, sur 365 jours", () => {
  // 6 tranches : chacune joue ~61 jours × 3 stratégies (le pilote de référence) ; ensemble, 365 jours.
  const tranches = Array.from({ length: 6 }, (_, i) => [i * 61, Math.min(365, (i + 1) * 61)] as const);
  it.each(tranches)("jours %i à %i : au moins une stratégie gagne, le Diamant existe et est sous les dix minutes", (de, a) => {
    for (let k = de; k < a; k++) {
      const c = dailyRush(J0 + k);
      const d = diamantDuJour(c);
      const meilleur = d.parties[d.strategie];
      expect(meilleur.resultat.victoire, `jour ${k} (${formatDay(J0 + k)}) : aucune stratégie ne gagne`).toBe(true);
      expect(meilleur.score).toBeLessThan(DUREE_TICKS);
      // aucune partie du pilote de référence ne s'éternise : pas plus de 100 s pour la meilleure, jamais un blocage de 30 s de plus
      expect(meilleur.score, `jour ${k}`).toBeLessThan(100 * 60);
    }
  }, 120_000);
});

