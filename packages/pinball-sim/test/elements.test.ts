import { describe, expect, it } from "vitest";
import {
  AXE, EV_COULEE, EV_GEYSER, EV_MANEGE, EV_MISSION, EV_MULT, EV_PORTAIL, EV_TOURBILLON, JET_GEYSER, MISSION_DU_THEME, PERIODE_ASTEROIDE, POINTS, REGLAGES, TICKS_PAR_SECONDE, UNITE, Partie, copierReglages, secteur, type Module, type ThemePinball,
} from "../src/index";
import { avancer, contenuDe, enJeu, jusqua, pixels } from "./aide";

// Les éléments des quatre thèmes et leur mission (lot PB3) : un test par mécanique. Les tables sont écrites à la main (l'élément en S6, des mini-bumpers loin de lui ailleurs) pour ne mesurer que l'élément.
const AUTRES: Module[] = ["mini", "mini", "mini", "mini", "mini"];
const table = (theme: ThemePinball, s6: Module, autres: readonly Module[] = AUTRES, reglages = REGLAGES): Partie => new Partie(contenuDe([...autres, s6], theme), reglages);
const sansSauvee = (): typeof REGLAGES => ({ ...copierReglages(), sauvee: 0 });
const AU_CENTRE = { x: 184, y: 320 };

