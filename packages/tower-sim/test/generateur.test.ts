import { formatDay, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  aDoublon,
  aEcartMaximal,
  dailyTower,
  EFFETS,
  ErreurGenerateur,
  estBonus,
  NB_PIECES,
  PALIERS_METRES,
  PALIERS_METRES_V3,
  PIECE_KINDS,
  PLATEFORME_BORNES,
  PLATEFORME_DEMI8_CHOIX,
  problemePaliers,
  THEMES_TOWER,
  themeDuJour,
  TIRAGES_MAX,
  TOWER_GENERATOR_VERSION,
  VERSIONS_GENERATEUR,
} from "../src";

// Lot T2 — le contenu du jour : pureté (src/generateur/ est scanné par purete.test.ts), sacs de sept, plateforme, règles des paliers, versions. Le golden (dix dates) est dans
// golden-tower.test.ts.
const PREMIER = parseDay("2026-11-02")!;
const JOURS = Array.from({ length: 365 }, (_, i) => PREMIER + i);

describe("dailyTower : pure et versionnée", () => {
  it("le même jour donne le même contenu, à chaque appel ; deux jours de suite donnent des suites différentes", () => {
    expect(dailyTower(PREMIER)).toEqual(dailyTower(PREMIER));
    expect(JSON.stringify(dailyTower(PREMIER))).toBe(JSON.stringify(dailyTower(PREMIER)));
    const suites = new Set(JOURS.slice(0, 60).map((j) => dailyTower(j).pieces.join("")));
    expect(suites.size).toBe(60);
  });

  it("le contenu nomme son jour, sa version et son thème", () => {
    const c = dailyTower(PREMIER);
    expect(c.jour).toBe(PREMIER);
    expect(c.nom).toBe("2026-11-02");
    expect(c.g).toBe(TOWER_GENERATOR_VERSION);
    expect(TOWER_GENERATOR_VERSION).toBe(3); // lot T3 : le thème entre dans le contenu ; lot T3b : le tirage, les paliers tous les 8 m
    expect(THEMES_TOWER).toContain(c.theme);
  });

  it("la version 1 reste appelable et donne `port` pour tous les jours ; la version 2 n'en diffère QUE par la version et le thème (un thème n'a aucun effet physique)", () => {
    expect(VERSIONS_GENERATEUR).toEqual([1, 2, 3]);
    for (const j of JOURS) {
      const v1 = dailyTower(j, 1);
      const v2 = dailyTower(j, 2);
      expect(v1.theme).toBe("port");
      expect(v1.g).toBe(1);
      expect({ ...v2, g: 1, theme: "port" }).toEqual(v1);
      expect(v2.theme).toBe(themeDuJour(j));
      // Lot T3b : les versions 1 et 2 n'ont ni tirage ni paliers à 8 m (leurs jours servis ne changent jamais).
      expect(v1).not.toHaveProperty("tirage");
      expect(v2).not.toHaveProperty("tirage");
      expect(v1.paliers.map((p) => p.metres)).toEqual([...PALIERS_METRES]);
      expect(v2.paliers.map((p) => p.metres)).toEqual([10, 20, 30, 40, 50, 60]);
    }
  });

  it("une version du générateur s'appelle par son numéro, la version courante par défaut ; une version inconnue ou un jour invalide est refusé", () => {
    expect(VERSIONS_GENERATEUR).toContain(TOWER_GENERATOR_VERSION);
    for (const v of [1, 2]) expect(dailyTower(PREMIER, v)).toEqual({ ...dailyTower(PREMIER, 2), g: v, theme: v === 1 ? "port" : dailyTower(PREMIER, 2).theme });
    expect(dailyTower(PREMIER, TOWER_GENERATOR_VERSION)).toEqual(dailyTower(PREMIER));
    expect(() => dailyTower(PREMIER, 0)).toThrow(ErreurGenerateur);
    expect(() => dailyTower(PREMIER, 99)).toThrow(/version de générateur inconnue/);
    expect(() => dailyTower(-1)).toThrow(ErreurGenerateur);
    expect(() => dailyTower(1.5)).toThrow(ErreurGenerateur);
  });

  it("lot T3b — le tirage : déterministe, le tirage 0 est par défaut, chaque tirage donne un autre contenu, le thème du jour reste le même, et les versions 1 et 2 refusent un tirage", () => {
    expect(dailyTower(PREMIER)).toEqual(dailyTower(PREMIER, 3, 0));
    for (let t = 0; t < TIRAGES_MAX; t++) {
      expect(dailyTower(PREMIER, 3, t)).toEqual(dailyTower(PREMIER, 3, t)); // pur
      expect(dailyTower(PREMIER, 3, t).tirage).toBe(t);
      expect(dailyTower(PREMIER, 3, t).theme).toBe(themeDuJour(PREMIER)); // le sac de thèmes ne dépend pas du tirage
    }
    for (const j of JOURS.slice(0, 60)) {
      const suites = new Set(Array.from({ length: TIRAGES_MAX }, (_, t) => dailyTower(j, 3, t).pieces.join("")));
      expect(suites.size).toBe(TIRAGES_MAX); // quatre tirages, quatre suites
    }
    // « Pas de cas particulier » : le tirage 0 de la version 3 n'est PAS le contenu de la version 2 (sa graine est décalée comme celle des autres tirages).
    expect(JOURS.slice(0, 60).filter((j) => dailyTower(j, 3, 0).pieces.join("") === dailyTower(j, 2).pieces.join("")).length).toBe(0);
    for (const v of [1, 2]) expect(() => dailyTower(PREMIER, v, 1)).toThrow(/tirage invalide/);
    expect(() => dailyTower(PREMIER, 3, -1)).toThrow(ErreurGenerateur);
    expect(() => dailyTower(PREMIER, 3, 1.5)).toThrow(ErreurGenerateur);
  });

  it("chaque tirage respecte les mêmes règles que le contenu d'origine (sacs de sept, plateforme, paliers, vent)", () => {
    for (const j of JOURS.slice(0, 120)) {
      for (let t = 0; t < TIRAGES_MAX; t++) {
        const c = dailyTower(j, 3, t);
        expect(c.pieces).toHaveLength(NB_PIECES);
        expect(PLATEFORME_DEMI8_CHOIX).toContain(c.plateformeDemi8);
        expect(problemePaliers(c.paliers.map((p) => p.effet))).toBeNull();
        expect([-1, 1]).toContain(c.ventSens);
        expect(aDoublon(c.pieces) ? c.pieces.some((k, i, a) => i > 0 && k === a[i - 1] && i % 7 !== 0) : false).toBe(false);
      }
    }
  });

  it("la version 1 est figée : ces trois jours donnent toujours ces suites (une évolution du générateur est une version 2 à côté, jamais un changement de celle-ci)", () => {
    expect(dailyTower(PREMIER, 1).pieces.slice(0, 14).join("")).toBe("OLJSITZJZISTOL");
    expect(dailyTower(PREMIER + 1, 1).pieces.slice(0, 14).join("")).toMatch(/^[IOTLJSZ]{14}$/);
    expect(formatDay(dailyTower(PREMIER + 2, 1).jour)).toBe("2026-11-04");
  });
});

