import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { CIBLES_GENERATOR_VERSION, CIBLES_SIM_VERSION, dailyCibles, empreinteContenu, rejouer } from "../src/index";

// Le golden : produit par `npm run golden:cibles` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/cibles/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-cibles.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  jours: { date: string; empreinte: string }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Cibles", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur }).toEqual({ sim: CIBLES_SIM_VERSION, generateur: CIBLES_GENERATOR_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("le contenu du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyCibles(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyCibles(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
});
