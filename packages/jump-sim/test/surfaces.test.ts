import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_MASK,
  MAX_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SURFACE_DEFAULTS,
  TILE_BELT_LEFT,
  TILE_BELT_RIGHT,
  TILE_ICE,
  boxHits,
  groundTile,
  initialAttempt,
  initialPlayer,
  isDefaultJumpParams,
  isSolidTile,
  stepAttempt,
  stepPlayer,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { J, L, P, R, T, hold, level, standAt } from "./helpers";

// Lot 11 — les tapis roulants (`[` gauche, `]` droite) et la glace (`~`) : seule la face du dessus agit ; vitesses en unités/pas.

const BELT = P.runSpeed + SURFACE_DEFAULTS.beltSpeed;

/** Une longue piste de 60 colonnes : sol en bas ; `floor` donne le revêtement de la rangée du sol. */
function strip(floor: string, headroom = 8): Level {
  const w = floor.length + 2;
  const rows: string[] = [];
  for (let r = 0; r < headroom; r++) rows.push(`#${".".repeat(w - 2)}#`);
  rows[headroom - 1] = `#S${".".repeat(w - 4)}F#`;
  rows.push(`#${floor}#`);
  rows.push("#".repeat(w));
  return level(rows);
}

const row = (lv: Level) => lv.height - 3 + 1; // rangée du personnage : juste au-dessus du sol (rangée height − 2)

describe("tuiles", () => {
  it("les trois caractères sont des blocs pleins (murs et sol normaux)", () => {
    const lv = level(["#####", "#S.F#", "#[]~#", "#####"]);
    expect(lv.tiles.slice(2 * 5 + 1, 2 * 5 + 4)).toEqual([TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE]);
    for (const t of [TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE]) expect(isSolidTile(t)).toBe(true);
  });

  it("groundTile : la tuile sous les pieds (centre d'abord), 0 en l'air", () => {
    const lv = strip("###]]]~~~");
    const r = lv.height - 3;
    expect(groundTile(lv, standAt(lv, 5, r).x, standAt(lv, 5, r).y)).toBe(TILE_BELT_RIGHT);
    expect(groundTile(lv, standAt(lv, 8, r).x, standAt(lv, 8, r).y)).toBe(TILE_ICE);
    const s = standAt(lv, 2, r);
    expect(groundTile(lv, s.x, s.y - 3 * T)).toBe(0);
    // À cheval sur deux tuiles : celle de la colonne du centre.
    expect(groundTile(lv, 4 * T + T - 1536 - 10, s.y)).toBe(TILE_BELT_RIGHT);
  });

  it("réglages absents des défauts : `isDefaultJumpParams` reste vrai, et faux dès qu'un réglage de surface change", () => {
    expect(isDefaultJumpParams(DEFAULT_JUMP_PARAMS)).toBe(true);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, beltSpeed: SURFACE_DEFAULTS.beltSpeed })).toBe(true);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, beltSpeed: 100 })).toBe(false);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, iceAccel: 9 })).toBe(false);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, iceDecel: 9 })).toBe(false);
  });
});

