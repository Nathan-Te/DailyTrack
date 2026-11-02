import { describe, expect, it } from "vitest";
import { hasardAffichage } from "../src/hasardAffichage";
import { mouvementReduit } from "../src/mouvement";
import { AMPLITUDE, DUREE_CASCADE_MS, DUREE_SECOUSSE_MS, DUREE_TAQUET_MS, Secousse } from "../src/secousse";

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

describe("lot T9 : la micro-secousse du choc d'un taquet", () => {
  it("dure 80 ms, bien plus courte et plus douce qu'une pièce perdue, puis s'éteint", () => {
    const s = new Secousse(hasardAffichage(1), () => false);
    s.declencherTaquet(1);
    expect(s.active).toBe(true);
    const t = jouer(s);
    expect(t.dureeMs).toBeLessThanOrEqual(DUREE_TAQUET_MS + 10);
    expect(t.dureeMs).toBeGreaterThan(DUREE_TAQUET_MS * 0.5);
    expect(t.max).toBeLessThanOrEqual(AMPLITUDE.taquet);
    expect(AMPLITUDE.taquet).toBeLessThan(AMPLITUDE.perte);
    expect(DUREE_TAQUET_MS).toBe(80);
    expect(s.active).toBe(false);
  });

  it("absente avec le mouvement réduit, et avec un facteur nul (le curseur ou le réglage « aucune »)", () => {
    const reduite = new Secousse(hasardAffichage(1), () => true);
    reduite.declencherTaquet(1);
    expect(reduite.active).toBe(false);
    const nulle = new Secousse(hasardAffichage(1), () => false);
    nulle.declencherTaquet(0);
    expect(nulle.active).toBe(false);
    expect(jouer(nulle).max).toBe(0);
  });

  it("le facteur la module (le curseur du taquet fois le réglage du joueur) ; elle n'écrase pas une secousse plus forte", () => {
    const moitie = new Secousse(hasardAffichage(1), () => false);
    moitie.declencherTaquet(0.5);
    expect(jouer(moitie).max).toBeLessThanOrEqual(AMPLITUDE.taquet * 0.5);
    const forte = new Secousse(hasardAffichage(1), () => false);
    forte.declencher(true);
    forte.declencherTaquet(1);
    expect(jouer(forte).dureeMs).toBeGreaterThan(DUREE_TAQUET_MS + 50); // c'est toujours la cascade qui secoue
  });
});
