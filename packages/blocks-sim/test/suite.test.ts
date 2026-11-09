import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";
import { activerReglesV1 } from "../src/v1";
import {
  BLOCKS_GENERATOR_VERSION,
  BOITES33_PAR_SERIE,
  CASES_PIECE_GROSSE,
  completeUneLigne,
  dailyBlocks,
  DOMINOS_PAR_SERIE,
  empreinteContenu,
  estClassable,
  grilleDepuis,
  graineDuJour,
  NB_PIECES,
  partPosable,
  partPouce,
  Partie,
  PIECES,
  piecesPosables,
  PLAFOND_PIECES,
  poidsDeSerie,
  RAMPE_PAR_DEFAUT,
  REGLAGE_PAR_DEFAUT,
  reglageEstCeluiDuJeu,
  resoudreReglage,
  serieAuRang,
  serieCandidate,
  SERIES_SANS_TRES_GROSSE,
  TAILLE_SERIE,
  tirerSerie,
  VIDE,
} from "../src/index";
import { seriesVues } from "./aide";

const JOUR = daysFromCivil(2026, 11, 2);
activerReglesV1(); // seul le test du tirage v3 en a besoin
const GRAINES = Array.from({ length: 1000 }, (_, i) => graineDuJour(JOUR + i));
const pieceDe = (nom: string) => PIECES.find((p) => p.nom === nom)!;

// Lot B8c — les parties de 1 000 jours jouées par le bot moyen, gardées pour plusieurs tests (la partie entière de chaque jour, série par série).
const parties = (() => {
  let gardees: { contenu: ReturnType<typeof dailyBlocks>; actions: number[]; series: ReturnType<typeof seriesVues> }[] | null = null;
  return () => {
    if (gardees === null) {
      gardees = Array.from({ length: 1000 }, (_, i) => {
        const contenu = dailyBlocks(JOUR + i);
        const { actions } = jouerGlouton(contenu);
        return { contenu, actions, series: seriesVues(contenu, actions) };
      });
    }
    return gardees;
  };
})();

