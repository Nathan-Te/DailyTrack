import { describe, expect, it } from "vitest";
import { daysFromCivil, mixSeed } from "@cdj/core";
import { encoderEnveloppe } from "@cdj/core/enveloppe";
import {
  BIT_COUP,
  BIT_ESQUIVE,
  COEURS,
  COS,
  CHAUVE,
  DIRECTIONS,
  DUREE_TICKS,
  ErreurGenerateur,
  GELEE,
  MAX_CHANGEMENTS,
  MAX_MONSTRES_VAGUE,
  ONDE,
  PAS_MIN_VISEE,
  PIERRES,
  PLONGEON,
  POING,
  RECUPERE,
  Partie,
  REGLAGES_DEFAUT,
  SIN,
  VARIANTE,
  contenuScenario,
  dailyRush,
  decoderRediffusion,
  directionDe,
  empreinteContenu,
  encoderRediffusion,
  enregistrer,
  entree,
  figerJour,
  formatTemps,
  idiv,
  isqrt,
  jouer,
  jouerJusqua,
  jouerLePilote,
  lireJourFige,
  reglagesDe,
  rejouer,
  scoreParColonnes,
  seuilsDe,
  themeDuJour,
  unitaire,
  viseeDe,
  cm,
  type Changement,
  type Monstre,
} from "../src/index";

const J = daysFromCivil(2026, 11, 4);
const BOSS = contenuScenario("boss");

const monstre = (type: number, x: number, y: number): Monstre => ({ id: 900, type, x, y, kx: 0, ky: 0, hp: type === GELEE ? 30 : 10, flash: 0, etat: 0, t: 0, age: 0, a: 0, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0, hx: x, hy: y, alerte: 1, laisse: 0, ra: 0 });
const avancerN = (p: Partie, n: number, e = 0): void => {
  for (let i = 0; i < n; i++) p.avancer(e);
};

describe("les outils entiers", () => {
  it("la table trigonométrique : 128 directions de norme 1 024 (à 0,5 %), orientées comme l'écran", () => {
    expect(COS.length).toBe(DIRECTIONS);
    expect(SIN.length).toBe(DIRECTIONS);
    for (let k = 0; k < DIRECTIONS; k++) expect(Math.abs(Math.hypot(COS[k]!, SIN[k]!) - 1024)).toBeLessThan(6);
    expect([COS[0], SIN[0], COS[32], SIN[32], COS[64], SIN[96]]).toEqual([1024, 0, 0, 1024, -1024, -1024]);
  });
  it("idiv tronque vers zéro sans -0 ; isqrt est exacte", () => {
    expect(Object.is(idiv(-1, 5), 0)).toBe(true);
    expect(idiv(-7, 2)).toBe(-3);
    for (const n of [0, 1, 2, 3, 4, 99, 100, 101, 2 ** 31 + 5, 9e9 - 1, 9e9]) {
      const r = isqrt(n);
      expect(r * r <= n && (r + 1) * (r + 1) > n).toBe(true);
    }
    expect(unitaire(0, 0)).toEqual([0, 0]);
    expect(unitaire(3000, 0)).toEqual([1024, 0]);
  });
  it("l'entrée : direction, coup, esquive dans l'octet bas ; la visée, séparée, dans l'octet haut", () => {
    expect(directionDe(entree(-1))).toBe(-1);
    expect(viseeDe(entree(-1))).toBe(-1);
    for (let d = 0; d < 32; d++) expect(directionDe(entree(d, true, true))).toBe(d);
    for (let v = 0; v < 32; v++) {
      const e = entree(31 - v, v % 2 === 0, v % 3 === 0, v);
      expect([viseeDe(e), directionDe(e)]).toEqual([v, 31 - v]); // la visée ne touche pas à la direction
    }
    expect(entree(5, true, false) & BIT_COUP).toBe(BIT_COUP);
    expect(entree(5, false, true) & BIT_ESQUIVE).toBe(BIT_ESQUIVE);
    expect(entree(31, true, true)).toBeLessThan(256); // sans visée, l'octet bas suffit
    expect(entree(31, true, true, 31)).toBeLessThan(1 << 14);
    expect(viseeDe(63 << 8)).toBe(-1); // une visée hors des 32 directions n'est pas une visée
  });
});

