import { parseDay } from "@cdj/core";
import {
  ATTEMPT_RUNNING,
  DEATH_STALACTITE,
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  MODULES,
  MODULE_TAGS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  STALACTITE_BROKEN,
  STALACTITE_SHAKE_TICKS,
  UNITS_PER_TILE,
  dailyLevel,
  jumpThemeForDay,
  initialAttempt,
  parseLevel,
  stalactiteOffset,
  stepAttempt,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { soundFor } from "../src/audioLogic";
import { contrastRatio, hueDistance } from "../src/contrast";
import { EVENT_KINDS, causeName, eventsBetween, type GameEvent } from "../src/events";
import { Particles, feelColors, feelEvent, vibrationFor } from "../src/feel";
import { FLICKER_MAX_HZ } from "../src/announce";
import { TAG_LABELS } from "../src/modulesInfo";
import { MODULE_INDEX } from "../src/moduleIndex";
import { PALETTES } from "../src/palette";
import { semaineDayOf } from "../src/semaineInfo";
import { feelLevels, defaultSettings } from "../src/settings";
import { createStalactiteArt } from "../src/stalactiteArt";
import {
  BODY,
  DRIP_COUNT,
  DRIP_SECONDS,
  DRIP_TICKS,
  STALACTITE_LOOK,
  TIP_FROM,
  TREMBLE,
  TREMBLE_HZ,
  buildStalactiteArt,
  stalactiteDrips,
  stalactiteLook,
  stalactiteSway,
} from "../src/stalactite";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";

// Lot 24 — les stalactites vues par le jeu : un pic de glace à la pointe rouge, qui tremble et laisse tomber de fines gouttes de glace pendant tout le tremblement (signe continu,
// jamais un clignotement), tombe, se brise en éclats de glace sans aucune secousse de caméra, et reste intact et estompé dans le carnage.

const T = UNITS_PER_TILE;
const rows = (): string[] => {
  const r: string[] = [];
  for (let i = 0; i < 14; i++) r.push("#" + ".".repeat(24) + "#");
  r[0] = "#".repeat(26);
  r[12] = r[13] = "#".repeat(26);
  r[11] = "#S" + ".".repeat(22) + "F#";
  return r;
};
const level: Level = parseLevel(rows().join("\n") + "\n\nversion 8\nsection a 1-24\nstalactite s 12,1 3 2\n");
const S = level.stalactites[0]!;
const running = (age: number): AttemptState => ({ ...initialAttempt(level), status: ATTEMPT_RUNNING, time: 1000, stalactites: [age] });
const meshes = (g: Group) => g.children.filter((c): c is Mesh => (c as Mesh).isMesh);
const step = (s: AttemptState, bits: number) => stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);