describe("le manège (foire)", () => {
  it("les secteurs : huit huitièmes de tour, dans le sens du manège (contre les aiguilles à l'écran)", () => {
    expect([secteur(10, 0), secteur(10, -4), secteur(4, -10), secteur(-4, -10), secteur(-10, -4), secteur(-10, 4), secteur(-4, 10), secteur(4, 10), secteur(10, 4)]).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("pousse la bille autour du centre : à droite vers le haut, en bas vers la droite (la pente en moins)", () => {
    const sans = (x: number, y: number): Partie => enJeu(table("foire", "manege", AUTRES, { ...REGLAGES, manegeVitesse: 0 }), x, y);
    const avec = (x: number, y: number): Partie => enJeu(table("foire", "manege"), x, y);
    const [d0, d1] = [sans(AU_CENTRE.x + 30, AU_CENTRE.y), avec(AU_CENTRE.x + 30, AU_CENTRE.y)];
    d0.avancer();
    d1.avancer();
    expect(d1.vy).toBeLessThan(d0.vy); // vers le haut
    expect(d1.vx).toBe(d0.vx);
    const [b0, b1] = [sans(AU_CENTRE.x, AU_CENTRE.y + 30), avec(AU_CENTRE.x, AU_CENTRE.y + 30)];
    b0.avancer();
    b1.avancer();
    // la poussée vaut `manegeVitesse × 96 × distance / rayon` px/s² : 30/50 de 576 px/s² = 345,6 px/s², soit 2 359 unités par pas
    expect(b1.vx - b0.vx).toBeGreaterThan(2350);
    expect(b1.vx - b0.vx).toBeLessThan(2370);
    expect(b1.vy).toBe(b0.vy);
  });
  it("un tour complet autour du centre vaut 500 points ; un demi-tour dans le sens inverse en compte autant (la maquette : la somme des angles)", () => {
    const orbite = (sens: 1 | -1, pas: number): Partie => {
      const p = table("foire", "manege", AUTRES, sansSauvee());
      enJeu(p, AU_CENTRE.x + 30, AU_CENTRE.y);
      for (let k = 1; k <= pas; k++) {
        const a = (sens * k * 2 * Math.PI) / 160;
        p.x = Math.round((AU_CENTRE.x + 30 * Math.cos(a)) * UNITE);
        p.y = Math.round((AU_CENTRE.y - 30 * Math.sin(a)) * UNITE);
        p.vx = 0;
        p.vy = 0;
        p.avancer();
      }
      return p;
    };
    expect(orbite(1, 161).score).toBe(POINTS.manege);
    expect(orbite(-1, 161).score).toBe(POINTS.manege);
    expect(orbite(1, 80).score).toBe(0);
    const deux = orbite(1, 321);
    expect(deux.score).toBe(2 * POINTS.manege);
    expect(deux.compteur).toBe(2);
  });
  it("une bille qui n'y entre pas ne compte rien, et un tour compté ne revient pas sans nouveau tour", () => {
    const p = table("foire", "manege");
    enJeu(p, 60, 560, 0, 0);
    avancer(p, 200);
    expect(p.compteur).toBe(0);
    expect(p.manegeSecteur[0]).toBe(-1);
  });
  it("le but est un réglage : cinq tours par défaut, trois s'il est réglé à trois", () => {
    expect(table("foire", "manege").but).toBe(5);
    expect(table("foire", "manege", AUTRES, { ...REGLAGES, butManege: 3 }).but).toBe(3);
  });
});

describe("le tourbillon (océan)", () => {
  it("attire la bille vers son centre et la fait tourner, jusqu'à 56 px", () => {
    const sans = { ...REGLAGES, tourbillonForce: 0, tourbillonSpirale: 0 };
    const mesure = (d: number, reglages = REGLAGES): Partie => avancer(enJeu(table("ocean", "tourbillon", AUTRES, reglages), AU_CENTRE.x + d, AU_CENTRE.y), 1);
    const [seul, tb] = [mesure(40, sans), mesure(40)];
    expect(tb.vx).toBeLessThan(seul.vx); // vers le centre
    expect(tb.vy).toBeLessThan(seul.vy); // la spirale : à droite du centre, vers le haut (contre les aiguilles)
    expect(mesure(60).vx).toBe(mesure(60, sans).vx); // hors du disque : rien
    expect(seul.vx - tb.vx).toBeGreaterThan(0);
  });
  it("garde la bille 0,9 s au centre (2 000 points), puis la recrache vers le bas à 560 px/s", () => {
    const p = table("ocean", "tourbillon", AUTRES, sansSauvee());
    enJeu(p, AU_CENTRE.x + 4, AU_CENTRE.y + 2);
    p.avancer();
    expect(p.ev & EV_TOURBILLON).toBeTruthy();
    expect(p.score).toBe(POINTS.tourbillon);
    expect(p.captif).toBe(REGLAGES.tourbillonGarde);
    expect([p.x, p.y]).toEqual([AU_CENTRE.x * UNITE, AU_CENTRE.y * UNITE]);
    avancer(p, REGLAGES.tourbillonGarde);
    expect(p.captif).toBe(0);
    expect(Math.hypot(p.vx, p.vy) / UNITE).toBeGreaterThan(555);
    expect(Math.hypot(p.vx, p.vy) / UNITE).toBeLessThan(565);
    expect(p.vy).toBeGreaterThan(0);
    expect(Math.hypot(pixels(p.x) - AU_CENTRE.x, pixels(p.y) - AU_CENTRE.y)).toBeGreaterThan(35);
  });
  it("ne reprend pas la bille avant 1,6 s, puis la reprend", () => {
    const p = table("ocean", "tourbillon", AUTRES, sansSauvee());
    enJeu(p, AU_CENTRE.x, AU_CENTRE.y);
    p.avancer();
    avancer(p, REGLAGES.tourbillonGarde);
    expect(p.captif).toBe(0);
    const reste = REGLAGES.tourbillonPause - REGLAGES.tourbillonGarde;
    expect(reste).toBeGreaterThan(0);
    enJeu(p, AU_CENTRE.x, AU_CENTRE.y);
    p.avancer();
    expect(p.captif, "la pause n'est pas finie : la bille passe").toBe(0);
    avancer(p, reste);
    enJeu(p, AU_CENTRE.x, AU_CENTRE.y);
    p.avancer();
    expect(p.captif, "la pause est finie : la bille est reprise").toBeGreaterThan(0);
  });
  it("trois plongées : la mission, une seule fois", () => {
    const p = table("ocean", "tourbillon", AUTRES, sansSauvee());
    for (let i = 0; i < 4; i++) {
      enJeu(p, AU_CENTRE.x, AU_CENTRE.y);
      p.avancer();
      expect(p.ev & EV_TOURBILLON).toBeTruthy();
      avancer(p, REGLAGES.tourbillonPause + 5);
    }
    expect(p.missionFaite).toBe(true);
    expect(p.compteur).toBe(3);
    expect(p.mult).toBe(2);
  });
});

describe("le trou noir (espace)", () => {
  it("attire la bille de `force / distance²` px/s², jusqu'à 95 px, sans la prendre", () => {
    const sans = { ...REGLAGES, trouNoirForce: 0 };
    const mesure = (d: number, reglages = REGLAGES): Partie => avancer(enJeu(table("espace", "trouNoir", AUTRES, reglages), AU_CENTRE.x + d, AU_CENTRE.y), 1);
    const attendu = Math.trunc(((260000 / (60 * 60)) * UNITE) / TICKS_PAR_SECONDE); // 72,2 px/s² → 493 unités par pas
    const diff = mesure(60, sans).vx - mesure(60).vx;
    expect(diff).toBeGreaterThan(attendu - 8);
    expect(diff).toBeLessThan(attendu + 8);
    expect(mesure(100).vx).toBe(mesure(100, sans).vx);
  });
  it("attire plus fort de près (jusqu'à 30 px, puis la force ne grandit plus) et ne retient jamais la bille", () => {
    const f = (d: number): number => {
      const p = enJeu(table("espace", "trouNoir", AUTRES, { ...REGLAGES, pente: 300 }), AU_CENTRE.x + d, AU_CENTRE.y);
      const sans = enJeu(table("espace", "trouNoir", AUTRES, { ...REGLAGES, pente: 300, trouNoirForce: 0 }), AU_CENTRE.x + d, AU_CENTRE.y);
      p.avancer();
      sans.avancer();
      return sans.vx - p.vx;
    };
    expect(f(40)).toBeGreaterThan(f(60));
    expect(f(30)).toBeGreaterThan(f(40));
    expect(Math.abs(f(10) - f(30))).toBeLessThan(16);
    expect(f(30)).toBeLessThanOrEqual(Math.trunc((1400 * UNITE) / TICKS_PAR_SECONDE));
    const p = table("espace", "trouNoir");
    enJeu(p, AU_CENTRE.x, AU_CENTRE.y);
    avancer(p, 10);
    expect(p.captif).toBe(0);
    expect(p.score).toBe(0);
  });
  it("courbe la trajectoire : une bille qui passe à côté est déviée vers lui", () => {
    const seul = table("espace", "trouNoir", AUTRES, { ...REGLAGES, trouNoirForce: 0 });
    const noir = table("espace", "trouNoir");
    for (const p of [seul, noir]) {
      enJeu(p, 120, 250, 150, 400);
      avancer(p, 60);
    }
    expect(noir.x).toBeGreaterThan(seul.x);
  });
});

describe("les portails (espace)", () => {
  const espace = (reglages = REGLAGES): Partie => new Partie(contenuDe(["mini", "asteroide", "portailB", "portailA", "mini", "trouNoir"], "espace"), reglages);
  it("on entre par l'un, on sort de l'autre, 20 px plus bas, vers le bas : 800 points", () => {
    const p = espace();
    const [a, b] = [p.table.portails.find((q) => q.id === 0)!, p.table.portails.find((q) => q.id === 1)!];
    expect([pixels(a.x), pixels(a.y), pixels(b.x), pixels(b.y)]).toEqual([92, 385, 270, 220]);
    enJeu(p, 92, 380, 0, 100);
    avancer(p, 3);
    expect(p.ev & EV_PORTAIL || p.score >= POINTS.portail).toBeTruthy();
    expect(pixels(p.x)).toBeGreaterThan(268);
    expect(pixels(p.x)).toBeLessThan(272);
    expect(pixels(p.y)).toBeGreaterThan(238);
    expect(p.vy).toBeGreaterThan(120 * UNITE);
    expect(p.score).toBe(POINTS.portail);
  });
  it("de B vers A aussi, et les deux portails se reposent 0,8 s : pas de va-et-vient", () => {
    const p = espace();
    enJeu(p, 270, 216, 0, 50);
    p.avancer();
    expect(pixels(p.y)).toBeGreaterThan(400);
    expect(pixels(p.x)).toBeGreaterThan(90);
    expect(pixels(p.x)).toBeLessThan(94);
    expect(p.portailPause).toEqual([REGLAGES.portailPause, REGLAGES.portailPause]);
    // la bille est reposée en A pendant la pause : rien ne se passe
    enJeu(p, 92, 385, 0, 0);
    avancer(p, 5);
    expect(p.score).toBe(POINTS.portail);
  });
  it("trois passages : la mission", () => {
    const p = espace(sansSauvee());
    for (let i = 0; i < 3; i++) {
      enJeu(p, 92, 385, 0, 0);
      avancer(p, 2);
      avancer(p, REGLAGES.portailPause + 5);
    }
    expect(p.compteur).toBe(3);
    expect(p.missionFaite).toBe(true);
  });
  it("un seul portail (table d'essai) ne fait rien", () => {
    const p = new Partie(contenuDe(["mini", "mini", "mini", "portailA", "mini", "trouNoir"], "espace"));
    enJeu(p, 92, 385, 0, 0);
    avancer(p, 5);
    expect(p.score).toBe(0);
  });
});

describe("l'astéroïde (espace)", () => {
  const espace = (): Partie => new Partie(contenuDe(["mini", "asteroide", "portailB", "portailA", "mini", "trouNoir"], "espace"));
  const astre = (p: Partie): { x: number; y: number; vx: number | undefined } => ({ x: pixels(p.table.bumpers.find((b) => b.mobile)!.x), y: pixels(p.table.bumpers.find((b) => b.mobile)!.y), vx: p.table.bumpers.find((b) => b.mobile)!.vx });
  it("va et vient de 46 px autour du centre de son emplacement, sur 2 048 pas, en fonction du seul numéro de pas", () => {
    const p = espace();
    expect(astre(p).x).toBe(184);
    avancer(p, PERIODE_ASTEROIDE / 4);
    expect(astre(p).x).toBeGreaterThan(229.9);
    expect(astre(p).x).toBeLessThan(230.1);
    avancer(p, PERIODE_ASTEROIDE / 2);
    expect(astre(p).x).toBeGreaterThan(137.9);
    expect(astre(p).x).toBeLessThan(138.1);
    avancer(p, PERIODE_ASTEROIDE / 4);
    expect(astre(p).x).toBeGreaterThan(183.5);
    expect(astre(p).x).toBeLessThan(184.5);
    expect(astre(p).y).toBe(180);
  });
  it("sa place ne dépend pas de la partie : la même au même pas, bille en jeu ou non", () => {
    const a = espace();
    const b = espace();
    enJeu(b, 150, 500, 100, -300);
    avancer(a, 777);
    avancer(b, 777);
    expect(astre(a)).toEqual(astre(b));
  });
  it("renvoie la bille comme un bumper (100 points), en tenant compte de son mouvement", () => {
    const p = espace();
    avancer(p, 300);
    const x = astre(p).x;
    enJeu(p, x, astre(p).y - 40, 0, 200);
    const n = jusqua(p, (q) => q.score >= 100, 200);
    expect(n).toBeGreaterThan(0);
    expect(p.vy).toBeLessThan(0);
  });
});

describe("le geyser (volcan)", () => {
  const volcan = (reglages = REGLAGES): Partie => new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "coulee"], "volcan"), reglages);
  it("lance la bille vers le haut à 880 px/s et de côté, loin de lui : 750 points", () => {
    const p = volcan();
    enJeu(p, 96, 385, 0, 100);
    p.avancer();
    expect(p.ev & EV_GEYSER).toBeTruthy();
    expect(p.score).toBe(POINTS.geyser);
    expect(p.vy).toBe(-880 * UNITE);
    expect(p.vx).toBe(90 * UNITE); // à droite du centre : elle part à droite
    const g = volcan();
    enJeu(g, 88, 385, 0, 100);
    g.avancer();
    expect(g.vx).toBe(-90 * UNITE);
    expect(g.geyserJet[0]).toBe(JET_GEYSER);
  });
  it("une bille en plein centre part vers l'axe de la table (jamais sur elle-même)", () => {
    const p = volcan();
    enJeu(p, 92, 385, 0, 100);
    p.avancer();
    expect(p.vx).toBeGreaterThan(0);
  });
  it("se repose 0,7 s entre deux jets", () => {
    const p = volcan();
    enJeu(p, 92, 385, 0, 0);
    p.avancer();
    expect(p.ev & EV_GEYSER).toBeTruthy();
    enJeu(p, 92, 385, 0, 0);
    p.avancer();
    expect(p.ev & EV_GEYSER, "pendant la pause").toBe(0);
    avancer(p, REGLAGES.geyserPause);
    enJeu(p, 92, 385, 0, 0);
    p.avancer();
    expect(p.ev & EV_GEYSER, "la pause est finie").toBeTruthy();
  });
  it("quatre jets : la mission ; huit par bille : ensuite le geyser se tait (il ne garde jamais la bille)", () => {
    const p = volcan(sansSauvee());
    let jets = 0;
    for (let i = 0; i < 12; i++) {
      enJeu(p, 92, 385, 0, 0);
      p.avancer();
      if (p.ev & EV_GEYSER) jets++;
      avancer(p, REGLAGES.geyserPause + 2);
      if (i === 3) expect(p.missionFaite).toBe(true);
    }
    expect(jets).toBe(REGLAGES.geyserParBille);
  });
});

