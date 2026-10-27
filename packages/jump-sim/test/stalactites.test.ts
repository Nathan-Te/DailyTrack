import { Rng, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_RUNNING,
  DEATH_NAMES,
  DEATH_STALACTITE,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  LevelError,
  MAX_SPEED,
  MUSHROOM_GENERATOR,
  MUSHROOM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  STALACTITE_ACCEL,
  STALACTITE_DROP,
  STALACTITE_GENERATOR,
  STALACTITE_INTACT,
  STALACTITE_BROKEN,
  STALACTITE_MAX_STEP,
  STALACTITE_SHAKE_TICKS,
  STALACTITE_TILES,
  STALACTITE_VERSION,
  UNITS_PER_TILE,
  MODULES,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  buildModule,
  checkpointAttempt,
  dailyLevel,
  dailyProblems,
  freezeLevel,
  frozenJson,
  jumpThemeForDay,
  respawnProblems,
  thawLevel,
  decodeReplay,
  fromRuns,
  initialAttempt,
  moduleSolutions,
  palierProblems,
  stalactiteModuleIds,
  variantExigence,
  parseLevel,
  respawnAttempt,
  stalactiteBox,
  stalactiteOffset,
  stalactiteProblems,
  stalactiteRunProblems,
  stepAttempt,
  type AttemptEvents,
  type AttemptState,
  type Level,
} from "../src/index";

// Lot 24 : les stalactites (sim v8, générateur g18). Les niveaux sont de petits textes écrits ici.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;

const text = (rows: string[], annex: string[]) => rows.join("\n") + "\n\n" + annex.join("\n") + "\n";

/**
 * Une salle de 28 colonnes : un plafond plein à la rangée 0, un sol plein à partir de la rangée `floor` (le personnage se tient sur la rangée `floor − 1`). La stalactite `s`
 * pend de la rangée 1 dans la colonne 14 (corps : rangées 1 et 2), zone : colonnes `14 − before` à `14 + after`.
 */
function room(floor = 12, before = 3, after = 2, version = 8, extra: string[] = []): Level {
  const rows: string[] = [];
  for (let r = 0; r < floor + 2; r++) rows.push("#" + ".".repeat(26) + "#");
  rows[0] = "#".repeat(28);
  for (let r = floor; r < floor + 2; r++) rows[r] = "#".repeat(28);
  rows[floor - 1] = "#S" + ".".repeat(24) + "F#";
  return parseLevel(text(rows, [`version ${version}`, "section salle 0-27", `stalactite s 14,1 ${before} ${after}`, ...extra]));
}

/** Un état en course, le personnage posé sur le sol dans la colonne `col` (pieds sur la rangée `row`), à l'arrêt. */
function standing(level: Level, col: number, row: number): AttemptState {
  const s = initialAttempt(level);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  return { ...s, status: ATTEMPT_RUNNING, time: 1000, player: { ...s.player, x, y, ground: 1, air: 0 } };
}
const step = (s: AttemptState, bits: number, level: Level, events: AttemptEvents | null = null) => stepAttempt(s, bits, level, P, events);
const events = (): AttemptEvents => ({ mushroom: -1, boost: 0, shake: -1, shatter: -1 });

describe("lot 24 — la version de la simulation", () => {
  it("la version 8 est celle des stalactites, le générateur g18", () => {
    expect(STALACTITE_VERSION).toBe(8);
    expect(JUMP_SIM_VERSION).toBeGreaterThanOrEqual(8); // lot 25 : la version 9 (lasers) garde la 8
    expect(MUSHROOM_VERSION).toBe(7);
    expect(JUMP_GENERATOR_VERSION).toBeGreaterThanOrEqual(18); // lot 25 : g19 (lasers) garde g18
    expect(STALACTITE_GENERATOR).toBe(18);
    expect(room().simVersion).toBe(8);
  });

  it("une cause de mort de plus : stalactite", () => {
    expect(DEATH_STALACTITE).toBe(5);
    expect(DEATH_NAMES[DEATH_STALACTITE]).toBe("stalactite");
  });
});