describe("l'annonce (stalactiteLook, pur) : le tremblement dure 60 pas, croît sans à-coup", () => {
  it("rien à l'état intact, un tremblement qui croît strictement pendant 60 pas, puis la chute sans tremblement ; brisée, invisible", () => {
    expect(stalactiteLook(0)).toEqual({ visible: true, shake: 0, drop: 0 });
    for (let age = 1; age <= STALACTITE_SHAKE_TICKS; age++) {
      const l = stalactiteLook(age);
      expect(l.drop, `âge ${age}`).toBe(0);
      expect(l.shake, `âge ${age}`).toBeGreaterThan(stalactiteLook(age - 1).shake);
    }
    expect(stalactiteLook(STALACTITE_SHAKE_TICKS).shake).toBe(1);
    for (let age = STALACTITE_SHAKE_TICKS + 1; age < STALACTITE_SHAKE_TICKS + 80; age++) {
      const l = stalactiteLook(age);
      expect(l.shake, `âge ${age}`).toBe(0);
      expect(l.drop, `âge ${age}`).toBe(stalactiteOffset(age) / T);
    }
    expect(stalactiteLook(STALACTITE_BROKEN)).toEqual({ visible: false, shake: 0, drop: 0 });
  });

  it("le balancement est un sinus lent (sous 3 Hz), d'amplitude au plus TREMBLE, nul au repos", () => {
    expect(TREMBLE_HZ).toBeLessThan(FLICKER_MAX_HZ);
    expect(stalactiteSway(0, 0.123)).toBe(0);
    const amp = Math.max(...Array.from({ length: 400 }, (_, k) => Math.abs(stalactiteSway(1, k / 100))));
    expect(amp).toBeLessThanOrEqual(TREMBLE + 1e-9);
    expect(amp).toBeGreaterThan(TREMBLE * 0.95);
    const half = Math.max(...Array.from({ length: 400 }, (_, k) => Math.abs(stalactiteSway(0.5, k / 100))));
    expect(half).toBeLessThan(amp);
  });

  it("de fines gouttes de glace pendant toute la durée du tremblement, et seulement alors", () => {
    expect(stalactiteDrips(0)).toEqual([]);
    expect(stalactiteDrips(STALACTITE_BROKEN)).toEqual([]);
    for (let age = 1; age <= STALACTITE_SHAKE_TICKS; age++) expect(stalactiteDrips(age), `âge ${age}`).toHaveLength(DRIP_COUNT);
    for (let age = STALACTITE_SHAKE_TICKS + 1; age < STALACTITE_SHAKE_TICKS + 100; age++) expect(stalactiteDrips(age), `âge ${age}`).toEqual([]);
    // Il y a toujours des gouttes visibles pendant le tremblement (un signe continu).
    for (let age = 1; age <= STALACTITE_SHAKE_TICKS; age++) expect(Math.max(...stalactiteDrips(age).map((d) => d.opacity)), `âge ${age}`).toBeGreaterThan(0.2);
  });

  it("jamais de clignotement : chaque goutte monte et descend en douceur (pas de saut d'opacité), reprend au plus 2,5 fois par seconde", () => {
    expect(DRIP_SECONDS).toBe(DRIP_TICKS / 120);
    expect(1 / DRIP_SECONDS).toBeLessThanOrEqual(FLICKER_MAX_HZ);
    const maxStep = Math.PI / DRIP_TICKS + 1e-9; // dérivée maximale de sin(π × part) par pas
    for (let age = 2; age <= STALACTITE_SHAKE_TICKS; age++) {
      const a = stalactiteDrips(age - 1);
      const b = stalactiteDrips(age);
      for (let k = 0; k < DRIP_COUNT; k++) {
        const d = Math.abs(b[k]!.opacity - a[k]!.opacity);
        // Au passage d'un cycle à l'autre l'opacité est 0 des deux côtés : aucun saut.
        expect(d, `âge ${age}, goutte ${k}`).toBeLessThanOrEqual(maxStep);
        expect(b[k]!.dy, `âge ${age}, goutte ${k}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("l'aspect : un danger de glace à la pointe rouge", () => {
  const art = buildStalactiteArt(HAZARD);
  // Les sommets sont rangés avec leur couleur linéaire : on retrouve ceux de la pointe par leur couleur.
  const lin = (c: number) => {
    const f = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return [f((c >> 16) & 255), f((c >> 8) & 255), f(c & 255)];
  };
  const isColor = (i: number, c: number) => lin(c).every((v, k) => Math.abs(art.col[i * 3 + k]! - v) < 1e-6);

  it("la pointe porte le rouge des dangers, et seulement elle : ses sommets sont dans le dernier quart du corps", () => {
    const red = [...Array(art.vertexCount).keys()].filter((i) => isColor(i, HAZARD));
    expect(red).toHaveLength(3);
    for (const i of red) {
      const y = art.pos[i * 3 + 1]!;
      expect(y).toBeLessThanOrEqual(-TIP_FROM + 1e-9);
      expect(y).toBeGreaterThanOrEqual(-BODY - 1e-9);
    }
    // Aucun autre sommet n'est rouge ni jaune : la glace est bleu pâle, le cerne bleu nuit.
    for (const c of [STALACTITE_LOOK.light, STALACTITE_LOOK.shade, STALACTITE_LOOK.outline, STALACTITE_LOOK.frost, STALACTITE_LOOK.drip]) {
      expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThan(60);
      expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThan(60);
    }
  });

  it("le dessin couvre sa boîte mortelle : il n'est jamais plus étroit que ±0,25 tuile avant la pointe, et la pointe va au bout du corps", () => {
    const xs = (y0: number, y1: number) => {
      const out: number[] = [];
      for (let i = 0; i < art.vertexCount; i++) {
        const y = art.pos[i * 3 + 1]!;
        if (y <= y0 && y >= y1) out.push(art.pos[i * 3]!);
      }
      return out;
    };
    // Les sommets à la fin du profil (juste avant la pointe) sont au moins à ±0,25 de l'axe.
    const near = xs(-TIP_FROM + 1e-9, -TIP_FROM - 1e-9);
    expect(Math.min(...near)).toBeLessThanOrEqual(-0.25);
    expect(Math.max(...near)).toBeGreaterThanOrEqual(0.25);
    expect(Math.min(...art.pos.filter((_, i) => i % 3 === 1))).toBeCloseTo(-BODY, 9);
  });

  it("lisible sur le ciel et chaque plan de chaque thème : 3:1 au moins avec la glace ou son cerne (la pointe rouge porte le danger)", () => {
    for (const name of THEME_NAMES) {
      for (const b of backdropColors(THEMES[name])) {
        const best = Math.max(contrastRatio(STALACTITE_LOOK.light, b), contrastRatio(STALACTITE_LOOK.outline, b));
        expect(best, `${name} ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("les pièces ne se recouvrent pas (l'estompage du carnage ne s'additionne pas) : aucun couple de triangles n'a d'intérieur commun", () => {
    const tris: [number, number][][] = [];
    for (let t = 0; t < art.idx.length; t += 3) tris.push([0, 1, 2].map((k) => [art.pos[art.idx[t + k]! * 3]!, art.pos[art.idx[t + k]! * 3 + 1]!] as [number, number]));
    // Théorème de l'axe séparateur : deux triangles ont un intérieur commun si aucun des six axes de leurs côtés ne les sépare (se toucher par un bord ne compte pas).
    const separated = (a: [number, number][], b: [number, number][]): boolean => {
      for (const tri of [a, b]) {
        for (let i = 0; i < 3; i++) {
          const p = tri[i]!;
          const q = tri[(i + 1) % 3]!;
          const ax = -(q[1] - p[1]);
          const ay = q[0] - p[0];
          const proj = (t: [number, number][]) => t.map((v) => v[0] * ax + v[1] * ay);
          const pa = proj(a);
          const pb = proj(b);
          if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return true;
        }
      }
      return false;
    };
    for (let i = 0; i < tris.length; i++) for (let j = i + 1; j < tris.length; j++) expect(separated(tris[i]!, tris[j]!), `triangles ${i} et ${j}`).toBe(true);
  });
});

describe("le dessin (stalactiteArt) : posé où la simulation la met", () => {
  it("un niveau sans stalactite n'en dessine pas", () => {
    expect(createStalactiteArt(new Group(), parseLevel(rows().join("\n") + "\n"), { hazard: HAZARD })).toBeNull();
  });

  it("intacte : accrochée à sa tuile, immobile, sans gouttes", () => {
    const art = createStalactiteArt(new Group(), level, { hazard: HAZARD })!;
    art.update(running(0), running(0), 1, 1, 0.123);
    expect(art.stats).toMatchObject({ age: [0], y: [S.row], sway: [0], shake: [0], drips: [0], visible: [true], opacity: 1 });
  });

  it("pendant le tremblement : elle ne descend pas, se balance de plus en plus, laisse tomber ses gouttes", () => {
    const world = new Group();
    const art = createStalactiteArt(world, level, { hazard: HAZARD })!;
    art.update(running(29), running(30), 1, 1, 0);
    expect(art.stats.y[0]).toBe(S.row);
    expect(art.stats.shake[0]).toBe(0.5);
    expect(art.stats.drips[0]).toBe(DRIP_COUNT);
    const amplitude = (age: number) => Math.max(...Array.from({ length: 200 }, (_, k) => (art.update(running(age), running(age), 1, 1, k / 100), Math.abs(art.stats.sway[0]!))));
    expect(amplitude(15)).toBeLessThan(amplitude(60));
    expect(amplitude(60)).toBeLessThanOrEqual(TREMBLE + 1e-9);
    // Les gouttes sont visibles dans le monde, sous la pointe ; elles disparaissent avec le tremblement.
    art.update(running(40), running(40), 1, 1, 0);
    const visibleDrips = world.children.filter((c) => (c as Mesh).isMesh && c.visible).length;
    expect(visibleDrips).toBeGreaterThan(0);
    art.update(running(80), running(81), 1, 1, 0);
    expect(world.children.filter((c) => (c as Mesh).isMesh && c.visible)).toHaveLength(0);
  });

  it("pendant la chute : sa hauteur est celle de la simulation, interpolée entre deux pas ; brisée, elle n'est plus dessinée", () => {
    const art = createStalactiteArt(new Group(), level, { hazard: HAZARD })!;
    const a = 80;
    art.update(running(a), running(a + 1), 0, 1, 0);
    expect(art.stats.y[0]).toBeCloseTo(S.row + stalactiteOffset(a) / T, 9);
    expect(art.stats.shake[0]).toBe(0);
    art.update(running(a), running(a + 1), 0.5, 1, 0);
    expect(art.stats.y[0]).toBeCloseTo(S.row + (stalactiteOffset(a) + stalactiteOffset(a + 1)) / 2 / T, 9);
    art.update(running(a), running(a + 1), 1, 1, 0);
    expect(art.stats.y[0]).toBeCloseTo(S.row + stalactiteOffset(a + 1) / T, 9);
    art.update(running(a), running(STALACTITE_BROKEN), 1, 1, 0);
    expect(art.stats.visible[0]).toBe(false);
    art.update(running(STALACTITE_BROKEN), running(STALACTITE_BROKEN), 1, 1, 0);
    expect(art.stats.visible[0]).toBe(false);
    // Elle revient intacte à la reprise.
    art.update(running(STALACTITE_BROKEN), running(0), 1, 1, 0);
    expect(art.stats).toMatchObject({ visible: [true], y: [S.row], age: [0] });
  });

  it("carnage : toujours intacte, à 35 % d'opacité, quelle que soit la vie ; hors carnage opaque et sans mélange", () => {
    const world = new Group();
    const art = createStalactiteArt(world, level, { hazard: HAZARD })!;
    const material = () => (meshes(world.children.find((c) => c instanceof Group) as Group)[0]!.material as MeshBasicMaterial);
    art.update(running(90), running(91), 1, 1, 0);
    expect(material().transparent).toBe(false);
    expect(material().opacity).toBe(1);
    art.update(running(90), running(91), 1, 0.35, 0);
    expect(art.stats).toMatchObject({ age: [0], y: [S.row], visible: [true], shake: [0], drips: [0], opacity: 0.35 });
    expect(material().transparent).toBe(true);
    expect(material().opacity).toBe(0.35);
    // Une vie dont la stalactite est brisée la montre quand même intacte.
    art.update(running(STALACTITE_BROKEN), running(STALACTITE_BROKEN), 1, 0.35, 0);
    expect(art.stats.visible[0]).toBe(true);
    art.update(running(0), running(0), 1, 1, 0);
    expect(material().transparent).toBe(false);
  });
});

describe("événements, particules, son", () => {
  const stand = (): AttemptState => {
    const s = initialAttempt(level);
    return { ...s, status: ATTEMPT_RUNNING, time: 1000, player: { ...s.player, x: 8 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, ground: 1, air: 0, vx: 375 } };
  };

  it("la liste des événements les connaît ; le déclenchement donne un événement au pas exact, la casse un autre au sol", () => {
    expect(EVENT_KINDS).toEqual(expect.arrayContaining(["stalactiteTremble", "stalactiteCasse"]));
    let s = stand();
    const kinds: { tick: number; kind: string; x: number; y: number }[] = [];
    for (let t = 1; t <= 400 && s.status === ATTEMPT_RUNNING; t++) {
      const next = step(s, t < 60 ? INPUT_RIGHT : 0);
      for (const e of eventsBetween(s, next, level, DEFAULT_JUMP_PARAMS, t)) if (e.kind === "stalactiteTremble" || e.kind === "stalactiteCasse") kinds.push({ tick: t, kind: e.kind, x: e.x, y: e.y });
      s = next;
    }
    const tremble = kinds.filter((k) => k.kind === "stalactiteTremble");
    const casse = kinds.filter((k) => k.kind === "stalactiteCasse");
    expect(tremble).toHaveLength(1);
    expect(casse).toHaveLength(1);
    expect(tremble[0]!.x).toBe(S.col + 0.5);
    expect(casse[0]!.x).toBe(S.col + 0.5);
    expect(casse[0]!.y).toBe(12); // la rangée du sol où elle se brise
    // Le tremblement a lieu au pas où l'état passe de 0 à 1 ; la casse STALACTITE_SHAKE_TICKS + la chute plus tard.
    expect(casse[0]!.tick - tremble[0]!.tick).toBeGreaterThan(STALACTITE_SHAKE_TICKS);
  });

  it("une mort sous une stalactite a sa cause « stalactite » (événement `mort`, son à part), avec la secousse de la mort et rien d'autre", () => {
    expect(causeName(DEATH_STALACTITE)).toBe("stalactite");
    let s = initialAttempt(level);
    s = { ...s, status: ATTEMPT_RUNNING, time: 1000, player: { ...s.player, x: 12 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, ground: 1, air: 0 } };
    let cause = "";
    for (let t = 1; t <= 300 && !cause; t++) {
      const next = step(s, 0);
      const mort = eventsBetween(s, next, level, DEFAULT_JUMP_PARAMS, t).find((e) => e.kind === "mort");
      if (mort && mort.kind === "mort") cause = mort.cause;
      s = next;
    }
    expect(cause).toBe("stalactite");
    const splat = soundFor({ kind: "mort", cause: "stalactite", tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent)!;
    const plain = soundFor({ kind: "mort", cause: "pic", tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent)!;
    expect(splat.id).toBe("mort");
    expect(splat.layers.length).toBeGreaterThan(plain.layers.length - 1);
  });

  it("un niveau sans stalactite n'émet aucun de ces événements", () => {
    const plain = parseLevel(rows().join("\n") + "\n");
    let s = initialAttempt(plain);
    for (let t = 0; t < 300; t++) {
      const next = stepAttempt(s, INPUT_RIGHT, plain, DEFAULT_JUMP_PARAMS);
      expect(eventsBetween(s, next, plain, DEFAULT_JUMP_PARAMS).filter((e) => e.kind === "stalactiteTremble" || e.kind === "stalactiteCasse")).toHaveLength(0);
      s = next;
    }
  });

  it("des éclats de glace à la casse ; aucune secousse de caméra, aucune vibration ; le tremblement n'a pas de particules (les gouttes sont dessinées en continu) ; des sons", () => {
    const colors = feelColors(PALETTES[0]!);
    const levels = feelLevels(defaultSettings());
    const run = (kind: "stalactiteTremble" | "stalactiteCasse") => {
      const pool = new Particles();
      const e = { kind, index: 0, tick: 0, source: "jeu", x: 12.5, y: 12 } as GameEvent;
      const out = feelEvent(e, pool, colors, levels);
      expect(out.shake, `${kind} : aucune secousse de caméra (règle du lot 14)`).toBe(0);
      expect(out.shakeDuration).toBe(0);
      expect(out.vibrate).toBeNull();
      expect(vibrationFor(e)).toBeNull();
      return pool.emitted;
    };
    expect(run("stalactiteCasse")).toBeGreaterThan(0);
    expect(run("stalactiteTremble")).toBe(0);
    // Les éclats partent du point d'impact (x = 12,5, au sol : y = −12 dans le monde affiché, y vers le haut) et montent d'abord.
    const shards = new Particles();
    feelEvent({ kind: "stalactiteCasse", index: 0, tick: 0, source: "jeu", x: 12.5, y: 12 } as GameEvent, shards, colors, levels);
    const live = shards.items.filter((p) => p.age < p.life);
    expect(live.length).toBeGreaterThanOrEqual(18);
    for (const p of live) {
      expect(Math.abs(p.x - 12.5)).toBeLessThan(0.5);
      expect(Math.abs(p.y + 12)).toBeLessThan(0.5);
    }
    expect(live.filter((p) => p.vy > 0).length).toBeGreaterThan(live.length * 0.8);
    expect(soundFor({ kind: "stalactiteTremble", index: 0, tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent)?.id).toBe("stalactiteTremble");
    expect(soundFor({ kind: "stalactiteCasse", index: 0, tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent)?.id).toBe("stalactiteCasse");
    // Les autres vies du carnage n'ont ni particules ni son ici.
    const pool = new Particles();
    feelEvent({ kind: "stalactiteCasse", index: 0, tick: 0, source: "vie", x: 1, y: 1 } as GameEvent, pool, colors, levels);
    expect(pool.emitted).toBe(0);
  });
});

describe("la galerie `?modules` et `?semaine`", () => {
  it("l'étiquette « stalactite » existe ; entre six et huit morceaux la portent, tous dans l'index léger", () => {
    expect(MODULE_TAGS).toContain("stalactite");
    expect(TAG_LABELS.stalactite).toBe("stalactite");
    const mine = MODULES.filter((m) => m.tags.includes("stalactite"));
    expect(mine.length).toBeGreaterThanOrEqual(6);
    expect(mine.length).toBeLessThanOrEqual(8);
    for (const m of mine) expect(MODULE_INDEX.find(([id]) => id === m.id)?.[1], m.id).toBe(m.variants.length);
  });

  it("la miniature de `?semaine` connaît les stalactites d'un jour de glace (tuile du corps et zone)", () => {
    // Lot V1 : le premier jour de glace à stalactites à partir du 08/12/2026 (le sac de thèmes a changé le thème de chaque date).
    let jour = parseDay("2026-12-08")!;
    while (jumpThemeForDay(jour) !== "glace" || dailyLevel(jour).level.stalactites.length < 2) jour++;
    const L = dailyLevel(jour);
    expect(L.theme).toBe("glace");
    expect(L.level.stalactites.length).toBeGreaterThanOrEqual(2);
    const d = semaineDayOf(L);
    expect(d.stalactites).toHaveLength(L.level.stalactites.length);
    L.level.stalactites.forEach((s, i) => expect(d.stalactites![i]).toEqual({ col: s.col, row: s.row, before: s.before, after: s.after }));
    // Un jour sans stalactite n'a pas le champ.
    expect(semaineDayOf(dailyLevel(parseDay("2026-10-27")!)).stalactites).toBeUndefined();
  });
});
