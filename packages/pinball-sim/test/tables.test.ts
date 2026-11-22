import { describe, expect, it } from "vitest";
import { EV_COULEE, EV_ORBITE, EV_SPINNER, PLANS, UNITE, Partie, POINTS, cleDeTable, dailyPinball, lanceurBloque, toutesLesTables, type ThemePinball } from "../src/index";
import { avancer } from "./aide";

// LES TROIS TABLES DESSINÉES (lot PBT1) : A « Classique », B « Rampe et orbite », C « Mini-batteur » — leurs éléments sont aux coordonnées dessinées avec Nathan (version de gauche, en pixels de la table : x de 20 à 348,
// l'axe en x = 184), à quelques pixels près pour ce que la mesure de la fenêtre de tir a déplacé (le verrou, la bouche de l'orbite, les bouches des rampes : README du lot PBT1, tableau « position voulue, position finale »).
const JOUR = 20800;
const table = (plan: string, theme: ThemePinball = "foire", miroir = false): Partie => new Partie(dailyPinball(JOUR, undefined, theme, plan, miroir));
const px = (u: number): number => u / UNITE;
const centres = (z: { x: number; y: number }[]): number[][] => z.map((q) => [px(q.x), px(q.y)]);
const poseDe = (p: Partie, theme: ThemePinball, emplacement: number): { x: number; y: number } => {
  const q = p.table.poses.find((m) => m.emplacement === emplacement)!;
  return { x: px(q.x), y: px(q.y) };
};

