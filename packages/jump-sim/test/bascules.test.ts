import { afterEach, describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import {
  BASCULES_GENERATEUR,
  CHECKPOINT_ZONE_VERSION,
  GenerateurDuJourError,
  JUMP_GENERATOR_VERSION,
  PREMIER_JOUR_JUMP,
  calendrierPourLesTests,
  dailyLevel,
  generateurDuJour,
  problemesDuCalendrier,
  verifierGenerateurDuJour,
} from "../src/index";

// Lot 33 (incident du 06/11/2026) — le calendrier des bascules du générateur : un jour se génère avec le générateur actif à sa date, jamais avec un plus récent.

const jour = (d: string): number => parseDay(d)!;
afterEach(() => calendrierPourLesTests(null));

describe("calendrier des bascules du générateur", () => {
  it("celui du code est cohérent : croissant, et sa dernière entrée est le générateur du code", () => {
    expect(problemesDuCalendrier(BASCULES_GENERATEUR)).toEqual([]);
    expect(BASCULES_GENERATEUR.at(-1)!.generateur).toBe(JUMP_GENERATOR_VERSION);
  });

  it("tous les jours que le code connaît sont du générateur courant (une seule entrée à ce jour)", () => {
    for (let d = PREMIER_JOUR_JUMP; d < PREMIER_JOUR_JUMP + 90; d++) expect(generateurDuJour(d)).toBe(JUMP_GENERATOR_VERSION);
  });

  it("une entrée vaut de sa date (comprise) à la suivante (exclue) ; avant la première, celle de la première", () => {
    const cal = [
      { depuis: "2026-10-16", generateur: 25 },
      { depuis: "2026-11-08", generateur: 26 },
    ];
    expect(generateurDuJour(jour("2026-10-01"), cal)).toBe(25);
    expect(generateurDuJour(jour("2026-11-07"), cal)).toBe(25);
    expect(generateurDuJour(jour("2026-11-08"), cal)).toBe(26);
    expect(generateurDuJour(jour("2027-01-01"), cal)).toBe(26);
  });

  it("refuse un calendrier vide, une date illisible, des dates ou des générateurs qui ne croissent pas, une dernière entrée qui n'est pas le code", () => {
    expect(problemesDuCalendrier([])).toHaveLength(1);
    expect(problemesDuCalendrier([{ depuis: "demain", generateur: 26 }], 26)).toEqual([expect.stringContaining("illisible")]);
    expect(problemesDuCalendrier([{ depuis: "2026-11-08", generateur: 25 }, { depuis: "2026-11-08", generateur: 26 }], 26)).toEqual([expect.stringContaining("ne vient pas après")]);
    expect(problemesDuCalendrier([{ depuis: "2026-11-01", generateur: 26 }, { depuis: "2026-11-08", generateur: 26 }], 26)).toEqual([expect.stringContaining("ne dépasse pas")]);
    expect(problemesDuCalendrier([{ depuis: "2026-11-01", generateur: 25 }], 26)).toEqual([expect.stringContaining("la dernière entrée est g25")]);
  });
});

describe("un jour ne se génère pas avec un générateur plus récent que celui de sa date", () => {
  it("l'incident : un générateur g27 déployé alors qu'aujourd'hui n'est pas figé ne génère ni aujourd'hui ni aucun jour passé", () => {
    // Le 06/11/2026 : le code déployé est g27, qui n'entre en vigueur que demain (07/11). Aujourd'hui (06/11) et les jours passés sans fichier figé NE SE GÉNÈRENT PAS (g26 les a servis).
    calendrierPourLesTests([
      { depuis: "2026-10-16", generateur: 26 },
      { depuis: "2026-11-07", generateur: 27 },
    ]);
    for (const d of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]) {
      expect(() => verifierGenerateurDuJour(jour(d), 27), d).toThrow(GenerateurDuJourError);
    }
    expect(() => verifierGenerateurDuJour(jour("2026-11-07"), 27)).not.toThrow();
    expect(() => verifierGenerateurDuJour(jour("2026-11-30"), 27)).not.toThrow();
    // Et le code g26 d'avant ne génère pas les jours de g27.
    expect(() => verifierGenerateurDuJour(jour("2026-11-07"), 26)).toThrow(GenerateurDuJourError);
  });

  it("dailyLevel s'arrête (au lieu de servir un autre niveau) pour un jour d'un générateur que ce code ne rend pas, et génère ceux de son générateur", () => {
    calendrierPourLesTests([
      { depuis: "2026-10-16", generateur: JUMP_GENERATOR_VERSION - 1 },
      { depuis: "2026-11-07", generateur: JUMP_GENERATOR_VERSION },
    ]);
    const erreur = (() => {
      try {
        dailyLevel(jour("2026-11-06"));
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(erreur).toBeInstanceOf(GenerateurDuJourError);
    expect((erreur as GenerateurDuJourError).attendu).toBe(JUMP_GENERATOR_VERSION - 1);
    expect(() => dailyLevel(jour("2026-11-07"))).not.toThrow();
  });

  it("les références des versions d'avant (simVersion < 14) sont des rendus à part : le calendrier ne les concerne pas", () => {
    calendrierPourLesTests([{ depuis: "2026-10-16", generateur: JUMP_GENERATOR_VERSION - 1 }, { depuis: "2099-01-01", generateur: JUMP_GENERATOR_VERSION }]);
    expect(() => dailyLevel(jour("2026-10-20"), null, CHECKPOINT_ZONE_VERSION - 1)).not.toThrow();
  });
});
