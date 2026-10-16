import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  DEFAULT_JUMP_PARAMS,
  LevelError,
  MAX_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SOLID,
  WIND_DEFAULTS,
  WIND_LEFT,
  WIND_RIGHT,
  WIND_UP,
  boxHits,
  initialAttempt,
  isDefaultJumpParams,
  parseLevel,
  stepAttempt,
  stepPlayer,
  stepPlayerJump,
  windActive,
  windBlows,
  windPhase,
  windPush,
  windZoneOf,
  type AttemptState,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { J, L, P, R, T, floatAt, standAt } from "./helpers";

// Lot 13 — les courants d'air (thème forêt) : zones déclarées dans le bloc annexe (`vent …`), traversables, qui poussent vers le haut (montée
// jusqu'à `windRise`) ou sur le côté (dérive `windDrift` ajoutée à la commande), en continu ou en rafales (horloge de la section).

const lv = (rows: readonly string[], annex: readonly string[] = []) => parseLevel(rows.join("\n") + (annex.length ? "\n\n" + annex.join("\n") + "\n" : ""));
const RISE = WIND_DEFAULTS.windRise;
const DRIFT = WIND_DEFAULTS.windDrift;
const step = (s: AttemptState, input: number, level: Level) => stepAttempt(s, input, level, DEFAULT_JUMP_PARAMS);

/** Une grande salle vide (40 × 20) : `vent` donne la zone. */
function hall(annex: readonly string[]): Level {
  const rows: string[] = [];
  rows.push("#".repeat(42));
  for (let r = 0; r < 20; r++) rows.push(`#${".".repeat(40)}#`);
  rows[20] = `#S${".".repeat(38)}F#`;
  rows.push("#".repeat(42));
  return lv(rows, annex);
}
const withPlayer = (level: Level, player: PlayerState): AttemptState => ({ ...initialAttempt(level), status: 1, player });

describe("lecture des zones de vent", () => {
  it("`vent c0-c1 r0-r1 sens force [rafale cycle actif décalage]` : rangée dans `Level.winds`, la section de sa première colonne", () => {
    const level = hall(["section a 10-30", "vent 12-15 3-18 haut 100", "vent 20-25 18-20 droite 150 rafale 240 120 30", "vent 2-4 2-4 gauche 50"]);
    expect(level.winds).toEqual([
      { c0: 12, c1: 15, r0: 3, r1: 18, dir: WIND_UP, force: 100, gust: null, section: 0 },
      { c0: 20, c1: 25, r0: 18, r1: 20, dir: WIND_RIGHT, force: 150, gust: { cycle: 240, active: 120, shift: 30 }, section: 0 },
      { c0: 2, c1: 4, r0: 2, r1: 4, dir: WIND_LEFT, force: 50, gust: null, section: -1 },
    ]);
  });

  it("une zone est traversable : la grille ne change pas (aucun bloc), le personnage y passe", () => {
    const a = hall([]);
    const b = hall(["vent 1-40 1-20 gauche 100"]);
    expect(b.tiles).toEqual(a.tiles);
    expect(b.tiles.includes(TILE_SOLID)).toBe(true);
    const s = floatAt(b, 10 * T, 10 * T);
    expect(boxHits(b, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)).toBe(false);
  });

  it("refuse une zone mal écrite, hors de la grille, qui en chevauche une autre, une force hors bornes, une rafale hors section ou mal formée", () => {
    const bad = (line: string, more: string[] = []) => expect(() => hall([...more, line]), line).toThrow(LevelError);
    bad("vent 12-15 3-18 bas 100");
    bad("vent 12-15 3-18 haut");
    bad("vent 15-12 3-18 haut 100");
    bad("vent 12-45 3-18 haut 100");
    bad("vent 12-15 3-25 haut 100");
    bad("vent 12-15 3-18 haut 10");
    bad("vent 12-15 3-18 haut 250");
    bad("vent 12-15 3-18 haut 100 rafale 240 120 30"); // aucune section
    bad("vent 12-15 3-18 haut 100 rafale 240 240 0", ["section a 10-30"]);
    bad("vent 12-15 3-18 haut 100 rafale 240 0 0", ["section a 10-30"]);
    bad("vent 12-15 3-18 haut 100 rafale 240 10 240", ["section a 10-30"]);
    bad("vent 12-15 3-18 haut 100 rafale 1 1 0", ["section a 10-30"]);
    bad("vent 12-15 3-18 haut 100 souffle 240 10 0", ["section a 10-30"]);
    bad("vent 14-20 10-12 droite 100", ["vent 12-15 3-18 haut 100"]);
  });

  it("réglages absents des défauts : `isDefaultJumpParams` reste vrai, et faux dès qu'un réglage du vent change", () => {
    expect(isDefaultJumpParams(DEFAULT_JUMP_PARAMS)).toBe(true);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, ...WIND_DEFAULTS })).toBe(true);
    for (const k of ["windAccel", "windRise", "windDrift"] as const) expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, [k]: WIND_DEFAULTS[k] + 1 })).toBe(false);
    expect("windAccel" in DEFAULT_JUMP_PARAMS).toBe(false);
  });
});

