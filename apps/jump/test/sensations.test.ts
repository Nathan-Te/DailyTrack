import { describe, expect, it } from "vitest";
import {
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  INPUT_JUMP,
  decodeReplay,
  fromRuns,
  replayStartState,
  INPUT_LEFT,
  INPUT_RIGHT,
  initialAttempt,
  parseLevel,
  stepAttempt,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { CARNAGE_EVENTS_PER_WINDOW, CARNAGE_WINDOW_TICKS, CarnageFilter, EVENT_KINDS, EventLog, STRIDE_TILES, eventsBetween, type GameEvent } from "../src/events";
import {
  CARNAGE_SOUNDS_PER_100MS,
  MAX_VOICES,
  MEDAL_PHRASES,
  SAW_GAIN,
  SAW_RANGE,
  SoundRate,
  VoiceLimiter,
  sawMix,
  sliderGain,
  soundFor,
  soundGainFor,
} from "../src/audioLogic";
import { BIG_FALL, Blink, Particles, Trail, VIBRATE_GAP_MS, Vibrator, feelColors, feelEvent, vibrationFor } from "../src/feel";
import { SETTINGS_KEY, defaultSettings, feelLevels, loadSettings, parseSettings, saveSettings } from "../src/settings";
import type { KeyValue } from "../src/memory";
import { PALETTES } from "../src/palette";

// Lot 8 : les événements de jeu déduits de deux états successifs, la logique du son, les réglages du joueur, les effets.

const R = INPUT_RIGHT;
const L = INPUT_LEFT;
const J = INPUT_JUMP;

/** Joue `script` (paires [commande, nombre de pas]) depuis le départ et rend tous les événements, avec l'état final. */
function play(level: Level, script: [number, number][]): { events: GameEvent[]; state: AttemptState } {
  let s = initialAttempt(level);
  const events: GameEvent[] = [];
  let tick = 0;
  for (const [bits, n] of script) {
    for (let i = 0; i < n; i++) {
      const next = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
      events.push(...eventsBetween(s, next, level, DEFAULT_JUMP_PARAMS, tick++));
      s = next;
    }
  }
  return { events, state: s };
}

const kinds = (events: GameEvent[]) => events.map((e) => e.kind);
const only = <K extends GameEvent["kind"]>(events: GameEvent[], kind: K) => events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);

const FLAT = parseLevel(`
....................
....................
....................
S.......C.........F.
####################`);

