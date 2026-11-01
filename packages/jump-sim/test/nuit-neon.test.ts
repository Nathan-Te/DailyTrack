import "./legacy";
import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_RUNNING,
  COUNTER_CAP,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  LevelError,
  MAX_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_ALT_OFF,
  TILE_ALT_ON,
  TILE_BLINK_OFF,
  TILE_BLINK_ON,
  UNITS_PER_TILE,
  blinkIsSolid,
  boxHits,
  boxesOverlap,
  initialAttempt,
  initialPlayer,
  isDynamicTile,
  isSolidTile,
  buildModuleDef,
  mutationLabel,
  parseLevel,
  parseModule,
  variantTheme,
  BLINK_PROFILES,
  sectionPhases,
  settleDynamic,
  stepAttempt,
  stepPlayerJump,
  type AttemptState,
  type JumpFlags,
  type Level,
} from "../src/index";

// Lot 12 : blocs clignotants (nuit) et blocs alternés (néon). Les niveaux sont de petits textes écrits ici.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;
const R = INPUT_RIGHT;
const J = INPUT_JUMP;

const text = (rows: string[], annex: string[] = []) => rows.join("\n") + (annex.length > 0 ? "\n\n" + annex.join("\n") : "") + "\n";
const lv = (rows: string[], annex: string[] = []): Level => parseLevel(text(rows, annex));

/** L'état d'un essai en cours, le personnage au sol dans la colonne `col` (centré), rangée `row`. */
function running(level: Level, col: number, row: number, extra: Partial<AttemptState> = {}): AttemptState {
  const s = initialAttempt(level);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  const out: AttemptState = { ...s, status: ATTEMPT_RUNNING, time: 1, player: { ...s.player, x, y, ground: 1, air: 0 }, ...extra };
  return { ...out, tiles: settleDynamic(level, out.tiles, out.sections, out.time, out.alt ?? 0, out.player) };
}
const step = (s: AttemptState, bits: number, level: Level) => stepAttempt(s, bits, level, P);
const play = (s: AttemptState, bits: number, n: number, level: Level) => {
  for (let i = 0; i < n; i++) s = step(s, bits, level);
  return s;
};
const code = (level: Level, s: AttemptState, col: number, row: number) => s.tiles[row * level.width + col]!;
const overlapsSolid = (level: Level, s: AttemptState) => boxHits({ width: level.width, height: level.height, tiles: s.tiles }, s.player.x, s.player.y, PLAYER_WIDTH, PLAYER_HEIGHT);

// ——— Les blocs clignotants ———

/** Une salle dont le plafond porte des blocs `b` et `d` hors de portée du personnage, une seule section. */
const CEILING = [
  "####################",
  "#bbbb..dddd........#",
  "#..................#",
  "#..................#",
  "#..................#",
  "#S................F#",
  "####################",
];
const section = (cols = "0-19") => `section a ${cols}`;

describe("clignotants : lecture", () => {
  it("`b` et `d` sont des blocs pleins ou absents selon le pas 0 du cycle déclaré ; `Level.blinks` les range dans l'ordre de lecture", () => {
    const a = lv(CEILING, [section(), "clignote a 60 20 0"]);
    expect(a.blinks.map((b) => [b.col, b.row, b.group, b.section])).toEqual([
      [1, 1, 0, 0], [2, 1, 0, 0], [3, 1, 0, 0], [4, 1, 0, 0],
      [7, 1, 1, 0], [8, 1, 1, 0], [9, 1, 1, 0], [10, 1, 1, 0],
    ]);
    expect(a.blinkCycles).toEqual([{ cycle: 60, solid: 20, shift: 0 }]);
    // Pas 0 : `b` solide (0 < 20), `d` absent.
    expect(a.tiles[1 * a.width + 1]).toBe(TILE_BLINK_ON);
    expect(a.tiles[1 * a.width + 7]).toBe(TILE_BLINK_OFF);
    // Un décalage de 30 : au pas 0 on est à 30 ≥ 20 : `b` absent, `d` solide.
    const b = lv(CEILING, [section(), "clignote a 60 20 30"]);
    expect(b.tiles[1 * b.width + 1]).toBe(TILE_BLINK_OFF);
    expect(b.tiles[1 * b.width + 7]).toBe(TILE_BLINK_ON);
  });

  it("les codes : plein arrête le personnage, absent non ; ils sont dynamiques", () => {
    for (const t of [TILE_BLINK_ON, TILE_ALT_ON]) expect(isSolidTile(t)).toBe(true);
    for (const t of [TILE_BLINK_OFF, TILE_ALT_OFF]) expect(isSolidTile(t)).toBe(false);
    for (const t of [TILE_BLINK_ON, TILE_BLINK_OFF, TILE_ALT_ON, TILE_ALT_OFF]) expect(isDynamicTile(t)).toBe(true);
    expect(isDynamicTile(1)).toBe(false);
    expect(isSolidTile(10)).toBe(true); // la glace reste pleine
    expect(isSolidTile(0)).toBe(false);
  });

  it("refuse un bloc sans section, une section sans cycle, un cycle mal formé", () => {
    expect(() => lv(CEILING)).toThrow(LevelError);
    expect(() => lv(CEILING, [section("0-19")])).toThrow(/ne déclare pas de « clignote »/);
    expect(() => lv(CEILING, [section("0-5"), "clignote a 60 20 0"])).toThrow(/dans aucune section|aucune section/);
    expect(() => lv(CEILING, [section(), "clignote zz 60 20 0"])).toThrow(/inconnue/);
    expect(() => lv(CEILING, [section(), "clignote a 60 20"])).toThrow(/attendu/);
    expect(() => lv(CEILING, [section(), "clignote a 1 1 0"])).toThrow(/hors de/);
    expect(() => lv(CEILING, [section(), "clignote a 60 0 0"])).toThrow(/solide/);
    expect(() => lv(CEILING, [section(), "clignote a 60 60 0"])).toThrow(/solide/);
    expect(() => lv(CEILING, [section(), "clignote a 60 20 60"])).toThrow(/décalage/);
    expect(() => lv(CEILING, [section(), "clignote a 60 20 0", "clignote a 60 30 0"])).toThrow(/déjà déclaré/);
    expect(() => lv(CEILING, [section(), "clignote a 60 x 0"])).toThrow(/nombres/);
  });
});