describe("lot 24 — lecture du bloc annexe", () => {
  it("lit une stalactite : sa tuile, sa zone", () => {
    expect(room().stalactites).toEqual([{ id: "s", col: 14, row: 1, before: 3, after: 2 }]);
    expect(room(12, 1, 8).stalactites[0]).toMatchObject({ before: 1, after: 8 });
  });

  it("un niveau sans stalactite n'en a pas, et son état n'a pas le champ", () => {
    const l = parseLevel("#####\n#S.F#\n#####\n");
    expect(l.stalactites).toEqual([]);
    expect("stalactites" in initialAttempt(l)).toBe(false);
  });

  it("refuse ce qui est mal formé", () => {
    const bad = (line: string, rows?: string[]) => () => {
      const base: string[] = [];
      for (let i = 0; i < 14; i++) base.push("#" + ".".repeat(26) + "#");
      base[0] = "#".repeat(28);
      base[12] = "#".repeat(28);
      base[13] = "#".repeat(28);
      base[11] = "#S" + ".".repeat(24) + "F#";
      return parseLevel(text(rows ?? base, ["version 8", "section salle 0-27", line]));
    };
    expect(bad("stalactite s 14,1 3")).toThrow(/attendu/); // il manque « après »
    expect(bad("stalactite s 14 3 2")).toThrow(/attendu/);
    expect(bad("stalactite s 14,1 0 2")).toThrow(/1 à 8|de 1 à 8/); // zone vide à gauche
    expect(bad("stalactite s 14,1 3 9")).toThrow(LevelError); // zone trop large
    expect(bad("stalactite s 14,5 3 2")).toThrow(/accrochée/); // rien au-dessus
    expect(bad("stalactite s 14,0 3 2")).toThrow(/sort de la grille/); // pas de rangée pour le plafond
    expect(bad("stalactite s 14,13 3 2")).toThrow(/sort de la grille|accrochée|pas vide/);
    const low = ["#".repeat(28), ...Array.from({ length: 11 }, () => "#" + ".".repeat(26) + "#"), "#".repeat(28), "#".repeat(28)];
    low[11] = "#S" + ".".repeat(24) + "F#";
    low[2] = "#" + ".".repeat(13) + "#" + ".".repeat(12) + "#"; // un bloc dans le corps
    expect(bad("stalactite s 14,1 3 2", low)).toThrow(/corps/);
    expect(() => parseLevel(text(low, ["version 8", "section salle 0-27", "stalactite a 14,1 3 2", "stalactite b 14,1 2 2"]))).toThrow();
  });
});

describe("lot 24 — la chute (table entière)", () => {
  it("la table est entière, croissante, avec une vitesse qui plafonne à un quart de tuile par pas", () => {
    expect(STALACTITE_DROP[0]).toBe(0);
    expect(STALACTITE_DROP[1]).toBe(STALACTITE_ACCEL);
    expect(STALACTITE_DROP[2]).toBe(STALACTITE_ACCEL * 3);
    for (let k = 1; k < STALACTITE_DROP.length; k++) {
      expect(Number.isInteger(STALACTITE_DROP[k])).toBe(true);
      const v = STALACTITE_DROP[k]! - STALACTITE_DROP[k - 1]!;
      expect(v).toBe(Math.min(k * STALACTITE_ACCEL, STALACTITE_MAX_STEP));
      expect(v).toBeLessThan(MAX_SPEED);
    }
    expect(STALACTITE_DROP[STALACTITE_DROP.length - 1]! - STALACTITE_DROP[STALACTITE_DROP.length - 2]!).toBe(STALACTITE_MAX_STEP);
  });

  it("elle ne bouge pas pendant le tremblement (60 pas), puis tombe : la position vient de l'âge seul", () => {
    expect(STALACTITE_SHAKE_TICKS).toBe(60);
    for (let age = 1; age <= STALACTITE_SHAKE_TICKS; age++) expect(stalactiteOffset(age), `âge ${age}`).toBe(0);
    expect(stalactiteOffset(STALACTITE_SHAKE_TICKS + 1)).toBe(STALACTITE_DROP[1]);
    expect(stalactiteOffset(STALACTITE_SHAKE_TICKS + 10)).toBe(STALACTITE_DROP[10]);
    const last = STALACTITE_DROP.length - 1;
    expect(stalactiteOffset(STALACTITE_SHAKE_TICKS + last + 5)).toBe(STALACTITE_DROP[last]! + 5 * STALACTITE_MAX_STEP);
    // Entière et croissante sur toute la plage.
    let prev = 0;
    for (let age = 1; age < 400; age++) {
      const o = stalactiteOffset(age);
      expect(Number.isInteger(o)).toBe(true);
      expect(o).toBeGreaterThanOrEqual(prev);
      prev = o;
    }
  });

  it("sa boîte mortelle est son corps (2 tuiles), un peu plus étroit que la tuile", () => {
    const b = stalactiteBox({ col: 14, row: 1 }, 0);
    expect(b).toEqual({ x: 14 * T + 1024, y: T, w: T - 2048, h: STALACTITE_TILES * T });
    expect(stalactiteBox({ col: 14, row: 1 }, 500).y).toBe(T + 500);
  });
});

