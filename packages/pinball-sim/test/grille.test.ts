import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import { RAYON, UNITE } from "../src/constantes";
import { REGLAGES } from "../src/reglages";
import { COLONNES, LIGNES, MARGE_GRILLE, caseDe, construireTable } from "../src/table";
import { dailyPinball } from "../src/index";
import { PREMIER_JOUR } from "./aide30";

// Lot PBR1 — la grille des murs : les mêmes collisions dans le même ordre, sans essayer les 70 murs à chaque pas. Elle ne change rien à la simulation (le golden et les 120 parties du robot de 30 jours la prouvent) ;
// ce test garde sa propriété : une bille qui se trouve dans une case, même poussée de plusieurs pixels par un mur avant d'essayer le suivant, n'a jamais besoin d'un mur que sa case n'a pas.
const RU = RAYON * UNITE;

describe("la grille des murs", () => {
  it("range les cases dans les bornes, sans les cibles (jouées par leur banque), dans l'ordre des murs", () => {
    expect(caseDe(-5 * UNITE, -5 * UNITE)).toBe(0);
    expect(caseDe(10_000 * UNITE, 10_000 * UNITE)).toBe(COLONNES * LIGNES - 1);
    const c = dailyPinball(PREMIER_JOUR + 4);
    const t = construireTable(c, REGLAGES);
    expect(t.grille).toHaveLength(COLONNES * LIGNES);
    for (const mursDeLaCase of t.grille) {
      expect(mursDeLaCase.every((s) => s.type !== 2)).toBe(true);
      const rangs = mursDeLaCase.map((s) => t.murs.indexOf(s));
      expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
    }
  });
  it("un mur dont la boîte (élargie du rayon de la bille) contient une position à 30 px d'une bille rangée dans une case est dans la liste de cette case", () => {
    const rng = new Rng(7);
    let controles = 0;
    for (let jour = 0; jour < 12; jour++) {
      const t = construireTable(dailyPinball(PREMIER_JOUR + jour), REGLAGES);
      for (let k = 0; k < 4000; k++) {
        // une bille n'importe où sur la table (et un peu au-delà), et la position où un mur la repousserait : à 30 px au plus de là
        const x = rng.int(420 * UNITE) - 20 * UNITE;
        const y = rng.int(800 * UNITE) - 20 * UNITE;
        const qx = x + rng.int(2 * (MARGE_GRILLE - 2 * UNITE) + 1) - (MARGE_GRILLE - 2 * UNITE);
        const qy = y + rng.int(2 * (MARGE_GRILLE - 2 * UNITE) + 1) - (MARGE_GRILLE - 2 * UNITE);
        const liste = t.grille[caseDe(x, y)]!;
        for (const s of t.murs) {
          if (s.type === 2) continue;
          if (qx < s.x0 - RU || qx > s.x1 + RU || qy < s.y0 - RU || qy > s.y1 + RU) continue;
          expect(liste, `mur (${s.ax},${s.ay})-(${s.bx},${s.by}) manquant pour une bille en (${x},${y})`).toContain(s);
          controles++;
        }
      }
    }
    expect(controles).toBeGreaterThan(1000);
  });
});
