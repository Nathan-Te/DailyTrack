import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  CRUMBLE_GONE,
  CRUMBLE_INTACT,
  DEATH_FALL,
  DEATH_NONE,
  DEATH_SAW,
  DEATH_SPIKE,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  LevelError,
  MAX_LEVEL_HEIGHT,
  MAX_LEVEL_WIDTH,
  MAX_SAW_CYCLE,
  MAX_SAW_POINTS,
  MAX_SAW_RADIUS,
  MAX_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  SAW_BIG_RADIUS,
  SAW_SMALL_RADIUS,
  SPIKE_DEPTH,
  SPIKE_INSET,
  TILE_CRUMBLE,
  TILE_EMPTY,
  TILE_SOLID,
  TILE_SPIKE_DOWN,
  TILE_SPIKE_LEFT,
  TILE_SPIKE_RIGHT,
  TILE_SPIKE_UP,
  TILE_SPRING,
  ESSAI_LEVEL,
  UNITS_PER_TILE,
  boxHits,
  boxDistance2,
  circleHitsBox,
  deathAt,
  initialAttempt,
  parseLevel,
  sawCenter,
  sawCenters,
  spikeBox,
  stepAttempt,
  tileAt,
  type AttemptState,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";

// Lot 2 : éléments de niveau (pics, scies fixes et mobiles, sections, blocs friables, ressorts, bas de la grille) et règles d'un essai
// (le monde attend, chrono, mort, réapparition, remise à zéro, arrivée). Petits niveaux écrits pour chaque test.

const T = UNITS_PER_TILE;
const P: Readonly<JumpParams> = DEFAULT_JUMP_PARAMS;
const R = INPUT_RIGHT;
const L = INPUT_LEFT;
const J = INPUT_JUMP;

/** L'essai avec le personnage déplacé (le reste à l'état initial, en course). */
function at(level: Level, player: Partial<PlayerState>, extra: Partial<AttemptState> = {}): AttemptState {
  const s = initialAttempt(level);
  return { ...s, status: ATTEMPT_RUNNING, player: { ...s.player, ...player }, ...extra };
}

function run(level: Level, s: AttemptState, input: number, n: number, params: Readonly<JumpParams> = P): AttemptState {
  for (let i = 0; i < n; i++) s = stepAttempt(s, input, level, params);
  return s;
}

/** Vrai si courir puis sauter (saut complet) à un certain pas mène à l'arrivée sans mourir. */
function clearsBy(level: Level): boolean {
  for (let jt = 1; jt < 120; jt++) {
    let s = initialAttempt(level);
    for (let t = 0; t < 400 && s.status !== ATTEMPT_DEAD && s.status !== ATTEMPT_FINISHED; t++) s = stepAttempt(s, t >= jt && t < jt + 45 ? R | J : R, level, P);
    if (s.status === ATTEMPT_FINISHED) return true;
  }
  return false;
}

/** Joue jusqu'à la mort (ou `max` pas) ; rend l'état et le nombre de pas. */
function untilDead(level: Level, s: AttemptState, input: number | ((s: AttemptState) => number), max = 600): { state: AttemptState; ticks: number } {
  for (let t = 1; t <= max; t++) {
    s = stepAttempt(s, typeof input === "number" ? input : input(s), level, P);
    if (s.status === ATTEMPT_DEAD) return { state: s, ticks: t };
  }
  return { state: s, ticks: -1 };
}