describe("lot 24 — le déclenchement", () => {
  it("elle se déclenche au pas où le centre du personnage entre dans la zone, pas avant", () => {
    const level = room(); // zone : colonnes 11 à 16
    let s = standing(level, 9, 11);
    const ev = events();
    let triggeredAt = -1;
    for (let t = 1; t <= 200; t++) {
      s = step(s, INPUT_RIGHT, level, ev);
      const col = Math.floor((s.player.x + PLAYER_WIDTH / 2) / T);
      if (s.stalactites![0] !== STALACTITE_INTACT) {
        triggeredAt = t;
        expect(col, "le centre est dans la zone").toBeGreaterThanOrEqual(11);
        expect(ev.shake).toBe(0);
        expect(s.stalactites![0]).toBe(1); // âge 1 au pas du déclenchement
        break;
      }
      expect(col, `pas ${t} : hors de la zone`).toBeLessThan(11);
      expect(ev.shake).toBe(-1);
    }
    expect(triggeredAt).toBeGreaterThan(0);
  });

  it("le dernier pas avant la zone ne la déclenche pas ; la même zone, vue de la droite, la déclenche aussi", () => {
    const level = room();
    // Au bord gauche : le centre à 11 × T − 1 (colonne 10) puis le premier pas qui passe la colonne 11.
    let s = standing(level, 10, 11);
    s = { ...s, player: { ...s.player, x: 11 * T - PLAYER_WIDTH / 2 - 1 } };
    expect(Math.floor((s.player.x + PLAYER_WIDTH / 2) / T)).toBe(10);
    s = step(s, 0, level);
    expect(s.stalactites![0]).toBe(STALACTITE_INTACT);
    const right = standing(level, 18, 11);
    let r = right;
    for (let t = 0; t < 100 && r.stalactites![0] === STALACTITE_INTACT; t++) r = step(r, INPUT_LEFT, level);
    expect(r.stalactites![0]).toBeGreaterThan(0);
  });

  it("hors de la zone (au-dessus du plafond, ou trop loin), rien ne se déclenche ; intacte, elle ne tue pas", () => {
    const level = room();
    let s = standing(level, 3, 11);
    for (let t = 0; t < 300; t++) s = step(s, 0, level);
    expect(s.stalactites).toEqual([STALACTITE_INTACT]);
    expect(s.status).toBe(ATTEMPT_RUNNING);
  });

  it("une stalactite déjà déclenchée ne se redéclenche pas, une brisée non plus", () => {
    const level = room();
    let s = standing(level, 12, 11);
    const seen: number[] = [];
    for (let t = 0; t < 400; t++) {
      s = step(s, 0, level);
      seen.push(s.stalactites![0]!);
      if (s.status === ATTEMPT_DEAD) break;
    }
    // L'âge ne fait que croître (le personnage n'est pas sous le corps : colonne 12) puis la stalactite est brisée.
    for (let i = 1; i < seen.length; i++) {
      const a = seen[i - 1]!;
      const b = seen[i]!;
      expect(b === a + 1 || b === STALACTITE_BROKEN || (a === STALACTITE_BROKEN && b === STALACTITE_BROKEN)).toBe(true);
    }
    expect(seen[seen.length - 1]).toBe(STALACTITE_BROKEN);
  });
});

describe("lot 24 — le tremblement", () => {
  it("elle tremble exactement 60 pas : son corps ne bouge pas, puis elle tombe au 61e", () => {
    const level = room();
    let s = standing(level, 12, 11);
    s = step(s, 0, level); // colonne 12 : dans la zone, déclenchée tout de suite
    expect(s.stalactites![0]).toBe(1);
    const tops: number[] = [];
    for (let t = 0; t < 70; t++) {
      tops.push(stalactiteBox(level.stalactites[0]!, stalactiteOffset(s.stalactites![0]!)).y);
      s = step(s, 0, level);
    }
    // âges 1 à 60 : même position ; le 61e est plus bas.
    for (let i = 0; i < STALACTITE_SHAKE_TICKS; i++) expect(tops[i], `âge ${i + 1}`).toBe(T);
    expect(tops[STALACTITE_SHAKE_TICKS]).toBeGreaterThan(T);
  });

  it("elle tue au contact pendant le tremblement : un corps trop bas pour le personnage", () => {
    // Un plafond à la rangée 9 sur la zone : la stalactite (corps : rangées 10 et 11) pend jusqu'au sol (rangée 12), à hauteur du personnage debout (pieds sur la rangée 11).
    const rows: string[] = [];
    for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(26) + "#");
    rows[0] = "#".repeat(28);
    rows[12] = rows[13] = "#".repeat(28);
    rows[11] = "#S" + ".".repeat(24) + "F#";
    for (let c = 8; c <= 18; c++) rows[9] = rows[9]!.slice(0, c) + "#" + rows[9]!.slice(c + 1);
    const level = parseLevel(text(rows, ["version 8", "section salle 0-27", "stalactite s 14,10 3 2"]));
    let s = standing(level, 11, 11);
    // Il entre dans la zone (colonne 11) et court vers le corps, qui pend jusqu'au sol et tremble : il le touche avant la chute.
    s = step(s, INPUT_RIGHT, level);
    expect(s.stalactites![0]).toBeGreaterThan(0);
    let died = -1;
    for (let t = 0; t < 80; t++) {
      s = step(s, INPUT_RIGHT, level);
      if (s.status === ATTEMPT_DEAD) {
        died = t;
        break;
      }
    }
    expect(died).toBeGreaterThan(0);
    expect(s.deathCause).toBe(DEATH_STALACTITE);
    expect(s.stalactites![0]).toBeLessThanOrEqual(STALACTITE_SHAKE_TICKS); // mort pendant le tremblement
  });
});