describe("événements de jeu (eventsBetween)", () => {
  it("course : des pas à la cadence de la distance, un point de passage, l'arrivée (une seule fois)", () => {
    const { events, state } = play(FLAT, [[R, 400]]);
    expect(state.status).toBe(ATTEMPT_FINISHED);
    const steps = only(events, "pas");
    // ≈ un pas tous les STRIDE_TILES tuiles parcourues au sol (de la colonne 0,5 à l'arrivée en colonne 18).
    expect(steps.length).toBeGreaterThanOrEqual(Math.floor(17 / STRIDE_TILES) - 1);
    expect(steps.length).toBeLessThanOrEqual(Math.ceil(19 / STRIDE_TILES) + 1);
    const full = steps.filter((e) => e.full);
    expect(full.length).toBeGreaterThan(0);
    expect(full[0]!.cadence).toBeCloseTo(11 / STRIDE_TILES, 0);
    expect(only(events, "pointDePassage")).toEqual([expect.objectContaining({ index: 0, x: 8.5 })]);
    expect(only(events, "arrivee")).toHaveLength(1);
    expect(kinds(events)).not.toContain("saut");
    expect(kinds(events)).not.toContain("atterrissage");
  });

  it("saut et atterrissage faible (petit saut coupé)", () => {
    const { events } = play(FLAT, [
      [J, 1],
      [0, 80],
    ]);
    expect(kinds(events)).toEqual(["saut", "atterrissage"]);
    const land = only(events, "atterrissage")[0]!;
    expect(land.intensity).toBeGreaterThan(0.2);
    expect(land.intensity).toBeLessThan(0.6);
    expect(land.y).toBeCloseTo(4, 5); // pieds sur le sol (haut de la rangée 4)
  });

  it("atterrissage fort après une grande chute, plus fort qu'un petit saut", () => {
    const cliff = parseLevel(`
S.........
###.......
..#.......
..#.......
..#.......
..#.......
..#......F
##########`);
    const { events } = play(cliff, [[R, 120]]);
    const land = only(events, "atterrissage");
    expect(land).toHaveLength(1);
    expect(land[0]!.intensity).toBeGreaterThanOrEqual(BIG_FALL);
    expect(kinds(events)).not.toContain("saut"); // tomber d'un rebord n'est pas sauter
  });

  it("glisse murale (début et fin) et saut mural, côté du mur", () => {
    const wall = parseLevel(`
F.........
..........
..........
.....#....
.....#....
.....#....
.....#....
.....#....
.....#....
S....#....
##########`);
    const { events } = play(wall, [
      [R, 40], // contre le mur
      [R | J, 30], // saute en le poussant
      [R, 40], // retombe en glissant
      [0, 1],
      [J, 6], // saut mural (relâcher, puis appuyer)
      [0, 60],
    ]);
    const k = kinds(events);
    expect(k.indexOf("glisseDebut")).toBeGreaterThan(k.indexOf("saut"));
    expect(only(events, "glisseDebut")[0]!.side).toBe(1);
    const wj = only(events, "sautMural");
    expect(wj).toHaveLength(1);
    expect(wj[0]!.side).toBe(1); // le mur quitté est à droite
    expect(k.indexOf("glisseFin")).toBeGreaterThan(k.indexOf("glisseDebut"));
    expect(k.indexOf("glisseFin")).toBeLessThanOrEqual(k.indexOf("sautMural") + 1);
  });

  it("mort par un pic, par une scie, par le bas ; puis réapparition au départ", () => {
    const spike = play(parseLevel(`S...^....F\n##########`), [[R, 120]]);
    expect(only(spike.events, "mort")[0]!.cause).toBe("pic");
    const saw = play(parseLevel(`S...o....F\n##########`), [[R, 120]]);
    expect(only(saw.events, "mort")[0]!.cause).toBe("scie");
    const fall = play(parseLevel(`S........F\n###....###`), [[R, 200]]);
    const deaths = only(fall.events, "mort");
    expect(deaths[0]!.cause).toBe("chute");
    // Après la mort : réapparition (nouvel essai, sans point de passage) ; aucun autre événement pendant l'attente.
    const k = kinds(fall.events);
    const at = k.indexOf("mort");
    expect(k[at + 1]).toBe("reapparition");
    expect(only(fall.events, "reapparition")[0]!.checkpoint).toBe(false);
  });

  it("réapparition sur un point de passage", () => {
    const { events } = play(parseLevel(`S..C..^...F\n###########`), [[R, 200]]);
    const back = only(events, "reapparition");
    expect(back.length).toBeGreaterThan(0);
    expect(back[0]!.checkpoint).toBe(true);
  });

  it("ressort : un « boing » au déclenchement, sans saut, puis un atterrissage", () => {
    const { events } = play(parseLevel(`${".".repeat(40)}\n`.repeat(7) + `S${".".repeat(38)}F\n####*${"#".repeat(35)}`), [[R, 400]]);
    const k = kinds(events);
    expect(k).toContain("ressort");
    expect(k).not.toContain("saut");
    expect(k.indexOf("atterrissage")).toBeGreaterThan(k.indexOf("ressort"));
    const spring = only(events, "ressort")[0]!;
    expect(spring.x).toBe(4.5);
    expect(spring.y).toBe(8);
  });

  it("bloc friable : craque au contact, tombe ensuite (une fois chacun)", () => {
    const { events } = play(parseLevel(`.........\n.........\nS.......F\n#xxx#####`), [
      [R, 14],
      [0, 60],
    ]);
    const craque = only(events, "friableCraque");
    const tombe = only(events, "friableTombe");
    expect(craque.length).toBeGreaterThan(0);
    expect(tombe.length).toBe(craque.length);
    expect(new Set(craque.map((e) => e.index)).size).toBe(craque.length);
    expect(events.findIndex((e) => e.kind === "friableTombe")).toBeGreaterThan(events.findIndex((e) => e.kind === "friableCraque"));
  });

  it("rien quand l'état ne change pas (monde qui attend, arrivée déjà faite)", () => {
    const s = initialAttempt(FLAT);
    expect(eventsBetween(s, s, FLAT, DEFAULT_JUMP_PARAMS)).toEqual([]);
    const waiting = stepAttempt(s, 0, FLAT, DEFAULT_JUMP_PARAMS);
    expect(eventsBetween(s, waiting, FLAT, DEFAULT_JUMP_PARAMS)).toEqual([]);
    const done = play(FLAT, [[R, 400]]).state;
    expect(eventsBetween(done, stepAttempt(done, R, FLAT, DEFAULT_JUMP_PARAMS), FLAT, DEFAULT_JUMP_PARAMS)).toEqual([]);
  });

  it("la solution de l'essai : tous les événements attendus, et la lecture ne touche à aucun état (états gelés)", () => {
    const replay = decodeReplay(ESSAI_SOLUTION_CODE);
    const inputs = fromRuns(replay.runs);
    let s = Object.freeze(replayStartState(ESSAI_LEVEL, replay.start));
    const seen = new Set<string>();
    for (const bits of inputs) {
      const next = Object.freeze(stepAttempt(s, bits, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS));
      Object.freeze(next.player);
      for (const e of eventsBetween(s, next, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS)) seen.add(e.kind);
      s = next;
    }
    expect(s.status).toBe(ATTEMPT_FINISHED);
    for (const k of ["saut", "sautMural", "atterrissage", "pas", "ressort", "friableCraque", "pointDePassage", "arrivee"]) expect(seen, k).toContain(k);
    expect(seen).not.toContain("mort");
  });

  it("recopie le pas et la source ; la liste des noms est complète", () => {
    const { events } = play(FLAT, [[R | J, 2]]);
    expect(events[0]).toMatchObject({ kind: "saut", tick: 0, source: "jeu" });
    expect(EVENT_KINDS).toHaveLength(31); // lot 24 : `stalactiteTremble`, `stalactiteCasse` ; lot 23 : `champignon` ; lot 8b : `derapage` ; lot 11 : `tapisDebut`, `tapisFin`, `glaceDebut`, `glaceFin`, `glaceFrein` ; lot 12 : `blocVacille`, `blocApparait`, `blocDisparait`, `bascule`, `metronome` ; lot 13 : `ventDebut`, `ventFin`, `rafale`
  });
});