describe("le contenu", () => {
  it("est pur : un jour donne toujours le même contenu, deux jours des graines différentes", () => {
    expect(dailyRush(J)).toEqual(dailyRush(J));
    expect(dailyRush(J).graine).not.toBe(dailyRush(J + 1).graine);
    expect(empreinteContenu(dailyRush(J))).toMatch(/^[0-9a-f]{8}$/);
    expect(empreinteContenu(dailyRush(J))).not.toBe(empreinteContenu(dailyRush(J + 1)));
    expect(() => dailyRush(J, 99)).toThrow(ErreurGenerateur);
    expect(themeDuJour(J)).not.toBe(themeDuJour(J + 1));
  });
  it("les scénarios ont leur contenu et ne dépendent pas du jour", () => {
    expect(contenuScenario("boss").scenario).toBe("boss");
    expect(contenuScenario("boss", { phase2: true }).phase2).toBe(true);
    expect(contenuScenario("arene", { monstres: 99 }).monstres).toBe(40);
    expect(contenuScenario("arene")).toEqual(contenuScenario("arene"));
  });
  it("un jour figé se relit, un fichier altéré non", () => {
    const f = figerJour(J);
    expect(lireJourFige(f)).toEqual(dailyRush(J));
    expect(lireJourFige({ ...f, contenu: { graine: f.contenu.graine + 1 } })).toBeNull();
    expect(lireJourFige({ ...f, sim: 99 })).toBeNull();
    expect(lireJourFige(null)).toBeNull();
  });
});

