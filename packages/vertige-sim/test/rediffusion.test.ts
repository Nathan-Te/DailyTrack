import { describe, expect, it } from "vitest";
import { toBase64Url } from "@cdj/core";
import { ErreurRediffusion, MAX_CARACTERES, T_AVANT, T_DASH, T_SAUT, chargeDe, dailyVertige, decoderRediffusion, enregistrer, enregistrerScenario, lireCharge, rejouer, rejouerScenario, type Commande } from "../src/index";
import { ETAPES_PARCOURS, jouerEtapes } from "../tools/robot";

const contenu = dailyVertige(20_000);
const robot = jouerEtapes("parcours", ETAPES_PARCOURS);

describe("rediffusion", () => {
  it("la charge s'écrit et se relit à l'identique (touches, regard, zéros compris)", () => {
    const c: Commande[] = [
      { k: 0, dl: 0, dt: 0 },
      { k: T_AVANT, dl: -32767, dt: 32767 },
      { k: T_AVANT | T_SAUT, dl: 5, dt: 0 },
      { k: T_AVANT | T_SAUT, dl: 0, dt: 0 },
      { k: T_DASH, dl: 0, dt: -1 },
      { k: 0, dl: 0, dt: 0 },
    ];
    expect(lireCharge(chargeDe(c))).toEqual(c);
    expect(lireCharge(chargeDe([]))).toEqual([]);
  });
  it("une partie jouée se rejoue : le résultat est celui du jeu", () => {
    const code = enregistrer(contenu, robot.commandes);
    expect(rejouer(contenu, code)).toEqual(robot.partie.resultat());
    expect(decoderRediffusion(code).commandes).toEqual(robot.commandes);
  });
  it("une partie qui n'est pas celle de ce jour est refusée (contenu_different)", () => {
    const code = enregistrer(contenu, robot.commandes);
    expect(() => rejouer(dailyVertige(20_001), code)).toThrowError(expect.objectContaining({ code: "contenu_different" }));
  });
  it("une rediffusion de scénario se rejoue en scénario, mais n'est jamais celle d'un jour", () => {
    const code = enregistrerScenario("mur", [{ k: T_AVANT, dl: 0, dt: 0 }]);
    expect(rejouerScenario(code).nom).toBe("mur");
    expect(() => rejouer(contenu, code)).toThrowError(ErreurRediffusion);
    expect(() => rejouerScenario(enregistrer(contenu, []))).toThrowError(ErreurRediffusion);
  });
  it("refuse, par un refus codé et jamais une exception brute : texte absent, illisible, trop long, version inconnue, octets en trop, pas après l'arrivée", () => {
    const code = (e: unknown): string | undefined => {
      try {
        decoderRediffusion(e);
      } catch (x) {
        return x instanceof ErreurRediffusion ? x.code : "BRUTE";
      }
      return undefined;
    };
    expect(code(undefined)).toBe("format_illisible");
    expect(code("")).toBe("format_illisible");
    expect(code("é!?")).toBe("format_illisible");
    expect(code("A".repeat(MAX_CARACTERES + 1))).toBe("trop_longue");
    expect(code(toBase64Url([1, 9, 1, 0, 5, 0, 0, 0]))).toBe("version_inconnue");
    const bon = enregistrer(contenu, [{ k: T_AVANT, dl: 0, dt: 0 }]);
    expect(code(bon)).toBeUndefined();
    expect(code(bon + "AA")).toBe("format_illisible");
    expect(code(bon.slice(0, -2))).toBe("format_illisible");
    // La charge elle-même : une touche inconnue (bit 6), trop de pas.
    const enveloppe = (charge: number[]): string => toBase64Url([1, 3, 1, 0, 0xc0, 0x9a, 0x0c, ...charge]);
    expect(code(enveloppe([2, 1, 0, 64, 0]))).toBe("format_illisible");
    expect(code(enveloppe([0xff, 0xff, 0x7f, 0, 0]))).toBe("trop_longue");
    expect(() => rejouer(contenu, enregistrer(contenu, [...robot.commandes, { k: 0, dl: 0, dt: 0 }]))).toThrowError(expect.objectContaining({ code: "format_illisible" }));
  });
  it("refuse tout texte au hasard sans jamais lever autre chose qu'un refus codé", () => {
    let graine = 12345;
    const alea = (): number => (graine = (graine * 16807) % 2147483647);
    for (let i = 0; i < 300; i++) {
      const octets = Array.from({ length: 1 + (alea() % 40) }, () => alea() % 256);
      if (i % 2 === 0) octets.splice(0, 5, 1, 2, 1, 0, 0xc0);
      try {
        decoderRediffusion(toBase64Url(octets));
      } catch (e) {
        expect(e).toBeInstanceOf(ErreurRediffusion);
      }
    }
  });
});
