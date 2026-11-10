import { describe, expect, it } from "vitest";
import { DUREE_MAX_TICKS, M, Partie, REGLAGES_DEFAUT, T_ARRIERE, T_AVANT, T_DASH, T_GAUCHE, T_SAUT, jouer, niveau, reglagesDe, type Commande, type Niveau } from "../src/index";

// Les mouvements, un par un, sur des niveaux de poche (un sol, un mur) : la simulation est entière, donc les valeurs attendues sont exactes ou bornées de près.
const ARENE: Niveau = {
  nom: "bac-a-sable",
  blocs: [{ boite: { x0: -50 * M, y0: -2 * M, z0: -50 * M, x1: 50 * M, y1: 0, z1: 50 * M }, role: "pierre" }],
  depart: { x: 0, y: 1000, z: 0, lacet: 0 },
  arrivee: null,
  reprises: [],
  gemmes: [],
  chute: -30 * M,
};
/** Un sol qui s'arrête à z = −10 m, et un mur à x = 5 m (de z = 4 à z = −60 m), tous deux au-dessus du vide. */
const MUR: Niveau = {
  ...ARENE,
  blocs: [
    { boite: { x0: -4 * M, y0: -2 * M, z0: -10 * M, x1: 4 * M, y1: 0, z1: 4 * M }, role: "pierre" },
    { boite: { x0: 5 * M, y0: -2 * M, z0: -60 * M, x1: 6 * M, y1: 20 * M, z1: 4 * M }, role: "sombre" },
  ],
};
const rien: Commande = { k: 0, dl: 0, dt: 0 };
const tenir = (k: number, n: number, dl = 0): Commande[] => Array.from({ length: n }, () => ({ k, dl, dt: 0 }));
const metres = (v: number): number => v / M;
/** Un départ en l'air contre le mur (le mur est à droite, à x = 5 m), regardant vers −z. */
const CONTRE_LE_MUR: Niveau = { ...MUR, depart: { x: 4.69 * M, y: 15 * M, z: -5 * M, lacet: 0 } };

describe("course et saut", () => {
  it("atteint la vitesse de course (9,5 m/s) et s'arrête net au sol", () => {
    const p = jouer(ARENE, tenir(T_AVANT, 120));
    expect(metres(p.vz)).toBeCloseTo(-9.5, 1);
    expect(p.sol).toBe(true);
    for (let i = 0; i < 60; i++) p.avancer(rien);
    expect(Math.abs(p.vz)).toBeLessThan(0.05 * M);
  });
  it("saute d'environ 1,65 m (9,6 m/s, gravité 28 m/s²) et retombe en un peu plus de 0,68 s", () => {
    const p = new Partie(ARENE);
    p.avancer(rien); // le départ est à 1 mm du sol : un pas pour se poser
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
    let haut = 0;
    let pas = 1;
    while (!p.sol && pas < 400) {
      p.avancer(rien);
      haut = Math.max(haut, p.y);
      pas++;
    }
    expect(metres(haut)).toBeGreaterThan(1.6);
    expect(metres(haut)).toBeLessThan(1.7);
    expect(pas / 120).toBeGreaterThan(0.66);
    expect(pas / 120).toBeLessThan(0.72);
  });
  it("ne saute pas une seconde fois en l'air", () => {
    const p = new Partie(ARENE);
    p.avancer(rien);
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
    for (let i = 0; i < 30; i++) p.avancer(rien);
    const vy = p.vy;
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
    expect(p.vy).toBeLessThan(vy);
  });
});

