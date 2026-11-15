import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { toBase64Url } from "@cdj/core";
import {
  DROITE, DUREE_MAX_TICKS, ErreurRediffusion, GAUCHE, LANCEUR, MAX_CARACTERES, MAX_EVENEMENTS, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, chargeDe, dailyPinball, decoderRediffusion, encoderRediffusion, enregistrer, lireCharge,
  piloter, rejouer, type Evenement,
} from "../src/index";

const JOUR = daysFromCivil(2026, 11, 9);
const c = dailyPinball(JOUR);
const valide: Evenement[] = [
  { tick: 0, c: LANCEUR, enfonce: true },
  { tick: 280, c: LANCEUR, enfonce: false },
  { tick: 900, c: GAUCHE, enfonce: true },
  { tick: 900, c: DROITE, enfonce: true },
  { tick: 1010, c: GAUCHE, enfonce: false },
  { tick: 1500, c: GAUCHE, enfonce: true },
  { tick: 1700, c: DROITE, enfonce: false },
];
const refus = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErreurRediffusion) return e.code;
    throw e;
  }
  return "accepté";
};
/** Une enveloppe fabriquée à la main autour d'une charge (pour essayer ce que le jeu n'écrirait jamais). */
const avecCharge = (charge: number[]): string => toBase64Url([1, PINBALL_SIM_VERSION, PINBALL_GENERATOR_VERSION, 0, ...varint(JOUR), ...charge]);
function varint(n: number): number[] {
  const o: number[] = [];
  while (n >= 0x80) {
    o.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  o.push(n);
  return o;
}
const code = (e: Evenement): number => e.c * 2 + (e.enfonce ? 0 : 1);
const octets = (evs: { delta: number; e: Evenement }[]): number[] => evs.flatMap(({ delta, e }) => varint(delta * 6 + code(e)));

describe("une rediffusion valide", () => {
  it("s'écrit, se relit à l'identique et se rejoue", () => {
    const texte = enregistrer(c, valide);
    const r = decoderRediffusion(texte);
    expect(r.evenements).toEqual(valide);
    expect(r).toMatchObject({ sim: PINBALL_SIM_VERSION, g: PINBALL_GENERATOR_VERSION, contenu: { jour: JOUR } });
    expect(rejouer(c, texte)).toEqual(rejouer(c, r));
    expect(encoderRediffusion(r)).toBe(texte);
  });
  it("écrit les pas en deltas : deux octets pour un appui toutes les 0,3 s", () => {
    const evs = piloter(c, 30000).evenements;
    const charge = chargeDe(evs);
    expect(charge.length).toBeLessThan(evs.length * 3);
    expect(lireCharge(charge)).toEqual(evs);
    // un événement par octet quand l'écart est petit
    expect(chargeDe([{ tick: 0, c: GAUCHE, enfonce: true }, { tick: 2, c: GAUCHE, enfonce: false }])).toEqual([0, 13]);
  });
  it("accepte deux commandes différentes au même pas, et une partie vide", () => {
    expect(lireCharge(chargeDe(valide)).filter((e) => e.tick === 900)).toHaveLength(2);
    expect(decoderRediffusion(enregistrer(c, [])).evenements).toEqual([]);
  });
  it("accepte un événement au dernier pas de la partie", () => {
    const fin: Evenement[] = [{ tick: DUREE_MAX_TICKS - 1, c: GAUCHE, enfonce: true }];
    expect(lireCharge(chargeDe(fin))).toEqual(fin);
  });
});

describe("une rediffusion refusée", () => {
  it("mal formée : du texte quelconque, vide, tronqué, d'un autre type", () => {
    for (const x of ["", "!!!", "AAAA", 3, null, undefined, {}, [], "x".repeat(100)]) expect(refus(() => decoderRediffusion(x)), String(x)).toBe("format_illisible");
    const texte = enregistrer(c, valide);
    expect(refus(() => decoderRediffusion(texte.slice(0, -1)))).not.toBe("accepté"); // un octet de moins : un événement coupé ou un autre
  });
  it("un entier qui ne finit pas", () => {
    expect(refus(() => decoderRediffusion(avecCharge([0x80])))).toBe("format_illisible"); // un entier qui ne finit pas
  });
  it("double appui : la même commande pressée deux fois, relâchée sans appui, deux événements au même pas", () => {
    const a = { delta: 0, e: { tick: 0, c: GAUCHE, enfonce: true } as Evenement };
    expect(refus(() => decoderRediffusion(avecCharge(octets([a, { delta: 5, e: a.e }]))))).toBe("format_illisible"); // appui, appui
    expect(refus(() => decoderRediffusion(avecCharge(octets([{ delta: 3, e: { tick: 3, c: DROITE, enfonce: false } }]))))).toBe("format_illisible"); // relâchement sans appui
    expect(refus(() => decoderRediffusion(avecCharge(octets([a, { delta: 0, e: { tick: 0, c: GAUCHE, enfonce: false } }]))))).toBe("format_illisible"); // appui et relâchement au même pas
    expect(refus(() => decoderRediffusion(avecCharge(octets([a, { delta: 0, e: a.e }]))))).toBe("format_illisible"); // le même appui deux fois au même pas
  });
  it("un appui après la durée maximale", () => {
    expect(refus(() => decoderRediffusion(avecCharge(octets([{ delta: DUREE_MAX_TICKS, e: { tick: DUREE_MAX_TICKS, c: GAUCHE, enfonce: true } }]))))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(avecCharge(octets([{ delta: DUREE_MAX_TICKS - 1, e: { tick: 0, c: GAUCHE, enfonce: true } }]))))).toBe("accepté");
    expect(refus(() => decoderRediffusion(avecCharge(octets([{ delta: 50_000_000, e: { tick: 0, c: LANCEUR, enfonce: true } }]))))).toBe("format_illisible");
  });
  it("trop longue : trop de caractères, ou trop d'événements", () => {
    expect(refus(() => decoderRediffusion("A".repeat(MAX_CARACTERES + 1)))).toBe("trop_longue");
    const evs: Evenement[] = [];
    for (let i = 0; i < MAX_EVENEMENTS + 2; i++) evs.push({ tick: i * 2, c: GAUCHE, enfonce: i % 2 === 0 });
    expect(refus(() => decoderRediffusion(enregistrer(c, evs)))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(enregistrer(c, evs.slice(0, MAX_EVENEMENTS))))).toBe("accepté");
    // et la limite de caractères laisse passer la plus longue rediffusion permise
    const pire: Evenement[] = Array.from({ length: MAX_EVENEMENTS }, (_, i) => ({ tick: Math.min(DUREE_MAX_TICKS - 1, i * 44), c: GAUCHE, enfonce: i % 2 === 0 }));
    expect(enregistrer(c, pire).length).toBeLessThanOrEqual(MAX_CARACTERES);
  });
  it("de mauvaises versions : simulation ou générateur inconnus", () => {
    const base = { contenu: { jour: JOUR }, evenements: valide };
    expect(refus(() => decoderRediffusion(encoderRediffusion({ ...base, sim: PINBALL_SIM_VERSION + 1, g: PINBALL_GENERATOR_VERSION })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(encoderRediffusion({ ...base, sim: PINBALL_SIM_VERSION, g: PINBALL_GENERATOR_VERSION + 1 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(encoderRediffusion({ ...base, sim: 1, g: 1 })))).toBe("version_inconnue");
  });
  it("d'un autre jour ou d'une autre version de générateur, ou d'un scénario", () => {
    const texte = enregistrer(c, valide);
    expect(refus(() => rejouer(dailyPinball(JOUR + 1), texte))).toBe("contenu_different");
    expect(refus(() => rejouer({ ...c, g: 99 }, texte))).toBe("contenu_different");
    expect(refus(() => rejouer(c, encoderRediffusion({ sim: PINBALL_SIM_VERSION, g: PINBALL_GENERATOR_VERSION, contenu: { scenario: "essai" }, evenements: [] })))).toBe("contenu_different");
  });
});