describe("tapis roulants", () => {
  const lv = strip("]".repeat(50));
  const r = lv.height - 3;
  const start = () => standAt(lv, 3, r);

  it("avec le tapis : vitesse de course + beltSpeed", () => {
    const s = hold(start(), R, 60, lv);
    expect(s.vx).toBe(BELT);
  });

  it("contre le tapis : plus lent (course − beltSpeed), jamais à l'arrêt", () => {
    const s = hold(standAt(strip("[".repeat(50)), 40, r), R, 60, strip("[".repeat(50)));
    expect(s.vx).toBe(P.runSpeed - SURFACE_DEFAULTS.beltSpeed);
    expect(s.vx).toBeGreaterThan(0);
  });

  it("immobile sur un tapis : on est emporté à la vitesse du tapis", () => {
    const s1 = hold(start(), 0, 40, lv);
    expect(s1.vx).toBe(SURFACE_DEFAULTS.beltSpeed);
    expect(s1.x).toBeGreaterThan(start().x);
    const left = strip("[".repeat(50));
    const s2 = hold(standAt(left, 40, r), 0, 40, left);
    expect(s2.vx).toBe(-SURFACE_DEFAULTS.beltSpeed);
  });

  it("beltSpeed 0 : un tapis ne fait rien de plus qu'un sol ordinaire", () => {
    const p: JumpParams = { ...P, beltSpeed: 0 };
    expect(hold(start(), R, 60, lv, p).vx).toBe(P.runSpeed);
    expect(hold(start(), 0, 60, lv, p).vx).toBe(0);
  });

  it("en quittant le tapis par un saut : la vitesse acquise est gardée en l'air (le saut est plus long), sans commande aussi", () => {
    const flat = strip("#".repeat(50));
    const jump = (lvl: Level) => {
      let s = hold(standAt(lvl, 3, r), R, 60, lvl);
      s = stepPlayer(s, R | J, lvl, P);
      let air = 0;
      while (s.ground === 0 && air < 200) {
        s = stepPlayer(s, R | J, lvl, P);
        air++;
      }
      return { x: s.x, vx: s.vx, air };
    };
    const onBelt = jump(lv);
    const onFloor = jump(flat);
    expect(onBelt.x).toBeGreaterThan(onFloor.x + 3 * T / 2);
    // Sans rien tenir en l'air (ni direction) : la vitesse du tapis est conservée jusqu'à l'atterrissage.
    let s = hold(standAt(lv, 3, r), R, 60, lv);
    s = stepPlayer(s, R | J, lv, P);
    const v0 = s.vx;
    expect(s.carry).toBe(1);
    for (let i = 0; i < 20; i++) s = stepPlayer(s, 0, lv, P);
    expect(s.ground).toBe(0);
    expect(s.vx).toBe(v0);
    // Sur sol ordinaire, la même vitesse en l'air fondrait (freinage en l'air) : la différence est bien le report du tapis.
    let f = hold(standAt(flat, 3, r), R, 60, flat);
    f = stepPlayer(f, R | J, flat, P);
    for (let i = 0; i < 20; i++) f = stepPlayer(f, 0, flat, P);
    expect(f.vx).toBeLessThan(P.runSpeed);
  });

  it("en l'air, on peut encore freiner contre la vitesse acquise ; un mur l'arrête ; atterrir hors tapis l'efface", () => {
    let s = hold(standAt(lv, 3, r), R, 60, lv);
    s = stepPlayer(s, R | J, lv, P);
    const v0 = s.vx;
    for (let i = 0; i < 10; i++) s = stepPlayer(s, L, lv, P);
    expect(s.vx).toBeLessThan(v0);
    const mixed = strip("]]]]]]]]]]" + "#".repeat(40));
    let m = hold(standAt(mixed, 3, r), R, 60, mixed);
    expect(m.carry).toBe(1);
    m = hold(m, R, 120, mixed);
    expect(m.ground).toBe(1);
    expect(m.carry).toBeUndefined();
    expect(m.vx).toBe(P.runSpeed);
  });

  it("jamais au-dessus de MAX_SPEED, même avec un tapis extrême", () => {
    const p: JumpParams = { ...P, beltSpeed: 5000 };
    const s = hold(start(), R, 200, lv, p);
    expect(s.vx).toBeLessThanOrEqual(MAX_SPEED);
  });

  it("les murs d'un tapis sont ordinaires : on y glisse et on y saute comme contre un bloc", () => {
    const wall = level(["#########", "#.......#", "#.......#", "#.......#", "#.......#", "#]......#", "#]S...F.#", "#########"]);
    // Le personnage contre le mur gauche (un tapis) : glisse murale en tombant, saut mural possible.
    let s = { ...standAt(wall, 1, 3), vx: 0 };
    s = { ...s, x: 1 * T, ground: 0, air: 255, vy: 200 };
    s = hold(s, L, 5, wall);
    expect(s.slide).toBe(-1);
    s = stepPlayer(s, L | J, wall, P);
    expect(s.vx).toBeGreaterThan(0);
    expect(s.vy).toBeLessThan(0);
  });
});

