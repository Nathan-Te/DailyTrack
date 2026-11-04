import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, empreinteContenu, estTheme, REGLES_THEMES, THEMES_BLOCKS, themeDuJour } from "../src/index";

// Lot B3 — les thèmes : le sac de thèmes COMMUN (`@cdj/core`, lot V1) pour les six thèmes de Tower.
const PREMIER = daysFromCivil(2026, 11, 2);
const JOURS = Array.from({ length: 400 }, (_, i) => PREMIER + i);

describe("le sac de thèmes de Blocks", () => {
  it("six thèmes, les mêmes que Tower dans le même ordre, et un sac de six (assez pour la jonction des cycles : au moins cinq)", () => {
    expect([...THEMES_BLOCKS]).toEqual(["port", "chantier", "canyon", "banquise", "jungle", "nuit"]);
    expect(REGLES_THEMES.n).toBe(6);
    expect(REGLES_THEMES.n).toBeGreaterThanOrEqual(5);
  });
  it("jamais deux jours de suite le même thème, et jamais A B A", () => {
    const t = JOURS.map(themeDuJour);
    for (let i = 1; i < t.length; i++) expect(t[i], `jour ${i}`).not.toBe(t[i - 1]);
    for (let i = 2; i < t.length; i++) expect(t[i], `jour ${i}`).not.toBe(t[i - 2]);
  });
  it("chaque thème sort une fois par cycle de six jours", () => {
    for (let k = Math.floor(PREMIER / 6); k < Math.floor(PREMIER / 6) + 40; k++) expect(new Set(Array.from({ length: 6 }, (_, i) => themeDuJour(k * 6 + i))).size).toBe(6);
  });
  it("le thème est pur : même jour, même thème ; il n'entre ni dans l'empreinte ni dans la suite", () => {
    expect(JOURS.map(themeDuJour)).toEqual(JOURS.map(themeDuJour));
    const c = dailyBlocks(PREMIER);
    expect(Object.keys(c)).not.toContain("theme");
    expect(empreinteContenu(c)).toBe(empreinteContenu(dailyBlocks(PREMIER)));
  });
  it("estTheme reconnaît les six, et rien d'autre", () => {
    for (const t of THEMES_BLOCKS) expect(estTheme(t)).toBe(true);
    for (const t of ["clair", "sombre", "", null, undefined, "Port"]) expect(estTheme(t)).toBe(false);
  });
});