describe("le chevalier", () => {
  it("marche à la vitesse réglée, dans la direction tenue, et reste dans l'arène", () => {
    const p = new Partie(BOSS);
    const x0 = p.c.x;
    avancerN(p, 60, entree(0)); // vers la droite pendant une seconde
    const parcouru = (p.c.x - x0) / 4096;
    expect(parcouru).toBeGreaterThan((REGLAGES_DEFAUT.vitesse / 100) * 0.98);
    expect(parcouru).toBeLessThan((REGLAGES_DEFAUT.vitesse / 100) * 1.02);
    avancerN(p, 600, entree(0));
    expect(Math.hypot(p.c.x, p.c.y)).toBeLessThanOrEqual(11.5 * 4096);
  });
  it("frappe un monstre dans son arc, pas derrière, et le repousse", () => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    p.monstres = [];
    p.c.dir = 0;
    const devant = monstre(GELEE, p.c.x + cm(150), p.c.y);
    const derriere = monstre(GELEE, p.c.x - cm(150), p.c.y);
    derriere.id = 901;
    p.monstres.push(devant, derriere);
    avancerN(p, 1, entree(-1, true));
    avancerN(p, 12, 0);
    expect(devant.hp).toBe(30 - 16);
    expect(devant.x).toBeGreaterThan(p.c.x + cm(150));
    expect(derriere.hp).toBe(30);
    expect(p.evenements.some((e) => e.k === "touche")).toBe(true);
  });
  it("un coup ne touche qu'une fois ; l'enchaînement tenu fait 16, 16 puis 40 de dégâts (×1,6, le coup final ×2,5)", () => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    p.monstres = [];
    p.c.dir = 0;
    const m = monstre(GELEE, p.c.x + cm(120), p.c.y);
    m.hp = 9999;
    p.monstres.push(m);
    const pv: number[] = [];
    for (let t = 0; t < 120; t++) {
      p.avancer(entree(-1, true)); // le bouton reste tenu : un seul changement d'entrée
      if (p.evenements.some((e) => e.k === "touche" && e.tick === p.tick)) pv.push(m.hp);
      m.x = p.c.x + cm(120); // le monstre reste à portée
      m.y = p.c.y;
      m.kx = 0;
      m.ky = 0;
      m.gel = 0;
    }
    const coups = p.evenements.filter((e) => e.k === "coup").map((e) => e.a);
    expect(coups.slice(0, 4)).toEqual([0, 1, 2, 0]);
    const touches = p.evenements.filter((e) => e.k === "touche").map((e) => e.a);
    expect(touches.slice(0, 3)).toEqual([0, 1, 2]); // un seul « touche » par coup
    expect(9999 - pv[0]!).toBe(16);
    expect(pv[0]! - pv[1]!).toBe(16);
    expect(pv[1]! - pv[2]!).toBe(40);
  });
  it("un coup dure 30 ticks (le coup final 42) : anticipation de 6 ticks, impact, récupération qui va au bout ; la boucle tenue garde ce rythme", () => {
    const p = new Partie(contenuScenario("mannequin"), REGLAGES_DEFAUT, true);
    expect(p.dureeCoup(0)).toBe(30);
    expect(p.dureeCoup(2)).toBe(42);
    expect(p.impactCoup(0)).toBe(6);
    expect(p.impactCoup(2)).toBe(8);
    p.c.x = 0;
    p.c.y = cm(900); // loin de tout : seul le rythme compte
    for (let i = 0; i < 400; i++) p.avancer(entree(-1, true));
    const coups = p.evenements.filter((e) => e.k === "coup");
    expect(coups.slice(0, 7).map((e) => e.a)).toEqual([0, 1, 2, 0, 1, 2, 0]);
    expect(coups.slice(1, 7).map((e, i) => e.tick - coups[i]!.tick)).toEqual([30, 30, 42, 30, 30, 42]);
  });
  it("un appui isolé ne se perd pas mais n'écourte pas le coup en cours : le coup suivant part à la fin du premier", () => {
    const p = new Partie(contenuScenario("mannequin"), REGLAGES_DEFAUT, true);
    p.c.y = cm(900);
    avancerN(p, 1, entree(-1, true));
    avancerN(p, 19, 0);
    avancerN(p, 1, entree(-1, true)); // second appui au tick 20 du premier coup
    avancerN(p, 60, 0);
    const coups = p.evenements.filter((e) => e.k === "coup");
    expect(coups.map((e) => e.a)).toEqual([0, 1]);
    expect(coups[1]!.tick - coups[0]!.tick).toBe(30);
  });
  it("pendant un coup, le chevalier avance à 40 % de sa vitesse dans la direction tenue (il s'engage), puis la marche reprend à sa vitesse", () => {
    const p = new Partie(contenuScenario("mannequin"), REGLAGES_DEFAUT, true);
    p.c.x = 0;
    p.c.y = cm(900);
    p.c.dir = 0;
    const x0 = p.c.x;
    avancerN(p, 30, entree(0, true)); // un coup (tenu) en marchant à droite : le premier coup dure 30 ticks
    const pendantLeCoup = (p.c.x - x0) / 30;
    const marche = idiv(cm(REGLAGES_DEFAUT.vitesse), 60);
    expect(pendantLeCoup).toBeGreaterThan(marche * 0.38);
    expect(pendantLeCoup).toBeLessThan(marche * 0.42);
    expect(REGLAGES_DEFAUT.vitesse).toBe(468); // la marche est 10 % moins vite qu'au BR0b (520)
  });
  it("le recul est fort, surtout au coup final : la cible glisse puis titube, sans rien faire", () => {
    const p = new Partie(contenuScenario("mannequin"), REGLAGES_DEFAUT, true);
    p.c.x = 0;
    p.c.y = cm(900);
    p.c.dir = 96;
    const cible = p.monstres[2]!; // (0, 210) cm : on l'amène à portée
    cible.x = 0;
    cible.y = p.c.y - cm(150);
    p.monstres.length = 0;
    p.monstres.push(cible);
    const y0 = cible.y;
    avancerN(p, 1, entree(-1, true));
    avancerN(p, 12, entree(-1, true));
    expect(y0 - cible.y).toBeGreaterThan(cm(120)); // glissade dans le sens du coup (vers le haut de l'écran)
    expect(cible.gel).toBeGreaterThan(0); // il titube
    // le coup final : encore plus loin
    const q = new Partie(contenuScenario("mannequin"), REGLAGES_DEFAUT, true);
    q.c.x = 0;
    q.c.y = cm(900);
    q.c.dir = 96;
    const c2 = q.monstres[2]!;
    q.monstres.length = 0;
    q.monstres.push(c2);
    let dmax = 0;
    for (let i = 0; i < 110; i++) {
      c2.x = 0;
      if (q.evenements.length === 0 || q.evenements.filter((e) => e.k === "coup").length < 3) c2.y = q.c.y - cm(140);
      q.avancer(entree(-1, true));
      const touches = q.evenements.filter((e) => e.k === "touche");
      if (touches.length === 3) dmax = Math.max(dmax, q.c.y - cm(140) - c2.y);
    }
    expect(dmax).toBeGreaterThan(cm(250));
  });
  it("l'esquive rend invincible pendant sa fenêtre, puis plus", () => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    p.monstres = [];
    avancerN(p, 1, entree(0, false, true));
    expect(p.c.esq).toBeGreaterThan(0);
    const m = monstre(GELEE, p.c.x, p.c.y);
    p.monstres.push(m);
    avancerN(p, 2, entree(0));
    expect(p.c.coeurs).toBe(COEURS);
    avancerN(p, REGLAGES_DEFAUT.fenetreEsquive + 5, entree(-1));
    m.x = p.c.x;
    m.y = p.c.y;
    m.gel = 0;
    m.t = 0;
    avancerN(p, 1, 0);
    expect(p.c.coeurs).toBe(COEURS - 1);
    expect(p.evenements.some((e) => e.k === "degats")).toBe(true);
  });
  it("après un dégât, le chevalier est invincible un moment (pas de dégât en rafale)", () => {
    const p = new Partie(BOSS);
    const m = monstre(GELEE, p.c.x, p.c.y);
    p.monstres.push(m);
    avancerN(p, 1, 0);
    expect(p.c.coeurs).toBe(COEURS - 1);
    m.gel = 0;
    m.x = p.c.x;
    m.y = p.c.y;
    avancerN(p, 1, 0);
    expect(p.c.coeurs).toBe(COEURS - 1);
  });
});

