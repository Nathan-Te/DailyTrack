import { describe, expect, it } from "vitest";
import { avancerChute, commencerChute, rayonDePiece } from "../src/chute";
import { Gerbe, GOUTTES_MAX, VIE_ONDE } from "../src/gerbe";
import { hasardAffichage } from "../src/hasardAffichage";
import { NIVEAU_MER, Z } from "../src/profondeurs";

// Lot T5 — le décor des pièces tombées : elles passent DEVANT la mer (derrière l'eau de devant), touchent l'eau une fois, finissent dans une gerbe d'eau aplatie, puis disparaissent.
describe("les pièces tombées passent devant la mer", () => {
  it("l'ordre des profondeurs : la mer du fond, puis la pièce tombée, puis l'eau de devant, les vagues et la gerbe ; toujours derrière le pilier, la plateforme et la tour", () => {
    expect(Z.mer).toBeLessThan(Z.chute);
    expect(Z.vagues).toBeGreaterThan(Z.merAvant); // les vagues sont posées SUR l'eau de devant
    expect(Z.chute).toBeGreaterThan(Z.mer);
    expect(Z.chute).toBeGreaterThan(-7); // plus derrière les vagues du fond comme au lot T1 (−7,5 sous −7)
    expect(Z.chute).toBeLessThan(Z.merAvant);
    expect(Z.merAvant).toBeLessThan(Z.gerbe + 1);
    expect(Z.gerbe).toBeGreaterThan(Z.merAvant);
    expect(Z.merAvant).toBeLessThan(Z.pilier);
    expect(Z.pilier).toBeLessThan(Z.plateforme);
    expect(Z.plateforme).toBeLessThan(1); // les pièces de la tour (z ≥ 1) sont devant tout
    expect(NIVEAU_MER).toBeLessThan(0);
  });

  it("la chute : le plouf a lieu une seule fois, quand le point le plus bas touche l'eau ; la pièce coule puis disparaît", () => {
    const c = commencerChute(4, 2, 0.3, 1.5, -1, 2, 1.2);
    let plouf = 0;
    let yAuPlouf = NaN;
    let t = 0;
    while (!c.finie && t < 20) {
      if (avancerChute(c, 1 / 60)) {
        plouf++;
        yAuPlouf = c.y;
      }
      t += 1 / 60;
    }
    expect(plouf).toBe(1);
    expect(c.finie).toBe(true);
    expect(c.plouf).toBe(true);
    // Le plouf : le point le plus bas (centre − rayon) vient d'atteindre la mer.
    expect(yAuPlouf - c.rayon).toBeLessThanOrEqual(NIVEAU_MER + 0.2);
    expect(avancerChute(c, 1 / 60)).toBe(false);
    expect(t).toBeLessThan(10);
  });

  it("la chute continue sur la lancée de la pièce perdue (vitesse horizontale gardée en l'air, gravité)", () => {
    const c = commencerChute(0, 5, 0, 2, 0, 1, 1);
    for (let i = 0; i < 30; i++) avancerChute(c, 1 / 60);
    expect(c.x).toBeCloseTo(1, 1);
    expect(c.vy).toBeLessThan(-4);
    expect(c.angle).toBeCloseTo(0.5, 1);
  });

  it("le rayon d'une pièce est la plus grande distance d'un coin à son centre", () => {
    expect(rayonDePiece([{ cx: 0, cy: 0, hw: 8, hh: 8 }])).toBeCloseTo(Math.SQRT2, 5);
    expect(rayonDePiece([{ cx: 8, cy: 0, hw: 16, hh: 4 }])).toBeGreaterThan(3);
  });
});

describe("la gerbe d'eau aplatie", () => {
  it("jaillit bas et large sur la surface, à vie courte, plafonnée", () => {
    const g = new Gerbe();
    const h = hasardAffichage(3);
    g.declencher(2, 1, h);
    expect(g.gouttes.length).toBeGreaterThan(5);
    expect(g.gouttes.every((x) => x.y === NIVEAU_MER)).toBe(true);
    expect(g.gouttes.filter((x) => x.genre === "onde")).toHaveLength(2);
    // Aplatie : plus large que haute.
    let xMax = 0;
    let yMax = 0;
    for (let i = 0; i < 40; i++) {
      g.avancer(1 / 60);
      for (const x of g.gouttes) {
        if (x.genre === "goutte") {
          xMax = Math.max(xMax, Math.abs(x.x - 2));
          yMax = Math.max(yMax, x.y - NIVEAU_MER);
        }
      }
    }
    expect(xMax).toBeGreaterThan(yMax);
    for (let i = 0; i < 90; i++) g.avancer(1 / 60);
    expect(g.gouttes).toHaveLength(0);
    for (let i = 0; i < 20; i++) g.declencher(0, 1, h);
    expect(g.gouttes.length).toBeLessThanOrEqual(GOUTTES_MAX);
    expect(VIE_ONDE).toBeLessThan(1);
    g.vider();
    expect(g.gouttes).toHaveLength(0);
  });

  it("une plus grande pièce fait un plus grand jet ; le hasard est celui de l'affichage (même graine, même gerbe)", () => {
    const nombre = (force: number): number => {
      const g = new Gerbe();
      g.declencher(0, force, hasardAffichage(1));
      return g.gouttes.length;
    };
    expect(nombre(1)).toBeGreaterThan(nombre(0));
    const a = new Gerbe();
    const b = new Gerbe();
    a.declencher(0, 0.5, hasardAffichage(8));
    b.declencher(0, 0.5, hasardAffichage(8));
    expect(a.gouttes).toEqual(b.gouttes);
  });
});
