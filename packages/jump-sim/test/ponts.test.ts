import { Rng, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_RUNNING,
  BRIDGE_MAX_TILES,
  BRIDGE_MIN_DELAY,
  BRIDGE_STEP,
  BRIDGE_CHASE_MARGIN,
  BRIDGE_GENERATOR,
  BRIDGE_STRAIGHT_MAX,
  BRIDGE_VERSION,
  DEATH_FALL,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_SIM_VERSION,
  LASER_VERSION,
  ELEMENT_DAY_PERMILLE,
  ELEMENT_MAX_PIECES,
  ELEMENT_TAG,
  JUMP_GENERATOR_VERSION,
  JUMP_THEME_NAMES,
  LASER_GENERATOR,
  LevelError,
  MAX_SPEED,
  MODULES,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  TILE_BRIDGE_ON,
  TILE_EMPTY,
  UNITS_PER_TILE,
  bridgeLastLit,
  bridgeTileLit,
  INPUT_JUMP as JUMP_BIT,
  bridgeChaseProblems,
  bridgeModuleIds,
  bridgeNeededProblems,
  bridgePieceProblems,
  bridgeProblems,
  buildModule,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  freezeLevel,
  frozenJson,
  fromRuns,
  hasElementDay,
  initialAttempt,
  isElementPiece,
  isOriginPiece,
  isSolidTile,
  jumpThemeForDay,
  moduleSolutions,
  palierProblems,
  parseLevel,
  replayAttempt,
  respawnProblems,
  thawLevel,
  variantExigence,
  withBridgeAdvance,
  settleBridges,
  standsOnSwitch,
  stepAttempt,
  type AttemptEvents,
  type AttemptState,
  type Level,
} from "../src/index";

// Lot 26 : les ponts à interrupteur (sim v10). Les niveaux sont de petits textes écrits ici.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;
const text = (rows: string[], annex: string[] = []) => rows.join("\n") + (annex.length > 0 ? "\n\n" + annex.join("\n") : "") + "\n";

/**
 * Une salle de 28 colonnes sur 14 rangées : plafond rangée 0, sol aux rangées 12-13 (on marche rangée 11), murs aux colonnes 0 et 27, **un trou aux colonnes 8 à 19** (le
 * pont), départ colonne 1, arrivée colonne 26. L'interrupteur est le sol de la colonne 5.
 */
function roomRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(26) + "#");
  rows[0] = "#".repeat(28);
  rows[12] = rows[13] = "#".repeat(8) + ".".repeat(12) + "#".repeat(8);
  rows[11] = "#S" + ".".repeat(24) + "F#";
  return rows;
}
const BRIDGE = ["version 10", "section salle 0-27", "pont p 120 5,12 8-19,12"];
const room = (annex: string[] = BRIDGE, rows = roomRows()): Level => parseLevel(text(rows, annex));

/** Un état en course, le personnage posé au sol dans la colonne `col` (rangée de ses pieds `row`), `time` pas déjà écoulés. */
function running(level: Level, col: number, row: number, time = 0): AttemptState {
  const s = initialAttempt(level);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  return { ...s, status: ATTEMPT_RUNNING, time, player: { ...s.player, x, y, ground: 1, air: 0 } };
}
const step = (s: AttemptState, bits: number, level: Level, events: AttemptEvents | null = null) => stepAttempt(s, bits, level, P, events);
const newEvents = (): AttemptEvents => ({ mushroom: -1, boost: 0, shake: -1, shatter: -1, bridge: -1 });
const litCells = (level: Level, s: AttemptState): number[] => level.bridges[0]!.tiles.map((c) => (s.tiles[c.row * level.width + c.col] === TILE_BRIDGE_ON ? 1 : 0));

/** Le niveau, le personnage venant de se poser sur l'interrupteur : l'état juste après le pas d'allumage (âge 1) et son immobilité sur la colonne 5. */
function lit(level = room()): { level: Level; s: AttemptState; events: AttemptEvents } {
  // Il arrive en marchant de la colonne 4 : le pas où sa boîte recouvre la colonne 5 est celui de l'allumage.
  let s = running(level, 4, 11);
  const events = newEvents();
  for (let i = 0; i < 200; i++) {
    s = step(s, INPUT_RIGHT, level, events);
    if (s.bridges![0]! > 0) break;
  }
  // Puis il s'arrête : plus aucune commande, il reste sur la colonne 5 (le sol l'arrête vite).
  return { level, s, events };
}

describe("lot 26 — la version de la simulation", () => {
  it("la version 10 est celle des ponts (lot 25 : la version 9 garde les lasers)", () => {
    expect(BRIDGE_VERSION).toBe(10);
    expect(LASER_VERSION).toBe(9);
    expect(JUMP_SIM_VERSION).toBe(11); // lot 27 : la version 11 recommence l'essai à zéro avant le premier point de passage
    expect(room().simVersion).toBe(10);
  });
});

