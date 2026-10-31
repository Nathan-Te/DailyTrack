import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { formatDate, formatDateCourte, formatDecompte, formatHauteur, formatNombre, formatNumeroJour, formatRang, formatTemps, majuscule } from "../src/formats";

// Lot I1 (charte § 7) : les formats par langue, avec Intl. Espace insécable (U+00A0) entre un nombre et son unité.
const NB = " ";
const MARDI = daysFromCivil(2026, 10, 20);

describe("formats par langue", () => {
  it("temps : 31,402 s / 31.402 s ; au-delà d'une minute, 1:02,345 / 1:02.345", () => {
    expect(formatTemps(31_402, "fr")).toBe(`31,402${NB}s`);
    expect(formatTemps(31_402, "en")).toBe(`31.402${NB}s`);
    expect(formatTemps(5, "fr")).toBe(`0,005${NB}s`);
    expect(formatTemps(59_999.6, "fr")).toBe("1:00,000");
    expect(formatTemps(62_345, "fr")).toBe("1:02,345");
    expect(formatTemps(62_345, "en")).toBe("1:02.345");
    expect(formatTemps(-3, "en")).toBe(`0.000${NB}s`);
  });

  it("nombres : séparateurs de la langue", () => {
    expect(formatNombre(1284, "fr")).toBe("1\u00a0284");
    expect(formatNombre(1284, "en")).toBe("1,284");
    expect(formatNombre(31.4, "fr", 3)).toBe("31,400");
    expect(formatNombre(31.4, "en", 3)).toBe("31.400");
  });

  it("rangs : 1er, 2e, 14e / 1st, 2nd, 3rd, 14th, 21st, 112th", () => {
    expect([1, 2, 14].map((r) => formatRang(r, "fr"))).toEqual(["1er", "2e", "14e"]);
    expect([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 112].map((r) => formatRang(r, "en"))).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "14th", "21st", "22nd", "23rd", "112th"]);
  });

  it("dates : « mardi 20 octobre » / « Tuesday, October 20 », capitale en tête de ligne, jamais le fuseau du navigateur", () => {
    expect(formatDate(MARDI, "fr")).toBe("mardi 20 octobre");
    expect(formatDate(MARDI, "en")).toBe("Tuesday, October 20");
    expect(formatDate(MARDI, "fr", { capitale: true })).toBe("Mardi 20 octobre");
    expect(formatDate(daysFromCivil(2027, 1, 1), "fr")).toBe("vendredi 1 janvier");
    expect(formatDateCourte(MARDI, "fr", { capitale: true })).toBe("Mar. 20 oct.");
    expect(formatDateCourte(MARDI, "en")).toBe("Tue, Oct 20");
    expect(majuscule("été", "fr")).toBe("Été");
  });

  it("numéro du jour : n° 12 / #12", () => {
    expect(formatNumeroJour(12, "fr")).toBe(`n°${NB}12`);
    expect(formatNumeroJour(12, "en")).toBe("#12");
  });
});

// Lot I5 : la durée d'un décompte (Jump : prochain niveau ; Track : prochain circuit et Salon, à la place de `hhmmss` et `mmss`, tests repris tels quels).
describe("formatHauteur (lot TP)", () => {
  it("une hauteur en millimètres, arrondie au dixième de mètre : virgule en français, point en anglais, espace insécable avant l'unité", () => {
    expect(formatHauteur(42_700, "fr")).toBe("42,7\u00a0m");
    expect(formatHauteur(42_700, "en")).toBe("42.7\u00a0m");
    expect(formatHauteur(42_749, "fr")).toBe("42,7\u00a0m");
    expect(formatHauteur(42_750, "fr")).toBe("42,8\u00a0m");
    expect(formatHauteur(30_000, "fr")).toBe("30,0\u00a0m");
    expect(formatHauteur(0, "en")).toBe("0.0\u00a0m");
    expect(formatHauteur(-50, "en")).toBe("0.0\u00a0m");
  });
  it("au-delà de mille mètres, le séparateur de milliers de la langue (jamais l'espace fine U+202F)", () => {
    expect(formatHauteur(1_234_500, "fr")).toBe("1\u00a0234,5\u00a0m");
    expect(formatHauteur(1_234_500, "en")).toBe("1,234.5\u00a0m");
  });
});

describe("formatDecompte", () => {
  it("heures, minutes, secondes sur deux chiffres, arrondi à la seconde supérieure, jamais négatif", () => {
    expect(formatDecompte(0)).toBe("00:00:00");
    expect(formatDecompte(-5)).toBe("00:00:00");
    expect(formatDecompte(1)).toBe("00:00:01");
    expect(formatDecompte(3_661_000)).toBe("01:01:01");
    expect(formatDecompte(25 * 3_600_000 - 1)).toBe("25:00:00"); // le jour du retour à l'heure d'hiver dure 25 h
  });
  it("sans les heures (le Salon de Track) : minutes et secondes", () => {
    expect(formatDecompte(462_000, { heures: false })).toBe("07:42");
    expect(formatDecompte(461_001, { heures: false })).toBe("07:42"); // arrondi à la seconde supérieure
    expect(formatDecompte(-5, { heures: false })).toBe("00:00");
  });
});
