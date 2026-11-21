import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import {
  EV_BUMPER, EV_CIBLE, EV_COMBO, EV_ORBITE, EV_RAIL, EV_RAMPE, EV_RECUL, EV_SLING, DROITE, GAUCHE, NORME, PLANS, POINTS, REGLAGES, UNITE, Partie, copierReglages, decoderRediffusion, dailyPinball, enregistrer, planDe,
  type Contenu, type Module, type Porte, type Reglages, type ThemePinball,
} from "../src/index";
import { avancer, enJeu } from "./aide";

// Lot PBG1 — les rails : les rampes et l'orbite. La bille change de couche à la bouche (assez vite), suit le tracé sans toucher le plateau, et le rejoint à la sortie ; trop lente, elle redescend par l'entrée.
const JOUR = 20800;
const contenuDe = (plan: string, theme: ThemePinball = "foire"): Contenu => dailyPinball(JOUR, undefined, theme, plan);
/** La bouche du rail `i` (`bout` 0 : l'entrée) d'une table. */
const bouche = (p: Partie, i: number, bout: 0 | 1 = 0): Porte => p.table.portes.find((g) => g.rail === i && g.bout === bout)!;
/** Une bille 12 px avant la bouche, qui la franchit à `v` px/s dans son sens. */
function versLaBouche(c: Contenu, i: number, v: number, bout: 0 | 1 = 0, reglages: Reglages = REGLAGES): Partie {
  const p = new Partie(c, reglages);
  const g = bouche(p, i, bout);
  p.dansLanceur = false;
  p.entree = 0;
  p.x = g.x - Math.trunc((g.ux * 12 * UNITE) / NORME);
  p.y = g.y - Math.trunc((g.uy * 12 * UNITE) / NORME);
  p.px = p.x;
  p.py = p.y;
  p.vx = Math.trunc((g.ux * v * UNITE) / NORME);
  p.vy = Math.trunc((g.uy * v * UNITE) / NORME);
  return p;
}
/** Joue jusqu'à ce que la bille quitte le rail (ou `max` pas) ; rend ce qui s'est passé. */
function jusquaLaSortie(p: Partie, max = 6000): { pris: boolean; sorti: boolean; pas: number; evenements: number } {
  let pris = false;
  let evenements = 0;
  for (let pas = 0; pas < max && !p.finie; pas++) {
    p.avancer();
    evenements |= p.ev;
    if (p.couche === 1) pris = true;
    else if (pris) return { pris, sorti: true, pas, evenements };
  }
  return { pris, sorti: false, pas: max, evenements };
}
const distanceAuTrace = (p: Partie, i: number): number => {
  const r = p.table.rails[i]!;
  let pire = Infinity;
  for (let k = 0; k < r.ux.length; k++) {
    const ex = r.x[k + 1]! - r.x[k]!;
    const ey = r.y[k + 1]! - r.y[k]!;
    const l2 = ex * ex + ey * ey;
    const u = Math.max(0, Math.min(1, ((p.x - r.x[k]!) * ex + (p.y - r.y[k]!) * ey) / l2));
    pire = Math.min(pire, Math.hypot(p.x - (r.x[k]! + ex * u), p.y - (r.y[k]! + ey * u)) / UNITE);
  }
  return pire;
};

