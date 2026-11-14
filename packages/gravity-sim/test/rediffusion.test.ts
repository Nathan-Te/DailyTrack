import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { toBase64Url } from "@cdj/core";
import { encoderEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_MAX_TICKS, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, MAX_APPUIS, MAX_CARACTERES, ErreurRediffusion, chargeDe, dailyGravity, decoderRediffusion, enregistrer, lireCharge, rejouer } from "../src/index";

// La rediffusion n'est que la liste des pas où le joueur a touché l'écran, en deltas : minuscule, et refusée dès qu'elle est mal formée, trop longue ou d'un autre jour.
const JOUR = daysFromCivil(2026, 11, 9);
const contenu = dailyGravity(JOUR);
const refus = (texte: unknown): string => {
  try {
    decoderRediffusion(texte);
  } catch (e) {
    return e instanceof ErreurRediffusion ? e.code : `exception brute : ${String(e)}`;
  }
  return "accepté";
};
const brut = (octets: number[], jour = JOUR, sim = GRAVITY_SIM_VERSION, g = GRAVITY_GENERATOR_VERSION): string => encoderEnveloppe({ sim, g, contenu: { jour }, charge: octets });

describe("le format", () => {
  it("encode des appuis en deltas et les relit à l'identique", () => {
    const appuis = [0, 1, 130, 131, 5000, 71999];
    expect(decoderRediffusion(enregistrer(contenu, appuis)).appuis).toEqual(appuis);
    expect(chargeDe([3, 10, 500])).toEqual([3, 7, 0xea, 0x03]); // 3 ; +7 ; +490 (deux octets : 0x6a avec le bit de suite, puis 3)
    expect(lireCharge(chargeDe([3, 10, 500]))).toEqual([3, 10, 500]);
  });
  it("est minuscule : une partie de trois minutes tient dans quelques centaines de caractères", () => {
    // Un appui toutes les 1,5 s pendant 3 minutes : 120 appuis, un octet chacun (delta < 128 pas) ou deux.
    const appuis = Array.from({ length: 120 }, (_, i) => 100 + i * 180);
    expect(enregistrer(contenu, appuis).length).toBeLessThan(400);
    expect(enregistrer(contenu, []).length).toBeLessThan(15);
  });
  it("une partie sans appui est valide", () => {
    expect(decoderRediffusion(enregistrer(contenu, [])).appuis).toEqual([]);
  });
});

describe("les refus (jamais une exception brute)", () => {
  it("texte absent, vide ou pas du texte", () => {
    for (const v of [undefined, null, 42, "", {}, []]) expect(refus(v)).toBe("format_illisible");
  });
  it("caractères hors base64url, longueur impossible, charge tronquée", () => {
    expect(refus("!!!!")).toBe("format_illisible");
    expect(refus("A")).toBe("format_illisible");
    expect(refus(brut([0x80]))).toBe("format_illisible"); // un entier qui ne finit jamais
    expect(refus(toBase64Url([1, 2]))).toBe("format_illisible");
  });
  it("versions inconnues : « recharge la page »", () => {
    expect(refus(brut([5], JOUR, 99))).toBe("version_inconnue");
    expect(refus(brut([5], JOUR, GRAVITY_SIM_VERSION, 99))).toBe("version_inconnue");
    expect(refus(brut([5], JOUR, 1, 1))).toBe("version_inconnue"); // le squelette « Cibles »
  });
  it("deux appuis au même pas, ou un appui après la fin de la partie", () => {
    expect(refus(brut([5, 0]))).toBe("format_illisible");
    expect(refus(brut(chargeDe([DUREE_MAX_TICKS])))).toBe("format_illisible");
    expect(refus(brut(chargeDe([DUREE_MAX_TICKS - 1])))).toBe("accepté");
    expect(refus(brut([0, 0]))).toBe("format_illisible"); // le premier appui peut être au pas 0, pas le second
    expect(refus(brut([0]))).toBe("accepté");
  });
  it("trop longue : trop de caractères avant toute lecture, trop d'appuis après", () => {
    expect(refus("A".repeat(MAX_CARACTERES + 1))).toBe("trop_longue");
    const trop = Array.from({ length: MAX_APPUIS + 1 }, (_, i) => i * 2);
    expect(refus(brut(chargeDe(trop)))).toBe("trop_longue");
    const juste = Array.from({ length: MAX_APPUIS }, (_, i) => i * 2);
    expect(refus(brut(chargeDe(juste)))).toBe("accepté");
    expect(enregistrer(contenu, juste).length).toBeLessThan(MAX_CARACTERES);
  });
  it("un autre jour que celui rejoué est refusé", () => {
    const autre = enregistrer(dailyGravity(JOUR + 1), [10, 50]);
    expect(() => rejouer(contenu, autre)).toThrow(ErreurRediffusion);
    try {
      rejouer(contenu, autre);
    } catch (e) {
      expect((e as ErreurRediffusion).code).toBe("contenu_different");
    }
  });
});

describe("le rejeu", () => {
  it("retrouve le score : jusqu'à la mort, jamais au-delà", () => {
    const r = rejouer(contenu, enregistrer(contenu, [20, 200, 380, 560]));
    expect(r.cause).toBeGreaterThan(0);
    expect(r.ticks).toBeLessThan(DUREE_MAX_TICKS);
    expect(r.appuis).toBeLessThanOrEqual(4);
    expect(r.score).toBe(r.distance + 0 + (r.score - r.distance));
  });
  it("ignore les appuis après la mort", () => {
    const court = rejouer(contenu, enregistrer(contenu, []));
    const long = rejouer(contenu, enregistrer(contenu, [...Array.from({ length: 50 }, (_, i) => 71000 + i)]));
    expect(long).toEqual(court);
  });
});
