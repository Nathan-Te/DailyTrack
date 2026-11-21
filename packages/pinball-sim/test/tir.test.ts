import { describe, expect, it } from "vitest";
import { FENETRE_MIN_MS, FENETRE_MIN_PAS, GAUCHE, DROITE, IDS_PLANS, PLANS, THEMES_PINBALL, Partie, REGLAGES, TABLES_REFUSEES, analyserTable, billeTenue, cleDeTable, dansLaZoneDeTir, fenetresDeTir, objectifsDeLaTable, obstaclesDansLaZone, pasEnMs, plusLongueSerie, tirsDuBatteur, toutesLesTables, zoneDeTir, type Contenu } from "../src/index";

// LA ZONE DE TIR LIBRE ET LA FENÊTRE DE TIR HUMAINE (lot PBL2) — « le robot touche » ne suffit pas, il faut « un humain peut viser ». Retour de Nathan après PBL1 : la porte plantée au-dessus du lance-pierre gauche coupait les tirs
// des batteurs, et le geyser n'était pas atteignable en visant. Ces tests gardent le geste de référence (la bille tenue sur un batteur levé, relâchée, puis le batteur renfoncé `d` pas plus tard), la zone de tir (aucun
// obstacle posé librement : sur les 24 tables) et la fenêtre de chaque objectif (≥ 30 ms depuis un batteur : sur les 24 tables : trois tables, de face et en miroir, dans les quatre thèmes, et la validation refuse les autres).

/** Les tables que le générateur peut tirer, hors de celles que la validation retire. */
const toutes = toutesLesTables();
const refusees = new Set(TABLES_REFUSEES);

/** La table de ce (plan, thème), de face ou en miroir (lot PBT1 : une seule table par couple, plus de modules tirés). */
const parDefaut = (plan: string, theme: (typeof THEMES_PINBALL)[number], miroir = false): Contenu => toutes.find((c) => c.plan === plan && c.theme === theme && c.miroir === miroir && !refusees.has(cleDeTable(c)))!;

describe("le geste de référence : la bille tenue sur un batteur levé, relâchée, puis le batteur renfoncé", () => {
  it("la bille se pose sur chaque batteur levé et y reste (la bille tenue), au même endroit de chaque côté de l'axe", () => {
    const c = parDefaut("B", "volcan");
    const g = billeTenue(c, GAUCHE)!;
    const d = billeTenue(c, DROITE)!;
    expect(g).not.toBeNull();
    expect(d).not.toBeNull();
    expect(Math.abs(g.x + d.x - 368)).toBeLessThanOrEqual(1); // images l'une de l'autre dans l'axe de la table (au pixel près : la position est tronquée)
    expect(g.y).toBe(d.y);
    expect(g.partie.vx).toBeLessThan(40 * 4096);
    // elle est sur le batteur, dans le creux entre le guide du couloir de retour et lui
    expect(g.y).toBeGreaterThan(600);
    expect(g.y).toBeLessThan(640);
  });

  it("déterministe : deux fois le geste, les mêmes étiquettes ; le premier moment de frappe ne lance pas la bille, le dernier non plus (elle a quitté le batteur)", () => {
    const c = parDefaut("A", "foire");
    const a = tirsDuBatteur(c, GAUCHE);
    expect(tirsDuBatteur(c, GAUCHE).etiquettes).toEqual(a.etiquettes);
    expect(a.etiquettes.length).toBeGreaterThan(300);
    expect(a.etiquettes[0]).toBe("rien");
    expect(a.etiquettes[a.etiquettes.length - 1]).toBe("rien");
  });

  it("la fenêtre est la plus longue plage continue de moments de frappe, en ms (600 pas par seconde : 18 pas = 30 ms)", () => {
    expect(plusLongueSerie(["rien", "a", "a", "a", "rien", "a", "a"], "a")).toBe(3);
    expect(plusLongueSerie(["rien"], "a")).toBe(0);
    expect(pasEnMs(18)).toBe(30);
    expect(FENETRE_MIN_PAS).toBe(18);
    expect(FENETRE_MIN_MS).toBe(30);
  });
});

