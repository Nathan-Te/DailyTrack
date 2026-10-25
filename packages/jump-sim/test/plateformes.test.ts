import { Rng, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  LevelError,
  MODULES,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  buildModule,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  fromRuns,
  moduleSolutions,
  palierProblems,
  platformModuleIds,
  platformProblems,
  respawnProblems,
  variantExigence,
  MAX_PLATFORM_STEP,
  MAX_SPEED,
  PLATFORM_EASE,
  PLATFORM_EASE_ONE,
  PLATFORM_EASE_STEPS,
  PLATFORM_VERSION,
  PLAYER_HEIGHT,
  SECTION_CLOCK_VERSION,
  SINGLE_CLOCK_VERSION,
  PLAYER_WIDTH,
  UNITS_PER_TILE,
  cycleMod,
  idiv,
  initialAttempt,
  parseLevel,
  platformAt,
  platformEase,
  platformPos,
  platformPositions,
  sectionPeriod,
  stepAttempt,
  stepPlayerJump,
  type AttemptState,
  type Level,
} from "../src/index";

// Lot 20 : plateformes mobiles (sim v5). Les niveaux sont de petits textes écrits ici.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;
const R = INPUT_RIGHT;
const L = INPUT_LEFT;
const J = INPUT_JUMP;

const text = (rows: string[], annex: string[] = []) => rows.join("\n") + (annex.length > 0 ? "\n\n" + annex.join("\n") : "") + "\n";

/**
 * Une salle de 24 colonnes sur 14 rangées : un sol aux rangées 12-13, une fosse (colonnes 7 à 16) au-dessus de laquelle la plateforme `ferry` va et
 * vient sur la rangée 12, à fleur du sol (trois tuiles, de la colonne 7 à la colonne 14 pour sa première tuile), un haut plafond. Le départ est sur le sol
 * de gauche, l'arrivée à droite.
 */
function ferryRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(22) + "#");
  rows[0] = "#".repeat(24);
  for (let r = 12; r < 14; r++) rows[r] = "#".repeat(7) + ".".repeat(10) + "#".repeat(7);
  rows[11] = "#S" + ".".repeat(20) + "F#";
  return rows;
}

/** La même salle sans fosse : un sol plein (pour les plateformes verticales, le plafond et les côtés). */
function flatRows(): string[] {
  const rows = ferryRows();
  for (let r = 12; r < 14; r++) rows[r] = "#".repeat(24);
  return rows;
}

const FERRY = ["version 5", "section salle 0-23", "plateforme ferry 3 h 480 7,12 14,12"];

function ferryLevel(annex: string[] = FERRY): Level {
  return parseLevel(text(ferryRows(), annex));
}

/** Un état en course, le personnage posé sur le sol dans la colonne `col`, `time` pas déjà écoulés. */
function running(level: Level, col: number, row: number, time: number, extra: Partial<AttemptState> = {}): AttemptState {
  const s = initialAttempt(level);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  return { ...s, status: 1, time, player: { ...s.player, x, y, ground: 1, air: 0 }, ...extra };
}

const step = (s: AttemptState, bits: number, level: Level) => stepAttempt(s, bits, level, P);

/** Le personnage debout au centre de la plateforme `index` à l'instant `time` (porté). */
function onPlatform(level: Level, index: number, time: number): AttemptState {
  const s0 = initialAttempt(level);
  const at = platformAt(level, s0.sections, time, index);
  const p = level.platforms[index]!;
  const x = at.x + idiv(p.width * T - PLAYER_WIDTH, 2);
  const y = at.y - PLAYER_HEIGHT;
  return { ...s0, status: 1, time, player: { ...s0.player, x, y, ground: 1, air: 0 }, ride: index };
}

describe("lot 20 — la version de la simulation", () => {
  it("la version 5 est celle des plateformes mobiles", () => {
    expect(JUMP_SIM_VERSION).toBe(5);
    expect(PLATFORM_VERSION).toBe(5);
    expect(ferryLevel().simVersion).toBe(5);
  });
});

