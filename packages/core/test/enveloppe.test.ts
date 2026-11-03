import { describe, expect, it } from "vitest";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type LimitesEnveloppe } from "../src/enveloppe";

const L: LimitesEnveloppe = { maxCaracteres: 400, sims: [1, 2], generateurs: [1] };
const refus = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurEnveloppe);
    return (e as ErreurEnveloppe).code;
  }
  throw new Error("aucun refus");
};

describe("enveloppe de rediffusion commune (lot K4c)", () => {
  it("fait l'aller-retour d'un jour et d'un scénario, charge comprise", () => {
    const j = { sim: 2, g: 1, contenu: { jour: 20_750 }, charge: [0, 1, 255, 128, 7] };
    expect(decoderEnveloppe(encoderEnveloppe(j), L)).toEqual(j);
    const s = { sim: 1, g: 1, contenu: { scenario: "essai:a_b-1" }, charge: [] };
    expect(decoderEnveloppe(encoderEnveloppe(s), L)).toEqual(s);
  });
  it("refuse avant de lire un texte trop long", () => {
    expect(refus(() => decoderEnveloppe("A".repeat(401), L))).toBe("trop_longue");
  });
  it("refuse un texte vide, illisible, tronqué ou d'un autre format", () => {
    expect(refus(() => decoderEnveloppe("", L))).toBe("format_illisible");
    expect(refus(() => decoderEnveloppe(42, L))).toBe("format_illisible");
    expect(refus(() => decoderEnveloppe("é!?", L))).toBe("format_illisible");
    expect(refus(() => decoderEnveloppe(encoderEnveloppe({ sim: 1, g: 1, contenu: { jour: 5 }, charge: [] }).slice(0, 3), L))).toBe("format_illisible");
  });
  it("refuse une version de simulation ou de générateur inconnue", () => {
    expect(refus(() => decoderEnveloppe(encoderEnveloppe({ sim: 3, g: 1, contenu: { jour: 5 }, charge: [] }), L))).toBe("version_inconnue");
    expect(refus(() => decoderEnveloppe(encoderEnveloppe({ sim: 1, g: 2, contenu: { jour: 5 }, charge: [] }), L))).toBe("version_inconnue");
  });
  it("refuse un nom de scénario hors de a-z 0-9 : _ - et un entier démesuré", () => {
    expect(() => encoderEnveloppe({ sim: 1, g: 1, contenu: { scenario: "Majuscule" }, charge: [] })).toThrow();
    expect(refus(() => decoderEnveloppe("AQEBAA_______", L))).toBe("format_illisible");
  });
});
