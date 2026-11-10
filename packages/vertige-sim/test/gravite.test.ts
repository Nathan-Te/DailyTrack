import { describe, expect, it } from "vitest";
import { jouerCibles } from "../tools/robot";
import { DUREE_MAX_TICKS, M, ORIENTATIONS, Partie, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, appliquer, appliquerT, croix, demiTour, dirDe, gravite, mul, niveau, numeroOrientation, quartDeTour, trans, type Commande, type Niveau, type V3 } from "../src/index";

// La gravité par quarts de tour (lot V1) : les 24 orientations, les deux déclencheurs (surfaces marquées, orbes), la bascule instantanée qui conserve le centre de la boîte et la vitesse du monde, et les mouvements
// dans toutes les orientations (une salle cubique, rejouée dans chacune : l'état local est le même, le monde tourne avec).
const rien: Commande = { k: 0, dl: 0, dt: 0 };
const tenir = (k: number, n: number, dl = 0): Commande[] => Array.from({ length: n }, () => ({ k, dl, dt: 0 }));
const bloc = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, gravite = false) => ({ boite: { x0: x0 * M, y0: y0 * M, z0: z0 * M, x1: x1 * M, y1: y1 * M, z1: z1 * M }, role: "pierre" as const, ...(gravite ? { gravite: true } : {}) });

