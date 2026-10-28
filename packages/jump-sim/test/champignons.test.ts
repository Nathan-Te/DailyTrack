import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  MAX_SPEED,
  MUSHROOM_BOOST_PERCENT,
  MUSHROOM_DOWN,
  MUSHROOM_DOWN_SPEED,
  MUSHROOM_GENERATOR,
  MUSHROOM_LEFT,
  MUSHROOM_RIGHT,
  MUSHROOM_RISE_SPEED,
  MUSHROOM_SAFE_TICKS,
  MUSHROOM_SIDE_SPEED,
  MUSHROOM_UP,
  MUSHROOM_UP_SPEED,
  MUSHROOM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  MODULES,
  PREMIER_JOUR_JUMP,
  PRESS_GENERATOR,
  PRESS_VERSION,
  SLOW_MIN_EXIGENCE,
  UNITS_PER_TILE,
  buildModule,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  freezeLevel,
  frozenJson,
  fromRuns,
  initialAttempt,
  jumpThemeForDay,
  moduleSolutions,
  moduleStart,
  mushroomContacts,
  mushroomModuleIds,
  mushroomPieceProblems,
  palierProblems,
  respawnProblems,
  thawLevel,
  variantExigence,
  isSolidTile,
  mushroomBounce,
  mushroomPad,
  mushroomProblems,
  mushroomSweepProblems,
  parseLevel,
  stepAttempt,
  type AttemptState,
  type Level,
  V11_ONLY_VARIANTS,
} from "../src/index";

// Lot 23 : les champignons rebonds (sim v7, générateur g17). Les niveaux sont de petits textes écrits ici ; les morceaux du catalogue sont dans `foret.test.ts`.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;

/**
 * Une salle de 24 colonnes sur 14 rangées : plafond plein (rangée 0), sol plein (rangées 12-13), murs aux colonnes 0 et 23. `extra` pose des caractères
 * `[col, rangée, caractère]` dans l'intérieur.
 */
function room(extra: [number, number, string][] = [], annex: string[] = ["version 7", "section salle 0-23"]): Level {
  const rows: string[][] = [];
  for (let r = 0; r < 14; r++) rows.push(("#" + ".".repeat(22) + "#").split(""));
  rows[0] = "#".repeat(24).split("");
  rows[12] = "#".repeat(24).split("");
  rows[13] = "#".repeat(24).split("");
  rows[11]![1] = "S";
  rows[11]![22] = "F";
  for (const [c, r, ch] of extra) rows[r]![c] = ch;
  return parseLevel(rows.map((r) => r.join("")).join("\n") + "\n\n" + annex.join("\n") + "\n");
}

/** Un état en course, le personnage en l'air à (x, y) (unités), de vitesse (vx, vy). */
function floating(level: Level, x: number, y: number, vx: number, vy: number): AttemptState {
  const s = initialAttempt(level);
  return { ...s, status: 1, time: 5, player: { ...s.player, x, y, vx, vy, ground: 0, air: 255, held: 0 } };
}
const step = (s: AttemptState, bits: number, level: Level) => stepAttempt(s, bits, level, P);
const GROUND_Y = 12 * T - PLAYER_HEIGHT;

describe("lot 23 — la version de la simulation", () => {
  it("la version 7 est celle des champignons, le générateur g17", () => {
    expect(JUMP_SIM_VERSION).toBeGreaterThanOrEqual(7); // lot 24 : la version 8 (stalactites) garde la 7
    expect(MUSHROOM_VERSION).toBe(7);
    expect(JUMP_GENERATOR_VERSION).toBeGreaterThanOrEqual(17); // lot 24 : g18 (stalactites) garde g17
    expect(MUSHROOM_GENERATOR).toBe(17);
    expect(room().simVersion).toBe(7);
  });
});

