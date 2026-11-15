import { describe, expect, it } from "vitest";
import {
  AXE, DROITE, EV_BANQUE, EV_BUMPER, EV_CIBLE, EV_LANCE, EV_MULT, EV_PERDUE, EV_SAUVEE, EV_SLING, EV_SPINNER, EV_TROU, EV_VOIE, GAUCHE, LANCEUR, MULT_MAX, NB_BILLES, POINTS, UNITE, copierReglages, DUREE_MAX_TICKS, REGLAGES,
  pointeDuBatteur, Partie,
} from "../src/index";
import { avancer, contenuDe, enJeu, jusqua, partieDe, pixels, pleine } from "./aide";

describe("les batteurs", () => {
  it("montent quand on presse, redescendent quand on relâche, et gardent leurs deux butées", () => {
    const p = partieDe();
    const { repos, haut, montee, descente } = { repos: p.a[GAUCHE], haut: -1095, montee: 104, descente: 56 };
    expect(p.a).toEqual([repos, repos]);
    p.regler(GAUCHE, true);
    const n = jusqua(p, (x) => x.a[GAUCHE] === haut);
    expect(n).toBe(Math.ceil((repos - haut) / montee));
    expect(p.a[DROITE]).toBe(repos); // l'autre n'a pas bougé
    p.regler(GAUCHE, false);
    expect(jusqua(p, (x) => x.a[GAUCHE] === repos)).toBe(Math.ceil((repos - haut) / descente));
    avancer(p, 200);
    expect(p.a[GAUCHE]).toBe(repos);
  });
  it("le batteur droit est l'image du gauche dans l'axe de la table", () => {
    const g = pointeDuBatteur(GAUCHE, 700);
    const d = pointeDuBatteur(DROITE, 700);
    expect(g.px + d.px).toBe(2 * AXE * UNITE);
    expect(g.tx + d.tx).toBe(2 * AXE * UNITE);
    expect(g.ty).toBe(d.ty);
    expect(g.py).toBe(d.py);
  });
  it("un batteur levé chasse la bille vers le haut ; au repos elle roule vers le trou", () => {
    const frappee = partieDe(pleine("trou"));
    enJeu(frappee, 150, 640, 0, 80);
    frappee.regler(GAUCHE, true);
    avancer(frappee, 30);
    expect(frappee.vy).toBeLessThan(-300 * UNITE);
    const roule = enJeu(partieDe(pleine("trou")), 135, 610);
    expect(jusqua(roule, (x) => x.vx > 0 && pixels(x.y) > 640, 1200)).toBeGreaterThan(0);
  });
});

describe("les lance-pierres", () => {
  it("renvoient la bille qui les frappe de face, et comptent 10 points", () => {
    const p = enJeu(partieDe(pleine("trou")), 92, 505, -300, 0); // la face du lance-pierre gauche va de (42, 468) à (92, 574) : la bille arrive de la droite
    let ev = 0;
    for (let i = 0; i < 400 && !(ev & EV_SLING); i++) {
      p.avancer();
      ev |= p.ev;
    }
    expect(ev & EV_SLING).toBeTruthy();
    expect(p.score).toBeGreaterThanOrEqual(POINTS.sling);
  });
  it("ne frappent pas la bille qui roule dessus lentement", () => {
    const p = enJeu(partieDe(pleine("trou")), 70, 480);
    avancer(p, 100);
    expect(p.score).toBeLessThanOrEqual(POINTS.sling);
  });
});