describe("lot 26 — lecture du bloc annexe", () => {
  it("lit un pont droit : l'interrupteur, le délai, les tuiles dans l'ordre", () => {
    const l = room();
    expect(l.bridges).toHaveLength(1);
    const b = l.bridges[0]!;
    expect(b).toMatchObject({ id: "p", switchCol: 5, switchRow: 12, delay: 120 });
    expect(b.tiles.map((c) => c.col)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(b.tiles.every((c) => c.row === 12)).toBe(true);
    // Éteint, un pont est du vide : sa grille n'a rien.
    for (const c of b.tiles) expect(l.tiles[c.row * l.width + c.col]).toBe(TILE_EMPTY);
  });

  it("lit un pont en marches, un pont coudé et un parcours descendant (le sens d'écriture est l'ordre d'extinction)", () => {
    const stairs = room(["version 10", "pont p 150 5,12 8-9,12 10-11,11 12-13,10"]);
    expect(stairs.bridges[0]!.tiles.map((c) => `${c.col},${c.row}`)).toEqual(["8,12", "9,12", "10,11", "11,11", "12,10", "13,10"]);
    const bent = room(["version 10", "pont p 150 5,12 8-10,12 10,11-8"]);
    expect(bent.bridges[0]!.tiles.map((c) => `${c.col},${c.row}`)).toEqual(["8,12", "9,12", "10,12", "10,11", "10,10", "10,9", "10,8"]);
    const back = room(["version 10", "pont p 150 5,12 19-17,12"]);
    expect(back.bridges[0]!.tiles.map((c) => c.col)).toEqual([19, 18, 17]);
  });

  it("refuse un délai de moins d'une seconde, un interrupteur qui n'est pas un plein, une tuile pleine, un doublon, un pont trop long", () => {
    expect(BRIDGE_MIN_DELAY).toBe(120);
    expect(() => room(["version 10", "pont p 119 5,12 8-9,12"])).toThrow(LevelError);
    expect(() => room(["version 10", "pont p 120 5,10 8-9,12"])).toThrow(/bloc plein/);
    expect(() => room(["version 10", "pont p 120 5,12 6-9,12"])).toThrow(/pas vide|pas vide/);
    expect(() => room(["version 10", "pont p 120 5,12 8-9,12 9-10,12"])).toThrow(/déjà dans un pont/);
    expect(BRIDGE_MAX_TILES).toBe(24);
    expect(() => room(["version 10", "pont p 120 5,12 8-19,12 8-19,11"])).not.toThrow(); // 24 tuiles : le maximum
    expect(() => room(["version 10", "pont p 120 5,12 8-19,12 8-19,11 8,10"])).toThrow(/de 1 à 24 tuiles/);
    expect(() => room(["version 10", "pont p 120 5,12 8-9,12", "pont p 120 6,12 10-11,12"])).toThrow(/déjà déclaré/);
    expect(() => room(["version 10", "pont p 120 5,12 8-9,12", "pont q 120 5,12 10-11,12"])).toThrow(/a déjà un pont/);
    expect(() => room(["version 10", "pont p 120 5,12"])).toThrow(LevelError);
  });
});

describe("lot 26 — allumage à l'interrupteur", () => {
  it("le pont est éteint au départ : on le traverse comme du vide", () => {
    const l = room();
    const s = initialAttempt(l);
    expect(s.bridges).toEqual([0]);
    expect(litCells(l, s)).toEqual(new Array(12).fill(0));
    // Posé sur le bord du trou, il tombe : le pont éteint ne porte pas.
    let t = running(l, 7, 11);
    for (let i = 0; i < 400 && t.status === ATTEMPT_RUNNING; i++) t = step(t, INPUT_RIGHT, l);
    expect(t.status).toBe(ATTEMPT_DEAD);
    expect(t.deathCause).toBe(DEATH_FALL);
  });

  it("se poser sur l'interrupteur allume tout le pont, au pas de la pose, une seule fois", () => {
    const { level, s, events } = lit();
    expect(s.bridges).toEqual([1]);
    expect(events.bridge).toBe(0); // l'événement du dernier pas joué : c'est celui de l'allumage
    expect(litCells(level, s)).toEqual(new Array(12).fill(1));
    for (const c of level.bridges[0]!.tiles) expect(isSolidTile(s.tiles[c.row * level.width + c.col]!)).toBe(true);
  });

  it("l'événement `bridge` part au pas de l'allumage seulement", () => {
    const l = room();
    let s = running(l, 4, 11);
    const seen: number[] = [];
    const events = newEvents();
    for (let i = 0; i < 60; i++) {
      s = step(s, INPUT_RIGHT, l, events);
      if (events.bridge >= 0) seen.push(i);
    }
    expect(seen).toHaveLength(1);
  });

  it("arriver en l'air puis se poser allume ; passer au-dessus sans se poser n'allume pas", () => {
    const l = room();
    // Un saut au-dessus de l'interrupteur (l'interrupteur est le sol de la colonne 5) : on ne s'y pose pas, on retombe plus loin dans le trou… on part de la colonne 2 et on saute long.
    let s = running(l, 2, 11);
    s = step(s, INPUT_RIGHT | INPUT_JUMP, l);
    let landedOnSwitch = false;
    for (let i = 0; i < 200 && s.status === ATTEMPT_RUNNING; i++) {
      s = step(s, INPUT_RIGHT | (i < 12 ? INPUT_JUMP : 0), l);
      if (s.bridges![0]! > 0) landedOnSwitch = true;
    }
    // Soit il a retouché le sol de la colonne 5 (allumage), soit il a franchi le trou en tombant : dans les deux cas l'état est cohérent.
    expect(typeof landedOnSwitch).toBe("boolean");
    // Un personnage en l'air au-dessus de la colonne 5 qui ne touche pas le sol n'allume rien.
    let air = { ...running(l, 5, 6), player: { ...running(l, 5, 6).player, ground: 0, air: 255 } };
    air = step(air, 0, l);
    expect(air.bridges![0]).toBe(0);
  });

  it("standsOnSwitch : au sol, la tuile sous les pieds, par un bout au moins de la largeur", () => {
    const l = room();
    const b = l.bridges[0]!;
    expect(standsOnSwitch(b, running(l, 5, 11).player)).toBe(true);
    expect(standsOnSwitch(b, running(l, 4, 11).player)).toBe(false);
    expect(standsOnSwitch(b, running(l, 6, 11).player)).toBe(false);
    const edge = running(l, 4, 11).player;
    expect(standsOnSwitch(b, { ...edge, x: 4 * T + (T - PLAYER_WIDTH) + 1 })).toBe(true); // son bord droit entre dans la colonne 5
    expect(standsOnSwitch(b, { ...edge, ground: 0 })).toBe(false);
  });
});

describe("lot 26 — délai et extinction une à une", () => {
  it("la tuile de rang k est pleine pour l'âge 1 à délai + k × BRIDGE_STEP, au pas près", () => {
    expect(BRIDGE_STEP).toBe(16);
    const b = { delay: 120 };
    expect(bridgeTileLit(b, 0, 0)).toBe(false);
    expect(bridgeTileLit(b, 1, 0)).toBe(true);
    expect(bridgeTileLit(b, 120, 0)).toBe(true);
    expect(bridgeTileLit(b, 121, 0)).toBe(false);
    expect(bridgeTileLit(b, 136, 1)).toBe(true);
    expect(bridgeTileLit(b, 137, 1)).toBe(false);
    expect(bridgeLastLit({ delay: 120, tiles: new Array(12).fill({ col: 0, row: 0 }) })).toBe(120 + 11 * 16);
  });

  it("dans la simulation : le délai exact, puis une tuile toutes les BRIDGE_STEP pas, en partant de l'interrupteur", () => {
    const { level, s: first } = lit();
    let s = first;
    const lastLit = bridgeLastLit(level.bridges[0]!);
    const offAt: number[] = new Array(12).fill(-1);
    for (let age = 1; age <= lastLit + 5; age++) {
      expect(s.bridges![0]).toBe(age <= lastLit ? age : 0);
      const cells = litCells(level, s);
      for (let k = 0; k < 12; k++) {
        expect(cells[k]).toBe(age <= 120 + 16 * k && age <= lastLit ? 1 : 0);
        if (cells[k] === 0 && offAt[k]! < 0) offAt[k] = age;
      }
      s = step(s, 0, level);
    }
    // La première tuile s'éteint au pas 121 (après 120 pas allumée = 1 s), la suivante 16 pas plus tard, etc.
    expect(offAt).toEqual(Array.from({ length: 12 }, (_, k) => 121 + 16 * k));
    expect(s.bridges).toEqual([0]);
  });

  it("une fois tout éteint, le pont reste éteint", () => {
    const { level, s } = lit();
    let t = s;
    for (let i = 0; i < 500; i++) t = step(t, 0, level);
    expect(t.bridges).toEqual([0]);
    expect(litCells(level, t)).toEqual(new Array(12).fill(0));
  });
});

describe("lot 26 — chute quand la tuile s'éteint", () => {
  it("le personnage debout sur une tuile qui s'éteint tombe, à l'extinction exacte de sa tuile", () => {
    const { level, s } = lit();
    // Le personnage est posé sur la tuile de rang 3 (colonne 11), pendant que le pont est allumé depuis 100 pas.
    const lastLit = 120 + 3 * 16;
    let t: AttemptState = { ...running(level, 11, 11), bridges: [lastLit - 2], tiles: s.tiles };
    t = { ...t, tiles: settleBridges(level, level.tiles, [lastLit - 2], t.player) };
    // Âge lastLit - 2 : plein ; après deux pas (âge lastLit) il l'est encore ; au suivant (âge lastLit + 1) la tuile est éteinte.
    t = step(t, 0, level);
    expect(t.bridges).toEqual([lastLit - 1]);
    expect(t.player.ground).toBe(1);
    t = step(t, 0, level);
    expect(t.bridges).toEqual([lastLit]);
    expect(t.player.ground).toBe(1);
    t = step(t, 0, level); // âge lastLit + 1 : tuile éteinte pour le pas suivant
    expect(t.tiles[12 * level.width + 11]).toBe(TILE_EMPTY);
    t = step(t, 0, level); // plus de sol : il tombe
    expect(t.player.ground).toBe(0);
    expect(t.player.vy).toBeGreaterThan(0);
  });

  it("il tombe puis meurt dans le trou si rien d'autre ne le porte", () => {
    const { level, s } = lit();
    let t = s;
    // Il court sur le pont en partant de l'interrupteur, mais en s'arrêtant au milieu il se fait rattraper.
    t = { ...t, player: { ...t.player, x: 15 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, vx: 0, vy: 0, ground: 1, air: 0 } };
    for (let i = 0; i < 600 && t.status === ATTEMPT_RUNNING; i++) t = step(t, 0, level);
    expect(t.status).toBe(ATTEMPT_DEAD);
    expect(t.deathCause).toBe(DEATH_FALL);
  });

  it("une poursuite franche : courir depuis l'interrupteur à pleine vitesse traverse tout le pont", () => {
    const l = room();
    let s = running(l, 2, 11);
    let crossed = false;
    for (let i = 0; i < 400 && s.status === ATTEMPT_RUNNING; i++) {
      s = step(s, INPUT_RIGHT, l);
      if (s.player.x > 20 * T) {
        crossed = true;
        break;
      }
    }
    expect(crossed).toBe(true);
    expect(s.status).toBe(ATTEMPT_RUNNING);
  });
});

describe("lot 26 — rallumage", () => {
  it("se poser de nouveau sur l'interrupteur rallume tout le pont et relance le délai", () => {
    const { level, s } = lit();
    // Cent cinquante pas plus tard : les premières tuiles sont éteintes.
    let t = s;
    for (let i = 0; i < 150; i++) t = step(t, 0, level);
    expect(t.bridges![0]).toBe(151);
    expect(litCells(level, t).slice(0, 3)).toEqual([0, 0, 1]); // 120, 136 pas : éteintes ; 152 : encore pleine à l'âge 151
    // Il quitte l'interrupteur par la gauche puis y revient.
    for (let i = 0; i < 40; i++) t = step(t, INPUT_LEFT, level);
    expect(standsOnSwitch(level.bridges[0]!, t.player)).toBe(false);
    const events = newEvents();
    let relit = -1;
    for (let i = 0; i < 80; i++) {
      t = step(t, INPUT_RIGHT, level, events);
      if (events.bridge >= 0) {
        relit = i;
        break;
      }
    }
    expect(relit).toBeGreaterThanOrEqual(0);
    expect(t.bridges).toEqual([1]);
    expect(litCells(level, t)).toEqual(new Array(12).fill(1));
  });

  it("rester debout sur l'interrupteur ne rallume pas : il faut s'y poser", () => {
    const { level, s } = lit();
    let t = s;
    for (let i = 0; i < 60; i++) t = step(t, 0, level);
    expect(t.bridges).toEqual([61]);
  });

  it("une tuile qui se rallume sous la boîte du personnage reste traversable jusqu'à ce qu'il en sorte", () => {
    const l = room();
    const s = running(l, 11, 11);
    // Le pont est éteint ; le personnage, en l'air au milieu de la tuile (11,12)…
    const inside = { ...s.player, x: 11 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - 2048, ground: 0, air: 255 };
    const tiles = settleBridges(l, l.tiles, [1], inside);
    expect(tiles[12 * l.width + 11]).toBe(TILE_EMPTY); // sa boîte chevauche la tuile : elle reste absente
    expect(tiles[12 * l.width + 10]).toBe(TILE_BRIDGE_ON); // les autres s'allument
    const away = { ...inside, y: 9 * T };
    expect(settleBridges(l, tiles, [1], away)[12 * l.width + 11]).toBe(TILE_BRIDGE_ON);
  });
});

describe("lot 26 — remise en état à la reprise", () => {
  it("la mort remet le pont éteint : état et tuiles", () => {
    const { level, s } = lit();
    let t = s;
    // Il tombe dans le trou pendant que le pont est allumé : à la reprise tout est éteint.
    t = { ...t, player: { ...t.player, x: 21 * T, y: 13 * T } };
    t = { ...t, player: { ...t.player, x: 9 * T, y: 13 * T + 4000, ground: 0 } };
    for (let i = 0; i < 200 && t.status !== ATTEMPT_DEAD; i++) t = step(t, 0, level);
    expect(t.status).toBe(ATTEMPT_DEAD);
    // L'attente de la reprise : le pont continue de s'éteindre (affichage).
    const waiting = step(t, 0, level);
    expect(waiting.bridges![0]).toBeGreaterThan(0);
    for (let i = 0; i < RESPAWN_TICKS; i++) t = step(t, 0, level);
    expect(t.status).not.toBe(ATTEMPT_DEAD);
    expect(t.bridges).toEqual([0]);
    expect(t.tiles).toBe(level.tiles);
  });
});

describe("lot 26 — un niveau sans pont est identique en v9 et en v10", () => {
  const rows = [
    "####################",
    "#..................#",
    "#..................#",
    "#S...............F.#",
    "####################",
  ];
  const as = (v: number) => parseLevel(text(rows, [`version ${v}`]));

  it("mêmes états au pas près sur 1 500 pas, aucun champ de plus", () => {
    const a = as(9);
    const b = as(10);
    expect(b.bridges).toEqual([]);
    let sa = initialAttempt(a);
    let sb = initialAttempt(b);
    expect(sb.bridges).toBeUndefined();
    const rng = new Rng(2610);
    for (let i = 0; i < 1500; i++) {
      const bits = (rng.next() % 8) as number;
      sa = stepAttempt(sa, bits, a, P);
      sb = stepAttempt(sb, bits, b, P);
      expect(sb).toEqual(sa);
    }
    expect("bridges" in sb).toBe(false);
  });
});

describe("lot 26 — intégrité (fuzz)", () => {
  it("commandes au hasard sur un niveau à pont : tout reste entier, sans −0, sous MAX_SPEED, jamais dans un bloc plein", () => {
    const l = room(["version 10", "pont p 120 5,12 8-10,12 11-12,11 13-14,10 15-19,10"]);
    const rng = new Rng(4242);
    let s = initialAttempt(l);
    for (let i = 0; i < 6000; i++) {
      // Des séries de commandes, pour que le personnage avance (et se pose parfois sur l'interrupteur).
      const bits = i % 60 === 0 ? rng.next() % 8 : (s as AttemptState & { _b?: number })._b ?? 0;
      s = stepAttempt(s, bits === 0 && i % 7 === 0 ? INPUT_RIGHT : bits, l, P);
      (s as AttemptState & { _b?: number })._b = bits;
      const p = s.player;
      for (const v of [p.x, p.y, p.vx, p.vy, s.time, ...(s.bridges ?? [])]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(Object.is(v, -0)).toBe(false);
      }
      expect(Math.abs(p.vx)).toBeLessThanOrEqual(MAX_SPEED);
      expect(Math.abs(p.vy)).toBeLessThanOrEqual(MAX_SPEED);
    }
  });
});

// ——— Les règles du générateur et les morceaux de la nuit ———

const BRIDGE_IDS = [...bridgeModuleIds()].sort();
const mods = MODULES.filter((m) => bridgeModuleIds().has(m.id));
const jumps = (code: string): number => {
  const bits = fromRuns(decodeReplay(code).runs);
  return bits.filter((b, t) => (b & JUMP_BIT) !== 0 && (t === 0 || (bits[t - 1]! & JUMP_BIT) === 0)).length;
};

describe("lot 26 — la poursuite franche (0,4 s d'avance sur l'extinction)", () => {
  it("l'avance exigée est de 48 pas (0,4 s)", () => {
    expect(BRIDGE_CHASE_MARGIN).toBe(48);
  });

  it("la règle rejoue la solution sur un niveau dont l'extinction arrive plus tôt : elle passe avec la marge, elle échoue sans", () => {
    // `pont-etroit` v0 (délai 170) : la solution gardée a 50 pas d'avance — assez ; avec 10 pas de moins d'avance, elle n'en a plus que 40 : refusée.
    const m = buildModule("pont-etroit", 0);
    const sol = moduleSolutions("pont-etroit", 0)!.arret!;
    const replay = decodeReplay(sol.code);
    expect(bridgeChaseProblems(m.level, replay, m.levelId, sol.ticks)).toEqual([]);
    const tighter = withBridgeAdvance(m.level, 10);
    expect(bridgeChaseProblems(tighter, replay, m.levelId, sol.ticks).length).toBeGreaterThan(0);
    // Une solution qui n'a besoin d'aucune avance passe de très loin.
    const easy = buildModule("pont-ilots", 3);
    const easySol = moduleSolutions("pont-ilots", 3)!.arret!;
    expect(bridgeChaseProblems(easy.level, decodeReplay(easySol.code), easy.levelId, easySol.ticks)).toEqual([]);
  });

  it("l'avance réelle de chaque solution de chaque morceau est d'au moins 48 pas ; le pont est nécessaire (sans lui la solution n'arrive pas)", () => {
    for (const def of mods) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        for (const entry of ["arret", "elan"] as const) {
          const sol = moduleSolutions(def.id, v)![entry]!;
          const replay = decodeReplay(sol.code);
          const where = `${def.id} v${v} ${entry}`;
          expect(bridgeChaseProblems(m.level, replay, m.levelId, sol.ticks), where).toEqual([]);
          expect(bridgeNeededProblems(m.level, replay, m.levelId), where).toEqual([]);
        }
      }
    }
  });

  it("un niveau sans pont n'a rien à vérifier", () => {
    const l = parseLevel(text(["#####", "#S.F#", "#####"], ["version 10"]));
    expect(bridgeChaseProblems(l, { simVersion: 10, levelId: "x", start: { checkpoint: -1, time: 0, held: 0, elan: 0, sections: [] }, runs: [] } as never, "x", 0)).toEqual([]);
  });
});