describe("lot 24 — la chute et la casse", () => {
  it("elle tue au contact pendant la chute : le personnage reste dessous, au pas exact que donne la table", () => {
    const level = room(); // sol : rangée 12 ; pieds sur la rangée 11 ; tête à 11,25 × T
    let s = standing(level, 14, 11);
    let n = 0;
    while (s.status !== ATTEMPT_DEAD && n < 300) {
      s = step(s, 0, level);
      n++;
    }
    expect(s.status).toBe(ATTEMPT_DEAD);
    expect(s.deathCause).toBe(DEATH_STALACTITE);
    // Le pas de la mort : le premier âge dont le corps (bas à 3 × T + décalage) recouvre la tête du personnage (11 × T + 1024 = 11,25 × T).
    const head = 12 * T - PLAYER_HEIGHT;
    let age = 1;
    while (3 * T + stalactiteOffset(age) <= head) age++;
    expect(n).toBe(age);
    expect(age).toBeGreaterThan(STALACTITE_SHAKE_TICKS);
  });

  it("elle se brise au contact d'un plein et disparaît : brisée, elle ne tue plus", () => {
    const level = room();
    const ev = events();
    let s = standing(level, 12, 11);
    let brokenAt = -1;
    for (let t = 1; t < 400; t++) {
      s = step(s, 0, level, ev);
      if (ev.shatter === 0) {
        brokenAt = t;
        break;
      }
    }
    expect(brokenAt).toBeGreaterThan(0);
    expect(s.stalactites![0]).toBe(STALACTITE_BROKEN);
    // Le premier âge dont le corps entre dans le sol (rangée 12) : bas du corps = 3 × T + décalage > 12 × T. (Le déclenchement a eu lieu au pas 1 : âge 1.)
    let age = 1;
    while (3 * T + stalactiteOffset(age) <= 12 * T) age++;
    expect(brokenAt).toBe(age);
    // Plus aucune mort : le personnage va se mettre dessous.
    for (let t = 0; t < 200; t++) s = step(s, t < 40 ? INPUT_RIGHT : INPUT_LEFT, level);
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.stalactites![0]).toBe(STALACTITE_BROKEN);
  });

  it("au-dessus d'un trou sans fond, elle sort de la grille et disparaît (elle ne tombe pas à l'infini)", () => {
    const rows: string[] = [];
    for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(26) + "#");
    rows[0] = "#".repeat(28);
    for (let c = 1; c < 27; c++) {
      if (c >= 10 && c <= 18) continue;
      rows[12] = rows[12]!.slice(0, c) + "#" + rows[12]!.slice(c + 1);
    }
    rows[12] = "#" + "#".repeat(9) + ".".repeat(9) + "#".repeat(9);
    rows[12] = rows[12]!.padEnd(28, "#");
    rows[11] = "#S" + ".".repeat(24) + "F#";
    const level = parseLevel(text(rows.slice(0, 13), ["version 8", "section salle 0-27", "stalactite s 14,1 3 2"]));
    let s = standing(level, 12, 11);
    s = { ...s, player: { ...s.player, x: 20 * T, y: 12 * T - PLAYER_HEIGHT } };
    s = { ...s, stalactites: [1] };
    for (let t = 0; t < 300; t++) s = step(s, 0, level);
    expect(s.stalactites![0]).toBe(STALACTITE_BROKEN);
  });
});