describe("lecture des éléments (parseLevel)", () => {
  const lv = parseLevel(`
#S.^v<>oOx*F#
#############

section a 0-6
section b 7-12
scie m1 o 120 aller-retour 2,0 5,0
scie m2 0.75 60 boucle 8,0 10,0 10,1
`);

  it("chaque caractère donne sa tuile ; les scies `o` `O` sont des tuiles vides avec une scie fixe", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((c) => tileAt(lv, c, 0))).toEqual([
      TILE_EMPTY,
      TILE_EMPTY,
      TILE_SPIKE_UP,
      TILE_SPIKE_DOWN,
      TILE_SPIKE_LEFT,
      TILE_SPIKE_RIGHT,
      TILE_EMPTY,
      TILE_EMPTY,
      TILE_CRUMBLE,
      TILE_SPRING,
      TILE_EMPTY,
    ]);
    expect(lv.saws.slice(0, 2).map((s) => [s.id, s.radius, s.mode, s.section])).toEqual([
      ["o0", SAW_SMALL_RADIUS, "fixe", -1],
      ["O1", SAW_BIG_RADIUS, "fixe", -1],
    ]);
    expect(lv.saws[0]!.points[0]).toEqual({ x: 7 * T + T / 2, y: T / 2 });
    expect(lv.crumbles).toEqual([{ col: 9, row: 0 }]);
    expect(lv.crumbleIndex[9]).toBe(0);
    expect(lv.crumbleIndex[8]).toBe(-1);
  });

  it("lit les sections et les scies mobiles du bloc annexe (rayon en tuiles, cycle, mode, points, section du premier point)", () => {
    expect(lv.sections).toEqual([
      { name: "a", c0: 0, c1: 6 },
      { name: "b", c0: 7, c1: 12 },
    ]);
    const [m1, m2] = lv.saws.slice(2);
    expect(m1).toMatchObject({ id: "m1", radius: SAW_SMALL_RADIUS, cycle: 120, mode: "aller-retour", section: 0 });
    expect(m2).toMatchObject({ id: "m2", radius: 3072, cycle: 60, mode: "boucle", section: 1 });
    expect(m2!.points).toEqual([
      { x: 8 * T + T / 2, y: T / 2 },
      { x: 10 * T + T / 2, y: T / 2 },
      { x: 10 * T + T / 2, y: T + T / 2 },
    ]);
  });

  it("refuse un bloc annexe mal formé", () => {
    const grid = "S.F\n###\n\n";
    expect(() => parseLevel(grid + "porte 1 2")).toThrow("déclaration « porte » inconnue");
    expect(() => parseLevel(grid + "section a 2-1")).toThrow(LevelError);
    expect(() => parseLevel(grid + "section a 0-1\nsection b 1-2")).toThrow("chevauche");
    expect(() => parseLevel(grid + "section a 0-1\nscie s o 60 boucle 2,0 1,0")).toThrow("aucune section");
    expect(() => parseLevel(grid + "section a 0-2\nscie s o 60 zigzag 0,0 1,0")).toThrow("mode « zigzag »");
    expect(() => parseLevel(grid + "section a 0-2\nscie s o 0 boucle 0,0 1,0")).toThrow("cycle");
    expect(() => parseLevel(grid + `section a 0-2\nscie s o ${MAX_SAW_CYCLE + 1} boucle 0,0 1,0`)).toThrow("cycle");
    expect(() => parseLevel(grid + "section a 0-2\nscie s 5 60 boucle 0,0 1,0")).toThrow("rayon");
    expect(() => parseLevel(grid + "section a 0-2\nscie s o 60 boucle 0,0 9,0")).toThrow("hors de la grille");
    expect(() => parseLevel(grid + "section a 0-2\nscie s o 60 boucle 0,0")).toThrow("attendu");
    expect(() => parseLevel(grid + `section a 0-2\nscie s o 60 boucle ${Array(MAX_SAW_POINTS + 1).fill("0,0").join(" ")}`)).toThrow("au plus");
    expect(() => parseLevel(`S${".".repeat(MAX_LEVEL_WIDTH)}F\n${"#".repeat(MAX_LEVEL_WIDTH + 2)}`)).toThrow("trop grand");
    // Un commentaire et des lignes vides passent.
    expect(parseLevel(grid + "// rien\n\nsection a 0-2").sections).toHaveLength(1);
  });

  it("le bas de la grille est ouvert, les trois autres bords restent pleins", () => {
    for (const [c, r] of [[-1, 0], [13, 0], [0, -1]] as const) expect(tileAt(lv, c, r)).toBe(TILE_SOLID);
    expect(tileAt(lv, 3, 2)).toBe(TILE_EMPTY);
    expect(tileAt(lv, 3, 40)).toBe(TILE_EMPTY);
  });
});

describe("pics : mortels de face, sûrs quand on les longe", () => {
  // Un pic seul au milieu d'une salle de 9 × 9 (rangées 1 à 9), centre en (5, 5).
  const room = (ch: string) => {
    const rows = ["###########"];
    for (let r = 1; r <= 9; r++) rows.push(`#${r === 9 ? "S......F." : r === 5 ? `....${ch}....` : "........."}#`);
    rows.push("###########");
    return parseLevel(rows.join("\n"));
  };
  const C = 5 * T; // coin haut-gauche de la tuile du pic
  const W = PLAYER_WIDTH;
  const H = PLAYER_HEIGHT;
  const dies = (lv: Level, x: number, y: number) => deathAt(lv, at(lv, { x, y })) === DEATH_SPIKE;

  it("la boîte mortelle est la moitié côté base, en retrait de ¼ sur les flancs, et tient dans le triangle", () => {
    expect(spikeBox(TILE_SPIKE_UP, 5, 5)).toEqual({ x: C + 1024, y: C + 2048, w: 2048, h: 2048 });
    expect(spikeBox(TILE_SPIKE_DOWN, 5, 5)).toEqual({ x: C + 1024, y: C, w: 2048, h: 2048 });
    expect(spikeBox(TILE_SPIKE_LEFT, 5, 5)).toEqual({ x: C + 2048, y: C + 1024, w: 2048, h: 2048 });
    expect(spikeBox(TILE_SPIKE_RIGHT, 5, 5)).toEqual({ x: C, y: C + 1024, w: 2048, h: 2048 });
    expect(SPIKE_INSET * 4).toBe(T);
    expect(SPIKE_DEPTH * 2).toBe(T);
    // Le triangle ^ : à la profondeur d (depuis la pointe), sa demi-largeur vaut d / 2. Les coins hauts de la boîte (d = ½) y sont.
    const box = spikeBox(TILE_SPIKE_UP, 0, 0);
    expect(T / 2 - box.x).toBeLessThanOrEqual(box.y / 2);
  });

  const cases = [
    // [caractère, position mortelle (de face, sur la pointe), position qui longe le flanc, position qui frôle la pointe]
    { ch: "^", front: [C + 512, C + T - SPIKE_DEPTH - H + 1], flank: [C - W + SPIKE_INSET, C + T - H], tip: [C + 512, C - H + SPIKE_DEPTH] },
    { ch: "v", front: [C + 512, C + SPIKE_DEPTH - 1], flank: [C - W + SPIKE_INSET, C], tip: [C + 512, C + T - SPIKE_DEPTH] },
    { ch: "<", front: [C + T - SPIKE_DEPTH - W + 1, C + 512], flank: [C, C - H + SPIKE_INSET], tip: [C - W + SPIKE_DEPTH, C + 512] },
    { ch: ">", front: [C + SPIKE_DEPTH - 1, C + 512], flank: [C, C + T - SPIKE_INSET], tip: [C + T - SPIKE_DEPTH, C + 512] },
  ] as const;
  for (const k of cases) {
    it(`« ${k.ch} » : tue de face, ne tue pas qui longe le flanc ni qui frôle la pointe`, () => {
      const lv = room(k.ch);
      expect(dies(lv, k.front[0], k.front[1])).toBe(true);
      expect(dies(lv, k.flank[0], k.flank[1])).toBe(false);
      expect(dies(lv, k.tip[0], k.tip[1])).toBe(false);
    });
  }

  it("de face, en mouvement : courir dans un ^ tue ; sauter par-dessus de justesse est sûr", () => {
    const lv = parseLevel([...Array(5).fill("#.............#"), "#S.....^.....F#", "###############"].join("\n"));
    const ran = untilDead(lv, initialAttempt(lv), R);
    expect(ran.state.deathCause).toBe(DEATH_SPIKE);
    // Le centre de la mort est dans la tuile du pic (ou à son bord) : la mort s'explique.
    expect(Math.abs(ran.state.deathX - (7 * T + T / 2))).toBeLessThan(T);
    // Sauter au bon moment : passe au-dessus et arrive.
    expect(clearsBy(lv)).toBe(true);
  });

  it("debout juste à côté d'un ^, collé au flanc, on ne meurt pas", () => {
    const lv = parseLevel(["#S...^.F#", "#########"].join("\n"));
    // Contre la tuile du pic, boîte entrée de ¼ de tuile dans la tuile (le retrait du flanc) : sûr.
    const s = at(lv, { x: 5 * T + SPIKE_INSET - W, y: 1 * T - H + 0, ground: 1 });
    expect(deathAt(lv, s)).toBe(DEATH_NONE);
    expect(deathAt(lv, at(lv, { x: 5 * T + SPIKE_INSET - W + 1, y: T - H }))).toBe(DEATH_SPIKE);
  });
});