describe("vent vers le haut", () => {
  const level = hall(["vent 10-20 2-20 haut 100"]);

  it("montée plafonnée à `windRise` : on part du sol, on monte, la vitesse ne dépasse jamais la montée", () => {
    let s = withPlayer(level, standAt(level, 15, 20));
    let fastest = 0;
    for (let t = 0; t < 120; t++) {
      s = step(s, 0, level);
      fastest = Math.min(fastest, s.player.vy);
    }
    expect(s.player.vy).toBe(-RISE);
    expect(fastest).toBe(-RISE);
    expect(s.player.y).toBeLessThan(standAt(level, 15, 20).y - 4 * T);
  });

  it("une chute est retournée : on entre en tombant à 12 tuiles/s, on remonte en moins d'un tiers de seconde", () => {
    let s = withPlayer(level, floatAt(level, 15 * T, 6 * T, 0, 410));
    let t = 0;
    while (s.player.vy >= 0) {
      s = step(s, 0, level);
      t++;
    }
    expect(t).toBeLessThan(40);
  });

  it("un saut monte plus vite que le vent : la gravité le freine jusqu'à la montée du vent, puis on plane", () => {
    let s = withPlayer(level, standAt(level, 15, 20));
    s = step(s, J, level);
    expect(s.player.vy).toBe(-DEFAULT_JUMP_PARAMS.jumpSpeed);
    for (let t = 0; t < 60; t++) s = step(s, J, level);
    expect(s.player.vy).toBe(-RISE);
  });

  it("la force est un pourcentage des réglages : 50 → montée moitié moins rapide", () => {
    const half = hall(["vent 10-20 2-20 haut 50"]);
    let s = withPlayer(half, standAt(half, 15, 20));
    for (let t = 0; t < 120; t++) s = step(s, 0, half);
    expect(s.player.vy).toBe(-Math.trunc(RISE / 2));
  });

  it("en sortant de la zone (par le haut), la vitesse acquise est gardée : la physique ordinaire reprend (gravité dès le pas suivant)", () => {
    const top = hall(["vent 10-20 12-20 haut 100"]);
    let s = withPlayer(top, standAt(top, 15, 20));
    let prev = s;
    while (windZoneOf(top, s) >= 0) {
      prev = s;
      s = step(s, 0, top);
    }
    // Le premier pas hors de la zone part de la vitesse acquise : seule la gravité s'y ajoute.
    const out = step(s, 0, top);
    expect(s.player.vy).toBe(-RISE);
    expect(out.player.vy).toBe(-RISE + DEFAULT_JUMP_PARAMS.gravity);
    expect(prev.player.vy).toBe(-RISE);
  });
});

describe("vent latéral", () => {
  const right = hall(["vent 1-40 1-20 droite 100"]);
  const left = hall(["vent 1-40 1-20 gauche 100"]);

  it("sans commande : on est emporté à `windDrift`", () => {
    let s = withPlayer(right, standAt(right, 10, 20));
    for (let t = 0; t < 60; t++) s = step(s, 0, right);
    expect(s.player.vx).toBe(DRIFT);
    let g = withPlayer(left, standAt(left, 30, 20));
    for (let t = 0; t < 60; t++) g = step(g, 0, left);
    expect(g.player.vx).toBe(-DRIFT);
  });

  it("avec la commande : course + dérive ; contre la commande : course − dérive (on avance moins vite)", () => {
    let a = withPlayer(right, standAt(right, 3, 20));
    for (let t = 0; t < 60; t++) a = step(a, R, right);
    expect(a.player.vx).toBe(P.runSpeed + DRIFT);
    let b = withPlayer(right, standAt(right, 35, 20));
    for (let t = 0; t < 60; t++) b = step(b, L, right);
    expect(b.player.vx).toBe(-(P.runSpeed - DRIFT));
  });

  it("en l'air aussi (au sol comme en l'air)", () => {
    let s = withPlayer(right, floatAt(right, 10 * T, 3 * T));
    for (let t = 0; t < 20; t++) s = step(s, 0, right);
    expect(s.player.ground).toBe(0);
    expect(s.player.vx).toBe(DRIFT);
  });

  it("en sortant de la zone, la vitesse acquise est gardée : la physique ordinaire reprend (le freinage ordinaire s'applique ensuite)", () => {
    const zone = hall(["vent 5-20 1-20 droite 100"]);
    let s = withPlayer(zone, standAt(zone, 6, 20));
    while (windZoneOf(zone, s) >= 0) s = step(s, R, zone);
    expect(s.player.vx).toBeGreaterThan(P.runSpeed);
    const v = s.player.vx;
    const out = step(s, R, zone);
    expect(out.player.vx).toBe(v - P.groundDecel);
  });

  it("le vent s'applique selon le centre du personnage au début du pas", () => {
    const zone = hall(["vent 20-20 20-20 gauche 100"]);
    const s = withPlayer(zone, standAt(zone, 20, 20));
    expect(windPush(zone, s)).toEqual({ dir: WIND_LEFT, force: 100 });
    const outside = withPlayer(zone, standAt(zone, 21, 20));
    expect(windPush(zone, outside)).toBeNull();
  });
});