describe("clignotants : le cycle", () => {
  const level = lv(CEILING, [section(), "clignote a 60 20 0"]);

  it("`blinkIsSolid` : `b` pendant la fenêtre, `d` pendant le reste, en opposition exacte (jamais les deux, jamais aucun)", () => {
    const c = { cycle: 60, solid: 20, shift: 7 };
    for (let p = 0; p < 300; p++) {
      const q = (p + 7) % 60;
      expect(blinkIsSolid(c, 0, p)).toBe(q < 20);
      expect(blinkIsSolid(c, 1, p)).toBe(q >= 20);
      expect(blinkIsSolid(c, 0, p)).not.toBe(blinkIsSolid(c, 1, p));
    }
  });

  it("l'état suit le cycle au pas près, depuis l'entrée dans la section (phase = temps − début)", () => {
    let s = initialAttempt(level);
    expect(sectionPhases(level, s)).toEqual([0]);
    const seen: boolean[] = [];
    for (let k = 1; k <= 190; k++) {
      s = step(s, k === 1 ? R : 0, level); // un premier pas commandé, puis le personnage s'arrête : il n'atteint pas l'arrivée
      // Le personnage est dans la section dès le premier pas : début = 1, phase = temps − 1.
      expect(s.sections[0]).toBe(1);
      expect(sectionPhases(level, s)).toEqual([k - 1]);
      const bOn = code(level, s, 2, 1) === TILE_BLINK_ON;
      const dOn = code(level, s, 8, 1) === TILE_BLINK_ON;
      expect(bOn).toBe((k - 1) % 60 < 20);
      expect(dOn).toBe(!bOn);
      seen.push(bOn);
    }
    expect(seen.filter(Boolean).length).toBe(20 + 20 + 20 + 10); // trois fenêtres de 20 pas (le dernier cycle est entamé)
  });

  it("le cycle revient exactement au même état à chaque tour", () => {
    let s = running(level, 2, 5, { sections: [1] });
    s = { ...s, time: 1 };
    const states: string[] = [];
    for (let k = 0; k < 180; k++) {
      s = step(s, 0, level);
      states.push([2, 3, 4, 7, 8, 9].map((c) => code(level, s, c, 1)).join(""));
    }
    for (let k = 0; k + 60 < 180; k++) expect(states[k + 60]).toBe(states[k]);
  });

  it("section d'entrée tardive : les blocs gardent l'état du pas 0 jusqu'à l'entrée, puis suivent le cycle depuis elle", () => {
    const rows = [
      "######################",
      "#....................#",
      "#....................#",
      "#....................#",
      "#..............bbbdd.#",
      "#S..................F#",
      "######################",
    ];
    const l = lv(rows, ["section avant 0-13", "section la 14-21", "clignote la 40 10 5"]);
    expect(l.blinks.every((b) => b.section === 1)).toBe(true);
    const at = (s: AttemptState) => [15, 16, 17, 18, 19].map((c) => code(l, s, c, 4));
    const initial = at(initialAttempt(l));
    let s = initialAttempt(l);
    let entered = -1;
    for (let k = 1; k <= 200; k++) {
      s = step(s, R, l);
      if (s.sections[1]! >= 0 && entered < 0) {
        entered = s.time;
        // Au pas d'entrée la phase est 0 : l'état est celui du pas 0.
        expect(at(s)).toEqual(initial);
      }
      if (entered < 0) {
        expect(sectionPhases(l, s)[1]).toBe(0);
        expect(at(s)).toEqual(initial); // gelés tant qu'on n'est pas entré
      } else {
        const phase = s.time - entered;
        expect(sectionPhases(l, s)[1]).toBe(phase);
        expect(code(l, s, 15, 4) === TILE_BLINK_ON).toBe((phase + 5) % 40 < 10);
        expect(code(l, s, 18, 4) === TILE_BLINK_ON).toBe((phase + 5) % 40 >= 10);
      }
    }
    expect(entered).toBeGreaterThan(20); // le personnage a bien couru avant d'entrer dans la section
  });

  it("opposition de phase : quand `b` disparaît, `d` apparaît au même pas", () => {
    let s = initialAttempt(level);
    let flips = 0;
    let prev = code(level, s, 2, 1);
    for (let k = 0; k < 200; k++) {
      s = step(s, R, level);
      const b = code(level, s, 2, 1);
      const d = code(level, s, 8, 1);
      expect(b === TILE_BLINK_ON).not.toBe(d === TILE_BLINK_ON);
      if (b !== prev) flips++;
      prev = b;
    }
    expect(flips).toBeGreaterThanOrEqual(6);
  });

  it("la mort sans point de passage ramène l'état initial exact (grille comprise) ; avec un point, la phase repart de l'entrée de la section", () => {
    const rows = [
      "######################",
      "#....................#",
      "#....................#",
      "#....................#",
      "#..................bb#",
      "#S...........>.....F.#",
      "######################",
    ];
    // Un pic sur le chemin : on y meurt.
    const l = lv(rows, ["section a 0-21", "clignote a 30 10 0"]);
    let s = initialAttempt(l);
    let died = false;
    for (let k = 0; k < 400 && !died; k++) {
      s = step(s, R, l);
      died = s.status === ATTEMPT_DEAD;
    }
    expect(died).toBe(true);
    expect(s.tiles).not.toBe(l.tiles); // la grille avait changé avec le cycle
    s = play(s, R, 18, l);
    expect(s).toEqual(initialAttempt(l));
    expect(s.tiles).toBe(l.tiles);
  });

  it("avec un point de passage, la mort reprend sur lui : les sections d'après repartent de la phase 0, les blocs avec elles", () => {
    const rows = [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.................bbbdd........#",
      "#S.........C..........>......F.#",
      "################################",
    ];
    const l = lv(rows, ["section un 0-14", "section deux 15-31", "clignote deux 30 10 0"]);
    let s = initialAttempt(l);
    let deathsAt = -1;
    for (let k = 0; k < 600 && deathsAt < 0; k++) {
      s = step(s, R, l);
      if (s.status === ATTEMPT_DEAD) deathsAt = k;
    }
    expect(deathsAt).toBeGreaterThan(0);
    expect(s.checkpoint).toBe(0);
    s = play(s, R, 18, l);
    // Réapparu sur le point de passage : section « deux » à l'arrêt, ses blocs à l'état du pas 0.
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.sections[1]).toBe(-1);
    expect(sectionPhases(l, s)[1]).toBe(0);
    expect([19, 20, 21, 22, 23].map((c) => code(l, s, c, 4))).toEqual([19, 20, 21, 22, 23].map((c) => l.tiles[4 * l.width + c]!));
  });
});

