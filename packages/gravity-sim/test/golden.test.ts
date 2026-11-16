import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { GRAVITY_BOT_VERSION, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, dailyGravity, empreinteContenu, rejouer, seuilsDuRobot, versionsGenerateur, versionsSimJouables } from "../src/index";

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

// Lot GR5 — **les golden des versions gardées** : quand on monte `GRAVITY_GENERATOR_VERSION` ou `GRAVITY_SIM_VERSION`, `npm run golden:gravity` copie d'abord le golden d'avant sous `golden-gravity-g<N>-sim<M>.json` (il ne l'écrase jamais) avant d'écrire
// le nouveau : tant qu'une version est dans les registres (`GENERATEURS`, `SIMS`), son golden est rejoué ici avec **ses** versions — c'est ce qui garde un jour figé sous une ancienne version identique (règle : `CLAUDE.md` du paquet,
// « Les anciennes versions »). Il n'y en a pas encore : la version courante est la première.
const archives = readdirSync(new URL("./fixtures/", import.meta.url)).filter((f) => /^golden-gravity-g\d+-sim\d+\.json$/.test(f));
describe("golden des versions gardées", () => {
  it(`${archives.length} golden archivé(s) : chacun nomme une version que le code sait encore jouer (sinon on retire la version ET son archive, en le disant)`, () => {
    for (const f of archives) {
      const a = JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8")) as typeof golden;
      expect(f).toBe(`golden-gravity-g${a.generateur}-sim${a.sim}.json`);
      expect(versionsGenerateur(), f).toContain(a.generateur);
      expect(versionsSimJouables(), f).toContain(a.sim);
    }
  });
  it.each(archives.map((f) => [f]))("%s : le contenu et les rediffusions se rejouent avec les versions du fichier", (f) => {
    const a = JSON.parse(readFileSync(new URL(`./fixtures/${f as string}`, import.meta.url), "utf8")) as typeof golden;
    for (const j of a.jours) {
      const c = dailyGravity(parseDay(j.date)!, a.generateur, a.sim);
      expect({ ordre: c.ordre, empreinte: empreinteContenu(c) }, j.date).toEqual({ ordre: j.ordre, empreinte: j.empreinte });
    }
    for (const r of a.rediffusions) expect(rejouer(dailyGravity(parseDay(r.date)!, r.g, a.sim), r.code), r.nom).toEqual(r.resultat);
  });
});
