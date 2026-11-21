import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { DISPOSITIONS, ErreurGenerateur, IDS_PLANS, MISSION_DU_THEME, MODULES, MODULES_COMMUNS, MODULES_DE_MISSION, MODULES_DE_THEME, NB_PLANS, PINBALL_GENERATOR_VERSION, PLANS, THEMES_PINBALL, Partie, cleDeTable, dailyPinball, dispositionDuJour, emplacementsDe, empreinteContenu, miroirDuPlan, permisDe, planDe, planDuJour, themeDuJour, toutesLesTables } from "../src/index";

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

const cle = (d: { plan: string; miroir: boolean }): string => `${d.plan}${d.miroir ? "'" : ""}`;

describe("les tables dessinées (lot PBT1) : trois tables et leur miroir, six dispositions, jamais deux jours de suite la même", () => {
  it("trois tables, A « Classique », B « Rampe et orbite », C « Mini-batteur » : ce que chacune a (orbite, rampe, mini-batteur, porte, aiguillage), le trou en deuxième emplacement", () => {
    expect(IDS_PLANS).toEqual(["A", "B", "C"]);
    expect(NB_PLANS).toBe(3);
    const [a, b, c] = PLANS;
    // A : une orbite et sa porte, ni rampe, ni aiguillage, ni mini-batteur
    expect([a!.orbite !== null, a!.rampes.length, a!.mini, a!.porte !== undefined, a!.aiguillage]).toEqual([true, 0, undefined, true, undefined]);
    // B : l'orbite et sa porte, une rampe et son aiguillage
    expect([b!.orbite !== null, b!.rampes.length, b!.mini, b!.porte !== undefined, b!.aiguillage?.rampe]).toEqual([true, 1, undefined, true, 0]);
    // C : une rampe et son aiguillage, un mini-batteur sur le flanc gauche, pas d'orbite donc pas de porte
    expect([c!.orbite, c!.rampes.length, c!.mini, c!.porte, c!.aiguillage?.rampe]).toEqual([null, 1, { cote: 0, x: 46, y: 405, longueur: 38 }, undefined, 0]);
    for (const p of PLANS) {
      expect(p.emplacements[1]!.permis, `${p.id} : le verrou`).toEqual(["trou"]);
      expect(p.emplacements.filter((e) => e.permis.length === 1 && e.permis[0] === "trou"), `${p.id} : un trou`).toHaveLength(1);
      // aucun emplacement n'est tiré : un seul module permis partout
      for (const e of p.emplacements) expect(new Set(e.permis).size, `${p.id}`).toBe(1);
      expect(p.emplacements.length, p.id).toBeLessThanOrEqual(5);
    }
  });
  it("il y a six dispositions (chaque table de face puis en miroir) ; sur 400 jours, deux jours consécutifs n'ont jamais la même, jonction des cycles comprise ; et sur 5 000 jours aussi", () => {
    expect(DISPOSITIONS.map(cle)).toEqual(["A", "A'", "B", "B'", "C", "C'"]);
    let avant = cle(dispositionDuJour(PREMIER - 1));
    for (let i = 0; i < 400; i++) {
      const d = cle(dispositionDuJour(PREMIER + i));
      expect(d, `jour ${i}`).not.toBe(avant);
      avant = d;
    }
    avant = cle(dispositionDuJour(-5));
    for (let j = -4; j < 5000; j++) {
      const d = cle(dispositionDuJour(j));
      expect(d).not.toBe(avant);
      avant = d;
    }
  });
  it("chaque cycle de six jours montre chaque disposition une fois, le tirage change d'un cycle à l'autre et les dispositions sortent à égalité ; elle se calcule seule", () => {
    const ordres = new Set<string>();
    const compte: Record<string, number> = {};
    for (let k = 10; k < 210; k++) {
      const o = Array.from({ length: DISPOSITIONS.length }, (_, i) => cle(dispositionDuJour(k * DISPOSITIONS.length + i)));
      expect(new Set(o).size).toBe(DISPOSITIONS.length);
      ordres.add(o.join());
      for (const d of o) compte[d] = (compte[d] ?? 0) + 1;
    }
    expect(ordres.size).toBeGreaterThan(8);
    for (const d of DISPOSITIONS) expect(compte[cle(d)]).toBe(200);
    const a = [PREMIER + 9, PREMIER, PREMIER + 301].map((j) => cle(dispositionDuJour(j)));
    const b = [PREMIER + 301, PREMIER + 9, PREMIER].map((j) => cle(dispositionDuJour(j)));
    expect(b).toEqual([a[2], a[0], a[1]]);
  });
  it("le jour tire le thème, la table et le miroir : les 24 couples sortent, et la table du jour est celle de sa disposition", () => {
    const couples = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const c = dailyPinball(PREMIER + i);
      const d = dispositionDuJour(PREMIER + i);
      expect([c.plan, c.miroir]).toEqual([d.plan, d.miroir]);
      expect(planDuJour(PREMIER + i)).toBe(planDe(d.plan, d.miroir));
      couples.add(`${c.theme}/${cle(c)}`);
    }
    expect(couples.size).toBe(THEMES_PINBALL.length * DISPOSITIONS.length);
    expect(couples.size).toBe(24);
  });
  it("les essais imposent le thème, la table et le miroir ; une table inconnue est refusée", () => {
    const c = dailyPinball(PREMIER);
    expect(dailyPinball(PREMIER, undefined, undefined, c.plan)).toEqual({ ...c, miroir: false });
    expect(dailyPinball(PREMIER, undefined, undefined, c.plan, c.miroir)).toEqual(c);
    const d = dailyPinball(PREMIER, undefined, "ocean", "B", true);
    expect([d.theme, d.plan, d.miroir]).toEqual(["ocean", "B", true]);
    expect(dailyPinball(PREMIER, undefined, "ocean", "B").miroir).toBe(false);
    expect(planDe("B", true).miroir).toBe(true);
    expect(planDe("B").miroir).toBeUndefined();
    expect(() => dailyPinball(PREMIER, undefined, undefined, "inconnu")).toThrow(/plan inconnu/);
  });
});

