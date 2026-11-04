import { describe, expect, it } from "vitest";
import { type ContexteAudio, Sons } from "../src/sons";
import { DEMI_TONS_MAX, DO5, hauteurEffacement, niveauEffets, notesDe, type Evenement } from "../src/sonsLogique";

const DEMI_TON = 2 ** (1 / 12);

describe("les sons (décision)", () => {
  it("le son de l'effacement monte d'un demi-ton exactement à chaque palier du combo, jusqu'à l'octave", () => {
    expect(hauteurEffacement(1)).toBeCloseTo(DO5);
    for (let c = 2; c <= 1 + DEMI_TONS_MAX; c++) expect(hauteurEffacement(c) / hauteurEffacement(c - 1)).toBeCloseTo(DEMI_TON, 6);
    expect(hauteurEffacement(1 + DEMI_TONS_MAX)).toBeCloseTo(DO5 * 2);
    expect(hauteurEffacement(50)).toBeCloseTo(DO5 * 2);
    expect(hauteurEffacement(0)).toBeCloseTo(DO5);
  });
  it("l'effacement a une note de plus par ligne ou colonne effacée, et sa première note est la hauteur du palier", () => {
    const n = (k: number) => notesDe({ son: "effacement", n: k, combo: 3 });
    expect(n(1).filter((x) => x.onde === "triangle")).toHaveLength(1);
    expect(n(3).filter((x) => x.onde === "triangle")).toHaveLength(3);
    expect(n(2)[0]!.f).toBeCloseTo(hauteurEffacement(3));
  });
  it("le « ting » du combo n'existe que dès ×2", () => {
    expect(notesDe({ son: "combo", combo: 1 })).toEqual([]);
    expect(notesDe({ son: "combo", combo: 2 }).length).toBeGreaterThan(0);
  });
  it("chaque son existe, a des notes valides (hauteur, durée et niveau positifs, niveau ≤ 1)", () => {
    const evenements: Evenement[] = [{ son: "prise" }, { son: "pose", cases: 5 }, { son: "refus" }, { son: "effacement", n: 4, combo: 4 }, { son: "combo", combo: 4 }, { son: "plateauVide" }, { son: "fin" }];
    for (const e of evenements) {
      const notes = notesDe(e);
      expect(notes.length, e.son).toBeGreaterThan(0);
      for (const x of notes) expect([x.f > 0, x.f2 > 0, x.d > 0, x.g > 0 && x.g <= 1, x.t >= 0], e.son).toEqual([true, true, true, true, true]);
    }
  });
  it("le niveau suit le volume du kit : 0 si coupé ou muet, jamais plus de 1", () => {
    expect(niveauEffets(0.5, false)).toBe(0.5);
    expect(niveauEffets(0.5, true)).toBe(0);
    expect(niveauEffets(0, false)).toBe(0);
    expect(niveauEffets(3, false)).toBe(1);
    expect(niveauEffets(Number.NaN, false)).toBe(0);
  });
});

function faux(): { ctx: ContexteAudio; oscillateurs: number } {
  const etat = { oscillateurs: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => ({ gain: param(), connect() {} }),
    createOscillator: () => {
      etat.oscillateurs++;
      return { type: "sine", frequency: param(), connect() {}, start() {}, stop() {} };
    },
  } as unknown as ContexteAudio;
  return { ctx, get oscillateurs() { return etat.oscillateurs; } };
}

describe("la lecture des sons", () => {
  it("rien avant le premier geste ; après, un oscillateur par note ; la hauteur est notée", () => {
    const f = faux();
    const s = new Sons({ niveau: () => 1, creerContexte: () => f.ctx });
    s.jouer({ son: "effacement", n: 1, combo: 2 });
    expect(f.oscillateurs).toBe(0);
    expect(s.joues).toHaveLength(1); // la demande est notée, pas lue
    s.deverrouiller();
    s.jouer({ son: "effacement", n: 1, combo: 2 });
    expect(f.oscillateurs).toBe(notesDe({ son: "effacement", n: 1, combo: 2 }).length);
    expect(s.joues.at(-1)!.hz).toBeCloseTo(hauteurEffacement(2));
  });
  it("à niveau 0 (son coupé dans le kit), rien n'est joué ni noté", () => {
    const f = faux();
    const s = new Sons({ niveau: () => 0, creerContexte: () => f.ctx });
    s.deverrouiller();
    s.jouer({ son: "plateauVide" });
    expect(f.oscillateurs).toBe(0);
    expect(s.joues).toEqual([]);
  });
  it("sans AudioContext (navigateur ancien), jamais d'erreur", () => {
    const s = new Sons({ niveau: () => 1, creerContexte: () => null });
    s.deverrouiller();
    expect(() => s.jouer({ son: "fin" })).not.toThrow();
  });
});
