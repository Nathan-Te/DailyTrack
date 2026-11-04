import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { jouerGlouton } from "../src/glouton";
import { dailyBlocks, empreinteContenu, genererSuite, graineDuJour, NB_PIECES, PIECES, PLAFOND_PIECES, poidsAuRang, RAMPE_PAR_DEFAUT, RANGS_SANS_TRES_GROSSE, estClassable } from "../src/index";

const JOUR = daysFromCivil(2026, 11, 2);
const GRAINES = Array.from({ length: 1000 }, (_, i) => graineDuJour(JOUR + i));

describe("la suite du jour", () => {
  it("déterministe : même jour, même suite ; jours différents, suites différentes ; PLAFOND_PIECES pièces", () => {
    const a = dailyBlocks(JOUR);
    expect(a.suite).toHaveLength(PLAFOND_PIECES);
    expect(dailyBlocks(JOUR)).toEqual(a);
    expect(empreinteContenu(dailyBlocks(JOUR))).toBe(empreinteContenu(a));
    expect(empreinteContenu(dailyBlocks(JOUR + 1))).not.toBe(empreinteContenu(a));
    expect(a.suite.every((id) => id >= 0 && id < NB_PIECES)).toBe(true);
    expect(estClassable(a)).toBe(true);
  });

  it("la pièce de rang i ne dépend que de la graine et de i : un préfixe de la suite est le début de la suite entière", () => {
    const g = graineDuJour(JOUR);
    expect(genererSuite(g, RAMPE_PAR_DEFAUT, 60)).toEqual(dailyBlocks(JOUR).suite.slice(0, 60));
  });

  it("garde-fous sur 1 000 graines : aucune très grosse pièce parmi les 6 premières, jamais deux 3 × 3 de suite", () => {
    for (const g of GRAINES) {
      const s = genererSuite(g, RAMPE_PAR_DEFAUT, 300);
      for (let i = 0; i < RANGS_SANS_TRES_GROSSE; i++) expect(PIECES[s[i]!]!.tresGrosse, `rang ${i}`).toBe(false);
      for (let i = 1; i < s.length; i++) if (PIECES[s[i]!]!.boite33) expect(PIECES[s[i - 1]!]!.boite33, `rang ${i}`).toBe(false);
    }
  });

  it("la rampe : le poids des grosses pièces augmente de façon monotone avec le rang (et s'arrête à rangMax) ; celui des petites ne bouge pas", () => {
    for (const p of PIECES) {
      let avant = -1;
      for (let rang = RANGS_SANS_TRES_GROSSE; rang < 300; rang++) {
        const w = poidsAuRang(p, rang, null);
        expect(w).toBeGreaterThanOrEqual(avant);
        if (p.grosseur === 0) expect(w).toBe(p.poids * 100);
        else if (rang < RAMPE_PAR_DEFAUT.rangMax) expect(w).toBeGreaterThan(poidsAuRang(p, rang - 1, null));
        avant = w;
      }
      expect(poidsAuRang(p, RAMPE_PAR_DEFAUT.rangMax + 50, null)).toBe(poidsAuRang(p, RAMPE_PAR_DEFAUT.rangMax, null));
    }
  });

  it("sur 1 000 graines, la part des grosses pièces (5 cases ou plus) est plus grande plus loin dans la suite", () => {
    const part = (de: number, a: number): number => {
      let grosses = 0;
      let total = 0;
      for (const g of GRAINES) {
        const s = genererSuite(g, RAMPE_PAR_DEFAUT, a);
        for (let i = de; i < a; i++) {
          total++;
          if (PIECES[s[i]!]!.grosseur >= 2) grosses++;
        }
      }
      return grosses / total;
    };
    const debut = part(6, 30);
    const milieu = part(30, 80);
    const fin = part(100, 140);
    expect(milieu).toBeGreaterThan(debut);
    expect(fin).toBeGreaterThan(milieu);
  });

  it("une rampe réglée donne un contenu « réglé » (jamais classé) ; la rampe du jeu non", () => {
    expect(estClassable(dailyBlocks(JOUR, 1, { ...RAMPE_PAR_DEFAUT }))).toBe(true);
    const c = dailyBlocks(JOUR, 1, { pente: 0, rangMax: 10 });
    expect(estClassable(c)).toBe(false);
    expect(c.suite).not.toEqual(dailyBlocks(JOUR).suite);
  });

  it("la rampe rend les parties plus courtes : la médiane du glouton simple (200 jours) est plus petite avec la rampe du jeu que sans", () => {
    const mediane = (pente: number): number => {
      const n = Array.from({ length: 200 }, (_, i) => jouerGlouton(dailyBlocks(JOUR + i, 1, { pente, rangMax: RAMPE_PAR_DEFAUT.rangMax })).resultat.poses).sort((a, b) => a - b);
      return n[100]!;
    };
    expect(mediane(RAMPE_PAR_DEFAUT.pente)).toBeLessThan(mediane(0));
  });
});