describe("la suite de pièces : des sacs de sept", () => {
  it("40 pièces ; chaque tétromino une fois par sac de sept (cinq sacs entiers, puis le début d'un sixième)", () => {
    for (const j of JOURS) {
      const { pieces } = dailyTower(j);
      expect(pieces).toHaveLength(NB_PIECES);
      for (let sac = 0; sac < 5; sac++) expect([...pieces.slice(sac * 7, sac * 7 + 7)].sort()).toEqual([...PIECE_KINDS].sort());
      expect(new Set(pieces.slice(35)).size).toBe(5); // le sixième sac est coupé : cinq formes différentes
    }
  });

  it("pas de série absurde : jamais trois pièces identiques d'affilée, et un même tétromino revient au plus 13 pièces plus loin", () => {
    for (const j of JOURS) {
      const { pieces } = dailyTower(j);
      for (let i = 2; i < pieces.length; i++) expect(pieces[i] === pieces[i - 1] && pieces[i] === pieces[i - 2]).toBe(false);
      for (const k of PIECE_KINDS) {
        let derniere = -1;
        pieces.forEach((p, i) => {
          if (p !== k) return;
          if (derniere >= 0) expect(i - derniere).toBeLessThanOrEqual(13);
          derniere = i;
        });
      }
    }
  });

  it("les deux bornes d'un sac de sept existent : deux pièces identiques à la jonction de deux sacs, et un écart de 13 pièces", () => {
    expect(JOURS.some((j) => aDoublon(dailyTower(j).pieces))).toBe(true);
    expect(JOURS.some((j) => !aDoublon(dailyTower(j).pieces))).toBe(true);
    expect(JOURS.some((j) => aEcartMaximal(dailyTower(j).pieces))).toBe(true);
    // Un doublon n'a lieu qu'entre deux sacs.
    for (const j of JOURS) dailyTower(j).pieces.forEach((k, i, a) => i > 0 && k === a[i - 1] && expect(i % 7).toBe(0));
  });
});

