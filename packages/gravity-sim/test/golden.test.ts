import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, dailyGravity, empreinteContenu, rejouer } from "../src/index";

// Le golden : produit par `npm run golden:gravity` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/gravity/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-gravity.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  jours: { date: string; empreinte: string }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Gravity", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur }).toEqual({ sim: GRAVITY_SIM_VERSION, generateur: GRAVITY_GENERATOR_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("le contenu du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyGravity(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyGravity(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
});
