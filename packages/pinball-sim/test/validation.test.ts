import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  ESSAIS_MAX, IDS_PLANS, REGLAGES, TABLES_REFUSEES, THEMES_PINBALL, Partie, SuiviModules, analyserTable, billesCoincees, cleDeTable, dailyPinball, dailyPinballAvec, nomDuModule, nomDuRail, planDuJour, themeDuJour,
  tirsDisperses, toutesLesTables,
} from "../src/index";

// Lot PB4 — la validation d'une table (seed : « aucune bille ne doit rester coincée, et chaque module doit pouvoir être touché ; une table refusée est retirée, avec une graine suivante fixée »).
const JOUR = daysFromCivil(2026, 11, 9);

describe("toutes les tables que le générateur peut tirer", () => {
  const toutes = toutesLesTables();
  it("94 tables, chacune une seule fois (quatre plans × quatre thèmes ; l'espace n'en a que deux par plan : presque tous ses emplacements sont fixes ; lot PBL2 : 500 avant, les emplacements du haut des plans ne portent plus que ce qui ne coince pas la bille)", () => {
    expect(toutes).toHaveLength(94);
    expect(new Set(toutes.map(cleDeTable)).size).toBe(94);
    for (const [theme, n] of [["foire", 37], ["ocean", 37], ["espace", 5], ["volcan", 15]] as const) expect(toutes.filter((c) => c.theme === theme)).toHaveLength(n);
    for (const plan of IDS_PLANS) expect(toutes.some((c) => c.plan === plan), plan).toBe(true);
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
    expect(vues.size).toBeGreaterThan(60);
  });
});

describe("une table refusée est retirée : le générateur passe à la graine suivante, fixée", () => {
  it("avec la table du jour refusée, le jour donne une autre table, toujours la même, du même thème et du même plan", () => {
    // un thème qui a assez de tables (l'espace n'en a que deux par plan : refuser les deux serait refuser le jour)
    const base = dailyPinballAvec(JOUR, new Set(), undefined, "foire");
    const refusee = new Set([cleDeTable(base)]);
    const suite = dailyPinballAvec(JOUR, refusee, undefined, "foire");
    expect(cleDeTable(suite)).not.toBe(cleDeTable(base));
    expect(suite.theme).toBe("foire");
    expect(suite.plan).toBe(base.plan);
    expect(suite.plan).toBe(planDuJour(JOUR).id);
    expect(dailyPinballAvec(JOUR, refusee, undefined, "foire")).toEqual(suite);
    // refuser aussi la suivante donne la troisième ; les jours dont la table n'est pas refusée ne changent pas
    const trois = dailyPinballAvec(JOUR, new Set([...refusee, cleDeTable(suite)]), undefined, "foire");
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
  it("lot PBG1 : sur chaque plan et dans chaque thème, une table tirée ne garde aucune bille (grille de 30 px, à l'arrêt et lancée, rails et mini-batteur compris)", () => {
    for (const plan of IDS_PLANS) {
      for (const theme of THEMES_PINBALL) {
        const r = billesCoincees(dailyPinball(JOUR + 3, undefined, theme, plan));
        expect(r.coincee, `${plan} ${theme}`).toBeNull();
        expect(r.pire, `${plan} ${theme}`).toBeLessThan(54000);
      }
    }
  });
  it("un trou qui ne prend jamais la bille et une mission qu'on ne peut pas finir : module jamais touché et mission jamais réussie, donc refusée", () => {
    const piege = analyserTable(dailyPinball(JOUR + 2, undefined, "foire"), { ...REGLAGES, trouVitesseMax: 0, butManege: 1000 }, 72000);
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
    expect(suivi.manquants()).toEqual([...t.poses.map(nomDuModule), ...t.rails.map((_, i) => nomDuRail(t, i))]);
    expect(t.poses.map(nomDuModule)).toEqual(c.modules.map((m, i) => `S${i + 1}:${m}`));
    expect(t.rails.map((_, i) => nomDuRail(t, i)).at(-1)).toBe("orbite");
    // 108 tirs depuis les batteurs et 11 lancers du lanceur ; lot PBG3 : les 108 tirs depuis les batteurs sont refaits la porte ouverte (essai), pour qu'une bille la franchisse
    expect(tirsDisperses(c, suivi)).toBe(119 + (new Partie(c).table.passage ? 108 : 0));
    expect(suivi.touches.size).toBeGreaterThan(3);
  });
  it("lot PBG3 : le suivi voit la porte qui s'ouvre et qui est franchie, le poteau qui renvoie une bille, l'aiguillage qui dérive une bille — chacun une fois suffit", () => {
    const p = new Partie(dailyPinball(JOUR + 1));
    const suivi = new SuiviModules(p.table);
    suivi.pas(p);
    expect([suivi.porteOuverte, suivi.porteFranchie, suivi.sauveur, suivi.aiguillage]).toEqual([false, false, false, false]);
    p.ouvertures = 1;
    suivi.pas(p);
    expect([suivi.porteOuverte, suivi.porteFranchie]).toEqual([true, false]);
    p.passages = 1;
    p.sauvetages = 1;
    p.aiguillages = 1;
    suivi.pas(p);
    expect([suivi.porteOuverte, suivi.porteFranchie, suivi.sauveur, suivi.aiguillage]).toEqual([true, true, true, true]);
  });
  it("lot PBG3 : le tir dispersé porte ouverte franchit la porte sur la plupart des tables — il suffit à la validation quand le robot ne l'a pas fait", () => {
    for (const plan of IDS_PLANS) {
      const c = dailyPinball(JOUR + 1, undefined, "foire", plan);
      const suivi = new SuiviModules(new Partie(c).table);
      tirsDisperses(c, suivi);
      // l'ouverture naturelle (banque ou orbite) est le travail du robot : ici les lancers n'y arrivent presque jamais ; seul le passage compte
      expect(suivi.porteFranchie, plan).toBe(true);
    }
  });
  it("chaque type de module se reconnaît touché sur une table qui le porte (bumpers, cibles, spinner, trou, manège, tourbillon, trou noir, portails, geyser, coulée, astéroïde)", () => {
    // l'union des modules touchés, table par table, par les seuls lancers dispersés : le robot complète (voir le test des 30 jours)
    const types = new Set<string>();
    for (const theme of THEMES_PINBALL) {
      for (const plan of IDS_PLANS) {
        const c = dailyPinball(JOUR + 7, undefined, theme, plan);
        const suivi = new SuiviModules(new Partie(c).table);
        tirsDisperses(c, suivi);
        for (const n of suivi.touches) types.add(n.split(":")[1]!);
      }
    }
    for (const t of ["bumpers", "cibles", "manege", "trouNoir", "coulee"]) expect(types.has(t), t).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(6);
  });
});
