import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DANGERS_LEVEL,
  DEFAULT_JUMP_PARAMS,
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  INPUT_RIGHT,
  JUMP_SIM_VERSION,
  ReplayRunner,
  SANDBOX_LEVEL,
  TILE_SOLID,
  UNITS_PER_TILE,
  attemptReplay,
  decodeReplay,
  demoAttempts,
  encodeReplay,
  fromRuns,
  lifeReplay,
  replayAttempt,
  type JumpReplay,
  type Level,
  type RecordedAttempt,
} from "@cdj/jump-sim";
import { Group } from "three";
import { describe, expect, it } from "vitest";
import { MAX_STAINS, StainLayer } from "../src/actors";
import { CARNAGE_GRACE_TICKS, Carnage, HERO, carnageLabel, carnageSchedule, departures } from "../src/carnage";
import { Ghost } from "../src/ghost";
import { DayMemory, MAX_DEATHS, MAX_LIVES, clearAll, levelHash, loadGhostSetting, saveGhostSetting, type KeyValue } from "../src/memory";
import { JumpSession } from "../src/session";
import { STAIN_DISCS, STAIN_REACH, onSolidFace, stainFor } from "../src/stains";

// Lot 3 côté jeu : mémoire du jour, carnage, taches, fantôme, enregistrement par la session.

const SOLUTION = decodeReplay(ESSAI_SOLUTION_CODE);
const T = UNITS_PER_TILE;

/** Faux `localStorage`. */
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

/** Un stockage qui lève à chaque appel (navigation privée stricte, stockage désactivé). */
const BROKEN: KeyValue = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
  key() {
    throw new Error("SecurityError");
  },
  get length(): number {
    throw new Error("SecurityError");
  },
};

const memoryOf = (store: KeyValue | null, day = "2026-10-14", level: Level = ESSAI_LEVEL, levelId = "essai") => new DayMemory({ store, level, levelId, today: () => day });

/** Essais fictifs de l'essai (déterministes), avec morts et reprises. */
// Lot 8c : 32 essais (16 avant) — avec la solution plus rapide de l'élan, les 16 premiers n'ont plus d’arrivée avec des morts.
const DEMO = demoAttempts(ESSAI_LEVEL, SOLUTION, 42, { attempts: 32 });
const finished = (): RecordedAttempt => ({ replay: SOLUTION, end: "arrivée" });