describe("clignotants : un bloc ne devient plein qu'une fois le personnage sorti", () => {
  // Un couloir de deux tuiles de haut, un bloc `b` dans la rangée du personnage.
  const rows = [
    "##############",
    "#............#",
    "#............#",
    "#..S..b..bb.F#",
    "##############",
  ];
  const level = lv(rows, ["section a 0-13", "clignote a 20 8 0"]);

  it("le personnage dans le bloc au moment où il devrait apparaître : il reste traversable, puis devient plein dès que le personnage en sort", () => {
    // Phase 8 : `b` absent (q = 8..19). On pose le personnage dans la colonne 6, cycle à phase 18 : dans deux pas `b` redevient plein.
    let s = running(level, 6, 3, { sections: [1], time: 19 });
    // time − début = 18 : q = 18, absent.
    expect(code(level, s, 6, 3)).toBe(TILE_BLINK_OFF);
    let ghosted = 0;
    for (let k = 0; k < 40; k++) {
      s = step(s, 0, level); // immobile dans le bloc
      const phase = s.time - 1 - 0;
      const wants = (s.time - s.sections[0]!) % 20 < 8;
      if (wants && code(level, s, 6, 3) === TILE_BLINK_OFF) ghosted++;
      // Jamais coincé : la boîte n'est jamais dans un bloc plein.
      expect(overlapsSolid(level, s)).toBe(false);
      void phase;
    }
    expect(ghosted).toBeGreaterThan(10); // plusieurs pas où il aurait été plein
    expect(s.status).toBe(ATTEMPT_RUNNING); // pas écrasé
    // Il sort : dès le premier état sans chevauchement, le bloc devient plein (la fenêtre solide est en cours).
    let n = 0;
    let before = s;
    while (boxesOverlap({ x: s.player.x, y: s.player.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT }, { x: 6 * T, y: 3 * T, w: T, h: T }) && n < 200) {
      before = s;
      s = step(s, R, level);
      n++;
    }
    expect(n).toBeLessThan(200);
    // Les phases de la fenêtre solide : on ajuste la lecture au besoin (il se peut que la fenêtre se soit refermée) — la règle : plein ssi voulu.
    const want = (s.time - s.sections[0]!) % 20 < 8;
    expect(code(level, s, 6, 3) === TILE_BLINK_ON).toBe(want);
    void before;
  });

  it("test déterministe : sortie par la droite en pleine fenêtre solide, plein au pas exact de la sortie", () => {
    // Le cycle est long (solide pendant 60 pas), le personnage est dans le bloc quand la fenêtre s'ouvre.
    const slow = lv(rows, ["section a 0-13", "clignote a 100 60 0"]);
    // Phase 99 : q = 99 → `b` solide (q < 60) ? non : 99 ≥ 60, absent ; au pas suivant q = 0 : devrait apparaître.
    let s = running(slow, 6, 3, { sections: [1], time: 100 });
    expect(code(slow, s, 6, 3)).toBe(TILE_BLINK_OFF);
    s = step(s, 0, slow); // phase 99 + 1 = 100 → q = 0 : voulu plein, mais le personnage le chevauche
    expect((s.time - s.sections[0]!) % 100).toBe(0);
    expect(code(slow, s, 6, 3)).toBe(TILE_BLINK_OFF);
    let exited = -1;
    for (let k = 0; k < 60 && exited < 0; k++) {
      s = step(s, R, slow);
      const inside = boxesOverlap({ x: s.player.x, y: s.player.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT }, { x: 6 * T, y: 3 * T, w: T, h: T });
      expect(code(slow, s, 6, 3) === TILE_BLINK_ON).toBe(!inside); // plein ssi le personnage n'y est plus
      if (!inside) exited = k;
      expect(overlapsSolid(slow, s)).toBe(false);
    }
    expect(exited).toBeGreaterThan(0);
  });

  it("jamais écrasé ni coincé : un fuzz de commandes au hasard dans le couloir, plusieurs cycles", () => {
    const rng = new Rng(120);
    for (const cycle of [["clignote a 20 8 0"], ["clignote a 7 3 2"], ["clignote a 40 35 10"]]) {
      const l = lv(rows, ["section a 0-13", ...cycle]);
      let s = initialAttempt(l);
      let input = 0;
      let left = 0;
      let deaths = 0;
      for (let t = 0; t < 4000; t++) {
        if (left-- <= 0) {
          input = rng.int(8);
          left = rng.int(30);
        }
        s = step(s, input, l);
        if (s.status === ATTEMPT_DEAD) deaths++;
        expect(overlapsSolid(l, s)).toBe(false);
      }
      expect(deaths).toBe(0); // aucun danger dans ce couloir : on n'y meurt jamais
    }
  });
});