describe("rafales", () => {
  const annex = ["section a 5-35", "vent 10-30 1-20 droite 100 rafale 120 40 10"];
  const level = hall(annex);

  it("`windBlows` : souffle `actif` pas sur `cycle`, décalé ; le cycle est exact", () => {
    const z = level.winds[0]!;
    const blows = Array.from({ length: 240 }, (_, p) => windBlows(z, p));
    expect(blows.filter(Boolean).length).toBe(80);
    for (let p = 0; p < 240; p++) expect(blows[p]).toBe((p + 10) % 120 < 40);
    for (let p = 0; p < 120; p++) expect(windBlows(z, p)).toBe(windBlows(z, p + 120));
  });

  it("l'horloge démarre à l'entrée de la section : avant, la phase reste 0 ; ensuite, elle compte les pas", () => {
    let s = withPlayer(level, standAt(level, 2, 20));
    s = { ...s, status: 0 };
    for (let t = 0; t < 10; t++) s = step(s, R, level);
    expect(s.sections[0]).toBe(-1);
    expect(windPhase(level, s, 0)).toBe(0);
    while (s.sections[0]! < 0) s = step(s, R, level);
    const start = s.sections[0]!;
    for (let t = 0; t < 50; t++) {
      expect(windPhase(level, s, 0)).toBe(s.time - start);
      expect(windActive(level, s, 0)).toBe((s.time - start + 10) % 120 < 40);
      s = step(s, R, level);
    }
  });

  it("dans la zone, la poussée suit la rafale au pas près (vitesse qui monte pendant le souffle, freinée hors du souffle)", () => {
    // Personnage posé dans la zone, la section en marche depuis le pas 1 : sans commande, il dérive pendant le souffle puis s'arrête.
    let s: AttemptState = { ...withPlayer(level, standAt(level, 12, 20)), sections: [0], time: 0 };
    const seen: boolean[] = [];
    for (let t = 0; t < 240; t++) {
      const blowing = windActive(level, s, 0);
      const before = s.player.vx;
      s = step(s, 0, level);
      seen.push(blowing);
      if (blowing) expect(s.player.vx).toBeGreaterThanOrEqual(before);
      else expect(s.player.vx).toBeLessThanOrEqual(before);
    }
    expect(seen.filter(Boolean).length).toBe(80);
  });

  it("la mort remet l'horloge à zéro : l'essai repart de l'état initial exact", () => {
    const deadly = lv(
      [
        "##########################",
        "#........................#",
        "#........................#",
        "#S......^^^^^^..........F#",
        "##########################",
      ],
      ["section a 3-20", "vent 3-20 1-3 droite 100 rafale 90 30 0"],
    );
    let s = initialAttempt(deadly);
    let t = 0;
    while (s.status !== ATTEMPT_DEAD && t < 2000) {
      s = step(s, R, deadly);
      t++;
    }
    expect(s.status).toBe(ATTEMPT_DEAD);
    expect(s.sections[0]).toBeGreaterThan(0);
    for (let k = 0; k < 18; k++) s = step(s, 0, deadly);
    expect(s).toEqual(initialAttempt(deadly));
    expect(windPhase(deadly, s, 0)).toBe(0);
  });

  it("avec un point de passage, la reprise remet l'horloge de la section du point (et d'après) à zéro", () => {
    const cp = lv(
      [
        "##############################",
        "#............................#",
        "#............................#",
        "#S...C.........^^^^.........F#",
        "##############################",
      ],
      ["section a 1-4", "section b 5-28", "vent 6-26 1-3 droite 100 rafale 90 30 0"],
    );
    let s = initialAttempt(cp);
    while (s.status !== ATTEMPT_DEAD) s = step(s, R, cp);
    expect(s.checkpoint).toBe(0);
    for (let k = 0; k < 18; k++) s = step(s, 0, cp);
    expect(s.status).toBe(1);
    expect(s.sections[1]).toBe(-1);
    expect(windPhase(cp, s, 0)).toBe(0);
  });
});

