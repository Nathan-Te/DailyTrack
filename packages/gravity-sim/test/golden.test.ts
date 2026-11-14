import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, dailyGravity, empreinteContenu, rejouer, seuilsSurLePapier } from "../src/index";

// Le golden : produit par `npm run golden:gravity` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/gravity/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-gravity.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  jours: { date: string; ordre: string[]; empreinte: string; seuils: unknown }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: unknown }[];
};

describe("golden de Gravity", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur }).toEqual({ sim: GRAVITY_SIM_VERSION, generateur: GRAVITY_GENERATOR_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j]))("le contenu du %s a l'ordre, l'empreinte et les seuils de référence", (_date, j) => {
    const ref = j as (typeof golden.jours)[number];
    const c = dailyGravity(parseDay(ref.date)!);
    expect({ ordre: c.ordre, empreinte: empreinteContenu(c), seuils: seuilsSurLePapier(c) }).toEqual({ ordre: ref.ordre, empreinte: ref.empreinte, seuils: ref.seuils });
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyGravity(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
  it("le pilote traverse plusieurs thèmes (le golden couvre les mécaniques)", () => {
    const pilote = golden.rediffusions.find((r) => r.nom === "pilote")!;
    expect((pilote.resultat as { distance: number }).distance).toBeGreaterThan(1000);
  });
});
