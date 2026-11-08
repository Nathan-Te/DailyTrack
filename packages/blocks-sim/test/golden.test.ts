import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, BOTS_DE_REFERENCE, contenuDeScenario, dailyBlocks, empreinteContenu, enregistrer, estScenario, rejouer } from "../src/index";
import { jouerDiamant } from "../src/diamant";
import { jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";

// Le golden : produit par `npm run golden:blocks` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/blocks/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-blocks.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  bot: number;
  jours: { date: string; empreinte: string; arrets: Record<string, number> }[];
  rediffusions: { nom: string; date: string; scenario?: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Blocks", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur, bot: golden.bot }).toEqual({ sim: BLOCKS_SIM_VERSION, generateur: BLOCKS_GENERATOR_VERSION, bot: BLOCKS_BOT_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("le tirage du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyBlocks(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.jours.map((j) => [j.date, j.arrets]))("les bots de référence arrêtés après leur nombre de pièces donnent au %s les scores %j", (date, arrets) => {
    const c = dailyBlocks(parseDay(date as string)!);
    const obtenus = Object.fromEntries((["bronze", "silver", "gold", "author"] as const).map((m) => [m, (BOTS_DE_REFERENCE[m].bot === "moyen" ? jouerGlouton(c, BOTS_DE_REFERENCE[m].pieces) : jouerDiamant(c, undefined, BOTS_DE_REFERENCE[m].pieces)).resultat.score]));
    expect(obtenus).toEqual(arrets);
  });
  it.each(golden.rediffusions.filter((r) => /^(diamant|moyen|faible)/.test(r.nom)).map((r) => [r.nom, r]))("le bot « %s » rejoue exactement : mêmes poses, même code", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const contenu = ref.scenario && estScenario(ref.scenario) ? contenuDeScenario(ref.scenario) : dailyBlocks(parseDay(ref.date)!, ref.g);
    const bot = ref.nom.startsWith("diamant") ? jouerDiamant(contenu) : ref.nom.startsWith("moyen") ? jouerGlouton(contenu) : jouerFaible(contenu);
    expect(enregistrer(contenu, bot.actions)).toBe(ref.code);
    expect(bot.resultat).toEqual(ref.resultat);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const contenu = ref.scenario && estScenario(ref.scenario) ? contenuDeScenario(ref.scenario) : dailyBlocks(parseDay(ref.date)!, ref.g);
    expect(rejouer(contenu, ref.code)).toEqual(ref.resultat);
  });
});