describe("mémoire du jour", () => {
  it("garde le meilleur essai (temps recalculé par le rejeu), les vies et les morts, et les relit au rechargement", () => {
    const store = new MemStore();
    const m = memoryOf(store);
    expect(m.best).toBeNull();
    for (const e of DEMO) m.recordEssai(e, false);
    const rec = m.recordEssai(finished(), false)!;
    expect(rec.result.finished).toBe(true);
    expect(rec.newBest || m.best!.time <= 2218).toBe(true);
    expect(m.best!.time).toBe(Math.min(...[...DEMO, finished()].map((e) => replayAttempt(ESSAI_LEVEL, e.replay)).filter((r) => r.finished).map((r) => r.time)));
    const lives = [...DEMO, finished()].reduce((n, e) => n + replayAttempt(ESSAI_LEVEL, e.replay).lives.filter((l) => l.ticks > 0).length, 0);
    expect(m.lives).toHaveLength(Math.min(lives, MAX_LIVES));
    m.recordDeath({ x: 12 * T, y: 26 * T, cause: 1 }, false);
    // Rechargement : même jour, même niveau.
    const again = memoryOf(store);
    expect(again.best).toEqual(m.best);
    expect(again.lives).toEqual(m.lives);
    expect(again.deaths).toEqual([{ x: 12 * T, y: 26 * T, cause: 1 }]);
    // Les numéros d'essai continuent (le carnage écarte les vies de l'essai héros par son numéro).
    const next = again.recordEssai(finished(), false)!;
    expect(next.essai).toBe(rec.essai + 1);
    expect(again.liveReplays(next.essai).length).toBe(again.lives.length - 1);
  });

  it("le temps gardé est celui du rejeu : un meilleur essai trafiqué dans le stockage est rejoué de nouveau, et ignoré s'il ne finit pas", () => {
    const store = new MemStore();
    const m = memoryOf(store);
    m.recordEssai(finished(), false);
    // Quelqu'un réécrit le temps à la main : au chargement, le rejeu redonne le vrai temps.
    const key = "jump:meilleur:essai";
    store.setItem(key, JSON.stringify({ ...JSON.parse(store.getItem(key)!), time: 100 }));
    expect(memoryOf(store).best!.time).toBe(2218);
    // Une rediffusion qui ne finit pas n'est pas un meilleur essai.
    store.setItem(key, JSON.stringify({ code: encodeReplay(attemptReplay("essai", [2, 2, 2])), time: 3, deaths: 0, essai: 1 }));
    expect(memoryOf(store).best).toBeNull();
  });

  it("se purge quand le jour change, quand le niveau change, quand la version change", () => {
    const store = new MemStore();
    const m = memoryOf(store);
    m.recordEssai(finished(), false);
    m.recordDeath({ x: 0, y: 0, cause: 1 }, false);
    expect(memoryOf(store).best).not.toBeNull();
    // Autre jour.
    expect(memoryOf(store, "2026-10-15").best).toBeNull();
    // Le lendemain a tout effacé (même revenu au 14).
    expect(memoryOf(store, "2026-10-14").lives).toEqual([]);
    // Autre contenu de niveau sous le même identifiant.
    const m2 = memoryOf(store);
    m2.recordEssai(finished(), false);
    const other = memoryOf(store, "2026-10-14", DANGERS_LEVEL, "essai");
    expect(other.best).toBeNull();
    expect(other.deaths).toEqual([]);
    // Autre version de la simulation dans la méta : purge.
    const m3 = memoryOf(store);
    m3.recordEssai(finished(), false);
    const meta = JSON.parse(store.getItem("jump:jour:essai")!);
    store.setItem("jump:jour:essai", JSON.stringify({ ...meta, simVersion: JUMP_SIM_VERSION + 1 }));
    expect(memoryOf(store).best).toBeNull();
  });

  it("lot 4 : une mémoire laissée par la version 2 (points de passage touchés) est purgée au chargement, sans bruit", () => {
    // Ce que la version 2 a réellement écrit : la solution de l'essai codée avec `JUMP_SIM_VERSION` = 2, une vie, une mort.
    const V2_SOLUTION = "AQIFZXNzYWkAygU-6gQewgJm4gEmogNGwgMgQUIhIOIChgGiBSbiAiZCJEVGJSQiZUQhZkQiJSQiISIhIKYBqgOeAeoDHuoCfsoEXsoFXqIEJoIDJoIEpgGiAyaqBb4BogImogMgCh4kogNAKT2GASJEJqoDPiAhIOIBQCIg6gEewgKGAcoDPsIIICIgogUgQSDqBD6qAz6qBB7qAj6qAz66Aw";
    expect(JUMP_SIM_VERSION).toBe(4);
    expect(decodeReplay(V2_SOLUTION).simVersion).toBe(2);
    const store = new MemStore();
    const fresh = memoryOf(store);
    fresh.recordEssai(finished(), false);
    const meta = JSON.parse(store.getItem("jump:jour:essai")!);
    store.setItem("jump:jour:essai", JSON.stringify({ ...meta, simVersion: 2 }));
    store.setItem("jump:meilleur:essai", JSON.stringify({ code: V2_SOLUTION, time: 2595, deaths: 0, essai: 1 }));
    store.setItem("jump:vies:essai", JSON.stringify([{ code: V2_SOLUTION, essai: 1 }]));
    store.setItem("jump:morts:essai", JSON.stringify([{ x: 4096, y: 4096, cause: 1 }]));
    const m = memoryOf(store);
    expect(m.best).toBeNull();
    expect(m.lives).toEqual([]);
    expect(m.deaths).toEqual([]);
    expect(store.getItem("jump:meilleur:essai")).toBeNull();
    // Même avec une méta à jour, une rediffusion de la version 2 n'est jamais rejouée comme meilleur essai.
    const meta3 = JSON.parse(store.getItem("jump:jour:essai") ?? JSON.stringify({ ...meta, simVersion: 3 }));
    store.setItem("jump:jour:essai", JSON.stringify({ ...meta3, simVersion: JUMP_SIM_VERSION, level: meta.level, day: meta.day }));
    store.setItem("jump:meilleur:essai", JSON.stringify({ code: V2_SOLUTION, time: 2595, deaths: 0, essai: 1 }));
    expect(memoryOf(store).best).toBeNull();
  });

  it("lot 8c : une mémoire laissée par la version 3 (sans élan) est purgée au chargement, sans bruit", () => {
    // Ce que la version 3 a réellement écrit : la solution de l'essai d'avant l'élan (21,625 s), codée avec `JUMP_SIM_VERSION` = 3.
    const V3_SOLUTION = "AQMFZXNzYWkAygU-6gQewgJm4gEmogNGwgMgQUIhIOIChgGiBSbiAiZCJEVGJSQiZUQhZkQiJSQiISIhIKYBqgOeAeoDHuoCfsoEXsoFXqIEJoIDJoIEpgGiAyaqBb4BogImogMgCh4kogNAKT2GASJEJqoDPiAhIOIBQCIg6gEewgKGAcoDPsIIICIgogUgQSDqBD6qAz6qBB7qAj6qAz66Aw";
    expect(decodeReplay(V3_SOLUTION).simVersion).toBe(3);
    const store = new MemStore();
    const fresh = memoryOf(store);
    fresh.recordEssai(finished(), false);
    const meta = JSON.parse(store.getItem("jump:jour:essai")!);
    store.setItem("jump:jour:essai", JSON.stringify({ ...meta, simVersion: 3 }));
    store.setItem("jump:meilleur:essai", JSON.stringify({ code: V3_SOLUTION, time: 2595, deaths: 0, essai: 1 }));
    store.setItem("jump:vies:essai", JSON.stringify([{ code: V3_SOLUTION, essai: 1 }]));
    store.setItem("jump:morts:essai", JSON.stringify([{ x: 4096, y: 4096, cause: 1 }]));
    const m = memoryOf(store);
    expect(m.best).toBeNull();
    expect(m.lives).toEqual([]);
    expect(m.deaths).toEqual([]);
    expect(store.getItem("jump:meilleur:essai")).toBeNull();
    // Même avec une méta à jour, une rediffusion de la version 3 n'est jamais rejouée comme meilleur essai.
    store.setItem("jump:jour:essai", JSON.stringify({ ...meta, simVersion: JUMP_SIM_VERSION }));
    store.setItem("jump:meilleur:essai", JSON.stringify({ code: V3_SOLUTION, time: 2595, deaths: 0, essai: 1 }));
    expect(memoryOf(store).best).toBeNull();
  });

  it("le jour qui change en cours de partie (page restée ouverte après minuit) repart de zéro à la prochaine écriture", () => {
    const store = new MemStore();
    let day = "2026-10-14";
    const m = new DayMemory({ store, level: ESSAI_LEVEL, levelId: "essai", today: () => day });
    m.recordEssai(finished(), false);
    m.recordDeath({ x: 1, y: 1, cause: 1 }, false);
    day = "2026-10-15";
    m.recordDeath({ x: 2, y: 2, cause: 1 }, false);
    expect(m.best).toBeNull();
    expect(m.deaths).toEqual([{ x: 2, y: 2, cause: 1 }]);
  });

  it("les autres niveaux d'un autre jour sont rangés ; ceux du jour restent", () => {
    const store = new MemStore();
    memoryOf(store, "2026-10-13", DANGERS_LEVEL, "dangers").recordDeath({ x: 1, y: 1, cause: 1 }, false);
    memoryOf(store, "2026-10-14", SANDBOX_LEVEL, "bac-a-sable").recordDeath({ x: 1, y: 1, cause: 1 }, false);
    memoryOf(store, "2026-10-14");
    expect([...store.map.keys()].some((k) => k.endsWith(":dangers"))).toBe(false);
    expect(store.getItem("jump:morts:bac-a-sable")).not.toBeNull();
  });

  it("plafonne les vies aux 300 plus récentes et les morts aux 300 plus récentes", () => {
    const store = new MemStore();
    const m = memoryOf(store);
    // 640 essais enregistrés, comme avant le lot 8c (40 passes de 16 essais) : la démo en a 32 depuis, d'où 20 passes ; bien plus de vies
    // que le plafond, et chaque essai est rejoué par la mémoire (le double de passes dépassait 5 s en CI).
    const PASSES = 640 / DEMO.length;
    for (let i = 0; i < PASSES; i++) for (const e of DEMO) m.recordEssai(e, false);
    expect(m.lives).toHaveLength(MAX_LIVES);
    // Les plus récentes : la dernière vie gardée vient du dernier essai enregistré.
    expect(m.lives.at(-1)!.essai).toBe(PASSES * DEMO.length);
    for (let i = 0; i < MAX_DEATHS + 25; i++) m.recordDeath({ x: i, y: i, cause: 1 }, false);
    expect(m.deaths).toHaveLength(MAX_DEATHS);
    expect(m.deaths[0]!.x).toBe(25);
    expect(memoryOf(store).lives).toHaveLength(MAX_LIVES);
  });

  it("rien n'est enregistré avec des réglages modifiés : ni meilleur essai, ni vies, ni taches", () => {
    const store = new MemStore();
    const m = memoryOf(store);
    expect(m.recordEssai(finished(), true)).toBeNull();
    expect(m.recordDeath({ x: 1, y: 1, cause: 1 }, true)).toBe(false);
    expect(m.best).toBeNull();
    expect(m.lives).toEqual([]);
    expect(m.deaths).toEqual([]);
    expect([...store.map.keys()].filter((k) => !k.startsWith("jump:jour:"))).toEqual([]);
  });

  it("marche sans stockage, et avec un stockage qui lève à chaque appel", () => {
    for (const store of [null, BROKEN]) {
      const m = memoryOf(store);
      for (const e of DEMO.slice(0, 4)) expect(() => m.recordEssai(e, false)).not.toThrow();
      const rec = m.recordEssai(finished(), false)!;
      expect(rec.result.finished).toBe(true);
      expect(m.best!.time).toBeLessThanOrEqual(2218);
      expect(m.recordDeath({ x: 1, y: 1, cause: 1 }, false)).toBe(true);
      expect(m.liveReplays().length).toBeGreaterThan(0);
      expect(m.storedSize()).toBe(0);
      expect(loadGhostSetting(store)).toBe(true);
      expect(() => saveGhostSetting(store, false)).not.toThrow();
      expect(clearAll(store)).toBe(0);
    }
  });

  it("une vie d'une autre version dans le stockage est ignorée", () => {
    const store = new MemStore();
    const m = memoryOf(store);
    m.recordEssai(DEMO[0]!, false);
    const lives = JSON.parse(store.getItem("jump:vies:essai")!) as { code: string; essai: number }[];
    const old = { ...decodeReplay(lives[0]!.code), simVersion: JUMP_SIM_VERSION - 1 };
    lives.push({ code: encodeReplay(old), essai: 99 }, { code: "n'importe quoi", essai: 98 });
    store.setItem("jump:vies:essai", JSON.stringify(lives));
    expect(memoryOf(store).lives).toHaveLength(lives.length - 2);
  });

  it("importe une rediffusion comme meilleur essai si le rejeu la valide ; refuse les autres", () => {
    const m = memoryOf(new MemStore());
    expect(m.importBest(ESSAI_SOLUTION_CODE)).toEqual({ ok: true, time: 2218 });
    expect(m.importBest(encodeReplay(attemptReplay("essai", [2]))).ok).toBe(false);
    expect(m.importBest("@@").ok).toBe(false);
    expect(m.importBest(encodeReplay({ ...SOLUTION, levelId: "dangers" })).ok).toBe(false);
  });

  it("l'empreinte d'un niveau change avec son contenu", () => {
    expect(levelHash(ESSAI_LEVEL)).toBe(levelHash(ESSAI_LEVEL));
    expect(levelHash(ESSAI_LEVEL)).not.toBe(levelHash(DANGERS_LEVEL));
  });
});