// ——— Les blocs alternés ———

/** Un sol large, des blocs alternés en l'air au-dessus (hors de portée du personnage au sol), des murs pour le saut mural. */
const FLOOR = [
  "####################",
  "#..................#",
  "#...AA....BB.......#",
  "#..................#",
  "#..................#",
  "#..................#",
  "#S................F#",
  "####################",
];

describe("alternés : lecture et état initial", () => {
  const level = lv(FLOOR);

  it("`A` est plein au départ, `B` est absent ; `Level.alts` les range", () => {
    expect(level.alts.map((a) => [a.col, a.row, a.set])).toEqual([[4, 2, 0], [5, 2, 0], [10, 2, 1], [11, 2, 1]]);
    expect(level.tiles[2 * level.width + 4]).toBe(TILE_ALT_ON);
    expect(level.tiles[2 * level.width + 10]).toBe(TILE_ALT_OFF);
  });

  it("`alt` n'existe que dans un niveau qui a des blocs alternés (les autres empreintes ne changent pas)", () => {
    expect(initialAttempt(level).alt).toBe(0);
    const plain = lv(CEILING, [section(), "clignote a 60 20 0"]);
    expect("alt" in initialAttempt(plain)).toBe(false);
    const none = lv(["#####", "#S.F#", "#####"]);
    const s = play(initialAttempt(none), R, 30, none);
    expect("alt" in s).toBe(false);
    expect(s.tiles).toBe(none.tiles);
  });
});

