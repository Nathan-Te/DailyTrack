import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { BUDGET_PAS_PAR_MILLE, BUDGET_PAS_TABLE, DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, dailyPinball, graineDuRobot, jouerRobot } from "../src/index";

// Lot PBR1 — **le budget du robot, en pas simulés** (jamais en secondes : le chiffre ne dépend pas de la machine). Le robot de Pinball coûtait de 14 à 18 secondes par table ; sa recherche « grossier puis fin », la grille des
// murs et la recopie des parties d'essai l'ont ramené à 3,4 secondes en moyenne et 4,6 au pire (`npm run mesure-robot:pinball`, README du lot PBR1). Ce test échoue si une table coûte plus que `BUDGET_PAS_TABLE` pas
// (la mesure de la pire table, plus 20 % ; lot PBT1 : celle des 24 tables dessinées) : un robot qui coûte plus cher retarde les médailles du jour. Les tests de 30 jours (`aide30.ts`) gardent le même plafond, rapporté aux pas joués, sur
// chacune des tables servies.
describe("le budget de pas du robot", () => {
  // lot PBT1 : la table la plus coûteuse des 24 tables dessinées (l'Espace, table C en miroir : 8,39 millions de pas simulés pour les quatre parties, 10,07 pour 1 000 pas joués ; la pire des 24 pour 1 000 : 10,62) — contre 8,64 millions à la
  // mesure du lot PBR1 (la table du 27/11/2026, tirée au hasard) : le budget (10,4 millions, 13,5 pour 1 000) tient avec une marge de 19 % et de 21 %
  it(`les ${PARTIES_DU_ROBOT} parties de la table la plus coûteuse des 24 tables dessinées simulent au plus ${BUDGET_PAS_TABLE} pas pour décider`, () => {
    const c = dailyPinball(daysFromCivil(2026, 11, 27), undefined, "espace", "C", true);
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