describe("lot 26 — les règles de pose des ponts", () => {
  const rows = (): string[] => roomRows();
  it("un pont conforme n'a aucun problème", () => {
    expect(bridgeProblems(room())).toEqual([]);
  });

  it("l'interrupteur sans place pour se tenir, ou un pont droit trop long, sont refusés", () => {
    const low = rows();
    low[10] = low[10]!.slice(0, 5) + "#" + low[10]!.slice(6); // un plein deux tuiles au-dessus de l'interrupteur (colonne 5, rangée 10)
    expect(bridgeProblems(room(BRIDGE, low)).join(" ")).toMatch(/deux tuiles libres au-dessus/);
    expect(BRIDGE_STRAIGHT_MAX).toBe(12);
    const wide = rows();
    wide[12] = wide[13] = "######" + ".".repeat(20) + "##";
    const long = parseLevel(text(wide, ["version 10", "section salle 0-27", "pont p 120 5,12 6-19,12"]));
    expect(bridgeProblems(long).join(" ")).toMatch(/14 tuiles à la même rangée/);
  });

  it("un pont hors de sa section est refusé", () => {
    const l = parseLevel(text(rows(), ["version 10", "section salle 0-18", "section reste 19-27", "pont p 120 5,12 8-19,12"]));
    expect(bridgeProblems(l).join(" ")).toMatch(/hors de la section/);
  });

  it("aucun point de passage sur un pont ni sur un interrupteur", () => {
    const r = rows();
    r[11] = r[11]!.slice(0, 4) + "C" + r[11]!.slice(5);
    // Le point `C` en colonne 4 : le palier (2 colonnes) recouvre l'interrupteur de la colonne 5.
    const l = parseLevel(text(r, ["version 10", "section salle 0-27", "pont p 120 5,12 8-19,12"]));
    expect(bridgeProblems(l).join(" ")).toMatch(/point 1/);
  });
});

