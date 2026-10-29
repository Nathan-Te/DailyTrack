import { describe, expect, it } from "vitest";
import { ALT_KEPT_VERSION, BRIDGE_VERSION, JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, LASER_VERSION, MUSHROOM_VERSION, PLATFORM_VERSION, PRESS_VERSION, RESTART_VERSION, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, STALACTITE_VERSION, TICK_RATE, UNITS_PER_TILE } from "../src/index";

describe("constantes", () => {
  it("valent ce que le seed demande", () => {
    expect(TICK_RATE).toBe(120);
    expect(UNITS_PER_TILE).toBe(16 * 256);
    expect(JUMP_SIM_VERSION).toBe(12); // lot 28 : les blocs alternés gardent leur état à la reprise (v11 : lot 27 : un nouvel essai à zéro avant le premier point de passage, reprise volontaire (v10 : lot 26 : ponts à interrupteur (v9 : lot 25, lasers ; v8 : lot 24, stalactites ; v7 : lot 23, champignons rebonds ; v6 : lot 22, presses ; v5 : lot 20, plateformes mobiles (v4 : lot 15, horloge unique des niveaux du jour ; v3 : lot 4, point de passage pris en franchissant sa colonne)
    expect(PLATFORM_VERSION).toBe(5);
    expect(PRESS_VERSION).toBe(6);
    expect(MUSHROOM_VERSION).toBe(7);
    expect(STALACTITE_VERSION).toBe(8);
    expect(LASER_VERSION).toBe(9);
    expect(BRIDGE_VERSION).toBe(10);
    expect(RESTART_VERSION).toBe(11);
    expect(ALT_KEPT_VERSION).toBe(12);
    expect([SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION]).toEqual([3, 4]);
    expect(JUMP_GENERATOR_VERSION).toBe(23); // lot V1 : le sac de thèmes (la physique, les morceaux et la simulation ne changent pas : g23, sim v12) ; lot 28 : niveaux en sim v12 (les blocs alternés gardent leur état à la reprise ; chaque variante à alternés se reprend aussi depuis l'état B ; alternés dans le néon seulement) ; lot 27 : niveaux en sim v11 (nouvel essai à zéro, reprise volontaire), forêt à vent continu ; lot 26 : ponts à interrupteur (niveaux en sim v10, 7 morceaux de la nuit à ponts, règles du générateur, équilibre des mécaniques de chaque thème) ; lot 25 : lasers (niveaux en sim v9, 7 morceaux du néon à lasers, règles du générateur, W = 4) ; lot 24 : stalactites (niveaux en sim v8, 6 morceaux de la glace à stalactites, règles du générateur) ; lot 23 : champignons (niveaux en sim v7, 7 morceaux de la forêt à champignons, règles du générateur) ; lot 22 : presses (niveaux en sim v6, 7 morceaux de l'usine à presses, règles du générateur) ; lot 20 : plateformes mobiles (niveaux en sim v5, 7 morceaux à plateformes, règles de trajet, jours figés lus dans les fichiers) ; lot 19 : variété (un morceau de base ne revient pas avant 3 jours, époques bornées), tirages prouvés dans l'ordre du score estimé, mutateurs de silhouette et 37 variantes ajoutées ; lot 18 : chaque phase d'un bloc clignotant dure au moins 1,5 s (variantes de nuit refusées et remplacées) ; lot 17 : attente maximale de 12 s sur le palier (validation toutes phases), trois variantes corrigées et réadmises ; lot 16 : seconde voie (voies lentes des portions 4–5, médailles or / bronze ajustées) ; lot 15 : horloge unique (niveaux en sim v4, phases calculées sur la référence, validation toutes phases) ; lot 13 : la forêt a ses courants d’air (morceaux, mutateur de vent, quota de signature) ; lot 12 : nuit (blocs clignotants) et néon (blocs alternés) ont leur mécanique, morceaux, mutateurs, quota de signature ; lot 11, retouche : jouable au clavier (appui minimal, catalogue re-résolu) ; lot 11 : le thème entre dans le générateur (tapis, glace, quota de signature) ; lot 8c : règle de jouabilité humaine (catalogue remesuré et adouci) ; lot 7b : respirations adoucies, tension jusqu’à la fin ; lot 7 : variété (mutateurs, familles, enchaînements longs, repos sur 7 groupes)
  });
});
