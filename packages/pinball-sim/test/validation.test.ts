import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { IDS_PLANS, REGLAGES, TABLES_REFUSEES, THEMES_PINBALL, Partie, SuiviModules, analyserTable, billesCoincees, cleDeTable, dailyPinball, dailyPinballAvec, nomDuModule, nomDuRail, tirsDisperses, toutesLesTables } from "../src/index";

// Lot PB4 — la validation d'une table (seed : « aucune bille ne doit rester coincée, et chaque module doit pouvoir être touché ; une table refusée est retirée, avec une graine suivante fixée »).
const JOUR = daysFromCivil(2026, 11, 9);

describe("toutes les tables que le générateur peut tirer", () => {
  const toutes = toutesLesTables();
  it("24 tables, chacune une seule fois (trois tables dessinées, de face et en miroir, dans quatre thèmes) ; lot PBT1 : 94 avant, quand les emplacements du haut étaient tirés", () => {
    expect(toutes).toHaveLength(24);
    expect(new Set(toutes.map(cleDeTable)).size).toBe(24);
    for (const theme of THEMES_PINBALL) expect(toutes.filter((c) => c.theme === theme)).toHaveLength(6);
    for (const plan of IDS_PLANS)
      expect(
        toutes.filter((c) => c.plan === plan),
        plan,
      ).toHaveLength(8);
    expect(toutes.filter((c) => c.miroir)).toHaveLength(12);
  });
  it("chaque table du générateur sur 1 500 jours (le thème du jour comme imposé) est l'une d'elles, et les 24 sortent", () => {
    const cles = new Set(toutes.map(cleDeTable));
    const vues = new Set<string>();
    for (let j = 0; j < 1500; j++) {
      const c = dailyPinballAvec(JOUR + j, new Set());
      expect(cles.has(cleDeTable(c)), `jour ${JOUR + j}`).toBe(true);
      vues.add(cleDeTable(c));
      const t = dailyPinballAvec(JOUR + j, new Set(), undefined, THEMES_PINBALL[j % 4]!);
      expect(cles.has(cleDeTable(t))).toBe(true);
    }
    expect(vues.size).toBe(24);
  });
});

describe("plus de graine suivante (lot PBT1) : les tables sont dessinées et toutes valides ; une table refusée serait un défaut de dessin", () => {
  it("la liste des tables refusées (`refusees.ts`) est vide : les 24 tables ont passé la validation, et le générateur n'en retire aucune", () => {
    expect(TABLES_REFUSEES).toEqual([]);
    for (let j = 0; j < 3000; j++) expect(() => dailyPinball(JOUR + j, undefined, THEMES_PINBALL[j % 4]!)).not.toThrow();
  });
  it("une table qu'on déclare refusée n'est pas remplacée par une autre : le générateur le dit (aucun tirage de rechange)", () => {
    const base = dailyPinballAvec(JOUR, new Set());
    expect(() => dailyPinballAvec(JOUR, new Set([cleDeTable(base)]))).toThrow(/table refusée/);
    // les autres jours ne changent pas
    expect(dailyPinballAvec(JOUR + 1, new Set([cleDeTable(base)]))).toEqual(dailyPinballAvec(JOUR + 1, new Set()));
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
  it("lot PBT1 : sur chaque table, de face et en miroir, dans chaque thème, une table tirée ne garde aucune bille (grille de 30 px, à l'arrêt et lancée, rails, guides, porte et mini-batteur compris)", () => {
    for (const plan of IDS_PLANS) {
      for (const theme of THEMES_PINBALL) {
        for (const miroir of [false, true]) {
          const r = billesCoincees(dailyPinball(JOUR + 3, undefined, theme, plan, miroir));
          expect(r.coincee, `${plan}${miroir ? "'" : ""} ${theme}`).toBeNull();
          expect(r.pire, `${plan} ${theme}`).toBeLessThan(54000);
        }
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
    // les tables A et B ont une porte (sur la bouche de l'orbite) ; la table C n'en a pas
    for (const plan of ["A", "B"]) {
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
