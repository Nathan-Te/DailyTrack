import { describe, expect, it } from "vitest";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, TICK_RATE, UNITS_PER_TILE } from "../src/index";

describe("constantes", () => {
  it("valent ce que le seed demande", () => {
    expect(TICK_RATE).toBe(120);
    expect(UNITS_PER_TILE).toBe(16 * 256);
    expect(JUMP_SIM_VERSION).toBe(4); // lot 15 : horloge unique des niveaux du jour (v3 : lot 4, point de passage pris en franchissant sa colonne)
    expect([SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION]).toEqual([3, 4]);
    expect(JUMP_GENERATOR_VERSION).toBe(11); // lot 16 : seconde voie (voies lentes des portions 4–5, médailles or / bronze ajustées) ; lot 15 : horloge unique (niveaux en sim v4, phases calculées sur la référence, validation toutes phases) ; lot 13 : la forêt a ses courants d’air (morceaux, mutateur de vent, quota de signature) ; lot 12 : nuit (blocs clignotants) et néon (blocs alternés) ont leur mécanique, morceaux, mutateurs, quota de signature ; lot 11, retouche : jouable au clavier (appui minimal, catalogue re-résolu) ; lot 11 : le thème entre dans le générateur (tapis, glace, quota de signature) ; lot 8c : règle de jouabilité humaine (catalogue remesuré et adouci) ; lot 7b : respirations adoucies, tension jusqu’à la fin ; lot 7 : variété (mutateurs, familles, enchaînements longs, repos sur 7 groupes)
  });
});