describe("le tirage du jour, adapté à la grille (tirage v6, lot B8c ; règles de série du lot B8b)", () => {
  it("déterministe : même jour, même contenu ; jours différents, graines et empreintes différentes ; il n'y a plus de suite fixe", () => {
    const a = dailyBlocks(JOUR);
    expect(a.g).toBe(BLOCKS_GENERATOR_VERSION);
    expect(a.suite).toBeUndefined();
    expect(a.graine).toBe(graineDuJour(JOUR));
    expect(dailyBlocks(JOUR)).toEqual(a);
    expect(empreinteContenu(dailyBlocks(JOUR))).toBe(empreinteContenu(a));
    expect(empreinteContenu(dailyBlocks(JOUR + 1))).not.toBe(empreinteContenu(a));
    expect(estClassable(a)).toBe(true);
  });

  it("mêmes coups, mêmes pièces : deux parties qui jouent les mêmes actions voient exactement les mêmes séries ; la rediffusion d'un bot rejoue ses séries", () => {
    for (const j of [JOUR, JOUR + 5, JOUR + 11]) {
      const c = dailyBlocks(j);
      const { actions } = jouerGlouton(c);
      const a = seriesVues(c, actions);
      const b = seriesVues(dailyBlocks(j), actions);
      expect(b.map((s) => s.pieces.map((p) => p.id))).toEqual(a.map((s) => s.pieces.map((p) => p.id)));
      expect(a.length).toBeGreaterThan(5);
    }
  });

  it("la série dépend de la grille : le même rang, la même graine, une autre grille, d'autres pièces ; la première série est la même pour tous (grille vide)", () => {
    const g = graineDuJour(JOUR);
    // La première série : celle d'une partie qui commence, quoi qu'on fasse ensuite.
    const premiere = serieAuRang(g, 0, VIDE).map((p) => p.id);
    expect(new Partie(dailyBlocks(JOUR)).pieces.map((p) => p!.id)).toEqual(premiere);
    expect(premiere).toHaveLength(TAILLE_SERIE);
    // Deux grilles différentes au rang 20 : les séries diffèrent (pour au moins une des graines essayées).
    const pleine = grilleDepuis(["XXXXXXX.", "XXXXXXX.", "XXXXXXX.", "XXXXXXX.", "........", "........", "........", "........"]);
    const eparse = grilleDepuis(["X.X.X.X.", ".X.X.X.X", "........", "........", "........", "........", "........", "........"]);
    let differe = 0;
    for (const gr of GRAINES.slice(0, 50)) if (serieAuRang(gr, 20, pleine).map((p) => p.id).join() !== serieAuRang(gr, 20, eparse).map((p) => p.id).join()) differe++;
    expect(differe).toBeGreaterThan(10);
    // Le tirage est pur : la même question, la même réponse.
    expect(serieAuRang(g, 20, pleine).map((p) => p.id)).toEqual(serieAuRang(g, 20, pleine).map((p) => p.id));
  });

  it("le générateur de l'essai k est tiré de (graine, rang, k) et de rien d'autre : les candidates sont les mêmes quelle que soit la grille ; elles diffèrent d'un essai à l'autre", () => {
    const g = graineDuJour(JOUR);
    for (const rang of [0, 3, 30]) {
      const c0 = serieCandidate(g, rang, 0).map((p) => p.id);
      expect(serieCandidate(g, rang, 0).map((p) => p.id)).toEqual(c0);
      const autres = Array.from({ length: 10 }, (_, k) => serieCandidate(g, rang, k + 1).map((p) => p.id).join());
      expect(new Set([c0.join(), ...autres]).size).toBeGreaterThan(5);
    }
    // Plafond : la dernière série n'a que deux pièces, la suivante aucune.
    expect(serieAuRang(g, 666, VIDE)).toHaveLength(2);
    expect(serieAuRang(g, 667, VIDE)).toHaveLength(0);
  });

  it("garde-fous sur 1 000 parties du bot moyen : au plus une pièce à boîte 3 × 3 par série, aucune très grosse pièce dans les deux premières séries", () => {
    let avecUne = 0;
    for (const { series } of parties()) {
      for (const s of series) {
        const boites = s.pieces.filter((p) => p.boite33).length;
        expect(boites, `série ${s.rang}`).toBeLessThanOrEqual(BOITES33_PAR_SERIE);
        if (boites > 0) avecUne++;
        if (s.rang < SERIES_SANS_TRES_GROSSE) for (const p of s.pieces) expect(p.tresGrosse, `série ${s.rang}`).toBe(false);
      }
    }
    expect(avecUne).toBeGreaterThan(0); // le garde-fou limite sans interdire
  }, 120000);

  it("aucune pièce de 1 case, et le grand T sort (jamais dans les deux premières séries)", () => {
    expect(PIECES.some((p) => p.cases === 1)).toBe(false);
    let grandsT = 0;
    for (const { series } of parties().slice(0, 300)) {
      for (const s of series) {
        for (const p of s.pieces) {
          if (p.nom.startsWith("grandt")) {
            grandsT++;
            expect(s.rang).toBeGreaterThanOrEqual(SERIES_SANS_TRES_GROSSE);
          }
        }
      }
    }
    expect(grandsT).toBeGreaterThan(0);
  }, 120000);

  it("la rampe s'applique au RANG DE LA SÉRIE : le poids des grosses pièces monte avec la série (pente pleine jusqu'à rangMax, pente `apres` ensuite, jamais de baisse) ; celui des petites ne bouge pas", () => {
    for (const p of PIECES) {
      let avant = -1;
      for (let rang = SERIES_SANS_TRES_GROSSE; rang < 600; rang++) {
        const w = poidsDeSerie(p, rang, []);
        expect(w).toBeGreaterThanOrEqual(avant);
        if (p.grosseur === 0) expect(w).toBe(p.poids * 100);
        else expect(w).toBeGreaterThan(poidsDeSerie(p, rang - 1, [])); // monte à chaque rang, avant comme après rangMax
        avant = w;
      }
      // La pente d'après rangMax est plus douce que celle d'avant.
      const avantMax = poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax, []) - poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax - 10, []);
      const apresMax = poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax + 10, []) - poidsDeSerie(p, RAMPE_PAR_DEFAUT.rangMax, []);
      if (p.grosseur > 0) expect(apresMax).toBeLessThan(avantMax);
    }
    // Sans `apres`, la rampe s'arrête bien à rangMax (c'était la rampe du lot B8b) : un réglage possible de `?debug&tune`.
    const plate = { pente: 1, rangMax: 80 };
    for (const p of PIECES) expect(poidsDeSerie(p, 130, [], plate)).toBe(poidsDeSerie(p, 80, [], plate));
  });

  it("le garde-fou des boîtes de 3 × 3 vaut 0 dès qu'une est déjà dans la série", () => {
    const carre3 = PIECES.find((p) => p.nom === "carre3-0")!;
    const grandL = PIECES.find((p) => p.nom === "grandl-0")!;
    expect(poidsDeSerie(carre3, 10, [])).toBeGreaterThan(0);
    expect(poidsDeSerie(carre3, 10, [grandL])).toBe(0);
    expect(poidsDeSerie(carre3, 0, [])).toBe(0); // très grosse, série 0
  });

  it("règles de série (lots B8b et B8c) sur 1 000 parties et toutes leurs séries : au plus un domino, jamais deux fois la même pièce, au moins une pièce de 4 cases ou plus, au plus une boîte de 3 × 3", () => {
    let dominos = 0;
    let pieces = 0;
    for (const { series } of parties()) {
      for (const s of series) {
        if (s.pieces.length < TAILLE_SERIE) continue;
        pieces += s.pieces.length;
        const nd = s.pieces.filter((p) => p.cases === 2).length;
        dominos += nd;
        expect(nd, `série ${s.rang} : dominos`).toBeLessThanOrEqual(DOMINOS_PAR_SERIE);
        expect(new Set(s.pieces.map((p) => p.id)).size, `série ${s.rang} : doublon`).toBe(TAILLE_SERIE);
        expect(s.pieces.some((p) => p.cases >= CASES_PIECE_GROSSE), `série ${s.rang} : une pièce de ${CASES_PIECE_GROSSE} cases ou plus`).toBe(true);
        expect(s.pieces.filter((p) => p.boite33).length, `série ${s.rang} : boîtes de 3 × 3`).toBeLessThanOrEqual(BOITES33_PAR_SERIE);
      }
    }
    expect(dominos / pieces).toBeLessThan(0.1); // les dominos restent rares (seed § 4 : moins de 10 % des pièces)
  }, 120000);

  it("les règles de série sont dans le poids : un domino de plus, la même pièce ou une série sans pièce de 4 cases valent 0", () => {
    const domino = pieceDe("domino-0");
    const dominoDebout = pieceDe("domino-1");
    const barre3 = pieceDe("barre3-0");
    const coin = pieceDe("coin-0");
    const l = pieceDe("l-0");
    expect(poidsDeSerie(domino, 10, [barre3])).toBeGreaterThan(0);
    expect(poidsDeSerie(dominoDebout, 10, [domino])).toBe(0); // un seul domino, quelle que soit son orientation
    expect(poidsDeSerie(barre3, 10, [barre3])).toBe(0); // jamais deux fois la même pièce
    expect(poidsDeSerie(coin, 10, [barre3])).toBeGreaterThan(0);
    expect(poidsDeSerie(coin, 10, [barre3, domino])).toBe(0); // la dernière pièce d'une série sans pièce de 4 cases en est une
    expect(poidsDeSerie(l, 10, [barre3, domino])).toBeGreaterThan(0);
    expect(poidsDeSerie(coin, 10, [barre3, l])).toBeGreaterThan(0); // une pièce de 4 cases est déjà là
  });

  // La répartition (seed § 4), sur 1 000 jours : au début (séries 0 à 10) puis au plafond de la rampe (les 20 séries qui suivent `rangMax`). Les fourchettes sont celles du lot B8b. Elles se tiennent sur les séries CANDIDATES (l'essai 0 de
  // chaque rang : les poids et la rampe, avant toute exigence) ; les pièces réellement tirées au fil des parties s'en écartent un peu (le coup de pouce choisit des pièces qui complètent une ligne, donc plus grosses) : `tirees` plus bas, l'écart
  // est dit au README du lot.
  const famille = (cases: number): number => (cases <= 2 ? 0 : cases === 3 ? 1 : cases === 4 ? 2 : 3);
  const repartition = (de: number, a: number): number[] => {
    const c = [0, 0, 0, 0];
    for (const g of GRAINES) for (let r = de; r < a; r++) for (const p of serieCandidate(g, r, 0)) c[famille(p.cases)]!++;
    const t = c.reduce((x, y) => x + y, 0);
    return c.map((x) => (100 * x) / t);
  };
  const FOURCHETTES = {
    debut: [[6, 9], [20, 25], [40, 50], [15, 22]],
    plafond: [[3, 6], [12, 18], [35, 45], [30, 40]],
  } as const;
  const NOMS = ["dominos", "pièces de 3 cases", "pièces de 4 cases", "pièces de 5 cases ou plus"] as const;
  it.each([["au début (séries 0 à 10)", 0, 11, "debut"], ["au plafond de la rampe (20 séries à partir de rangMax)", RAMPE_PAR_DEFAUT.rangMax, RAMPE_PAR_DEFAUT.rangMax + 20, "plafond"]] as const)("la répartition des pièces candidates %s est dans les fourchettes de B8b", (_nom, de, a, cle) => {
    const part = repartition(de, a);
    part.forEach((v, i) => {
      const [min, max] = FOURCHETTES[cle][i]!;
      expect(v, `${NOMS[i]} : ${v.toFixed(1)} %`).toBeGreaterThanOrEqual(min);
      expect(v, `${NOMS[i]} : ${v.toFixed(1)} %`).toBeLessThanOrEqual(max);
    });
  });

  it("les pièces réellement tirées (1 000 parties du bot moyen) restent proches des fourchettes : les dominos sous 10 %, la rampe fait monter les grosses pièces", () => {
    const compte = (de: number, a: number): number[] => {
      const c = [0, 0, 0, 0];
      for (const { series } of parties()) for (const s of series) if (s.rang >= de && s.rang < a) for (const p of s.pieces) c[famille(p.cases)]!++;
      const t = c.reduce((x, y) => x + y, 0);
      return c.map((x) => (100 * x) / t);
    };
    const debut = compte(0, 11);
    const tard = compte(40, 100);
    expect(debut[0]!).toBeLessThan(10);
    expect(debut[0]!).toBeGreaterThan(6);
    expect(debut[3]!).toBeLessThan(25); // fourchette de B8b : 15 à 22 % ; le coup de pouce la pousse d'un point ou deux
    expect(debut[3]!).toBeGreaterThan(15);
    expect(tard[3]!).toBeGreaterThan(debut[3]!);
    expect(tard[0]!).toBeLessThan(debut[0]!);
  }, 120000);

  it("la rampe fait monter la part des pièces de 5 cases ou plus avec la série et baisser celle des dominos et des pièces de 3 cases (séries candidates)", () => {
    const debut = repartition(0, 11);
    const plafond = repartition(RAMPE_PAR_DEFAUT.rangMax, RAMPE_PAR_DEFAUT.rangMax + 20);
    expect(plafond[3]!).toBeGreaterThan(debut[3]!);
    expect(plafond[0]!).toBeLessThan(debut[0]!);
    expect(plafond[1]!).toBeLessThan(debut[1]!);
  });

  // --- Les exigences du tirage (lot B8c, seed § 4) ---
  it("exigence 1, série posable : tenue à 100 % jusqu'à la série 25 sur 1 000 parties de bots (la grille que la série voit permet de poser les trois pièces, dans un ordre)", () => {
    let vues = 0;
    for (const { series } of parties()) {
      for (const s of series) {
        if (s.rang > REGLAGE_PAR_DEFAUT.posable.jusqua || s.pieces.length < TAILLE_SERIE) continue;
        vues++;
        expect(piecesPosables(s.grille, s.pieces), `série ${s.rang}`).toBe(TAILLE_SERIE);
      }
    }
    expect(vues).toBeGreaterThan(20000);
  }, 120000);

  it("exigence 1 : la probabilité d'être exigée baisse ensuite, comme voulu (100 % jusqu'à la série 25, puis en ligne droite jusqu'à 0 % à la série 75), mesurée sur 1 000 graines", () => {
    const part = (rang: number): number => (100 * GRAINES.filter((g) => tirerSerie(g, rang, VIDE).exige1).length) / GRAINES.length;
    expect(part(0)).toBe(100);
    expect(part(25)).toBe(100);
    let avant = 101;
    for (const rang of [30, 40, 50, 60, 70]) {
      const mesure = part(rang);
      const attendu = partPosable(rang);
      expect(Math.abs(mesure - attendu), `série ${rang} : ${mesure} % contre ${attendu} %`).toBeLessThan(4);
      expect(mesure).toBeLessThan(avant);
      avant = mesure;
    }
    expect(part(75)).toBe(0);
    expect(part(300)).toBe(0);
    expect(partPosable(25)).toBe(100);
    expect(partPosable(50)).toBe(50);
    expect(partPosable(75)).toBe(0);
  });

  it("exigence 2, coup de pouce : exigée environ une fois sur deux à trois (60 % au début, 30 % à la série 80), jamais sur une grille vide ; quand elle est exigée et possible, une pièce de la série complète une ligne", () => {
    const grille = grilleDepuis(["XXXXXXX.", ".X......", "........", "........", "........", "........", "........", "........"]);
    const part = (rang: number): number => (100 * GRAINES.filter((g) => tirerSerie(g, rang, grille).exige2).length) / GRAINES.length;
    expect(Math.abs(part(1) - 60)).toBeLessThan(4);
    expect(Math.abs(part(80) - 30)).toBeLessThan(4);
    expect(part(80)).toBeLessThan(part(1));
    expect(partPouce(0)).toBe(60);
    expect(partPouce(80)).toBe(30);
    expect(partPouce(500)).toBe(30);
    expect(GRAINES.some((g) => tirerSerie(g, 1, VIDE).exige2)).toBe(false); // grille vide : aucune exigence 2
    // Exigée et possible (la ligne du haut n'attend qu'une case : domino vertical, coin, barre verticale… la complètent) : elle est tenue.
    let exigees = 0;
    let tenues = 0;
    for (const g of GRAINES) {
      const t = tirerSerie(g, 1, grille);
      if (!t.exige2) continue;
      exigees++;
      if (t.pouce && completeUneLigne(grille, t.pieces)) tenues++;
    }
    expect(exigees).toBeGreaterThan(500);
    expect(tenues / exigees).toBeGreaterThan(0.9);
  });

  it("sur les parties de bots, plus de la moitié des séries contiennent une pièce qui complète une ligne (le coup de pouce se sent)", () => {
    let vues = 0;
    let pouces = 0;
    for (const { series } of parties()) {
      for (const s of series) {
        if (s.rang === 0 || s.pieces.length < TAILLE_SERIE) continue;
        vues++;
        if (completeUneLigne(s.grille, s.pieces)) pouces++;
      }
    }
    expect(pouces / vues).toBeGreaterThan(0.5);
  }, 120000);

  it("une partie finit toujours : le bot moyen ne touche jamais le plafond (1 000 parties) et l'exigence 1 s'éteint avant la série 75", () => {
    for (const { actions } of parties()) expect(actions.length).toBeLessThan(PLAFOND_PIECES);
    expect(partPosable(REGLAGE_PAR_DEFAUT.posable.rang)).toBe(REGLAGE_PAR_DEFAUT.posable.pct);
    expect(REGLAGE_PAR_DEFAUT.posable.pct).toBe(0);
  }, 120000);

  it("temps du tirage : médiane sous 1 ms et pire cas sous 50 ms sur 200 parties (bornes larges, la CI est plus lente que le poste ; médiane et pire cas mesurés au README du lot)", () => {
    const durees: number[] = [];
    for (const { contenu, series } of parties().slice(0, 200)) for (const s of series) {
      const t0 = performance.now();
      serieAuRang(contenu.graine, s.rang, s.grille);
      durees.push(performance.now() - t0);
    }
    durees.sort((a, b) => a - b);
    expect(durees[Math.floor(durees.length / 2)]!).toBeLessThan(1);
    expect(durees[durees.length - 1]!).toBeLessThan(50);
  }, 120000);

  it("un réglage du tirage donne un contenu « réglé » (jamais classé) ; le réglage du jeu, ou qui lui est égal, non", () => {
    expect(estClassable(dailyBlocks(JOUR, BLOCKS_GENERATOR_VERSION, { rampe: { ...RAMPE_PAR_DEFAUT } }))).toBe(true);
    expect(reglageEstCeluiDuJeu({})).toBe(true);
    expect(resoudreReglage({ essais: 5 }).essais).toBe(5);
    expect(resoudreReglage({ essais: 5 }).posable).toEqual(REGLAGE_PAR_DEFAUT.posable);
    const c = dailyBlocks(JOUR, BLOCKS_GENERATOR_VERSION, { rampe: { pente: 0, rangMax: 10 } });
    expect(estClassable(c)).toBe(false);
    expect(estClassable(dailyBlocks(JOUR, BLOCKS_GENERATOR_VERSION, { essais: 1 }))).toBe(false);
    expect(estClassable(dailyBlocks(JOUR, BLOCKS_GENERATOR_VERSION, { posable: { pct: 100 } }))).toBe(false);
  });

  it("la rampe rend les parties plus courtes : la médiane du bot faible (100 jours) est plus petite avec la rampe du jeu que sans", () => {
    const mediane = (pente: number): number => {
      const n = Array.from({ length: 100 }, (_, i) => jouerFaible(dailyBlocks(JOUR + i, BLOCKS_GENERATOR_VERSION, { rampe: { pente, rangMax: RAMPE_PAR_DEFAUT.rangMax, apres: 0 } })).resultat.poses).sort((a, b) => a - b);
      return n[50]!;
    };
    expect(mediane(RAMPE_PAR_DEFAUT.pente)).toBeLessThanOrEqual(mediane(0));
  });

  it("le tirage v3 (règles v1) se relit encore pour un jour figé, et diffère du v6 ; les tirages v4 et v5 ne se relisent plus", () => {
    const v3 = dailyBlocks(JOUR, 3);
    expect(v3.g).toBe(3);
    expect(v3.suite).toHaveLength(PLAFOND_PIECES);
    expect(v3.suite!.every((id) => id >= 0 && id < NB_PIECES)).toBe(true);
    expect(dailyBlocks(JOUR).suite).toBeUndefined();
    expect(() => dailyBlocks(JOUR, 2)).toThrow(/version de tirage inconnue/);
    expect(() => dailyBlocks(JOUR, 4)).toThrow(/version de tirage inconnue/);
    expect(() => dailyBlocks(JOUR, 5)).toThrow(/version de tirage inconnue/);
  });
});