describe("les monstres", () => {
  it("la gelée s'écrase environ 30 ticks avant de bondir vers le chevalier, par bonds", () => {
    const p = new Partie(contenuScenario("arene"));
    p.monstres = [];
    const g = monstre(GELEE, 0, -cm(800));
    g.t = 0;
    p.monstres.push(g);
    const d0 = Math.hypot(g.x - p.c.x, g.y - p.c.y);
    avancerN(p, p.durees.geleeAnnonce - 1, entree(-1));
    expect(Math.hypot(g.x - p.c.x, g.y - p.c.y)).toBeCloseTo(d0, -1); // elle s'écrase : elle n'avance pas
    expect(p.durees.geleeAnnonce).toBe(30);
    avancerN(p, 160, entree(-1));
    expect(Math.hypot(g.x - p.c.x, g.y - p.c.y)).toBeLessThan(d0 - cm(250));
  });
  it("les monstres vont 30 % moins vite qu'au prototype (gelée 3,36 m/s, chauve-souris 3,92 m/s, plongeon 8,05 m/s)", () => {
    const p = new Partie(contenuScenario("arene"));
    p.monstres = [];
    const g = monstre(GELEE, 0, -cm(800));
    g.t = p.durees.geleeAnnonce - 1; // le bond part au tick suivant
    g.cx = 0;
    g.cy = 1024;
    p.monstres.push(g);
    const y0 = g.y;
    avancerN(p, 6, entree(-1));
    const v = ((g.y - y0) / 6 / 4096) * 60; // m/s
    expect(v).toBeGreaterThan(3.3);
    expect(v).toBeLessThan(3.4);
  });
  it("la chauve-souris s'annonce 45 ticks avant de plonger", () => {
    const p = new Partie(contenuScenario("arene"));
    expect(p.durees.chauveAnnonce).toBe(45);
    p.monstres = [];
    const b = monstre(CHAUVE, cm(450), 0);
    b.duree = 5;
    p.monstres.push(b);
    let debut = -1;
    let fin = -1;
    for (let i = 0; i < 200 && fin < 0; i++) {
      p.c.degat = 99;
      p.avancer(0);
      if (b.etat === 1 && debut < 0) debut = p.tick;
      if (b.etat === PLONGEON && fin < 0) fin = p.tick;
    }
    expect(fin - debut).toBe(45);
  });
  it("la chauve-souris tourne, s'annonce, plonge puis se repose", () => {
    const p = new Partie(contenuScenario("arene"));
    p.monstres = [];
    const b = monstre(CHAUVE, cm(450), 0);
    b.duree = 20;
    p.monstres.push(b);
    const etats = new Set<number>();
    for (let i = 0; i < 260; i++) {
      p.c.degat = 99; // pas de dégât pendant l'essai
      p.avancer(0);
      etats.add(b.etat);
    }
    expect([...etats].sort()).toEqual([0, 1, 2, 3]);
    expect(PLONGEON).toBe(2);
  });
});

