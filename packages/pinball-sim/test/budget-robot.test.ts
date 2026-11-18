import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { BUDGET_PAS_PAR_MILLE, BUDGET_PAS_TABLE, DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, dailyPinball, graineDuRobot, jouerRobot } from "../src/index";

// Lot PBR1 — **le budget du robot, en pas simulés** (jamais en secondes : le chiffre ne dépend pas de la machine). Le robot de Pinball coûtait de 14 à 18 secondes par table ; sa recherche « grossier puis fin », la grille des
// murs et la recopie des parties d'essai l'ont ramené à 3,4 secondes en moyenne et 4,6 au pire (`npm run mesure-robot:pinball`, README du lot PBR1). Ce test échoue si une table coûte plus que `BUDGET_PAS_TABLE` pas
// (la mesure du pire jour des 30 jours du 02/11/2026, plus 20 %) : un robot qui coûte plus cher retarde les médailles du jour. Les tests de 30 jours (`aide30.ts`) gardent le même plafond, rapporté aux pas joués, sur
// chacune des tables servies.
describe("le budget de pas du robot", () => {
  // la table la plus coûteuse des 30 jours (2026-11-27 : 8,64 millions de pas simulés pour les quatre parties)
  it(`les ${PARTIES_DU_ROBOT} parties de la table la plus coûteuse des 30 jours simulent au plus ${BUDGET_PAS_TABLE} pas pour décider`, () => {
    const c = dailyPinball(daysFromCivil(2026, 11, 27));
    let pas = 0;
    let joues = 0;
    for (let k = 0; k < PARTIES_DU_ROBOT; k++) {
      const r = jouerRobot(c, graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT });
      pas += r.pasSimules;
      joues += r.partie.tick;
    }
    expect(pas).toBeLessThanOrEqual(BUDGET_PAS_TABLE);
    expect((pas * 1000) / joues).toBeLessThanOrEqual(BUDGET_PAS_PAR_MILLE);
  }, 60_000);
});
