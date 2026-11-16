import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { EMPLACEMENTS, ErreurGenerateur, MISSION_DU_THEME, MODULES, MODULES_COMMUNS, MODULES_DE_MISSION, MODULES_DE_THEME, PINBALL_GENERATOR_VERSION, THEMES_PINBALL, Partie, dailyPinball, empreinteContenu, permisDe, themeDuJour } from "../src/index";

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

describe("la table du jour", () => {
  it("six emplacements, chacun dans la liste permise de son thème, sur 400 jours", () => {
    for (let i = 0; i < 400; i++) {
      const c = dailyPinball(PREMIER + i);
      expect(c.modules).toHaveLength(6);
      c.modules.forEach((m, k) => expect(permisDe(c.theme, k).includes(m), `jour ${i}, ${c.theme}, emplacement ${EMPLACEMENTS[k]!.nom} : ${m}`).toBe(true));
      expect(THEMES_PINBALL).toContain(c.theme);
    }
  });
  it("les listes permises par thème (la maquette) : S6 est l'élément du thème, et chaque thème a ses emplacements fixes", () => {
    const liste = (t: (typeof THEMES_PINBALL)[number]): string[] => [0, 1, 2, 3, 4, 5].map((k) => permisDe(t, k).join("/"));
    const communs = EMPLACEMENTS.map((e) => e.permis.join("/"));
    expect(liste("foire")).toEqual([...communs.slice(0, 5), "manege"]);
    expect(liste("ocean")).toEqual([communs[0], communs[1], communs[2], communs[3], "trou", "tourbillon"]);
    expect(liste("espace")).toEqual([communs[0], "asteroide", "portailB", "portailA", communs[4], "trouNoir"]);
    expect(liste("volcan")).toEqual([communs[0], communs[1], communs[2], `${communs[3]!}/geyser`, `${communs[4]!}/geyser`, "coulee"]);
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
  it("tous les modules communs sortent, à plusieurs emplacements, et les tables varient", () => {
    const vus = new Set<string>();
    const tables = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const c = dailyPinball(PREMIER + i);
      c.modules.forEach((m) => vus.add(m));
      tables.add(c.modules.join());
    }
    expect([...vus].sort()).toEqual([...MODULES].sort());
    for (const m of MODULES_COMMUNS) expect(vus.has(m)).toBe(true);
    expect(tables.size).toBeGreaterThan(100);
  });
  it("est pure : deux appels, même table ; et la table se construit pour tous les jours (aucun module inconnu)", () => {
    for (let i = 0; i < 200; i++) {
      const c = dailyPinball(PREMIER + i);
      expect(dailyPinball(PREMIER + i)).toEqual(c);
      expect(empreinteContenu(c)).toBe(empreinteContenu(dailyPinball(PREMIER + i)));
      expect(new Partie(c).table.murs.length).toBeGreaterThanOrEqual(42);
    }
  });
  it("la version : la courante seulement, une autre est refusée ; aucune date n'est écrite dans le contenu", () => {
    expect(dailyPinball(PREMIER).g).toBe(PINBALL_GENERATOR_VERSION);
    expect(() => dailyPinball(PREMIER, PINBALL_GENERATOR_VERSION + 1)).toThrow(ErreurGenerateur);
    expect(JSON.stringify(dailyPinball(PREMIER))).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it("l'empreinte change dès que le thème ou un module change", () => {
    const c = dailyPinball(PREMIER);
    expect(empreinteContenu({ ...c, theme: c.theme === "foire" ? "ocean" : "foire" })).not.toBe(empreinteContenu(c));
    const m = [...c.modules];
    m[1] = m[1] === "bumpers" ? "mini" : "bumpers";
    expect(empreinteContenu({ ...c, modules: m })).not.toBe(empreinteContenu(c));
  });
  it("le bas de la table ne change jamais : le châssis est le même tous les jours", () => {
    const chassis = (jour: number): string => {
      const p = new Partie(dailyPinball(jour));
      return JSON.stringify(p.table.murs.slice(0, 42).map((s) => [s.ax, s.ay, s.bx, s.by, s.e, s.kick])) + JSON.stringify(p.table.poteaux) + JSON.stringify(p.table.voies);
    };
    const ref = chassis(PREMIER);
    for (let i = 1; i < 60; i++) expect(chassis(PREMIER + i)).toBe(ref);
  });
});