describe("les modules communs", () => {
  it("le trio de bumpers : 100 points au contact, la bille repart vite", () => {
    const p = enJeu(partieDe(["spinner", "bumpers", "cibles", "cibles", "trou", "mini"]), 184, 154 - 20); // au-dessus du bumper du haut (184, 154), rayon 17 + 9
    p.vy = 400 * UNITE;
    const n = jusqua(p, (x) => (x.ev & EV_BUMPER) !== 0, 600);
    expect(n).toBeGreaterThan(0);
    expect(p.score).toBe(POINTS.bumper);
    expect(p.vy).toBeLessThan(0);
    expect(Math.hypot(p.vx, p.vy)).toBeGreaterThan(300 * UNITE);
  });
  it("la paire de mini-bumpers : 100 points", () => {
    const p = enJeu(partieDe(pleine("mini")), 184 - 24, 180 - 12 - 12, 0, 300);
    expect(jusqua(p, (x) => (x.ev & EV_BUMPER) !== 0, 600)).toBeGreaterThan(0);
    expect(p.score).toBeGreaterThanOrEqual(POINTS.bumper);
  });
  it("une cible touchée tombe (250 points) ; les trois tombées donnent 2 000 de plus puis la banque se relève", () => {
    const p = partieDe(["spinner", "bumpers", "cibles", "spinner", "trou", "mini"]);
    const [a, b, c] = p.table.banques[0]!.map((k) => p.table.murs[k]!);
    const milieu = (s: typeof a): [number, number] => [pixels((s!.ax + s!.bx) / 2), pixels((s!.ay + s!.by) / 2)];
    // la cible est en travers, face aux batteurs : on la touche par en bas, de son centre
    for (const [i, s] of [a, b, c].entries()) {
      const [x, y] = milieu(s);
      enJeu(p, x, y + 14, 0, -300);
      const fait = jusqua(p, (q) => q.bas[p.table.banques[0]![i]!]!, 300);
      expect(fait, `cible ${i}`).toBeGreaterThan(0);
    }
    expect(p.score).toBe(3 * POINTS.cible + POINTS.banque);
    expect(p.banqueDans[0]).toBeGreaterThan(0);
    avancer(p, REGLAGES.banqueRelevee + 2);
    expect(p.bas.every((v) => !v)).toBe(true);
  });
  it("le spinner : 50 points par passage, et il tourne", () => {
    const p = enJeu(partieDe(pleine("spinner")), 100, 232, 0, -500); // S1 est au centre (100, 220) ; on le traverse de bas en haut
    p.table.murs.length = 0; // sans ses parois : seul le capteur compte
    p.table.poteaux.length = 0;
    let ev = 0;
    let tourne = 0;
    for (let i = 0; i < 100; i++) {
      p.avancer();
      ev |= p.ev;
      tourne = Math.max(tourne, p.spin[0]!);
    }
    expect(ev & EV_SPINNER).toBeTruthy();
    expect(p.score).toBe(POINTS.spinner);
    expect(tourne).toBeGreaterThan(0);
    expect(p.spin[0]).toBeLessThan(tourne); // il ralentit
  });
  it("le trou garde la bille 0,9 s, rapporte 1 500, puis la relance ; il ne reprend pas tout de suite", () => {
    const p = enJeu(partieDe(["bumpers", "bumpers", "bumpers", "bumpers", "trou", "bumpers"]), 276, 385 - 20, 0, 150);
    expect(jusqua(p, (x) => x.captif > 0, 900)).toBeGreaterThan(0);
    expect(p.score).toBe(POINTS.trou);
    expect(pixels(p.x)).toBeCloseTo(276, 0);
    const gardee = jusqua(p, (x) => x.captif === 0, 700);
    expect(gardee).toBe(REGLAGES.trouGarde);
    expect(p.vy).toBeGreaterThan(0); // le trou la renvoie vers le bas à gauche
    expect(p.vx).toBeLessThan(0);
    expect(Math.hypot(p.vx, p.vy)).toBeGreaterThan(REGLAGES.trouVitesse * UNITE * 0.9);
    expect(p.trouPause[0]).toBeGreaterThan(0);
  });
  it("le trou ne prend pas une bille trop rapide", () => {
    const p = enJeu(partieDe(pleine("trou")), 100, 220 - 40, 0, 900);
    avancer(p, 80);
    expect(p.score).toBe(0);
  });
});

describe("les trois couloirs du haut et le multiplicateur", () => {
  const lampes = [152, 192, 232];
  const passer = (p: Partie, x: number): void => {
    enJeu(p, x, 85, 0, 120);
    jusqua(p, (q) => pixels(q.y) > 118, 1000);
  };
  it("chaque couloir allumé vaut 100 ; les trois valent 1 000 de plus, et le multiplicateur monte d'un cran", () => {
    const p = partieDe(pleine("trou"));
    p.table.poteaux.length = 0;
    passer(p, lampes[0]!);
    expect(p.score).toBe(POINTS.voie);
    passer(p, lampes[1]!);
    expect(p.mult).toBe(1);
    passer(p, lampes[2]!);
    expect(p.score).toBe(3 * POINTS.voie + POINTS.trouVoies); // le total est compté au multiplicateur d'avant
    expect(p.mult).toBe(2);
    expect(p.voiesAllumees.every(Boolean)).toBe(true);
    avancer(p, REGLAGES.voiesRelevees + 1);
    expect(p.voiesAllumees.some(Boolean)).toBe(false); // les lampes s'éteignent
  });
  it("le multiplicateur multiplie les points suivants, plafonne à ×6 et se garde d'une bille à l'autre", () => {
    const p = partieDe(pleine("trou"));
    p.table.poteaux.length = 0;
    for (let k = 0; k < 8; k++) {
      p.voiesAllumees.fill(false);
      for (const x of lampes) passer(p, x);
    }
    expect(p.mult).toBe(MULT_MAX);
    expect(p.multMax).toBe(MULT_MAX);
    const avant = p.score;
    p.table.bumpers.length = 0;
    enJeu(p, 200, 400);
    p.table.bumpers.push({ x: p.x, y: p.y + 20 * UNITE, r: 17 * UNITE, kick: 0 }); // un bumper tout contre la bille
    avancer(p, 3);
    expect(p.score - avant).toBeGreaterThan(0);
    expect((p.score - avant) % (POINTS.bumper * MULT_MAX)).toBe(0); // chaque contact vaut 100 × 6
    // une bille perdue : la suivante garde le multiplicateur
    p.sauvee = true;
    enJeu(p, 184, 790, 0, 300);
    avancer(p, 3);
    expect(p.billes).toBe(NB_BILLES - 1);
    expect(p.mult).toBe(MULT_MAX);
    expect(p.dansLanceur).toBe(true);
  });
});