describe("carnage : filtre et journal", () => {
  const death = (tick: number): GameEvent => ({ kind: "mort", cause: "pic", tick, source: "vie", x: 0, y: 0 });
  it("ne garde que les morts et les arrivées, au débit plafonné par fenêtre", () => {
    const f = new CarnageFilter();
    expect(f.admit({ kind: "saut", tick: 0, source: "vie", x: 0, y: 0 })).toBe(false);
    let kept = 0;
    for (let i = 0; i < 50; i++) if (f.admit(death(3))) kept++;
    expect(kept).toBe(CARNAGE_EVENTS_PER_WINDOW);
    expect(f.dropped).toBe(50 - CARNAGE_EVENTS_PER_WINDOW);
    expect(f.admit(death(3 + CARNAGE_WINDOW_TICKS))).toBe(true);
    expect(f.admit({ kind: "arrivee", tick: 3 + CARNAGE_WINDOW_TICKS, source: "vie", x: 0, y: 0 })).toBe(true);
  });
  it("le journal garde les derniers", () => {
    const log = new EventLog(3);
    for (let i = 0; i < 5; i++) log.push(death(i));
    expect(log.list().map((e) => e.tick)).toEqual([2, 3, 4]);
    expect(log.total).toBe(5);
    log.clear();
    expect(log.list()).toEqual([]);
  });
});