describe("scies : cercle contre boîte, par distances au carré entières", () => {
  it("le point de la boîte le plus proche du centre ; contact limite : d² = r² ne tue pas, d² = r² − 1 tue", () => {
    const box = { x: 1000, y: 1000, w: 3072, h: 3072 };
    expect(boxDistance2(2000, 2000, box)).toBe(0); // centre dans la boîte
    expect(boxDistance2(1000 - 30, 1500, box)).toBe(900); // à gauche
    // Coin bas-droit (4072, 4072) ; centre à (+300, +400) du coin : d² = 250 000 = 500².
    expect(boxDistance2(4372, 4472, box)).toBe(250_000);
    expect(circleHitsBox(4372, 4472, 500, box)).toBe(false);
    expect(circleHitsBox(4372, 4472, 501, box)).toBe(true);
    // Le même au carré près : un rayon dont le carré vaut d² + 1 touche, d² non.
    const d2 = boxDistance2(4372 + 7, 4472 + 3, box);
    expect(Number.isInteger(d2)).toBe(true);
    expect(circleHitsBox(4379, 4475, Math.floor(Math.sqrt(d2)), box)).toBe(Math.floor(Math.sqrt(d2)) ** 2 > d2);
  });

  it("une petite scie au sol tue qui la touche, pas qui la saute ; une grande scie a un rayon de ≈ 1,5 tuile", () => {
    const lv = parseLevel([...Array(5).fill("#...........#"), "#S....o....F#", "#############"].join("\n"));
    expect(untilDead(lv, initialAttempt(lv), R).state.deathCause).toBe(DEATH_SAW);
    expect(clearsBy(lv)).toBe(true);
    expect(SAW_SMALL_RADIUS / T).toBeCloseTo(0.44, 2);
    expect(SAW_BIG_RADIUS / T).toBeCloseTo(1.375, 3);
  });

  it("les carrés restent sous Number.MAX_SAFE_INTEGER sur la plus grande carte possible", () => {
    // Plus grand écart possible entre un centre de scie et la boîte : la diagonale de la plus grande grille, plus le plus grand rayon.
    const dx = MAX_LEVEL_WIDTH * T + MAX_SAW_RADIUS;
    const dy = MAX_LEVEL_HEIGHT * T + MAX_SAW_RADIUS;
    expect(dx * dx + dy * dy).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(MAX_SAW_RADIUS * MAX_SAW_RADIUS).toBeLessThan(Number.MAX_SAFE_INTEGER);
    // Interpolation d'un trajet : écart × pas écoulés, et cycle × longueur cumulée (trajet en aller-retour : 2 × points segments).
    expect((MAX_LEVEL_WIDTH + MAX_LEVEL_HEIGHT) * T * MAX_SAW_CYCLE).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(MAX_SAW_CYCLE * 2 * MAX_SAW_POINTS * (MAX_LEVEL_WIDTH + MAX_LEVEL_HEIGHT) * T).toBeLessThan(Number.MAX_SAFE_INTEGER);
    // Et sur des valeurs réelles, aux coins opposés : exact (entier, et égal au calcul en BigInt).
    const box = { x: 0, y: 0, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    const cx = MAX_LEVEL_WIDTH * T - 1;
    const cy = MAX_LEVEL_HEIGHT * T - 1;
    const d2 = boxDistance2(cx, cy, box);
    const ex = BigInt(cx - PLAYER_WIDTH);
    const ey = BigInt(cy - PLAYER_HEIGHT);
    expect(BigInt(d2)).toBe(ex * ex + ey * ey);
    // Une scie de cycle maximal sur la plus grande grille : positions entières, dans la grille, retour exact au départ.
    const w = MAX_LEVEL_WIDTH;
    const grid = [`S${".".repeat(w - 2)}F`, "#".repeat(w)].join("\n");
    const big = parseLevel(`${grid}\n\nsection a 0-${w - 1}\nscie s O ${MAX_SAW_CYCLE} aller-retour 0,0 ${w - 1},0 0,1 ${w - 1},1`);
    const saw = big.saws[0]!;
    for (const phase of [0, 1, 12_345, MAX_SAW_CYCLE - 1, MAX_SAW_CYCLE, MAX_SAW_CYCLE * 7 + 3]) {
      const c = sawCenter(saw, phase);
      expect(Number.isSafeInteger(c.x) && Number.isSafeInteger(c.y)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(w * T);
    }
    expect(sawCenter(saw, MAX_SAW_CYCLE * 5)).toEqual(sawCenter(saw, 0));
  });
});

describe("scies mobiles : trajets périodiques exacts", () => {
  const lv = parseLevel(`
#S..........F#
##############

section tout 0-13
scie ar o 100 aller-retour 2,0 6,0 6,1
scie bo o 90 boucle 2,0 4,0 4,1
`);
  const [ar, bo] = lv.saws as [(typeof lv.saws)[number], (typeof lv.saws)[number]];

  it("aller-retour : 2 → 6 → (6, 1) puis retour par le même chemin ; positions entières ; exactement au départ à chaque cycle", () => {
    const seen: { x: number; y: number }[] = [];
    for (let t = 0; t < 100; t++) seen.push(sawCenter(ar, t));
    for (const p of seen) expect(Number.isInteger(p.x) && Number.isInteger(p.y) && !Object.is(p.x, -0)).toBe(true);
    for (let k = 1; k <= 5; k++) for (let t = 0; t < 100; t++) expect(sawCenter(ar, k * 100 + t)).toEqual(seen[t]);
    expect(sawCenter(ar, 300)).toEqual({ x: 2 * T + T / 2, y: T / 2 });
    // Le bout du trajet est atteint au milieu du cycle (longueurs : 4 tuiles puis 1, aller puis retour).
    expect(sawCenter(ar, 50)).toEqual({ x: 6 * T + T / 2, y: T + T / 2 });
    // Symétrie de l'aller-retour.
    for (let t = 1; t < 50; t++) {
      const a = sawCenter(ar, t);
      const b = sawCenter(ar, 100 - t);
      expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    }
  });

  it("boucle : revient du dernier point au premier, vitesse ≈ constante, exactement au départ à chaque cycle", () => {
    const start = sawCenter(bo, 0);
    for (let k = 0; k <= 8; k++) expect(sawCenter(bo, k * 90)).toEqual(start);
    let prev = start;
    let maxStep = 0;
    for (let t = 1; t <= 90; t++) {
      const p = sawCenter(bo, t);
      maxStep = Math.max(maxStep, Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y));
      prev = p;
    }
    // Longueur : 2 + 1 + √5 ≈ … en Manhattan 2 + 1 + 3 = 6 tuiles en 90 pas : ≈ 273 unités par pas, jamais plus de 2 fois.
    expect(maxStep).toBeLessThanOrEqual(2 * Math.ceil((6 * T) / 90));
  });

  it("une section se met en marche quand le personnage y entre ; avant, la scie attend à son départ, et elle tue quand même", () => {
    const lv2 = parseLevel(`
#S.......#...........F#
#######################

section depart 0-8
section loin 10-21
scie s o 120 aller-retour 15,0 19,0
scie t o 60 boucle 2,0 4,0
`);
    let s = initialAttempt(lv2);
    expect(s.sections).toEqual([-1, -1]);
    s = run(lv2, s, 0, 50); // le monde attend : rien ne bouge
    expect(s.time).toBe(0);
    expect(s.sections).toEqual([-1, -1]);
    s = stepAttempt(s, L, lv2, P); // contre le mur de gauche : premier pas commandé
    expect(s.time).toBe(1);
    expect(s.sections).toEqual([1, -1]); // la section du départ est en marche dès le premier pas
    s = run(lv2, s, L, 30);
    expect(sawCenters(lv2, s)[0]).toEqual({ x: 15 * T + T / 2, y: T / 2 }); // la scie lointaine attend
    expect(sawCenters(lv2, s)[1]).not.toEqual({ x: 2 * T + T / 2, y: T / 2 });
    // Immobile, elle tue : une boîte posée sur son départ meurt.
    const onSaw = { ...s, player: { ...s.player, x: 15 * T, y: 0 } };
    expect(deathAt(lv2, onSaw)).toBe(DEATH_SAW);
    // Entrer dans la section la met en marche à ce pas.
    const entering = { ...s, player: { ...s.player, x: 10 * T + 512, y: 0, ground: 1, vx: 0, vy: 0 } };
    const moved = stepAttempt(entering, R, lv2, P);
    expect(moved.sections[1]).toBe(moved.time);
    expect(sawCenters(lv2, moved)[0]).toEqual({ x: 15 * T + T / 2, y: T / 2 }); // phase 0 au pas d'entrée
    const later = run(lv2, moved, 0, 10);
    expect(sawCenters(lv2, later)[0]!.x).toBeGreaterThan(15 * T + T / 2);
  });
});

describe("blocs friables", () => {
  // Une dalle friable de 3 au-dessus du vide (ouvert jusqu'en bas), entre deux rebords.
  const lv = parseLevel(["#....F#", "#S#xx##", "#.#...#", "#.#...#"].join("\n"));

  it("pleins au départ ; posé dessus, la minuterie démarre ; ils tombent `crumbleDelay` pas après ; le personnage tombe", () => {
    let s = at(lv, { x: 3 * T + 256, y: T - PLAYER_HEIGHT, ground: 1 });
    expect(s.crumbles).toEqual([CRUMBLE_INTACT, CRUMBLE_INTACT]);
    s = stepAttempt(s, 0, lv, P);
    expect(s.crumbles).toEqual([P.crumbleDelay, CRUMBLE_INTACT]);
    expect(s.tiles).toBe(lv.tiles); // rien n'est encore tombé : la grille du niveau, sans copie
    s = run(lv, s, 0, P.crumbleDelay - 1);
    expect(s.crumbles[0]).toBe(1);
    expect(tileAt({ ...lv, tiles: s.tiles }, 3, 1)).toBe(TILE_CRUMBLE);
    s = stepAttempt(s, 0, lv, P);
    expect(s.crumbles[0]).toBe(CRUMBLE_GONE);
    expect(tileAt({ ...lv, tiles: s.tiles }, 3, 1)).toBe(TILE_EMPTY);
    expect(lv.tiles[1 * lv.width + 3]).toBe(TILE_CRUMBLE); // le niveau, lui, n'a pas changé
    const fell = untilDead(lv, s, 0);
    expect(fell.state.deathCause).toBe(DEATH_FALL);
    // Il ne revient pas pendant l'essai ; à la mort, tout revient.
    const fresh = run(lv, fell.state, 0, RESPAWN_TICKS);
    expect(fresh.crumbles).toEqual([CRUMBLE_INTACT, CRUMBLE_INTACT]);
    expect(fresh.tiles).toBe(lv.tiles);
  });

  it("en glisse murale contre lui (poussé contre en l'air), la minuterie démarre aussi", () => {
    const wall = parseLevel(["#.....#", "#....x#", "#....x#", "#S...F#", "#######"].join("\n"));
    // En l'air, collé à gauche du mur friable, poussé vers lui.
    let s = at(wall, { x: 5 * T - PLAYER_WIDTH, y: T + 256, ground: 0, air: 255, vy: 100 });
    s = stepAttempt(s, R, wall, P);
    expect(s.crumbles.filter((c) => c > 0).length).toBeGreaterThanOrEqual(1);
    // Sans pousser vers lui : rien.
    const free = stepAttempt(at(wall, { x: 5 * T - PLAYER_WIDTH, y: T + 256, ground: 0, air: 255, vy: 100 }), 0, wall, P);
    expect(free.crumbles).toEqual([CRUMBLE_INTACT, CRUMBLE_INTACT]);
  });
});

describe("ressorts", () => {
  const lv = parseLevel(["#.........F#", ...Array(10).fill("#..........#"), "#S.........#", "####*#######"].join("\n"));

  it("arriver dessus lance à ≈ 7 tuiles de haut, et relâcher le saut ne coupe pas ce saut", () => {
    let s = initialAttempt(lv);
    // Courir jusqu'au ressort puis ne plus rien tenir (le saut n'est jamais tenu : la coupe aurait agi tout de suite).
    let launched = -1;
    for (let t = 0; t < 120 && launched < 0; t++) {
      s = stepAttempt(s, R, lv, P);
      if (s.player.vy === -P.springSpeed) launched = t;
    }
    expect(launched).toBeGreaterThan(0);
    expect(s.springCell).toBe(12 * lv.width + 4);
    expect(s.player.ground).toBe(0);
    expect(s.player.jumping).toBe(0); // pas un saut « coupable »
    const startY = s.player.y;
    let top = startY;
    for (let t = 0; t < 200; t++) {
      s = stepAttempt(s, 0, lv, P);
      top = Math.min(top, s.player.y);
      if (s.player.vy >= 0) break;
    }
    const height = (startY - top) / T;
    expect(height).toBeGreaterThan(6.8);
    expect(height).toBeLessThan(7.3);
  });

  it("tenir puis relâcher le saut pendant la montée ne change rien ; la vitesse reste sous MAX_SPEED même réglée au-delà", () => {
    const launch = (params: Readonly<JumpParams>, input: (t: number) => number) => {
      let s = at(lv, { x: 4 * T + 512, y: 12 * T - PLAYER_HEIGHT - 4, vy: 50, ground: 0, air: 255 });
      const ys: number[] = [];
      for (let t = 0; t < 80; t++) {
        s = stepAttempt(s, input(t), lv, params);
        ys.push(s.player.y);
        expect(Math.abs(s.player.vy)).toBeLessThanOrEqual(MAX_SPEED);
      }
      return ys;
    };
    const free = launch(P, () => 0);
    const cut = launch(P, (t) => (t < 4 ? J : 0));
    expect(cut).toEqual(free);
    launch({ ...P, springSpeed: 9000 }, () => 0);
  });
});

describe("mort par le bas, remise à zéro, réapparition", () => {
  const lv = parseLevel(`
#..........#....F#
#S...x..o.....*..#
###.###......#####
###.###......#####

section a 0-17
scie m o 120 boucle 8,0 10,0
`);

  it("sortir par le bas de la grille tue (cause « chute », position lisible)", () => {
    const s = at(lv, { x: 3 * T + 512, y: 2 * T, ground: 0, air: 255 });
    const d = untilDead(lv, s, 0);
    expect(d.state.deathCause).toBe(DEATH_FALL);
    expect(d.state.deathY + PLAYER_HEIGHT / 2).toBeGreaterThan(lv.height * T);
  });

  it(`la mort fige l'essai ${RESPAWN_TICKS} pas (≤ 24 : 0,2 s) en ignorant les commandes, puis l'essai repart de l'état initial exact`, () => {
    expect(RESPAWN_TICKS).toBeLessThanOrEqual(24);
    // Faire bouger tout ce qui bouge avant de mourir : section en marche, bloc friable touché, ressort.
    let s = initialAttempt(lv);
    s = run(lv, s, R, 60);
    expect(s.time).toBeGreaterThan(0);
    const dead = untilDead(lv, s, R).state;
    expect(dead.status).toBe(ATTEMPT_DEAD);
    expect(dead.deathCause).not.toBe(DEATH_NONE);
    let t = dead;
    for (let k = 1; k < RESPAWN_TICKS; k++) {
      t = stepAttempt(t, k % 2 ? R | J : L, lv, P);
      expect(t.status).toBe(ATTEMPT_DEAD);
      expect(t.player).toEqual(dead.player); // commandes ignorées
      expect(t.time).toBe(dead.time);
    }
    t = stepAttempt(t, 0, lv, P);
    expect(t).toEqual(initialAttempt(lv)); // égalité profonde avec un état neuf
  });

  it("le monde attend la première commande : ni chrono, ni scie, ni personnage ; un saut tenu depuis la mort ne compte pas", () => {
    let s = initialAttempt(lv);
    const before = sawCenters(lv, s);
    s = run(lv, s, 0, 200);
    expect(s).toEqual(initialAttempt(lv));
    expect(sawCenters(lv, s)).toEqual(before);
    s = stepAttempt(s, R, lv, P);
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.time).toBe(1); // le premier pas commandé compte
    expect(s.player.vx).toBeGreaterThan(0); // une direction compte tout de suite
  });

  it("pas de saut automatique à la réapparition : il faut relâcher puis réappuyer ; une direction tenue compte tout de suite", () => {
    const dead = untilDead(lv, run(lv, initialAttempt(lv), R, 1), R).state;
    let s = dead;
    for (let k = 0; k < RESPAWN_TICKS; k++) s = stepAttempt(s, R | J, lv, P); // saut tenu pendant toute l'attente
    expect(s.status).toBe(ATTEMPT_READY);
    expect(s.player.held).toBe(1);
    // Saut seul, toujours tenu : rien ne démarre (ce n'est pas une nouvelle commande).
    const still = run(lv, s, J, 30);
    expect(still.status).toBe(ATTEMPT_READY);
    expect(still.time).toBe(0);
    // Direction + saut tenus : l'essai démarre, il court, il ne saute pas.
    let go = s;
    for (let k = 0; k < 20; k++) {
      go = stepAttempt(go, R | J, lv, P);
      expect(go.player.vy).toBeGreaterThanOrEqual(0);
    }
    expect(go.player.vx).toBeGreaterThan(0);
    // Relâcher puis réappuyer : il saute.
    go = stepAttempt(go, R, lv, P);
    go = stepAttempt(go, R | J, lv, P);
    expect(go.player.vy).toBeLessThan(0);
    // Saut relâché pendant l'attente puis appuyé au premier pas : il saute tout de suite.
    let fresh = dead;
    for (let k = 0; k < RESPAWN_TICKS; k++) fresh = stepAttempt(fresh, 0, lv, P);
    expect(fresh).toEqual(initialAttempt(lv));
    fresh = stepAttempt(fresh, J, lv, P);
    expect(fresh.status).toBe(ATTEMPT_RUNNING);
    expect(fresh.player.vy).toBeLessThan(0);
  });

  it("le chrono compte les pas du premier pas commandé jusqu'au contact de l'arrivée, puis se fige", () => {
    const flat = parseLevel(["#S.....F#", "#########"].join("\n"));
    let s = initialAttempt(flat);
    s = run(flat, s, 0, 10);
    let t = 0;
    while (s.status !== ATTEMPT_FINISHED && t < 300) {
      s = stepAttempt(s, R, flat, P);
      t++;
    }
    expect(s.status).toBe(ATTEMPT_FINISHED);
    expect(s.time).toBe(t);
    const after = run(flat, s, R | J, 50);
    expect(after).toBe(s); // figé : le même état
  });

  it("si l'arrivée et la mort tombent le même pas, l'arrivée l'emporte", () => {
    // Une scie d'une demi-tuile de rayon centrée sur l'arrivée : le pas qui entre dans la tuile d'arrivée entre aussi dans le disque.
    const lv2 = parseLevel(["#.......#", "#S....F.#", "#########", "", "section a 0-8", "scie s 0.5 60 boucle 6,1 6,1"].join("\n"));
    let s = initialAttempt(lv2);
    let both = false;
    for (let t = 0; t < 300 && s.status !== ATTEMPT_FINISHED && s.status !== ATTEMPT_DEAD; t++) {
      s = stepAttempt(s, R, lv2, P);
      if (s.status === ATTEMPT_FINISHED) both = deathAt(lv2, s) !== DEATH_NONE;
    }
    expect(s.status).toBe(ATTEMPT_FINISHED);
    expect(both).toBe(true); // ce même état aurait été une mort
  });
});