describe("les 24 orientations", () => {
  it("sont 24 rotations entières distinctes (permutations signées, déterminant 1)", () => {
    expect(ORIENTATIONS.length).toBe(24);
    expect(new Set(ORIENTATIONS.map((m) => m.join(","))).size).toBe(24);
    for (const m of ORIENTATIONS) {
      expect(m.every((v) => v === 0 || v === 1 || v === -1)).toBe(true);
      expect(mul(m, trans(m))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      expect(croix(appliquer(m, [1, 0, 0]), appliquer(m, [0, 1, 0]))).toEqual(appliquer(m, [0, 0, 1]));
    }
  });
  it("donnent chacune des six gravités quatre fois (le lacet de départ possible)", () => {
    const parGravite = new Map<number, number>();
    for (const m of ORIENTATIONS) parGravite.set(gravite(m), (parGravite.get(gravite(m)) ?? 0) + 1);
    expect([...parGravite.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...parGravite.values()]).toEqual([4, 4, 4, 4, 4, 4]);
    expect(gravite(ORIENTATIONS[0]!)).toBe(3);
  });
  it("le quart de tour envoie une direction sur l'autre, le demi-tour sur l'opposée", () => {
    expect(appliquer(quartDeTour(croix([0, -1, 0], [1, 0, 0])), [0, -1, 0])).toEqual([1, 0, 0]);
    expect(appliquer(demiTour([0, 0, 1]), [0, -1, 0])).toEqual([0, 1, 0]);
    expect(numeroOrientation(mul(quartDeTour([0, 1, 0]), mul(quartDeTour([0, 1, 0]), mul(quartDeTour([0, 1, 0]), quartDeTour([0, 1, 0])))))).toBe(0);
  });
});

describe("les surfaces de gravité (déclencheur a)", () => {
  // Un sol, un plafond marqué à 3 m et un mur marqué à l'ouest.
  const SALLE: Niveau = {
    nom: "gravite",
    blocs: [bloc(-30, -1, -30, 30, 0, 30), bloc(-10, 3, -10, 10, 3.5, 10, true), bloc(-21, 0, -10, -20, 20, 10, true), bloc(-10, 3, 20, 10, 3.5, 25)],
    depart: { x: 0, y: 1000, z: 0, lacet: 0 },
    arrivee: null,
    reprises: [],
    gemmes: [],
    chute: -30 * M,
  };
  it("sauter sous un plafond marqué tourne la gravité vers le haut ; on retombe sur le plafond et on y marche", () => {
    const p = new Partie(SALLE);
    p.avancer(rien);
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
    for (let i = 0; i < 40 && p.bascules === 0; i++) p.avancer(rien);
    expect(p.bascules).toBe(1);
    expect(p.gravite).toBe(2);
    for (let i = 0; i < 60; i++) p.avancer(rien);
    expect(p.sol).toBe(true);
    expect(p.pieds()[1]).toBeCloseTo(3 * M, -3); // les pieds sont au plafond (3,0 m)
    const avant = p.pieds();
    for (const c of tenir(T_AVANT, 120)) p.avancer(c);
    expect(Math.abs(p.pieds()[2] - avant[2])).toBeGreaterThan(8 * M); // il avance vers −z du monde, la tête en bas
    expect(p.pieds()[1]).toBeCloseTo(3 * M, -3);
  });
  it("courir contre un mur marqué tourne la gravité vers lui ; on marche sur le mur", () => {
    const p = new Partie({ ...SALLE, depart: { x: -10 * M, y: 1000, z: 0, lacet: 16384 } }); // regarde vers −x
    for (const c of tenir(T_AVANT, 200)) p.avancer(c);
    expect(p.gravite).toBe(1);
    expect(p.sol).toBe(true);
    expect(p.pieds()[0]).toBeCloseTo(-20 * M, -3);
  });
  it("une surface que l'on touche déjà dans le sens de la gravité ne tourne rien (debout sur un sol marqué)", () => {
    const p = new Partie({ ...SALLE, blocs: [bloc(-30, -1, -30, 30, 0, 30, true)] });
    for (const c of tenir(T_AVANT, 60)) p.avancer(c);
    expect(p.bascules).toBe(0);
  });
  it("deux bascules de suite sont séparées de 0,2 s au moins (un angle entre deux surfaces ne fait pas osciller)", () => {
    const coin: Niveau = { ...SALLE, blocs: [bloc(-30, -1, -30, 30, 0, 30, true), bloc(-21, 0, -30, -20, 20, 30, true)], depart: { x: -10 * M, y: 1000, z: 0, lacet: 16384 } };
    const p = new Partie(coin);
    const pas: number[] = [];
    let n = p.bascules;
    for (let i = 0; i < 600; i++) {
      p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
      if (p.bascules !== n) {
        pas.push(i);
        n = p.bascules;
      }
    }
    for (let i = 1; i < pas.length; i++) expect(pas[i]! - pas[i - 1]!).toBeGreaterThanOrEqual(24);
  });
});

describe("la bascule", () => {
  const VIDE: Niveau = { nom: "cube", blocs: [], depart: { x: 0, y: 12 * M, z: 0, lacet: 0 }, arrivee: null, reprises: [], gemmes: [], chute: -300 * M };
  const tourner = (p: Partie, d: number): void => void (p as unknown as { tournerGravite(d: number): boolean }).tournerGravite(d);
  it("est instantanée, garde le centre de la boîte et la vitesse du monde, exprimées dans le nouveau repère", () => {
    for (let d = 0; d < 6; d++) {
      const p = new Partie(VIDE);
      for (const c of tenir(T_AVANT, 5, 300)) p.avancer(c);
      p.vy = 2 * M;
      const centre = p.centre();
      const v = p.vitesseMonde();
      const lacet = p.lacet;
      const avant = p.gravite;
      tourner(p, d);
      if (d === avant) continue;
      expect(p.gravite).toBe(d);
      expect(p.centre()).toEqual(centre);
      expect(p.vitesseMonde()).toEqual(v);
      expect(p.lacet).toBe(lacet); // les nombres du regard restent ceux du repère courant
    }
  });
  it("tourne d'un demi-tour autour de l'axe horizontal le plus proche de la droite du joueur", () => {
    const p = new Partie(VIDE);
    tourner(p, 2);
    expect(p.gravite).toBe(2);
    expect(appliquer(p.m, [1, 0, 0])).toEqual([1, 0, 0]); // regard vers −z : la droite est +x, l'axe du demi-tour
    const q = new Partie({ ...VIDE, depart: { ...VIDE.depart, lacet: 16384 } });
    tourner(q, 2);
    expect(appliquer(q.m, [0, 0, 1])).toEqual([0, 0, 1]); // regard vers −x : l'axe est z
  });
  it("le saut, le dash et la course sur le mur marchent dans les 24 orientations : l'état local est le même, le monde tourne avec", () => {
    // Une salle cubique centrée sur l'origine (symétrique par toutes les rotations).
    const D = 13;
    const salle = (ori: number): Niveau => {
      const depart = appliquer(ORIENTATIONS[ori]!, [-3 * M, -12 * M + 1000, 2 * M]);
      return {
        nom: "cube",
        blocs: [bloc(-D, -D, -D, D, -12, D), bloc(-D, 12, -D, D, D, D), bloc(12, -D, -D, D, D, D), bloc(-D, -D, -D, -12, D, D), bloc(-D, -D, 12, D, D, D), bloc(-D, -D, -D, D, D, -12)],
        depart: { x: depart[0], y: depart[1], z: depart[2], lacet: 0, ori },
        arrivee: null,
        reprises: [],
        gemmes: [],
        chute: -300 * M,
      };
    };
    // Un script qui court, saute (saut de mur compris), dashe et tourne.
    const script: Commande[] = [];
    for (let i = 0; i < 1500; i++) {
      const phase = Math.floor(i / 100) % 6;
      let k = [T_AVANT, T_AVANT | T_DROITE, T_AVANT | T_GAUCHE, T_AVANT, T_ARRIERE | T_GAUCHE, T_AVANT][phase]!;
      if (i % 37 === 0) k |= T_SAUT;
      if (i % 91 === 0) k |= T_DASH;
      script.push({ k, dl: i % 100 < 12 ? 400 : i % 100 > 90 ? -300 : 0, dt: 0 });
    }
    const jouer = (ori: number) => {
      const p = new Partie(salle(ori));
      for (const c of script) p.avancer(c);
      return p;
    };
    const ref = jouer(0);
    expect(ref.chutes).toBe(0);
    expect(Math.abs(ref.x) + Math.abs(ref.z)).toBeGreaterThan(5 * M);
    for (let k = 0; k < 24; k++) {
      const p = jouer(k);
      expect([p.x, p.y, p.z, p.vx, p.vy, p.vz, p.lacet, p.sol, p.dash, p.murT, p.depart]).toEqual([ref.x, ref.y, ref.z, ref.vx, ref.vy, ref.vz, ref.lacet, ref.sol, ref.dash, ref.murT, ref.depart]);
      expect(p.pieds()).toEqual(appliquer(ORIENTATIONS[k]!, [p.x, p.y, p.z]));
      expect(p.ori).toBe(k);
    }
  });
});

describe("les orbes de gravité (déclencheur b)", () => {
  it("le cube : six orbes à la suite visitent les six directions de gravité, sans chute", () => {
    const n = niveau("cube");
    const s = jouerCibles("cube", n.orbes!.map((o) => [o.x / M, o.y / M, o.z / M]), { apres: 120 });
    expect(s.partie.bascules).toBe(6);
    expect(s.partie.chutes).toBe(0);
    expect(new Set(s.orientations.map((o) => gravite(ORIENTATIONS[o]!)))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(s.partie.gravite).toBe(3);
  });
  it("une orbe ramassée s'éteint puis se rallume ; une orbe dans le sens de la gravité n'est pas ramassée", () => {
    const n: Niveau = { nom: "cube", blocs: [bloc(-30, -1, -30, 30, 0, 30)], depart: { x: 0, y: 1000, z: 0, lacet: 0 }, arrivee: null, reprises: [], gemmes: [], chute: -30 * M, orbes: [{ x: 0, y: 0.9 * M, z: -3 * M, dir: 3 }, { x: 0, y: 0.9 * M, z: -6 * M, dir: 5 }] };
    const p = new Partie(n);
    for (const c of tenir(T_AVANT, 110)) p.avancer(c);
    expect(p.orbesT[0]).toBe(0); // dans le sens de la gravité : intacte
    expect(p.orbesT[1]).toBeGreaterThan(0); // vers −z : ramassée
    expect(p.gravite).toBe(5);
  });
  it("les scénarios « gravite » et « cube » se chargent et ne chutent pas au départ", () => {
    for (const nom of ["gravite", "cube"] as const) {
      const p = new Partie(niveau(nom));
      for (let i = 0; i < 600; i++) p.avancer(rien);
      expect(p.chutes).toBe(0);
      expect(p.sol).toBe(true);
    }
  });
});

describe("l'état reste borné", () => {
  it("une partie de 120 s dans la salle de la gravité reste entière et finie", () => {
    const p = new Partie(niveau("gravite"));
    for (let i = 0; i < DUREE_MAX_TICKS; i++) p.avancer({ k: [T_AVANT, T_AVANT | T_SAUT, T_GAUCHE, T_ARRIERE][(i / 50) % 4 | 0]!, dl: 120, dt: 0 });
    for (const v of [p.x, p.y, p.z, p.vx, p.vy, p.vz]) expect(Number.isInteger(v)).toBe(true);
    expect(dirDe(appliquer(p.m, [0, -1, 0]) as V3)).toBeGreaterThanOrEqual(0);
    expect(appliquerT(p.m, appliquer(p.m, [1, 2, 3]))).toEqual([1, 2, 3]);
  });
});
