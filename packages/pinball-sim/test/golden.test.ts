import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, dailyPinball, empreinteContenu, rejouer, seuilsSurLePapier } from "../src/index";

// Le golden : produit par `npm run golden:pinball` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/pinball/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-pinball.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  jours: { date: string; theme: string; modules: string[]; empreinte: string; seuils: unknown }[];
  rediffusions: { nom: string; date: string; g: number; code: string; resultat: { score: number; ticks: number; billes: number; multMax: number } }[];
};

describe("golden de Pinball", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur }).toEqual({ sim: PINBALL_SIM_VERSION, generateur: PINBALL_GENERATOR_VERSION });
  });
  it.each(golden.jours.map((j) => [j.date, j]))("la table du %s a le thème, les modules, l'empreinte et les seuils de référence", (_date, j) => {
    const ref = j as (typeof golden.jours)[number];
    const c = dailyPinball(parseDay(ref.date)!);
    expect({ theme: c.theme, modules: c.modules, empreinte: empreinteContenu(c), seuils: seuilsSurLePapier(c) }).toEqual({ theme: ref.theme, modules: ref.modules, empreinte: ref.empreinte, seuils: ref.seuils });
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    expect(rejouer(dailyPinball(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
  it("les rediffusions de référence couvrent des parties vides, courtes et longues, avec des points", () => {
    const [vide, tenus, court, long] = ["vide", "batteurs-tenus", "pilote-2-minutes", "pilote-8-minutes"].map((n) => golden.rediffusions.find((r) => r.nom === n)!.resultat);
    expect(vide!.score).toBe(0);
    expect(tenus!.ticks).toBeGreaterThan(900);
    expect(court!.score).toBeGreaterThan(5000);
    expect(long!.score).toBeGreaterThan(court!.score);
  });
});