describe("le golem", () => {
  it("annonce chacune de ses trois attaques par un cercle avant de frapper", () => {
    const p = new Partie(BOSS, REGLAGES_DEFAUT, true);
    const vus = new Set<number>();
    for (let i = 0; i < 1500 && !p.finie; i++) {
      p.c.degat = 999;
      p.avancer(0);
      for (const z of p.zones) {
        expect(z.ti).toBeGreaterThan(p.tick - 1);
        vus.add(z.type);
      }
    }
    expect([...vus].sort()).toEqual([0, 1, 2]);
    const annonces = p.evenements.filter((e) => e.k === "annonce").map((e) => e.a);
    expect(new Set(annonces)).toEqual(new Set([0, 1, 2]));
    // une annonce précède toujours son impact
    for (const imp of p.evenements.filter((e) => e.k === "impact")) {
      const avant = p.evenements.filter((e) => e.k === "annonce" && e.tick < imp.tick);
      expect(avant.length).toBeGreaterThan(0);
    }
  });
  /** Joue le golem face à un chevalier immobile et invincible : rend, pour chaque cercle annoncé (à sa pose), la phase, le rang, son annonce, et pour chaque récupération sa durée. */
  function observerGolem(phase2: boolean, ticks: number, reglages = REGLAGES_DEFAUT): { annonces: { phase: number; type: number; rang: number; annonce: number }[]; recups: { phase: number; duree: number }[]; ondes: number[]; coupsDuGolem: number } {
    const p = new Partie(contenuScenario("boss", { phase2 }), reglages, true);
    const vus = new Set<object>();
    const annonces: { phase: number; type: number; rang: number; annonce: number }[] = [];
    const recups: { phase: number; duree: number }[] = [];
    const ondes: number[] = [];
    let recup = 0;
    for (let i = 0; i < ticks && !p.finie; i++) {
      p.c.degat = 999;
      p.avancer(0);
      for (const z of p.zones) if (!vus.has(z)) {
        vus.add(z);
        annonces.push({ phase: p.golem!.phase, type: z.type, rang: z.rang, annonce: z.ti - z.t0 });
      }
      if (p.golem!.etat === RECUPERE) recup++;
      else if (recup > 0) {
        recups.push({ phase: p.golem!.phase, duree: recup });
        recup = 0;
      }
      for (const e of p.evenements) if (e.k === "onde") ondes.push(e.tick);
      p.vider();
    }
    return { annonces, recups, ondes, coupsDuGolem: p.evenements.length };
  }
  it("annonce chaque attaque d'au moins 70 ticks en phase 1 et 50 en phase 2, second coup compris", () => {
    const un = observerGolem(false, 2400);
    const types1 = new Set(un.annonces.filter((a) => a.phase === 1).map((a) => a.type));
    expect(types1).toEqual(new Set([POING, ONDE, PIERRES]));
    for (const a of un.annonces.filter((a) => a.phase === 1)) expect(a.annonce).toBeGreaterThanOrEqual(70);
    const deux = observerGolem(true, 3000);
    for (const a of deux.annonces) expect(a.annonce).toBeGreaterThanOrEqual(50);
    expect(deux.annonces.some((a) => a.type === POING && a.rang === 1)).toBe(true); // le second coup est annoncé, lui aussi
    expect(deux.annonces.filter((a) => a.type === POING && a.rang === 1).every((a) => a.annonce >= 50)).toBe(true);
  });
  it("récupère au moins 80 ticks après chaque attaque en phase 1 et 55 en phase 2, sans frapper", () => {
    const un = observerGolem(false, 2400);
    expect(un.recups.length).toBeGreaterThanOrEqual(3);
    for (const r of un.recups) expect(r.duree).toBeGreaterThanOrEqual(80);
    const deux = observerGolem(true, 3000);
    expect(deux.recups.length).toBeGreaterThanOrEqual(3);
    for (const r of deux.recups) expect(r.duree).toBeGreaterThanOrEqual(55);
    // Aucun cercle n'est posé pendant une récupération.
    const p = new Partie(BOSS, REGLAGES_DEFAUT, true);
    for (let i = 0; i < 2400; i++) {
      p.c.degat = 999;
      p.avancer(0);
      if (p.golem!.etat === RECUPERE) expect(p.zones.every((z) => z.ti >= p.tick - 1)).toBe(true);
    }
  });
  it("les deux ondes de la phase 2 sont espacées de 70 ticks", () => {
    const o = observerGolem(true, 3000).ondes;
    expect(o.length).toBeGreaterThanOrEqual(2);
    expect(o[1]! - o[0]!).toBe(70);
  });
  it("le curseur « rythme » multiplie d'un coup les durées (et les vitesses) des ennemis", () => {
    const lent = observerGolem(false, 3000, { ...REGLAGES_DEFAUT, rythme: 50 });
    const normal = observerGolem(false, 3000);
    const vite = observerGolem(false, 3000, { ...REGLAGES_DEFAUT, rythme: 200 });
    expect(lent.annonces[0]!.annonce).toBe(normal.annonces[0]!.annonce * 2);
    expect(vite.annonces[0]!.annonce).toBe(Math.round(normal.annonces[0]!.annonce / 2));
    expect(lent.recups[0]!.duree).toBe(normal.recups[0]!.duree * 2);
    const p100 = new Partie(contenuScenario("arene"));
    const p200 = new Partie(contenuScenario("arene"), { ...REGLAGES_DEFAUT, rythme: 200 });
    expect(p200.durees.geleeCycle).toBeLessThan(p100.durees.geleeCycle);
    expect(Math.abs(p200.vOnde() - p100.vOnde() * 2)).toBeLessThanOrEqual(1);
    expect(reglagesDe({ rythme: 5 }).rythme).toBe(40);
    expect(reglagesDe({ rythme: 999 }).rythme).toBe(200);
  });
  it("la phase 2 commence sous 50 % de vie (le golem rugit, invulnérable)", () => {
    const p = new Partie(BOSS, REGLAGES_DEFAUT, true);
    p.golem!.hp = idiv(p.golem!.hpMax, 2) + 1;
    p.c.x = p.golem!.x;
    p.c.y = p.golem!.y + cm(300);
    p.c.dir = 96;
    avancerN(p, 1, entree(-1, true));
    avancerN(p, 12, 0);
    expect(p.golem!.phase).toBe(2);
    expect(p.evenements.find((e) => e.k === "touche")!.b).toBe(3); // le coup qui fait passer le golem en phase 2 le dit (le jeu y met son arrêt sur image)
    expect(p.evenements.some((e) => e.k === "phase2")).toBe(true);
  });
  it("le scénario de phase 2 commence à 50 % de vie", () => {
    const p = new Partie(contenuScenario("boss", { phase2: true }));
    expect(p.golem!.phase).toBe(2);
    expect(p.golem!.hp).toBe(idiv(REGLAGES_DEFAUT.golemVie, 2));
  });
  it("un joueur immobile perd ; le chrono s'arrête à la défaite", () => {
    const r = jouer(BOSS, []);
    expect(r.victoire).toBe(false);
    expect(r.coeurs).toBeLessThanOrEqual(0);
    expect(r.ticks).toBeLessThan(DUREE_TICKS);
    expect(VARIANTE.score(r)).toEqual([DUREE_TICKS]);
  });
  it("le pilote le fait tomber et le chrono s'arrête à sa chute", () => {
    const { resultat, ticks } = jouerLePilote(BOSS);
    expect(resultat.victoire).toBe(true);
    expect(resultat.ticks).toBe(ticks);
    expect(resultat.ticks).toBeGreaterThan(900); // jamais en moins de quinze secondes (le golem ne tombe pas aussi vite qu'au prototype)
  });
  it("un joueur immobile met plus de dix secondes à perdre (les attaques sont plus lentes qu'au prototype)", () => {
    const r = jouer(BOSS, []);
    expect(r.ticks).toBeGreaterThan(600);
  });
});