describe("lot 23 — lecture de la grille", () => {
  it("m w ) ( sont des champignons : tuiles vides dans la grille, jamais solides", () => {
    const L = room([[5, 11, "m"], [8, 1, "w"], [1, 6, ")"], [22, 6, "("]]);
    expect(L.mushrooms).toEqual([
      { col: 8, row: 1, dir: MUSHROOM_DOWN },
      { col: 1, row: 6, dir: MUSHROOM_RIGHT },
      { col: 22, row: 6, dir: MUSHROOM_LEFT },
      { col: 5, row: 11, dir: MUSHROOM_UP },
    ]);
    for (const m of L.mushrooms) expect(isSolidTile(L.tiles[m.row * L.width + m.col]!)).toBe(false);
  });

  it("un niveau sans champignon n'en a pas", () => {
    expect(room().mushrooms).toEqual([]);
  });

  it("la zone de contact est la moitié de la tuile du côté du chapeau", () => {
    expect(mushroomPad({ col: 3, row: 4, dir: MUSHROOM_UP })).toEqual({ x: 3 * T, y: 4 * T, w: T, h: T / 2 });
    expect(mushroomPad({ col: 3, row: 4, dir: MUSHROOM_DOWN })).toEqual({ x: 3 * T, y: 4 * T + T / 2, w: T, h: T / 2 });
    expect(mushroomPad({ col: 3, row: 4, dir: MUSHROOM_RIGHT })).toEqual({ x: 3 * T + T / 2, y: 4 * T, w: T / 2, h: T });
    expect(mushroomPad({ col: 3, row: 4, dir: MUSHROOM_LEFT })).toEqual({ x: 3 * T, y: 4 * T, w: T / 2, h: T });
  });
});

describe("lot 23 — l'impulsion est exacte pour les quatre orientations", () => {
  const FLOOR = room([[10, 11, "m"]]);
  const CEILING = room([[10, 1, "w"]]);
  const WALL_L = room([[1, 6, ")"]]); // contre le mur de gauche : le chapeau regarde vers la droite
  const WALL_R = room([[22, 6, "("]]); // contre le mur de droite : vers la gauche

  /** Le pas où la boîte arrive sur le chapeau : `from` juste avant, la commande `bits` à ce pas. */
  const bounce = (L: Level, s: AttemptState, bits = 0) => step(s, bits, L).player;

  it("sol : vers le haut, plus haut qu'un saut normal ; la vitesse horizontale est conservée", () => {
    const s = floating(FLOOR, 10 * T + 500, 11 * T - PLAYER_HEIGHT - 10, 123, 100);
    const p = bounce(FLOOR, s);
    expect(p.vy).toBe(-MUSHROOM_UP_SPEED);
    expect(MUSHROOM_UP_SPEED).toBeGreaterThan(DEFAULT_JUMP_PARAMS.jumpSpeed);
    expect(p.ground).toBe(0);
    expect(p.jumping).toBe(0);
  });

  it("plafond : vers le bas", () => {
    const s = floating(CEILING, 10 * T + 500, 2 * T + 100, 0, -300);
    const p = bounce(CEILING, s);
    expect(p.vy).toBe(MUSHROOM_DOWN_SPEED);
  });

  it("mur à gauche : vers la droite, avec une légère montée", () => {
    const s = floating(WALL_L, 2 * T + 100, 6 * T, -300, 0);
    const p = bounce(WALL_L, s);
    expect(p.vx).toBe(MUSHROOM_SIDE_SPEED);
    expect(p.vy).toBe(-MUSHROOM_RISE_SPEED);
  });

  it("mur à droite : vers la gauche, avec une légère montée", () => {
    const s = floating(WALL_R, 22 * T - PLAYER_WIDTH - 100, 6 * T, 300, 0);
    const p = bounce(WALL_R, s);
    expect(p.vx).toBe(-MUSHROOM_SIDE_SPEED);
    expect(p.vy).toBe(-MUSHROOM_RISE_SPEED);
  });

  it("un saut tenu au contact renforce le rebond (×1,3, constante de la simulation) dans les quatre orientations", () => {
    expect(MUSHROOM_BOOST_PERCENT).toBe(130);
    const k = (v: number) => Math.trunc((v * MUSHROOM_BOOST_PERCENT) / 100);
    expect(bounce(FLOOR, floating(FLOOR, 10 * T + 500, 11 * T - PLAYER_HEIGHT - 10, 0, 100), INPUT_JUMP).vy).toBe(-k(MUSHROOM_UP_SPEED));
    expect(bounce(CEILING, floating(CEILING, 10 * T + 500, 2 * T + 100, 0, -300), INPUT_JUMP).vy).toBe(k(MUSHROOM_DOWN_SPEED));
    const l = bounce(WALL_L, floating(WALL_L, 2 * T + 100, 6 * T, -300, 0), INPUT_JUMP);
    expect([l.vx, l.vy]).toEqual([k(MUSHROOM_SIDE_SPEED), -k(MUSHROOM_RISE_SPEED)]);
    const r = bounce(WALL_R, floating(WALL_R, 22 * T - PLAYER_WIDTH - 100, 6 * T, 300, 0), INPUT_JUMP);
    expect([r.vx, r.vy]).toEqual([-k(MUSHROOM_SIDE_SPEED), -k(MUSHROOM_RISE_SPEED)]);
    // Le renforcé est nettement plus haut : 1 170 contre 900.
    expect(k(MUSHROOM_UP_SPEED)).toBeGreaterThan(MUSHROOM_UP_SPEED);
  });

  it("un saut relâché au contact ne renforce pas, un saut tenu avant le contact mais relâché à ce pas non plus", () => {
    const s = floating(FLOOR, 10 * T + 500, 11 * T - PLAYER_HEIGHT - 10, 0, 100);
    const held = { ...s, player: { ...s.player, held: 1 } };
    expect(bounce(FLOOR, held, 0).vy).toBe(-MUSHROOM_UP_SPEED);
    expect(bounce(FLOOR, held, INPUT_JUMP).vy).toBeLessThan(-MUSHROOM_UP_SPEED);
  });

  it("le rebond ne se coupe pas : relâcher le saut après le contact ne ramène pas la montée à la coupe d'un petit saut", () => {
    const s = floating(FLOOR, 10 * T + 500, 11 * T - PLAYER_HEIGHT - 10, 0, 100);
    let a = step(s, INPUT_JUMP, FLOOR);
    a = step(a, 0, FLOOR);
    expect(a.player.vy).toBeLessThan(-DEFAULT_JUMP_PARAMS.jumpSpeed); // une coupe donnerait −340
  });
});