describe("son : logique pure", () => {
  const ev = (e: Partial<GameEvent> & Pick<GameEvent, "kind">): GameEvent => ({ tick: 0, source: "jeu", x: 0, y: 0, ...e }) as GameEvent;

  it("chaque événement a son son (la glisse est une boucle, pas un son ponctuel)", () => {
    const cases: GameEvent[] = [
      ev({ kind: "pas", speed: 11, cadence: 7, full: true }),
      ev({ kind: "saut" }),
      ev({ kind: "sautMural", side: 1 }),
      ev({ kind: "atterrissage", intensity: 0.5 }),
      ev({ kind: "mort", cause: "pic" }),
      ev({ kind: "reapparition", checkpoint: false }),
      ev({ kind: "ressort" }),
      ev({ kind: "friableCraque", index: 0 }),
      ev({ kind: "friableTombe", index: 0 }),
      ev({ kind: "pointDePassage", index: 0 }),
      ev({ kind: "arrivee" }),
      ev({ kind: "medaille", medal: "gold" }),
    ];
    for (const e of cases) {
      const s = soundFor(e);
      expect(s, e.kind).not.toBeNull();
      expect(s!.id).toBe(e.kind);
      expect(s!.layers.length).toBeGreaterThan(0);
      expect(s!.duration).toBeGreaterThan(0);
      expect(s!.duration).toBeLessThan(1.6);
      for (const l of s!.layers) expect(l.gain).toBeLessThanOrEqual(0.4);
    }
    expect(soundFor(ev({ kind: "glisseDebut", side: 1 }))).toBeNull();
    expect(soundFor(ev({ kind: "glisseFin" }))).toBeNull();
  });

  it("saut et saut mural ont deux timbres ; les morts ont la couleur de leur cause", () => {
    const a = soundFor(ev({ kind: "saut" }))!;
    const b = soundFor(ev({ kind: "sautMural", side: -1 }))!;
    expect(a.layers.map((l) => l.wave ?? l.type)).not.toEqual(b.layers.map((l) => l.wave ?? l.type));
    const pic = soundFor(ev({ kind: "mort", cause: "pic" }))!;
    const scie = soundFor(ev({ kind: "mort", cause: "scie" }))!;
    const chute = soundFor(ev({ kind: "mort", cause: "chute" }))!;
    expect(new Set([pic, scie, chute].map((s) => JSON.stringify(s.layers))).size).toBe(3);
  });

  it("le volume de l'atterrissage suit son intensité ; un frôlement ne fait pas de bruit", () => {
    const peak = (i: number) => Math.max(...soundFor(ev({ kind: "atterrissage", intensity: i }))!.layers.map((l) => l.gain));
    expect(peak(1)).toBeGreaterThan(peak(0.5));
    expect(peak(0.5)).toBeGreaterThan(peak(0.1));
    expect(soundFor(ev({ kind: "atterrissage", intensity: 0.02 }))).toBeNull();
  });

  it("une phrase par médaille, la plus belle est la plus longue et la plus haute", () => {
    const order = ["bronze", "silver", "gold", "author"] as const;
    const lengths = order.map((m) => MEDAL_PHRASES[m].length);
    expect(lengths).toEqual([...lengths].sort((x, y) => x - y));
    expect(new Set(lengths).size).toBe(4);
    const tops = order.map((m) => Math.max(...MEDAL_PHRASES[m].map((n) => n.note)));
    expect(tops).toEqual([...tops].sort((x, y) => x - y));
    const durs = order.map((m) => soundFor(ev({ kind: "medaille", medal: m }))!.duration);
    expect(durs).toEqual([...durs].sort((x, y) => x - y));
  });

  it("scies : atténuées par la distance jusqu'à 8 tuiles, stéréo selon la position, les 3 plus proches seulement", () => {
    const me = { x: 10, y: 10 };
    const mix = sawMix(
      [
        { x: 10, y: 10 },
        { x: 14, y: 10 },
        { x: 6, y: 10 },
        { x: 10, y: 17 },
        { x: 20, y: 10 },
        { x: 11, y: 11 },
      ],
      me,
    );
    expect(mix).toHaveLength(3);
    expect(mix.map((v) => v.index)).toEqual([0, 5, 1]);
    expect(mix[0]!.gain).toBeCloseTo(SAW_GAIN, 9);
    expect(mix[0]!.pan).toBe(0);
    expect(mix[2]!.pan).toBeCloseTo(4 / SAW_RANGE, 9);
    expect(mix[2]!.gain).toBeLessThan(mix[1]!.gain);
    expect(sawMix([{ x: 10 + SAW_RANGE, y: 10 }], me)).toEqual([]);
    expect(sawMix([{ x: 10 - 7.9, y: 10 }], me)[0]!.pan).toBeLessThan(-0.95);
  });

  it("polyphonie plafonnée ; un son essentiel passe toujours ; les voix se libèrent à la fin du son", () => {
    const lim = new VoiceLimiter();
    for (let i = 0; i < MAX_VOICES; i++) expect(lim.admit(0, 0.5, 0)).toBe(true);
    expect(lim.admit(0.1, 0.5, 1)).toBe(false);
    expect(lim.refused).toBe(1);
    expect(lim.admit(0.1, 0.5, 3)).toBe(true);
    expect(lim.admit(0.6, 0.5, 0)).toBe(true);
    expect(lim.active(0.6)).toBe(1);
  });

  it("carnage : quelques sons de mort par tranche de 100 ms, atténués", () => {
    const rate = new SoundRate();
    let kept = 0;
    for (let t = 0; t < 12; t++) for (let k = 0; k < 10; k++) if (rate.admit(t)) kept++;
    expect(kept).toBe(CARNAGE_SOUNDS_PER_100MS);
    expect(rate.admit(12)).toBe(true);
    expect(soundGainFor(ev({ kind: "mort", cause: "pic", source: "vie" }))).toBeLessThan(0.5);
    expect(soundGainFor(ev({ kind: "mort", cause: "pic", source: "jeu" }))).toBe(1);
  });

  it("curseurs : un gain au carré, borné", () => {
    expect(sliderGain(1)).toBe(1);
    expect(sliderGain(0.5)).toBe(0.25);
    expect(sliderGain(-1)).toBe(0);
    expect(sliderGain(2)).toBe(1);
    expect(sliderGain(Number.NaN)).toBe(0);
  });
});