describe("la visée et le coup tenu (lot BR0b)", () => {
  const nu = (): Partie => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    p.monstres = [];
    return p;
  };
  it("avec une visée, le chevalier regarde où il vise, même à l'arrêt, et marche où il veut", () => {
    const p = nu();
    avancerN(p, 1, entree(-1, false, false, 8)); // il vise vers le bas de l'écran
    expect(p.c.dir).toBe(32);
    const x0 = p.c.x;
    avancerN(p, 30, entree(0, false, false, 8)); // il marche vers la droite en regardant vers le bas
    expect(p.c.x).toBeGreaterThan(x0 + cm(200));
    expect(p.c.dir).toBe(32);
    avancerN(p, 1, entree(0, false, false, 24)); // la visée tourne : il regarde vers le haut
    expect(p.c.dir).toBe(96);
  });
  it("sans visée, il regarde où il va (comme au prototype)", () => {
    const p = nu();
    avancerN(p, 2, entree(8));
    expect(p.c.dir).toBe(32);
  });
  it("le coup part où il vise, pas où il marche", () => {
    const p = nu();
    const cible = monstre(GELEE, p.c.x, p.c.y + cm(140)); // en bas
    cible.hp = 99;
    p.monstres.push(cible);
    avancerN(p, 1, entree(24, true, false, 8)); // il marche vers le haut, vise vers le bas, frappe
    avancerN(p, 8, entree(24, false, false, 8));
    expect(cible.hp).toBeLessThan(99);
    expect(p.evenements.find((e) => e.k === "coup")!.b).toBe(32);
  });
  it("la visée est exacte : pas d'assistance vers un ennemi proche", () => {
    const p = nu();
    p.monstres.push(monstre(GELEE, p.c.x + cm(150), p.c.y)); // à droite
    avancerN(p, 1, entree(-1, true, false, 8)); // il vise vers le bas
    expect(p.evenements.find((e) => e.k === "coup")!.b).toBe(32);
  });
  it("sans visée, la visée est assistée vers l'ennemi proche", () => {
    const p = nu();
    p.monstres.push(monstre(GELEE, p.c.x + cm(150), p.c.y));
    avancerN(p, 1, entree(-1, true));
    expect(p.evenements.find((e) => e.k === "coup")!.b).toBe(0);
  });
  it("l'esquive part dans la direction du déplacement ; à l'arrêt, vers la visée", () => {
    const a = nu();
    avancerN(a, 1, entree(0, false, true, 24)); // il marche à droite, vise en haut
    expect(a.evenements.find((e) => e.k === "esquive")!.a).toBe(0);
    const b = nu();
    avancerN(b, 1, entree(-1, false, true, 24)); // à l'arrêt, vise en haut
    expect(b.evenements.find((e) => e.k === "esquive")!.a).toBe(96);
    const c = nu();
    const dir0 = c.c.dir;
    avancerN(c, 1, entree(-1, false, true)); // ni déplacement ni visée : où il regarde
    expect(c.evenements.find((e) => e.k === "esquive")!.a).toBe(dir0);
  });
  it("un coup TENU enchaîne les trois coups en boucle, à la cadence du combo ; relâché, il s'arrête", () => {
    const p = nu();
    p.c.dir = 0;
    avancerN(p, 1, entree(-1, true)); // un seul changement d'entrée : le bit reste tenu
    avancerN(p, 239, entree(-1, true));
    const coups = p.evenements.filter((e) => e.k === "coup");
    expect(coups.slice(0, 7).map((e) => e.a)).toEqual([0, 1, 2, 0, 1, 2, 0]);
    // Les coups se suivent sans trou : jamais plus d'un coup + 4 ticks entre deux départs.
    const ecarts = coups.slice(1, 7).map((e, i) => e.tick - coups[i]!.tick);
    for (const e of ecarts) expect(e).toBeLessThanOrEqual(REGLAGES_DEFAUT.cadence * 1.4 + 4);
    const avant = coups.length;
    avancerN(p, 60, 0); // relâché
    p.vider();
    avancerN(p, 60, 0);
    expect(p.evenements.filter((e) => e.k === "coup").length).toBe(0);
    expect(avant).toBeGreaterThanOrEqual(7);
  });
  it("un simple appui bref ne donne qu'un coup", () => {
    const p = nu();
    avancerN(p, 1, entree(-1, true));
    avancerN(p, 150, 0);
    expect(p.evenements.filter((e) => e.k === "coup").length).toBe(1);
  });
  it("la rediffusion garde la visée : une partie avec visée se rejoue exactement", () => {
    const changements: Changement[] = Array.from({ length: 300 }, (_, i) => ({ tick: i * 7, e: entree((i * 5) % 32, i % 3 === 0, i % 11 === 0, i % 4 === 0 ? -1 : (i * 3) % 32) }));
    const a = jouer(dailyRush(J), changements);
    const texte = enregistrer(dailyRush(J), changements);
    expect(decoderRediffusion(texte).changements).toEqual(changements);
    expect(rejouer(dailyRush(J), texte)).toEqual(a);
    const sansVisee = changements.map((c) => ({ ...c, e: c.e & 255 }));
    expect(jouerJusqua(dailyRush(J), sansVisee, 500).empreinte).not.toBe(jouerJusqua(dailyRush(J), changements, 500).empreinte); // la visée change la partie
  });
  it("refuse un octet de visée hors des 64 valeurs, et la visée ne change pas plus d'une fois tous les 4 ticks côté jeu", () => {
    expect(() => decoderRediffusion(encoderEnveloppe({ sim: 2, g: 1, contenu: { jour: J }, charge: [5, 17, 200] }))).toThrow();
    expect(PAS_MIN_VISEE).toBe(4);
  });
});