describe("les éléments de chaque table sont aux coordonnées dessinées", () => {
  it("A : trois bumpers (152, 152), (214, 152), (183, 192) ; le tir central (190, 285) ; la banque du flanc droit (dessin : cibles en x = 329, y = 340, 366, 392, fond en x = 340 ; posée à (+6, −6) : x = 335, y = 334, 360, 386, fond en x = 346) ; le spinner du couloir de l'orbite (36, 275)", () => {
    const p = table("A");
    expect(centres(p.table.bumpers)).toEqual([[152, 152], [214, 152], [183, 192], [252, 250], [300, 250]]); // les trois bumpers dessinés, puis la paire de mini-bumpers du haut droit (retour de Nathan du 22/11)
    expect(p.table.bumpers.map((b) => px(b.r))).toEqual([17, 17, 17, 12, 12]); // trois bumpers de 17 px, la paire de mini-bumpers de 12 px
    expect(poseDe(p, "foire", 0)).toEqual({ x: 190, y: 285 });
    expect(centres(p.table.plateaux)).toEqual([[190, 285]]);
    const banque = p.table.banques[0]!.map((k) => p.table.murs[k]!);
    expect(banque.map((s) => [px(s.ax), px(s.ay), px(s.bx), px(s.by)])).toEqual([[335, 324, 335, 344], [335, 350, 335, 370], [335, 376, 335, 396]]);
    const fond = p.table.murs[p.table.banques[0]![2]! + 1]!;
    expect([px(fond.ax), px(fond.ay), px(fond.bx), px(fond.by)]).toEqual([346, 316, 346, 402]);
    expect(centres(p.table.spinners)).toEqual([[36, 275]]);
    // ni rampe, ni aiguillage, ni mini-batteur ; l'orbite seule, avec sa porte
    expect([p.table.rails.map((r) => r.genre), p.table.aiguillage, p.table.mini, p.table.passage !== null]).toEqual([["orbite"], null, null, true]);
  });
  it("B : trois bumpers (222, 150), (266, 162), (238, 196) ; le tir central (176, 300) ; la banque en diagonale (dessin : (88, 267), (112, 255), (136, 243), posée à (+12, −6) : (100, 261), (124, 249), (148, 237)) inclinée de −28° ; la rampe droite et son aiguillage ; l'orbite et sa porte", () => {
    const p = table("B");
    expect(centres(p.table.bumpers)).toEqual([[222, 150], [266, 162], [238, 196]]);
    expect(poseDe(p, "foire", 0)).toEqual({ x: 176, y: 300 });
    const milieux = p.table.banques[0]!.map((k) => p.table.murs[k]!).map((s) => [Math.round(px(s.ax + s.bx) / 2), Math.round(px(s.ay + s.by) / 2)]);
    expect(milieux).toEqual([[100, 261], [124, 249], [148, 237]]);
    const s = p.table.murs[p.table.banques[0]![1]!]!;
    const angle = (Math.atan2(s.by - s.ay, s.bx - s.ax) * 180) / Math.PI;
    // −28° dessinés ; les extrémités des cibles sont tronquées en pixels entiers (±8, ∓4 pour ±10 px) : −26,6° construits
    expect(angle).toBeGreaterThan(-29);
    expect(angle).toBeLessThan(-26);
    // la rampe : (286, 310) → (302, 206) → … → (332, 300) → (332, 540), jusqu'au couloir de retour droit
    const r = p.table.rails.find((q) => q.genre === "rampe")!;
    expect([px(r.x[0]!), px(r.y[0]!)]).toEqual([286, 310]);
    expect([px(r.x[r.x.length - 1]!), px(r.y[r.y.length - 1]!)]).toEqual([332, 540]);
    expect(p.table.aiguillage).not.toBeNull();
    expect(p.table.passage).not.toBeNull();
  });
  it("C : trois bumpers (152, 150), (210, 150), (181, 188) ; le tir central (205, 350) ; la banque (68, 257), (92, 245), (116, 233) ; la rampe (270, 236) → … → (332, 540) ; le mini-batteur du flanc gauche, au pivot (46, 405) ; pas d'orbite ni de porte", () => {
    const p = table("C");
    expect(centres(p.table.bumpers)).toEqual([[152, 150], [210, 150], [181, 188]]);
    expect(poseDe(p, "foire", 0)).toEqual({ x: 205, y: 350 });
    const milieux = p.table.banques[0]!.map((k) => p.table.murs[k]!).map((s) => [Math.round(px(s.ax + s.bx) / 2), Math.round(px(s.ay + s.by) / 2)]);
    expect(milieux).toEqual([[68, 257], [92, 245], [116, 233]]);
    const r = p.table.rails[0]!;
    expect([r.genre, px(r.x[0]!), px(r.y[0]!), px(r.x[r.x.length - 1]!), px(r.y[r.y.length - 1]!)]).toEqual(["rampe", 270, 236, 332, 540]);
    expect([px(p.table.mini!.x), px(p.table.mini!.y), p.table.mini!.cote]).toEqual([46, 405, 0]);
    expect([p.table.rails.length, p.table.passage, p.table.spinners.length]).toEqual([1, null, 0]);
  });
  it("le verrou est un trou ; il est posé là où l'éventail du geste de référence le rend visable (option 1 du lot PBT1) : A (208, 464), B (288, 352), C (160, 464) — la mesure est dans `tir.test.ts`", () => {
    for (const [plan, x, y] of [["A", 208, 464], ["B", 288, 352], ["C", 160, 464]] as const) {
      const p = table(plan);
      const t = p.table.trous[p.table.verrou]!;
      expect([px(t.x), px(t.y), px(t.r)], plan).toEqual([x, y, 13]);
    }
  });
  it("les éléments des thèmes : le manège, le tourbillon et le geyser au tir central ; le trou noir au centre et les portails à ± 30 px ; l'astéroïde est l'un des trois bumpers (le dernier) ; la coulée est dans le couloir de l'orbite", () => {
    for (const plan of PLANS) {
      const c = poseDe(table(plan.id), "foire", 0);
      const e = table(plan.id, "espace");
      expect(centres(e.table.trousNoirs)).toEqual([[c.x, c.y]]);
      expect(centres(e.table.portails).sort()).toEqual([[c.x - 30, c.y], [c.x + 30, c.y]].sort());
      expect(e.table.bumpers).toHaveLength(plan.id === "A" ? 5 : 3); // A : plus la paire de mini-bumpers
      expect(e.table.bumpers.filter((b) => b.mobile)).toHaveLength(1);
      expect(e.table.bumpers[2]!.mobile).toBeDefined();
      expect(centres(table(plan.id, "ocean").table.tourbillons)).toEqual([[c.x, c.y]]);
      expect(centres(table(plan.id, "volcan").table.geysers)).toEqual([[c.x, c.y]]);
      const coulees = table(plan.id, "volcan").table.coulees;
      expect(coulees.length, plan.id).toBe(plan.orbite ? 1 : 0);
      for (const z of coulees) expect(px(z.x)).toBe(36);
    }
  });
  it("les guides dessinés : le guide intérieur de l'orbite (x = 52 jusqu'à y = 205, puis l'arc de rayon 144 jusqu'à (196, 61)) et les deux guides de la bouche d'une rampe", () => {
    for (const plan of ["A", "B"]) {
      const g = table(plan).table.guides.find((q) => q.genre === "orbite")!;
      expect(px(g.x[0]!)).toBe(52);
      expect([px(g.x[1]!), px(g.y[1]!)]).toEqual([52, 205]);
      expect([px(g.x.at(-1)!), px(g.y.at(-1)!)]).toEqual([196, 61]);
    }
    expect(table("A").table.guides.filter((g) => g.genre === "bouche")).toHaveLength(0);
    expect(table("B").table.guides.filter((g) => g.genre === "bouche")).toHaveLength(2);
    expect(table("C").table.guides.filter((g) => g.genre === "bouche")).toHaveLength(2);
    // les guides sont des murs du plateau
    for (const plan of ["A", "B", "C"]) {
      const t = table(plan).table;
      for (const g of t.guides) for (let i = 0; i < g.x.length - 1; i++) expect(t.murs.some((m) => m.ax === g.x[i] && m.ay === g.y[i] && m.bx === g.x[i + 1] && m.by === g.y[i + 1])).toBe(true);
    }
  });
});