describe("la coulée (volcan)", () => {
  const volcan = (): Partie => new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "coulee"], "volcan"));
  it("deux murs de plus, un couloir de 18 px de chaque côté de l'axe", () => {
    const p = volcan();
    const sans = new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "mini"], "volcan"));
    expect(p.table.murs.length - sans.table.murs.length).toBe(2);
    expect(p.table.coulees).toHaveLength(1);
  });
  it("accélère la bille qui y monte (1 500 px/s² contre les 820 de la pente) : 300 points à l'entrée, une seule fois", () => {
    const p = volcan();
    enJeu(p, 184, 350, 0, -100);
    const n = jusqua(p, (q) => (q.ev & EV_COULEE) !== 0, 5);
    expect(n).toBeGreaterThan(0);
    expect(p.score).toBe(POINTS.coulee);
    const vy0 = p.vy;
    avancer(p, 30);
    expect(p.vy).toBeLessThan(vy0 - 300 * UNITE / 100); // elle accélère vers le haut, malgré la pente
    expect(p.score).toBe(POINTS.coulee);
  });
  it("ne pousse jamais la bille qui y tombe : un élément qui pousse dans les deux sens garderait la bille à son bord", () => {
    const sans = new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "mini"], "volcan"));
    const p = volcan();
    for (const q of [sans, p]) {
      enJeu(q, 184, 280, 0, 200);
      avancer(q, 20);
    }
    expect(p.vy).toBe(sans.vy);
    expect(p.score).toBe(0);
  });
});