describe("lot 23 — la vitesse parallèle à la surface est conservée", () => {
  it("sol et plafond : la vitesse horizontale est exactement celle que le pas lui a donnée (rien ne la remplace)", () => {
    for (const [L, y, vy] of [
      [room([[10, 11, "m"]]), 11 * T - PLAYER_HEIGHT - 10, 100],
      [room([[10, 1, "w"]]), 2 * T + 100, -300],
    ] as const) {
      for (const vx of [-375, -120, 0, 90, 375]) {
        const s = floating(L, 10 * T + 500, y, vx, vy);
        // La même chose sans champignon (la tuile du champignon vide) : la vitesse horizontale est celle du pas ordinaire.
        const plain = room([], ["version 7", "section salle 0-23"]);
        expect(step(s, 0, L).player.vx).toBe(step({ ...s }, 0, plain).player.vx);
        expect(step(s, INPUT_RIGHT, L).player.vx).toBe(step({ ...s }, INPUT_RIGHT, plain).player.vx);
      }
    }
  });

  it("mur : la vitesse verticale est conservée quand elle monte déjà au moins autant que la légère montée, sinon elle devient cette montée", () => {
    const rising = mushroomBounce({ ...initialAttempt(room()).player, vx: -300, vy: -800 }, MUSHROOM_RIGHT, false);
    expect(rising.vy).toBe(-800);
    const falling = mushroomBounce({ ...initialAttempt(room()).player, vx: -300, vy: 600 }, MUSHROOM_RIGHT, false);
    expect(falling.vy).toBe(-MUSHROOM_RISE_SPEED);
    const slight = mushroomBounce({ ...initialAttempt(room()).player, vx: 300, vy: -100 }, MUSHROOM_LEFT, false);
    expect(slight.vy).toBe(-MUSHROOM_RISE_SPEED);
    // Au sol, au plafond : la vitesse horizontale n'est pas touchée par `mushroomBounce`.
    for (const dir of [MUSHROOM_UP, MUSHROOM_DOWN]) {
      expect(mushroomBounce({ ...initialAttempt(room()).player, vx: -212, vy: 5 }, dir, true).vx).toBe(-212);
    }
  });
});

