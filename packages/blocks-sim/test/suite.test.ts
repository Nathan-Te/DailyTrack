import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { jouerFaible } from "../src/faible";
import { activerReglesV1 } from "../src/v1";
import { BLOCKS_GENERATOR_VERSION, BOITES33_PAR_SERIE, CASES_PIECE_GROSSE, dailyBlocks, DOMINOS_PAR_SERIE, empreinteContenu, estClassable, genererSuite, graineDuJour, NB_PIECES, PIECES, PLAFOND_PIECES, poidsDeSerie, RAMPE_PAR_DEFAUT, SERIES_SANS_TRES_GROSSE, serieAuRang, TAILLE_SERIE } from "../src/index";

const JOUR = daysFromCivil(2026, 11, 2);
activerReglesV1(); // seul le test du tirage v3 en a besoin
const GRAINES = Array.from({ length: 1000 }, (_, i) => graineDuJour(JOUR + i));
const serie = (suite: readonly number[], s: number): number[] => suite.slice(s * TAILLE_SERIE, (s + 1) * TAILLE_SERIE);

describe("la suite du jour : des séries de trois, variées (tirage v5, lots B8 et B8b)", () => {
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
        const w = poidsDeSerie(p, rang, []);
        expect(w).toBeGreaterThanOrEqual(avant);
        if (p.grosseur === 0) expect(w).toBe(p.poids * 100);
        else if (rang <= RAMPE_PAR_DEFAUT.rangMax) expect(w).toBeGreaterThan(poidsDeSerie(p, rang - 1, []));
        avant = w;
      }
      expect(poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax + 50, [])).toBe(poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax, []));
    }
  });

  it("le garde-fou des boîtes de 3 × 3 vaut 0 dès qu'une est déjà dans la série", () => {
    const carre3 = PIECES.find((p) => p.nom === "carre3-0")!;
    const grandL = PIECES.find((p) => p.nom === "grandl-0")!;
    expect(poidsDeSerie(carre3, 10, [])).toBeGreaterThan(0);
    expect(poidsDeSerie(carre3, 10, [grandL])).toBe(0);
    expect(poidsDeSerie(carre3, 0, [])).toBe(0); // très grosse, série 0
  });

  it("règles de série (lot B8b) sur 1 000 graines et 120 séries : au plus un domino, jamais deux fois la même pièce, au moins une pièce de 4 cases ou plus, au plus une boîte de 3 × 3", () => {
    let dominos = 0;
    let series = 0;
    for (const g of GRAINES) {
      const s = genererSuite(g, RAMPE_PAR_DEFAUT, 120 * TAILLE_SERIE);
      for (let r = 0; r < 120; r++) {
        const trio = serie(s, r).map((id) => PIECES[id]!);
        series++;
        const nd = trio.filter((p) => p.cases === 2).length;
        dominos += nd;
        expect(nd, `série ${r} : dominos`).toBeLessThanOrEqual(DOMINOS_PAR_SERIE);
        expect(new Set(trio.map((p) => p.id)).size, `série ${r} : doublon`).toBe(TAILLE_SERIE);
        expect(trio.some((p) => p.cases >= CASES_PIECE_GROSSE), `série ${r} : une pièce de ${CASES_PIECE_GROSSE} cases ou plus`).toBe(true);
        expect(trio.filter((p) => p.boite33).length, `série ${r} : boîtes de 3 × 3`).toBeLessThanOrEqual(BOITES33_PAR_SERIE);
      }
    }
    expect(dominos / (series * TAILLE_SERIE)).toBeLessThan(0.1); // les dominos restent rares (seed § 4 : moins de 10 % des pièces)
  });

  it("les règles de série sont dans le poids : un domino de plus, la même pièce ou une série sans pièce de 4 cases valent 0", () => {
    const domino = PIECES.find((p) => p.nom === "domino-0")!;
    const dominoDebout = PIECES.find((p) => p.nom === "domino-1")!;
    const barre3 = PIECES.find((p) => p.nom === "barre3-0")!;
    const coin = PIECES.find((p) => p.nom === "coin-0")!;
    const l = PIECES.find((p) => p.nom === "l-0")!;
    expect(poidsDeSerie(domino, 10, [barre3])).toBeGreaterThan(0);
    expect(poidsDeSerie(dominoDebout, 10, [domino])).toBe(0); // un seul domino, quelle que soit son orientation
    expect(poidsDeSerie(barre3, 10, [barre3])).toBe(0); // jamais deux fois la même pièce
    expect(poidsDeSerie(coin, 10, [barre3])).toBeGreaterThan(0);
    expect(poidsDeSerie(coin, 10, [barre3, domino])).toBe(0); // la dernière pièce d'une série sans pièce de 4 cases en est une
    expect(poidsDeSerie(l, 10, [barre3, domino])).toBeGreaterThan(0);
    expect(poidsDeSerie(coin, 10, [barre3, l])).toBeGreaterThan(0); // une pièce de 4 cases est déjà là
  });

  // La répartition (seed § 4), sur 1 000 jours : au début (séries 0 à 10) puis au plafond de la rampe (les 20 séries qui suivent `rangMax`). Les fourchettes sont celles du lot B8b ; la mesure entière est `npm run mesure:repartition`.
  const famille = (cases: number): number => (cases <= 2 ? 0 : cases === 3 ? 1 : cases === 4 ? 2 : 3);
  const repartition = (de: number, a: number): number[] => {
    const c = [0, 0, 0, 0];
    for (const g of GRAINES) {
      const s = genererSuite(g, RAMPE_PAR_DEFAUT, a * TAILLE_SERIE);
      for (let i = de * TAILLE_SERIE; i < a * TAILLE_SERIE; i++) c[famille(PIECES[s[i]!]!.cases)]!++;
    }
    const t = c.reduce((x, y) => x + y, 0);
    return c.map((x) => (100 * x) / t);
  };
  const FOURCHETTES = {
    debut: [[6, 9], [20, 25], [40, 50], [15, 22]],
    plafond: [[3, 6], [12, 18], [35, 45], [30, 40]],
  } as const;
  const NOMS = ["dominos", "pièces de 3 cases", "pièces de 4 cases", "pièces de 5 cases ou plus"] as const;
  it.each([["au début (séries 0 à 10)", 0, 11, "debut"], ["au plafond de la rampe (20 séries à partir de rangMax)", RAMPE_PAR_DEFAUT.rangMax, RAMPE_PAR_DEFAUT.rangMax + 20, "plafond"]] as const)("la répartition des pièces %s est dans les fourchettes du seed", (_nom, de, a, cle) => {
    const part = repartition(de, a);
    part.forEach((v, i) => {
      const [min, max] = FOURCHETTES[cle][i]!;
      expect(v, `${NOMS[i]} : ${v.toFixed(1)} %`).toBeGreaterThanOrEqual(min);
      expect(v, `${NOMS[i]} : ${v.toFixed(1)} %`).toBeLessThanOrEqual(max);
    });
  });

  it("la rampe fait monter la part des pièces de 5 cases ou plus avec la série et baisser celle des dominos et des pièces de 3 cases", () => {
    const debut = repartition(0, 11);
    const plafond = repartition(RAMPE_PAR_DEFAUT.rangMax, RAMPE_PAR_DEFAUT.rangMax + 20);
    expect(plafond[3]!).toBeGreaterThan(debut[3]!);
    expect(plafond[0]!).toBeLessThan(debut[0]!);
    expect(plafond[1]!).toBeLessThan(debut[1]!);
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

  it("le tirage v3 (règles v1) se relit encore pour un jour figé, et diffère du v5", () => {
    const v3 = dailyBlocks(JOUR, 3);
    expect(v3.g).toBe(3);
    expect(v3.suite).toHaveLength(PLAFOND_PIECES);
    expect(v3.suite).not.toEqual(dailyBlocks(JOUR).suite);
    expect(() => dailyBlocks(JOUR, 2)).toThrow(/version de tirage inconnue/);
  });
});