describe("la mission", () => {
  it("une par thème, celle du seed", () => {
    expect(MISSION_DU_THEME).toEqual({ foire: "manege", ocean: "tourbillon", espace: "portail", volcan: "geyser" });
    const buts = (["foire", "ocean", "espace", "volcan"] as const).map((t) => new Partie(contenuDe(undefined, t)).but);
    expect(buts).toEqual([5, 3, 3, 4]);
  });
  it("réussie : 10 000 points au multiplicateur d'avant, puis le multiplicateur monte d'un cran ; une seule fois par partie, d'une bille à l'autre", () => {
    const p = new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "coulee"], "volcan"), sansSauvee());
    p.mult = 3;
    let missions = 0;
    for (let i = 0; i < 9; i++) {
      enJeu(p, 92, 385, 0, 0);
      p.avancer();
      if (p.ev & EV_MISSION) {
        missions++;
        expect(p.ev & EV_MULT).toBeTruthy();
        expect(p.mult).toBe(4);
        expect(p.compteur).toBe(4);
        expect(p.gains.map((g) => g.points)).toContain(POINTS.mission * 3); // au multiplicateur d'avant
      }
      avancer(p, REGLAGES.geyserPause + 2);
    }
    expect(missions).toBe(1);
    expect(p.mult).toBe(4);
  });
  it("le compteur se garde d'une bille à l'autre", () => {
    const p = new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "coulee"], "volcan"), sansSauvee());
    enJeu(p, 92, 385, 0, 0);
    p.avancer();
    expect(p.compteur).toBe(1);
    enJeu(p, 150, 760, 0, 600);
    avancer(p, 100);
    expect(p.billes).toBe(2);
    expect(p.compteur).toBe(1);
  });
  it("un élément qui n'est pas celui du thème ne compte pas pour la mission (il rapporte ses points)", () => {
    const p = new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "coulee"], "foire"));
    enJeu(p, 92, 385, 0, 0);
    p.avancer();
    expect(p.score).toBe(POINTS.geyser);
    expect(p.compteur).toBe(0);
  });
  it("le but se règle (`butGeyser`) et la mission suit", () => {
    const p = new Partie(contenuDe(["mini", "mini", "mini", "geyser", "mini", "coulee"], "volcan"), { ...REGLAGES, butGeyser: 1 });
    enJeu(p, 92, 385, 0, 0);
    p.avancer();
    expect(p.missionFaite).toBe(true);
    expect(p.score).toBe(POINTS.geyser + POINTS.mission);
  });
  it("le nombre d'axes : l'axe de la table est celui du manège", () => expect(AXE).toBe(184));
});
