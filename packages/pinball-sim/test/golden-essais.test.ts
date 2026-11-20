import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { PINBALL_BOT_VERSION, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, PLANS_ESSAI, THEMES_PINBALL, dailyPinball, empreinteContenu, rejouer } from "../src/index";

// Lot PBT0 : le golden des plans d'essai (`tools/references-essais.ts`, jamais écrit à la main) — une partie du robot sur chacun des six plans, rejouée au bit près : c'est le serveur (`rejouer`) qui retrouve le score. À part de
// `golden-pinball.json`, que le lot ne touche pas.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-essais.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  bot: number;
  rediffusions: { nom: string; plan: string; theme: (typeof THEMES_PINBALL)[number]; date: string; g: number; empreinte: string; code: string; resultat: { score: number; ticks: number; billes: number; multMax: number } }[];
};

describe("golden des plans d'essai (lot PBT0)", () => {
  it("nomme les versions du code, et couvre les trois plans en éventail et leurs miroirs", () => {
    expect({ sim: golden.sim, generateur: golden.generateur, bot: golden.bot }).toEqual({ sim: PINBALL_SIM_VERSION, generateur: PINBALL_GENERATOR_VERSION, bot: PINBALL_BOT_VERSION });
    expect(golden.rediffusions.map((r) => r.plan)).toEqual(PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`]));
    expect(new Set(golden.rediffusions.map((r) => r.theme)).size).toBe(4);
    expect(new Set(golden.rediffusions.map((r) => r.empreinte)).size, "une empreinte par plan et par sens").toBe(6);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la partie « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const contenu = dailyPinball(parseDay(ref.date)!, ref.g, ref.theme, ref.plan);
    expect(empreinteContenu(contenu)).toBe(ref.empreinte);
    expect(ref.resultat.score).toBeGreaterThan(1000);
    expect(rejouer(contenu, ref.code)).toEqual(ref.resultat);
  });
});
