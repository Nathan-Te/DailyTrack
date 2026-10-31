import { describe, expect, it } from "vitest";
import { hasardAffichage } from "../src/hasardAffichage";
import { mouvementReduit } from "../src/mouvement";
import { AMPLITUDE, DUREE_CASCADE_MS, DUREE_SECOUSSE_MS, Secousse } from "../src/secousse";

// Lot T5 — la secousse de caméra : ≈ 200 ms pour une pièce perdue, plus forte pour une cascade, absente avec `prefers-reduced-motion`.
const jouer = (s: Secousse, ms = 600): { max: number; dureeMs: number } => {
  let max = 0;
  let dureeMs = 0;
  for (let t = 0; t < ms; t += 10) {
    const d = s.avancer(10);
    const m = Math.hypot(d.x, d.y);
    max = Math.max(max, m);
    if (m > 0) dureeMs = t + 10;
  }
  return { max, dureeMs };
};

describe("la secousse de caméra", () => {
  it("dure environ 200 ms pour une pièce perdue, plus longtemps et plus fort pour une cascade, puis s'éteint", () => {
    const a = new Secousse(hasardAffichage(1), () => false);
    a.declencher(false);
    expect(a.active).toBe(true);
    const perte = jouer(a);
    expect(perte.dureeMs).toBeLessThanOrEqual(DUREE_SECOUSSE_MS + 10);
    expect(perte.dureeMs).toBeGreaterThan(DUREE_SECOUSSE_MS * 0.7);
    expect(a.active).toBe(false);
    expect(a.avancer(10)).toEqual({ x: 0, y: 0 });
    const b = new Secousse(hasardAffichage(1), () => false);
    b.declencher(true);
    const cascade = jouer(b);
    expect(cascade.max).toBeGreaterThan(perte.max);
    expect(cascade.dureeMs).toBeGreaterThan(perte.dureeMs);
    expect(cascade.dureeMs).toBeLessThanOrEqual(DUREE_CASCADE_MS + 10);
    expect(cascade.max).toBeLessThanOrEqual(AMPLITUDE.cascade * Math.SQRT2 + 1e-9);
  });

  it("`prefers-reduced-motion` coupe la secousse : rien ne bouge, même pour une cascade", () => {
    const s = new Secousse(hasardAffichage(1), () => true);
    s.declencher(false);
    s.declencher(true);
    expect(s.active).toBe(false);
    expect(jouer(s)).toEqual({ max: 0, dureeMs: 0 });
  });

  it("`mouvementReduit` lit `matchMedia('(prefers-reduced-motion: reduce)')`, faux sans navigateur ou si la lecture échoue", () => {
    const fenetre = (matches: boolean): Pick<Window, "matchMedia"> => ({ matchMedia: (q: string) => ({ matches: matches && q === "(prefers-reduced-motion: reduce)" }) as MediaQueryList });
    expect(mouvementReduit(fenetre(true))).toBe(true);
    expect(mouvementReduit(fenetre(false))).toBe(false);
    expect(mouvementReduit(undefined)).toBe(false);
    expect(mouvementReduit({ matchMedia: () => { throw new Error("non"); } } as unknown as Pick<Window, "matchMedia">)).toBe(false);
  });

  it("le réglage d'intensité l'échelonne ou la coupe", () => {
    let k = 1;
    const s = new Secousse(hasardAffichage(2), () => false, () => k);
    s.declencher(false);
    const normale = jouer(s).max;
    k = 2;
    s.declencher(false);
    expect(jouer(s).max).toBeGreaterThan(normale);
    k = 0;
    s.declencher(true);
    expect(s.active).toBe(false);
  });

  it("une secousse faible n'écourte pas une secousse forte en cours", () => {
    const s = new Secousse(hasardAffichage(4), () => false);
    s.declencher(true);
    s.avancer(20);
    s.declencher(false);
    const { dureeMs } = jouer(s, 600);
    expect(dureeMs).toBeGreaterThan(DUREE_SECOUSSE_MS);
  });
});