describe("le miroir : la table reflétée exactement autour de l'axe (x → 368 − x)", () => {
  const sym = (x: number): number => 368 - x;
  it.each(PLANS.map((p) => p.id))("%s : emplacements, bumpers, banque, guides, rails, porte et mini-batteur sont l'image exacte de la table de face", (id) => {
    const p = planDe(id);
    const m = miroirDuPlan(p);
    expect(planDe(id, true)).toBe(m);
    expect(m.id).toBe(id);
    expect(m.emplacements.map((e) => [e.x, e.y])).toEqual(p.emplacements.map((e) => [sym(e.x), e.y]));
    p.emplacements.forEach((e, i) => {
      const f = m.emplacements[i]!;
      if (e.points) expect(f.points).toEqual(e.points.map(([x, y]) => [sym(x), y]));
      if (e.banque) {
        expect(f.banque!.cibles).toEqual(e.banque.cibles.map(([ax, ay, bx, by]) => [sym(ax), ay, sym(bx), by]));
        expect(f.banque!.fond).toEqual([sym(e.banque.fond[0]), e.banque.fond[1], sym(e.banque.fond[2]), e.banque.fond[3]]);
      }
    });
    expect((m.guides ?? []).map((g) => g.points)).toEqual((p.guides ?? []).map((g) => g.points.map(([x, y]) => [sym(x), y])));
    expect(m.rampes.map((r) => r.points)).toEqual(p.rampes.map((r) => r.points.map(([x, y]) => [sym(x), y])));
    expect(m.orbite?.points).toEqual(p.orbite?.points.map(([x, y]) => [sym(x), y]));
    if (p.porte) expect([m.porte!.x, m.porte!.y]).toEqual([sym(p.porte.x), p.porte.y]);
    if (p.mini) expect([m.mini!.cote, m.mini!.x, m.mini!.y]).toEqual([1 - p.mini.cote, p.mini.x, p.mini.y]);
    expect(m.aiguillage).toEqual(p.aiguillage);
  });
  it("la table construite en miroir : bumpers, trou, cibles et éléments du thème sont l'image de ceux de face (à une unité près)", () => {
    for (const theme of THEMES_PINBALL) {
      for (const plan of IDS_PLANS) {
        const f = new Partie(dailyPinball(PREMIER, undefined, theme, plan, false)).table;
        const m = new Partie(dailyPinball(PREMIER, undefined, theme, plan, true)).table;
        const U = 368 * 4096;
        const image = (a: { x: number; y: number }[], b: { x: number; y: number }[]): void => {
          expect(b.length).toBe(a.length);
          a.forEach((q, i) => expect([Math.abs(b[i]!.x - (U - q.x)) <= 1, b[i]!.y === q.y], `${theme}:${plan}`).toEqual([true, true]));
        };
        image(f.bumpers, m.bumpers);
        image(f.trous, m.trous);
        image(f.spinners, m.spinners);
        image([...f.plateaux, ...f.tourbillons, ...f.trousNoirs, ...f.geysers, ...f.portails, ...f.coulees], [...m.plateaux, ...m.tourbillons, ...m.trousNoirs, ...m.geysers, ...m.portails, ...m.coulees]);
        expect(m.mini === null).toBe(f.mini === null);
        expect(m.guides.length).toBe(f.guides.length);
      }
    }
  });
});