/** Un stockage en mémoire, qui peut lever. */
function memoryStore(fail: "get" | "set" | null = null): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => {
      if (fail === "get") throw new Error("stockage indisponible");
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (fail === "set") throw new Error("quota");
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe("réglages du joueur", () => {
  it("défauts : tout actif, mouvement réduit selon le système", () => {
    // Lot I5 : `sound` (« Son : oui / non » de la pause), oui par défaut.
    expect(defaultSettings()).toEqual({ volume: 0.8, sfx: 1, ambience: 0.7, vibration: true, shake: "normal", effects: "normal", reducedMotion: false, firstGhost: true, othersStains: true, sound: true });
    expect(defaultSettings(true).reducedMotion).toBe(true);
    // Lot 14 : le système demande un mouvement réduit → secousses Réduites par défaut.
    expect(defaultSettings(true).shake).toBe("reduit");
    expect(loadSettings(memoryStore(), true).reducedMotion).toBe(true);
  });

  it("mémoire : ce qui est écrit est relu ; un choix explicite l'emporte sur le système", () => {
    const store = memoryStore();
    const s = { ...defaultSettings(), volume: 0.35, effects: "reduit" as const, vibration: false, reducedMotion: false };
    expect(saveSettings(store, s)).toBe(true);
    expect(store.data.has(SETTINGS_KEY)).toBe(true);
    expect(SETTINGS_KEY).toBe("jump:settings");
    expect(loadSettings(store, true)).toEqual(s);
  });

  it("stockage absent ou qui lève : les défauts, et rien ne casse", () => {
    expect(loadSettings(null)).toEqual(defaultSettings());
    expect(loadSettings(memoryStore("get"))).toEqual(defaultSettings());
    expect(saveSettings(memoryStore("set"), defaultSettings())).toBe(false);
    expect(saveSettings(null, defaultSettings())).toBe(false);
  });

  it("enregistrement abîmé : champ par champ, les défauts", () => {
    expect(parseSettings("pas du json")).toEqual(defaultSettings());
    expect(parseSettings(JSON.stringify({ v: 999, volume: 0.1 }))).toEqual(defaultSettings());
    const s = parseSettings(JSON.stringify({ v: 1, volume: 7, sfx: "fort", effects: "énorme", shake: false }));
    expect(s.volume).toBe(1);
    expect(s.sfx).toBe(1);
    expect(s.effects).toBe("normal");
    expect(s.shake).toBe("aucun"); // avant le lot 14 : non
    expect(parseSettings(JSON.stringify({ v: 1, shake: true })).shake).toBe("normal");
    expect(parseSettings(JSON.stringify({ v: 1, shake: "réduites" }), true).shake).toBe("reduit");
    expect(parseSettings(JSON.stringify({ v: 1, shake: "reduit" })).shake).toBe("reduit");
  });

  it("niveaux d'effets : ?fx=off et le mouvement réduit coupent particules et secousses ; les réglages ne concernent jamais la simulation", () => {
    const d = defaultSettings();
    expect(feelLevels(d)).toMatchObject({ particles: 1, continuous: true, shake: 1, squash: 1, animate: true, vibration: true });
    expect(feelLevels(d, false)).toMatchObject({ particles: 0, continuous: false, shake: 0, animate: false });
    expect(feelLevels({ ...d, reducedMotion: true })).toMatchObject({ particles: 0, continuous: false, shake: 0, animate: false });
    expect(feelLevels({ ...d, reducedMotion: true }).squash).toBeLessThan(0.5);
    expect(feelLevels({ ...d, effects: "reduit" })).toMatchObject({ particles: 0.5, continuous: false, shake: 0.5 });
    expect(feelLevels({ ...d, shake: "aucun" }).shake).toBe(0);
    expect(feelLevels({ ...d, shake: "reduit" }).shake).toBe(0.5);
    expect(feelLevels({ ...d, vibration: false }).vibration).toBe(false);
  });
});

describe("effets : particules, secousse, vibrations, traînée, clignement", () => {
  const colors = feelColors(PALETTES[0]!);
  const ev = (e: Partial<GameEvent> & Pick<GameEvent, "kind">): GameEvent => ({ tick: 0, source: "jeu", x: 5, y: 5, ...e }) as GameEvent;

  it("poussière d'atterrissage selon l'intensité ; vibration aux grosses chutes seulement, jamais de secousse", () => {
    const levels = feelLevels(defaultSettings());
    const count = (i: number) => {
      const p = new Particles();
      const out = feelEvent(ev({ kind: "atterrissage", intensity: i }), p, colors, levels);
      return { n: p.emitted, out };
    };
    const soft = count(0.3);
    const hard = count(1);
    expect(hard.n).toBeGreaterThan(soft.n);
    expect(soft.out.shake).toBe(0);
    expect(soft.out.vibrate).toBeNull();
    expect(hard.out.shake).toBe(0); // lot 14 : plus de secousse à l'atterrissage, même une grosse chute
    expect(hard.out.vibrate).not.toBeNull();
  });

  it("confettis à l'arrivée, débris des friables, éclat du ressort ; rien pour les autres vies du carnage", () => {
    const levels = feelLevels(defaultSettings());
    for (const kind of ["arrivee", "friableTombe", "ressort", "saut", "sautMural"] as const) {
      const p = new Particles();
      feelEvent(ev({ kind, side: 1 } as Partial<GameEvent> & Pick<GameEvent, "kind">), p, colors, levels);
      expect(p.emitted, kind).toBeGreaterThan(0);
      const q = new Particles();
      feelEvent(ev({ kind, side: 1, source: "vie" } as Partial<GameEvent> & Pick<GameEvent, "kind">), q, colors, levels);
      expect(q.emitted, kind).toBe(0);
    }
  });

  it("lot 14 : aucune secousse pour une action ordinaire ; une secousse courte et légère à la mort ; Aucune : zéro", () => {
    const run = (levels: ReturnType<typeof feelLevels>, kind: GameEvent["kind"], extra: Partial<GameEvent> = {}) => feelEvent(ev({ kind, intensity: 1, cause: "pic", side: 1, ...extra } as Partial<GameEvent> & Pick<GameEvent, "kind">), new Particles(), colors, levels);
    const normal = feelLevels(defaultSettings());
    for (const kind of ["saut", "sautMural", "atterrissage", "ressort", "tapisDebut", "glaceFrein", "derapage", "ventDebut", "rafale", "friableTombe", "bascule"] as const) {
      expect(run(normal, kind).shake, kind).toBe(0);
    }
    const death = run(normal, "mort");
    expect(death.shake).toBeGreaterThan(0);
    expect(death.shake).toBeLessThanOrEqual(0.15);
    expect(death.shakeDuration).toBeGreaterThan(0);
    expect(death.shakeDuration).toBeLessThan(0.15);
    expect(run(feelLevels({ ...defaultSettings(), shake: "reduit" }), "mort").shake).toBeCloseTo(death.shake / 2);
    expect(run(feelLevels({ ...defaultSettings(), shake: "aucun" }), "mort").shake).toBe(0);
    expect(run(normal, "mort", { source: "vie" }).shake).toBe(0); // les morts des autres vies (carnage) ne secouent jamais
  });

  it("effets coupés : aucune particule, aucune secousse (mouvement réduit, ?fx=off)", () => {
    for (const levels of [feelLevels({ ...defaultSettings(), reducedMotion: true }), feelLevels(defaultSettings(), false)]) {
      const p = new Particles();
      p.amount = levels.particles;
      let shake = 0;
      for (const kind of ["arrivee", "mort", "atterrissage", "friableTombe", "ressort"] as const) shake += feelEvent(ev({ kind, intensity: 1, cause: "pic" } as Partial<GameEvent> & Pick<GameEvent, "kind">), p, colors, levels).shake;
      expect(p.emitted).toBe(0);
      expect(shake).toBe(0);
    }
  });

  it("pool plafonné et recyclé", () => {
    const p = new Particles(32);
    const levels = feelLevels(defaultSettings());
    for (let i = 0; i < 10; i++) feelEvent(ev({ kind: "arrivee" }), p, colors, levels);
    expect(p.items).toHaveLength(32);
    expect(p.alive).toBeLessThanOrEqual(32);
    p.update(5);
    expect(p.alive).toBe(0);
  });

  it("vibrations : mort, grosse chute, arrivée ; seulement la partie du joueur ; jamais deux à moins de 120 ms", () => {
    expect(vibrationFor(ev({ kind: "mort", cause: "scie" }))).toBe(35);
    expect(vibrationFor(ev({ kind: "arrivee" }))).toEqual([25, 50, 40]);
    expect(vibrationFor(ev({ kind: "atterrissage", intensity: 0.5 }))).toBeNull();
    expect(vibrationFor(ev({ kind: "mort", cause: "scie", source: "vie" }))).toBeNull();
    expect(feelEvent(ev({ kind: "mort", cause: "pic" }), new Particles(), colors, feelLevels({ ...defaultSettings(), vibration: false })).vibrate).toBeNull();
    const calls: (number | number[])[] = [];
    const v = new Vibrator((p) => (calls.push(p), true));
    expect(v.play(35, 0)).toBe(true);
    expect(v.play(35, VIBRATE_GAP_MS - 1)).toBe(false);
    expect(v.play(35, VIBRATE_GAP_MS)).toBe(true);
    expect(calls).toHaveLength(2);
    expect(new Vibrator(null).play(35, 0)).toBe(false);
    expect(new Vibrator(() => { throw new Error("refusé"); }).play(35, 0)).toBe(false);
  });

  it("traînée : apparaît à pleine vitesse, s'efface à l'arrêt ; clignement de temps en temps", () => {
    const t = new Trail();
    for (let i = 0; i < 30; i++) t.update(1 / 60, i * 0.2, 0, true);
    expect(t.points.length).toBe(5);
    expect(t.points[0]!.alpha).toBeGreaterThan(t.points[4]!.alpha);
    for (let i = 0; i < 30; i++) t.update(1 / 60, 6, 0, false);
    expect(t.points.every((p) => p.alpha === 0)).toBe(true);
    const b = new Blink();
    let closedFrames = 0;
    for (let i = 0; i < 60 * 12; i++) if (b.update(1 / 60) > 0.5) closedFrames++;
    expect(closedFrames).toBeGreaterThan(2);
    expect(closedFrames).toBeLessThan(60);
  });
});