describe("intégrité (fuzz) sur le niveau d'essai", () => {
  /** Tout l'état est entier, sans −0 ; vitesses sous MAX_SPEED ; la boîte n'est jamais dans un bloc plein de la grille de l'essai. */
  function assertSound(s: AttemptState, where: string, lastTiles: { ref: readonly number[] | null }) {
    const check = (k: string, v: unknown) => {
      if (typeof v !== "number" || !Number.isInteger(v) || Object.is(v, -0)) throw new Error(`${where} : ${k} = ${String(v)} (entier sans −0 attendu)`);
    };
    for (const [k, v] of Object.entries(s)) {
      if (k === "player") for (const [pk, pv] of Object.entries(v as object)) check(`player.${pk}`, pv);
      else if (k === "tiles") {
        if (v !== lastTiles.ref) (v as number[]).forEach((t, i) => check(`tiles[${i}]`, t));
        lastTiles.ref = v as number[];
      } else if (Array.isArray(v)) v.forEach((x, i) => check(`${k}[${i}]`, x));
      else check(k, v);
    }
    const p = s.player;
    if (Math.abs(p.vx) > MAX_SPEED || Math.abs(p.vy) > MAX_SPEED) throw new Error(`${where} : vitesse ${p.vx}, ${p.vy}`);
    const grid = { width: ESSAI_LEVEL.width, height: ESSAI_LEVEL.height, tiles: s.tiles };
    if (boxHits(grid, p.x, p.y, PLAYER_WIDTH, PLAYER_HEIGHT)) throw new Error(`${where} : la boîte est dans un mur (${p.x}, ${p.y})`);
    for (const c of s.crumbles) if (c < CRUMBLE_GONE) throw new Error(`${where} : bloc friable ${c}`);
  }

  /** Commandes au hasard tenues un temps au hasard ; départs au hasard (personnage posé n'importe où dans le vide). */
  function fuzz(seed: number, runs: number, ticks: number, params: (rng: Rng) => JumpParams): { total: number; deaths: number; trace: number } {
    const rng = new Rng(seed);
    const lv = ESSAI_LEVEL;
    let total = 0;
    let deaths = 0;
    let trace = 2166136261;
    for (let run = 0; run < runs; run++) {
      const p = params(rng);
      let s = initialAttempt(lv);
      if (run % 2 === 1) {
        // Un départ au hasard, dans une case vide (le reste de l'essai à l'état initial).
        for (let k = 0; k < 50; k++) {
          const x = 1 + rng.int(lv.width - 2);
          const y = 1 + rng.int(lv.height - 2);
          if (!boxHits(lv, x * T, y * T, PLAYER_WIDTH, PLAYER_HEIGHT)) {
            s = { ...s, player: { ...s.player, x: x * T, y: y * T, ground: 0, air: 255 } };
            break;
          }
        }
      }
      const lastTiles = { ref: null as readonly number[] | null };
      let input = 0;
      let left = 0;
      for (let t = 0; t < ticks; t++) {
        if (left-- <= 0) {
          input = rng.int(8);
          left = rng.int(40);
        }
        const before = s.status;
        s = stepAttempt(s, input, lv, p);
        if (s.status === ATTEMPT_DEAD && before !== ATTEMPT_DEAD) deaths++;
        assertSound(s, `graine ${seed}, essai ${run}, pas ${t}`, lastTiles);
        trace = Math.imul(trace ^ (s.player.x + s.player.y * 7 + s.time), 16777619) >>> 0;
        total++;
      }
    }
    return { total, deaths, trace };
  }

  it("réglages par défaut : des dizaines de milliers de pas, tout reste entier, sans −0, sous MAX_SPEED, hors des murs ; on y meurt souvent", () => {
    const r = fuzz(20261014, 30, 3000, () => ({ ...P }));
    expect(r.total).toBe(90_000);
    expect(r.deaths).toBeGreaterThan(30); // le fuzz traverse bien les dangers
  });

  it("réglages au hasard (crumbleDelay et springSpeed compris, extrêmes compris) : même intégrité", () => {
    const keys = Object.keys(DEFAULT_JUMP_PARAMS) as (keyof JumpParams)[];
    const r = fuzz(11, 40, 1500, (rng) => {
      const p = { ...P };
      for (const k of keys) p[k] = rng.chance(10) ? rng.int(5000) : rng.int(3 * P[k] + 2);
      return p;
    });
    expect(r.total).toBe(60_000);
  });

  it("déterminisme : mêmes commandes, même suite d'états (deux fois, au bit près)", () => {
    expect(fuzz(5, 6, 2000, () => ({ ...P }))).toEqual(fuzz(5, 6, 2000, () => ({ ...P })));
    const rng = new Rng(3);
    const inputs = Array.from({ length: 6000 }, () => rng.int(8));
    const play = () => {
      let s = initialAttempt(ESSAI_LEVEL);
      const trace: AttemptState[] = [];
      for (const i of inputs) trace.push((s = stepAttempt(s, i, ESSAI_LEVEL, P)));
      return trace;
    };
    expect(play()).toEqual(play());
  });

  it("stepAttempt est pur : l'état, le niveau et les réglages donnés ne bougent pas ; refuse une commande hors des 3 bits", () => {
    const lv = ESSAI_LEVEL;
    const tiles = [...lv.tiles];
    let s = initialAttempt(lv);
    for (let t = 0; t < 400; t++) {
      const before = JSON.stringify(s);
      const next = stepAttempt(s, t % 5 === 0 ? R | J : R, lv, P);
      expect(JSON.stringify(s)).toBe(before);
      s = next;
    }
    expect(lv.tiles).toEqual(tiles);
    for (const bad of [-1, 8, 1.5, Number.NaN]) expect(() => stepAttempt(initialAttempt(lv), bad, lv, P)).toThrow(RangeError);
  });
});