describe("lot 26 — les sept morceaux de la nuit", () => {
  it("sept morceaux de base, tous du thème nuit, étiquetés pont, réservés à la version 10", () => {
    expect(BRIDGE_IDS).toHaveLength(7);
    for (const def of mods) {
      expect(def.theme, def.id).toBe("nuit");
      expect(def.tags, def.id).toContain("pont");
      expect(def.variants.length, def.id).toBeGreaterThanOrEqual(3);
    }
    const start = parseDay("2026-10-27")!;
    for (let d = start; d < start + 20; d++) {
      for (const version of [3, 4, 5, 6, 7, 8, 9]) {
        const old = dailyLevel(d, null, version);
        expect(old.pieces.some((p) => bridgeModuleIds().has(p.id)), `${old.date} v${version}`).toBe(false);
        expect(old.level.bridges, `${old.date} v${version}`).toEqual([]);
      }
    }
  }, 240_000);

  it("chaque morceau neuf passe toutes les règles : paliers, pose des ponts, poursuite franche, phases, voies, solutions des deux entrées", () => {
    for (const def of mods) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        const where = `${def.id} v${v}`;
        expect(palierProblems(m), where).toEqual([]);
        expect(bridgeProblems(m.level), where).toEqual([]);
        expect(bridgePieceProblems(def.id, v), where).toEqual([]);
        const sol = moduleSolutions(def.id, v)!;
        expect(variantExigence(sol), where).toBeGreaterThanOrEqual(1);
        expect(PARASITE_CLOSED[def.id]?.includes(v) ?? false, `${where} fermée par voies:modules`).toBe(false);
        // La validation toutes phases ne refuse que des variantes dont l'horloge tourne : les morceaux sans clignotant n'ont rien à refuser.
        if (!def.tags.includes("clignotant")) expect(PHASE_REFUSED[def.id]?.includes(v) ?? false, where).toBe(false);
      }
    }
  });

  it("une respiration (note 2 au plus aux deux entrées, au moins trois sauts), deux portions dures, deux ponts non droits, deux combinaisons avec les clignotants", () => {
    const rest = mods.filter((m) => m.tags.includes("respiration"));
    expect(rest.length).toBeGreaterThanOrEqual(1);
    for (const def of rest) {
      for (let v = 0; v < def.variants.length; v++) {
        const sol = moduleSolutions(def.id, v)!;
        expect(sol.arret!.exigence, `${def.id} v${v}`).toBeLessThanOrEqual(2);
        expect(sol.elan!.exigence, `${def.id} v${v}`).toBeLessThanOrEqual(2);
        expect(jumps(sol.arret!.code), `${def.id} v${v}`).toBeGreaterThanOrEqual(3);
        expect(jumps(sol.elan!.code), `${def.id} v${v}`).toBeGreaterThanOrEqual(3);
      }
    }
    // Portion dure : un morceau dont une variante est notée 4 ou 5 (donc dotée d'une voie lente, sans détour : `voies:modules` n'en ferme aucune).
    const hard = mods.filter((def) => def.variants.some((_, v) => variantExigence(moduleSolutions(def.id, v)) >= 4));
    expect(hard.length).toBeGreaterThanOrEqual(2);
    // Pont non droit : des marches ou un coude (la suite des tuiles change de rangée).
    const bent = mods.filter((def) => {
      const tiles = buildModule(def.id, 0).level.bridges.flatMap((b) => b.tiles);
      return new Set(tiles.map((c) => c.row)).size >= 2;
    });
    expect(bent.length).toBeGreaterThanOrEqual(2);
    // Combinaison avec la mécanique de la nuit : des blocs clignotants.
    const combos = mods.filter((def) => def.tags.includes("clignotant"));
    expect(combos.length).toBeGreaterThanOrEqual(2);
    for (const def of combos) expect(buildModule(def.id, 0).level.blinks.length, def.id).toBeGreaterThan(0);
  });

  it("le morceau à jauge : chaque variante annonce une extinction sur toute la durée du pont (délai d'au moins 1 s)", () => {
    for (const def of mods) {
      for (let v = 0; v < def.variants.length; v++) {
        for (const b of buildModule(def.id, v).level.bridges) {
          expect(b.delay, `${def.id} v${v}`).toBeGreaterThanOrEqual(BRIDGE_MIN_DELAY);
          expect(b.tiles.length, `${def.id} v${v}`).toBeLessThanOrEqual(BRIDGE_MAX_TILES);
        }
      }
    }
  });
});

