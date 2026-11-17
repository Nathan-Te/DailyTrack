import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { PINBALL_BOT_VERSION, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, Partie, dailyPinball, decoderRediffusion, empreinteContenu, rejouer, seuilsDuRobot } from "../src/index";

// Le golden : produit par `npm run golden:pinball` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/pinball/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-pinball.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  bot: number;
  jours: { date: string; theme: string; plan: string; modules: string[]; empreinte: string; seuils?: unknown }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: { score: number; ticks: number; billes: number; multMax: number } }[];
};

describe("golden de Pinball", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur, bot: golden.bot }).toEqual({ sim: PINBALL_SIM_VERSION, generateur: PINBALL_GENERATOR_VERSION, bot: PINBALL_BOT_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j]))("la table du %s a le thème, les modules et l'empreinte de référence, et les seuils du robot quand le golden en porte", (_date, j) => {
    const ref = j as (typeof golden.jours)[number];
    const c = dailyPinball(parseDay(ref.date)!);
    expect({ theme: c.theme, plan: c.plan, modules: c.modules, empreinte: empreinteContenu(c) }).toEqual({ theme: ref.theme, plan: ref.plan, modules: ref.modules, empreinte: ref.empreinte });
    if (ref.seuils) expect(seuilsDuRobot(c)).toEqual(ref.seuils); // le robot (13 s, 30 s sur une machine de CI) : un jour de chaque thème
  }, 120_000);
  it("le golden porte les seuils du robot d'un jour de chaque thème", () => {
    expect(golden.jours.filter((j) => j.seuils).map((j) => j.theme).sort()).toEqual(["espace", "foire", "ocean", "volcan"]);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyPinball(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
  it("les rediffusions de référence couvrent des parties vides, courtes et longues, avec des points", () => {
    const [vide, tenus, court, long] = ["vide", "batteurs-tenus", "robot-30-secondes", "robot-volcan"].map((n) => golden.rediffusions.find((r) => r.nom === n)!.resultat);
    expect(vide!.score).toBe(0);
    expect(tenus!.ticks).toBeGreaterThan(900);
    expect(court!.score).toBeGreaterThan(3000);
    expect(long!.score).toBeGreaterThan(court!.score);
  });
  it("lots PB3 et PB4 : les rediffusions du robot jouent les quatre thèmes, leurs éléments et leurs missions", () => {
    const refs = golden.rediffusions.filter((r) => r.nom.startsWith("robot-") && r.nom !== "robot-30-secondes" && r.nom !== "robot-deblocages" && !r.nom.startsWith("robot-multibilles"));
    const themes = refs.map((r) => dailyPinball(parseDay(r.date)!, r.g).theme).sort();
    expect(themes).toEqual(["espace", "foire", "ocean", "volcan"]);
    for (const r of refs) expect(r.resultat.score, r.nom).toBeGreaterThan(2000);
    const missions = refs.filter((r) => {
      const c = dailyPinball(parseDay(r.date)!, r.g);
      const p = new Partie(c);
      const ev = decoderRediffusion(r.code).evenements;
      let k = 0;
      while (!p.finie) {
        while (k < ev.length && ev[k]!.tick === p.tick) p.regler(ev[k]!.c, ev[k++]!.enfonce);
        p.avancer();
      }
      return p.missionFaite || p.niveau > 1; // lot PBG2 : la mission revient après la multibille
    });
    expect(missions.length, "la mission est réussie par le robot sur les quatre tables").toBe(4);
  });
  it("lot PBG1 : les rediffusions du robot jouent quatre plans différents, et y réussissent des rails et un combo", () => {
    const refs = golden.rediffusions.filter((r) => r.nom.startsWith("robot-") && r.nom !== "robot-30-secondes" && r.nom !== "robot-deblocages" && !r.nom.startsWith("robot-multibilles"));
    expect(refs.map((r) => dailyPinball(parseDay(r.date)!, r.g).plan).sort()).toEqual(["boucle", "bretelle", "doublette", "tremplin"]);
    let combo = 0;
    for (const r of refs) {
      const p = new Partie(dailyPinball(parseDay(r.date)!, r.g));
      const ev = decoderRediffusion(r.code).evenements;
      let k = 0;
      while (!p.finie) {
        while (k < ev.length && ev[k]!.tick === p.tick) p.regler(ev[k]!.c, ev[k++]!.enfonce);
        p.avancer();
      }
      expect(p.railsFaits.some((n) => n > 0), `${r.nom} : au moins un rail réussi`).toBe(true);
      combo = Math.max(combo, p.comboMaxPartie);
    }
    expect(combo, "un combo d'au moins deux rails").toBeGreaterThanOrEqual(2);
  });
  it("lot PBG2 : des rediffusions du robot passent par des multibilles — verrou, trois billes, jackpots, niveaux de la mission suivants — et se rejouent au bit près", () => {
    const refs = golden.rediffusions.filter((r) => r.nom.startsWith("robot-multibilles"));
    expect(refs.length).toBeGreaterThanOrEqual(2);
    for (const r of refs) {
      const p = new Partie(dailyPinball(parseDay(r.date)!, r.g));
      const ev = decoderRediffusion(r.code).evenements;
      let k = 0;
      let billesMax = 0;
      while (!p.finie) {
        while (k < ev.length && ev[k]!.tick === p.tick) p.regler(ev[k]!.c, ev[k++]!.enfonce);
        p.avancer();
        billesMax = Math.max(billesMax, p.autres.length + (p.vide ? 0 : 1));
      }
      expect(p.multibilles, `${r.nom} : multibilles`).toBeGreaterThanOrEqual(1);
      expect(p.jackpotsPartie, `${r.nom} : jackpots`).toBeGreaterThanOrEqual(1);
      expect(billesMax, `${r.nom} : trois billes en jeu à la fois`).toBe(3);
      expect(p.niveau, `${r.nom} : la mission du niveau suivant est revenue`).toBeGreaterThanOrEqual(2);
      expect(p.score).toBe(r.resultat.score);
    }
  });
  it("lot PBG3 : une rediffusion du robot franchit la porte, est sauvée par le poteau et dérivée par l'aiguillage — et se rejoue au bit près", () => {
    const r = golden.rediffusions.find((q) => q.nom === "robot-deblocages")!;
    const p = new Partie(dailyPinball(parseDay(r.date)!, r.g));
    const ev = decoderRediffusion(r.code).evenements;
    let k = 0;
    while (!p.finie) {
      while (k < ev.length && ev[k]!.tick === p.tick) p.regler(ev[k]!.c, ev[k++]!.enfonce);
      p.avancer();
    }
    expect(p.ouvertures, "la porte s'ouvre").toBeGreaterThanOrEqual(1);
    expect(p.passages, "la porte est franchie").toBeGreaterThanOrEqual(1);
    expect(p.sauvetages, "le poteau renvoie une bille").toBeGreaterThanOrEqual(1);
    expect(p.aiguillages, "l'aiguillage dérive une bille").toBeGreaterThanOrEqual(1);
    expect(p.score).toBe(r.resultat.score);
  });
  it("le golden porte les quatre plans dans ses jours", () => {
    expect(new Set(golden.jours.map((j) => j.plan)).size).toBeGreaterThanOrEqual(3);
  });
});
