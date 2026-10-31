import { describe, expect, it } from "vitest";
import { dailyTower, REGLES_THEMES, THEMES_TOWER, themeDuJour } from "../src";

// Lot T3 — les thèmes : le sac de thèmes COMMUN (`@cdj/core`, lot V1) tel quel, pour six thèmes.
const JOURS = Array.from({ length: 730 }, (_, i) => 20_000 + i);

describe("le sac de thèmes de Tower", () => {
  it("six thèmes, dont `port`, et un sac de six (assez pour la jonction des cycles : au moins cinq)", () => {
    expect(THEMES_TOWER).toEqual(["port", "chantier", "canyon", "banquise", "jungle", "nuit"]);
    expect(REGLES_THEMES.n).toBe(6);
    expect(REGLES_THEMES.n).toBeGreaterThanOrEqual(5);
  });

  it("jamais deux jours de suite le même thème, jamais A B A, sur deux ans", () => {
    const t = JOURS.map(themeDuJour);
    for (let i = 1; i < t.length; i++) expect(t[i], `jour ${JOURS[i]}`).not.toBe(t[i - 1]);
    for (let i = 2; i < t.length; i++) expect(t[i], `jour ${JOURS[i]}`).not.toBe(t[i - 2]);
  });

  it("chaque thème une fois par cycle de six jours alignés sur le numéro de jour", () => {
    for (let k = Math.floor(JOURS[0]! / 6) + 1; k < Math.floor(JOURS[0]! / 6) + 100; k++) {
      const cycle = Array.from({ length: 6 }, (_, i) => themeDuJour(k * 6 + i));
      expect(new Set(cycle).size, `cycle ${k}`).toBe(6);
    }
  });

  it("deux apparitions d'un même thème sont séparées de onze jours au plus (2n − 1)", () => {
    const dernier = new Map<string, number>();
    for (const j of JOURS) {
      const t = themeDuJour(j);
      if (dernier.has(t)) expect(j - dernier.get(t)!).toBeLessThanOrEqual(11);
      dernier.set(t, j);
    }
  });

  it("le contenu du jour (version 2) porte le thème du sac, et chaque thème sort", () => {
    for (const j of JOURS.slice(0, 60)) expect(dailyTower(j).theme).toBe(themeDuJour(j));
    expect(new Set(JOURS.map(themeDuJour))).toEqual(new Set(THEMES_TOWER));
  });
});