describe("la zone de tir : l'éventail des deux batteurs jusqu'au milieu de la table", () => {
  it("elle commence aux batteurs, s'élargit vers le haut et s'arrête au milieu de la table ; elle touche les deux côtés", () => {
    const z = zoneDeTir();
    expect(z.casesMarquees).toBeGreaterThan(2500);
    expect(dansLaZoneDeTir(184, 620)).toBe(true); // devant les batteurs
    expect(dansLaZoneDeTir(100, 450)).toBe(true);
    expect(dansLaZoneDeTir(270, 450)).toBe(true);
    expect(dansLaZoneDeTir(184, 300)).toBe(false); // au-dessus du milieu : plus de zone
    expect(dansLaZoneDeTir(184, 150)).toBe(false);
    expect(dansLaZoneDeTir(0, 0)).toBe(false);
  });

  for (const plan of IDS_PLANS) {
    it(`table ${plan} : aucun obstacle posé librement (mur de spinner, de la coulée, porte) n'entre dans la zone de tir, de face et en miroir, dans les quatre thèmes`, () => {
      let n = 0;
      const mauvais: string[] = [];
      for (const c of toutes.filter((q) => q.plan === plan)) {
        n++;
        const o = obstaclesDansLaZone(new Partie(c).table);
        if (o.length) mauvais.push(`${cleDeTable(c)} : ${o.map((x) => `${x.nom}@${x.x},${x.y}`).join(" ")}`);
      }
      expect(n).toBe(8);
      expect(mauvais.slice(0, 6), `${mauvais.length} tables avec un obstacle dans la zone`).toEqual([]);
    });
  }

  it("le test voit un obstacle : l'ancienne porte du lot PBG3 (un passage à deux murs au-dessus du lance-pierre gauche) est dans la zone", () => {
    const plan = PLANS.find((p) => p.id === "A")! as { porte?: unknown };
    const ancienne = plan.porte;
    try {
      plan.porte = { x: 124, y: 448, angle: -35, largeur: 34, profondeur: 36 };
      const o = obstaclesDansLaZone(new Partie(parDefaut("A", "volcan")).table);
      expect(o.map((x) => x.nom)).toContain("porte");
    } finally {
      plan.porte = ancienne;
    }
  });
});

describe("la fenêtre de tir humaine de chaque objectif : au moins 30 ms depuis un batteur", () => {
  for (const plan of IDS_PLANS) {
    for (const theme of THEMES_PINBALL) {
      it.each([false, true])(`${plan} × ${theme} (miroir : %s) : la mission, le verrou, chaque rampe, l'orbite et la porte ouverte ont chacun ≥ ${FENETRE_MIN_MS} ms`, (miroir) => {
        const c = parDefaut(plan, theme, miroir);
        const f = fenetresDeTir(c);
        const table = new Partie(c).table;
        expect(Object.keys(f.ms).sort(), cleDeTable(c)).toEqual([...objectifsDeLaTable(table)].sort());
        expect(f.manquants, `${cleDeTable(c)} : ${JSON.stringify(f.ms)}`).toEqual([]);
        for (const [o, ms] of Object.entries(f.ms)) expect(ms, `${cleDeTable(c)} : ${o}`).toBeGreaterThanOrEqual(FENETRE_MIN_MS);
      });
    }
  }

  it("le geste ne dépend que de la table : un objectif est atteint depuis les deux batteurs ou depuis un seul, jamais par un tir au pas près (la fenêtre est une plage, pas un point)", () => {
    const f = fenetresDeTir(parDefaut("B", "volcan"));
    for (const [o, [g, d]] of Object.entries(f.objectifs)) expect(Math.max(g, d), o).toBeGreaterThanOrEqual(FENETRE_MIN_PAS);
  });
});

describe("la validation refuse une table qui échoue", () => {
  it("la liste des tables refusées est vide (lot PBT1 : les 24 tables dessinées passent), et chaque couple (table, thème) garde ses deux versions", () => {
    expect(TABLES_REFUSEES).toEqual([]);
    for (const plan of IDS_PLANS) for (const theme of THEMES_PINBALL) expect(toutes.filter((c) => c.plan === plan && c.theme === theme && !refusees.has(cleDeTable(c))).length, `${plan} × ${theme}`).toBe(2);
  });

  it("une table dont un objectif est hors de l'éventail est refusée, et le motif dit lequel : le verrou de la table C posé à son premier dessin (282, 338) n'a qu'une fenêtre de 3 ms (option 1 du lot PBT1 : il est maintenant devant les batteurs)", () => {
    const plan = PLANS.find((p) => p.id === "C")! as unknown as { emplacements: { x: number; y: number }[] };
    const e = plan.emplacements[1]!;
    const [x, y] = [e.x, e.y];
    try {
      e.x = 282;
      e.y = 338;
      const c = parDefaut("C", "foire");
      const f = fenetresDeTir(c);
      expect(f.manquants).toContain("verrou");
      expect(f.ms.verrou!).toBeLessThan(FENETRE_MIN_MS);
      const a = analyserTable(c);
      expect(a.ok).toBe(false);
      expect(a.raisons!.some((r) => r.startsWith("fenêtre de tir trop courte : verrou"))).toBe(true);
    } finally {
      e.x = x;
      e.y = y;
    }
  }, 60_000);
});
