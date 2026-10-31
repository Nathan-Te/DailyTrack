import { PROFONDEUR_VISIBLE_MM } from "@cdj/tower-sim/bot";
import { describe, expect, it } from "vitest";
import { etendueVisible, MARGE_HAUT, VUE_COURTE } from "../src/scene";

// Lot T3 — le bot ne pose une pièce que là où un joueur la voit (règle de la zone visible, `docs/tower/consignes.md`). La simulation ne lit pas le jeu : la profondeur qu'elle écrit
// (`PROFONDEUR_VISIBLE_MM`) doit rester celle de la caméra, la plus petite (paysage).
describe("la zone visible du bot est celle de la caméra", () => {
  it("6,5 m sous le sommet de la tour en paysage : VUE_COURTE − MARGE_HAUT", () => {
    expect(PROFONDEUR_VISIBLE_MM).toBe(Math.round((VUE_COURTE - MARGE_HAUT) * 1000));
  });
  it("le portrait voit plus bas : la zone du bot n'est jamais plus large que ce qu'un joueur voit, quel que soit l'écran", () => {
    for (const [l, h] of [[844, 390], [1920, 1080], [390, 844], [1080, 1920], [600, 600]] as const) {
      const { H } = etendueVisible(l, h);
      expect((H - MARGE_HAUT) * 1000).toBeGreaterThanOrEqual(PROFONDEUR_VISIBLE_MM);
    }
  });
});
