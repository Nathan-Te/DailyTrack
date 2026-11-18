import { describe, expect, it } from "vitest";
import {
  CASE,
  EV_CRAQUE,
  EV_EFFONDREMENT,
  FRAGILE_DELAI,
  LASER_ALLUME,
  LASER_ANNONCE,
  LASER_CYCLE,
  MORT_LASER,
  MORT_SCIE,
  MORT_VIDE,
  SCIE_RAYON,
  etatLaser,
  jouer,
  positionScie,
  Partie,
  terrainDeTest,
  type Laser,
  type Scie,
} from "../src/index";
import { avancer, morceau, trou } from "./aide";

// Lot GR7 — **les trois dangers**, un par un, sur des terrains écrits à la main : la scie (un disque rouge sur un rail), le sol fragile (il craque au contact, tombe `FRAGILE_DELAI` pas plus tard et ne revient pas), le laser (un trait pâle,
// puis un rayon qui brûle une durée fixe). Rouge = danger : le bouclier les sauve comme un pique.
const sur = (grille: readonly string[], objets: { scies?: readonly Scie[]; lasers?: readonly Laser[] } = {}): Partie => new Partie(terrainDeTest([grille], objets));

describe("la scie", () => {
  const rail: Scie = { x0: 8 * CASE, y0: 9 * CASE + CASE / 2, x1: 12 * CASE, y1: 9 * CASE + CASE / 2, periode: 100, decalage: 0 };
  it("va et vient sur son rail en `periode` pas par sens, la position ne dépend que du pas", () => {
    expect(positionScie(rail, 0)).toEqual([8 * CASE, rail.y0]);
    expect(positionScie(rail, 100)).toEqual([12 * CASE, rail.y0]);
    expect(positionScie(rail, 200)).toEqual([8 * CASE, rail.y0]);
    expect(positionScie(rail, 50)[0]).toBe(10 * CASE);
    expect(positionScie({ ...rail, decalage: 50 }, 0)[0]).toBe(10 * CASE);
    for (let t = 0; t < 600; t += 7) expect(positionScie(rail, t)).toEqual(positionScie(rail, t + 200));
  });
  it("tue le joueur qui la rencontre (cause : la scie), pas celui qui passe au plafond", () => {
    // Un rail sur toute la course du joueur, au sol.
    const large: Scie = { x0: 4 * CASE, y0: 9 * CASE + CASE / 2, x1: 15 * CASE, y1: 9 * CASE + CASE / 2, periode: 150, decalage: 0 };
    const au_sol = avancer(sur(morceau(), { scies: [large] }), 400);
    expect(au_sol.mort).toBe(MORT_SCIE);
    const loin: Scie = { ...large, x0: 8 * CASE, x1: 15 * CASE };
    const plafond = sur(morceau(), { scies: [loin] });
    for (let i = 0; i < 200 && !plafond.finie; i++) {
      if (i === 3) plafond.appuyer();
      else if (plafond.bouton) plafond.relacher();
      plafond.avancer();
    }
    expect(plafond.finie, "au plafond, la scie du sol ne touche pas").toBe(false);
  });
  it("sa collision est ronde et un peu réduite : un disque tout près ne touche pas, un disque qui chevauche touche", () => {
    expect(SCIE_RAYON).toBeLessThan(CASE / 2);
    const p = sur(morceau());
    const [px, py] = [p.x, p.y];
    const toucheA = (dx: number): number => {
      const s: Scie = { x0: px + 3277 + dx, y0: py + 1638, x1: px + 3277 + dx, y1: py + 1638, periode: 1000, decalage: 0 };
      const q = sur(morceau(), { scies: [s] });
      q.relacher();
      q.avancer();
      return q.mort;
    };
    expect(toucheA(SCIE_RAYON + 600)).toBe(0);
    expect(toucheA(-200)).toBe(MORT_SCIE);
  });
  it("le bouclier la sauve (une fois), comme un pique", () => {
    const large: Scie = { x0: 4 * CASE, y0: 9 * CASE + CASE / 2, x1: 15 * CASE, y1: 9 * CASE + CASE / 2, periode: 150, decalage: 0 };
    const p = sur(morceau(), { scies: [large] });
    p.bouclier = true;
    avancer(p, 60);
    expect(p.bouclier).toBe(false);
    expect(p.finie).toBe(false);
  });
});