describe("temps de grâce et saut mémorisé", () => {
  it("coyote : un saut peu après le bord réussit, bien après il échoue", () => {
    const tentative = (attente: number): boolean => {
      const p = new Partie(MUR);
      for (let i = 0; i < 400 && p.z > -10.4 * M; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 }); // jusqu'à ce que la boîte ait quitté le sol
      expect(p.sol).toBe(false);
      for (let i = 0; i < attente; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
      const avant = p.vy;
      p.avancer({ k: T_AVANT | T_SAUT, dl: 0, dt: 0 });
      return p.vy > avant + M;
    };
    expect(tentative(0)).toBe(true);
    expect(tentative(40)).toBe(false);
  });
  it("tampon : un saut demandé juste avant l'atterrissage part à l'atterrissage", () => {
    const p = new Partie(ARENE);
    p.avancer(rien);
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
    let n = 0;
    while (n < 200 && !(p.vy < 0 && p.y < 0.12 * M)) {
      p.avancer(rien);
      n++;
    }
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 }); // demandé à 12 cm du sol
    let reparti = false;
    for (let i = 0; i < 20; i++) {
      p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
      if (p.vy > 5 * M) reparti = true;
    }
    expect(reparti).toBe(true);
  });
});

describe("dash", () => {
  it("part dans la direction voulue, sans gravité, sur 20 pas (170 ms) et environ 3,8 m", () => {
    const p = new Partie(ARENE);
    for (const c of tenir(T_AVANT, 30)) p.avancer(c);
    p.avancer({ k: T_AVANT | T_DASH, dl: 0, dt: 0 });
    const z0 = p.z;
    const y0 = p.y;
    let pas = 0;
    while (p.dash > 0) {
      p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
      pas++;
    }
    expect(pas).toBe(19);
    expect(Math.abs(metres(p.z - z0))).toBeGreaterThan(3.4);
    expect(Math.abs(metres(p.z - z0))).toBeLessThan(4.1);
    expect(p.y).toBe(y0);
  });
  it("sans touche de direction, le dash va devant (lacet 0 : vers −z), à 23 m/s", () => {
    const p = new Partie(ARENE);
    p.avancer({ k: T_DASH, dl: 0, dt: 0 });
    expect(p.vz).toBe(-23_000_000);
    expect(p.vx).toBe(0);
  });
  it("se recharge en 0,85 s : un second dash trop tôt est ignoré", () => {
    const p = new Partie(ARENE);
    p.avancer({ k: T_AVANT | T_DASH, dl: 0, dt: 0 });
    for (let i = 0; i < 40; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
    p.avancer({ k: T_AVANT | T_DASH, dl: 0, dt: 0 });
    expect(p.dash).toBe(0);
    for (let i = 0; i < 80; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
    p.avancer({ k: T_AVANT | T_DASH, dl: 0, dt: 0 });
    expect(p.dash).toBeGreaterThan(0);
  });
  it("une touche de dash tenue ne dashe qu'une fois (c'est l'appui qui compte)", () => {
    const p = new Partie(ARENE);
    let departs = 0;
    for (const c of tenir(T_AVANT | T_DASH, 300)) {
      const avant = p.dash;
      p.avancer(c);
      if (p.dash > avant) departs++;
    }
    expect(departs).toBe(1);
  });
});

describe("mur", () => {
  it("en l'air, en avançant le long du mur : gravité réduite, durée limitée à 1,7 s", () => {
    const p = new Partie(CONTRE_LE_MUR);
    for (const c of tenir(T_AVANT, 30)) p.avancer(c); // la vitesse vers l'avant s'établit
    let surMur = 0;
    for (const c of tenir(T_AVANT, 300)) {
      p.avancer(c);
      if (p.surMur) surMur++;
    }
    expect(surMur).toBeGreaterThan(100);
    expect(surMur).toBeLessThanOrEqual(204); // 1,7 s
  });
  it("sans avancer, pas de course sur le mur", () => {
    const p = new Partie(CONTRE_LE_MUR);
    for (const c of tenir(T_ARRIERE, 100)) {
      p.avancer(c);
      expect(p.surMur).toBe(false);
    }
  });
  it("de face contre le mur, pas de course (c'est la vitesse le long du mur qui compte)", () => {
    const p = new Partie({ ...MUR, depart: { x: 2.0 * M, y: 8 * M, z: -5 * M, lacet: -16384 } }); // regarde vers +x : droit sur le mur
    let vu = false;
    for (const c of tenir(T_AVANT, 200)) {
      p.avancer(c);
      if (p.surMur) vu = true;
    }
    expect(vu).toBe(false);
  });
  it("saut de mur : poussée hors du mur, vers le haut, puis verrou : le joueur ne recolle pas aussitôt", () => {
    const p = new Partie(CONTRE_LE_MUR);
    for (const c of tenir(T_AVANT, 40)) p.avancer(c);
    expect(p.murNx).toBe(-1);
    p.avancer({ k: T_AVANT | T_SAUT, dl: 0, dt: 0 });
    expect(p.vx).toBeLessThan(-5 * M); // poussé vers −x, loin du mur (x = 5 m)
    expect(p.murVerrou).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) {
      p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
      expect(p.surMur).toBe(false);
    }
  });
  it("au sol, contre le mur : pas de saut de mur, un saut ordinaire", () => {
    const p = new Partie({ ...MUR, depart: { x: 3.69 * M, y: 1000, z: 0, lacet: 0 }, blocs: [...MUR.blocs, { boite: { x0: 3 * M, y0: -2 * M, z0: -1 * M, x1: 5 * M, y1: 0, z1: 5 * M }, role: "pierre" }] });
    for (const c of tenir(T_GAUCHE, 5)) p.avancer(c);
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 });
    expect(p.vx).toBeGreaterThan(-5 * M);
  });
});

