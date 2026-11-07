import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { RUSH_BOT_VERSION, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, contenuScenario, dailyRush, decoderRediffusion, diamantDuJour, empreinteContenu, jouerJusqua, rejouer, seuilsDe, type Scenario, type Seuils, type Strategie } from "../src/index";

// Le golden : produit par `npm run golden:rush` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/rush/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-rush.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  pilote: number;
  jours: { date: string; empreinte: string; diamant: Strategie; seuils: Seuils }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: unknown }[];
  scenarios: { nom: string; scenario: Scenario; monstres: number; ameliorations: string[]; nv: number; boss: number; phase2: boolean; code: string; ticks: number; empreinte: string; resultat: unknown }[];
};

describe("golden de Rush", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur, pilote: golden.pilote }).toEqual({ sim: RUSH_SIM_VERSION, generateur: RUSH_GENERATOR_VERSION, pilote: RUSH_BOT_VERSION });
  });
  // Lot BR4 : les médailles d'un jour (la stratégie du Diamant et les quatre seuils) ne changent pas sans que la version du pilote (`RUSH_BOT_VERSION`) monte et que le golden se régénère.
  it.each(golden.jours.map((j) => [j.date, j]))("le Diamant et les seuils du %s sont ceux du golden", (_date, j) => {
    const ref = j as (typeof golden.jours)[number];
    const c = dailyRush(parseDay(ref.date)!);
    expect({ diamant: diamantDuJour(c).strategie, seuils: seuilsDe(c) }).toEqual({ diamant: ref.diamant, seuils: ref.seuils });
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("le contenu du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyRush(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyRush(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
  it.each(golden.scenarios.map((s) => [s.nom, s]))("le scénario « %s » donne la même empreinte d'état à %s ticks", (_nom, s) => {
    const ref = s as (typeof golden.scenarios)[number];
    const r = decoderRediffusion(ref.code);
    const jeu = jouerJusqua(contenuScenario(ref.scenario, { monstres: ref.monstres, ameliorations: ref.ameliorations, nv: ref.nv, boss: ref.boss, phase2: ref.phase2 }), r.changements, ref.ticks, undefined, r.choix);
    expect({ empreinte: jeu.empreinte, resultat: jeu.resultat }).toEqual({ empreinte: ref.empreinte, resultat: ref.resultat });
  });
});