describe("la bouche d'un rail : la vitesse minimale d'entrée", () => {
  for (const plan of PLANS) {
    it(`${plan.id} : à la vitesse minimale la bille est prise et finit le rail ; plus lente, elle ne l'est pas et redescend par l'entrée`, () => {
      const c = contenuDe(plan.id);
      const n = new Partie(c).table.rails.length;
      for (let i = 0; i < n; i++) {
        // juste au-dessus du minimum (le ralentissement de la pente avant la bouche est de quelques px/s)
        const p = versLaBouche(c, i, REGLAGES.rampeVitesseMin + 20);
        const r = jusquaLaSortie(p);
        expect(r.pris, `${plan.id} rail ${i} : prise`).toBe(true);
        expect(r.sorti, `${plan.id} rail ${i} : sortie`).toBe(true);
        expect(p.railsFaits[i], `${plan.id} rail ${i} : mené à son bout`).toBe(1);
        expect(r.evenements & EV_RECUL, `${plan.id} rail ${i} : pas de recul`).toBe(0);
        // trop lente : la bouche est un mur
        const lente = versLaBouche(c, i, REGLAGES.rampeVitesseMin - 80);
        let redescend = false;
        let pris2 = false;
        for (let pas = 0; pas < 400; pas++) {
          lente.avancer();
          if (lente.couche === 1) pris2 = true;
          if (lente.vy > 0) redescend = true;
        }
        expect(pris2, `${plan.id} rail ${i} : trop lente, pas prise`).toBe(false);
        expect(lente.railsFaits[i]).toBe(0);
        expect(redescend, `${plan.id} rail ${i} : la bille redescend`).toBe(true);
      }
    });
  }
  it("une bille qui descend, ou qui passe à côté de la bouche, n'est jamais prise (la bille d'une orbite qui retombe le long du mur la traverse sans s'arrêter)", () => {
    const c = contenuDe("B");
    for (const [dx, dy, vx, vy] of [[0, -30, 0, 900], [40, 10, 0, -900], [-40, 10, 0, -900], [0, 12, 700, 0]] as const) {
      const p = new Partie(c);
      const g = bouche(p, 0);
      enJeu(p, g.x / UNITE + dx, g.y / UNITE + dy, vx, vy);
      avancer(p, 60);
      expect(p.couche).toBe(0);
    }
  });
});

describe("sur un rail : une autre couche", () => {
  it("la bille suit le tracé à moins d'un pixel, et ne touche rien du plateau : ni bumper, ni cible, ni lance-pierre, ni batteur, ni couloir", () => {
    for (const plan of PLANS) {
      const c = { ...contenuDe(plan.id), modules: contenuDe(plan.id).modules.map((m): Module => (m === "trou" ? "trou" : "bumpers")) };
      const n = new Partie(c).table.rails.length;
      for (let i = 0; i < n; i++) {
        const p = versLaBouche(c, i, 900);
        p.regler(GAUCHE, true);
        p.regler(DROITE, true);
        let surRail = 0;
        for (let pas = 0; pas < 6000 && !p.finie; pas++) {
          p.avancer();
          if (p.couche === 1) {
            surRail++;
            expect(p.ev & (EV_BUMPER | EV_CIBLE | EV_SLING), `${plan.id} rail ${i}, pas ${pas}`).toBe(0);
            expect(distanceAuTrace(p, i), `${plan.id} rail ${i}, pas ${pas} : hors du tracé`).toBeLessThan(1);
          } else if (surRail > 0) break;
        }
        expect(surRail, `${plan.id} rail ${i}`).toBeGreaterThan(100);
      }
    }
  });
  it("à la sortie, la bille repart sur le plateau dans le sens du tracé, vers le bas au-dessus d'un couloir de retour (rampes) ou, pour l'orbite, au sommet de la table dans le sens du couloir", () => {
    for (const plan of PLANS) {
      const c = contenuDe(plan.id);
      const n = new Partie(c).table.rails.length;
      for (let i = 0; i < n; i++) {
        const p = versLaBouche(c, i, 900);
        const r = jusquaLaSortie(p);
        expect(r.sorti).toBe(true);
        expect(p.couche).toBe(0);
        const x = p.x / UNITE;
        const y = p.y / UNITE;
        if (p.table.rails[i]!.genre === "rampe") {
          expect(p.vy, `${plan.id} rail ${i}`).toBeGreaterThan(0);
          expect([x < 60 || x > 308, y > 440], `${plan.id} rail ${i} : (${x.toFixed(0)}, ${y.toFixed(0)})`).toEqual([true, true]);
        } else {
          // lot PBT1 : l'orbite ressort en haut de la table, sous l'arc, dans le sens du dernier segment (vers la droite) : dans les couloirs du haut et les bumpers
          expect([y < 100, p.vx > 0, x > 184], `${plan.id} : l'orbite ressort au sommet, vers la droite : (${x.toFixed(0)}, ${y.toFixed(0)})`).toEqual([true, true, true]);
        }
      }
    }
  });
  it("une rampe à vitesse maximale : la bille ressort à moins de 1 500 px/s et ne sort jamais de la table", () => {
    for (const plan of PLANS) {
      const c = contenuDe(plan.id);
      const p = versLaBouche(c, 0, REGLAGES.vitesseMax);
      const r = jusquaLaSortie(p);
      expect(r.sorti).toBe(true);
      expect(Math.hypot(p.vx, p.vy) / UNITE).toBeLessThanOrEqual(REGLAGES.vitesseMax + 1);
      avancer(p, 3000);
      expect(p.y / UNITE).toBeLessThan(800);
    }
  });
});

