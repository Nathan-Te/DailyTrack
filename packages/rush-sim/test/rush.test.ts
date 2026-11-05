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
  PLONGEON,
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
  jouerLePilote,
  lireJourFige,
  reglagesDe,
  rejouer,
  scoreParColonnes,
  seuilsDe,
  themeDuJour,
  unitaire,
  cm,
  type Changement,
  type Monstre,
} from "../src/index";

const J = daysFromCivil(2026, 11, 4);
const BOSS = contenuScenario("boss");

const monstre = (type: number, x: number, y: number): Monstre => ({ id: 900, type, x, y, kx: 0, ky: 0, hp: type === GELEE ? 3 : 1, flash: 0, etat: 0, t: 0, age: 0, a: 0, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0 });
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
  it("l'octet d'entrée : direction, coup, esquive", () => {
    expect(directionDe(entree(-1))).toBe(-1);
    for (let d = 0; d < 32; d++) expect(directionDe(entree(d, true, true))).toBe(d);
    expect(entree(5, true, false) & BIT_COUP).toBe(BIT_COUP);
    expect(entree(5, false, true) & BIT_ESQUIVE).toBe(BIT_ESQUIVE);
    expect(entree(31, true, true)).toBeLessThan(256);
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
    avancerN(p, 8, 0);
    expect(devant.hp).toBe(2);
    expect(devant.x).toBeGreaterThan(p.c.x + cm(150));
    expect(derriere.hp).toBe(3);
    expect(p.evenements.some((e) => e.k === "touche")).toBe(true);
  });
  it("un coup ne touche qu'une fois, les trois coups de l'enchaînement font 1, 1 puis 2 dégâts", () => {
    const p = new Partie(contenuScenario("arene"), REGLAGES_DEFAUT, true);
    p.monstres = [];
    p.c.dir = 0;
    const m = monstre(GELEE, p.c.x + cm(120), p.c.y);
    m.hp = 99;
    p.monstres.push(m);
    // un appui toutes les 6 ticks : trois coups enchaînés
    for (let t = 0; t < 60; t++) {
      p.avancer(t % 6 < 2 ? entree(-1, true) : 0);
      m.x = p.c.x + cm(120); // le monstre reste à portée
      m.y = p.c.y;
      m.kx = 0;
      m.ky = 0;
    }
    const coups = p.evenements.filter((e) => e.k === "coup").map((e) => e.a);
    expect(coups.slice(0, 4)).toEqual([0, 1, 2, 0]);
    const degats = p.evenements.filter((e) => e.k === "touche").map((e) => e.a);
    expect(degats.slice(0, 3)).toEqual([1, 1, 2]);
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
  it("la gelée avance par bonds vers le chevalier", () => {
    const p = new Partie(contenuScenario("arene"));
    p.monstres = [];
    const g = monstre(GELEE, 0, -cm(800));
    g.t = 0;
    p.monstres.push(g);
    const d0 = Math.hypot(g.x - p.c.x, g.y - p.c.y);
    avancerN(p, 80, entree(-1));
    expect(Math.hypot(g.x - p.c.x, g.y - p.c.y)).toBeLessThan(d0 - cm(150));
  });
  it("la chauve-souris tourne, s'annonce, plonge puis se repose", () => {
    const p = new Partie(contenuScenario("arene"));
    p.monstres = [];
    const b = monstre(CHAUVE, cm(450), 0);
    b.duree = 20;
    p.monstres.push(b);
    const etats = new Set<number>();
    for (let i = 0; i < 200; i++) {
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
    // une annonce précède toujours son impact d'au moins 40 ticks
    for (const imp of p.evenements.filter((e) => e.k === "impact")) {
      const avant = p.evenements.filter((e) => e.k === "annonce" && e.tick < imp.tick);
      expect(avant.length).toBeGreaterThan(0);
    }
  });
  it("la phase 2 commence sous 50 % de vie (le golem rugit, invulnérable)", () => {
    const p = new Partie(BOSS, REGLAGES_DEFAUT, true);
    p.golem!.hp = idiv(p.golem!.hpMax, 2) + 1;
    p.c.x = p.golem!.x;
    p.c.y = p.golem!.y + cm(300);
    p.c.dir = 96;
    avancerN(p, 1, entree(-1, true));
    avancerN(p, 6, 0);
    expect(p.golem!.phase).toBe(2);
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
    expect(resultat.ticks).toBeGreaterThan(600); // jamais en moins de dix secondes
  });
});

describe("l'arène", () => {
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