describe("le lanceur", () => {
  it("la force dépend de la durée d'appui : plus on tient, plus la bille part vite", () => {
    const vitesse = (appui: number): number => {
      const p = partieDe();
      p.regler(LANCEUR, true);
      avancer(p, appui);
      p.regler(LANCEUR, false);
      avancer(p, 1);
      expect(p.ev & EV_LANCE).toBeTruthy();
      expect(p.dansLanceur).toBe(false);
      return -p.vy / UNITE;
    };
    const [court, moyen, long, tropLong] = [20, 150, 400, 900].map(vitesse) as [number, number, number, number];
    expect(court).toBeGreaterThan(REGLAGES.lanceurBase - 20);
    expect(moyen).toBeGreaterThan(court);
    expect(long).toBeGreaterThan(moyen);
    expect(tropLong).toBeGreaterThanOrEqual(long);
    expect(tropLong).toBeLessThanOrEqual(REGLAGES.lanceurBase + REGLAGES.lanceurPlus);
    expect(tropLong).toBeGreaterThan(REGLAGES.lanceurBase + REGLAGES.lanceurPlus - 25); // la charge est pleine après 0,83 s
  });
  it("sans appui, la bille reste dans le couloir ; un lancer faible retombe dans le couloir", () => {
    const p = partieDe();
    avancer(p, 300);
    expect(p.dansLanceur).toBe(true);
    expect(pixels(p.y)).toBe(700);
    p.regler(LANCEUR, true);
    avancer(p, 3);
    p.regler(LANCEUR, false);
    avancer(p, 1);
    expect(p.dansLanceur).toBe(false);
    expect(jusqua(p, (x) => x.dansLanceur, 4000)).toBeGreaterThan(0); // 3 pas de charge : elle ne monte pas assez et revient
    expect(p.billes).toBe(NB_BILLES);
  });
});

describe("la bille sauvée", () => {
  const perdre = (p: Partie): void => {
    enJeu(p, 184, 790, 0, 300);
    avancer(p, 1);
  };
  it("une bille perdue dans les 5 s qui suivent son entrée en jeu revient au lanceur, une fois par bille", () => {
    const p = partieDe();
    avancer(p, 100);
    perdre(p);
    expect(p.ev & EV_SAUVEE).toBeTruthy();
    expect(p.billes).toBe(NB_BILLES);
    expect(p.dansLanceur).toBe(true);
    expect(p.sauvee).toBe(true);
    avancer(p, 100);
    perdre(p); // la même bille : plus de seconde chance
    expect(p.ev & EV_PERDUE).toBeTruthy();
    expect(p.billes).toBe(NB_BILLES - 1);
    expect(p.sauvee).toBe(false); // la bille suivante a la sienne
  });
  it("après 5 s en jeu, la bille perdue est perdue", () => {
    const p = partieDe();
    enJeu(p, 184, 400);
    avancer(p, REGLAGES.sauvee + 1);
    enJeu(p, 184, 790, 0, 300);
    p.entree = 0;
    avancer(p, 2);
    expect(p.billes).toBe(NB_BILLES - 1);
  });
  it("la constante passe à 0 sans autre changement : la fonction n'existe plus", () => {
    const p = partieDe(undefined, { ...copierReglages(), sauvee: 0 });
    perdre(p);
    expect(p.billes).toBe(NB_BILLES - 1);
    expect(p.ev & EV_SAUVEE).toBe(0);
  });
});

describe("la fin de la partie", () => {
  it("la partie finit quand la dernière bille est perdue", () => {
    const p = partieDe(undefined, { ...copierReglages(), sauvee: 0 });
    for (let i = 0; i < NB_BILLES; i++) {
      expect(p.finie).toBe(false);
      enJeu(p, 184, 790, 0, 300);
      avancer(p, 2);
    }
    expect(p.finie).toBe(true);
    expect(p.billes).toBe(0);
    const t = p.tick;
    p.avancer();
    expect(p.tick).toBe(t); // plus rien ne bouge
    expect(p.resultat()).toEqual({ score: 0, ticks: t, billes: 0, multMax: 1 });
  });
  it("la partie finit aussi à la durée maximale, bille encore en jeu", () => {
    const p = partieDe();
    for (let i = 0; i < DUREE_MAX_TICKS + 5 && !p.finie; i++) p.avancer();
    expect(p.finie).toBe(true);
    expect(p.tick).toBe(DUREE_MAX_TICKS);
    expect(p.billes).toBe(NB_BILLES);
  });
  it("un jour a toujours ses trois billes au départ", () => {
    const p = new Partie(contenuDe());
    expect(p.billes).toBe(3);
    expect(p.mult).toBe(1);
    expect(p.score).toBe(0);
  });
  it("un trou ou un module n'empêche pas les événements : les bits du pas se remettent à zéro", () => {
    const p = partieDe();
    p.ev = EV_TROU | EV_VOIE | EV_MULT | EV_CIBLE | EV_BANQUE;
    p.avancer();
    expect(p.ev & (EV_TROU | EV_VOIE | EV_MULT | EV_CIBLE | EV_BANQUE)).toBe(0);
  });
});