describe("l'orbite : un couloir où roulent le spinner et la coulée, puis un rail jusqu'au sommet", () => {
  /** Une bille de l'orbite, prise à la bouche à 900 px/s, jouée jusqu'à sa sortie. */
  const orbite = (theme: ThemePinball, miroir = false): { p: Partie; ev: number; sorties: number } => {
    const p = table("A", theme, miroir);
    const i = p.table.rails.length - 1;
    const g = p.table.portes.find((q) => q.rail === i)!;
    p.dansLanceur = false;
    p.entree = 0;
    p.x = g.x - Math.trunc((g.ux * 12 * UNITE) / 16384);
    p.y = g.y - Math.trunc((g.uy * 12 * UNITE) / 16384);
    p.px = p.x;
    p.py = p.y;
    p.vx = Math.trunc((g.ux * 900 * UNITE) / 16384);
    p.vy = Math.trunc((g.uy * 900 * UNITE) / 16384);
    let ev = 0;
    let sorties = 0;
    let pris = false;
    for (let pas = 0; pas < 6000 && !p.finie; pas++) {
      p.avancer();
      ev |= p.ev;
      if (p.couche === 1) pris = true;
      else if (pris) {
        sorties++;
        break;
      }
    }
    return { p, ev, sorties };
  };
  it("la bille qui suit le rail de l'orbite fait tourner le spinner du couloir (50 points) ; au Volcan, elle traverse aussi la coulée (300 points, accélérée)", () => {
    const foire = orbite("foire");
    expect(foire.ev & EV_SPINNER).toBe(EV_SPINNER);
    expect(foire.ev & EV_COULEE).toBe(0);
    expect(foire.p.score).toBe(500 + POINTS.spinner);
    expect(foire.p.spin[0]!).toBeGreaterThan(0);
    const volcan = orbite("volcan");
    expect(volcan.ev & EV_SPINNER).toBe(EV_SPINNER);
    expect(volcan.ev & EV_COULEE).toBe(EV_COULEE);
    expect(volcan.p.score).toBe(500 + POINTS.spinner + POINTS.coulee);
    expect(volcan.p.couleeDedans.some(Boolean) || volcan.p.score > 0).toBe(true);
  });
  it("la coulée accélère la bille de l'orbite : elle sort plus vite au Volcan qu'à la Foire", () => {
    const f = orbite("foire").p;
    const v = orbite("volcan").p;
    expect(Math.hypot(v.vx, v.vy)).toBeGreaterThan(Math.hypot(f.vx, f.vy));
  });
  it("l'orbite mène au sommet (EV_ORBITE), et la bille en ressort dans les couloirs du haut : elle redescend ensuite, dans la table (à gauche en miroir)", () => {
    for (const miroir of [false, true]) {
      const { p, ev, sorties } = orbite("foire", miroir);
      expect(sorties).toBe(1);
      expect(ev & EV_ORBITE).toBe(EV_ORBITE);
      expect(px(p.y)).toBeLessThan(100);
      expect(miroir ? px(p.x) < 184 : px(p.x) > 184).toBe(true);
      // elle tombe ensuite sur le plateau, dans la table, jamais coincée au sommet
      avancer(p, 1200);
      expect(px(p.y), "elle est redescendue au-dessous des couloirs").toBeGreaterThan(110);
    }
  });
  it("une bille qui monte le couloir trop lentement redescend : l'orbite n'est pas mentionnée, et rien n'est gagné", () => {
    const p = table("A");
    const g = p.table.portes[0]!;
    p.dansLanceur = false;
    p.entree = 0;
    p.x = g.x;
    p.y = g.y + 12 * UNITE;
    p.px = p.x;
    p.py = p.y;
    p.vx = 0;
    p.vy = -300 * UNITE;
    let ev = 0;
    for (let pas = 0; pas < 1200; pas++) {
      p.avancer();
      ev |= p.ev;
    }
    expect(ev & EV_ORBITE).toBe(0);
    expect(p.railsFaits[0]).toBe(0);
  });
});

describe("le couloir du lanceur est libre (retour de Nathan du 22/11 : table B de l'Espace en miroir)", () => {
  it.each(toutesLesTables().map((c) => [cleDeTable(c), c] as const))("%s : la bille lancée de la charge 500 à 1 000 sort du couloir", (_cle, c) => {
    expect(lanceurBloque(c)).toBeNull();
  });
});
