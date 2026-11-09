import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, dailyBlocks, empreinteContenu, figerJour, FORMAT_JOUR_FIGE, lireJourFige, SEUILS_MEDAILLES, seuilsDuJour, seuilsValides } from "../src/index";
import { figerJourDuDiamant } from "../src/diamant";

// Les jours figés (règle R11) et leurs SEUILS : un jour figé fige aussi ses médailles, comme Jump et Tower. Un changement des seuils de la fiche (ou des bots de référence) ne change jamais un jour déjà figé.
const JOUR = daysFromCivil(2026, 11, 6);

describe("le fichier d'un jour figé (format 3, lot B8c)", () => {
  it("porte la graine et l'empreinte du tirage (plus de suite : les séries dépendent de la grille), la version du bot et les quatre seuils de la fiche", () => {
    const f = figerJourDuDiamant(JOUR);
    expect(f).toMatchObject({ format: FORMAT_JOUR_FIGE, jeu: "blocks", date: formatDay(JOUR), bot: BLOCKS_BOT_VERSION });
    expect(f.seuils).toEqual(SEUILS_MEDAILLES);
    expect(seuilsValides(f.seuils)).toBe(true);
    expect(f.contenu).toEqual({ graine: dailyBlocks(JOUR).graine, empreinte: empreinteContenu(dailyBlocks(JOUR)) });
    expect(f.format).toBe(3);
    // Il se relit, tel quel après un aller-retour par le texte : le tirage d'abord, les seuils figés ensuite.
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

  it("garde le tirage comme avant : un fichier dont l'empreinte ou la graine n'est plus celle de sa version est refusé ; le format 2 (suite en texte) n'est plus celui d'un jour de règles v3", () => {
    const f = figerJourDuDiamant(JOUR);
    expect(lireJourFige({ ...f, contenu: { graine: f.contenu.graine, empreinte: "00000000" } })).toBeNull();
    expect(lireJourFige({ ...f, contenu: { graine: f.contenu.graine + 1, empreinte: f.contenu.empreinte } })).toBeNull();
    expect(lireJourFige({ ...f, contenu: { suite: "0".repeat(2000) } })).toBeNull();
    expect(lireJourFige({ ...f, format: 2 })).toBeNull();
    expect(lireJourFige({ ...f, g: 99 })).toBeNull();
    expect(lireJourFige({ ...f, sim: 99 })).toBeNull();
    expect(lireJourFige(null)).toBeNull();
  });
});

describe("seuilsDuJour : un jour figé garde ses seuils, quoi que dise la fiche d'aujourd'hui", () => {
  it("sans fichier de jour, ce sont les seuils de la fiche ; avec, ceux du fichier — même s'ils diffèrent (la fiche a changé depuis)", () => {
    const c = dailyBlocks(JOUR);
    expect(seuilsDuJour(c)).toEqual(SEUILS_MEDAILLES);
    // Un fichier figé « par une version plus ancienne » : d'autres seuils que ceux d'aujourd'hui.
    const ancien = { author: 7000, gold: 5000, silver: 3500, bronze: 1200 };
    expect(ancien.author).not.toBe(SEUILS_MEDAILLES.author);
    const f = { ...figerJourDuDiamant(JOUR), bot: BLOCKS_BOT_VERSION - 1, seuils: ancien };
    const lu = lireJourFige(JSON.parse(JSON.stringify(f)))!;
    expect(seuilsDuJour(lu)).toEqual(ancien);
    expect(lu.graine).toEqual(c.graine);
  });
});