describe("la session enregistre ses essais", () => {
  it("arrivée, mort sans point de passage, recommencer : chaque essai clos est rendu, avec son drapeau « réglages modifiés »", () => {
    const s = new JumpSession(ESSAI_LEVEL, { ...DEFAULT_JUMP_PARAMS }, "essai");
    // Courir dans les pics du début : mort sans point de passage.
    for (let i = 0; i < 200 && s.state.status !== ATTEMPT_DEAD; i++) s.step(INPUT_RIGHT);
    const died = s.takeEssai()!;
    expect(died.essai.end).toBe("mort");
    expect(died.tuned).toBe(false);
    expect(replayAttempt(ESSAI_LEVEL, died.essai.replay).deaths).toHaveLength(1);
    for (let i = 0; i < 30; i++) s.step(0);
    // La solution jusqu'au bout.
    for (const bits of fromRuns(SOLUTION.runs)) s.step(bits);
    expect(s.state.status).toBe(ATTEMPT_FINISHED);
    const done = s.takeEssai()!;
    expect(done.essai.end).toBe("arrivée");
    expect(encodeReplay(done.essai.replay)).toBe(ESSAI_SOLUTION_CODE);
    // Recommencer en cours de route : abandon.
    s.restart();
    for (let i = 0; i < 40; i++) s.step(INPUT_RIGHT);
    s.restart();
    expect(s.takeEssai()!.essai.end).toBe("abandon");
    expect(s.takeEssai()).toBeNull();
    // Réglages modifiés : l'essai est rendu marqué, la mémoire n'en fera rien.
    s.params.gravity += 1;
    for (let i = 0; i < 40; i++) s.step(INPUT_RIGHT);
    s.flush();
    expect(s.takeEssai()!.tuned).toBe(true);
  });

  it("sans identifiant de niveau (lecture), rien n'est enregistré", () => {
    const s = new JumpSession(ESSAI_LEVEL, { ...DEFAULT_JUMP_PARAMS });
    for (const bits of fromRuns(SOLUTION.runs)) s.step(bits);
    expect(s.state.status).toBe(ATTEMPT_FINISHED);
    expect(s.takeEssai()).toBeNull();
  });
});