describe("trop lente sur le rail : la bille redescend par l'entrée", () => {
  it("avec un frottement fort, prise à la vitesse minimale elle n'atteint pas le sommet : elle ressort par l'entrée, vers l'arrière, sans point ni combo", () => {
    const r = { ...copierReglages(), rampeFrottement: 3000 };
    const c = contenuDe("B");
    const p = versLaBouche(c, 0, r.rampeVitesseMin + 20, 0, r);
    const s = jusquaLaSortie(p, 6000);
    expect(s.pris && s.sorti).toBe(true);
    expect(s.evenements & EV_RECUL).toBe(EV_RECUL);
    expect(p.railsFaits[0]).toBe(0);
    expect(p.score).toBe(0);
    expect(p.combo).toBe(0);
    // elle ressort devant la bouche, vers l'arrière
    const g = bouche(p, 0);
    expect(((p.x - g.x) * g.ux + (p.y - g.y) * g.uy) / NORME, "devant la bouche").toBeLessThan(0);
  });
  it("un rail ne garde jamais la bille plus de six secondes, même sur un tracé plat", () => {
    const p = versLaBouche(contenuDe("B"), 1, REGLAGES.rampeVitesseMin + 20);
    p.regler(GAUCHE, false);
    avancer(p, 4000);
    expect(p.railDepuis).toBeLessThan(3700);
  });
});

describe("l'orbite : un couloir qui entre par sa bouche basse et sort au sommet", () => {
  for (const plan of PLANS.filter((q) => q.orbite)) {
    for (const miroir of [false, true]) {
      it(`${plan.id}${miroir ? " (miroir)" : ""} : prise à sa bouche elle sort au sommet, du côté du couloir ; l'orbite rapporte 500 points, plus 50 du spinner du couloir`, () => {
        const c = { ...contenuDe(plan.id), miroir };
        const i = new Partie(c).table.rails.length - 1;
        const p = versLaBouche(c, i, 900);
        // l'orbite n'a qu'une bouche : on ne la prend pas par son autre bout
        expect(new Partie(c).table.portes.filter((g) => g.rail === i)).toHaveLength(1);
        const s = jusquaLaSortie(p);
        expect(s.evenements & EV_ORBITE, plan.id).toBe(EV_ORBITE);
        expect(p.score).toBe(REGLAGES.orbitePoints + POINTS.spinner);
        expect(p.railsFaits[i]).toBe(1);
        expect(p.y / UNITE, "au sommet").toBeLessThan(100);
        // le couloir est à gauche (en miroir, à droite) ; la bille en ressort vers l'autre côté, dans les couloirs du haut
        expect(miroir ? p.x / UNITE < 184 : p.x / UNITE > 184).toBe(true);
      });
    }
  }
});

