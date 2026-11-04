import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, contenuDeScenario, dailyBlocks, empreinteContenu, estScenario, rejouer } from "../src/index";

// Le golden : produit par `npm run golden:blocks` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/blocks/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-blocks.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  jours: { date: string; empreinte: string }[];
  rediffusions: { nom: string; date: string; scenario?: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Blocks", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur }).toEqual({ sim: BLOCKS_SIM_VERSION, generateur: BLOCKS_GENERATOR_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("la suite du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyBlocks(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const contenu = ref.scenario && estScenario(ref.scenario) ? contenuDeScenario(ref.scenario) : dailyBlocks(parseDay(ref.date)!, ref.g);
    expect(rejouer(contenu, ref.code)).toEqual(ref.resultat);
  });
});
