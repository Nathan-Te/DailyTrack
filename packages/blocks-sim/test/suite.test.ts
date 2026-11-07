import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { jouerFaible } from "../src/faible";
import { activerReglesV1 } from "../src/v1";
import { BLOCKS_GENERATOR_VERSION, BOITES33_PAR_SERIE, dailyBlocks, empreinteContenu, estClassable, genererSuite, graineDuJour, NB_PIECES, PIECES, PLAFOND_PIECES, poidsDeSerie, RAMPE_PAR_DEFAUT, SERIES_SANS_TRES_GROSSE, serieAuRang, TAILLE_SERIE } from "../src/index";

const JOUR = daysFromCivil(2026, 11, 2);
activerReglesV1(); // seul le test du tirage v3 en a besoin
const GRAINES = Array.from({ length: 1000 }, (_, i) => graineDuJour(JOUR + i));
const serie = (suite: readonly number[], s: number): number[] => suite.slice(s * TAILLE_SERIE, (s + 1) * TAILLE_SERIE);

describe("la suite du jour : des séries de trois (tirage v4, lot B8)", () => {
  it("déterministe : même jour, même suite ; jours différents, suites différentes ; PLAFOND_PIECES pièces", () => {
    const a = dailyBlocks(JOUR);
    expect(a.g).toBe(BLOCKS_GENERATOR_VERSION);
    expect(a.suite).toHaveLength(PLAFOND_PIECES);
    expect(dailyBlocks(JOUR)).toEqual(a);
    expect(empreinteContenu(dailyBlocks(JOUR))).toBe(empreinteContenu(a));
    expect(empreinteContenu(dailyBlocks(JOUR + 1))).not.toBe(empreinteContenu(a));
    expect(a.suite.every((id) => id >= 0 && id < NB_PIECES)).toBe(true);
    expect(estClassable(a)).toBe(true);
  });

  it("la série de rang s ne dépend que de la graine et de s — jamais de la grille : serieAuRang est la tranche de la suite entière", () => {
    const g = graineDuJour(JOUR);
    const suite = dailyBlocks(JOUR).suite;
    for (const s of [0, 1, 2, 7, 50, 200, 665]) expect(serieAuRang(g, s).map((p) => p.id), `série ${s}`).toEqual(serie(suite, s));
    // Un préfixe de la suite est le début de la suite entière ; la dernière série n'a que deux pièces (le plafond est 2 000).
    expect(genererSuite(g, RAMPE_PAR_DEFAUT, 60)).toEqual(suite.slice(0, 60));
    expect(serieAuRang(g, 666)).toHaveLength(2);
    expect(serieAuRang(g, 667)).toHaveLength(0);
  });

  it("garde-fous sur 1 000 graines : au plus une pièce à boîte 3 × 3 par série, aucune très grosse pièce dans les deux premières séries", () => {
    let avecUne = 0;
    for (const g of GRAINES) {
      const s = genererSuite(g, RAMPE_PAR_DEFAUT, 600);
      for (let r = 0; r < s.length / TAILLE_SERIE; r++) {
        const trio = serie(s, r).map((id) => PIECES[id]!);
        const boites = trio.filter((p) => p.boite33).length;
        expect(boites, `série ${r}`).toBeLessThanOrEqual(BOITES33_PAR_SERIE);
        if (boites > 0) avecUne++;
        if (r < SERIES_SANS_TRES_GROSSE) for (const p of trio) expect(p.tresGrosse, `série ${r}`).toBe(false);
      }
    }
    expect(avecUne).toBeGreaterThan(0); // le garde-fou limite sans interdire
  });

  it("aucune pièce de 1 case, et le grand T sort (jamais dans les deux premières séries)", () => {
    expect(PIECES.some((p) => p.cases === 1)).toBe(false);
    let grandsT = 0;
    for (const g of GRAINES.slice(0, 300)) {
      const s = genererSuite(g, RAMPE_PAR_DEFAUT, 600);
      s.forEach((id, i) => {
        if (PIECES[id]!.nom.startsWith("grandt")) {
          grandsT++;
          expect(Math.floor(i / TAILLE_SERIE)).toBeGreaterThanOrEqual(SERIES_SANS_TRES_GROSSE);
        }
      });
    }
    expect(grandsT).toBeGreaterThan(0);
  });

  it("la rampe s'applique au RANG DE LA SÉRIE : le poids des grosses pièces monte de façon monotone avec la série (et s'arrête à rangMax) ; celui des petites ne bouge pas", () => {
    for (const p of PIECES) {
      let avant = -1;
      for (let rang = SERIES_SANS_TRES_GROSSE; rang < 600; rang++) {
        const w = poidsDeSerie(p, rang, 0);
        expect(w).toBeGreaterThanOrEqual(avant);
        if (p.grosseur === 0) expect(w).toBe(p.poids * 100);
        else if (rang <= RAMPE_PAR_DEFAUT.rangMax) expect(w).toBeGreaterThan(poidsDeSerie(p, rang - 1, 0));
        avant = w;
      }
      expect(poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax + 50, 0)).toBe(poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax, 0));
    }
  });

  it("le garde-fou des boîtes de 3 × 3 vaut 0 dès qu'une est déjà dans la série", () => {
    const carre3 = PIECES.find((p) => p.nom === "carre3-0")!;
    expect(poidsDeSerie(carre3, 10, 0)).toBeGreaterThan(0);
    expect(poidsDeSerie(carre3, 10, 1)).toBe(0);
    expect(poidsDeSerie(carre3, 0, 0)).toBe(0); // très grosse, série 0
  });

  it("sur 1 000 graines, la part des grosses pièces (5 cases ou plus) est plus grande plus loin dans la suite", () => {
    const part = (de: number, a: number): number => {
      let grosses = 0;
      let total = 0;
      for (const g of GRAINES) {
        const s = genererSuite(g, RAMPE_PAR_DEFAUT, a * TAILLE_SERIE);
        for (let i = de * TAILLE_SERIE; i < a * TAILLE_SERIE; i++) {
          total++;
          if (PIECES[s[i]!]!.grosseur >= 2) grosses++;
        }
      }
      return grosses / total;
    };
    const debut = part(3, 30);
    const milieu = part(60, 120);
    const fin = part(300, 400);
    expect(milieu).toBeGreaterThan(debut);
    expect(fin).toBeGreaterThan(milieu);
    expect(debut).toBeLessThan(0.1); // au début, presque tout est petit
  });

  it("une rampe réglée donne un contenu « réglé » (jamais classé) ; la rampe du jeu non", () => {
    expect(estClassable(dailyBlocks(JOUR, BLOCKS_GENERATOR_VERSION, { ...RAMPE_PAR_DEFAUT }))).toBe(true);
    const c = dailyBlocks(JOUR, BLOCKS_GENERATOR_VERSION, { pente: 0, rangMax: 10 });
    expect(estClassable(c)).toBe(false);
    expect(c.suite).not.toEqual(dailyBlocks(JOUR).suite);
  });

  it("la rampe rend les parties plus courtes : la médiane du bot faible (100 jours) est plus petite avec la rampe du jeu que sans", () => {
    const mediane = (pente: number): number => {
      const n = Array.from({ length: 100 }, (_, i) => jouerFaible(dailyBlocks(JOUR + i, BLOCKS_GENERATOR_VERSION, { pente, rangMax: RAMPE_PAR_DEFAUT.rangMax })).resultat.poses).sort((a, b) => a - b);
      return n[50]!;
    };
    expect(mediane(RAMPE_PAR_DEFAUT.pente)).toBeLessThan(mediane(0));
  });

  it("le tirage v3 (règles v1) se relit encore pour un jour figé, et diffère du v4", () => {
    const v3 = dailyBlocks(JOUR, 3);
    expect(v3.g).toBe(3);
    expect(v3.suite).toHaveLength(PLAFOND_PIECES);
    expect(v3.suite).not.toEqual(dailyBlocks(JOUR).suite);
    expect(() => dailyBlocks(JOUR, 2)).toThrow(/version de tirage inconnue/);
  });
});