describe("lot 20 — lecture du bloc annexe", () => {
  it("lit une plateforme : largeur, axe, cycle, extrémités, section", () => {
    const lv = ferryLevel();
    expect(lv.platforms).toEqual([{ id: "ferry", width: 3, axis: "h", cycle: 480, a: { col: 7, row: 12 }, b: { col: 14, row: 12 }, section: 0 }]);
    expect(parseLevel(text(ferryRows())).platforms).toEqual([]);
  });

  it("refuse ce qui est mal formé", () => {
    const bad = (line: string, re: RegExp) => expect(() => ferryLevel(["version 5", "section salle 0-23", line]), line).toThrow(re);
    bad("plateforme f 1 h 480 7,12 14,12", /largeur/);
    bad("plateforme f 5 h 480 7,12 14,12", /largeur/);
    bad("plateforme f 3 x 480 7,12 14,12", /axe/);
    bad("plateforme f 3 h 481 7,12 14,12", /cycle pair/);
    bad("plateforme f 3 h 100 7,12 14,12", /cycle pair/);
    bad("plateforme f 3 h 480 7,12 14,11", /même rangée/);
    bad("plateforme f 3 v 480 7,12 8,6", /même colonne/);
    bad("plateforme f 3 h 480 7,12 7,12", /même rangée/);
    bad("plateforme f 3 h 480 7,12", /attendu/);
    bad("plateforme f 3 v 480 7,12 7,15", /hors de la grille/);
    bad("plateforme f 3 h 480 7,12 30,12", /trajet de/);
    bad("plateforme f 3 h 720 3,12 14,12", /vide/);
    bad("plateforme f 2 h 120 7,12 14,12", /trop rapide/);
    expect(() => ferryLevel(["version 5", "section salle 0-23", FERRY[2]!, FERRY[2]!])).toThrow(/déjà déclarée/);
    expect(() => ferryLevel(["version 5", "section petite 0-10", FERRY[2]!])).toThrow(/seule section/);
  });

  it("la période de la section compte son cycle", () => {
    expect(sectionPeriod(ferryLevel(), 0)).toBe(480);
  });
});

