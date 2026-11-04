import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, contenuDeScenario, dailyBlocks, empreinteContenu, enregistrer, estScenario, rejouer } from "../src/index";
import { jouerDiamant, seuilsDe } from "../src/diamant";

// Le golden : produit par `npm run golden:blocks` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/blocks/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-blocks.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  bot: number;
  jours: { date: string; empreinte: string; seuils: unknown }[];
  rediffusions: { nom: string; date: string; scenario?: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Blocks", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur, bot: golden.bot }).toEqual({ sim: BLOCKS_SIM_VERSION, generateur: BLOCKS_GENERATOR_VERSION, bot: BLOCKS_BOT_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("la suite du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyBlocks(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.jours.map((j) => [j.date, j.seuils]))("le bot Diamant donne au %s les seuils %j", (date, seuils) => {
    expect(seuilsDe(dailyBlocks(parseDay(date as string)!))).toEqual(seuils);
  });
  it.each(golden.rediffusions.filter((r) => r.nom.startsWith("diamant")).map((r) => [r.nom, r]))("le bot Diamant rejoue « %s » exactement : mêmes poses, même code", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const contenu = ref.scenario && estScenario(ref.scenario) ? contenuDeScenario(ref.scenario) : dailyBlocks(parseDay(ref.date)!, ref.g);
    const bot = jouerDiamant(contenu);
    expect(enregistrer(contenu, bot.actions)).toBe(ref.code);
    expect(bot.resultat).toEqual(ref.resultat);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const contenu = ref.scenario && estScenario(ref.scenario) ? contenuDeScenario(ref.scenario) : dailyBlocks(parseDay(ref.date)!, ref.g);
    expect(rejouer(contenu, ref.code)).toEqual(ref.resultat);
  });
});