describe("chute, reprise, chrono", () => {
  it("tomber sous −30 m ramène au point de départ, le chrono continue", () => {
    const p = new Partie(MUR);
    for (let i = 0; i < 1000 && p.chutes === 0; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
    expect(p.chutes).toBe(1);
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
    expect(p.depart).toBe(0);
  });
  it("le chrono démarre au premier mouvement (pas au premier pas), s'arrête à l'arrivée", () => {
    const p = new Partie(niveau("parcours"));
    for (let i = 0; i < 50; i++) p.avancer(rien);
    expect(p.depart).toBe(-1);
    expect(p.chrono).toBe(0);
    p.avancer({ k: T_SAUT, dl: 0, dt: 0 }); // sauter sur place n'est pas bouger
    expect(p.depart).toBe(-1);
    p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
    expect(p.depart).toBe(51);
    for (let i = 0; i < 10; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
    expect(p.chrono).toBe(11);
  });
  it("une partie sans arrivée s'arrête au bout de 120 s et vaut le pire temps", () => {
    const p = jouer(ARENE, tenir(0, DUREE_MAX_TICKS + 500));
    expect(p.finie).toBe(true);
    expect(p.tick).toBe(DUREE_MAX_TICKS);
    expect(p.resultat().arrive).toBe(false);
  });
});

describe("déterminisme", () => {
  const marche: Commande[] = Array.from({ length: 3000 }, (_, i) => ({ k: T_AVANT | (i % 97 === 0 ? T_SAUT : 0) | (i % 211 === 0 ? T_DASH : 0) | (i % 400 > 200 ? T_GAUCHE : 0), dl: ((i * 37) % 61) - 30, dt: ((i * 11) % 21) - 10 }));
  it("les mêmes commandes donnent le même état, au bit près", () => {
    expect(jouer(niveau("bac-a-sable"), marche).empreinte()).toBe(jouer(niveau("bac-a-sable"), marche).empreinte());
  });
  it("d'autres réglages donnent un autre état", () => {
    const autre = reglagesDe({ vitesse: 800 });
    expect(autre.vitesse).toBe(800);
    expect(jouer(niveau("bac-a-sable"), marche, autre).empreinte()).not.toBe(jouer(niveau("bac-a-sable"), marche).empreinte());
  });
  it("des réglages hors bornes ou non entiers sont ignorés", () => {
    expect(reglagesDe({ vitesse: 9999, saut: 960.5, gravite: "28" })).toEqual(REGLAGES_DEFAUT);
    expect(reglagesDe(null)).toEqual(REGLAGES_DEFAUT);
  });
  it("le regard tourne d'un tour exactement avec 4 × 16 384 unités et le tangage est borné", () => {
    const p = new Partie(ARENE);
    for (let i = 0; i < 4; i++) p.avancer({ k: 0, dl: 16384, dt: 0 });
    expect(p.lacet).toBe(0);
    for (let i = 0; i < 10; i++) p.avancer({ k: 0, dl: 0, dt: 10000 });
    expect(p.tangage).toBe(15000);
  });
});