describe("la table du jour", () => {
  it("les emplacements de la table du jour, chacun avec le module que son thème y pose, sur 400 jours", () => {
    for (let i = 0; i < 400; i++) {
      const c = dailyPinball(PREMIER + i);
      const plan = planDe(c.plan, c.miroir);
      expect(c.modules).toHaveLength(emplacementsDe(plan, c.theme).length);
      c.modules.forEach((m, k) => expect(permisDe(c.theme, plan, k), `jour ${i}, ${c.theme}, ${cle(c)}, emplacement ${k} : ${m}`).toEqual([m]));
      expect(THEMES_PINBALL).toContain(c.theme);
    }
  });
  it("sur chaque table : l'élément du thème est le tir central, le verrou est le trou, l'astéroïde est l'un des trois bumpers, les portails encadrent le trou noir, la coulée est celle du couloir de l'orbite", () => {
    for (const plan of PLANS) {
      expect(permisDe("foire", plan, 0)).toEqual(["manege"]);
      expect(permisDe("ocean", plan, 0)).toEqual(["tourbillon"]);
      expect(permisDe("espace", plan, 0)).toEqual(["trouNoir"]);
      expect(permisDe("volcan", plan, 0), `${plan.id} : le geyser est l'élément de la mission`).toEqual(["geyser"]);
      for (const t of THEMES_PINBALL) expect(permisDe(t, plan, 1), `${plan.id} ${t} : le trou`).toEqual(["trou"]);
      expect(permisDe("espace", plan, 2), "l'astéroïde est l'un des trois bumpers").toEqual(["asteroide"]);
      expect(permisDe("foire", plan, 2)).toEqual(["bumpers"]);
      const centre = plan.emplacements[0]!;
      const portails = emplacementsDe(plan, "espace").slice(-2);
      expect(portails.map((e) => [e.x, e.y]), `${plan.id} : les portails de part et d'autre du trou noir (± 30 px)`).toEqual([[centre.x - 30, centre.y], [centre.x + 30, centre.y]]);
      // la coulée : seulement aux tables A et B (celles qui ont un couloir d'orbite), sans murs
      const coulee = emplacementsDe(plan, "volcan").filter((e) => e.permis[0] === "coulee");
      expect(coulee.length, `${plan.id} : la coulée du volcan`).toBe(plan.orbite ? 1 : 0);
      for (const e of coulee) expect([e.sansMurs, e.x], plan.id).toEqual([true, 36]);
    }
  });
  it("chaque thème pose ses éléments, et ceux de la mission y sont toujours : sur les 24 tables", () => {
    const vus = new Set<string>();
    for (const c of toutesLesTables()) {
      c.modules.forEach((m) => vus.add(m));
      const propres = c.modules.filter((m) => (MODULES_DE_THEME as readonly string[]).includes(m));
      const attendu = { foire: 1, ocean: 1, espace: 4, volcan: c.plan === "C" ? 1 : 2 }[c.theme];
      expect(propres.length, `${c.theme}:${cle(c)}`).toBe(attendu);
      expect(c.modules.filter((m) => (MODULES_DE_MISSION[MISSION_DU_THEME[c.theme]] as readonly string[]).includes(m)).length).toBeGreaterThan(0);
      expect(c.modules.filter((m) => m === "trou"), `${c.theme}:${cle(c)} : le trou`).toHaveLength(1);
      expect(c.modules.filter((m) => m === "cibles"), "une banque de cibles").toHaveLength(1);
      if (c.theme === "volcan") expect(c.modules.filter((m) => m === "geyser")).toHaveLength(1);
      if (c.theme === "espace") expect(new Set(c.modules.filter((m) => m.startsWith("portail"))).size).toBe(2);
    }
    // le module « mini » (deux petits bumpers) n'est plus posé que par le plan d'essai : le mini-batteur de la table C est un batteur
    expect([...vus].sort()).toEqual(MODULES.filter((m) => m !== "mini").sort());
  });
  it("le thème imposé (essai) donne la table de ce thème, et la table du jour est inchangée s'il est le sien", () => {
    const c = dailyPinball(PREMIER);
    expect(dailyPinball(PREMIER, undefined, c.theme)).toEqual(c);
    const autre = THEMES_PINBALL.find((t) => t !== c.theme)!;
    expect(dailyPinball(PREMIER, undefined, autre).theme).toBe(autre);
  });
  it("toutesLesTables : 24 tables distinctes (4 thèmes × 3 tables × le miroir), aucune tirée au hasard", () => {
    const toutes = toutesLesTables();
    expect(toutes).toHaveLength(24);
    expect(new Set(toutes.map(cleDeTable)).size).toBe(24);
    for (const theme of THEMES_PINBALL) for (const d of DISPOSITIONS) expect(toutes.filter((c) => c.theme === theme && c.plan === d.plan && c.miroir === d.miroir)).toHaveLength(1);
    // la même table, deux jours : les mêmes modules (le seul tirage du jour est le thème, la table et le miroir)
    const a = dailyPinball(PREMIER, undefined, "volcan", "B", true);
    const b = dailyPinball(PREMIER + 1000, undefined, "volcan", "B", true);
    expect([b.modules, b.plan, b.miroir]).toEqual([a.modules, a.plan, a.miroir]);
  });
  it("est pure : deux appels, même table ; et la table se construit pour tous les jours (aucun module inconnu), avec les rails de la table", () => {
    for (let i = 0; i < 200; i++) {
      const c = dailyPinball(PREMIER + i);
      expect(dailyPinball(PREMIER + i)).toEqual(c);
      expect(empreinteContenu(c)).toBe(empreinteContenu(dailyPinball(PREMIER + i)));
      const t = new Partie(c).table;
      const plan = planDe(c.plan, c.miroir);
      expect(t.murs.length).toBeGreaterThanOrEqual(42);
      expect(t.rails.length).toBe(plan.rampes.length + (plan.orbite ? 1 : 0));
      if (plan.orbite) expect(t.rails.at(-1)!.genre).toBe("orbite");
      expect(t.mini !== null).toBe(plan.mini !== undefined);
      expect(t.guides.length).toBe(plan.guides!.length);
    }
  });
  it("la version : la courante seulement, une autre est refusée ; aucune date n'est écrite dans le contenu", () => {
    expect(dailyPinball(PREMIER).g).toBe(PINBALL_GENERATOR_VERSION);
    expect(() => dailyPinball(PREMIER, PINBALL_GENERATOR_VERSION + 1)).toThrow(ErreurGenerateur);
    expect(JSON.stringify(dailyPinball(PREMIER))).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it("l'empreinte change dès que le thème, la table, le miroir ou un module change", () => {
    const c = dailyPinball(PREMIER);
    expect(empreinteContenu({ ...c, theme: c.theme === "foire" ? "ocean" : "foire" })).not.toBe(empreinteContenu(c));
    expect(empreinteContenu({ ...c, plan: IDS_PLANS.find((p) => p !== c.plan)! })).not.toBe(empreinteContenu(c));
    expect(empreinteContenu({ ...c, miroir: !c.miroir })).not.toBe(empreinteContenu(c));
    const m = [...c.modules];
    m[2] = m[2] === "bumpers" ? "mini" : "bumpers";
    expect(empreinteContenu({ ...c, modules: m })).not.toBe(empreinteContenu(c));
  });
  it("le bas de la table ne change jamais : le châssis est le même tous les jours, sur toutes les tables et en miroir", () => {
    const chassis = (jour: number): string => {
      const p = new Partie(dailyPinball(jour));
      return JSON.stringify(p.table.murs.slice(0, 42).map((s) => [s.ax, s.ay, s.bx, s.by, s.e, s.kick])) + JSON.stringify(p.table.poteaux) + JSON.stringify(p.table.voies);
    };
    const ref = chassis(PREMIER);
    for (let i = 1; i < 60; i++) expect(chassis(PREMIER + i)).toBe(ref);
  });
});
