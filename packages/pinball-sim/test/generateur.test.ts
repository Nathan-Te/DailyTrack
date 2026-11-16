import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { ErreurGenerateur, IDS_PLANS, MISSION_DU_THEME, MODULES, MODULES_COMMUNS, MODULES_DE_MISSION, MODULES_DE_THEME, NB_PLANS, PINBALL_GENERATOR_VERSION, PLANS, THEMES_PINBALL, Partie, dailyPinball, empreinteContenu, permisDe, planDe, planDuJour, themeDuJour } from "../src/index";

const PREMIER = daysFromCivil(2026, 11, 2);

describe("le thème du jour : des cycles de quatre tirés de la graine, jamais deux jours de suite le même", () => {
  it("sur 400 jours, deux jours consécutifs n'ont jamais le même thème, jonction des cycles comprise", () => {
    let avant = themeDuJour(PREMIER - 1);
    for (let i = 0; i < 400; i++) {
      const t = themeDuJour(PREMIER + i);
      expect(t, `jour ${i}`).not.toBe(avant);
      avant = t;
    }
  });
  it("sur 5 000 jours aussi, et chaque cycle de quatre jours montre chaque thème une fois", () => {
    let avant = themeDuJour(-5);
    for (let j = -4; j < 5000; j++) {
      const t = themeDuJour(j);
      expect(t).not.toBe(avant);
      avant = t;
    }
    for (let k = 10; k < 400; k++) expect(new Set([0, 1, 2, 3].map((i) => themeDuJour(k * 4 + i))).size).toBe(4);
  });
  it("le tirage change d'un cycle à l'autre (ce n'est pas une rotation fixe) et les quatre thèmes sortent à égalité", () => {
    const ordres = new Set<string>();
    const compte: Record<string, number> = {};
    for (let k = 0; k < 200; k++) {
      ordres.add([0, 1, 2, 3].map((i) => themeDuJour(k * 4 + i)).join());
      for (let i = 0; i < 4; i++) compte[themeDuJour(k * 4 + i)] = (compte[themeDuJour(k * 4 + i)] ?? 0) + 1;
    }
    expect(ordres.size).toBeGreaterThan(8);
    for (const t of THEMES_PINBALL) expect(compte[t]).toBe(200);
  });
  it("se calcule seul : le même numéro de jour, le même thème, dans n'importe quel ordre d'appel", () => {
    const a = [PREMIER + 9, PREMIER, PREMIER + 301].map(themeDuJour);
    const b = [PREMIER + 301, PREMIER + 9, PREMIER].map(themeDuJour);
    expect(b).toEqual([a[2], a[0], a[1]]);
  });
});