describe("points de passage (lot 2b)", () => {
  // Départ, un pic, un point de passage, un bloc friable posé sur un trou, un trou ouvert jusqu'en bas, l'arrivée ; une scie mobile dans la
  // deuxième section (en l'air : on passe dessous).
  const lv = parseLevel(`
#........................#
#........................#
#S..^..C..............F..#
############x###...#######
############.###...#######

section a 0-8
section b 9-25
scie m o 120 aller-retour 15,1 20,1
`);
  const C = lv.checkpoints[0]!;

  it("`C` est une tuile vide repérée ; les points sont rangés de gauche à droite", () => {
    expect(tileAt(lv, 7, 2)).toBe(TILE_EMPTY);
    expect(lv.checkpoints).toEqual([{ col: 7, row: 2 }]);
    const two = parseLevel(["#......C.#", "#C......F#", "#S.......#", "##########"].join("\n"));
    expect(two.checkpoints).toEqual([{ col: 1, row: 1 }, { col: 7, row: 0 }]);
  });

  /** Va du départ jusqu'au point de passage (saute le pic) ; rend l'état une fois le point retenu. */
  function reachCheckpoint(): AttemptState {
    for (let jt = 1; jt < 60; jt++) {
      let s = initialAttempt(lv);
      for (let t = 0; t < 300 && s.status !== ATTEMPT_DEAD; t++) {
        s = stepAttempt(s, t >= jt && t < jt + 30 ? R | J : R, lv, P);
        if (s.checkpoint === 0) return s;
      }
    }
    throw new Error("point de passage jamais atteint");
  }

  it("le toucher le retient ; mourir ensuite fait reprendre dessus, chrono qui continue, sans attendre de commande", () => {
    const at = reachCheckpoint();
    expect(at.checkpoint).toBe(0);
    // Continuer à droite : par-dessus le friable, puis dans le trou des colonnes 16 à 18 (ouvert jusqu'en bas).
    const dead = untilDead(lv, at, R, 600);
    expect(dead.state.status).toBe(ATTEMPT_DEAD);
    const timeAtDeath = dead.state.time;
    let s = dead.state;
    for (let k = 1; k < RESPAWN_TICKS; k++) {
      s = stepAttempt(s, R, lv, P);
      expect(s.status).toBe(ATTEMPT_DEAD);
      expect(s.time).toBe(timeAtDeath + k); // le chrono tourne pendant l'attente
    }
    s = stepAttempt(s, 0, lv, P);
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.time).toBe(timeAtDeath + RESPAWN_TICKS);
    expect(s.checkpoint).toBe(0);
    expect(s.player.x).toBe(C.col * T + (T - PLAYER_WIDTH) / 2);
    expect(s.player.y).toBe((C.row + 1) * T - PLAYER_HEIGHT);
    expect(s.player.ground).toBe(1);
    expect(s.player.vx).toBe(0);
    // Sans commande, le chrono continue (le monde n'attend plus : l'essai est en cours).
    const idle = run(lv, s, 0, 10);
    expect(idle.time).toBe(s.time + 10);
  });

  it("la reprise remet à l'arrêt les sections du point et d'après (elles repartent à l'entrée), garde celles d'avant, repose les friables", () => {
    const at = reachCheckpoint();
    // Aller jusqu'au bloc friable (le toucher), entrer dans la section b (la scie part), puis tomber dans le trou.
    let s = at;
    let touched = false;
    for (let t = 0; t < 400 && s.status !== ATTEMPT_DEAD; t++) {
      s = stepAttempt(s, R, lv, P);
      if (s.crumbles[0]! > 0 || s.crumbles[0] === CRUMBLE_GONE) touched = true;
    }
    expect(s.status).toBe(ATTEMPT_DEAD);
    expect(touched).toBe(true);
    expect(s.sections[1]).toBeGreaterThan(0);
    const sectionA = s.sections[0];
    s = run(lv, s, 0, RESPAWN_TICKS);
    expect(s.status).toBe(ATTEMPT_RUNNING);
    expect(s.crumbles).toEqual([CRUMBLE_INTACT]);
    expect(s.tiles).toBe(lv.tiles);
    expect(s.sections).toEqual([-1, -1]); // le point est dans la section a : a et b repartiront à leur entrée
    expect(sawCenters(lv, s)[0]).toEqual({ x: 15 * T + T / 2, y: T + T / 2 });
    expect(sectionA).toBeGreaterThan(0);
    // Au pas suivant, la section du point se remet en marche.
    const next = stepAttempt(s, 0, lv, P);
    expect(next.sections[0]).toBe(next.time);
  });

  it("une section d'avant le point garde son cycle", () => {
    const lv2 = parseLevel(`
#.........................#
#S.......C.....F..........#
###########.###############

section a 0-5
section b 6-25
scie m o 60 boucle 2,0 4,0
`);
    let s = initialAttempt(lv2);
    while (s.checkpoint < 0) s = stepAttempt(s, R, lv2, P);
    const startA = s.sections[0]!;
    s = untilDead(lv2, s, R).state;
    s = run(lv2, s, 0, RESPAWN_TICKS);
    expect(s.sections[0]).toBe(startA);
    expect(s.sections[1]).toBe(-1);
  });

  it("un point touché au pas même d'une mort n'est pas retenu", () => {
    // On meurt en le touchant : on repart donc du départ (nouvel essai).
    // Disque d'une demi-tuile centré sur le point : le pas qui entre dans la tuile du point entre aussi dans le disque.
    const trap = parseLevel(["#..........#", "#S....C...F#", "############", "", "section a 0-11", "scie s 0.5 60 boucle 6,1 6,1"].join("\n"));
    const d = untilDead(trap, initialAttempt(trap), R).state;
    expect(d.player.x + PLAYER_WIDTH).toBeGreaterThan(6 * T); // au pas de la mort, la boîte touchait bien le point
    expect(d.checkpoint).toBe(-1);
    expect(run(trap, d, 0, RESPAWN_TICKS)).toEqual(initialAttempt(trap));
  });

  it("le dernier point touché compte ; recommencer (état initial) l'oublie", () => {
    const lv3 = parseLevel(["#...........#", "#S..C...C..F#", "#############"].join("\n"));
    let s = initialAttempt(lv3);
    const seen: number[] = [];
    for (let t = 0; t < 200 && s.status === ATTEMPT_RUNNING || t === 0; t++) {
      s = stepAttempt(s, R, lv3, P);
      if (seen[seen.length - 1] !== s.checkpoint) seen.push(s.checkpoint);
    }
    expect(seen).toEqual([-1, 0, 1]);
    expect(initialAttempt(lv3).checkpoint).toBe(-1);
  });
});
