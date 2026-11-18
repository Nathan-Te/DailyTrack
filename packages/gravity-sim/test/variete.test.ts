import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  DANGERS,
  MORCEAUX_PAR_BOUCLE,
  MORCEAUX_PAR_THEME,
  META,
  MOTIFS,
  RANG_D_INTRODUCTION,
  TOUS_LES_MOTIFS,
  dailyGravity,
  estUnSouffle,
  mesurerLeJour,
  motifsParBoucle,
  nomDuMotif,
  planDuJour,
  reglesDuContenu,
  repetitionsProches,
  terrainDuJour,
  variantesRepetees,
  type Danger,
} from "../src/index";

// Lot GR7 — **la variété** : des motifs à variantes et à difficulté, jamais le même motif à moins de 6 morceaux ni la même variante deux fois dans une boucle, une courbe de difficulté en vagues (3 ou 4 morceaux tendus, un pour souffler),
// et des dangers qui arrivent un par un selon le rang du thème, chacun d'abord seul et facile.
const JOUR = daysFromCivil(2026, 11, 17);
const jours = Array.from({ length: 10 }, (_, i) => JOUR + i);
const morceauxDuJour = (j: number, n = 2 * MORCEAUX_PAR_BOUCLE) => {
  const c = dailyGravity(j);
  const t = terrainDuJour(c);
  const plan = planDuJour(j, reglesDuContenu(c), c.ordre);
  return Array.from({ length: n }, (_, m) => ({ m, mo: t.morceau(m), info: plan.info(m) }));
};