describe("lot 24 — la remise en place à la reprise (comme les blocs friables)", () => {
  it("la mort ramène la stalactite intacte, au départ comme à un point de passage", () => {
    const level = room();
    let s = standing(level, 14, 11);
    while (s.status !== ATTEMPT_DEAD) s = step(s, 0, level);
    expect(s.stalactites![0]).toBeGreaterThan(0);
    // En v8 (une seule horloge) la mort reprend au départ : `RESPAWN_TICKS` pas plus tard, tout est remis en place.
    for (let t = 0; t < RESPAWN_TICKS; t++) s = step(s, 0, level);
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.stalactites).toEqual([STALACTITE_INTACT]);
    // Les deux fonctions de reprise la remettent aussi intacte, même brisée.
    const broken = { ...s, stalactites: [STALACTITE_BROKEN] };
    expect(respawnAttempt(level, broken).stalactites).toEqual([STALACTITE_INTACT]);
    const withCheckpoint = parseLevel(text(roomRowsWithCheckpoint(), ["version 8", "section salle 0-27", "stalactite s 14,1 3 2"]));
    expect(checkpointAttempt(withCheckpoint, { ...initialAttempt(withCheckpoint), checkpoint: 0, stalactites: [37] }).stalactites).toEqual([STALACTITE_INTACT]);
  });

  it("elle continue de tomber pendant l'attente de la reprise (affichage), puis revient intacte", () => {
    const level = room();
    let s = standing(level, 14, 11);
    while (s.status !== ATTEMPT_DEAD) s = step(s, 0, level);
    const age = s.stalactites![0]!;
    s = step(s, 0, level);
    expect(s.status).toBe(ATTEMPT_DEAD);
    expect(s.stalactites![0] === age + 1 || s.stalactites![0] === STALACTITE_BROKEN).toBe(true);
  });
});

function roomRowsWithCheckpoint(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(26) + "#");
  rows[0] = "#".repeat(28);
  rows[12] = rows[13] = "#".repeat(28);
  rows[11] = "#S" + ".".repeat(6) + "C" + ".".repeat(17) + "F#";
  return rows;
}

describe("lot 24 — un niveau sans stalactite se joue comme en v7", () => {
  const rows = (): string[] => {
    const r: string[] = [];
    for (let i = 0; i < 14; i++) r.push("#" + ".".repeat(26) + "#");
    r[0] = "#".repeat(28);
    r[12] = r[13] = "#".repeat(28);
    r[11] = "#S" + ".".repeat(24) + "F#";
    r[11] = r[11]!.slice(0, 10) + "^" + r[11]!.slice(11);
    r[10] = r[10]!.slice(0, 20) + "#" + r[10]!.slice(21);
    return r;
  };
  it("le même niveau en version 7 et en version 8 : états égaux au pas près (aucun champ de plus)", () => {
    const l7 = parseLevel(text(rows(), ["version 7", "section salle 0-27"]));
    const l8 = parseLevel(text(rows(), ["version 8", "section salle 0-27"]));
    expect(l8.simVersion).toBe(8);
    const rng = new Rng(2410);
    let a = initialAttempt(l7);
    let b = initialAttempt(l8);
    for (let t = 0; t < 1500; t++) {
      const input = rng.int(8);
      a = stepAttempt(a, input, l7, P);
      b = stepAttempt(b, input, l8, P);
      expect(b, `pas ${t}`).toEqual(a);
      expect("stalactites" in b).toBe(false);
    }
  });
});

describe("lot 24 — intégrité (fuzz)", () => {
  it("des commandes aléatoires : tout reste entier, sans −0, sous MAX_SPEED ; les états des stalactites ne font que croître jusqu'à la casse", () => {
    const level = room(12, 3, 2, 8);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const rng = new Rng(seed * 7919);
      let s = standing(level, 6 + seed, 11);
      let prev = s.stalactites![0]!;
      for (let t = 0; t < 1200; t++) {
        s = stepAttempt(s, rng.int(8), level, P);
        const v = s.stalactites![0]!;
        expect(Number.isInteger(v)).toBe(true);
        expect(Object.is(v, -0)).toBe(false);
        if (s.status === ATTEMPT_DEAD && s.deathTicks === 0) prev = v; // la mort ne change pas la règle ci-dessous
        else if (prev === STALACTITE_INTACT) expect(v === 0 || v === 1).toBe(true);
        else if (prev > 0) expect(v === prev + 1 || v === STALACTITE_BROKEN || v === STALACTITE_INTACT).toBe(true); // intact : après une reprise
        else if (prev === STALACTITE_BROKEN) expect(v === STALACTITE_BROKEN || v === STALACTITE_INTACT).toBe(true);
        prev = v;
        for (const n of [s.player.x, s.player.y, s.player.vx, s.player.vy]) {
          expect(Number.isInteger(n)).toBe(true);
          expect(Object.is(n, -0)).toBe(false);
        }
        expect(Math.abs(s.player.vx)).toBeLessThanOrEqual(MAX_SPEED);
        expect(Math.abs(s.player.vy)).toBeLessThanOrEqual(MAX_SPEED);
      }
    }
  });
});