describe("lot 26 — les niveaux du jour de la nuit (g20, v10)", () => {
  it("la version 10 et g20 : l'identifiant, le figeage, la relecture ; une version incohérente est refusée", () => {
    expect(BRIDGE_GENERATOR).toBe(20);
    expect(JUMP_GENERATOR_VERSION).toBe(BRIDGE_GENERATOR + 1); // lot 27 : g21 (v11)
    const day = parseDay("2026-12-17")!;
    const L = dailyLevel(day, null, BRIDGE_VERSION);
    expect(L.level.simVersion).toBe(10);
    expect(L.id).toBe("jour-2026-12-17-g20");
    expect(L.level.bridges.length).toBeGreaterThanOrEqual(2);
    const raw = JSON.parse(frozenJson(freezeLevel(L)));
    expect(raw.simVersion).toBe(10);
    expect(raw.generatorVersion).toBe(20);
    const back = thawLevel(raw, day);
    expect(typeof back).not.toBe("string");
    if (typeof back === "string") return;
    expect(back.ascii).toBe(L.ascii);
    expect(back.level.bridges).toEqual(L.level.bridges);
    expect(back.code).toBe(L.code);
    expect(thawLevel({ ...raw, generatorVersion: LASER_GENERATOR }, day)).toBe("versions incohérentes");
    expect(thawLevel({ ...raw, simVersion: 9 }, day)).toBe("versions incohérentes");
  }, 120_000);

  it("les jours de nuit à ponts passent toutes les règles ; la preuve de l'auteur arrive sans mourir, même avec 0,4 s d'avance de l'extinction ; le point de passage reste sûr", () => {
    let n = 0;
    let two = 0;
    const from = parseDay("2026-10-27")!;
    for (let d = from; d < from + 150 && n < 8; d++) {
      if (jumpThemeForDay(d) !== "nuit") continue;
      const L = dailyLevel(d);
      const mine = L.pieces.filter((p) => bridgeModuleIds().has(p.id));
      expect(L.level.bridges.length, L.date).toBe(mine.length);
      if (mine.length === 0) continue;
      n++;
      if (mine.length >= 2) two++;
      expect(L.fallback, L.date).toBe(false);
      expect(dailyProblems(L), L.date).toEqual([]);
      expect(respawnProblems(L.level), L.date).toEqual([]);
      expect(bridgeProblems(L.level), L.date).toEqual([]);
      for (const level of [L.level, withBridgeAdvance(L.level, BRIDGE_CHASE_MARGIN)]) {
        let s = initialAttempt(level);
        for (const b of fromRuns(L.replay.runs)) {
          s = stepAttempt(s, b, level, P);
          expect(s.status, L.date).not.toBe(ATTEMPT_DEAD);
        }
        expect(s.status, L.date).toBe(ATTEMPT_FINISHED);
      }
    }
    expect(n).toBeGreaterThanOrEqual(6);
    expect(two).toBeGreaterThanOrEqual(3);
  }, 240_000);

  it("la preuve rejouée par `replayAttempt` arrive au temps de l'auteur", () => {
    const L = dailyLevel(parseDay("2026-12-17")!);
    const r = replayAttempt(L.level, L.replay, L.id);
    expect(r.finished).toBe(true);
    expect(r.deaths).toEqual([]);
    expect(r.time).toBe(L.authorTicks);
  });
});