describe("l'arène", () => {
  it("par défaut, des vagues d'au plus 8 monstres à la fois, avec une pause entre deux vagues", () => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    let max = 0;
    let vagues = 0;
    let avant = p.monstres.length;
    for (let i = 0; i < 6000; i++) {
      p.avancer(0);
      max = Math.max(max, p.monstres.length);
      if (p.monstres.length > avant) vagues++;
      avant = p.monstres.length;
      // le chevalier élimine tout ce qui approche : la vague suivante vient après une pause
      if (i % 600 === 599) for (const m of p.monstres) m.hp = 0;
    }
    expect(max).toBeLessThanOrEqual(MAX_MONSTRES_VAGUE);
    expect(vagues).toBeGreaterThanOrEqual(2);
  });
  it("une vague ne vient pas tant que le terrain n'est pas presque vide, et seulement après la pause", () => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    avancerN(p, 3000, 0); // le chevalier immobile n'élimine rien
    expect(p.monstres.length).toBeLessThanOrEqual(4);
    for (const m of p.monstres) m.hp = 0;
    p.monstres = [];
    const t0 = p.tick;
    let t1 = -1;
    for (let i = 0; i < 400 && t1 < 0; i++) {
      p.avancer(0);
      if (p.monstres.length > 0) t1 = p.tick;
    }
    expect(t1 - t0).toBeGreaterThanOrEqual(150); // la pause
    expect(t1).toBeGreaterThan(0);
  });
  it("garde les monstres vivants au nombre demandé, borné à 40", () => {
    const p = new Partie(contenuScenario("arene", { monstres: 30 }));
    avancerN(p, 3600, 0);
    expect(p.monstres.length).toBeLessThanOrEqual(40);
    const q = new Partie(contenuScenario("arene", { monstres: 30 }));
    for (let i = 0; i < 4000; i++) {
      q.c.degat = 99;
      q.avancer(0);
    }
    expect(q.monstres.length).toBeGreaterThanOrEqual(25);
  });
  it("la vitrine est une scène figée qui reproduit la cible (un golem qui annonce, quatre gelées, deux chauves-souris)", () => {
    const p = new Partie(contenuScenario("vitrine"), REGLAGES_DEFAUT, true);
    expect(p.monstres.filter((m) => m.type === GELEE).length).toBe(4);
    expect(p.monstres.filter((m) => m.type === CHAUVE).length).toBe(2);
    expect(p.golem!.attaque).toBe(POING);
    expect(p.zones.length).toBe(1);
    expect(p.zones[0]!.ti).toBeGreaterThan(p.tick); // le cercle n'a pas encore frappé
    expect(p.zones[0]!.t0).toBeLessThan(p.tick);
    expect(Math.floor(p.tick / 60)).toBe(21); // le chrono de la cible : 00:21
    expect(p.finie).toBe(false);
    expect(p.immortel).toBe(true);
  });
  it("le chevalier ne meurt pas dans l'arène : il retrouve ses cœurs", () => {
    const p = new Partie(contenuScenario("arene"));
    avancerN(p, 4000, 0);
    expect(p.perdue).toBe(false);
    expect(p.c.coeurs).toBeGreaterThan(0);
  });
});