describe("la plateforme", () => {
  it("une largeur tirée parmi quelques valeurs étroites, en huitièmes de mètre entiers, entre les bornes exposées", () => {
    expect(PLATEFORME_BORNES).toEqual({ minDemi8: 20, maxDemi8: 32 });
    expect(PLATEFORME_DEMI8_CHOIX).toEqual([20, 24, 28, 32]);
    const vues = new Set<number>();
    for (const j of JOURS) {
      const w = dailyTower(j).plateformeDemi8;
      expect(Number.isInteger(w)).toBe(true);
      expect(PLATEFORME_DEMI8_CHOIX).toContain(w);
      expect(w).toBeGreaterThanOrEqual(PLATEFORME_BORNES.minDemi8);
      expect(w).toBeLessThanOrEqual(PLATEFORME_BORNES.maxDemi8);
      vues.add(w);
    }
    expect(vues.size).toBe(PLATEFORME_DEMI8_CHOIX.length); // les quatre largeurs sortent
  });
});

describe("les paliers du jour", () => {
  it("lot T3b — six paliers, de 8 m en 8 m jusqu'à 48 m (générateur 3, tous les tirages), les six effets du seed chacun une fois ; les versions 1 et 2 gardent 10 m à 60 m", () => {
    expect(PALIERS_METRES_V3).toEqual([8, 16, 24, 32, 40, 48]);
    for (const j of JOURS) {
      for (const t of [0, 1, 2, 3]) {
        const { paliers } = dailyTower(j, 3, t);
        expect(paliers.map((p) => p.metres)).toEqual([8, 16, 24, 32, 40, 48]);
        expect([...paliers.map((p) => p.effet)].sort()).toEqual([...EFFETS].sort());
      }
      expect(dailyTower(j, 2).paliers.map((p) => p.metres)).toEqual([10, 20, 30, 40, 50, 60]);
    }
  });

  it("le premier palier est un bonus ; jamais deux malus de suite ; jamais deux fois le même effet avant que les six soient passés (le tirage alterne donc bonus et malus)", () => {
    for (const j of JOURS) {
      const effets = dailyTower(j).paliers.map((p) => p.effet);
      expect(problemePaliers(effets)).toBeNull();
      expect(estBonus(effets[0]!)).toBe(true);
      for (let i = 1; i < effets.length; i++) expect(estBonus(effets[i]!) || estBonus(effets[i - 1]!)).toBe(true);
    }
  });

  it("tous les effets sortent en premier palier (bonus) et en deuxième (malus) sur l'année ; les deux sens du vent aussi", () => {
    const premiers = new Set(JOURS.map((j) => dailyTower(j).paliers[0]!.effet));
    const seconds = new Set(JOURS.map((j) => dailyTower(j).paliers[1]!.effet));
    expect([...premiers].sort()).toEqual(["figee", "lierre", "petite"]);
    expect([...seconds].sort()).toEqual(["geante", "glissante", "vent"]);
    expect(new Set(JOURS.map((j) => dailyTower(j).ventSens))).toEqual(new Set([-1, 1]));
  });
});
