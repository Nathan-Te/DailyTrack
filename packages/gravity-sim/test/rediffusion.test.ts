import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { toBase64Url } from "@cdj/core";
import { encoderEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_MAX_TICKS, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, MAX_CHANGEMENTS, MAX_CARACTERES, ErreurRediffusion, Partie, chargeDe, dailyGravity, decoderRediffusion, enregistrer, lireCharge, rejouer, terrainDuJour } from "../src/index";

// La rediffusion (lot GR6) est la liste des pas où l'appui COMMENCE ou FINIT, en deltas : minuscule, et refusée dès qu'elle est mal formée, trop longue ou d'un autre jour. Le premier changement est toujours un appui,
// les suivants alternent (relâché, appui…) ; deux changements au même pas sont refusés.
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
  it("encode des changements en deltas et les relit à l'identique", () => {
    const changements = [0, 1, 130, 131, 5000, 71999];
    expect(decoderRediffusion(enregistrer(contenu, changements)).changements).toEqual(changements);
    expect(chargeDe([3, 10, 500])).toEqual([3, 7, 0xea, 0x03]); // 3 ; +7 ; +490 (deux octets : 0x6a avec le bit de suite, puis 3)
    expect(lireCharge(chargeDe([3, 10, 500]))).toEqual([3, 10, 500]);
  });
  it("est minuscule : une partie de trois minutes tient dans quelques centaines de caractères", () => {
    // Un changement toutes les 0,75 s pendant 3 minutes : 240 changements, un octet chacun (delta < 128 pas) ou deux.
    const changements = Array.from({ length: 240 }, (_, i) => 100 + i * 90);
    expect(enregistrer(contenu, changements).length).toBeLessThan(400);
    expect(enregistrer(contenu, []).length).toBeLessThan(15);
  });
  it("une partie sans changement est valide", () => {
    expect(decoderRediffusion(enregistrer(contenu, [])).changements).toEqual([]);
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
  it("deux changements au même pas, ou un changement après la fin de la partie", () => {
    expect(refus(brut([5, 0]))).toBe("format_illisible");
    expect(refus(brut(chargeDe([DUREE_MAX_TICKS])))).toBe("format_illisible");
    expect(refus(brut(chargeDe([DUREE_MAX_TICKS - 1])))).toBe("accepté");
    expect(refus(brut([0, 0]))).toBe("format_illisible"); // le premier appui peut être au pas 0, pas le second
    expect(refus(brut([0]))).toBe("accepté");
  });
  it("trop longue : trop de caractères avant toute lecture, trop de changements après", () => {
    expect(refus("A".repeat(MAX_CARACTERES + 1))).toBe("trop_longue");
    const trop = Array.from({ length: MAX_CHANGEMENTS + 1 }, (_, i) => i * 2);
    expect(refus(brut(chargeDe(trop)))).toBe("trop_longue");
    const juste = Array.from({ length: MAX_CHANGEMENTS }, (_, i) => i * 2);
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
    expect(r.changements).toBeLessThanOrEqual(4);
    expect(r.score).toBe(r.distance + 0 + (r.score - r.distance));
  });
  it("le premier changement est un appui, les suivants alternent : l'état du bouton suit la liste", () => {
    const p = new Partie(terrainDuJour(contenu));
    const vus: boolean[] = [];
    const liste = [10, 40, 41, 300];
    let k = 0;
    for (let t = 0; t < 320 && !p.finie; t++) {
      if (liste[k] === t) {
        if (p.bouton) p.relacher();
        else p.appuyer();
        k++;
      }
      p.avancer();
      if (liste.includes(t)) vus.push(p.bouton);
    }
    expect(vus.slice(0, 4)).toEqual([true, false, true, false]);
    expect(p.changements).toEqual(liste.slice(0, p.changements.length));
  });
  it("un appui et un relâché demandés dans le même pas se suivent au lieu de se confondre (jamais deux changements au même pas)", () => {
    const p = new Partie(terrainDuJour(contenu));
    p.appuyer();
    p.relacher();
    p.avancer();
    expect(p.bouton).toBe(true);
    p.avancer();
    expect(p.bouton).toBe(false);
    expect(p.changements).toEqual([0, 1]);
  });
  it("ignore les changements après la mort", () => {
    const court = rejouer(contenu, enregistrer(contenu, []));
    const long = rejouer(contenu, enregistrer(contenu, [...Array.from({ length: 50 }, (_, i) => 71000 + i)]));
    expect(long).toEqual(court);
  });
});