describe("le déterminisme", () => {
  it("deux parties identiques donnent exactement le même état à chaque tick", () => {
    const a = new Partie(contenuScenario("arene"));
    const b = new Partie(contenuScenario("arene"));
    const entreesAlea = (t: number): number => entree(mixSeed(t, 5) % 40 < 32 ? mixSeed(t >> 3, 9) % 32 : -1, mixSeed(t, 6) % 5 === 0, mixSeed(t, 7) % 31 === 0);
    for (let t = 0; t < 3000; t++) {
      a.avancer(entreesAlea(t));
      b.avancer(entreesAlea(t));
    }
    expect(JSON.stringify([a.c, a.monstres, a.golem, a.zones, a.ondes])).toBe(JSON.stringify([b.c, b.monstres, b.golem, b.zones, b.ondes]));
  });
  it("tout l'état reste entier, sans NaN ni -0", () => {
    const p = new Partie(contenuScenario("arene", { monstres: 30 }), REGLAGES_DEFAUT);
    const entiers = (v: unknown): boolean => (typeof v === "number" ? Number.isInteger(v) && !Object.is(v, -0) : Array.isArray(v) ? v.every(entiers) : typeof v === "object" && v !== null ? Object.values(v).every(entiers) : true);
    for (let t = 0; t < 4000; t++) {
      p.avancer(entree((t >> 4) % 32, t % 7 === 0, t % 45 === 0));
      if (t % 100 === 0) expect(entiers([p.c, p.monstres, p.golem, p.zones, p.ondes])).toBe(true);
    }
  });
});

describe("la rediffusion", () => {
  const { changements, resultat } = jouerLePilote(dailyRush(J));
  const texte = enregistrer(dailyRush(J), changements);
  it("se rejoue au bit près et donne le score classé", () => {
    expect(rejouer(dailyRush(J), texte)).toEqual(resultat);
    expect(scoreParColonnes(resultat)).toEqual({ temps: resultat.ticks });
    const r = decoderRediffusion(texte);
    expect(r.changements).toEqual(changements);
    expect(encoderRediffusion(r)).toBe(texte);
  });
  it("est refusée sur un autre jour, sur un scénario, ou si elle est illisible", () => {
    expect(() => rejouer(dailyRush(J + 1), texte)).toThrow(/jour/);
    expect(() => rejouer(contenuScenario("boss"), texte)).toThrow(/jour/);
    expect(() => decoderRediffusion("pas une rediffusion")).toThrow();
    expect(() => decoderRediffusion(encoderEnveloppe({ sim: 1, g: 1, contenu: { jour: J }, charge: [5, 17, 9] }))).toThrow(); // un changement sans son octet
    expect(() => decoderRediffusion(42)).toThrow();
  });
  it("refuse trop de changements", () => {
    const trop: Changement[] = Array.from({ length: MAX_CHANGEMENTS + 1 }, (_, i) => ({ tick: i + 1, e: (i % 2) + 1 }));
    expect(() => decoderRediffusion(encoderRediffusion({ sim: 1, g: 1, contenu: { jour: J }, changements: trop }))).toThrow();
  });
  it("une partie vide est valide et vaut le pire temps", () => {
    const vide = jouer(dailyRush(J), []);
    expect(vide.victoire).toBe(false);
    expect(VARIANTE.score(vide)).toEqual([DUREE_TICKS]);
  });
  it("un réglage de la sensation change la partie (et donc n'est pas classable)", () => {
    expect(reglagesDe({ vitesse: 99999, inconnu: 3 }).vitesse).toBe(900);
    expect(reglagesDe(null)).toEqual(REGLAGES_DEFAUT);
    const lent = jouer(BOSS, changements, { ...REGLAGES_DEFAUT, vitesse: 300 });
    expect(lent).not.toEqual(jouer(BOSS, changements));
  });
});

describe("le temps et les médailles", () => {
  it("s'écrit minutes:secondes,centièmes", () => {
    expect(formatTemps(60 * 83 + 27, "fr")).toBe("1:23,45");
    expect(formatTemps(60 * 83 + 27, "en")).toBe("1:23.45");
    expect(formatTemps(0, "fr")).toBe("0:00,00");
    expect(formatTemps(DUREE_TICKS, "fr")).toBe("10:00,00");
  });
  it("le Diamant est le temps du pilote ; or, argent, bronze à 130, 160 et 200 %", () => {
    const s = seuilsDe(dailyRush(J));
    const a = s.author;
    expect(s).toEqual({ author: a, gold: idiv(a * 130, 100), silver: idiv(a * 160, 100), bronze: idiv(a * 200, 100) });
    expect([a, a + 1, s.gold + 1, s.silver + 1, s.bronze + 1].map((t) => VARIANTE.medaille([t], s))).toEqual(["author", "gold", "silver", "bronze", null]);
  });
});
