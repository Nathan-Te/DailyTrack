import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { DISTANCES_D_ARRET, GRAVITY_BOT_VERSION, POURCENT_DU_ROBOT, THEMES_D_ARRET, dailyGravity, figerJour, jouerRobot, lireJourFige, medailleDe, seuilsDe, seuilsDuJour, seuilsDuRobot, seuilsEnTranches, seuilsValides, terrainDuJour } from "../src/index";

const JOUR = daysFromCivil(2026, 11, 9);

describe("les seuils du robot", () => {
  it("quatre entiers strictement croissants, à 10 près, jour après jour", () => {
    for (let i = 0; i < 4; i++) {
      const s = seuilsDuRobot(dailyGravity(JOUR + i));
      expect(seuilsValides(s)).toBe(true);
      for (const v of Object.values(s)) expect(v % 10).toBe(0);
    }
  });
  it("sont 60 % du score du robot à la fin du 1er, du 2e, du 3e thème puis de la boucle, arrondis à 10 près", () => {
    expect(POURCENT_DU_ROBOT).toBe(60);
    expect(THEMES_D_ARRET).toEqual({ bronze: 1, silver: 2, gold: 3, author: 5 });
    expect(DISTANCES_D_ARRET).toEqual({ bronze: 304, silver: 608, gold: 912, author: 1520 });
    const c = dailyGravity(JOUR);
    const scores: number[] = [];
    jouerRobot(terrainDuJour(c), { strict: false, maxDistance: 1520, arrets: [304, 608, 912, 1520], surPoint: (_d, p) => void scores.push(p.score) });
    const s = seuilsDuRobot(c);
    expect(scores).toHaveLength(4);
    expect([s.bronze, s.silver, s.gold, s.author]).toEqual(scores.map((v) => Math.trunc((v * 60 + 500) / 1000) * 10));
    // Un humain réaliste : au moins la distance de chaque point d'arrêt, bien plus avec les pièces.
    expect(s.bronze).toBeGreaterThan(Math.round(0.6 * 304));
    expect(s.author).toBeGreaterThan(Math.round(0.6 * 1520));
  });
  it("un jour n'est joué qu'une fois par processus : le robot ne tourne pas à chaque lecture des seuils", () => {
    const c = dailyGravity(JOUR + 7);
    const a = seuilsDuRobot(c);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) expect(seuilsDuRobot(c)).toEqual(a);
    expect(performance.now() - t0).toBeLessThan(200); // le premier calcul prend une seconde
  });
  it("les seuils se calculent aussi en tranches (l'arrière-plan du navigateur) : même résultat que d'un trait", () => {
    const c = dailyGravity(JOUR + 8);
    const g = seuilsEnTranches(c);
    let tranches = 0;
    let r = g.next();
    while (!r.done) {
      tranches++;
      r = g.next();
    }
    expect(tranches).toBeGreaterThan(20); // un `yield` par plan du robot
    expect(r.value).toEqual(seuilsDuRobot(c));
  });
  it("la médaille d'un score : la plus haute dont le seuil est atteint", () => {
    const s = { bronze: 1000, silver: 3000, gold: 6000, author: 12000 };
    expect([999, 1000, 3000, 6000, 12000, 99999].map((v) => medailleDe([v, 0], s))).toEqual([null, "bronze", "silver", "gold", "author", "author"]);
  });
});

describe("un jour figé fige ses seuils", () => {
  it("le fichier porte le jour, les versions, les seuils et l'empreinte ; il se relit", () => {
    const f = figerJour(JOUR, seuilsDuRobot(dailyGravity(JOUR)));
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
    expect(seuilsDe(dailyGravity(JOUR))).toEqual(seuilsDuRobot(dailyGravity(JOUR))); // sans fichier de jour : le robot
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
  it("un jour figé ne rappelle jamais le robot : ses seuils sont ceux du fichier, quoi que le calcul donne", () => {
    const lu = lireJourFige(figerJour(JOUR, { bronze: 11, silver: 22, gold: 33, author: 44 }))!;
    const calcul = (): never => {
      throw new Error("le robot ne doit pas tourner pour un jour figé");
    };
    expect(seuilsDuJour(lu, calcul)).toEqual({ bronze: 11, silver: 22, gold: 33, author: 44 });
    // Un jour qui n'est pas figé prend le calcul qu'on lui donne.
    expect(seuilsDuJour(dailyGravity(JOUR), () => ({ bronze: 1, silver: 2, gold: 3, author: 4 }))).toEqual({ bronze: 1, silver: 2, gold: 3, author: 4 });
  });
  it("figer un jour écrit les seuils du robot, avec la version du calcul", () => {
    const f = figerJour(JOUR);
    expect(f.bot).toBe(GRAVITY_BOT_VERSION);
    expect(f.seuils).toEqual(seuilsDuRobot(dailyGravity(JOUR)));
  });
  it("refuse de figer avec des seuils invalides", () => {
    expect(() => figerJour(JOUR, { bronze: 10, silver: 10, gold: 20, author: 30 })).toThrow();
  });
});