describe("carnage", () => {
  const lives = DEMO.flatMap((e) => replayAttempt(ESSAI_LEVEL, e.replay).lives.map((l) => lifeReplay(e.replay, l)));

  it("calendrier : les vies nées au départ partent avec le héros, les autres au moment où il passe leur point de passage", () => {
    const { checkpoints, heroTicks } = departures(ESSAI_LEVEL, SOLUTION);
    expect(heroTicks).toBe(2218);
    // La solution passe les cinq points dans l'ordre.
    expect(checkpoints.every((t) => t > 0)).toBe(true);
    for (let c = 1; c < checkpoints.length; c++) expect(checkpoints[c]!).toBeGreaterThan(checkpoints[c - 1]!);
    // Au pas indiqué, le centre du héros vient de franchir la colonne du point (lot 4 : c'est aussi le pas où la simulation le prend, même
    // quand la solution saute par-dessus), pas avant.
    const runner = new ReplayRunner(ESSAI_LEVEL, SOLUTION);
    const taken: number[] = ESSAI_LEVEL.checkpoints.map(() => -1);
    const crossed: number[] = ESSAI_LEVEL.checkpoints.map(() => -1);
    while (runner.step()) {
      const s = runner.state;
      if (s.checkpoint >= 0 && taken[s.checkpoint] === -1) taken[s.checkpoint] = runner.tick;
      const col = Math.floor((s.player.x + 1536) / T);
      ESSAI_LEVEL.checkpoints.forEach((cp, c) => {
        if (crossed[c] === -1 && col >= cp.col) crossed[c] = runner.tick;
      });
    }
    expect(checkpoints).toEqual(crossed);
    expect(taken).toEqual(crossed);
    const { depart } = carnageSchedule(ESSAI_LEVEL, SOLUTION, lives);
    lives.forEach((l, i) => expect(depart[i]).toBe(l.start.checkpoint < 0 ? 0 : checkpoints[l.start.checkpoint]));
    expect(lives.some((l) => l.start.checkpoint >= 0)).toBe(true);
  });

  it("un héros qui saute un point de passage le « passe » quand il en dépasse la colonne", () => {
    // Le héros meurt avant le premier point : les vies de ce point ne partent jamais.
    const short = attemptReplay("essai", new Array(150).fill(INPUT_RIGHT));
    const early = departures(ESSAI_LEVEL, short);
    expect(early.checkpoints.every((t) => t === -1)).toBe(true);
    const fromCp = lives.filter((l) => l.start.checkpoint >= 0);
    expect(carnageSchedule(ESSAI_LEVEL, short, fromCp).depart.every((d) => d === -1)).toBe(true);
  });

  it("chaque vie meurt là où elle est morte ; le héros arrive ; le compteur dit « N vies · 1 arrivée »", () => {
    const c = new Carnage(ESSAI_LEVEL, SOLUTION, lives);
    const deaths: { life: number; x: number; y: number }[] = [];
    let guard = 0;
    while (!c.done && guard++ < 10_000) for (const e of c.step()) if (e.kind === "death") deaths.push(e);
    expect(c.done).toBe(true);
    expect(c.tick).toBeLessThanOrEqual(c.heroTicks + CARNAGE_GRACE_TICKS);
    expect(c.hero.state.status).toBe(ATTEMPT_FINISHED);
    expect(c.total).toBe(1 + lives.length);
    // Les morts du carnage sont exactement celles des vies (rejouées seules).
    const expected = lives.map((l) => replayAttempt(ESSAI_LEVEL, l).deaths[0]).filter((d) => d !== undefined);
    expect(deaths.filter((d) => d.life !== HERO).map((d) => ({ x: d.x, y: d.y }))).toEqual(expect.arrayContaining(expected.map((d) => ({ x: d!.x, y: d!.y }))));
    const finishers = lives.filter((l) => replayAttempt(ESSAI_LEVEL, l).finished).length;
    expect(c.arrivals).toBe(1 + finishers);
    expect(carnageLabel(47, 1)).toBe("47 vies · 1 arrivée");
    expect(carnageLabel(1, 2)).toBe("1 vie · 2 arrivées");
  });

  it("le héros est rejoué depuis le départ, reprises comprises : ses vies comptent, ses morts s'y voient", () => {
    const withDeaths = DEMO.map((e) => e.replay).find((r) => {
      const res = replayAttempt(ESSAI_LEVEL, r);
      return res.finished && res.deaths.length > 0;
    })!;
    expect(withDeaths).toBeDefined();
    const res = replayAttempt(ESSAI_LEVEL, withDeaths);
    const c = new Carnage(ESSAI_LEVEL, withDeaths, []);
    let heroDeaths = 0;
    while (!c.done) for (const e of c.step()) if (e.kind === "death" && e.life === HERO) heroDeaths++;
    expect(heroDeaths).toBe(res.deaths.length);
    expect(c.total).toBe(res.lives.length);
    expect(c.arrivals).toBe(1);
  });

  it("les vies de l'essai héros ne sont pas dupliquées (la mémoire les écarte)", () => {
    const m = memoryOf(new MemStore());
    for (const e of DEMO.slice(0, 6)) m.recordEssai(e, false);
    const hero = m.recordEssai(finished(), false)!;
    const others = m.liveReplays(hero.essai);
    expect(others.length).toBe(m.lives.length - hero.result.lives.length);
    expect(others.some((o) => encodeReplay(o) === encodeReplay(SOLUTION))).toBe(false);
  });

  it("une vie part au pas exact où le héros passe son point ; passer le carnage l'arrête", () => {
    const fromCp = lives.filter((l) => l.start.checkpoint >= 0).slice(0, 3);
    const c = new Carnage(ESSAI_LEVEL, SOLUTION, fromCp);
    const departs: number[] = [];
    while (!c.done && c.tick < 3000) for (const e of c.step()) if (e.kind === "depart") departs.push(c.tick - 1);
    expect(departs).toEqual(c.lives.map((l) => l.depart).sort((a, b) => a - b));
    const d = new Carnage(ESSAI_LEVEL, SOLUTION, lives);
    d.step();
    d.stop();
    expect(d.done).toBe(true);
    expect(d.step()).toEqual([]);
  });
});