describe("lot 20 — la table de ralenti", () => {
  it("65 entiers, de 0 à 4 096, qui suivent 3k² − k³/32", () => {
    expect(PLATFORM_EASE).toHaveLength(PLATFORM_EASE_STEPS + 1);
    PLATFORM_EASE.forEach((v, k) => expect(v, `k=${k}`).toBe(idiv(192 * k * k - 2 * k * k * k, 64)));
    expect(PLATFORM_EASE[0]).toBe(0);
    expect(PLATFORM_EASE[PLATFORM_EASE_STEPS]).toBe(PLATFORM_EASE_ONE);
  });

  it("croissante, et symétrique : le ralenti aux deux extrémités est le même", () => {
    for (let k = 0; k < PLATFORM_EASE_STEPS; k++) expect(PLATFORM_EASE[k + 1]! - PLATFORM_EASE[k]!, `k=${k}`).toBeGreaterThan(0);
    for (let k = 0; k <= PLATFORM_EASE_STEPS; k++) expect(PLATFORM_EASE[k]! + PLATFORM_EASE[PLATFORM_EASE_STEPS - k]!, `k=${k}`).toBeGreaterThanOrEqual(PLATFORM_EASE_ONE - 1);
  });

  it("platformEase : entière, 0 au départ, 4 096 à l'arrivée, croissante pas à pas", () => {
    const half = 240;
    expect(platformEase(0, half)).toBe(0);
    expect(platformEase(half, half)).toBe(PLATFORM_EASE_ONE);
    let last = 0;
    for (let t = 0; t <= half; t++) {
      const e = platformEase(t, half);
      expect(Number.isInteger(e)).toBe(true);
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
  });
});

describe("lot 20 — la position d'une plateforme est une fonction entière de la phase", () => {
  const lv = ferryLevel();
  const plat = lv.platforms[0]!;

  it("a à la phase 0, b au demi-cycle, retour exact à chaque cycle, sans −0", () => {
    expect(platformPos(plat, 0)).toEqual({ x: 7 * T, y: 12 * T });
    expect(platformPos(plat, 240)).toEqual({ x: 14 * T, y: 12 * T });
    expect(platformPos(plat, 480)).toEqual({ x: 7 * T, y: 12 * T });
    for (let t = 0; t < 1500; t += 7) {
      const q = platformPos(plat, t);
      expect(Number.isInteger(q.x) && Number.isInteger(q.y)).toBe(true);
      expect(Object.is(q.x, -0) || Object.is(q.y, -0)).toBe(false);
      expect(platformPos(plat, t + 480)).toEqual(q);
      expect(platformPos(plat, 480 - t)).toEqual(platformPos(plat, t));
      expect(platformPos(plat, t - 480)).toEqual(q);
    }
  });

  it("un trajet vertical monte et descend sur sa colonne", () => {
    const v = parseLevel(text(flatRows(), ["version 5", "section salle 0-23", "plateforme asc 2 v 360 8,4 8,10"])).platforms[0]!;
    expect(platformPos(v, 0)).toEqual({ x: 8 * T, y: 4 * T });
    expect(platformPos(v, 180)).toEqual({ x: 8 * T, y: 10 * T });
    const ys = Array.from({ length: 181 }, (_, t) => platformPos(v, t).y);
    ys.forEach((y, t) => t > 0 && expect(y).toBeGreaterThanOrEqual(ys[t - 1]!));
  });

  it("le ralenti aux extrémités se voit en entier : le premier dixième du trajet prend près d'un cinquième de l'aller, la vitesse de pointe est au milieu", () => {
    const xs = Array.from({ length: 241 }, (_, t) => platformPos(plat, t).x - 7 * T);
    const total = 7 * T;
    // Le premier dixième du trajet n'est fini qu'après près d'un cinquième de l'aller (47 pas sur 240, 24 s'il allait à vitesse constante) ; le dernier dixième commence à 193.
    const tenth = xs.findIndex((x) => x >= total / 10);
    expect(tenth).toBeGreaterThan(40);
    const last = xs.findIndex((x) => x >= (total * 9) / 10);
    expect(last).toBeLessThan(200);
    const speeds = xs.slice(1).map((x, t) => x - xs[t]!);
    const fastest = Math.max(...speeds);
    expect(speeds[0]!).toBeLessThan(fastest / 20);
    expect(speeds[speeds.length - 1]!).toBeLessThan(fastest / 20);
    expect(speeds.indexOf(fastest)).toBeGreaterThan(90);
    expect(speeds.indexOf(fastest)).toBeLessThan(150);
    expect(fastest).toBeLessThan(MAX_PLATFORM_STEP);
    // Le même ralenti au retour.
    const back = Array.from({ length: 240 }, (_, t) => platformPos(plat, 240 + t + 1).x - platformPos(plat, 240 + t).x);
    expect(back[0]!).toBeGreaterThanOrEqual(-speeds[speeds.length - 1]! - 1);
    expect(Math.abs(back[0]!)).toBeLessThan(fastest / 20);
  });

  it("positions de toutes les plateformes d'un état", () => {
    const s = running(lv, 2, 11, 100);
    expect(platformPositions(lv, s)).toEqual([platformPos(plat, 100)]);
  });
});

describe("lot 20 — transport exact", () => {
  it("posé dessus sans rien faire, le personnage suit la plateforme au pas près, sur un aller-retour entier", () => {
    const lv = ferryLevel();
    let s = onPlatform(lv, 0, 0);
    for (let t = 0; t < 520; t++) {
      s = step(s, 0, lv);
      const at = platformAt(lv, s.sections, s.time, 0);
      expect(s.player.y + PLAYER_HEIGHT, `pas ${t + 1}`).toBe(at.y);
      expect(s.player.ground).toBe(1);
      expect(s.ride).toBe(0);
      expect(s.status).toBe(1);
      // L'écart avec le centre de la plateforme ne bouge pas.
      expect(s.player.x - at.x, `pas ${t + 1}`).toBe(idiv(3 * T - PLAYER_WIDTH, 2));
    }
  });

  it("porté verticalement : la plateforme monte et descend, le pied reste sur son dessus", () => {
    const lv = parseLevel(text(flatRows(), ["version 5", "section salle 0-23", "plateforme asc 2 v 360 8,4 8,10"]));
    let s = onPlatform(lv, 0, 0);
    for (let t = 0; t < 400; t++) {
      s = step(s, 0, lv);
      expect(s.player.y + PLAYER_HEIGHT, `pas ${t + 1}`).toBe(platformAt(lv, s.sections, s.time, 0).y);
      expect(s.ride).toBe(0);
    }
  });

  it("marcher sur la plateforme : le déplacement du personnage s'ajoute au sien", () => {
    const lv = ferryLevel();
    let s = onPlatform(lv, 0, 0);
    const dx0 = platformAt(lv, s.sections, 40, 0).x - platformAt(lv, s.sections, 0, 0).x;
    const start = s.player.x;
    for (let t = 0; t < 40; t++) s = step(s, 0, lv);
    expect(s.player.x - start).toBe(dx0);
    let w = onPlatform(lv, 0, 0);
    for (let t = 0; t < 10; t++) w = step(w, L, lv);
    const dx10 = platformAt(lv, w.sections, 10, 0).x - platformAt(lv, w.sections, 0, 0).x;
    expect(w.player.x).toBeLessThan(start + dx10);
    expect(w.ride).toBe(0);
  });

  it("se poser dessus en tombant, ou en marchant depuis un bord de même hauteur ; on le quitte par le côté", () => {
    const lv = ferryLevel();
    // Du bord gauche (rangée 11, colonne 6), la plateforme est à la colonne 7 à la phase 0, à fleur du sol : on marche dessus.
    let s = running(lv, 6, 11, 0);
    for (let t = 0; t < 20; t++) s = step(s, R, lv);
    expect(s.ride).toBe(0);
    expect(s.player.y + PLAYER_HEIGHT).toBe(platformAt(lv, s.sections, s.time, 0).y);
    // En tombant d'en haut (le personnage est en l'air au-dessus de la plateforme).
    const at = platformAt(lv, initialAttempt(lv).sections, 10, 0);
    let f = running(lv, 2, 4, 10, { player: { ...initialAttempt(lv).player, x: at.x + T, y: at.y - 5 * T, vx: 0, vy: 0, ground: 0, air: 255, wallSide: 0, wallAir: 255 } });
    let landedAt = -1;
    for (let t = 0; t < 80; t++) {
      f = step(f, 0, lv);
      if (f.ride === 0 && landedAt < 0) landedAt = t;
    }
    expect(landedAt).toBeGreaterThan(0);
    expect(f.ride).toBe(0);
  });
});

describe("lot 20 — l'élan de la plateforme au saut", () => {
  it("un saut garde la vitesse horizontale de la plateforme, pas sa vitesse verticale", () => {
    const lv = ferryLevel();
    // Vers le milieu de l'aller, la plateforme file vers la droite.
    const t0 = 120;
    let s = onPlatform(lv, 0, t0);
    const platVx = platformAt(lv, s.sections, t0 + 1, 0).x - platformAt(lv, s.sections, t0, 0).x;
    expect(platVx).toBeGreaterThan(100);
    const jumped = step(s, J, lv);
    expect(jumped.player.vy).toBeLessThan(0);
    expect(jumped.player.vx).toBe(platVx);
    // Sans plateforme (le même saut sur le sol), aucun élan.
    const ground = step(running(lv, 2, 11, t0), J, lv);
    expect(ground.player.vx).toBe(0);
    // En l'air, la vitesse décroît par `airDecel` comme n'importe quel élan : elle n'a pas été remise à zéro.
    s = jumped;
    for (let t = 0; t < 5; t++) s = step(s, 0, lv);
    expect(s.player.vx).toBe(platVx - 5 * P.airDecel);
  });

  it("vers la gauche, l'élan est négatif ; sur une plateforme verticale, rien n'est hérité", () => {
    const lv = ferryLevel();
    const t0 = 360;
    const s = onPlatform(lv, 0, t0);
    const platVx = platformAt(lv, s.sections, t0 + 1, 0).x - platformAt(lv, s.sections, t0, 0).x;
    expect(platVx).toBeLessThan(-100);
    expect(step(s, J, lv).player.vx).toBe(platVx);
    const vl = parseLevel(text(flatRows(), ["version 5", "section salle 0-23", "plateforme asc 2 v 360 8,4 8,10"]));
    const v = onPlatform(vl, 0, 90);
    const up = platformAt(vl, v.sections, 91, 0).y - platformAt(vl, v.sections, 90, 0).y;
    expect(up).not.toBe(0);
    const j = step(v, J, vl);
    expect(j.player.vx).toBe(0);
    expect(j.player.vy).toBe(-P.jumpSpeed);
  });

  it("un saut juste après avoir quitté le bord (coyote) garde aussi l'élan ; passé le coyote, plus rien", () => {
    const lv = ferryLevel();
    const t0 = 120;
    let s = onPlatform(lv, 0, t0);
    // On marche vers la droite jusqu'à quitter la plateforme par le bord.
    for (let t = 0; t < 400 && s.ride === 0 && s.player.ground === 1; t++) s = step(s, R, lv);
    // La plateforme file elle-même vers la droite : le personnage ne la quitte qu'en la dépassant. On se contente de forcer le cas du coyote.
    const edge = { ...s, player: { ...s.player, ground: 0, air: 3 }, ride: 0 };
    const platVx = platformAt(lv, edge.sections, edge.time + 1, 0).x - platformAt(lv, edge.sections, edge.time, 0).x;
    const withCoyote = step(edge, J, lv);
    expect(withCoyote.player.vy).toBeLessThan(0);
    expect(withCoyote.player.vx).toBeGreaterThanOrEqual(platVx - 0);
    const late = step({ ...edge, player: { ...edge.player, air: P.coyote + 5 } }, J, lv);
    expect(late.ride).toBe(-1);
  });

  it("un saut mural ne prend rien à la plateforme", () => {
    // Directement sur le pas du personnage : contre un mur, en l'air, avec une plateforme qui file à 100 unités/pas.
    const room = parseLevel(text(flatRows(), ["section salle 0-23"]));
    const s = { ...initialAttempt(room).player, x: T, y: 6 * T, vx: 0, vy: 0, ground: 0, air: 255, wallSide: -1, wallAir: 0 };
    const withPlatform = stepPlayerJump(s, J, room, P, null, null, 100);
    const without = stepPlayerJump(s, J, room, P, null, null, 0);
    expect(withPlatform).toEqual(without);
    expect(withPlatform.vx).toBe(P.wallJumpX);
  });
});

describe("lot 20 — à sens unique", () => {
  it("on la traverse par-dessous : un saut depuis le sol passe à travers, puis on se pose dessus en retombant", () => {
    // Une plateforme haute (peu de trajet) au-dessus du sol de gauche : le dessus à 8 tuiles de rangée, un saut complet monte de 4,2 tuiles.
    const lv = parseLevel(text(flatRows(), ["version 5", "section salle 0-23", "plateforme haute 4 v 600 2,8 2,7"]));
    let s = running(lv, 3, 11, 0);
    let inside = false;
    let landed = false;
    for (let t = 0; t < 260; t++) {
      s = step(s, t < 40 ? J : 0, lv);
      const at = platformAt(lv, s.sections, s.time, 0);
      const bottom = s.player.y + PLAYER_HEIGHT;
      if (bottom > at.y && s.player.y < at.y + T && s.player.vy < 0) inside = true;
      if (s.ride === 0) landed = true;
      expect(s.status).not.toBe(ATTEMPT_DEAD);
    }
    expect(inside, "le corps est passé dans la plateforme en montant").toBe(true);
    expect(landed, "puis il s'est posé dessus").toBe(true);
    expect(s.ride).toBe(0);
  });

  it("on la traverse par les côtés : marcher à sa rangée ne bute pas, un personnage en l'air contre elle ne glisse ni ne saute au mur", () => {
    // Elle descend jusqu'à la rangée 11 : le corps de celui qui marche sur le sol (rangée 11) la traverse.
    const lv = parseLevel(text(flatRows(), ["version 5", "section salle 0-23", "plateforme p 2 v 480 12,3 12,11"]));
    let s = running(lv, 6, 11, 160);
    for (let t = 0; t < 200; t++) {
      s = step(s, R, lv);
      expect(s.status).not.toBe(ATTEMPT_DEAD);
      expect(s.ride).toBe(-1);
    }
    expect(s.player.x).toBeGreaterThan(15 * T);
    const at = platformAt(lv, initialAttempt(lv).sections, 90, 0);
    const edge = { ...initialAttempt(lv), status: 1, time: 90, player: { ...initialAttempt(lv).player, x: at.x - PLAYER_WIDTH, y: at.y + 1000, vx: 0, vy: 0, ground: 0, air: 255, wallSide: 0, wallAir: 255 } };
    const next = step(edge, R | J, lv);
    expect(next.player.slide).toBe(0);
    expect(next.player.wallSide).toBe(0);
    expect(next.player.vy, "aucun saut mural : on tombe").toBe(P.gravity);
  });

  it("jamais d'écrasement : sous un plafond, la plateforme qui monte passe à travers le personnage, qui reste vivant", () => {
    const rows = flatRows();
    rows[9] = "#" + ".".repeat(7) + "####" + ".".repeat(11) + "#";
    // La règle de trajet du générateur interdit ce plafond ; le simulateur, lui, ne tue ni ne coince personne.
    const lv = parseLevel(text(rows, ["version 5", "section salle 0-23", "plateforme p 4 v 480 8,11 8,10"]));
    let s = onPlatform(lv, 0, 0);
    for (let t = 0; t < 700; t++) {
      s = step(s, 0, lv);
      expect(s.status).not.toBe(ATTEMPT_DEAD);
      const p = s.player;
      expect(p.y).toBeGreaterThanOrEqual(10 * T - 0);
    }
    // Il est retombé sur le sol, libre de bouger.
    expect(s.player.ground).toBe(1);
    const moved = step(s, R, lv);
    expect(moved.player.x).toBeGreaterThan(s.player.x);
  });
});

describe("lot 20 — un niveau sans plateforme se joue comme en v4", () => {
  it("le même niveau en version 4 ou 5 donne les mêmes états au pas près, et aucun champ de plus", () => {
    const rows = ferryRows();
    const body = text(rows, ["section salle 0-23"]);
    const v4 = parseLevel(body.replace("\n\n", "\n\nversion 4\n"));
    const v5 = parseLevel(body.replace("\n\n", "\n\nversion 5\n"));
    const rng = new Rng(20201);
    let a = initialAttempt(v4);
    let b = initialAttempt(v5);
    expect(Object.keys(b)).toEqual(Object.keys(a));
    for (let t = 0; t < 1500; t++) {
      const bits = rng.int(8);
      a = stepAttempt(a, bits, v4, P);
      b = stepAttempt(b, bits, v5, P);
      expect(b).toEqual(a);
    }
  });
});

describe("lot 20 — intégrité (fuzz)", () => {
  it("commandes aléatoires sur un niveau à plateformes horizontale et verticale : tout reste entier, sans −0, sous MAX_SPEED, hors des murs, jamais écrasé", () => {
    const rows = ferryRows();
    const annex = ["version 5", "section salle 0-23", "plateforme ferry 3 h 480 7,12 14,12", "plateforme asc 2 v 360 20,3 20,10"];
    const lv = parseLevel(text(rows, annex));
    for (const seed of [1, 2, 3]) {
      const rng = new Rng(seed);
      let s = initialAttempt(lv);
      let onBoard = 0;
      for (let t = 0; t < 700; t++) {
        const hold = 1 + rng.int(40);
        // Plutôt vers la droite, pour monter sur la plateforme.
        const bits = rng.int(4) === 0 ? rng.int(8) : R | (rng.int(3) === 0 ? J : 0);
        for (let k = 0; k < hold; k++) {
          s = stepAttempt(s, bits, lv, P);
          const p = s.player;
          for (const v of [p.x, p.y, p.vx, p.vy, s.time, s.ride ?? 0]) {
            expect(Number.isInteger(v)).toBe(true);
            expect(Object.is(v, -0)).toBe(false);
          }
          expect(Math.abs(p.vx)).toBeLessThanOrEqual(MAX_SPEED);
          expect(Math.abs(p.vy)).toBeLessThanOrEqual(MAX_SPEED);
          expect(p.x).toBeGreaterThanOrEqual(T);
          expect(p.x + PLAYER_WIDTH).toBeLessThanOrEqual(23 * T);
          if ((s.ride ?? -1) >= 0 && p.ground === 1) {
            onBoard++;
            expect(p.y + PLAYER_HEIGHT).toBe(platformAt(lv, s.sections, s.time, s.ride!).y);
          }
          if (s.status === ATTEMPT_DEAD || s.status === 3) s = initialAttempt(lv);
        }
      }
      expect(onBoard, `graine ${seed}`).toBeGreaterThan(0);
    }
  }, 60_000);

  it("cycleMod garde une phase négative dans le cycle", () => {
    expect(cycleMod(-1, 480)).toBe(479);
  });
});

// ——— Les règles de trajet ———

/** Une salle sans fosse avec une plateforme horizontale sur la rangée 11, un morceau de 24 colonnes : la section couvre tout. */
const flat = (rows: string[], annex: string[]) => parseLevel(text(rows, ["version 5", "section salle 0-23", ...annex]));
const PATH = "plateforme p 3 h 480 5,11 12,11";

describe("lot 20 — règles de trajet (platformProblems)", () => {
  it("un trajet dégagé n'a aucun problème", () => {
    expect(platformProblems(flat(flatRows(), [PATH]))).toEqual([]);
    expect(platformProblems(flat(flatRows(), ["plateforme asc 2 v 360 8,4 8,10"]))).toEqual([]);
    expect(platformProblems(ferryLevel())).toEqual([]);
  });

  it("jamais à moins de 2 rangées d'un plafond ou d'un plein au-dessus de lui, à aucun pas du cycle", () => {
    // Un plein à 2 rangées au-dessus de la rangée 11 : la rangée 9 est la limite (2 rangées libres : 9 et 10) ; un plein en rangée 10, à une seule rangée, est refusé.
    const ok = flatRows();
    ok[8] = "#" + ".".repeat(6) + "####" + ".".repeat(12) + "#";
    expect(platformProblems(flat(ok, [PATH]))).toEqual([]);
    const low = flatRows();
    low[10] = "#" + ".".repeat(6) + "####" + ".".repeat(12) + "#";
    expect(platformProblems(flat(low, [PATH])).join()).toMatch(/à moins de 2 rangées/);
    // Une plateforme verticale qui monte jusqu'à 2 rangées d'un plafond : refusée dès que le trajet s'en approche (à une rangée).
    const roof = flatRows();
    roof[2] = "#" + ".".repeat(6) + "####" + ".".repeat(12) + "#";
    expect(platformProblems(flat(roof, ["plateforme asc 2 v 360 8,4 8,10"])).join()).toMatch(/à moins de 2 rangées/);
    expect(platformProblems(flat(roof, ["plateforme asc 2 v 360 8,5 8,10"]))).toEqual([]);
  });

  it("jamais poussé contre un mur ni un pic : la place du personnage porté, avec ce qui dépasse de chaque bord, est libre sur tout le trajet", () => {
    const wall = flatRows();
    wall[10] = "#" + ".".repeat(13) + "#" + ".".repeat(8) + "#"; // un mur d'une rangée juste après l'extrémité droite (la dalle finit à la colonne 14)
    expect(platformProblems(flat(wall, [PATH])).join()).toMatch(/à moins de 2 rangées d'un plein ou d'un danger/);
    const spike = flatRows();
    spike[10] = "#" + ".".repeat(14) + "^" + ".".repeat(7) + "#";
    expect(platformProblems(flat(spike, [PATH])).join()).toMatch(/plein ou d'un danger/);
    // Un mur loin de l'extrémité : rien.
    const far = flatRows();
    far[10] = "#" + ".".repeat(19) + "#" + ".".repeat(2) + "#";
    expect(platformProblems(flat(far, [PATH]))).toEqual([]);
    // Un trajet vertical ne pousse pas de côté : un mur à côté de la colonne, sans rien au-dessus de la dalle, ne gêne pas.
    const side = flatRows();
    for (let r = 3; r < 11; r++) side[r] = "#" + ".".repeat(5) + "##" + ".".repeat(15) + "#";
    expect(platformProblems(flat(side, ["plateforme asc 2 v 360 8,4 8,10"]))).toEqual([]);
  });

  it("une scie (sur tout son cycle) ne passe pas près de la place du personnage porté", () => {
    const sawRows = flatRows();
    const near = flat(sawRows, [PATH, "scie s o 240 aller-retour 8,6 8,9"]);
    expect(platformProblems(near).join()).toMatch(/la scie s passe près/);
    const away = flat(sawRows, [PATH, "scie s o 240 aller-retour 8,2 8,4"]);
    expect(platformProblems(away)).toEqual([]);
  });

  it("dans son morceau, à au moins une colonne des bords de sa section ; deux trajets ne se recoupent pas", () => {
    const inSection = (c0: number, c1: number, line: string) => parseLevel(text(flatRows(), ["version 5", `section salle ${c0}-${c1}`, line]));
    expect(platformProblems(inSection(4, 19, "plateforme p 3 h 480 4,11 10,11")).join()).toMatch(/sort de la section/);
    expect(platformProblems(inSection(4, 19, "plateforme p 3 h 480 9,11 17,11")).join()).toMatch(/sort de la section/);
    expect(platformProblems(inSection(4, 19, "plateforme p 3 h 480 5,11 12,11"))).toEqual([]);
    expect(platformProblems(flat(flatRows(), [PATH, "plateforme q 2 h 480 10,11 16,11"])).join()).toMatch(/recoupe/);
    expect(platformProblems(flat(flatRows(), [PATH, "plateforme q 2 v 360 20,4 20,10"]))).toEqual([]);
  });
});

describe("lot 20 — le point de passage reste sûr à toute phase", () => {
  it("aucune plateforme ne traverse la boîte du départ ni d'un point de passage, à aucun pas de son cycle", () => {
    const rows = flatRows();
    rows[11] = "#S" + ".".repeat(8) + "C" + ".".repeat(11) + "F#";
    const crossing = parseLevel(text(rows, ["version 5", "section salle 0-23", "plateforme p 3 h 480 1,11 8,11"]));
    expect(respawnProblems(crossing).join()).toMatch(/plateforme p y passe/);
    const clear = parseLevel(text(rows, ["version 5", "section salle 0-23", "plateforme p 3 h 480 12,11 19,11"]));
    expect(respawnProblems(clear).filter((p) => p.includes("plateforme"))).toEqual([]);
  });
});

// ——— Les morceaux à plateformes ———

const PLATFORM_MODULES = MODULES.filter((m) => m.tags.includes("plateforme"));

describe("lot 20 — les morceaux à plateformes du catalogue", () => {
  it("de 6 à 8 morceaux de base, tous étiquetés `plateforme` et déclarés réservés à la version 5", () => {
    expect(PLATFORM_MODULES.length).toBeGreaterThanOrEqual(6);
    expect(PLATFORM_MODULES.length).toBeLessThanOrEqual(8);
    expect([...platformModuleIds()].sort()).toEqual(PLATFORM_MODULES.map((m) => m.id).sort());
    expect(new Set(PLATFORM_MODULES.map((m) => m.family)).size).toBe(PLATFORM_MODULES.length);
  });

  it("chaque variante passe toutes les règles : construction, paliers, trajet, solutions aux deux entrées jouables par un humain, toutes phases, aucune voie parasite", () => {
    let variants = 0;
    for (const def of PLATFORM_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        variants++;
        const label = `${def.id} v${v}`;
        const m = buildModule(def.id, v);
        expect(m.level.platforms.length, label).toBeGreaterThan(0);
        expect(palierProblems(m), label).toEqual([]);
        expect(platformProblems(m.level), label).toEqual([]);
        const sol = moduleSolutions(def.id, v)!;
        for (const entry of ["arret", "elan"] as const) expect(sol[entry]!.exigence, `${label} ${entry}`).toBeGreaterThanOrEqual(1);
        expect(variantExigence(sol), label).toBeGreaterThanOrEqual(1);
        expect(PHASE_REFUSED[def.id]?.includes(v) ?? false, `${label} : toutes phases`).toBe(false);
        expect(PARASITE_CLOSED[def.id]?.includes(v) ?? false, `${label} : voie parasite`).toBe(false);
      }
    }
    expect(variants).toBeGreaterThanOrEqual(25);
  });

  it("au moins 1 respiration (note ≤ 2 partout, trois sauts à faire), au moins 2 portions dures (une variante notée 4 ou 5), le reste des passages intermédiaires", () => {
    const rest = PLATFORM_MODULES.filter((m) => m.tags.includes("respiration"));
    expect(rest.length).toBeGreaterThanOrEqual(1);
    for (const def of rest) {
      for (let v = 0; v < def.variants.length; v++) {
        expect(variantExigence(moduleSolutions(def.id, v)), `${def.id} v${v}`).toBeLessThanOrEqual(2);
        for (const entry of ["arret", "elan"] as const) {
          const bits = fromRuns(decodeReplay(moduleSolutions(def.id, v)![entry]!.code).runs);
          const presses = bits.filter((b, t) => (b & J) !== 0 && (t === 0 || (bits[t - 1]! & J) === 0)).length;
          expect(presses, `${def.id} v${v} ${entry}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
    const hard = PLATFORM_MODULES.filter((def) => def.variants.some((_, v) => variantExigence(moduleSolutions(def.id, v)) >= 4));
    expect(hard.length, "portions dures").toBeGreaterThanOrEqual(2);
    expect(PLATFORM_MODULES.length - rest.length - hard.length, "passages intermédiaires").toBeGreaterThanOrEqual(2);
  });

  it("on monte vraiment sur la plateforme : la solution de chaque variante est portée par elle au moins un pas, aux deux entrées", () => {
    for (const def of PLATFORM_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        for (const entry of ["arret", "elan"] as const) {
          const bits = fromRuns(decodeReplay(moduleSolutions(def.id, v)![entry]!.code).runs);
          let s = initialAttempt(m.level);
          if (entry === "elan") s = { ...s, player: { ...s.player, vx: P.runSpeed } };
          let rode = 0;
          for (const b of bits) {
            s = stepAttempt(s, b, m.level, P);
            if ((s.ride ?? -1) >= 0 && s.player.ground === 1) rode++;
          }
          expect(rode, `${def.id} v${v} ${entry}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("lot 20 — les niveaux du jour", () => {
  it("les références v3 et v4 ne connaissent pas les morceaux à plateformes ; le générateur en vigueur (g15, v5) les pose", () => {
    const start = parseDay("2026-10-27")!;
    let withPlatforms = 0;
    for (let d = start; d < start + 20; d++) {
      for (const version of [SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION]) {
        const L = dailyLevel(d, null, version);
        expect(L.pieces.some((p) => platformModuleIds().has(p.id)), `${L.date} v${version}`).toBe(false);
        expect(L.level.platforms, `${L.date} v${version}`).toEqual([]);
      }
      const L = dailyLevel(d);
      expect(L.level.simVersion).toBe(PLATFORM_VERSION);
      expect(L.id).toBe(`jour-${L.date}-g${JUMP_GENERATOR_VERSION}`);
      expect(L.fallback, L.date).toBe(false);
      expect(dailyProblems(L), L.date).toEqual([]);
      expect(platformProblems(L.level), L.date).toEqual([]);
      expect(respawnProblems(L.level), L.date).toEqual([]);
      if (L.pieces.some((p) => platformModuleIds().has(p.id))) {
        withPlatforms++;
        expect(L.level.platforms.length, L.date).toBeGreaterThan(0);
        // La preuve de l'auteur : portée au moins un pas, jouée sans mort (la référence passe sans attendre, `horloge.test.ts`).
        let s = initialAttempt(L.level);
        let rode = 0;
        for (const b of fromRuns(L.replay.runs)) {
          s = stepAttempt(s, b, L.level, P);
          if ((s.ride ?? -1) >= 0 && s.player.ground === 1) rode++;
        }
        expect(rode, L.date).toBeGreaterThan(0);
      }
    }
    expect(withPlatforms).toBeGreaterThanOrEqual(10);
  }, 120_000);
});
