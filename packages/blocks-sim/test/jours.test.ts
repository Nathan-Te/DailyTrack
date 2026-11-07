import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, dailyBlocks, figerJour, FORMAT_JOUR_FIGE, lireJourFige, SEUILS_MEDAILLES, seuilsDuJour, seuilsValides } from "../src/index";
import { figerJourDuDiamant } from "../src/diamant";

// Les jours figés (règle R11) et leurs SEUILS : un jour figé fige aussi ses médailles, comme Jump et Tower. Un changement des seuils (ou des bots de référence) ne change jamais un jour déjà figé.
const JOUR = daysFromCivil(2026, 11, 6);

describe("le fichier d'un jour figé (format 2)", () => {
  it("porte la suite, la version du bot et les quatre seuils de cette version des règles", () => {
    const f = figerJourDuDiamant(JOUR);
    expect(f).toMatchObject({ format: FORMAT_JOUR_FIGE, jeu: "blocks", date: formatDay(JOUR), bot: BLOCKS_BOT_VERSION });
    expect(f.seuils).toEqual(SEUILS_MEDAILLES);
    expect(seuilsValides(f.seuils)).toBe(true);
    // Il se relit, tel quel après un aller-retour par le texte : la suite d'abord, les seuils figés ensuite.
    const lu = lireJourFige(JSON.parse(JSON.stringify(f)));
    expect(lu).toEqual({ ...dailyBlocks(JOUR), seuilsFiges: f.seuils });
  });

  it("refuse un fichier dont les seuils manquent, ne croissent pas ou ne sont pas entiers, et l'ancien format 1", () => {
    const f = JSON.parse(JSON.stringify(figerJourDuDiamant(JOUR))) as Record<string, unknown>;
    const sans = { ...f };
    delete sans.seuils;
    expect(lireJourFige(sans)).toBeNull();
    for (const mauvais of [{ bronze: 5, silver: 5, gold: 9, author: 10 }, { bronze: 1, silver: 2, gold: 3, author: 3 }, { bronze: 1.5, silver: 2, gold: 3, author: 4 }, { bronze: 0, silver: 2, gold: 3, author: 4 }, { bronze: 1, silver: 2, gold: 3 }, null, "x"]) {
      expect(lireJourFige({ ...f, seuils: mauvais }), JSON.stringify(mauvais)).toBeNull();
    }
    expect(lireJourFige({ ...f, format: 1 })).toBeNull();
    expect(lireJourFige({ ...f, bot: undefined })).toBeNull();
    expect(() => figerJour(JOUR, { author: 1, gold: 1, silver: 1, bronze: 1 })).toThrow(/seuils invalides/);
  });

  it("garde la suite comme avant : un fichier dont la suite n'est plus celle de sa version est refusé", () => {
    const f = figerJourDuDiamant(JOUR);
    expect(lireJourFige({ ...f, contenu: { suite: f.contenu.suite.slice(1) + "0" } })).toBeNull();
    expect(lireJourFige({ ...f, g: 99 })).toBeNull();
    expect(lireJourFige({ ...f, sim: 99 })).toBeNull();
    expect(lireJourFige(null)).toBeNull();
  });
});

describe("seuilsDuJour : un jour figé garde ses seuils, quoi que disent les constantes d'aujourd'hui", () => {
  it("sans fichier de jour, ce sont les constantes ; avec, ceux du fichier — même s'ils diffèrent (les seuils ont changé depuis)", () => {
    const c = dailyBlocks(JOUR);
    expect(seuilsDuJour(c)).toEqual(SEUILS_MEDAILLES);
    // Un fichier figé « par une version plus ancienne » : d'autres seuils que ceux d'aujourd'hui.
    const ancien = { author: 7000, gold: 5000, silver: 3500, bronze: 1200 };
    expect(ancien.author).not.toBe(SEUILS_MEDAILLES.author);
    const f = { ...figerJourDuDiamant(JOUR), bot: BLOCKS_BOT_VERSION - 1, seuils: ancien };
    const lu = lireJourFige(JSON.parse(JSON.stringify(f)))!;
    expect(seuilsDuJour(lu)).toEqual(ancien);
    expect(lu.suite).toEqual(c.suite);
  });
});
