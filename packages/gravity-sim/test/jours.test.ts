import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { GRAVITY_BOT_VERSION, dailyGravity, figerJour, lireJourFige, medailleDe, seuilsDe, seuilsDuJour, seuilsSurLePapier, seuilsValides } from "../src/index";

const JOUR = daysFromCivil(2026, 11, 9);

describe("les seuils provisoires (sur le papier)", () => {
  it("quatre entiers strictement croissants, à 10 près, jour après jour", () => {
    for (let i = 0; i < 40; i++) {
      const s = seuilsSurLePapier(dailyGravity(JOUR + i));
      expect(seuilsValides(s)).toBe(true);
      for (const v of Object.values(s)) expect(v % 10).toBe(0);
    }
  });
  it("sont de l'ordre de grandeur de 60 % de la distance : 304 m, 608 m, 912 m et 1 520 m, plus les pièces", () => {
    const s = seuilsSurLePapier(dailyGravity(JOUR));
    expect(s.bronze).toBeGreaterThan(Math.round(0.6 * 304));
    expect(s.silver).toBeGreaterThan(Math.round(0.6 * 608));
    expect(s.gold).toBeGreaterThan(Math.round(0.6 * 912));
    expect(s.author).toBeGreaterThan(Math.round(0.6 * 1520));
    expect(s.author).toBeLessThan(60000);
  });
  it("la médaille d'un score : la plus haute dont le seuil est atteint", () => {
    const s = { bronze: 1000, silver: 3000, gold: 6000, author: 12000 };
    expect([999, 1000, 3000, 6000, 12000, 99999].map((v) => medailleDe([v, 0], s))).toEqual([null, "bronze", "silver", "gold", "author", "author"]);
  });
});

describe("un jour figé fige ses seuils", () => {
  it("le fichier porte le jour, les versions, les seuils et l'empreinte ; il se relit", () => {
    const f = figerJour(JOUR);
    expect(f).toMatchObject({ format: 1, jeu: "gravity", date: formatDay(JOUR), bot: GRAVITY_BOT_VERSION });
    expect(seuilsValides(f.seuils)).toBe(true);
    const lu = lireJourFige(JSON.parse(JSON.stringify(f)));
    expect(lu).not.toBeNull();
    expect(lu!.ordre).toEqual(dailyGravity(JOUR).ordre);
    expect(seuilsDuJour(lu!)).toEqual(f.seuils);
  });
  it("les seuils du fichier l'emportent sur le calcul : changer le calcul ne change jamais un jour figé", () => {
    const f = figerJour(JOUR, { bronze: 111, silver: 222, gold: 333, author: 444 });
    const lu = lireJourFige(f)!;
    expect(seuilsDe(lu)).toEqual({ bronze: 111, silver: 222, gold: 333, author: 444 });
    expect(seuilsDe(dailyGravity(JOUR))).toEqual(seuilsSurLePapier(dailyGravity(JOUR))); // sans fichier : le calcul
  });
  it("refuse un fichier abîmé : seuils absurdes, empreinte, ordre, version, jeu, forme", () => {
    const f = figerJour(JOUR);
    const copie = () => JSON.parse(JSON.stringify(f)) as Record<string, any>;
    const cas: [string, (x: Record<string, any>) => void][] = [
      ["seuils décroissants", (x) => (x.seuils = { bronze: 5, silver: 4, gold: 3, author: 2 })],
      ["seuils absents", (x) => delete x.seuils],
      ["empreinte", (x) => (x.contenu.empreinte = "00000000")],
      ["ordre", (x) => (x.contenu.ordre = [...x.contenu.ordre].reverse())],
      ["version du générateur", (x) => (x.g = 99)],
      ["version de la simulation", (x) => (x.sim = 1)],
      ["jeu", (x) => (x.jeu = "cibles")],
      ["date", (x) => (x.date = "demain")],
      ["format", (x) => (x.format = 2)],
    ];
    for (const [nom, abime] of cas) {
      const x = copie();
      abime(x);
      expect(lireJourFige(x), nom).toBeNull();
    }
    for (const v of [null, 3, "x", []]) expect(lireJourFige(v)).toBeNull();
  });
  it("refuse de figer avec des seuils invalides", () => {
    expect(() => figerJour(JOUR, { bronze: 10, silver: 10, gold: 20, author: 30 })).toThrow();
  });
});