describe("alternés : chaque saut qui part inverse les deux jeux", () => {
  const level = lv(FLOOR);
  const state = (col = 8, row = 6) => running(level, col, row);

  it("saut au sol : A disparaît, B apparaît au même pas ; un second saut les rend", () => {
    let s = state();
    expect(code(level, s, 4, 2)).toBe(TILE_ALT_ON);
    s = step(s, J, level);
    expect(s.alt).toBe(1);
    expect(s.player.vy).toBeLessThan(0);
    expect(code(level, s, 4, 2)).toBe(TILE_ALT_OFF);
    expect(code(level, s, 10, 2)).toBe(TILE_ALT_ON);
    // Tenir le bouton ne change rien (un seul saut).
    s = play(s, J, 10, level);
    expect(s.alt).toBe(1);
    // Atterrir, relâcher, resauter : retour à A.
    for (let k = 0; k < 200 && !(s.player.ground === 1); k++) s = step(s, 0, level);
    expect(s.player.ground).toBe(1);
    s = step(s, J, level);
    expect(s.alt).toBe(0);
    expect(code(level, s, 4, 2)).toBe(TILE_ALT_ON);
  });

  it("saut en coyote (juste après avoir quitté le sol) : inverse aussi", () => {
    const s0 = state();
    const s = { ...s0, player: { ...s0.player, ground: 0, air: 3 } }; // 3 pas en l'air : coyote 10
    const after = step(s, J, level);
    expect(after.player.vy).toBeLessThan(0);
    expect(after.alt).toBe(1);
  });

  it("saut mural : inverse aussi", () => {
    // Contre le mur de gauche, en l'air, à la hauteur de la rangée 4.
    const s0 = state(1, 6);
    let s = { ...s0, player: { ...s0.player, x: T, y: 3 * T, ground: 0, air: 100, vy: 100, wallSide: -1, wallAir: 0 } };
    s = step(s, J | INPUT_LEFT, level);
    expect(s.player.vx).toBeGreaterThan(0); // poussé loin du mur
    expect(s.alt).toBe(1);
  });

  it("saut gardé dans le tampon : l'inversion a lieu au pas où il part vraiment, pas à l'appui", () => {
    const s0 = state();
    // En l'air, assez haut pour ne pas se poser avant quelques pas, sans coyote ni mur : l'appui va dans le tampon.
    let s = { ...s0, player: { ...s0.player, y: 7 * T - PLAYER_HEIGHT - 800, ground: 0, air: COUNTER_CAP, vy: 0 } };
    s = step(s, J, level);
    expect(s.player.buffer).toBeGreaterThan(0);
    expect(s.alt).toBe(0); // pas d'inversion à l'appui
    let flippedAt = -1;
    let landedAt = -1;
    for (let k = 0; k < 40; k++) {
      const prev = s;
      s = step(s, J, level);
      if (landedAt < 0 && s.player.ground === 1) landedAt = k;
      if (s.alt === 1 && flippedAt < 0) {
        flippedAt = k;
        expect(prev.alt).toBe(0);
        expect(s.player.vy).toBeLessThan(0); // un saut vient de partir
      }
    }
    expect(landedAt).toBeGreaterThanOrEqual(0);
    expect(flippedAt).toBeGreaterThan(landedAt); // le pas d'après l'atterrissage (le sol est lu au début du pas)
    expect(s.alt).toBe(1); // une seule inversion
  });

  it("un appui en l'air sans rien pour sauter (tampon expiré avant le sol) n'inverse rien", () => {
    const s0 = state();
    let s = { ...s0, player: { ...s0.player, y: 1 * T, ground: 0, air: COUNTER_CAP, vy: 0 } };
    s = step(s, J, level);
    s = play(s, 0, 8, level);
    expect(s.player.ground).toBe(0);
    expect(s.alt).toBe(0);
  });

  it("un ressort n'inverse rien", () => {
    const spring = lv(["###########", "#.........#", "#.........#", "#.........#", "#.........#", "#S..*..AB.F#".slice(0, 11), "###########"]);
    let s = running(spring, 4, 3);
    // Au-dessus du ressort, en chute : il se pose dessus et est lancé.
    s = { ...s, player: { ...s.player, y: 4 * T - PLAYER_HEIGHT - 200, ground: 0, air: COUNTER_CAP, vy: 300 } };
    let launched = false;
    for (let k = 0; k < 20 && !launched; k++) {
      s = step(s, 0, spring);
      if (s.player.vy < -P.jumpSpeed) launched = true;
    }
    expect(launched).toBe(true);
    expect(s.springCell).toBeGreaterThanOrEqual(0);
    expect(s.alt).toBe(0);
  });

  it("`stepPlayerJump` dit si un saut est parti, au bit près avec `stepPlayer`", () => {
    const s0 = state().player;
    const flags: JumpFlags = { jumped: 0, wall: 0 };
    const a = stepPlayerJump(s0, J, level, P, flags);
    expect(flags).toEqual({ jumped: 1, wall: 0 });
    const idle = stepPlayerJump(s0, 0, level, P, flags);
    expect(flags).toEqual({ jumped: 0, wall: 0 });
    expect(idle.vy).toBe(stepPlayerJump(s0, 0, level, P, null).vy);
    expect(a.vy).toBe(-P.jumpSpeed + P.gravity - P.gravity); // la gravité n'a pas été ajoutée après l'impulsion
  });
});