describe("intégrité (fuzz) sur des niveaux avec vent constant et rafales", () => {
  const WINDY = [
    "##############################",
    "#............................#",
    "#............................#",
    "#.......####.................#",
    "#............................#",
    "#...]]].......~~~.....##.....#",
    "#............................#",
    "#S....C.......^^.....x......F#",
    "##############################",
  ];
  const windy = lv(WINDY, [
    "section a 1-12",
    "section b 13-28",
    "vent 2-8 1-6 haut 100",
    "vent 9-12 1-7 droite 160",
    "vent 13-20 1-7 gauche 100 rafale 150 60 20",
    "vent 21-28 1-7 haut 200 rafale 90 45 0",
  ]);

  function assertSound(s: AttemptState, where: string): void {
    const check = (k: string, v: unknown) => {
      if (typeof v !== "number" || !Number.isInteger(v) || Object.is(v, -0)) throw new Error(`${where} : ${k} = ${String(v)} (entier sans −0 attendu)`);
    };
    for (const [k, v] of Object.entries(s)) {
      if (k === "player") for (const [pk, pv] of Object.entries(v as object)) check(`player.${pk}`, pv);
      else if (k === "tiles") (v as number[]).forEach((t, i) => check(`tiles[${i}]`, t));
      else if (Array.isArray(v)) v.forEach((x, i) => check(`${k}[${i}]`, x));
      else check(k, v);
    }
    const p = s.player;
    if (Math.abs(p.vx) > MAX_SPEED || Math.abs(p.vy) > MAX_SPEED) throw new Error(`${where} : vitesse ${p.vx}, ${p.vy}`);
    if (s.status !== ATTEMPT_DEAD && boxHits({ width: windy.width, height: windy.height, tiles: s.tiles }, p.x, p.y, PLAYER_WIDTH, PLAYER_HEIGHT)) throw new Error(`${where} : la boîte est dans un bloc plein`);
  }

  it("des dizaines de milliers de pas de commandes au hasard : tout entier, sans −0, sous MAX_SPEED, jamais dans un bloc", () => {
    const rng = new Rng(20261013);
    let total = 0;
    let pushed = 0;
    for (let run = 0; run < 30; run++) {
      let s = initialAttempt(windy);
      let input = 0;
      let left = 0;
      for (let t = 0; t < 2500; t++) {
        if (left-- <= 0) {
          input = rng.int(8);
          left = rng.int(40);
        }
        if (windPush(windy, s)) pushed++;
        s = step(s, input, windy);
        assertSound(s, `essai ${run}, pas ${t}`);
        total++;
      }
    }
    expect(total).toBe(75_000);
    expect(pushed).toBeGreaterThan(5000); // le fuzz passe bien dans le vent
  });

  it("réglages au hasard (vent compris, jusqu'à des valeurs démesurées) : même intégrité", () => {
    const rng = new Rng(1313);
    const base: JumpParams = { ...P, ...WIND_DEFAULTS };
    const keys = Object.keys(base) as (keyof JumpParams)[];
    for (let run = 0; run < 25; run++) {
      const params: JumpParams = { ...base };
      for (const k of keys) params[k] = rng.chance(10) ? rng.int(5000) : rng.int(3 * base[k]! + 2);
      let s = initialAttempt(windy);
      let input = 0;
      let left = 0;
      for (let t = 0; t < 1500; t++) {
        if (left-- <= 0) {
          input = rng.int(8);
          left = rng.int(40);
        }
        s = stepAttempt(s, input, windy, params);
        assertSound(s, `réglages ${run}, pas ${t}`);
      }
    }
  });

  it("hors de toute zone, `stepPlayerJump` sans vent et avec `null` donnent le même état au bit près que `stepPlayer`", () => {
    const rng = new Rng(9);
    let s = initialAttempt(windy).player;
    for (let t = 0; t < 3000; t++) {
      const input = rng.int(8);
      const a = stepPlayer(s, input, windy, P);
      const b = stepPlayerJump(s, input, windy, P, null, null);
      expect(b).toEqual(a);
      s = a;
    }
  });
});