describe("glace", () => {
  const ice = strip("~".repeat(50));
  const flat = strip("#".repeat(50));
  const r = ice.height - 3;

  it("accélération réduite : bien plus de pas pour atteindre la course, la même vitesse maximale", () => {
    const ticksToRun = (lvl: Level) => {
      let s = standAt(lvl, 3, r);
      let n = 0;
      while (s.vx < P.runSpeed && n < 1000) {
        s = stepPlayer(s, R, lvl, P);
        n++;
      }
      return { n, vx: s.vx };
    };
    const a = ticksToRun(flat);
    const b = ticksToRun(ice);
    expect(a.vx).toBe(P.runSpeed);
    expect(b.vx).toBe(P.runSpeed);
    expect(b.n).toBeGreaterThanOrEqual(a.n * 3);
    expect(b.n).toBe(Math.ceil(P.runSpeed / SURFACE_DEFAULTS.iceAccel));
  });

  it("freinage réduit : on glisse longtemps sans commande", () => {
    const stopTicks = (lvl: Level) => {
      let s = hold(standAt(lvl, 3, r), R, 200, lvl);
      expect(s.vx).toBe(P.runSpeed);
      let n = 0;
      while (s.vx !== 0 && n < 1000) {
        s = stepPlayer(s, 0, lvl, P);
        n++;
      }
      return n;
    };
    expect(stopTicks(flat)).toBe(Math.ceil(P.runSpeed / P.groundDecel));
    expect(stopTicks(ice)).toBe(Math.ceil(P.runSpeed / SURFACE_DEFAULTS.iceDecel));
  });

  it("le demi-tour est lent aussi, et la vitesse n'excède jamais la course", () => {
    let s = hold(standAt(ice, 3, r), R, 200, ice);
    s = hold(s, L, 20, ice);
    expect(s.vx).toBeGreaterThan(0);
    for (let i = 0; i < 400 && s.vx > -P.runSpeed; i++) {
      s = stepPlayer(s, L, ice, P);
      expect(Math.abs(s.vx)).toBeLessThanOrEqual(P.runSpeed);
    }
  });

  it("les réglages iceAccel / iceDecel agissent ; au maximum, la glace se comporte comme le sol", () => {
    const p: JumpParams = { ...P, iceAccel: P.groundAccel, iceDecel: P.groundDecel };
    expect(hold(standAt(ice, 3, r), R, 23, ice, p)).toEqual(hold(standAt(flat, 3, r), R, 23, flat, p));
  });

  it("les murs de glace sont normaux : glisse murale et saut mural", () => {
    const wall = level(["#########", "#.......#", "#.......#", "#.......#", "#.......#", "#~......#", "#~S...F.#", "#########"]);
    let s = { ...standAt(wall, 1, 3), x: 1 * T, ground: 0, air: 255, vy: 200, vx: 0 };
    s = hold(s, L, 5, wall);
    expect(s.slide).toBe(-1);
    s = stepPlayer(s, L | J, wall, P);
    expect(s.vx).toBe(P.wallJumpX);
  });
});

describe("intégrité (fuzz) sur un niveau qui contient les deux surfaces", () => {
  const lv = level([
    "################################",
    "#..............................#",
    "#..............................#",
    "#...........................F..#",
    "#.....................##########",
    "#S..........####...............#",
    "#[[]]~~~~##########[[[[]]]]~~~~#",
    "################################",
  ]);
  const sound = (s: PlayerState, where: string) => {
    for (const [k, v] of Object.entries(s)) if (!Number.isInteger(v) || Object.is(v, -0)) throw new Error(`${where} : ${k} = ${String(v)}`);
    if (Math.abs(s.vx) > MAX_SPEED || Math.abs(s.vy) > MAX_SPEED) throw new Error(`${where} : vitesse`);
    if (boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)) throw new Error(`${where} : dans un mur`);
    if (s.carry !== undefined && s.carry !== 1 && s.carry !== -1) throw new Error(`${where} : carry ${s.carry}`);
  };

  it("commandes aléatoires, réglages par défaut puis au hasard : état entier, pas de −0, sous MAX_SPEED, hors des murs", () => {
    const rng = new Rng(20261016);
    let total = 0;
    for (let run = 0; run < 60; run++) {
      const p: JumpParams = run < 20 ? { ...P } : { ...P, beltSpeed: rng.chance(10) ? rng.int(4000) : rng.int(400), iceAccel: rng.int(30), iceDecel: rng.int(60) };
      let s = initialPlayer(lv);
      let a = initialAttempt(lv);
      let input = 0;
      let left = 0;
      for (let t = 0; t < 1500; t++) {
        if (left-- <= 0) {
          input = rng.int(INPUT_MASK + 1);
          left = rng.int(40);
        }
        s = stepPlayer(s, input, lv, p);
        sound(s, `essai ${run}, pas ${t}`);
        a = stepAttempt(a, input, lv, p);
        sound(a.player, `tentative ${run}, pas ${t}`);
        total++;
      }
    }
    expect(total).toBe(90_000);
  });
});