describe("lot 23 — ni une tuile solide ni un danger", () => {
  it("on le traverse : un champignon de mur n'arrête pas un personnage qui le longe, et on ne meurt jamais dessus", () => {
    const L = room([[10, 11, "m"]]);
    // Debout à côté, un pas de course vers lui : la boîte entre dans sa tuile sans que rien ne l'arrête (le rebond la fait monter).
    let s = initialAttempt(L);
    s = { ...s, status: 1, time: 1, player: { ...s.player, x: 9 * T + 300, y: GROUND_Y, ground: 1, air: 0 } };
    for (let i = 0; i < 60; i++) {
      s = step(s, INPUT_RIGHT, L);
      expect(s.status).not.toBe(ATTEMPT_DEAD);
    }
    expect(s.player.x).toBeGreaterThan(10 * T); // il est passé dans la colonne du champignon
  });

  it("la tuile d'un champignon est vide dans la grille et dans `tiles` d'un essai", () => {
    const L = room([[10, 11, "m"]]);
    expect(isSolidTile(initialAttempt(L).tiles[11 * L.width + 10]!)).toBe(false);
  });
});

describe("lot 23 — le contact", () => {
  it("rebondit à l'arrivée sur le chapeau, une seule fois tant que la boîte le chevauche", () => {
    const L = room([[10, 11, "m"]]);
    const s = floating(L, 10 * T + 500, 11 * T - PLAYER_HEIGHT - 10, 0, 100);
    const a = step(s, 0, L);
    expect(a.player.vy).toBe(-MUSHROOM_UP_SPEED);
    // Les pas suivants : la boîte chevauche encore le chapeau, aucun nouveau rebond ; la vitesse suit la gravité.
    const b = step(a, 0, L);
    expect(b.player.vy).toBe(-MUSHROOM_UP_SPEED + DEFAULT_JUMP_PARAMS.gravity);
  });

  it("marcher dessus : le personnage qui entre dans la tuile du champignon est lancé", () => {
    const L = room([[10, 11, "m"]]);
    let s = initialAttempt(L);
    s = { ...s, status: 1, time: 1, player: { ...s.player, x: 9 * T + 300, y: GROUND_Y, ground: 1, air: 0 } };
    let bounced = -1;
    for (let i = 0; i < 80 && bounced < 0; i++) {
      s = step(s, INPUT_RIGHT, L);
      if (s.player.vy < -MUSHROOM_UP_SPEED + 100) bounced = i;
    }
    expect(bounced).toBeGreaterThanOrEqual(0);
  });

  it("de côté, sans toucher le chapeau (au-dessus de lui, ou à côté de sa tuile) : rien ne se passe", () => {
    const L = room([[10, 5, ")"]]); // contre le mur ? non : dans le vide, la tuile (10,5) — le contact ne dépend que de la zone
    const s = floating(L, 12 * T, 5 * T, 0, 0);
    expect(step(s, 0, L).player.vy).toBe(DEFAULT_JUMP_PARAMS.gravity);
  });

  it("le premier champignon touché au même pas l'emporte (ordre de la grille)", () => {
    const L = room([[10, 11, "m"], [11, 11, "m"]]);
    const s = floating(L, 10 * T + 3500, 11 * T - PLAYER_HEIGHT - 10, 0, 100); // à cheval sur les deux tuiles
    expect(step(s, 0, L).player.vy).toBe(-MUSHROOM_UP_SPEED);
  });
});

describe("lot 23 — un niveau sans champignon est identique en v6 et en v7", () => {
  it("mêmes états au pas près pendant 4 000 pas de commandes aléatoires, aucun champ de plus", () => {
    const annex = (v: number) => [`version ${v}`, "section salle 0-23", "scie s 0.75 360 aller-retour 6,8 14,8", "presse p 2 17,3 3 180 30 60 150"];
    const a = room([], annex(PRESS_VERSION));
    const b = room([], annex(MUSHROOM_VERSION));
    expect(a.simVersion).toBe(6);
    expect(b.simVersion).toBe(7);
    const rng = new Rng(0x1234);
    let sa = initialAttempt(a);
    let sb = initialAttempt(b);
    for (let i = 0; i < 4000; i++) {
      const bits = rng.int(8);
      sa = stepAttempt(sa, bits, a, P);
      sb = stepAttempt(sb, bits, b, P);
      expect(sb).toEqual(sa);
      expect(Object.keys(sb)).toEqual(Object.keys(sa));
    }
  });
});