describe("taches", () => {
  /** Toutes les morts possibles d'une partie : celles des essais fictifs et des positions au hasard dans la grille. */
  const deaths: { x: number; y: number; level: Level }[] = [];
  for (const e of DEMO) for (const d of replayAttempt(ESSAI_LEVEL, e.replay).deaths) deaths.push({ x: d.x, y: d.y, level: ESSAI_LEVEL });
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 400; i++) deaths.push({ x: Math.floor(rnd() * ESSAI_LEVEL.width * T), y: Math.floor(rnd() * (ESSAI_LEVEL.height + 1) * T), level: ESSAI_LEVEL });
  for (let i = 0; i < 200; i++) deaths.push({ x: Math.floor(rnd() * DANGERS_LEVEL.width * T), y: Math.floor(rnd() * DANGERS_LEVEL.height * T), level: DANGERS_LEVEL });

  it("chaque disque est centré sur une face exposée d'un bloc plein (sol, mur ou plafond) : jamais dans le vide", () => {
    let discs = 0;
    for (const d of deaths) {
      for (const disc of stainFor(d.level, d.x, d.y)) {
        expect(onSolidFace(d.level, disc), `disque en (${disc.x}, ${disc.y})`).toBe(true);
        expect(disc.r).toBeGreaterThan(0);
        expect(disc.r).toBeLessThanOrEqual(0.9);
        discs++;
      }
    }
    expect(discs).toBeGreaterThan(1000);
  });

  it("chaque mort d'une vraie partie laisse une tache, sur la surface la plus proche", () => {
    for (const e of DEMO) {
      for (const d of replayAttempt(ESSAI_LEVEL, e.replay).deaths) {
        const discs = stainFor(ESSAI_LEVEL, d.x, d.y);
        expect(discs.length).toBeGreaterThan(0);
        expect(discs.length).toBeLessThanOrEqual(STAIN_DISCS);
        // Le premier disque est le point de surface le plus proche de la mort.
        const px = d.x / T;
        const py = d.y / T;
        const main = Math.hypot(discs[0]!.x - px, discs[0]!.y - py);
        expect(main).toBeLessThanOrEqual(STAIN_REACH);
        // Toutes les faces peintes sont à moins d'une demi-tuile de plus que la plus proche.
        for (const disc of discs) expect(onSolidFace(ESSAI_LEVEL, disc)).toBe(true);
      }
    }
  });

  it("une mort sur un sol plat peint le sol ; contre un mur, le mur ; sous un plafond, le plafond ; loin de tout, rien", () => {
    const rows = ["#..........#", "#..........#", "#..........#", "#..........#", "#..........#", "#..........#", "#..........#", "#..........#", "#S........F#", "############"];
    const lv = { ...ESSAI_LEVEL, width: 12, height: 10, tiles: rows.join("").split("").map((c) => (c === "#" ? TILE_SOLID : 0)) } as Level;
    const floor = stainFor(lv, 5.5 * T, 8.6 * T);
    expect(floor[0]).toMatchObject({ y: 9 });
    const wall = stainFor(lv, 1.4 * T, 4.5 * T);
    expect(wall[0]).toMatchObject({ x: 1 });
    // Le haut de la grille (rangée −1) est hors de la grille : pas de plafond peint là ; un vrai plafond dans la grille, oui.
    const big = { ...lv, width: 40, height: 30, tiles: new Array(40 * 30).fill(0) } as Level;
    expect(stainFor(big, 20 * T, 15 * T)).toEqual([]);
  });

  it("même mort, même tache (au rechargement, chaque tache revient au même endroit)", () => {
    const d = deaths[0]!;
    expect(stainFor(d.level, d.x, d.y)).toEqual(stainFor(d.level, d.x, d.y));
  });

  it("la couche de taches plafonne à 300 : au-delà, les plus anciennes s'estompent puis s'en vont", () => {
    const layer = new StainLayer(new Group(), 0xffffff, 0x336633);
    const disc = stainFor(ESSAI_LEVEL, 12 * T, 26 * T);
    for (let i = 0; i < MAX_STAINS + 20; i++) layer.add(disc);
    expect(layer.count).toBe(MAX_STAINS);
    expect(layer.added).toBe(MAX_STAINS + 20);
    layer.update(0.5);
    expect(layer.discs).toBeGreaterThan(MAX_STAINS * disc.length); // celles qui s'estompent sont encore là…
    layer.update(5);
    expect(layer.discs).toBe(MAX_STAINS * disc.length); // … puis partent
    // Un rechargement de 500 morts n'en montre que 300, sans estompe.
    layer.reset(new Array(500).fill(disc));
    expect(layer.count).toBe(MAX_STAINS);
  });
});