describe("alternés : la remise à A", () => {
  // Un point de passage `C` sur le chemin, un pic plus loin.
  const rows = [
    "##############################",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#...AA....BB.................#",
    "#S......C.............>.....F#",
    "##############################",
  ];
  const level = lv(rows);

  it("franchir un point de passage remet A solide, même après plusieurs sauts", () => {
    let s = initialAttempt(level);
    // Un saut au départ : B.
    s = step(s, J | R, level);
    expect(s.alt).toBe(1);
    s = play(s, R, 5, level);
    expect(s.alt).toBe(1);
    // Courir jusqu'à franchir la colonne du point de passage (colonne 8).
    let crossedAt = -1;
    for (let k = 0; k < 300 && crossedAt < 0; k++) {
      const before = s;
      s = step(s, R, level);
      if (s.checkpoint === 0 && before.checkpoint === -1) {
        crossedAt = k;
        expect(s.alt).toBe(0); // remis à A au pas même du franchissement
        expect(code(level, s, 4, 5)).toBe(TILE_ALT_ON);
        expect(code(level, s, 10, 5)).toBe(TILE_ALT_OFF);
      }
    }
    expect(crossedAt).toBeGreaterThanOrEqual(0);
  });

  it("un saut qui part au pas même du franchissement : la remise à A l'emporte (le saut, lui, est bien parti)", () => {
    let s = running(level, 7, 6);
    // Le centre est à 10 unités du bord gauche de la colonne 8 (celle du point de passage), la course lancée : ce pas le franchit.
    s = { ...s, player: { ...s.player, x: 8 * T - PLAYER_WIDTH / 2 - 10, vx: P.runSpeed } };
    s = step(s, J | R, level);
    expect(s.player.vy).toBeLessThan(0); // un saut est parti…
    expect(s.checkpoint).toBe(0); // … au pas où l'on franchit le point de passage
    expect(s.alt).toBe(0); // la remise à A l'emporte
    expect(code(level, s, 4, 5)).toBe(TILE_ALT_ON);
  });

  it("la mort ramène l'état du point de reprise (A) ; sans point de passage, l'état initial", () => {
    let s = initialAttempt(level);
    s = step(s, J | R, level);
    expect(s.alt).toBe(1);
    s = play(s, R, 5, level);
    // On court jusqu'au point de passage, on saute (B), on meurt sur le pic.
    for (let k = 0; k < 400 && s.checkpoint < 0; k++) s = step(s, R, level);
    expect(s.checkpoint).toBe(0);
    s = play(s, J, 1, level);
    expect(s.alt).toBe(1);
    let died = false;
    for (let k = 0; k < 600 && !died; k++) {
      s = step(s, R, level);
      died = s.status === ATTEMPT_DEAD;
    }
    expect(died).toBe(true);
    s = play(s, 0, 18, level);
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.alt).toBe(0);
    expect(code(level, s, 4, 5)).toBe(TILE_ALT_ON);
    expect(code(level, s, 10, 5)).toBe(TILE_ALT_OFF);

    // Sans point de passage : la mort termine l'essai, l'état initial revient.
    const noC = lv(rows.map((r) => r.replace("C", ".")));
    let t = initialAttempt(noC);
    t = step(t, J | R, noC);
    expect(t.alt).toBe(1);
    for (let k = 0; k < 600 && t.status !== ATTEMPT_DEAD; k++) t = step(t, R, noC);
    expect(t.status).toBe(ATTEMPT_DEAD);
    t = play(t, 0, 18, noC);
    expect(t).toEqual(initialAttempt(noC));
  });
});