describe("les points d'une rampe et le combo", () => {
  const c = contenuDe("B");
  it("une rampe rapporte `rampePoints` au multiplicateur courant (×2 : le double)", () => {
    const p = versLaBouche(c, 0, 900);
    p.mult = 2;
    const s = jusquaLaSortie(p);
    expect(s.evenements & EV_RAMPE).toBe(EV_RAMPE);
    expect(p.score).toBe(2 * REGLAGES.rampePoints);
    expect(p.combo).toBe(1);
    expect(s.evenements & EV_COMBO).toBe(0);
  });
  it("un deuxième rail réussi dans le délai fait monter le combo : 1,5 fois, puis 2 fois, jusqu'au rang maximal ; passé le délai, il redescend à 1", () => {
    const p = new Partie(c);
    enJeu(p, 184, 600);
    const gagne: number[] = [];
    let ev = 0;
    for (let k = 0; k < 7; k++) {
      // on rejoue la même rampe : la bille est reposée devant la bouche, le combo et le temps sont ceux de la partie
      const g = bouche(p, 0);
      p.x = g.x - Math.trunc((g.ux * 12 * UNITE) / NORME);
      p.y = g.y - Math.trunc((g.uy * 12 * UNITE) / NORME);
      p.vx = Math.trunc((g.ux * 900 * UNITE) / NORME);
      p.vy = Math.trunc((g.uy * 900 * UNITE) / NORME);
      const avant = p.score;
      const s = jusquaLaSortie(p);
      ev |= s.evenements;
      gagne.push(p.score - avant);
      expect(p.combo, `rail ${k}`).toBe(k + 1);
      // la rampe est refaite tout de suite : on remet la bille à l'abri (le plateau n'est pas l'objet du test)
      p.vx = 0;
      p.vy = 0;
    }
    const r = REGLAGES;
    expect(gagne.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 4].map((k) => r.rampePoints + Math.trunc((r.rampePoints * r.comboPas * k) / 100)));
    expect(gagne[6]).toBe(gagne[5]);
    expect(ev & EV_COMBO).toBe(EV_COMBO);
    expect(p.comboMaxPartie).toBe(7);
    // le délai passé, le prochain rail repart de 1
    p.tick += r.comboDelai + 100;
    const g = bouche(p, 0);
    p.x = g.x - Math.trunc((g.ux * 12 * UNITE) / NORME);
    p.y = g.y - Math.trunc((g.uy * 12 * UNITE) / NORME);
    p.vx = Math.trunc((g.ux * 900 * UNITE) / NORME);
    p.vy = Math.trunc((g.uy * 900 * UNITE) / NORME);
    jusquaLaSortie(p);
    expect(p.combo).toBe(1);
  });
  it("le combo se perd avec la bille ; une rampe puis l'orbite l'enchaînent", () => {
    const p = versLaBouche(c, 0, 900);
    jusquaLaSortie(p);
    const i = p.table.rails.length - 1;
    const g = bouche(p, i);
    p.x = g.x - Math.trunc((g.ux * 12 * UNITE) / NORME);
    p.y = g.y - Math.trunc((g.uy * 12 * UNITE) / NORME);
    p.vx = Math.trunc((g.ux * 900 * UNITE) / NORME);
    p.vy = Math.trunc((g.uy * 900 * UNITE) / NORME);
    const s = jusquaLaSortie(p);
    expect(p.combo).toBe(2);
    expect(s.evenements & EV_COMBO).toBe(EV_COMBO);
    expect(p.score).toBe(REGLAGES.rampePoints + Math.trunc((REGLAGES.orbitePoints * (100 + REGLAGES.comboPas)) / 100) + POINTS.spinner); // + le spinner du couloir, que la bille de l'orbite fait tourner
    // la bille tombe : combo remis à zéro (sans bille sauvée : la bille est perdue)
    const q = new Partie(c, { ...copierReglages(), sauvee: 0 });
    q.combo = 3;
    q.comboFin = 99999;
    enJeu(q, 184, 740, 0, 400);
    avancer(q, 200);
    expect(q.billes).toBe(2);
    expect(q.combo).toBe(0);
  });
  it("les réglages du combo comptent : sans combo (`comboPas` 0), tous les rails rapportent la même chose ; `comboDelai` 0 coupe tout enchaînement", () => {
    const r = { ...copierReglages(), comboPas: 0 };
    const p = new Partie(c, r);
    enJeu(p, 184, 600);
    for (let k = 0; k < 3; k++) {
      const g = bouche(p, 0);
      p.x = g.x - Math.trunc((g.ux * 12 * UNITE) / NORME);
      p.y = g.y - Math.trunc((g.uy * 12 * UNITE) / NORME);
      p.vx = Math.trunc((g.ux * 900 * UNITE) / NORME);
      p.vy = Math.trunc((g.uy * 900 * UNITE) / NORME);
      jusquaLaSortie(p);
    }
    expect(p.score).toBe(3 * r.rampePoints);
    const z = { ...copierReglages(), comboDelai: 0 };
    const q = new Partie(c, z);
    enJeu(q, 184, 600);
    for (let k = 0; k < 2; k++) {
      const g = bouche(q, 0);
      q.x = g.x - Math.trunc((g.ux * 12 * UNITE) / NORME);
      q.y = g.y - Math.trunc((g.uy * 12 * UNITE) / NORME);
      q.vx = Math.trunc((g.ux * 900 * UNITE) / NORME);
      q.vy = Math.trunc((g.uy * 900 * UNITE) / NORME);
      jusquaLaSortie(q);
      expect(q.combo).toBe(1);
    }
  });
});

