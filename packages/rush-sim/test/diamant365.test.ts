import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { DUREE_TICKS, dailyRush, diamantDuJour } from "../src/index";

// Lot BR4 — « un Diamant tous les jours » : sur 365 jours, au moins une des trois stratégies du pilote de référence gagne (sinon c'est un défaut du pilote ou du niveau, à corriger — pas à contourner). Un fichier à part : il joue
// 365 × 3 parties (≈ 5 min en tout, 6 tranches en parallèle) et tourne en parallèle des autres tests.
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
      // aucune partie du pilote de référence ne s'éternise : lot BR6, la run est plus longue — pas plus de 5 min 30 pour la meilleure des trois (la médiane est ~2 min 50)
      expect(meilleur.score, `jour ${k}`).toBeLessThan(330 * 60);
    }
  }, 400_000);
});