describe("lot 24 — règles du générateur", () => {
  it("la pose d'une salle simple est conforme", () => {
    expect(stalactiteProblems(room())).toEqual([]);
  });

  it("la course franche : un joueur qui continue à pleine vitesse n'est jamais touché", () => {
    for (const [before, after] of [[1, 1], [2, 2], [3, 2], [4, 3], [5, 2]] as const) expect(stalactiteRunProblems(room(12, before, after)), `zone ${before}-${after}`).toEqual([]);
  });

  it("la course franche refuse un plafond trop bas : le corps qui tremble touche la tête du coureur", () => {
    // Sol à la rangée 4 : pieds sur la rangée 3 ; le corps (rangées 1-2) finit à 3 × T, la tête est à 3,25 × T... on abaisse le sol : rangée 3 → tête à 2,25 × T < bas du corps.
    const problems = stalactiteRunProblems(room(3, 3, 2));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatch(/touche un joueur qui court/);
  });

  it("la course franche refuse une zone trop longue devant une chute trop courte : le corps rattrape le coureur", () => {
    // Zone de 8 colonnes devant, sol proche (rangée 6 : 4 tuiles de chute libre) : le coureur est encore sous le corps quand il atteint sa tête.
    const problems = stalactiteRunProblems(room(6, 8, 2));
    expect(problems.length).toBeGreaterThan(0);
  });

  it("la pose refuse une stalactite sans sol pour la briser, ou dont le corps est calé sur un plein", () => {
    const rows: string[] = [];
    for (let r = 0; r < 20; r++) rows.push("#" + ".".repeat(26) + "#");
    rows[0] = "#".repeat(28);
    rows[19] = "#".repeat(28);
    rows[18] = "#S" + ".".repeat(24) + "F#";
    const far = parseLevel(text(rows, ["version 8", "section salle 0-27", "stalactite s 14,1 3 2"]));
    expect(stalactiteProblems(far).join(" ")).toMatch(/aucun bloc plein/);
    const wedged = rows.slice();
    wedged[3] = "#" + ".".repeat(13) + "#" + ".".repeat(12) + "#";
    const w = parseLevel(text(wedged, ["version 8", "section salle 0-27", "stalactite s 14,1 3 2"]));
    expect(stalactiteProblems(w).join(" ")).toMatch(/rien ne peut tomber/);
  });

  it("la zone reste dans son morceau, loin de tout palier de départ, de point de passage ou d'arrivée (aucun point dans une zone ni sous une chute)", () => {
    expect(stalactiteProblems(parseLevel(text(roomRowsWithCheckpoint(), ["version 8", "section salle 0-27", "stalactite s 14,1 3 2"])))).toEqual([]); // zone 11-16 : le point (colonne 8) et son palier (8-9) sont loin
    // Un point de passage en colonne 12, dans la zone 11-16 : refusé.
    const rows = roomRowsWithCheckpoint();
    rows[11] = "#S" + ".".repeat(9) + "C" + ".".repeat(14) + "F#";
    const inside = parseLevel(text(rows, ["version 8", "section salle 0-27", "stalactite s 14,1 3 2"]));
    expect(stalactiteProblems(inside).join(" ")).toMatch(/point 1/);
    // Une zone qui sort de la section.
    const out = parseLevel(text(roomRowsWithCheckpoint().map((r) => r.replace("C", ".")), ["version 8", "section salle 8-19", "stalactite s 14,1 8 2"]));
    expect(stalactiteProblems(out).join(" ")).toMatch(/sort de la section/);
  });
});

// ——— Les morceaux du catalogue ———

const STALACTITE_MODULES = MODULES.filter((m) => m.tags.includes("stalactite"));
const usable = (id: string, v: number) => !PHASE_REFUSED[id]?.includes(v) && !PARASITE_CLOSED[id]?.includes(v);
const bitsOf = (id: string, v: number, entry: "arret" | "elan") => fromRuns(decodeReplay(moduleSolutions(id, v)![entry]!.code).runs);