describe("alternés : un bloc qui devient plein sur le personnage reste traversable jusqu'à ce qu'il en sorte", () => {
  // Un couloir bas : le personnage s'y tient dans la colonne d'un bloc `B` (absent), puis saute : `B` devrait apparaître sur lui.
  const rows = [
    "##############",
    "#............#",
    "#............#",
    "#.....B......#",
    "#S...........F#".slice(0, 14),
    "##############",
  ];
  const level = lv(rows);

  it("le saut qui rend `B` plein alors qu'il est dedans : il reste absent, puis devient plein dès la sortie", () => {
    // Le personnage dans la colonne 6, rangée 3, à l'intérieur de la case de `B`.
    let s = running(level, 6, 3);
    expect(code(level, s, 6, 3)).toBe(TILE_ALT_OFF);
    s = step(s, J, level); // le saut part : B voulu plein, mais on est dedans
    expect(s.alt).toBe(1);
    expect(code(level, s, 6, 3)).toBe(TILE_ALT_OFF);
    expect(overlapsSolid(level, s)).toBe(false);
    // Il sort par la droite ; le bloc devient plein au premier état sans chevauchement.
    let exited = false;
    for (let k = 0; k < 120 && !exited; k++) {
      s = step(s, R | J, level);
      const inside = boxesOverlap({ x: s.player.x, y: s.player.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT }, { x: 6 * T, y: 3 * T, w: T, h: T });
      expect(code(level, s, 6, 3) === TILE_ALT_ON).toBe(!inside && s.alt === 1);
      expect(overlapsSolid(level, s)).toBe(false);
      if (!inside) exited = true;
    }
    expect(exited).toBe(true);
    expect(s.status).toBe(ATTEMPT_RUNNING);
  });

  it("immobile dans le bloc sans que rien ne change : jamais coincé, jamais mort", () => {
    let s = running(level, 6, 3);
    s = step(s, J, level);
    for (let k = 0; k < 60; k++) {
      s = step(s, 0, level);
      expect(overlapsSolid(level, s)).toBe(false);
    }
    expect(s.status).toBe(ATTEMPT_RUNNING);
  });
});

// ——— Intégrité (fuzz) ———

