import { describe, expect, it } from "vitest";
import {
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  MODULES,
  buildModule,
  MODULE_ENTRIES,
  entryLaunch,
  fromRuns,
  sprintTop,
  initialAttempt,
  moduleSolutions,
  replayAttempt,
  runAttempt,
  type AttemptState,
} from "@cdj/jump-sim";
import { DayMemory, type KeyValue } from "../src/memory";
import { LAUNCH_TILES, galleryFamilies, galleryOrder, launchTicks, launchTilesFor, matchesFilter, nextModule, referenceTicks, solutionReplay } from "../src/modulesInfo";

// Lot 4 : le catalogue des morceaux vu par le jeu (logique pure) et la mémoire par morceau.

class MemStore implements KeyValue {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

describe("galerie", () => {
  it("l'ordre va du plus facile au plus exigeant et contient chaque morceau une fois ; le suivant du dernier est le premier", () => {
    const order = galleryOrder();
    expect(order.map((m) => m.id).sort()).toEqual(MODULES.map((m) => m.id).sort());
    for (let k = 1; k < order.length; k++) expect(order[k]!.min).toBeGreaterThanOrEqual(order[k - 1]!.min);
    for (const m of order) {
      expect(m.variants.length).toBe(MODULES.find((d) => d.id === m.id)!.variants.length);
      for (const v of m.variants) {
        expect(v.exigence).toBeGreaterThanOrEqual(1);
        expect(v.ticks.arret).toBeGreaterThan(0);
        expect(v.ticks.course).toBeGreaterThan(0);
        expect(v.ticks.plein).toBeGreaterThan(0);
      }
    }
    expect(nextModule(order[0]!.id)).toBe(order[1]!.id);
    expect(nextModule(order[order.length - 1]!.id)).toBe(order[0]!.id);
  });

  it("la solution à regarder est la rediffusion stockée ; rejouée sur le morceau sans couloir, elle finit au temps de référence", () => {
    for (const entry of MODULE_ENTRIES) {
      const replay = solutionReplay("cheminee", 1, entry)!;
      expect(replay.levelId).toBe("module:cheminee:1");
      expect(replay.start.elan).toBe(entryLaunch(entry));
      const r = replayAttempt(buildModule("cheminee", 1).level, replay, "module:cheminee:1");
      expect(r.finished).toBe(true);
      expect(r.time).toBe(referenceTicks("cheminee", 1, entry, false));
    }
    expect(solutionReplay("cheminee", 99, "arret")).toBeNull();
  });

  it("lancé, le temps de référence compte le couloir de lancement : droite tenue depuis l'arrêt jusqu'au départ du morceau", () => {
    const t = launchTicks("tunnel", 0, "course");
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(80);
    const run = buildModule("tunnel", 0, { lancement: LAUNCH_TILES });
    const s: AttemptState = runAttempt(initialAttempt(run.level), new Array(t).fill(INPUT_RIGHT), run.level, DEFAULT_JUMP_PARAMS);
    expect(s.player.vx).toBe(DEFAULT_JUMP_PARAMS.runSpeed);
    expect(referenceTicks("tunnel", 0, "course")).toBe(moduleSolutions("tunnel", 0)!.course!.ticks + t);
    expect(referenceTicks("tunnel", 0, "arret")).toBe(moduleSolutions("tunnel", 0)!.arret!.ticks);
    // Lot 8c : en élan plein, le couloir est assez long pour arriver au départ du morceau en élan plein.
    const tp = launchTicks("tunnel", 0, "plein");
    const runP = buildModule("tunnel", 0, { lancement: launchTilesFor("plein") });
    const sp: AttemptState = runAttempt(initialAttempt(runP.level), new Array(tp).fill(INPUT_RIGHT), runP.level, DEFAULT_JUMP_PARAMS);
    expect(sp.player.vx).toBe(sprintTop(DEFAULT_JUMP_PARAMS));
    expect(sp.player.sprint).toBe(DEFAULT_JUMP_PARAMS.sprintDelay);
    expect(referenceTicks("tunnel", 0, "plein")).toBe(moduleSolutions("tunnel", 0)!.plein!.ticks + tp);
    // Et en pratique : droite tenue sur le couloir, puis la solution lancée, finit le morceau à peu près au temps de référence.
    const plein = fromRuns(solutionReplay("tunnel", 0, "plein")!.runs);
    const done = runAttempt(initialAttempt(runP.level), [...new Array(tp).fill(INPUT_RIGHT), ...plein, ...new Array(60).fill(INPUT_RIGHT)], runP.level, DEFAULT_JUMP_PARAMS);
    expect(done.status).toBe(ATTEMPT_FINISHED);
    expect(Math.abs(done.time - referenceTicks("tunnel", 0, "plein")!)).toBeLessThanOrEqual(2);
  });
});

describe("mémoire d'un morceau", () => {
  it("rangée sous `module:<id>:<n>:<entrée>`, ses rediffusions portent `module:<id>:<n>` ; arrêt et élan ne se mélangent pas", () => {
    const store = new MemStore();
    const plain = buildModule("tunnel", 0);
    const run = buildModule("tunnel", 0, { lancement: LAUNCH_TILES });
    const today = () => "2026-10-15";
    const a = new DayMemory({ store, level: plain.level, levelId: plain.levelId, key: `${plain.levelId}:arret`, today });
    a.recordDeath({ x: 4096, y: 4096, cause: 1 }, false);
    const b = new DayMemory({ store, level: run.level, levelId: run.levelId, key: `${run.levelId}:course`, today });
    b.recordDeath({ x: 8192, y: 4096, cause: 1 }, false);
    expect(store.getItem("jump:morts:module:tunnel:0:arret")).not.toBeNull();
    expect(store.getItem("jump:morts:module:tunnel:0:course")).not.toBeNull();
    expect(new DayMemory({ store, level: plain.level, levelId: plain.levelId, key: `${plain.levelId}:arret`, today }).deaths).toHaveLength(1);
    expect(new DayMemory({ store, level: run.level, levelId: run.levelId, key: `${run.levelId}:course`, today }).deaths).toHaveLength(1);
  });
});

describe("galerie : filtres et mutateurs (lot 7)", () => {
  const order = galleryOrder();

  it("chaque carte porte sa famille, son enchaînement long et, pour chaque variante, ses mutateurs écrits comme dans le fichier", () => {
    for (const m of order) {
      const def = MODULES.find((d) => d.id === m.id)!;
      expect(m.family).toBe(def.family);
      expect(m.long).toBe(def.long);
      m.variants.forEach((v) => expect(v.mutations).toBe(def.mutations[v.index]!.map((x) => `+${x.name}${x.arg ? `:${x.arg}` : ""}`).join(" ")));
    }
    expect(order.some((m) => m.variants.some((v) => v.mutations !== ""))).toBe(true);
  });

  it("le filtre garde exactement les morceaux qui portent l'étiquette et appartiennent à la famille ; sans filtre, tous", () => {
    expect(order.filter((m) => matchesFilter(m, { tag: null, family: null }))).toHaveLength(order.length);
    const ressorts = order.filter((m) => matchesFilter(m, { tag: "ressort", family: null }));
    expect(ressorts.map((m) => m.id).sort()).toEqual(MODULES.filter((d) => d.tags.includes("ressort")).map((d) => d.id).sort());
    const chem = order.filter((m) => matchesFilter(m, { tag: null, family: "cheminee" }));
    expect(chem.map((m) => m.id)).toContain("mur-friable");
    expect(chem.every((m) => m.family === "cheminee")).toBe(true);
    expect(order.filter((m) => matchesFilter(m, { tag: "scie", family: "cheminee" })).every((m) => m.tags.includes("scie") && m.family === "cheminee")).toBe(true);
  });

  it("la liste des familles : chacune une fois, dans l'ordre alphabétique, avec son nombre de morceaux", () => {
    const fams = galleryFamilies(order);
    expect(fams.map((f) => f.family)).toEqual([...new Set(MODULES.map((d) => d.family))].sort());
    expect(fams.reduce((n, f) => n + f.count, 0)).toBe(order.length);
  });
});