describe("le mini-batteur : un troisième batteur, qui suit le bouton du batteur du même côté", () => {
  const avecMini = PLANS.filter((p) => p.mini);
  it("un ou deux plans en ont un ; sans lui la table n'en a pas", () => {
    expect(avecMini.length).toBeGreaterThanOrEqual(1);
    for (const p of avecMini) expect([0, 1]).toContain(p.mini!.cote);
    for (const p of PLANS) expect(new Partie(contenuDe(p.id)).table.mini !== null).toBe(p.mini !== undefined);
  });
  for (const plan of avecMini) {
    it(`${plan.id} : une bille posée sur le mini-batteur au repos le suit ; le bouton du batteur du même côté le lève et la lance, pas celui de l'autre côté`, () => {
      const c = contenuDe(plan.id);
      const m = new Partie(c).table.mini!;
      const cote = m.cote;
      const sens = cote === 0 ? 1 : -1;
      const ox = cote === 0 ? m.x : 2 * 184 * UNITE - m.x;
      // le milieu du batteur au repos : 30° sous l'horizontale (la bille y roule vers sa pointe)
      const bx = (ox + sens * Math.trunc((m.longueur * 868) / 1000 / 2)) / UNITE;
      const by = (m.y + Math.trunc((m.longueur * 497) / 1000 / 2)) / UNITE - 14;
      const lancer = (bouton: 0 | 1 | null): { vy: number; y: number } => {
        const p = new Partie(c, { ...copierReglages(), sauvee: 0 });
        enJeu(p, bx, by, 0, 0);
        if (bouton !== null) p.regler(bouton, true);
        avancer(p, 60);
        return { vy: p.vy / UNITE, y: p.y / UNITE };
      };
      const repos = lancer(null);
      const leve = lancer(cote);
      const autre = lancer(cote === 0 ? 1 : 0);
      expect(leve.y, "le batteur levé lance la bille vers le haut").toBeLessThan(by - 25);
      expect(repos.y, "au repos la bille ne remonte pas").toBeGreaterThan(by - 5);
      expect(autre.y, "l'autre bouton ne le lève pas").toBeGreaterThan(by - 5);
    });
    it(`${plan.id} : à 1 500 px/s, 300 tirs autour du mini-batteur ne le traversent jamais (la bille n'est jamais dans sa capsule)`, () => {
      const c = contenuDe(plan.id);
      const rng = new Rng(99);
      const m0 = new Partie(c).table.mini!;
      const ox = m0.cote === 0 ? m0.x : 2 * 184 * UNITE - m0.x;
      for (let i = 0; i < 300; i++) {
        const p = new Partie(c, { ...copierReglages(), sauvee: 0 });
        const a = rng.int(360) * Math.PI / 180;
        const b = rng.int(360) * Math.PI / 180;
        enJeu(p, ox / UNITE + Math.cos(a) * 70, m0.y / UNITE + Math.sin(a) * 70, Math.trunc(Math.cos(b) * 1500), Math.trunc(Math.sin(b) * 1500));
        if (rng.int(2) === 0) p.regler(m0.cote, true);
        for (let k = 0; k < 500 && p.billes === 3 && !p.finie; k++) {
          p.avancer();
          if (p.couche === 1) break;
          // la distance du centre au pivot-pointe (le segment du batteur à son angle courant) reste au-delà du rayon de la capsule
          const ang = (p.a[m0.cote] / 16384) * 2 * Math.PI;
          const px = ox / UNITE;
          const py = m0.y / UNITE;
          const sx = m0.cote === 0 ? 1 : -1;
          const ex = sx * Math.cos(ang) * (m0.longueur / UNITE);
          const ey = Math.sin(ang) * (m0.longueur / UNITE);
          const bxl = p.x / UNITE - px;
          const byl = p.y / UNITE - py;
          const u = Math.max(0, Math.min(1, (bxl * ex + byl * ey) / (ex * ex + ey * ey)));
          const d = Math.hypot(bxl - ex * u, byl - ey * u);
          expect(d, `tir ${i}, pas ${k}`).toBeGreaterThan(4.5);
        }
      }
    });
  }
  it("la rediffusion ne change pas de forme : toujours les trois commandes (le mini-batteur n'a pas de bouton à lui)", () => {
    const c = contenuDe(avecMini[0]!.id);
    const evenements = [{ tick: 10, c: 2 as const, enfonce: true }, { tick: 300, c: 2 as const, enfonce: false }, { tick: 900, c: 0 as const, enfonce: true }, { tick: 1200, c: 0 as const, enfonce: false }];
    const code = enregistrer(c, evenements);
    expect(decoderRediffusion(code).evenements).toEqual(evenements);
  });
});