describe("intégrité (fuzz) sur des niveaux qui contiennent les deux mécaniques", () => {
  const BOTH = [
    "##########################",
    "#........................#",
    "#...bbb......dd..........#",
    "#........................#",
    "#...AA.....BB.....AA.....#",
    "#........................#",
    "#S....C...........b.....F#",
    "##########################",
  ];
  const both = lv(BOTH, ["section a 0-25", "clignote a 45 20 3"]);

  function assertSound(s: AttemptState, level: Level, where: string): void {
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
    if (s.status !== ATTEMPT_DEAD && boxHits({ width: level.width, height: level.height, tiles: s.tiles }, p.x, p.y, PLAYER_WIDTH, PLAYER_HEIGHT)) throw new Error(`${where} : la boîte est dans un bloc plein`);
    if (s.alt !== undefined && s.alt !== 0 && s.alt !== 1) throw new Error(`${where} : alt = ${s.alt}`);
    // L'état de chaque bloc alterné est celui de la parité, sauf s'il attend que le personnage en sorte.
    for (const a of level.alts) {
      const on = s.tiles[a.row * level.width + a.col] === TILE_ALT_ON;
      const want = a.set === (s.alt ?? 0);
      if (on !== want && !(want && boxesOverlap({ x: p.x, y: p.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT }, { x: a.col * T, y: a.row * T, w: T, h: T }))) throw new Error(`${where} : bloc alterné ${a.col},${a.row} incohérent`);
    }
  }

  it("des dizaines de milliers de pas de commandes au hasard : tout entier, sans −0, sous MAX_SPEED, jamais dans un bloc plein, parité cohérente", () => {
    const rng = new Rng(20261016);
    let total = 0;
    let flips = 0;
    for (let run = 0; run < 30; run++) {
      let s = initialAttempt(both);
      let input = 0;
      let left = 0;
      for (let t = 0; t < 2500; t++) {
        if (left-- <= 0) {
          input = rng.int(8);
          left = rng.int(40);
        }
        const prevAlt = s.alt;
        s = step(s, input, both);
        if (prevAlt !== s.alt) flips++;
        assertSound(s, both, `essai ${run}, pas ${t}`);
        total++;
      }
    }
    expect(total).toBe(75_000);
    expect(flips).toBeGreaterThan(100); // le fuzz saute bien
  });

  it("réglages au hasard (sauts plus ou moins forts, tampon, coyote) : même intégrité", () => {
    const rng = new Rng(77);
    const keys = Object.keys(P) as (keyof typeof P)[];
    for (let run = 0; run < 20; run++) {
      const params = { ...P };
      for (const k of keys) params[k] = rng.chance(10) ? rng.int(5000) : rng.int(3 * P[k]! + 2);
      let s = initialAttempt(both);
      let input = 0;
      let left = 0;
      for (let t = 0; t < 1200; t++) {
        if (left-- <= 0) {
          input = rng.int(8);
          left = rng.int(40);
        }
        s = stepAttempt(s, input, both, params);
        assertSound(s, both, `réglages ${run}, pas ${t}`);
      }
    }
  });

  it("déterministe : deux joueurs de la même suite de commandes ont exactement les mêmes états", () => {
    const run = (seed: number) => {
      const rng = new Rng(seed);
      let s = initialAttempt(both);
      let h = 2166136261;
      for (let t = 0; t < 3000; t++) {
        s = step(s, rng.int(8), both);
        h = Math.imul(h ^ (s.player.x + s.player.y * 7 + s.time + (s.alt ?? 0) * 13 + s.tiles.reduce((a, v, i) => a + v * (i % 17), 0)), 16777619) >>> 0;
      }
      return h;
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});

describe("`settleDynamic`", () => {
  it("rend la grille elle-même quand rien ne change, et ne modifie jamais le tableau reçu", () => {
    const l = lv(FLOOR);
    const p = initialPlayer(l);
    expect(settleDynamic(l, l.tiles, [], 0, 0, p)).toBe(l.tiles);
    const copy = [...l.tiles];
    const out = settleDynamic(l, l.tiles, [], 5, 1, p);
    expect(out).not.toBe(l.tiles);
    expect([...l.tiles]).toEqual(copy);
    // Un niveau sans blocs dynamiques : toujours la même grille.
    const plain = lv(["#####", "#S.F#", "#####"]);
    expect(settleDynamic(plain, plain.tiles, [], 9, 0, initialPlayer(plain))).toBe(plain.tiles);
  });
});

describe("mutateurs clignotant et alterne (morceaux)", () => {
  const TEXT = `id: essai-mut
intention: Un morceau d'essai.
etiquettes: precision
famille: essai-mut
mutateurs: clignotant alterne
format: 3
paliers: 6 6
repeter: large colonnes 4-4
variante: large=1
variante: large=2 +clignotant:moyen
variante: large=1 +alterne
grille:
...........
...........
...........
...........
...........
...........
###...#####
###...#####
###...#####

zone clignotant 6-8 6-8 b
zone alterne 0-2 6-8 B
`;
  const def = parseModule(TEXT);
  const cells = (v: number) => buildModuleDef(def, v).ascii.split("\n\n")[0]!.split("\n");

  it("`+clignotant:<profil>` convertit les blocs de sa zone en `b`, déclare le cycle du profil pour la section du morceau ; la variante est réservée à la nuit", () => {
    const built = buildModuleDef(def, 1);
    const p = BLINK_PROFILES.moyen!;
    expect(built.ascii).toContain(`clignote essai-mut ${p.cycle} ${p.solid} ${p.shift}`);
    expect(built.level.blinkCycles).toEqual([p]);
    expect(built.level.blinks.length).toBe(3 * 3);
    expect(cells(1)[6]).toMatch(/bbb/);
    expect(variantTheme(def, 1)).toBe("nuit");
    expect(mutationLabel(def.mutations[1]!)).toBe("+clignotant:moyen");
    expect(buildModuleDef(def, 0).level.blinks.length).toBe(0);
  });

  it("`+alterne` convertit les blocs de sa zone en `B` (la zone désigne le jeu) ; la variante est réservée au néon ; aucun alterné sans la mutation", () => {
    const built = buildModuleDef(def, 2);
    expect(built.level.alts.length).toBe(3 * 3);
    expect(built.level.alts.every((a) => a.set === 1)).toBe(true);
    expect(variantTheme(def, 2)).toBe("neon");
    expect(variantTheme(def, 0)).toBeNull();
    expect(buildModuleDef(def, 0).level.alts.length).toBe(0);
  });

  it("refuse un profil inconnu, une zone qui ne tombe pas sur des blocs, une zone mal écrite", () => {
    expect(() => parseModule(TEXT.replace("+clignotant:moyen", "+clignotant:lave"))).toThrow(/argument/);
    expect(() => parseModule(TEXT.replace("zone alterne 0-2 6-8 B", "zone alterne 0-2 6-8 C"))).toThrow(/zone alterne/);
    expect(() => buildModuleDef(parseModule(TEXT.replace("zone alterne 0-2 6-8 B", "zone alterne 0-2 5-8 B")), 2)).toThrow(/au lieu d'un bloc/);
    expect(() => parseModule(TEXT.replace("mutateurs: clignotant alterne", "mutateurs: clignotant"))).toThrow(/absent de « mutateurs/);
  });

  it("un morceau natif déclare son cycle (`clignote` avec paramètres) et prend une étiquette et un thème qui vont ensemble", () => {
    const native = `id: essai-nat
intention: Un morceau natif.
etiquettes: precision clignotant
famille: essai-nat
theme: nuit
format: 3
paliers: 6 6
variante: cycle=120
variante: cycle=180
grille:
.....
.....
.....
.....
.....
.....
##b##
#####

clignote {cycle} 60 0
`;
    const d = parseModule(native);
    expect(buildModuleDef(d, 1).level.blinkCycles).toEqual([{ cycle: 180, solid: 60, shift: 0 }]);
    expect(() => parseModule(native.replace("theme: nuit\n", ""))).toThrow(/vont ensemble/);
    expect(() => parseModule(native.replace("etiquettes: precision clignotant", "etiquettes: precision"))).toThrow(/vont ensemble/);
  });
});