describe("fantôme", () => {
  it("calé sur le chrono de l'essai : au chrono t, il a joué t pas ; un nouvel essai le ramène au départ", () => {
    const g = new Ghost(ESSAI_LEVEL, SOLUTION);
    g.sync(0);
    expect(g.tick).toBe(0);
    const runner = new ReplayRunner(ESSAI_LEVEL, SOLUTION);
    for (let t = 1; t <= 600; t++) {
      g.sync(t);
      runner.step();
      expect(g.state).toEqual(runner.state);
    }
    g.sync(600);
    expect(g.prev).toBe(g.state); // chrono figé : pas d'interpolation
    g.sync(5);
    expect(g.tick).toBe(5);
    g.sync(100_000);
    expect(g.done).toBe(true);
    expect(g.state.status).toBe(ATTEMPT_FINISHED);
  });

  it("ses morts et ses reprises sont les siennes", () => {
    const withDeaths = DEMO.map((e) => e.replay).find((r) => replayAttempt(ESSAI_LEVEL, r).deaths.length > 0 && replayAttempt(ESSAI_LEVEL, r).lives.length > 1)!;
    const g = new Ghost(ESSAI_LEVEL, withDeaths);
    let dead = 0;
    let respawned = 0;
    for (let t = 1; t < 9000 && !g.done; t++) {
      const was = g.dead;
      g.sync(t);
      if (g.dead && !was) dead++;
      if (!g.dead && was) respawned++;
    }
    expect(dead).toBeGreaterThan(0);
    expect(respawned).toBeGreaterThan(0);
  });
});