describe("le plan du jour (lot PBG1) : des cycles aussi longs que la liste des plans, jamais deux jours de suite le même", () => {
  it("il y a au moins quatre plans, chacun avec son orbite, ses rampes (une ou deux) et un trou ; un ou deux ont un mini-batteur", () => {
    expect(NB_PLANS).toBeGreaterThanOrEqual(4);
    expect(new Set(IDS_PLANS).size).toBe(NB_PLANS);
    for (const p of PLANS) {
      expect(p.orbite, p.id).not.toBeNull();
      expect([1, 2], p.id).toContain(p.rampes.length);
      expect(p.emplacements.filter((e) => e.permis.length === 1 && e.permis[0] === "trou"), `${p.id} : un trou`).toHaveLength(1);
      // « moins nombreux qu'aujourd'hui » : au plus six emplacements, le trou compris
      expect(p.emplacements.length, p.id).toBeLessThanOrEqual(6);
    }
    expect(PLANS.filter((p) => p.mini).length).toBeGreaterThanOrEqual(1);
    expect(PLANS.filter((p) => p.mini).length).toBeLessThanOrEqual(2);
    expect(PLANS.some((p) => p.rampes.length === 2)).toBe(true);
  });
  it("sur 400 jours, deux jours consécutifs n'ont jamais le même plan, jonction des cycles comprise ; et sur 5 000 jours aussi", () => {
    let avant = planDuJour(PREMIER - 1).id;
    for (let i = 0; i < 400; i++) {
      const p = planDuJour(PREMIER + i).id;
      expect(p, `jour ${i}`).not.toBe(avant);
      avant = p;
    }
    avant = planDuJour(-5).id;
    for (let j = -4; j < 5000; j++) {
      const p = planDuJour(j).id;
      expect(p).not.toBe(avant);
      avant = p;
    }
  });
  it("chaque cycle montre chaque plan une fois, le tirage change d'un cycle à l'autre et les plans sortent à égalité ; le plan se calcule seul", () => {
    const ordres = new Set<string>();
    for (let k = 10; k < 210; k++) {
      const o = Array.from({ length: NB_PLANS }, (_, i) => planDuJour(k * NB_PLANS + i).id);
      expect(new Set(o).size).toBe(NB_PLANS);
      ordres.add(o.join());
    }
    expect(ordres.size).toBeGreaterThan(8);
    const a = [PREMIER + 9, PREMIER, PREMIER + 301].map((j) => planDuJour(j).id);
    const b = [PREMIER + 301, PREMIER + 9, PREMIER].map((j) => planDuJour(j).id);
    expect(b).toEqual([a[2], a[0], a[1]]);
  });
  it("tous les couples (thème, plan) sortent, et le plan du jour est le plan de la table", () => {
    const couples = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const c = dailyPinball(PREMIER + i);
      expect(c.plan).toBe(planDuJour(PREMIER + i).id);
      couples.add(`${c.theme}/${c.plan}`);
    }
    expect(couples.size).toBe(4 * NB_PLANS);
  });
  it("le plan imposé (essai ?plan=) donne la table de ce plan ; le thème et le plan s'imposent ensemble ; un plan inconnu est refusé", () => {
    const c = dailyPinball(PREMIER);
    expect(dailyPinball(PREMIER, undefined, undefined, c.plan)).toEqual(c);
    const autre = IDS_PLANS.find((p) => p !== c.plan)!;
    const d = dailyPinball(PREMIER, undefined, "ocean", autre);
    expect([d.theme, d.plan]).toEqual(["ocean", autre]);
    expect(planDe(autre).id).toBe(autre);
    expect(() => dailyPinball(PREMIER, undefined, undefined, "inconnu")).toThrow(/plan inconnu/);
  });
});