describe("le catalogue", () => {
  it("au moins deux fois plus de motifs distincts qu'avant le GR7 (19) : 38 et plus", () => {
    expect(new Set(TOUS_LES_MOTIFS).size).toBe(TOUS_LES_MOTIFS.length);
    expect(TOUS_LES_MOTIFS.length).toBeGreaterThanOrEqual(38);
  });
  it("chaque motif a une difficulté de 1 à 5 et au moins deux variantes (les parties de repos : au moins une)", () => {
    for (const x of MOTIFS) {
      expect([1, 2, 3, 4, 5], x.id).toContain(x.diff);
      expect(x.variantes, x.id).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(MOTIFS.map((x) => x.diff)).size).toBe(5);
  });
  it("chaque morceau porte la variante et la difficulté de son motif (hors repos : de 1 à 5)", () => {
    for (const { mo } of morceauxDuJour(JOUR)) {
      expect(mo.difficulte).toBeGreaterThanOrEqual(1);
      expect(mo.difficulte).toBeLessThanOrEqual(5);
      expect(mo.variante).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("l'anti-répétition", () => {
  it("jamais le même motif à moins de 6 morceaux, ni la même variante deux fois dans une boucle (10 jours, deux tours)", () => {
    for (const j of jours) {
      const mes = mesurerLeJour(dailyGravity(j), 2 * MORCEAUX_PAR_BOUCLE * 16);
      expect(repetitionsProches(mes.morceaux), `jour ${j} : motifs répétés à moins de 6 morceaux`).toBe(0);
      expect(variantesRepetees(mes.morceaux), `jour ${j} : variantes répétées dans une boucle`).toBe(0);
    }
  });
  it("une boucle montre au moins 30 motifs distincts (avant le GR7 : 19)", () => {
    for (const j of jours.slice(0, 5)) {
      const mes = mesurerLeJour(dailyGravity(j), 2 * MORCEAUX_PAR_BOUCLE * 16);
      for (const n of motifsParBoucle(mes.morceaux)) expect(n, `jour ${j}`).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("la courbe de difficulté en vagues", () => {
  it("un morceau pour souffler (des pièces, aucun danger) toutes les 3 à 5 morceaux de gravité", () => {
    for (const j of jours) {
      const ms = morceauxDuJour(j).filter((x) => !x.info.section);
      let tendus = 0;
      let longest = 0;
      for (const { mo } of ms) {
        if (estUnSouffle(mo)) {
          longest = Math.max(longest, tendus);
          tendus = 0;
        } else tendus++;
      }
      expect(longest, `jour ${j}`).toBeLessThanOrEqual(5);
    }
    // Un morceau pour souffler n'a ni piques, ni scie, ni laser, ni sol fragile.
    for (const { mo } of morceauxDuJour(JOUR)) if (mo.motif === "souffle") expect(mo.scies.length + mo.lasers.length + [...mo.cases].filter((v) => v === 2 || v === 10).length).toBe(0);
  });
  it("la difficulté moyenne monte avec la distance dans le tour, et repart plus haut à la boucle suivante", () => {
    const par = (de: number, a: number): number => {
      let s = 0;
      let n = 0;
      for (const j of jours) for (const { m, mo } of morceauxDuJour(j)) if (m >= de && m < a && !estUnSouffle(mo)) (s += mo.difficulte ?? 0), n++;
      return s / n;
    };
    const p = MORCEAUX_PAR_THEME;
    expect(par(4 * p, 5 * p)).toBeGreaterThan(par(0, p) + 0.8);
    expect(par(p, 2 * p)).toBeGreaterThan(par(0, p));
    expect(par(MORCEAUX_PAR_BOUCLE, MORCEAUX_PAR_BOUCLE + p)).toBeGreaterThan(par(0, p) + 0.5);
  });
});

describe("les dangers arrivent un par un selon le rang du thème, chacun d'abord seul, facile et annoncé", () => {
  const dangerDe = (nom: string): Danger | null => (nom.startsWith("scie") || nom === "sciesAlternees" ? "scies" : nom.startsWith("fragile") ? "fragiles" : nom.startsWith("laser") ? "lasers" : nom.includes("+") ? (nom.split("+")[1] as Danger) : null);
  it("scies : 2e thème ; sols fragiles et lasers : 3e thème ; rien avant (première boucle)", () => {
    expect(RANG_D_INTRODUCTION).toEqual({ scies: 1, fragiles: 2, lasers: 2 });
    for (const j of jours) {
      for (const { m, mo } of morceauxDuJour(j, MORCEAUX_PAR_BOUCLE)) {
        const d = dangerDe(nomDuMotif(mo));
        if (d === null) continue;
        const rang = Math.trunc(m / MORCEAUX_PAR_THEME);
        expect(rang, `jour ${j}, morceau ${m} (${nomDuMotif(mo)})`).toBeGreaterThanOrEqual(RANG_D_INTRODUCTION[d]);
      }
    }
  });
  it("le premier passage de chaque danger est un morceau d'introduction : seul (rien d'autre de dangereux dans les morceaux autour), facile (difficulté 1, variante 0), et le plan sait le retrouver (`?danger=`)", () => {
    for (const j of jours) {
      const c = dailyGravity(j);
      const plan = planDuJour(j, reglesDuContenu(c), c.ordre);
      const t = terrainDuJour(c);
      for (const d of DANGERS) {
        const m = plan.premierMorceauDuDanger(d);
        expect(m, `jour ${j} : l'introduction des ${d}`).toBeGreaterThan(2);
        expect(Math.trunc(m / MORCEAUX_PAR_THEME)).toBe(RANG_D_INTRODUCTION[d]);
        const mo = t.morceau(m);
        expect(mo.difficulte).toBe(1);
        expect(mo.variante).toBe(0);
        expect(META.get(mo.motif)!.danger).toBe(d);
        // Avant elle, aucun morceau de ce danger ; aucun autre danger dans les 3 morceaux d'avant et d'après.
        for (let k = 0; k < m; k++) expect(dangerDe(nomDuMotif(t.morceau(k))), `jour ${j}, morceau ${k} avant l'introduction de ${d}`).not.toBe(d);
        // Seul : aucun danger du même rang (un danger qu'on ne connaît pas encore) juste avant elle ; un danger déjà introduit (les scies, au 3e thème) peut passer.
        for (const k of [m - 3, m - 2, m - 1]) {
          const autre = dangerDe(nomDuMotif(t.morceau(k)));
          if (autre !== null && autre !== d) expect(plan.premierMorceauDuDanger(autre), `jour ${j}, morceau ${k} (${autre}) juste avant l'introduction de ${d} : il doit être déjà introduit`).toBeLessThan(k);
        }
      }
    }
  });
  it("ensuite tout se combine : des morceaux à plusieurs dangers (4e thème), des sections avec scies ou lasers, et la seconde boucle est plus dense en dangers", () => {
    const nb = (de: number, a: number): number => {
      let n = 0;
      for (const j of jours) for (const { m, mo } of morceauxDuJour(j)) if (m >= de && m < a && dangerDe(nomDuMotif(mo)) !== null) n++;
      return n;
    };
    expect(nb(MORCEAUX_PAR_BOUCLE, 2 * MORCEAUX_PAR_BOUCLE)).toBeGreaterThan(nb(0, MORCEAUX_PAR_BOUCLE));
    const noms = new Set(jours.flatMap((j) => morceauxDuJour(j).map((x) => nomDuMotif(x.mo))));
    expect([...noms].some((x) => x.includes("+"))).toBe(true);
    expect(["piquesScies", "fragileLaser", "laserScies"].some((x) => noms.has(x))).toBe(true);
  });
});
