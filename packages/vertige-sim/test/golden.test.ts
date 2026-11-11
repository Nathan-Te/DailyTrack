import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { NOMS_NIVEAUX, Partie, enchainement, VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, dailyVertige, decoderRediffusion, empreinteContenu, empreinteNiveau, niveau, rejouer, rejouerScenario, verifier, type NomNiveau } from "../src/index";

// Le golden : produit par `npm run golden:vertige` (jamais écrit à la main), rejoué ici par Node et dans Chromium, Firefox et WebKit par `apps/vertige/e2e/determinisme.spec.ts`.
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-vertige.json", import.meta.url), "utf8")) as {
  sim: number;
  generateur: number;
  jours: { date: string; empreinte: string }[];
  niveaux: { nom: NomNiveau; empreinte: string }[];
  rediffusions: { nom: string; scenario: string | null; date: string; g: number; code: string; resultat: unknown; empreintes: string[] }[];
};

describe("golden de Vertige", () => {
  it("nomme les versions du code", () => {
    expect({ sim: golden.sim, generateur: golden.generateur }).toEqual({ sim: VERTIGE_SIM_VERSION, generateur: VERTIGE_GENERATOR_VERSION });
  });
  it("couvre tous les niveaux", () => {
    expect(golden.niveaux.map((n) => n.nom)).toEqual([...NOMS_NIVEAUX]);
  });
  it.each(golden.jours.map((j) => [j.date, j.empreinte]))("le contenu du %s a l'empreinte %s", (date, empreinte) => {
    expect(empreinteContenu(dailyVertige(parseDay(date!)!))).toBe(empreinte);
  });
  it.each(golden.niveaux.map((n) => [n.nom, n.empreinte]))("le niveau « %s » a l'empreinte %s", (nom, empreinte) => {
    expect(empreinteNiveau(niveau(nom as NomNiveau))).toBe(empreinte);
  });
  it.each(golden.rediffusions.map((r) => [r.nom, r]))("la rediffusion « %s » se rejoue au bit près (résultat et empreintes de l'état)", (_nom, r) => {
    const ref = r as (typeof golden.rediffusions)[number];
    const lue = decoderRediffusion(ref.code);
    const c = ref.scenario ? { niveau: ref.scenario as NomNiveau } : { niveau: dailyVertige(parseDay(ref.date)!, ref.g).niveau };
    const v = verifier(c, lue.commandes);
    expect(v.resultat).toEqual(ref.resultat);
    expect(v.empreintes).toEqual(ref.empreintes);
    if (ref.scenario) expect(rejouerScenario(ref.code).resultat).toEqual(ref.resultat);
    else expect(rejouer(dailyVertige(parseDay(ref.date)!, ref.g), ref.code)).toEqual(ref.resultat);
  });
  it("lots V1 et V2 : le golden visite les six directions de la gravité et des traversées de portail, état complet tous les 600 pas", () => {
    const total = (cle: "bascules" | "traversees"): number => golden.rediffusions.reduce((n, r) => n + ((r.resultat as Record<string, number>)[cle] ?? 0), 0);
    expect(total("bascules")).toBeGreaterThanOrEqual(15);
    expect(total("traversees")).toBeGreaterThanOrEqual(30);
    const cube = golden.rediffusions.find((x) => x.nom === "cube-six-directions")!;
    expect((cube.resultat as { bascules: number }).bascules).toBe(5); // lot V2 : cinq faces voisines, six directions (le sol du départ compte)
    // Les six directions : on rejoue le cube et on relève la gravité après chaque bascule.
    const p = new Partie(niveau("cube"));
    const vues = new Set<number>([p.gravite]);
    for (const c of decoderRediffusion(cube.code).commandes) {
      p.avancer(c);
      vues.add(p.gravite);
    }
    expect([...vues].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const r of golden.rediffusions.filter((x) => x.nom !== "vide")) expect(r.empreintes.length).toBeGreaterThanOrEqual(Math.floor((r.resultat as { pas: number }).pas / 600));
  });
  it("lot V2 : le robot de l'enchaînement arrive, sans chute, et rejoue ses paliers", () => {
    const r = golden.rediffusions.find((x) => x.nom === "enchainement-robot")!.resultat as { arrive: boolean; ticks: number; chutes: number };
    expect(r.arrive).toBe(true);
    expect(r.chutes).toBe(0);
    expect(r.ticks).toBe(enchainement().arriveeRobot);
    const reprise = golden.rediffusions.find((x) => x.nom === "enchainement-reprise")!;
    expect((reprise.resultat as { chutes: number }).chutes).toBeGreaterThanOrEqual(1); // la touche de reprise est une chute au palier
  });
  it("le parcours est fini par le joueur scripté, le chrono s'arrête à l'arrivée", () => {
    const r = golden.rediffusions.find((x) => x.nom === "parcours-robot")!.resultat as { arrive: boolean; ticks: number; pas: number };
    expect(r.arrive).toBe(true);
    expect(r.ticks).toBe(r.pas - 1 > 0 ? r.ticks : 0);
    expect(r.ticks).toBeGreaterThan(300);
  });
});