describe("la table du jour", () => {
  it("les emplacements du plan du jour, chacun dans la liste permise de son thème, sur 400 jours", () => {
    for (let i = 0; i < 400; i++) {
      const c = dailyPinball(PREMIER + i);
      const plan = planDe(c.plan);
      expect(c.modules).toHaveLength(plan.emplacements.length);
      c.modules.forEach((m, k) => expect(permisDe(c.theme, plan, k).includes(m), `jour ${i}, ${c.theme}, ${plan.id}, emplacement ${k} : ${m}`).toBe(true));
      expect(THEMES_PINBALL).toContain(c.theme);
    }
  });
  it("sur chaque plan : l'élément du thème est à son emplacement, le trou est toujours là, et chaque thème a ses emplacements fixes", () => {
    for (const plan of PLANS) {
      expect(permisDe("foire", plan, 0)).toEqual(["manege"]);
      expect(permisDe("ocean", plan, 0)).toEqual(["tourbillon"]);
      expect(permisDe("espace", plan, 0)).toEqual(["trouNoir"]);
      expect(permisDe("volcan", plan, 0)).toEqual(["coulee"]);
      for (const t of THEMES_PINBALL) expect(permisDe(t, plan, 1), `${plan.id} ${t} : le trou`).toEqual(["trou"]);
      expect([2, 3, 4].map((i) => permisDe("espace", plan, i).join())).toEqual(["asteroide", "portailB", "portailA"]);
      expect(plan.emplacements.filter((e) => e.optionnel?.volcan === "geyser").length, `${plan.id} : deux emplacements possibles pour le geyser`).toBe(2);
    }
  });
  it("chaque thème pose ses éléments, et ceux de la mission y sont toujours : sur 400 jours de chaque thème", () => {
    const vus = new Set<string>();
    for (const theme of THEMES_PINBALL) {
      for (let i = 0; i < 400; i++) {
        const c = dailyPinball(PREMIER + i, undefined, theme);
        expect(c.theme).toBe(theme);
        c.modules.forEach((m) => vus.add(m));
        const propres = c.modules.filter((m) => (MODULES_DE_THEME as readonly string[]).includes(m));
        expect(propres.length, `${theme}, jour ${i}`).toBe({ foire: 1, ocean: 1, espace: 4, volcan: 2 }[theme]);
        expect(c.modules.filter((m) => (MODULES_DE_MISSION[MISSION_DU_THEME[theme]] as readonly string[]).includes(m)).length).toBeGreaterThan(0);
        expect(c.modules.filter((m) => m === "trou"), `${theme}, jour ${i} : le trou`).toHaveLength(1);
        if (theme === "volcan") expect(c.modules.filter((m) => m === "geyser")).toHaveLength(1);
        if (theme === "espace") expect(new Set(c.modules.filter((m) => m.startsWith("portail"))).size).toBe(2);
      }
    }
    expect([...vus].sort()).toEqual([...MODULES].sort());
  });
  it("le thème imposé (essai) donne la table de ce thème, et la table du jour est inchangée s'il est le sien", () => {
    const c = dailyPinball(PREMIER);
    expect(dailyPinball(PREMIER, undefined, c.theme)).toEqual(c);
    const autre = THEMES_PINBALL.find((t) => t !== c.theme)!;
    expect(dailyPinball(PREMIER, undefined, autre).theme).toBe(autre);
  });
  it("tous les modules communs sortent, et les tables varient", () => {
    const vus = new Set<string>();
    const tables = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const c = dailyPinball(PREMIER + i);
      c.modules.forEach((m) => vus.add(m));
      tables.add(`${c.plan}${c.modules.join()}`);
    }
    for (const m of MODULES_COMMUNS) expect(vus.has(m), m).toBe(true);
    expect(tables.size).toBeGreaterThan(80);
  });
  it("est pure : deux appels, même table ; et la table se construit pour tous les jours (aucun module inconnu), avec les rails du plan", () => {
    for (let i = 0; i < 200; i++) {
      const c = dailyPinball(PREMIER + i);
      expect(dailyPinball(PREMIER + i)).toEqual(c);
      expect(empreinteContenu(c)).toBe(empreinteContenu(dailyPinball(PREMIER + i)));
      const t = new Partie(c).table;
      expect(t.murs.length).toBeGreaterThanOrEqual(42);
      expect(t.rails.length).toBe(planDe(c.plan).rampes.length + 1);
      expect(t.rails.at(-1)!.genre).toBe("orbite");
      expect(t.mini !== null).toBe(planDe(c.plan).mini !== undefined);
    }
  });
  it("la version : la courante seulement, une autre est refusée ; aucune date n'est écrite dans le contenu", () => {
    expect(dailyPinball(PREMIER).g).toBe(PINBALL_GENERATOR_VERSION);
    expect(() => dailyPinball(PREMIER, PINBALL_GENERATOR_VERSION + 1)).toThrow(ErreurGenerateur);
    expect(JSON.stringify(dailyPinball(PREMIER))).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it("l'empreinte change dès que le thème, le plan ou un module change", () => {
    const c = dailyPinball(PREMIER);
    expect(empreinteContenu({ ...c, theme: c.theme === "foire" ? "ocean" : "foire" })).not.toBe(empreinteContenu(c));
    expect(empreinteContenu({ ...c, plan: IDS_PLANS.find((p) => p !== c.plan)! })).not.toBe(empreinteContenu(c));
    const m = [...c.modules];
    m[2] = m[2] === "bumpers" ? "mini" : "bumpers";
    expect(empreinteContenu({ ...c, modules: m })).not.toBe(empreinteContenu(c));
  });
  it("le bas de la table ne change jamais : le châssis est le même tous les jours, sur tous les plans", () => {
    const chassis = (jour: number): string => {
      const p = new Partie(dailyPinball(jour));
      return JSON.stringify(p.table.murs.slice(0, 42).map((s) => [s.ax, s.ay, s.bx, s.by, s.e, s.kick])) + JSON.stringify(p.table.poteaux) + JSON.stringify(p.table.voies);
    };
    const ref = chassis(PREMIER);
    for (let i = 1; i < 60; i++) expect(chassis(PREMIER + i)).toBe(ref);
  });
});
