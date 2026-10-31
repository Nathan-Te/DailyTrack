import { describe, expect, it } from "vitest";
import { Clignotement, expressionDe, type Genre, NIVEAUX, regardVers } from "../src/expression";
import type { Niveau } from "../src/panique";

// Lot T5 — l'expression des yeux : une fonction pure (état de panique, genre, regard, clignement) → comment dessiner.
const regard = { x: 0.3, y: -0.4 };
const exp = (niveau: Niveau, genre: Genre = "normal", clignement = 0, t = 0) => expressionDe({ niveau, genre, regard, clignement, t });

describe("les quatre états de panique, lisibles", () => {
  it("les yeux s'écarquillent, les pupilles rétrécissent, les sourcils montent et se crispent, le tremblement apparaît", () => {
    const e = ([0, 1, 2, 3] as Niveau[]).map((n) => exp(n));
    for (let i = 1; i < 4; i++) {
      expect(e[i]!.ouverture).toBeGreaterThan(e[i - 1]!.ouverture);
      expect(e[i]!.pupille).toBeLessThan(e[i - 1]!.pupille);
      expect(e[i]!.sourcilHaut).toBeGreaterThanOrEqual(e[i - 1]!.sourcilHaut);
      expect(e[i]!.tremble).toBeGreaterThanOrEqual(e[i - 1]!.tremble);
    }
    expect(e[0]!.sourcils).toBe(false); // calme : pas de sourcils
    expect(e.slice(1).every((x) => x.sourcils)).toBe(true);
    expect(e[3]!.tremble).toBeGreaterThan(0);
    expect(NIVEAUX).toHaveLength(4);
    // Le regard suit la consigne, borné.
    expect(e[0]!.regardX).toBeCloseTo(0.3);
    expect(expressionDe({ niveau: 0, genre: "normal", regard: { x: 5, y: -9 }, clignement: 0, t: 0 }).regardY).toBe(-1);
  });
});

describe("les genres de pièces", () => {
  it("une pièce qui tombe à la mer a une expression de chute : yeux immenses, pupilles en points, regard vers le haut", () => {
    const c = exp(0, "chute");
    expect(c.ouverture).toBeGreaterThan(NIVEAUX[3]!.ouverture);
    expect(c.pupille).toBeLessThan(NIVEAUX[3]!.pupille);
    expect(c.regardY).toBe(1);
    expect(c.sourcils).toBe(true);
  });

  it("une pièce figée garde les yeux fermés, même quand elle panique ou cligne", () => {
    for (const n of [0, 1, 2, 3] as Niveau[]) {
      const f = exp(n, "figee", 0.3);
      expect(f.fermeture).toBe(1);
      expect(f.sourcils).toBe(false);
      expect(f.tremble).toBe(0);
    }
  });

  it("une pièce de lierre a un air soulagé : paupières mi-closes, regard bas, sourcils détendus (angle négatif)", () => {
    const s = exp(2, "soulage");
    expect(s.fermeture).toBeGreaterThan(0.3);
    expect(s.fermeture).toBeLessThan(0.9);
    expect(s.regardY).toBeLessThan(0);
    expect(s.sourcilAngle).toBeLessThan(0);
    expect(s.tremble).toBe(0);
  });

  it("une pièce glissante a un air inquiet en permanence, la pupille qui file d'un côté à l'autre", () => {
    const g0 = exp(0, "glissante", 0, 0);
    expect(g0.sourcils).toBe(true);
    expect(g0.sourcilAngle).toBeGreaterThan(0);
    const xs = [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4].map((t) => exp(0, "glissante", 0, t).regardX);
    expect(Math.max(...xs)).toBeGreaterThan(0.4);
    expect(Math.min(...xs)).toBeLessThan(-0.4);
  });

  it("un clignement ferme l'œil (un trait), pas celui d'une pièce figée qui l'est déjà", () => {
    expect(exp(0, "normal", 1).fermeture).toBe(1);
    expect(exp(0, "normal", 0.5).fermeture).toBeCloseTo(0.5);
    expect(exp(0, "soulage", 1).fermeture).toBe(1);
    expect(exp(0, "normal", -3).fermeture).toBe(0);
  });
});

describe("le regard", () => {
  it("vers un point : un vecteur de norme ≤ 1 dans le repère de la pièce (une pièce tournée de 90° le voit tourné)", () => {
    const v = regardVers({ x: 0, y: 0 }, { x: 0, y: -5 }, 0);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-1);
    const tourne = regardVers({ x: 0, y: 0 }, { x: 0, y: -5 }, Math.PI / 2);
    expect(tourne.x).toBeCloseTo(-1); // la pièce a tourné d'un quart de tour : le « bas » du monde est à gauche d'elle
    expect(tourne.y).toBeCloseTo(0);
    expect(Math.hypot(regardVers({ x: 0, y: 0 }, { x: 0.1, y: 0.1 }, 0).x, regardVers({ x: 0, y: 0 }, { x: 0.1, y: 0.1 }, 0).y)).toBeLessThan(0.3);
    expect(regardVers({ x: 1, y: 1 }, { x: 1, y: 1 }, 0)).toEqual({ x: 0, y: 0 });
  });

  it("le clignotant ne dépend que de son hasard et du temps", () => {
    const f = () => {
      let i = 0;
      return () => (i++ % 7) / 7;
    };
    const a = new Clignotement(f());
    const b = new Clignotement(f());
    for (let t = 0; t < 20; t += 0.05) expect(a.valeur(t, 0)).toBe(b.valeur(t, 0));
  });
});