describe("lot 23 — intégrité (fuzz)", () => {
  it("avec des champignons de toutes les orientations, tout reste entier, sans −0, sous MAX_SPEED, hors des blocs", () => {
    const L = room([[6, 11, "m"], [14, 11, "m"], [9, 1, "w"], [1, 5, ")"], [22, 8, "("], [1, 9, ")"], [18, 11, "m"]]);
    for (const seed of [1, 2, 3]) {
      const rng = new Rng(seed * 7919);
      let s = initialAttempt(L);
      let bounces = 0;
      for (let i = 0; i < 6000; i++) {
        const bits = rng.int(8);
        const before = s.player;
        s = stepAttempt(s, bits, L, P);
        if (s.status === ATTEMPT_DEAD) break;
        const p = s.player;
        for (const v of [p.x, p.y, p.vx, p.vy, p.air, p.wallAir, p.buffer, p.held, p.jumping, p.ground]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(Object.is(v, -0)).toBe(false);
        }
        expect(Math.abs(p.vx)).toBeLessThanOrEqual(MAX_SPEED);
        expect(Math.abs(p.vy)).toBeLessThanOrEqual(MAX_SPEED);
        expect(p.x).toBeGreaterThanOrEqual(T);
        expect(p.x + PLAYER_WIDTH).toBeLessThanOrEqual(23 * T);
        if (p.vy < before.vy - 600 || Math.abs(p.vx - before.vx) > 300) bounces++;
      }
      expect(bounces).toBeGreaterThan(0);
    }
  }, 60_000); // lot 24 : 5 s ne suffisent plus sous la charge d'une part de CI (rouge à la vérification locale en parallèle, vert seul)
});

describe("lot 23 — règles du générateur", () => {
  it("un champignon est posé sur un bloc plein (sol, plafond, mur de son côté)", () => {
    const open = ["version 7"]; // sans section : seul le support compte
    expect(mushroomProblems(room([[10, 11, "m"], [8, 1, "w"], [1, 6, ")"], [22, 6, "("]], open))).toEqual([]);
    expect(mushroomProblems(room([[10, 5, "m"]], open)).join()).toMatch(/pas posé sur un bloc plein/); // en l'air
    expect(mushroomProblems(room([[5, 11, ")"]], open)).join()).toMatch(/pas posé sur un bloc plein/); // pas de mur à sa gauche
    expect(mushroomProblems(room([[10, 11, "m"], [10, 12, "x"]], open)).join()).toMatch(/pas posé/); // un sol friable ne porte pas un champignon
  });

  it("rien de mortel sur la trajectoire des 0,3 premières secondes, simple ou renforcé : 36 pas", () => {
    expect(MUSHROOM_SAFE_TICKS).toBe(36);
    expect(mushroomSweepProblems(room([[10, 11, "m"], [8, 1, "w"], [1, 6, ")"], [22, 4, "("]]))).toEqual([]);
  });

  it("un pic sur la trajectoire d'un rebond est refusé : au-dessus, et un pic à côté du chapeau de sol", () => {
    // Pic au plafond (pointe vers le bas) à 5 tuiles au-dessus d'un champignon de sol : le rebond le touche dans les 0,3 s.
    expect(mushroomSweepProblems(room([[10, 11, "m"], [10, 6, "v"]])).join()).toMatch(/pic/);
    // Un pic collé au champignon, sur le sol.
    expect(mushroomSweepProblems(room([[10, 11, "m"], [11, 11, "^"]])).join()).toMatch(/pic/);
    // Un pic loin sur le côté (un champignon de mur lance à plus de 3 tuiles) : refusé aussi.
    expect(mushroomSweepProblems(room([[1, 6, ")"], [4, 6, "^"], [4, 7, "#"]])).join()).toMatch(/pic/);
  });

  it("un pic hors de la trajectoire (plus de 0,3 s plus loin) est permis", () => {
    // Très haut au-dessus, hors des 0,3 s.
    expect(mushroomSweepProblems(room([[10, 11, "m"], [10, 1, "v"]]))).toEqual([]);
  });

  it("une scie fixe, une scie mobile (tout son trajet) et la course d'une presse sont refusées aussi", () => {
    expect(mushroomSweepProblems(room([[10, 11, "m"], [10, 7, "o"]])).join()).toMatch(/scie/);
    const mobile = room([[10, 11, "m"]], ["version 7", "section salle 0-23", "scie s 0.5 480 aller-retour 4,1 18,1 4,1"]);
    expect(mushroomSweepProblems(mobile)).toEqual([]); // son trajet est à 10 rangées, au-delà de ce que 0,3 s de rebond renforcé atteint (≈ 7 tuiles)
    const near = room([[10, 11, "m"]], ["version 7", "section salle 0-23", "scie s 0.5 480 aller-retour 6,8 14,8"]);
    expect(mushroomSweepProblems(near).join()).toMatch(/scie s/);
    const press = room([[10, 11, "m"]], ["version 7", "section salle 0-23", "presse p 2 10,5 3 180 30 60 150"]);
    expect(mushroomSweepProblems(press).join()).toMatch(/presse/);
  });

  it("aucun point de passage, départ ni arrivée dans la trajectoire, et la trajectoire reste dans sa section", () => {
    const withC = room([[10, 11, "m"], [11, 8, "C"]]);
    expect(mushroomSweepProblems(withC).join()).toMatch(/point 1/);
    expect(mushroomProblems(withC).join()).toMatch(/point 1/);
    // Section étroite : la trajectoire d'un champignon de mur en sort.
    const narrow = room([[1, 6, ")"]], ["version 7", "section a 0-5", "section b 6-23"]);
    expect(mushroomSweepProblems(narrow).join()).toMatch(/sort de sa section/);
  });

  it("une chute par le bas de la grille est mortelle : un champignon de plafond au-dessus d'un trou", () => {
    const rows = ["###########", "#.......w.#", "#.........#", "#.........#", "#S.......F#", "#.........#"];
    const L = parseLevel(rows.join("\n") + "\n\nversion 7\nsection s 1-9\n");
    expect(mushroomSweepProblems(L).join()).toMatch(/par le bas/);
  });
});

