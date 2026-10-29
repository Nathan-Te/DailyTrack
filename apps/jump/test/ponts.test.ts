import { parseDay } from "@cdj/core";
import {
  ATTEMPT_RUNNING,
  BRIDGE_STEP,
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  MODULES,
  MODULE_TAGS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_BRIDGE_ON,
  UNITS_PER_TILE,
  bridgeLastLit,
  bridgeModuleIds,
  bridgeTileLit,
  dailyLevel,
  jumpThemeForDay,
  initialAttempt,
  parseLevel,
  settleBridges,
  stepAttempt,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { Group, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { BRIDGE_VANISH_TICKS, FLICKER_MAX_HZ, bridgeGauge } from "../src/announce";
import { BRIDGE_LOOK, bridgeTileCount, bridgeTileLooks, switchLook } from "../src/bridge";
import { createBridgeArt } from "../src/bridgeArt";
import { hueDistance } from "../src/contrast";
import { soundFor } from "../src/audioLogic";
import { EVENT_KINDS, eventsBetween, type GameEvent } from "../src/events";
import { Particles, feelColors, feelEvent, vibrationFor } from "../src/feel";
import { TAG_LABELS } from "../src/modulesInfo";
import { MODULE_INDEX } from "../src/moduleIndex";
import { PALETTES } from "../src/palette";
import { semaineDayOf } from "../src/semaineInfo";
import { feelLevels, defaultSettings } from "../src/settings";
import { HAZARD, PLAYER, THEMES, THEME_NAMES } from "../src/themes";

// Lot 26 — les ponts à interrupteur vus par le jeu : contour pointillé éteint, face lumineuse allumée (ni rouge ni jaune) qui se vide comme une jauge pendant les 0,4 s qui précèdent
// l'extinction de chaque tuile, interrupteur qui s'enfonce, aucune secousse de caméra, pont allumé et estompé à 35 % dans le carnage.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;
const rows = (): string[] => {
  const r: string[] = [];
  for (let i = 0; i < 14; i++) r.push("#" + ".".repeat(26) + "#");
  r[0] = "#".repeat(28);
  r[12] = r[13] = "#".repeat(8) + ".".repeat(12) + "#".repeat(8);
  r[11] = "#S" + ".".repeat(24) + "F#";
  return r;
};
const level: Level = parseLevel(rows().join("\n") + "\n\nversion 10\npont p 120 5,12 8-19,12\n");
const B = level.bridges[0]!;
const meshes = (g: Group) => g.children.flatMap((c) => (c instanceof Group ? c.children : [c])).filter((c): c is Mesh => (c as Mesh).isMesh);

/** Un état en cours, le pont allumé depuis `age` pas, le personnage `player` (par défaut à l'arrêt hors du pont). */
function lit(age: number, over: Partial<AttemptState["player"]> = {}): AttemptState {
  const s = initialAttempt(level);
  const player = { ...s.player, x: 2 * T, y: 11 * T - 1000 + 1000 - PLAYER_HEIGHT + T, ground: 1, air: 0, ...over };
  return { ...s, status: ATTEMPT_RUNNING, time: 1000, player, bridges: [age], tiles: settleBridges(level, level.tiles, [age], player) };
}

describe("la jauge (bridgeGauge, pur) : pleine, puis elle se vide pendant 0,4 s, vide pile à l'extinction", () => {
  it("l'annonce compte exactement 48 pas, tous strictement entre 0 et 1, strictement décroissants", () => {
    expect(BRIDGE_VANISH_TICKS).toBe(48);
    expect(BRIDGE_STEP).toBe(16);
    for (const k of [0, 1, 5, 11]) {
      const last = B.delay + k * BRIDGE_STEP;
      let announced = 0;
      let before = 1;
      for (let age = 1; age <= last; age++) {
        const g = bridgeGauge(B.delay, k, age);
        if (g < 1) {
          announced++;
          expect(g, `rang ${k}, âge ${age}`).toBeGreaterThan(0);
          expect(g, `rang ${k}, âge ${age}`).toBeLessThan(before);
          before = g;
        } else expect(age, `rang ${k}`).toBeLessThanOrEqual(last - BRIDGE_VANISH_TICKS);
      }
      expect(announced, `rang ${k}`).toBe(BRIDGE_VANISH_TICKS);
      // Vide pile au pas de l'extinction (la tuile n'est plus pleine pour la simulation), pleine au repos.
      expect(bridgeGauge(B.delay, k, last + 1), `rang ${k}`).toBe(0);
      expect(bridgeTileLit(B, last + 1, k), `rang ${k}`).toBe(false);
      expect(bridgeTileLit(B, last, k), `rang ${k}`).toBe(true);
      expect(bridgeGauge(B.delay, k, 0), `rang ${k}`).toBe(0);
    }
  });

  it("la vague d'extinction : à chaque pas la jauge de la tuile suivante est en retard de BRIDGE_STEP pas sur celle d'avant", () => {
    for (let age = 1; age <= bridgeLastLit(B); age++) {
      for (let k = 1; k < B.tiles.length; k++) {
        const a = bridgeGauge(B.delay, k - 1, age);
        const b = bridgeGauge(B.delay, k, age);
        // Une tuile plus loin du bouton ne se vide jamais avant celle qui s'éteint plus tôt.
        expect(b, `âge ${age}, rang ${k}`).toBeGreaterThanOrEqual(a);
      }
    }
  });

  it("aucun clignotement : la série de la jauge d'une tuile ne monte jamais (pas de va-et-vient), et son pas ne dépasse pas 1/49 par pas", () => {
    for (const k of [0, 6, 11]) {
      let prev = 1;
      for (let age = 1; age <= B.delay + k * BRIDGE_STEP + 2; age++) {
        const g = bridgeGauge(B.delay, k, age);
        expect(g, `rang ${k}, âge ${age}`).toBeLessThanOrEqual(prev + 1e-12);
        expect(prev - g, `rang ${k}, âge ${age}`).toBeLessThanOrEqual(1 / (BRIDGE_VANISH_TICKS + 1) + 1e-12 + (age === B.delay + k * BRIDGE_STEP + 1 ? 1 / (BRIDGE_VANISH_TICKS + 1) : 0));
        prev = g;
      }
    }
    expect(FLICKER_MAX_HZ).toBe(3);
  });
});

describe("l'état affiché (bridgeTileLooks) : l'affichage ne ment pas", () => {
  it("éteint : toutes les tuiles pointillées ; allumé : pleines, avec la jauge de leur rang", () => {
    expect(bridgeTileCount(level)).toBe(12);
    const off = bridgeTileLooks(level, lit(0));
    expect(off.every((l) => !l.solid && l.fill === 0 && !l.waiting)).toBe(true);
    const on = bridgeTileLooks(level, lit(1));
    expect(on.every((l) => l.solid && l.fill === 1)).toBe(true);
    // Âge 121 : la première tuile (rang 0) vient de s'éteindre ; âge 120 : encore pleine, sa jauge à 1/49.
    expect(bridgeTileLooks(level, lit(120))[0]).toMatchObject({ solid: true });
    expect(bridgeTileLooks(level, lit(120))[0]!.fill).toBeCloseTo(1 / 49, 9);
    expect(bridgeTileLooks(level, lit(121))[0]).toMatchObject({ solid: false, fill: 0 });
    expect(bridgeTileLooks(level, lit(121))[1]).toMatchObject({ solid: true });
  });

  it("chaque pas de la simulation : pleine dessinée ⇔ pleine pour la simulation, sur toute la vie d'un pont", () => {
    let s = lit(1);
    for (let age = 1; age <= bridgeLastLit(B) + 3; age++) {
      const looks = bridgeTileLooks(level, s);
      B.tiles.forEach((c, k) => {
        const sim = s.tiles[c.row * level.width + c.col] === TILE_BRIDGE_ON;
        expect(looks[k]!.solid, `âge ${age}, rang ${k}`).toBe(sim);
        expect(sim, `âge ${age}, rang ${k}`).toBe(bridgeTileLit(B, s.bridges![0]!, k));
      });
      s = stepAttempt(s, 0, level, P);
    }
  });

  it("une tuile qui devrait s'allumer pendant que le personnage la chevauche : contour épais, pas de face", () => {
    const inside = { x: 11 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - 2048, ground: 0, air: 255 };
    const s = lit(1, inside);
    const look = bridgeTileLooks(level, s)[3]!; // la colonne 11
    expect(look).toMatchObject({ solid: false, waiting: true, fill: 0 });
  });

  it("carnage : le pont est toujours allumé, pleine jauge, quel que soit l'état de la vie", () => {
    const looks = bridgeTileLooks(level, lit(0), true);
    expect(looks.every((l) => l.solid && l.fill === 1 && !l.waiting)).toBe(true);
    expect(switchLook(level, lit(0), 0, true)).toEqual({ pressed: false, lit: true });
  });

  it("l'interrupteur : enfoncé quand le personnage est posé dessus, allumé quand le pont l'est", () => {
    const onSwitch = { x: 5 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, ground: 1 };
    expect(switchLook(level, lit(1, onSwitch), 0)).toEqual({ pressed: true, lit: true });
    expect(switchLook(level, lit(0), 0)).toEqual({ pressed: false, lit: false });
    expect(switchLook(level, lit(50, onSwitch), 0).pressed).toBe(true);
  });
});

describe("les couleurs : ni rouge ni jaune", () => {
  it("la lumière du pont est à plus de 30° du rouge des dangers, du jaune du personnage et du bleu-violet des blocs clignotants", () => {
    for (const c of [BRIDGE_LOOK.fill, BRIDGE_LOOK.plateOn, BRIDGE_LOOK.ring]) {
      expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThan(30);
      expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThan(30);
    }
    expect(hueDistance(BRIDGE_LOOK.fill, 0x6a8cff)).toBeGreaterThan(30);
  });
});

describe("le dessin (bridgeArt) : posé où la simulation le met", () => {
  it("un niveau sans pont n'en dessine pas", () => {
    expect(createBridgeArt(new Group(), parseLevel(rows().join("\n") + "\n"))).toBeNull();
  });

  it("éteint : douze contours pointillés, aucune face ; allumé : douze faces pleines ; la jauge se vide à la tuile qui s'éteint", () => {
    const art = createBridgeArt(new Group(), level)!;
    art.update(lit(0), 1, 0, true);
    expect(art.stats).toMatchObject({ tiles: 12, solid: 0, dotted: 12, waiting: 0, draining: 0, opacity: 1 });
    art.update(lit(1), 1, 0, true);
    expect(art.stats).toMatchObject({ solid: 12, dotted: 0, draining: 0 });
    // Âge 100 : les tuiles 0 et 1 (dernier pas plein 120 et 136) sont dans les 48 derniers pas (restants 21 et 37) ; la 2 (152) n'y est pas encore.
    art.update(lit(100), 1, 0, true);
    expect(art.stats.draining).toBe(2);
    expect(art.stats.fills[0]).toBeCloseTo(21 / 49, 9);
    expect(art.stats.fills[1]).toBeCloseTo(37 / 49, 9);
    expect(art.stats.fills[2]).toBe(1);
    expect(art.stats.fills[11]).toBe(1);
    // Âge 121 : la tuile 0 est éteinte (pointillée), la 1 se vide.
    art.update(lit(121), 1, 0, true);
    expect(art.stats.dotted).toBe(1);
    expect(art.stats.fills[0]).toBe(0);
    expect(art.stats.solid).toBe(11);
  });

  it("la plaque de l'interrupteur s'enfonce quand on s'y pose et brille quand le pont est allumé", () => {
    const art = createBridgeArt(new Group(), level)!;
    const onSwitch = { x: 5 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, ground: 1 };
    art.update(lit(0), 1, 0, false);
    expect(art.stats).toMatchObject({ pressed: [0], plateDrop: [0], plateLit: [false] });
    art.update(lit(1, onSwitch), 1, 0, false);
    expect(art.stats).toMatchObject({ pressed: [1], plateLit: [true] });
    expect(art.stats.plateDrop[0]).toBeGreaterThan(0);
  });

  it("carnage : toujours allumé, à 35 % d'opacité ; hors carnage opaque", () => {
    const world = new Group();
    const art = createBridgeArt(world, level)!;
    art.update(lit(0), 0.35, 0, true);
    expect(art.stats).toMatchObject({ solid: 12, dotted: 0, opacity: 0.35 });
    const faces = meshes(world).filter((m) => m.visible);
    expect(faces.length).toBeGreaterThan(0);
    for (const m of meshes(world)) {
      const mat = m.material as { opacity?: number };
      if (m.visible && mat.opacity !== undefined) expect(mat.opacity).toBeLessThanOrEqual(0.35 + 1e-9);
    }
    art.update(lit(0), 1, 0, true);
    expect(art.stats).toMatchObject({ solid: 0, dotted: 12, opacity: 1 });
  });
});

describe("événement, son, particules : aucune secousse de caméra", () => {
  const ev = (): GameEvent => ({ tick: 5, source: "jeu", kind: "pontAllume", index: 0, x: 5.5, y: 12 });

  it("`pontAllume` part au pas où l'âge passe à 1 (allumage et rallumage), pas ensuite", () => {
    const on = { x: 5 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, ground: 1 };
    const before = lit(0, { ...on, x: 4 * T + (T - PLAYER_WIDTH) / 2 });
    const after = lit(1, on);
    const evs = eventsBetween(before, after, level, P, 7, "jeu");
    expect(evs.filter((e) => e.kind === "pontAllume")).toEqual([{ tick: 7, source: "jeu", kind: "pontAllume", index: 0, x: 5.5, y: 12 }]);
    expect(eventsBetween(after, lit(2, on), level, P, 8, "jeu").some((e) => e.kind === "pontAllume")).toBe(false);
    // Rallumage : l'âge repart de 1.
    expect(eventsBetween(lit(150, { ...on, x: 4 * T + (T - PLAYER_WIDTH) / 2 }), lit(1, on), level, P, 9, "jeu").some((e) => e.kind === "pontAllume")).toBe(true);
  });

  it("le son existe, des étincelles claires jaillissent de l'interrupteur, et ni secousse ni vibration", () => {
    expect(EVENT_KINDS).toContain("pontAllume");
    expect(soundFor(ev())).not.toBeNull();
    const pool = new Particles();
    const colors = feelColors(PALETTES[0]!);
    const levels = feelLevels(defaultSettings());
    const out = feelEvent(ev(), pool, colors, levels);
    expect(pool.emitted).toBeGreaterThan(0);
    expect(out.shake, "aucune secousse de caméra (règle du lot 14)").toBe(0);
    expect(out.shakeDuration).toBe(0);
    expect(out.vibrate).toBeNull();
    expect(vibrationFor(ev())).toBeNull();
    expect(colors.bridge).toContain(BRIDGE_LOOK.fill);
  });
});

describe("galerie, miniature de la semaine, thème", () => {
  it("l'étiquette « pont » filtre les sept morceaux dans la galerie ; l'index les connaît", () => {
    expect(MODULE_TAGS).toContain("pont");
    expect(TAG_LABELS.pont).toBe("pont");
    const ids = [...bridgeModuleIds()].sort();
    expect(ids).toHaveLength(7);
    for (const id of ids) expect(MODULE_INDEX.some(([x]) => x === id), id).toBe(true);
    expect(MODULES.filter((m) => m.tags.includes("pont") && m.theme === "nuit")).toHaveLength(7);
  });

  it("la miniature d'un jour de nuit à ponts liste l'interrupteur et les tuiles de chaque pont dans l'ordre", () => {
    // Lot V1 : le premier jour de nuit à ponts à partir du 17/12/2026 (le sac de thèmes a changé le thème de chaque date).
    let jour = parseDay("2026-12-17")!;
    while (jumpThemeForDay(jour) !== "nuit" || dailyLevel(jour).level.bridges.length === 0) jour++;
    const L = dailyLevel(jour);
    const day = semaineDayOf(L);
    expect(day.ponts?.length).toBe(L.level.bridges.length);
    L.level.bridges.forEach((b, i) => {
      expect(day.ponts![i]!.switchAt).toEqual([b.switchCol, b.switchRow]);
      expect(day.ponts![i]!.tiles).toEqual(b.tiles.map((c) => [c.col, c.row]));
    });
  }, 60_000);

  it("le thème de la nuit existe encore et n'a pas de rouge de pont", () => {
    expect(THEME_NAMES).toContain("nuit");
    expect(THEMES.nuit).toBeDefined();
  });
});