/** Joue la solution d'un morceau seul (comme le solveur : l'entrée « élan » part à la vitesse de course) ; rend les états après chaque pas. */
function playSolution(id: string, v: number, entry: "arret" | "elan"): { level: Level; states: AttemptState[] } {
  const m = buildModule(id, v);
  let s = initialAttempt(m.level);
  if (entry === "elan") s = { ...s, player: { ...s.player, vx: P.runSpeed } };
  const states: AttemptState[] = [];
  for (const b of bitsOf(id, v, entry)) {
    s = stepAttempt(s, b, m.level, P);
    states.push(s);
  }
  return { level: m.level, states };
}

describe("lot 24 — les morceaux du catalogue", () => {
  it("de 6 à 8 morceaux de base, réservés à la v8 (stalactiteModuleIds), tous de la glace", () => {
    expect(STALACTITE_MODULES.length).toBeGreaterThanOrEqual(6);
    expect(STALACTITE_MODULES.length).toBeLessThanOrEqual(8);
    expect([...stalactiteModuleIds()].sort()).toEqual(STALACTITE_MODULES.map((m) => m.id).sort());
    for (const def of STALACTITE_MODULES) expect(def.theme, def.id).toBe("glace");
  });

  it("chaque variante se construit, passe les règles de pose et de la course franche, et a une solution aux deux entrées", () => {
    let variants = 0;
    for (const def of STALACTITE_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const label = `${def.id} v${v}`;
        const m = buildModule(def.id, v);
        expect(m.level.stalactites.length, label).toBeGreaterThan(0);
        expect(palierProblems(m), label).toEqual([]);
        expect(stalactiteProblems(m.level), label).toEqual([]);
        expect(stalactiteRunProblems(m.level), label).toEqual([]);
        const sol = moduleSolutions(def.id, v)!;
        for (const entry of ["arret", "elan"] as const) expect(sol[entry]!.exigence, `${label} ${entry}`).toBeGreaterThanOrEqual(1);
        if (usable(def.id, v)) variants++;
      }
    }
    expect(variants).toBeGreaterThanOrEqual(20);
  });

  it("au moins 1 respiration (note ≤ 2, trois sauts), 2 portions dures (une variante notée 4 ou 5), 2 morceaux qui combinent stalactites et glace, 1 morceau où l'on déclenche exprès", () => {
    const rest = STALACTITE_MODULES.filter((m) => m.tags.includes("respiration"));
    expect(rest.length).toBeGreaterThanOrEqual(1);
    for (const def of rest) {
      for (let v = 0; v < def.variants.length; v++) {
        expect(variantExigence(moduleSolutions(def.id, v)), `${def.id} v${v}`).toBeLessThanOrEqual(2);
        for (const entry of ["arret", "elan"] as const) {
          const bits = bitsOf(def.id, v, entry);
          const jumps = bits.filter((b, t) => (b & INPUT_JUMP) !== 0 && (t === 0 || (bits[t - 1]! & INPUT_JUMP) === 0)).length;
          expect(jumps, `${def.id} v${v} ${entry}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
    const hard = STALACTITE_MODULES.filter((def) => def.variants.some((_, v) => usable(def.id, v) && variantExigence(moduleSolutions(def.id, v)) >= 4));
    expect(hard.length, "portions dures").toBeGreaterThanOrEqual(2);
    expect(STALACTITE_MODULES.filter((m) => m.tags.includes("glace")).length, "stalactites et glace").toBeGreaterThanOrEqual(2);
    expect(STALACTITE_MODULES.some((m) => m.id === "stalactite-decroche")).toBe(true);
  });

  it("la solution de chaque variante déclenche vraiment au moins une stalactite et arrive sans mourir, aux deux entrées", () => {
    for (const def of STALACTITE_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        for (const entry of ["arret", "elan"] as const) {
          const { states } = playSolution(def.id, v, entry);
          const label = `${def.id} v${v} ${entry}`;
          expect(states.some((s) => s.status === ATTEMPT_DEAD), label).toBe(false);
          expect(states[states.length - 1]!.stalactites!.some((a) => a !== STALACTITE_INTACT), label).toBe(true);
        }
      }
    }
  });

  it("« stalactite-decroche » : la solution passe là où la stalactite pendait, une fois tombée (sans elle, le saut la frôlerait : il faut la déclencher, reculer et attendre)", () => {
    const def = MODULES.find((m) => m.id === "stalactite-decroche")!;
    for (let v = 0; v < def.variants.length; v++) {
      for (const entry of ["arret", "elan"] as const) {
        const { level, states } = playSolution(def.id, v, entry);
        const hanging = stalactiteBox(level.stalactites[0]!, 0);
        const label = `${def.id} v${v} ${entry}`;
        let through = 0;
        for (const s of states) {
          const b = { x: s.player.x, y: s.player.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
          const overlaps = b.x < hanging.x + hanging.w && hanging.x < b.x + b.w && b.y < hanging.y + hanging.h && hanging.y < b.y + b.h;
          if (!overlaps) continue;
          const age = s.stalactites![0]!;
          // Avant la chute (âge 1 à 60) ou intacte, le corps est là et tue : jamais dedans.
          expect(age === STALACTITE_BROKEN || age > STALACTITE_SHAKE_TICKS, `${label} : dans le corps à l'âge ${age}`).toBe(true);
          through++;
        }
        expect(through, label).toBeGreaterThan(0);
      }
    }
  });
});