describe("le laser", () => {
  it("s'annonce par un trait pâle (0,5 s), puis brûle une durée fixe, en cycle", () => {
    expect(LASER_ANNONCE).toBe(60);
    expect(LASER_ALLUME).toBe(90);
    const etats = Array.from({ length: LASER_CYCLE }, (_, t) => etatLaser(t, 0));
    expect(etats.filter((e) => e === 1)).toHaveLength(LASER_ANNONCE);
    expect(etats.filter((e) => e === 2)).toHaveLength(LASER_ALLUME);
    // L'annonce précède toujours le rayon, sans trou : 0 … 0, 1 … 1, 2 … 2.
    expect(etats.indexOf(1)).toBeLessThan(etats.indexOf(2));
    expect(etats.indexOf(2)).toBe(etats.indexOf(1) + LASER_ANNONCE);
    expect(etatLaser(5 + LASER_CYCLE, 0)).toBe(etatLaser(5, 0));
  });
  it("ne tue que pendant qu'il brûle (le trait pâle est inoffensif), dans sa colonne et ses rangées", () => {
    const grille = morceau();
    const laser = (decalage: number): Laser => ({ c: 11, r0: 5, r1: 9, decalage });
    // Éteint toute la traversée : le joueur passe.
    const eteint = avancer(sur(grille, { lasers: [laser(-LASER_CYCLE + 0)] }), 3);
    expect(eteint.finie).toBe(false);
    const p = sur(grille, { lasers: [laser(0)] });
    let annonceVue = false;
    for (let i = 0; i < 1200 && !p.finie; i++) {
      p.avancer();
      if (etatLaser(p.tick, 0) === 1) annonceVue = true;
    }
    expect(annonceVue).toBe(true);
  });
  it("un joueur qui traverse au plafond ne le touche pas, un joueur au sol le touche s'il brûle à son passage", () => {
    // Le rayon monte du sol (rangées 5 à 9) dans la colonne 11 ; calé pour brûler quand le joueur y arrive.
    const calibre = (le: Laser): Partie => {
      const p = sur(morceau(), { lasers: [le] });
      return p;
    };
    const ref = sur(morceau());
    let tArrivee = 0;
    while (ref.x < 11 * CASE && !ref.finie) {
      ref.avancer();
      tArrivee = ref.tick;
    }
    const brule: Laser = { c: 11, r0: 5, r1: 9, decalage: (((LASER_CYCLE - LASER_ALLUME / 2 - tArrivee) % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE };
    const sol = calibre(brule);
    avancer(sol, 400);
    expect(sol.mort).toBe(MORT_LASER);
    const haut = calibre(brule);
    for (let i = 0; i < 400 && !haut.finie; i++) {
      if (i === 3) haut.appuyer();
      else if (haut.bouton) haut.relacher();
      haut.avancer();
    }
    expect(haut.finie).toBe(false);
  });
});

describe("le sol fragile", () => {
  /** Un sol fragile sur une rangée du sol : le sol de la colonne 4 à 15 est remplacé par des cases fragiles (une seule rangée), le vide dessous. */
  const pont = (de: number, a: number): string[] => {
    const g = morceau([...trou(de, a)]);
    const l = g.map((x) => x.split(""));
    for (let c = de; c < a; c++) l[10]![c] = "f";
    return l.map((x) => x.join(""));
  };
  it("craque quand on s'y pose, tombe `FRAGILE_DELAI` pas plus tard, et ne revient pas", () => {
    expect(FRAGILE_DELAI).toBe(54);
    const p = sur(pont(4, 16));
    let craque = -1;
    let tombe = -1;
    for (let i = 0; i < 600 && !p.finie; i++) {
      p.avancer();
      if (p.ev & EV_CRAQUE && craque < 0) craque = p.tick - 1;
      if (p.ev & EV_EFFONDREMENT && tombe < 0) tombe = p.tick - 1;
    }
    expect(craque).toBeGreaterThan(0);
    expect(tombe - craque).toBe(FRAGILE_DELAI);
    // Resté dessus : le joueur tombe dans le vide (la cause est le vide, pas une scie).
    expect(p.mort).toBe(MORT_VIDE);
    // Le tronçon est tombé pour de bon : il reste tombé, tout le temps.
    expect(p.fragiles).toHaveLength(1);
    expect(p.fragiles[0]).toMatchObject({ cy: 10, t0: craque });
  });
  it("on peut s'y poser, pas y rester : un joueur qui part avant la chute (il inverse la gravité) est sauf", () => {
    const p = sur(pont(4, 16));
    for (let i = 0; i < 400 && !p.finie; i++) {
      if (i === 40) p.appuyer();
      else if (p.bouton) p.relacher();
      p.avancer();
    }
    expect(p.finie).toBe(false);
    expect(p.g).toBe(-1);
  });
  it("ne craque pas sans contact : en l'air au-dessus, rien ne se passe", () => {
    const p = sur(pont(4, 16));
    p.appuyer();
    avancer(p, 3);
    p.relacher();
    avancer(p, 20);
    // Le joueur est parti au plafond avant d'arriver sur le pont : rien n'a craqué.
    expect(p.fragiles).toHaveLength(0);
  });
  it("une case fragile est solide tant qu'elle n'est pas tombée, et la copie de la partie la partage sans la modifier", () => {
    const p = sur(pont(4, 16));
    avancer(p, 60);
    const c = p.copier(true);
    expect(c.fragiles).toBe(p.fragiles);
    avancer(c, 200);
    // La copie a joué plus loin : l'originale n'a pas changé.
    expect(p.tick).toBe(60);
  });
  it("la partie rejouée est identique (le serveur rejoue la même chose que le jeu)", () => {
    const terrain = terrainDeTest([pont(4, 16)]);
    const changements = [40, 41, 160, 161];
    const a = jouer(terrain, changements);
    const b = jouer(terrain, changements);
    expect(a).toEqual(b);
  });
});