// ——— Les morceaux de la forêt à champignons (catalogue) ———

const MUSHROOM_MODULES = MODULES.filter((m) => m.tags.includes("champignon"));
const presses = (bits: readonly number[]) => bits.filter((b, t) => (b & INPUT_JUMP) !== 0 && (t === 0 || (bits[t - 1]! & INPUT_JUMP) === 0)).length;

describe("lot 23 — les morceaux à champignons du catalogue", () => {
  it("entre 6 et 8 morceaux de base, tous de la forêt, étiquette `champignon`, réservés à la v7", () => {
    expect(MUSHROOM_MODULES.length).toBeGreaterThanOrEqual(6);
    expect(MUSHROOM_MODULES.length).toBeLessThanOrEqual(8);
    for (const d of MUSHROOM_MODULES) expect(d.theme, d.id).toBe("foret");
    expect([...mushroomModuleIds()].sort()).toEqual(MUSHROOM_MODULES.map((d) => d.id).sort());
    // Les champignons de la grille et l'étiquette vont ensemble (`parseModule` le refuse sinon) : chaque variante en a.
    for (const d of MUSHROOM_MODULES) for (let v = 0; v < d.variants.length; v++) expect(buildModule(d.id, v).level.mushrooms.length, `${d.id} v${v}`).toBeGreaterThan(0);
  });

  it("une respiration (note 2 au plus), deux morceaux avec du vent (rafales jusqu'à g20, continu depuis g21), au moins deux portions dures dont `champignon-falaise`", () => {
    const rest = MUSHROOM_MODULES.filter((d) => d.tags.includes("respiration"));
    expect(rest.length).toBeGreaterThanOrEqual(1);
    for (const d of rest) for (let v = 0; v < d.variants.length; v++) expect(variantExigence(moduleSolutions(d.id, v)), `${d.id} v${v}`).toBeLessThanOrEqual(2);
    const gusts = MUSHROOM_MODULES.filter((d) => d.tags.includes("vent"));
    expect(gusts.length).toBeGreaterThanOrEqual(2);
    for (const d of gusts) {
      for (let v = 0; v < d.variants.length; v++) {
        const L = buildModule(d.id, v).level;
        // Lot 27 : les variantes ajoutées pour g21 (`V11_ONLY_VARIANTS`) soufflent en continu ; les autres gardent leur rafale (références v7 à v10 au bit près).
        const continuous = V11_ONLY_VARIANTS[d.id]?.includes(v) ?? false;
        expect(L.winds.length, `${d.id} v${v} : du vent`).toBeGreaterThan(0);
        expect(L.winds.some((w) => w.gust !== null), `${d.id} v${v} : ${continuous ? "plus de rafale" : "une rafale"}`).toBe(!continuous);
        expect(L.mushrooms.length, `${d.id} v${v}`).toBeGreaterThan(0);
      }
    }
    const hard = MUSHROOM_MODULES.filter((d) => d.variants.some((_, v) => variantExigence(moduleSolutions(d.id, v)) >= SLOW_MIN_EXIGENCE));
    expect(hard.length).toBeGreaterThanOrEqual(2);
    expect(hard.map((d) => d.id)).toContain("champignon-falaise");
  });

  it("chaque variante passe les règles : posée sur du plein, rien de mortel dans les 0,3 premières secondes d'un rebond, aucun point de passage dans sa trajectoire, paliers", () => {
    for (const d of MUSHROOM_MODULES) {
      for (let v = 0; v < d.variants.length; v++) {
        const m = buildModule(d.id, v);
        expect(mushroomProblems(m.level), `${d.id} v${v}`).toEqual([]);
        expect(mushroomSweepProblems(m.level), `${d.id} v${v}`).toEqual([]);
        expect(mushroomPieceProblems(d.id, v), `${d.id} v${v}`).toEqual([]);
        expect(palierProblems(m), `${d.id} v${v}`).toEqual([]);
        // Une variante a une solution à chaque entrée, jouable (note ≥ 1).
        const sol = moduleSolutions(d.id, v)!;
        for (const e of ["arret", "elan"] as const) expect(sol[e]!.exigence, `${d.id} v${v} ${e}`).toBeGreaterThanOrEqual(1);
      }
    }
}, 120_000); // les règles des 0,3 s rejouent la simulation pour chaque variante : plus de 5 s quand la part de CI est chargée (rouge à la CI de PR)

  it("les solutions gardées rebondissent vraiment : chaque entrée de chaque variante compte au moins un rebond", () => {
    for (const d of MUSHROOM_MODULES) {
      for (let v = 0; v < d.variants.length; v++) {
        const m = buildModule(d.id, v);
        for (const e of ["arret", "elan"] as const) {
          const bits = fromRuns(decodeReplay(moduleSolutions(d.id, v)![e]!.code).runs);
          const contacts = mushroomContacts(m.level, moduleStart(m, e), bits);
          expect(contacts.length, `${d.id} v${v} ${e}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("la respiration compte au moins trois sauts à faire à chaque entrée : des appuis de saut et des rebonds", () => {
    for (const d of MUSHROOM_MODULES.filter((x) => x.tags.includes("respiration"))) {
      for (let v = 0; v < d.variants.length; v++) {
        const m = buildModule(d.id, v);
        for (const e of ["arret", "elan"] as const) {
          const bits = fromRuns(decodeReplay(moduleSolutions(d.id, v)![e]!.code).runs);
          const jumps = presses(bits) + mushroomContacts(m.level, moduleStart(m, e), bits).length;
          expect(jumps, `${d.id} v${v} ${e}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("`champignon-falaise` : le rebord est plus haut que tout rebond simple, atteignable par un rebond renforcé, et toute solution tient le saut au contact", () => {
    const def = MUSHROOM_MODULES.find((d) => d.id === "champignon-falaise")!;
    for (let v = 0; v < def.variants.length; v++) {
      const m = buildModule(def.id, v);
      const mush = m.level.mushrooms[0]!;
      // Hauteur à gagner : du dessus du chapeau (où le rebond part) au sol du palier de sortie.
      const need = mush.row * UNITS_PER_TILE - m.exitRow * UNITS_PER_TILE;
      const apex = (boost: boolean) => {
        let p = mushroomBounce(initialAttempt(m.level).player, MUSHROOM_UP, boost);
        let top = p.y;
        for (let t = 0; t < 200 && p.vy < 0; t++) {
          p = { ...p, y: p.y + p.vy };
          p = { ...p, vy: p.vy + DEFAULT_JUMP_PARAMS.gravity };
          top = Math.min(top, p.y);
        }
        return initialAttempt(m.level).player.y - top;
      };
      expect(apex(false), `${def.id} v${v} : le rebond simple n'y arrive pas`).toBeLessThan(need);
      expect(apex(true), `${def.id} v${v} : le rebond renforcé y arrive`).toBeGreaterThan(need);
      for (const e of ["arret", "elan"] as const) {
        const bits = fromRuns(decodeReplay(moduleSolutions(def.id, v)![e]!.code).runs);
        const contacts = mushroomContacts(m.level, moduleStart(m, e), bits);
        expect(contacts.some((c) => c.boost), `${def.id} v${v} ${e} : un rebond renforcé`).toBe(true);
      }
    }
  });
});

describe("lot 23 — les niveaux du jour", () => {
  const forestDays: number[] = [];
  for (let d = PREMIER_JOUR_JUMP; d < PREMIER_JOUR_JUMP + 90; d++) if (jumpThemeForDay(d) === "foret") forestDays.push(d);

  it("les références v3 à v6 ne connaissent pas les morceaux à champignons ; le générateur en vigueur (g17, v7) les pose, et seulement dans la forêt", () => {
    const ids = mushroomModuleIds();
    let withMushrooms = 0;
    for (let d = parseDay("2026-10-27")!; d < parseDay("2026-10-27")! + 20; d++) {
      for (const version of [3, 4, 5, PRESS_VERSION]) {
        const old = dailyLevel(d, null, version);
        expect(old.pieces.some((p) => ids.has(p.id)), `${old.date} v${version}`).toBe(false);
        expect(old.level.mushrooms, `${old.date} v${version}`).toEqual([]);
      }
      expect(dailyLevel(d, null, PRESS_VERSION).id).toBe(`jour-${dailyLevel(d).date}-g${PRESS_GENERATOR}`);
      const L = dailyLevel(d, null, MUSHROOM_VERSION); // lot 24 : la référence v7 (g17)
      expect(L.level.simVersion).toBe(7);
      expect(L.fallback, L.date).toBe(false);
      if (L.pieces.some((p) => ids.has(p.id))) {
        withMushrooms++;
        expect(L.theme, L.date).toBe("foret");
        expect(L.level.mushrooms.length, L.date).toBeGreaterThan(0);
      } else expect(L.level.mushrooms, L.date).toEqual([]);
    }
    expect(withMushrooms).toBeGreaterThanOrEqual(1);
  }, 240_000);

  it("les jours de forêt à champignons passent toutes les règles (dont les champignons) ; la preuve de l'auteur rebondit sans mourir", () => {
    const ids = mushroomModuleIds();
    let n = 0;
    for (const day of forestDays) {
      const L = dailyLevel(day);
      if (!L.pieces.some((p) => ids.has(p.id))) continue;
      n++;
      expect(dailyProblems(L), L.date).toEqual([]);
      expect(respawnProblems(L.level), L.date).toEqual([]);
      expect(mushroomProblems(L.level), L.date).toEqual([]);
      let s = initialAttempt(L.level);
      let bounces = 0;
      const events = { mushroom: -1, boost: 0, shake: -1, shatter: -1, bridge: -1 };
      for (const b of fromRuns(L.replay.runs)) {
        s = stepAttempt(s, b, L.level, DEFAULT_JUMP_PARAMS, events);
        if (events.mushroom >= 0) bounces++;
        expect(s.status, L.date).not.toBe(ATTEMPT_DEAD);
      }
      expect(bounces, `${L.date} : la preuve rebondit`).toBeGreaterThan(0);
      if (n >= 6) break;
    }
    expect(n).toBeGreaterThanOrEqual(3);
  }, 240_000);

  it("un jour à champignons se fige et se relit (versions 7 et g17) ; une version incohérente est refusée", () => {
    const ids = mushroomModuleIds();
    const day = forestDays.map((d) => dailyLevel(d, null, MUSHROOM_VERSION)).find((L) => L.pieces.some((p) => ids.has(p.id)));
    expect(day, "un jour à champignons sur 90").toBeDefined();
    const raw = JSON.parse(frozenJson(freezeLevel(day!)));
    expect(raw.simVersion).toBe(7);
    expect(raw.generatorVersion).toBe(17);
    const back = thawLevel(raw, day!.day);
    expect(typeof back).not.toBe("string");
    if (typeof back === "string") return;
    expect(back.ascii).toBe(day!.ascii);
    expect(back.level.mushrooms).toEqual(day!.level.mushrooms);
    expect(back.code).toBe(day!.code);
    expect(thawLevel({ ...raw, generatorVersion: PRESS_GENERATOR }, day!.day)).toBe("versions incohérentes");
    expect(thawLevel({ ...raw, simVersion: PRESS_VERSION }, day!.day)).toBe("versions incohérentes");
  }, 240_000);
});
