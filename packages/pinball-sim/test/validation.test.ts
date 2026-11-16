import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  ESSAIS_MAX, REGLAGES, TABLES_REFUSEES, THEMES_PINBALL, Partie, SuiviModules, analyserTable, billesCoincees, cleDeTable, dailyPinball, dailyPinballAvec, nomDuModule, themeDuJour,
  tirsDisperses, toutesLesTables,
} from "../src/index";

// Lot PB4 — la validation d'une table (seed : « aucune bille ne doit rester coincée, et chaque module doit pouvoir être touché ; une table refusée est retirée, avec une graine suivante fixée »).
const JOUR = daysFromCivil(2026, 11, 9);

describe("toutes les tables que le générateur peut tirer", () => {
  const toutes = toutesLesTables();
  it("444 tables, chacune une seule fois (216 pour la foire, 72 l'océan, 12 l'espace, 144 le volcan)", () => {
    expect(toutes).toHaveLength(444);
    expect(new Set(toutes.map(cleDeTable)).size).toBe(444);
    for (const [theme, n] of [["foire", 216], ["ocean", 72], ["espace", 12], ["volcan", 144]] as const) expect(toutes.filter((c) => c.theme === theme)).toHaveLength(n);
  });
  it("chaque table du générateur sur 1 500 jours (le thème du jour comme imposé) est l'une d'elles", () => {
    const cles = new Set(toutes.map(cleDeTable));
    const vues = new Set<string>();
    for (let j = 0; j < 1500; j++) {
      const c = dailyPinballAvec(JOUR + j, new Set());
      expect(cles.has(cleDeTable(c)), `jour ${JOUR + j}`).toBe(true);
      vues.add(cleDeTable(c));
      const t = dailyPinballAvec(JOUR + j, new Set(), undefined, THEMES_PINBALL[j % 4]!);
      expect(cles.has(cleDeTable(t))).toBe(true);
    }
    expect(vues.size).toBeGreaterThan(300);
  });
});

describe("une table refusée est retirée : le générateur passe à la graine suivante, fixée", () => {
  it("avec la table du jour refusée, le jour donne une autre table, toujours la même, du même thème", () => {
    const base = dailyPinballAvec(JOUR, new Set());
    const refusee = new Set([cleDeTable(base)]);
    const suite = dailyPinballAvec(JOUR, refusee);
    expect(cleDeTable(suite)).not.toBe(cleDeTable(base));
    expect(suite.theme).toBe(base.theme);
    expect(suite.theme).toBe(themeDuJour(JOUR));
    expect(dailyPinballAvec(JOUR, refusee)).toEqual(suite);
    // refuser aussi la suivante donne la troisième ; les jours dont la table n'est pas refusée ne changent pas
    const trois = dailyPinballAvec(JOUR, new Set([...refusee, cleDeTable(suite)]));
    expect(new Set([cleDeTable(base), cleDeTable(suite), cleDeTable(trois)]).size).toBe(3);
    expect(dailyPinballAvec(JOUR + 1, refusee)).toEqual(dailyPinballAvec(JOUR + 1, new Set()));
  });
  it(`si toutes les tables sont refusées, le générateur le dit au lieu de tourner (${ESSAIS_MAX} essais au plus)`, () => {
    expect(() => dailyPinballAvec(JOUR, new Set(toutesLesTables().map(cleDeTable)))).toThrow(/aucune table valide/);
  });
  it("la liste des tables refusées (`refusees.ts`) ne contient que des tables possibles, et le générateur n'en sert jamais une, sur 3 000 jours et pour chaque thème imposé", () => {
    const cles = new Set(toutesLesTables().map(cleDeTable));
    for (const k of TABLES_REFUSEES) expect(cles.has(k), k).toBe(true);
    const refusees = new Set(TABLES_REFUSEES);
    for (let j = 0; j < 3000; j++) {
      expect(refusees.has(cleDeTable(dailyPinball(JOUR + j))), `jour ${JOUR + j}`).toBe(false);
      expect(refusees.has(cleDeTable(dailyPinball(JOUR + j, undefined, THEMES_PINBALL[j % 4]!)))).toBe(false);
    }
  });
});

describe("la validation refuse une table piégée exprès", () => {
  const c = dailyPinball(JOUR + 2, undefined, "foire");
  it("sans gravité, une bille lâchée sur la table n'en sort jamais : bille coincée", () => {
    const r = billesCoincees(c, { ...REGLAGES, pente: 0 });
    expect(r.coincee).not.toBeNull();
    expect(r.pire).toBeGreaterThan(50000);
  });
  it("la table du jour, elle, ne garde aucune bille : lâchée sur toute la grille (à l'arrêt et lancée), toujours perdue en moins de 90 secondes", () => {
    const r = billesCoincees(c);
    expect(r.coincee).toBeNull();
    expect(r.lachers).toBeGreaterThan(200);
    expect(r.pire).toBeLessThan(54000);
  });
  it("un trou qui ne prend jamais la bille et une mission qu'on ne peut pas finir : module jamais touché et mission jamais réussie, donc refusée", () => {
    const piege = analyserTable(dailyPinball(JOUR + 2, undefined, "foire"), { ...REGLAGES, trouVitesseMax: 0, butManege: 1000 });
    expect(piege.ok).toBe(false);
    expect(piege.raisons!.some((r) => r.startsWith("module jamais touché : S") && r.endsWith(":trou"))).toBe(true);
    expect(piege.raisons).toContain("mission jamais réussie");
    expect(piege.manquants!.every((m) => m.endsWith(":trou"))).toBe(true);
  });
});

describe("le suivi des modules touchés", () => {
  it("nomme chaque module par son emplacement et son type, et les tirs dispersés touchent des modules sur n'importe quelle table", () => {
    const c = dailyPinball(JOUR + 1);
    const t = new Partie(c).table;
    const suivi = new SuiviModules(t);
    expect(suivi.manquants()).toEqual(t.poses.map(nomDuModule));
    expect(t.poses.map(nomDuModule)).toEqual(c.modules.map((m, i) => `S${i + 1}:${m}`));
    expect(tirsDisperses(c, suivi)).toBe(119);
    expect(suivi.touches.size).toBeGreaterThan(3);
  });
  it("chaque type de module se reconnaît touché sur une table qui le porte (bumpers, cibles, spinner, trou, manège, tourbillon, trou noir, portails, geyser, coulée, astéroïde)", () => {
    // l'union des modules touchés, table par table, par les seuls lancers dispersés : le robot complète (voir le test des 30 jours)
    const types = new Set<string>();
    for (const theme of THEMES_PINBALL) {
      const c = dailyPinball(JOUR + 7, undefined, theme);
      const suivi = new SuiviModules(new Partie(c).table);
      tirsDisperses(c, suivi);
      for (const n of suivi.touches) types.add(n.split(":")[1]!);
    }
    for (const t of ["bumpers", "cibles", "manege", "trouNoir", "coulee"]) expect(types.has(t), t).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(6);
  });
});
