import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { PINBALL_BOT_VERSION, dailyPinball, figerJour, lireJourFige, medailleDe, seuilsDe, seuilsDuJour, seuilsDuRobot, seuilsValides } from "../src/index";

const JOUR = daysFromCivil(2026, 11, 9);

describe("les seuils des médailles", () => {
  it("la médaille d'un score : la plus haute dont le seuil est atteint", () => {
    const s = { bronze: 1000, silver: 3000, gold: 6000, author: 12000 };
    expect([999, 1000, 3000, 6000, 12000, 99999].map((v) => medailleDe([v, 0], s))).toEqual([null, "bronze", "silver", "gold", "author", "author"]);
  });
});

describe("un jour figé fige ses seuils", () => {
  it("le fichier porte le jour, les versions, les seuils du robot et l'empreinte ; il se relit", () => {
    const f = figerJour(JOUR); // les seuils du robot (quelques secondes)
    expect(f).toMatchObject({ format: 1, jeu: "pinball", date: formatDay(JOUR), bot: PINBALL_BOT_VERSION });
    expect(seuilsValides(f.seuils)).toBe(true);
    expect(f.seuils).toEqual(seuilsDuRobot(dailyPinball(JOUR)));
    const lu = lireJourFige(JSON.parse(JSON.stringify(f)));
    expect(lu).not.toBeNull();
    expect(lu!.theme).toBe(dailyPinball(JOUR).theme);
    expect(lu!.modules).toEqual(dailyPinball(JOUR).modules);
    expect(seuilsDuJour(lu!)).toEqual(f.seuils);
  });
  it("les seuils du fichier l'emportent sur le calcul : changer le calcul ne change jamais un jour figé", () => {
    const f = figerJour(JOUR, { bronze: 111, silver: 222, gold: 333, author: 444 });
    const lu = lireJourFige(f)!;
    expect(seuilsDe(lu)).toEqual({ bronze: 111, silver: 222, gold: 333, author: 444 });
    expect(seuilsDe(dailyPinball(JOUR))).toEqual(seuilsDuRobot(dailyPinball(JOUR))); // sans fichier : le robot
  });
  it("lot PB4 : les seuils figés l'emportent sur le robot, qui ne se lance pas (une table que le robot ne saurait pas jouer ne l'arrête pas)", () => {
    const f = { bronze: 5, silver: 6, gold: 7, author: 8 };
    const piege = { ...dailyPinball(JOUR), modules: ["inconnu"], seuilsFiges: f } as unknown as Parameters<typeof seuilsDuJour>[0];
    expect(seuilsDuJour(piege)).toEqual(f);
    expect(() => seuilsDuJour({ ...piege, seuilsFiges: undefined })).toThrow(/module inconnu/); // sans seuils figés, le robot joue : et la table piégée l'arrête
  });
  it("le fichier ne contient aucune date de calendrier hors la sienne, et se relit identique après JSON", () => {
    const texte = JSON.stringify(figerJour(JOUR, { bronze: 111, silver: 222, gold: 333, author: 444 }));
    expect(texte.match(/\d{4}-\d{2}-\d{2}/g)).toEqual([formatDay(JOUR)]);
    expect(lireJourFige(JSON.parse(texte))!.jour).toBe(JOUR);
  });
  it("refuse un fichier abîmé : seuils absurdes, empreinte, thème, modules, version, jeu, forme", () => {
    const f = figerJour(JOUR);
    const copie = () => JSON.parse(JSON.stringify(f)) as Record<string, any>;
    const cas: [string, (x: Record<string, any>) => void][] = [
      ["seuils décroissants", (x) => (x.seuils = { bronze: 5, silver: 4, gold: 3, author: 2 })],
      ["seuils absents", (x) => delete x.seuils],
      ["empreinte", (x) => (x.contenu.empreinte = "00000000")],
      ["thème", (x) => (x.contenu.theme = x.contenu.theme === "foire" ? "ocean" : "foire")],
      ["thème inconnu", (x) => (x.contenu.theme = "clair")],
      ["modules", (x) => (x.contenu.modules = [...x.contenu.modules].reverse().concat(["trou"]).slice(0, 6))],
      ["modules absents", (x) => delete x.contenu.modules],
      ["version du générateur", (x) => (x.g = 99)],
      ["version de la simulation", (x) => (x.sim = 1)],
      ["version du calcul des seuils", (x) => delete x.bot],
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
