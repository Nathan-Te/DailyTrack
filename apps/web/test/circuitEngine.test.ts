import { afterEach, describe, expect, it, vi } from "vitest";
import { PREMIER_JOUR, dailyCircuit, dailyTrackId } from "@cdj/sim";
import { computeDaily } from "../src/circuitCalc";
import { createCircuitEngine, dailyFromData } from "../src/circuitEngine";
import { figureLabel, scenarioTrack, SCENARIOS } from "../src/scenarios";
import type { GenReply, GenRequest } from "../src/circuitWorker";

// Lot 36 : le circuit du jour se calcule dans un fil de travail et revient sous forme de texte et de nombres ; le jeu en refait le circuit (`parseTrack`). Ces tests
// vérifient que ce chemin donne exactement ce que donne `dailyCircuit` (le serveur, les tests de référence), avec ou sans fil de travail.
const DAY = PREMIER_JOUR + 5;

afterEach(() => vi.unstubAllGlobals());

describe("computeDaily : les données qui voyagent entre le fil de travail et le jeu", () => {
  it("sont celles de dailyCircuit, au bit près (texte, tentative, auteur, médailles, thème, identifiant)", () => {
    for (const [variant, theme] of [[0, null], [1, null], [0, "ville"], [2, "banquise"]] as const) {
      const real = dailyCircuit(DAY, variant, theme);
      const d = computeDaily(DAY, theme, variant);
      expect(d, `variante ${variant}, thème ${theme}`).toEqual({
        day: real.day,
        date: real.date,
        number: real.number,
        attempt: real.attempt,
        variant,
        id: real.track.id,
        spec: real.spec,
        palette: real.palette,
        theme: real.theme,
        forcedTheme: real.forcedTheme,
        fallback: false,
        authorMs: real.authorMs,
        medals: real.medals,
        figures: real.figures.map((f) => f.name),
      });
      expect(d.id).toBe(dailyTrackId(DAY, theme, variant));
    }
  }, 60_000);

  it("survivent à la copie du fil de travail (JSON) et redonnent le même circuit", async () => {
    const real = dailyCircuit(DAY);
    const copy = JSON.parse(JSON.stringify(computeDaily(DAY, null, 0)));
    const daily = await dailyFromData(copy);
    expect(daily.track.id).toBe(real.track.id);
    expect(daily.track.blocks).toEqual(real.track.blocks);
    expect(daily.medals).toEqual(real.medals);
    expect(daily.fallback).toBe(false);
  }, 30_000);
});

describe("moteur des circuits", () => {
  it("sans fil de travail (ici : Node), le calcul se fait sur le fil principal, déclaré, avec le même circuit", async () => {
    let main = 0;
    const engine = createCircuitEngine();
    engine.onMainThread = () => main++;
    const daily = await engine.daily(DAY, null, 0);
    const real = dailyCircuit(DAY);
    expect(main).toBe(1);
    expect(daily.track.id).toBe(real.track.id);
    expect(daily.track.blocks).toEqual(real.track.blocks);
    expect([daily.number, daily.date, daily.palette, daily.theme, daily.authorMs, daily.medals]).toEqual([real.number, real.date, real.palette, real.theme, real.authorMs, real.medals]);
  }, 30_000);

  /** Un faux `Worker` : répond à chaque demande par le calcul de `computeDaily` (ce que fait `circuitWorker.ts`), ou échoue. */
  function fauxWorker(mode: "ok" | "erreur-de-chargement" | "reponse-vide") {
    const demandes: GenRequest[] = [];
    class Faux {
      onmessage: ((e: MessageEvent<GenReply>) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      terminate() {}
      postMessage(m: GenRequest) {
        demandes.push(m);
        setTimeout(() => {
          if (mode === "erreur-de-chargement") this.onerror?.(new Error("script introuvable"));
          else if (mode === "reponse-vide") this.onmessage?.({ data: { seq: m.seq, data: null, error: "boum" } } as MessageEvent<GenReply>);
          else this.onmessage?.({ data: { seq: m.seq, data: computeDaily(m.day, m.theme, m.variant ?? 0) } } as MessageEvent<GenReply>);
        }, 0);
      }
    }
    vi.stubGlobal("Worker", Faux);
    return demandes;
  }

  it("avec un fil de travail : une demande, aucun calcul sur le fil principal, le même circuit", async () => {
    const demandes = fauxWorker("ok");
    let main = 0;
    const engine = createCircuitEngine();
    engine.onMainThread = () => main++;
    const [a, b] = await Promise.all([engine.daily(DAY, null, 0), engine.daily(DAY + 1, "nuit", 1)]);
    expect(demandes.map((d) => [d.day, d.theme, d.variant])).toEqual([[DAY, null, 0], [DAY + 1, "nuit", 1]]);
    expect(main).toBe(0);
    expect(a.track.id).toBe(dailyCircuit(DAY).track.id);
    expect(b.track.id).toBe(dailyCircuit(DAY + 1, 1, "nuit").track.id);
    expect(b.forcedTheme).toBe(true);
  }, 60_000);

  it("si le fil de travail tombe ou répond « échec », le calcul continue sur le fil principal", async () => {
    for (const mode of ["erreur-de-chargement", "reponse-vide"] as const) {
      fauxWorker(mode);
      let main = 0;
      const engine = createCircuitEngine();
      engine.onMainThread = () => main++;
      const daily = await engine.daily(DAY, null, 0);
      expect(main, mode).toBe(1);
      expect(daily.track.id, mode).toBe(dailyCircuit(DAY).track.id);
      vi.unstubAllGlobals();
    }
  }, 60_000);

  it("un circuit de secours (le générateur n'a pas abouti) se rejoue sur le circuit d'essai, sans texte", async () => {
    const d = { ...computeDaily(DAY, null, 0), fallback: true, spec: "", id: "essai", figures: [] };
    const daily = await dailyFromData(d);
    expect(daily.fallback).toBe(true);
    expect(daily.track.id).toBe("essai");
  });
});

describe("circuits des scénarios d'essai (chargés à la demande)", () => {
  it("chaque scénario connu a son circuit, sauf `plat`", () => {
    for (const s of SCENARIOS) {
      const track = scenarioTrack(s, new URLSearchParams());
      if (s === "plat") expect(track, s).toBeNull();
      else expect(track?.blocks.length, s).toBeGreaterThan(5);
    }
  });
  it("`figure` : le nom, la variante et le miroir viennent de l'adresse ; un nom inconnu n'a pas de circuit", () => {
    const ok = scenarioTrack("figure", new URLSearchParams("f=pincement&v=0&m=1"));
    expect(ok?.id).toBe("figure-pincement");
    expect(scenarioTrack("figure", new URLSearchParams("f=nimportequoi"))).toBeNull();
    expect(figureLabel("pincement")).not.toBe("");
    expect(figureLabel(null)).toBe("");
  });
});
