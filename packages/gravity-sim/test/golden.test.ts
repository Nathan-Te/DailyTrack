import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { GRAVITY_BOT_VERSION, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, dailyGravity, empreinteContenu, rejouer, seuilsDuRobot } from "../src/index";

// Le golden (lots GR1 et GR2 : le robot remplace le pilote d'essai et donne les seuils) : produit par `npm run golden:gravity` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/gravity/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-gravity.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  bot: number;
  jours: { date: string; ordre: string[]; empreinte: string; seuils?: unknown }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Gravity", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur, bot: golden.bot }).toEqual({ sim: GRAVITY_SIM_VERSION, generateur: GRAVITY_GENERATOR_VERSION, bot: GRAVITY_BOT_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j]))("le contenu du %s a l'ordre et l'empreinte de référence", (_date, j) => {
    const ref = j as (typeof golden.jours)[number];
    const c = dailyGravity(parseDay(ref.date)!);
    expect({ ordre: c.ordre, empreinte: empreinteContenu(c) }).toEqual({ ordre: ref.ordre, empreinte: ref.empreinte });
  });
  // Les seuils du robot (une seconde de jeu chacun) ne sont écrits que pour un jour sur trois : le golden reste rapide à rejouer.
  it.each(golden.jours.filter((j) => j.seuils !== undefined).map((j) => [j.date, j]))("le robot donne au %s les seuils de référence", (_date, j) => {
    const ref = j as (typeof golden.jours)[number];
    expect(seuilsDuRobot(dailyGravity(parseDay(ref.date)!))).toEqual(ref.seuils);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyGravity(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
  it("le robot traverse plusieurs thèmes (le golden couvre les mécaniques)", () => {
    const robot = golden.rediffusions.find((r) => r.nom === "robot")!;
    expect((robot.resultat as { distance: number }).distance).toBeGreaterThan(1000);
  });
});