describe("lot 24 — les niveaux du jour", () => {
  it("les références v3 à v7 ne connaissent pas les morceaux à stalactites ; le générateur en vigueur (g18, v8) les pose, et seulement dans la glace", () => {
    const ids = stalactiteModuleIds();
    const start = parseDay("2026-10-27")!;
    let withStalactites = 0;
    for (let d = start; d < start + 30; d++) {
      for (const version of [3, 4, 5, 6, MUSHROOM_VERSION]) {
        const old = dailyLevel(d, null, version);
        expect(old.pieces.some((p) => ids.has(p.id)), `${old.date} v${version}`).toBe(false);
        expect(old.level.stalactites, `${old.date} v${version}`).toEqual([]);
      }
      expect(dailyLevel(d, null, MUSHROOM_VERSION).id).toBe(`jour-${dailyLevel(d, null, STALACTITE_VERSION).date}-g${MUSHROOM_GENERATOR}`);
      const L = dailyLevel(d, null, STALACTITE_VERSION); // lot 25 : la référence v8 (g18)
      expect(L.level.simVersion).toBe(8);
      expect(L.id).toBe(`jour-${L.date}-g${STALACTITE_GENERATOR}`);
      expect(L.fallback, L.date).toBe(false);
      if (L.pieces.some((p) => ids.has(p.id))) {
        withStalactites++;
        expect(L.theme, L.date).toBe("glace");
        expect(L.level.stalactites.length, L.date).toBeGreaterThan(0);
      } else expect(L.level.stalactites, L.date).toEqual([]);
    }
    expect(withStalactites).toBeGreaterThanOrEqual(1);
  }, 240_000);

  it("les jours de glace à stalactites passent toutes les règles ; la preuve de l'auteur en déclenche sans mourir", () => {
    const ids = stalactiteModuleIds();
    let n = 0;
    for (let d = parseDay("2026-10-27")!; d < parseDay("2026-10-27")! + 90 && n < 6; d++) {
      if (jumpThemeForDay(d) !== "glace") continue;
      const L = dailyLevel(d, null, STALACTITE_VERSION); // lot 25 : la référence v8 (g18)
      if (!L.pieces.some((p) => ids.has(p.id))) continue;
      n++;
      expect(dailyProblems(L), L.date).toEqual([]);
      expect(respawnProblems(L.level), L.date).toEqual([]);
      expect(stalactiteProblems(L.level), L.date).toEqual([]);
      let s = initialAttempt(L.level);
      for (const b of fromRuns(L.replay.runs)) {
        s = stepAttempt(s, b, L.level, P);
        expect(s.status, L.date).not.toBe(ATTEMPT_DEAD);
      }
      expect(s.stalactites!.some((a) => a !== STALACTITE_INTACT), `${L.date} : la preuve déclenche une stalactite`).toBe(true);
    }
    expect(n).toBeGreaterThanOrEqual(3);
  }, 240_000);

  it("un jour à stalactites se fige et se relit (versions 8 et g18) ; une version incohérente est refusée", () => {
    const ids = stalactiteModuleIds();
    const day = parseDay("2026-12-08")!;
    const L = dailyLevel(day, null, STALACTITE_VERSION);
    expect(L.pieces.some((p) => ids.has(p.id))).toBe(true);
    const raw = JSON.parse(frozenJson(freezeLevel(L)));
    expect(raw.simVersion).toBe(8);
    expect(raw.generatorVersion).toBe(STALACTITE_GENERATOR);
    const back = thawLevel(raw, day);
    expect(typeof back).not.toBe("string");
    if (typeof back === "string") return;
    expect(back.ascii).toBe(L.ascii);
    expect(back.level.stalactites).toEqual(L.level.stalactites);
    expect(back.code).toBe(L.code);
    expect(thawLevel({ ...raw, generatorVersion: MUSHROOM_GENERATOR }, day)).toBe("versions incohérentes");
    expect(thawLevel({ ...raw, simVersion: MUSHROOM_VERSION }, day)).toBe("versions incohérentes");
  }, 240_000);
});