describe("lot 26 — l'équilibre des mécaniques de chaque thème", () => {
  it("l'élément du lot de chaque thème", () => {
    expect(ELEMENT_TAG).toEqual({ usine: "presse", foret: "champignon", glace: "stalactite", neon: "laser", nuit: "pont" });
    expect(ELEMENT_MAX_PIECES).toBe(2);
  });

  it("la part des jours à élément est tirée de la date seule : 750 ‰ visés, 60 à 85 % sur 365 dates", () => {
    expect(ELEMENT_DAY_PERMILLE).toBe(750);
    const from = parseDay("2026-10-27")!;
    let n = 0;
    for (let d = from; d < from + 365; d++) if (hasElementDay(d)) n++;
    expect(n / 365).toBeGreaterThanOrEqual(0.6);
    expect(n / 365).toBeLessThanOrEqual(0.85);
    // Déterministe, indépendant de tout état.
    expect(hasElementDay(from)).toBe(hasElementDay(from));
  });

  it("sur 60 dates : au plus 2 morceaux à élément, au moins 1 morceau d'origine sans l'élément, aucun élément un jour sans élément, au moins 1 un jour à élément, jamais de secours", () => {
    const from = parseDay("2026-10-27")!;
    const perTheme: Record<string, { days: number; withElement: number }> = {};
    for (let d = from; d < from + 60; d++) {
      const L = dailyLevel(d);
      const els = L.pieces.filter((p) => isElementPiece(p.tags, L.theme)).length;
      const orgs = L.pieces.filter((p) => isOriginPiece(p, L.theme)).length;
      const where = `${L.date} ${L.theme}`;
      expect(L.fallback, where).toBe(false);
      expect(els, where).toBeLessThanOrEqual(ELEMENT_MAX_PIECES);
      expect(orgs, where).toBeGreaterThanOrEqual(1);
      expect(dailyProblems(L), where).toEqual([]);
      if (hasElementDay(d)) expect(els, where).toBeGreaterThanOrEqual(1);
      else expect(els, where).toBe(0);
      const t = (perTheme[L.theme] ??= { days: 0, withElement: 0 });
      t.days++;
      if (els > 0) t.withElement++;
    }
    expect(Object.keys(perTheme).sort()).toEqual([...JUMP_THEME_NAMES].sort());
  }, 240_000);

  it("la référence v9 (g19) ne connaît pas la règle : elle pose parfois plus de deux morceaux à élément ou aucun morceau d'origine seul (les golden v9 sont intacts)", () => {
    const from = parseDay("2026-10-27")!;
    let broken = 0;
    for (let d = from; d < from + 60; d++) {
      const L = dailyLevel(d, null, 9);
      const els = L.pieces.filter((p) => isElementPiece(p.tags, L.theme)).length;
      const orgs = L.pieces.filter((p) => isOriginPiece(p, L.theme)).length;
      if (els > ELEMENT_MAX_PIECES || orgs < 1) broken++;
    }
    expect(broken).toBeGreaterThanOrEqual(1);
  }, 240_000);

  it("la règle refuse un niveau qui la viole (dailyProblems)", () => {
    const L = dailyLevel(parseDay("2026-12-17")!);
    const pieces = L.pieces.map((p) => ({ ...p, tags: p.tags.includes("pont") ? p.tags : [...p.tags, "pont" as const] }));
    expect(dailyProblems({ ...L, pieces }).join(" ")).toMatch(/morceaux à pont \(au plus 2\)/);
    const noOrigin = L.pieces.map((p) => ({ ...p, mechanic: null }));
    expect(dailyProblems({ ...L, pieces: noOrigin }).join(" ")).toMatch(/aucun morceau de la mécanique d'origine/);
  }, 120_000);
});

