import { describe, expect, it } from "vitest";
import { FENETRE_MIN_MS, THEMES_PINBALL, dailyPinball, tirsDeConception } from "../src/index";

// Lot PBT0 — la fenêtre de tir humaine du lot PBL2 (au moins 30 ms depuis un grand batteur) de **chaque tir** du plan t6, dans les deux sens et les quatre thèmes : une simulation par table (≈ 1 s). Un fichier par plan
// pour que chacun ait son délai et que la CI en répartisse la charge ; `conception.test.ts` garde le reste, sans simulation.
describe("t6 : chaque tir est visable", () => {
  for (const id of ["t6", "t6m"]) {
    it.each(THEMES_PINBALL)(`${id}, %s : mission, verrou, rails, porte et banques à ${FENETRE_MIN_MS} ms au moins`, (theme) => {
      const r = tirsDeConception(dailyPinball(0, undefined, theme, id));
      expect(r.manquants, JSON.stringify(r.ms)).toEqual([]);
    });
  }
});