describe("les plans : la géométrie des rails", () => {
  for (const plan of PLANS) {
    it(`${plan.id} : chaque bouche et chaque sortie est dans la table, hors des murs, et une rampe sort au-dessus d'un couloir de retour`, () => {
      const c = contenuDe(plan.id);
      const t = new Partie(c).table;
      for (const g of t.portes) {
        const x = g.x / UNITE;
        const y = g.y / UNITE;
        expect(x, `${plan.id} bouche`).toBeGreaterThan(24);
        expect(x).toBeLessThan(345);
        expect(y).toBeGreaterThan(200);
        expect(y).toBeLessThan(430);
      }
      t.rails.forEach((r, i) => {
        expect(r.len / UNITE, `${plan.id} rail ${i}`).toBeGreaterThan(300);
        expect(r.len / UNITE).toBeLessThan(900);
        const fin = r.x.length - 1;
        if (r.genre === "rampe") {
          const x = r.x[fin]! / UNITE;
          // l'axe d'un couloir de retour : x = 31 (gauche) ou 337 (droite), entre le mur et le lance-pierre
          expect(Math.min(Math.abs(x - 31), Math.abs(x - 337)), `${plan.id} rampe ${i} : sortie en ${x}`).toBeLessThan(6);
          expect(r.y[fin]!).toBeGreaterThan(430 * UNITE);
        }
      });
    });
  }
  it("plan inconnu : refusé ; le plan d'essai n'a ni rail ni mini-batteur", () => {
    expect(() => planDe("xyz")).toThrow();
    const t = new Partie({ jour: 0, g: 0, theme: "foire", plan: "classique", miroir: false, modules: ["spinner", "bumpers", "cibles", "cibles", "trou", "manege"] }).table;
    expect([t.rails.length, t.portes.length, t.mini]).toEqual([0, 0, null]);
  });
});

describe("les rails ne cassent rien : sur les 16 tables (4 plans × 4 thèmes), un robot-lancer qui tire dans toutes les directions ne laisse jamais la bille ni sur un rail, ni coincée", () => {
  it("bille lancée de la rangée des batteurs, 72 tirs par plan : toujours perdue ou revenue au lanceur en moins de 90 s", () => {
    for (const plan of PLANS) {
      for (const theme of ["foire", "espace"] as const) {
        const c = contenuDe(plan.id, theme);
        for (let k = 0; k < 18; k++) {
          const p = new Partie(c, { ...copierReglages(), sauvee: 0 });
          const a = (50 + 5 * k) * Math.PI / 180;
          const v = 700 + (k % 3) * 400;
          enJeu(p, 130 + 12 * (k % 6), 600, Math.trunc(Math.cos(a) * v), -Math.trunc(Math.sin(a) * v));
          let pas = 0;
          while (p.billes === 3 && !p.dansLanceur && !p.finie && pas < 54000) {
            p.avancer();
            pas++;
          }
          expect(p.billes < 3 || p.dansLanceur, `${plan.id} ${theme} tir ${k}`).toBe(true);
        }
      }
    }
  });
});
