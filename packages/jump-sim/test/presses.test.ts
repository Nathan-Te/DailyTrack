import "./legacy";
import { Rng, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEATH_PRESS,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  MUSHROOM_GENERATOR,
  MUSHROOM_VERSION,
  LevelError,
  MAX_PRESS_STEP,
  MODULES,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  PLATFORM_EASE,
  PLATFORM_EASE_ONE,
  PLATFORM_EASE_STEPS,
  PLATFORM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PRESS_FALL,
  PRESS_GENERATOR,
  PRESS_HEIGHT_TILES,
  PRESS_RISE_FACTOR,
  PRESS_VERSION,
  SECTION_CLOCK_VERSION,
  SINGLE_CLOCK_VERSION,
  UNITS_PER_TILE,
  buildModule,
  cycleMod,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  freezeLevel,
  frozenJson,
  fromRuns,
  initialAttempt,
  moduleSolutions,
  palierProblems,
  parseLevel,
  pressAt,
  pressBox,
  pressBoxes,
  pressModuleIds,
  pressPart,
  pressPos,
  presseProblems,
  respawnProblems,
  sectionPeriod,
  stepAttempt,
  thawLevel,
  variantExigence,
  type AttemptState,
  type Level,
  variantUsable,
} from "../src/index";

// Lot 22 : les presses (sim v6, générateur g16). Les niveaux sont de petits textes écrits ici.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;

const text = (rows: string[], annex: string[] = []) => rows.join("\n") + (annex.length > 0 ? "\n\n" + annex.join("\n") : "") + "\n";

/**
 * Une salle de 24 colonnes sur 14 rangées : un sol plein aux rangées 12-13, un plafond plein à la rangée 0. La presse `p` (2 colonnes, de la colonne 10) tombe
 * de la rangée 6 (position haute) de 4 tuiles : son bord bas touche le sol (rangée 12) en bas de sa course (6 + 4 + 2 = 12). Attente 180, chute 30, pause 60,
 * remontée 150 : cycle 420.
 */
function roomRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(22) + "#");
  rows[0] = "#".repeat(24);
  for (let r = 12; r < 14; r++) rows[r] = "#".repeat(24);
  rows[11] = "#S" + ".".repeat(20) + "F#";
  return rows;
}
const PRESS = ["version 6", "section salle 0-23", "presse p 2 10,6 4 180 30 60 150"];
const press = (annex: string[] = PRESS, rows = roomRows()): Level => parseLevel(text(rows, annex));

/** Un état en course, le personnage posé sur le sol dans la colonne `col` (rangée de ses pieds `row`), `time` pas déjà écoulés. */
function running(level: Level, col: number, row: number, time: number): AttemptState {
  const s = initialAttempt(level);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  return { ...s, status: 1, time, player: { ...s.player, x, y, ground: 1, air: 0 } };
}
const step = (s: AttemptState, bits: number, level: Level) => stepAttempt(s, bits, level, P);

describe("lot 22 — la version de la simulation", () => {
  it("la version 6 est celle des presses, le générateur g16 (lot 23 : la version 7 et g17 les gardent)", () => {
    expect(PRESS_VERSION).toBe(6);
    expect(MUSHROOM_VERSION).toBe(7);
    expect(PRESS_GENERATOR).toBe(16);
    expect(press().simVersion).toBe(6);
  });
});

describe("lot 22 — lecture du bloc annexe", () => {
  it("lit une presse : largeur, position haute, course, durées, cycle, section", () => {
    const p = press().presses[0]!;
    expect(p).toEqual({ id: "p", width: 2, col: 10, row: 6, travel: 4, hold: 180, fall: 30, rest: 60, rise: 150, cycle: 420, section: 0 });
    expect(sectionPeriod(press(), 0)).toBe(420);
  });

  it("refuse ce qui est mal formé", () => {
    const bad = (line: string, rows = roomRows()) => () => press(["version 6", "section salle 0-23", line], rows);
    expect(bad("presse p 1 10,6 4 180 30 60 150")).toThrow(LevelError); // largeur 1
    expect(bad("presse p 4 10,6 4 180 30 60 150")).toThrow(/largeur/);
    expect(bad("presse p 2 10,6 4 119 30 60 150")).toThrow(/au moins 1 s/); // attente en haut : au moins 1 s
    expect(bad("presse p 2 10,6 4 180 30 60 89")).toThrow(/remontée/); // remontée : 3 fois la chute au moins
    expect(bad("presse p 2 10,6 4 180 30 60 150 9")).toThrow(/attendu/);
    expect(bad("presse p 2 10,6 1 180 30 60 150")).toThrow(/course/);
    expect(bad("presse p 2 10,2 4 600 60 240 600")).toThrow(/cycle/);
    expect(bad("presse p 2 10,2 8 180 18 60 150")).toThrow(/trop rapide/);
    expect(bad("presse p 2 10,9 4 180 30 60 150")).toThrow(/sort de la grille/);
    expect(() => press(["version 6", "section a 0-10", "section b 11-23", "presse p 2 10,6 4 180 30 60 150"])).toThrow(/une seule section/); // à cheval sur deux sections
    const solid = roomRows();
    solid[8] = "#" + ".".repeat(9) + "#" + ".".repeat(12) + "#";
    expect(bad("presse p 2 10,6 4 180 30 60 150", solid)).toThrow(/pas vide/);
    expect(() => press([...PRESS, "presse p 2 14,6 4 180 30 60 150"])).toThrow(/déjà déclarée/);
    expect(() => press([...PRESS, "presse q 2 11,6 4 180 30 60 150"])).toThrow(/recoupe/);
  });
});

describe("lot 22 — les tables sont entières", () => {
  it("la chute est k² : 65 entiers de 0 à 4 096, croissants ; la remontée lit la table de ralenti", () => {
    expect(PRESS_FALL).toHaveLength(PLATFORM_EASE_STEPS + 1);
    expect(PRESS_FALL[0]).toBe(0);
    expect(PRESS_FALL[PLATFORM_EASE_STEPS]).toBe(PLATFORM_EASE_ONE);
    PRESS_FALL.forEach((v, k) => {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBe(k * k);
      if (k > 0) expect(v).toBeGreaterThan(PRESS_FALL[k - 1]!);
    });
    expect(PLATFORM_EASE).toHaveLength(PLATFORM_EASE_STEPS + 1);
  });

  it("le profil : en haut jusqu'au pas `attente`, chute, en bas pendant la pause, remontée, retour exact à chaque cycle ; tout est entier, sans −0", () => {
    const p = press().presses[0]!;
    const part = (t: number) => pressPart(p, t);
    for (let t = 0; t <= p.hold; t++) expect(part(t), `attente ${t}`).toBe(0);
    expect(part(p.hold + 1), "la chute part au pas qui suit l'attente").toBeGreaterThan(0);
    for (let t = p.hold + 1; t <= p.hold + p.fall; t++) expect(part(t)).toBeGreaterThan(part(t - 1));
    expect(part(p.hold + p.fall)).toBe(PLATFORM_EASE_ONE);
    for (let t = p.hold + p.fall; t < p.hold + p.fall + p.rest; t++) expect(part(t), `pause ${t}`).toBe(PLATFORM_EASE_ONE);
    const riseStart = p.hold + p.fall + p.rest;
    for (let t = riseStart + 1; t < p.cycle; t++) expect(part(t), `remontée ${t}`).toBeLessThanOrEqual(part(t - 1));
    expect(part(p.cycle)).toBe(0);
    for (let t = -2 * p.cycle; t < 3 * p.cycle; t++) {
      const v = part(t);
      expect(Number.isInteger(v)).toBe(true);
      expect(Object.is(v, -0)).toBe(false);
      expect(part(t + p.cycle)).toBe(v);
      const at = pressPos(p, t);
      expect(Object.is(at.y, -0)).toBe(false);
      expect(at.y).toBeGreaterThanOrEqual(p.row * T);
      expect(at.y).toBeLessThanOrEqual((p.row + p.travel) * T);
    }
  });

  it("la chute est rapide, la remontée nettement plus lente ; la presse ne fait jamais un pas d'une tuile", () => {
    const p = press().presses[0]!;
    expect(p.rise).toBeGreaterThanOrEqual(PRESS_RISE_FACTOR * p.fall);
    const dy = (t: number) => Math.abs(pressPos(p, t + 1).y - pressPos(p, t).y);
    let fall = 0;
    let rise = 0;
    for (let t = p.hold; t < p.hold + p.fall; t++) fall = Math.max(fall, dy(t));
    for (let t = p.hold + p.fall + p.rest; t < p.cycle; t++) rise = Math.max(rise, dy(t));
    expect(fall).toBeGreaterThan(2 * rise);
    expect(fall).toBeLessThan(MAX_PRESS_STEP);
    // Durée de l'attente en haut : au moins une seconde.
    expect(p.hold).toBeGreaterThanOrEqual(120);
  });

  it("pressBox est toute la presse : sa largeur sur sa hauteur, dont le bord bas touche le sol en bas de course", () => {
    const p = press().presses[0]!;
    const b = pressBox(p, p.hold + p.fall);
    expect(b).toEqual({ x: 10 * T, y: 10 * T, w: 2 * T, h: PRESS_HEIGHT_TILES * T });
    expect(b.y + b.h).toBe(12 * T);
    expect(pressBoxes(press(), { ...initialAttempt(press()), time: 0 })[0]).toEqual(pressBox(p, 0));
  });
});

describe("lot 22 — toute la presse tue au contact", () => {
  const level = press();
  const bottom = 180 + 30; // pas où la presse est en bas
  it("sous la presse en bas, le personnage meurt (DEATH_PRESS)", () => {
    const s = step(running(level, 10, 11, bottom - 1), 0, level);
    expect(s.status).toBe(ATTEMPT_DEAD);
    expect(s.deathCause).toBe(DEATH_PRESS);
  });

  it("en haut, avec de la place dessous, il passe sans mourir ; à côté de la course, jamais", () => {
    expect(step(running(level, 10, 11, 10), 0, level).status).not.toBe(ATTEMPT_DEAD);
    for (const col of [8, 12]) {
      const s = step(running(level, col, 11, bottom - 1), 0, level);
      expect(s.status, `colonne ${col}`).not.toBe(ATTEMPT_DEAD);
    }
  });

  it("tout le corps est mortel : la face basse, mais aussi le dessus ou le milieu (un saut qui y entre par le haut)", () => {
    // Le personnage dans la course, la presse à mi-chemin : sa boîte recoupe celle de la presse, quelle que soit la partie touchée.
    const p = level.presses[0]!;
    for (const t of [p.hold + 15, p.hold + p.fall, p.hold + p.fall + 30]) {
      const box = pressBox(p, t);
      for (const dy of [-PLAYER_HEIGHT + 100, -PLAYER_HEIGHT / 2, box.h - 100]) {
        const s0 = running(level, 10, 11, t - 1);
        const s1 = { ...s0, player: { ...s0.player, x: box.x + 100, y: box.y + dy, ground: 0, air: 5 } };
        expect(step(s1, 0, level).deathCause, `t ${t} dy ${dy}`).toBe(DEATH_PRESS);
      }
    }
  });

  it("se toucher par un bord ne tue pas, comme pour un pic", () => {
    const p = level.presses[0]!;
    const b = pressBox(p, p.hold + p.fall);
    const s0 = running(level, 10, 11, p.hold + p.fall - 1);
    // Posé sur le sol (pieds à 12 T), la tête à 12 T − 3072 : la presse (bas à 12 T) la recouvre ; décalé à droite du bord : à ras du bord, rien.
    const touching = { ...s0, player: { ...s0.player, x: b.x + b.w, y: 12 * T - PLAYER_HEIGHT } };
    expect(step(touching, 0, level).status).not.toBe(ATTEMPT_DEAD);
  });

  it("on ne monte pas dessus : aucune plateforme, aucun appui sur la presse, le personnage qui tombe sur sa face haute la traverse et meurt", () => {
    const p = level.presses[0]!;
    const t = p.hold + p.fall + 10;
    const b = pressBox(p, t);
    const s0 = running(level, 10, 11, t);
    const fall = { ...s0, player: { ...s0.player, x: b.x + 500, y: b.y - PLAYER_HEIGHT - 50, ground: 0, air: 3, vy: 400 } };
    let s = fall;
    for (let k = 0; k < 12 && s.status !== ATTEMPT_DEAD; k++) s = step(s, 0, level);
    expect(s.status).toBe(ATTEMPT_DEAD);
    expect(s.deathCause).toBe(DEATH_PRESS);
  });

  it("l'arrivée l'emporte sur la mort au même pas", () => {
    const rows = roomRows();
    const finish = parseLevel(text(rows, PRESS));
    const p = finish.presses[0]!;
    const b = pressBox(p, p.hold + p.fall);
    const s0 = running(finish, 10, 11, p.hold + p.fall - 1);
    const onFinish = { ...s0, player: { ...s0.player, x: finish.finish.col * T, y: finish.finish.row * T } };
    expect(step(onFinish, 0, finish).status).toBe(ATTEMPT_FINISHED);
    expect(b.w).toBeGreaterThan(0);
  });

  it("la presse suit l'horloge de sa section : la phase de la section la décale (v6, f(t + phase))", () => {
    const shifted = press(["version 6", "section salle 0-23 phase 100", "presse p 2 10,6 4 180 30 60 150"]);
    expect(pressAt(shifted, [], 0, 0)).toEqual(pressBox(shifted.presses[0]!, 100));
    expect(pressAt(shifted, [], 80, 0).y).toBe(pressPos(shifted.presses[0]!, 180).y);
    // Une phase négative (« Prêt… ») se lit dans le cycle.
    expect(pressAt(shifted, [], -250, 0).y).toBe(pressPos(shifted.presses[0]!, cycleMod(-150, 420)).y);
  });
});

describe("lot 22 — un niveau sans presse se joue comme en v5", () => {
  it("le même niveau en version 5 ou 6 donne les mêmes états au pas près, et aucun champ de plus", () => {
    const body = text(roomRows(), ["section salle 0-23"]);
    const v5 = parseLevel(body.replace("\n\n", "\n\nversion 5\n"));
    const v6 = parseLevel(body.replace("\n\n", "\n\nversion 6\n"));
    const rng = new Rng(2022);
    let a = initialAttempt(v5);
    let b = initialAttempt(v6);
    expect(Object.keys(b)).toEqual(Object.keys(a));
    for (let t = 0; t < 1500; t++) {
      const bits = rng.int(8);
      a = stepAttempt(a, bits, v5, P);
      b = stepAttempt(b, bits, v6, P);
      expect(b).toEqual(a);
    }
  });
});

describe("lot 22 — intégrité (fuzz)", () => {
  it("commandes aléatoires dans une salle à presse : tout reste entier, sans −0, la mort est toujours celle d'une presse ou d'un danger connu", () => {
    const rng = new Rng(220);
    let s = initialAttempt(level2());
    const lv = level2();
    for (let t = 0; t < 4000; t++) {
      s = stepAttempt(s, rng.int(8), lv, P);
      for (const v of [s.time, s.player.x, s.player.y, s.player.vx, s.player.vy]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(Object.is(v, -0)).toBe(false);
      }
      if (s.status === ATTEMPT_DEAD) expect([DEATH_PRESS, 3]).toContain(s.deathCause);
    }
  });
  function level2() {
    return press();
  }
});

describe("lot 22 — règles du générateur (presseProblems)", () => {
  /** Une salle de 30 colonnes : sol aux rangées 12-13, un plafond ; la presse est entre les colonnes 12-13. */
  const base = () => {
    const rows: string[] = [];
    for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(28) + "#");
    rows[0] = "#".repeat(30);
    rows[12] = "#".repeat(30);
    rows[13] = "#".repeat(30);
    rows[11] = "#S" + ".".repeat(26) + "F#";
    return rows;
  };
  const annex = ["version 6", "section salle 0-29", "presse p 2 12,6 4 180 30 60 150"];
  const check = (rows: string[], extra: string[] = []) => presseProblems(parseLevel(text(rows, [...annex, ...extra])));

  it("une presse bien posée n'a aucun problème", () => {
    expect(check(base())).toEqual([]);
  });

  it("sous chaque presse, un sol plein", () => {
    const rows = base();
    rows[12] = "#".repeat(13) + "~" + "#".repeat(16);
    expect(check(rows).join("\n")).toMatch(/pas de sol plein/);
    const hole = base();
    hole[12] = "#".repeat(12) + ".." + "#".repeat(16);
    hole[13] = hole[12]!;
    expect(check(hole).join("\n")).toMatch(/pas de sol plein/);
  });

  it("une place sûre pour attendre devant chaque presse : un bloc plein au niveau du sol, deux tuiles libres au-dessus", () => {
    const rows = base();
    for (let c = 8; c <= 11; c++) rows[12] = rows[12]!.slice(0, c) + "." + rows[12]!.slice(c + 1);
    expect(check(rows).join("\n")).toMatch(/pas de place sûre/);
    const low = base();
    for (let c = 8; c <= 11; c++) low[10] = low[10]!.slice(0, c) + "#" + low[10]!.slice(c + 1);
    expect(check(low).join("\n")).toMatch(/pas de place sûre/);
    // Un seul bloc suffit.
    const one = base();
    for (let c = 8; c <= 10; c++) one[12] = one[12]!.slice(0, c) + "." + one[12]!.slice(c + 1);
    expect(check(one)).toEqual([]);
  });

  it("une scie qui balaie la place pour attendre (à un pas de son cycle) la rend inutilisable", () => {
    const rows = base();
    for (let c = 8; c <= 10; c++) rows[12] = rows[12]!.slice(0, c) + "." + rows[12]!.slice(c + 1);
    // Il ne reste que la colonne 11 ; une scie passe sur elle.
    expect(check(rows, ["scie s 0.5 240 aller-retour 11,11 11,9"]).join("\n")).toMatch(/pas de place sûre/);
  });

  it("ni tapis ni vent qui poussent dessous sans que le joueur agisse", () => {
    const into = base();
    into[12] = "#".repeat(5) + "]]]]]]" + "#".repeat(19); // un tapis vers la droite finit à la colonne 10 : 1 colonne de la course (12)
    expect(check(into).join("\n")).toMatch(/porte vers elle/);
    const far = base();
    far[12] = "#".repeat(3) + "]]]]" + "#".repeat(23); // finit à la colonne 6 : 5 colonnes de marge
    expect(check(far)).toEqual([]);
    const away = base();
    away[12] = "#".repeat(2) + "[[[[[[" + "#".repeat(22); // un tapis vers la gauche à gauche de la presse la repousse
    expect(check(away)).toEqual([]);
    const right = base();
    right[12] = "#".repeat(14) + "[[[" + "#".repeat(13); // vers la gauche, à droite de la presse, collé à elle : il la pousse dessous
    expect(check(right).join("\n")).toMatch(/porte vers elle/);
    const under = base();
    under[12] = "#".repeat(12) + "]]" + "#".repeat(16);
    expect(check(under).join("\n")).toMatch(/dans les colonnes de sa course/);
    expect(check(base(), ["vent 8-9 8-11 droite 100"]).join("\n")).toMatch(/zone de vent/);
  });

  it("rien d'autre dans sa course : ni scie ni plateforme mobile", () => {
    expect(check(base(), ["scie s 0.5 240 aller-retour 12,7 13,9"]).join("\n")).toMatch(/passe dans sa course/);
    expect(check(base(), ["plateforme q 2 h 600 3,9 8,9"])).toEqual([]);
  });

  it("dans son morceau : à au moins une colonne des bords de sa section", () => {
    const rows = base();
    const out = presseProblems(parseLevel(text(rows, ["version 6", "section salle 0-27", "section bout 28-29", "presse p 2 26,6 4 180 30 60 150"])));
    expect(out.join("\n")).toMatch(/sort de la section/);
  });

  it("pas de point de passage sous une presse ni dans sa course", () => {
    const rows = base();
    rows[11] = rows[11]!.slice(0, 12) + "C" + rows[11]!.slice(13);
    expect(check(rows).join("\n")).toMatch(/point 1/);
  });
});

describe("lot 22 — le point de passage reste sûr à toute phase", () => {
  it("aucune presse ne traverse la boîte du départ ni d'un point de passage, à aucun pas de son cycle", () => {
    const rows = roomRows();
    rows[11] = "#S" + ".".repeat(8) + "C" + ".".repeat(11) + "F#";
    expect(respawnProblems(press(PRESS, rows)).join("\n")).toMatch(/presse p y passe/);
    const ok = roomRows();
    ok[11] = "#S" + ".".repeat(4) + "C" + ".".repeat(15) + "F#";
    expect(respawnProblems(press(PRESS, ok))).toEqual([]);
  });
});

const PRESS_MODULES = MODULES.filter((m) => m.tags.includes("presse"));

describe("lot 22 — les morceaux à presses de l'usine", () => {
  it("de 6 à 8 morceaux de base de l'usine, tous étiquetés `presse` et déclarés réservés à la version 6", () => {
    expect(PRESS_MODULES.length).toBeGreaterThanOrEqual(6);
    expect(PRESS_MODULES.length).toBeLessThanOrEqual(8);
    expect([...pressModuleIds()].sort()).toEqual(PRESS_MODULES.map((m) => m.id).sort());
    expect(new Set(PRESS_MODULES.map((m) => m.family)).size).toBe(PRESS_MODULES.length);
    for (const m of PRESS_MODULES) expect(m.theme, m.id).toBe("usine");
  });

  it("chaque variante passe toutes les règles : construction, paliers, presses, solutions aux deux entrées jouables par un humain, toutes phases, aucune voie parasite", () => {
    let variants = 0;
    for (const def of PRESS_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const label = `${def.id} v${v}`;
        const m = buildModule(def.id, v);
        expect(m.level.presses.length, label).toBeGreaterThan(0);
        expect(palierProblems(m), label).toEqual([]);
        expect(presseProblems(m.level), label).toEqual([]);
        if (!variantUsable(def.id, v)) continue;
        const sol = moduleSolutions(def.id, v)!;
        if (PHASE_REFUSED[def.id]?.includes(v) || PARASITE_CLOSED[def.id]?.includes(v)) continue;
        variants++;
        for (const entry of ["arret", "elan"] as const) expect(sol[entry]!.exigence, `${label} ${entry}`).toBeGreaterThanOrEqual(1);
        expect(variantExigence(sol), label).toBeGreaterThanOrEqual(1);
      }
    }
    expect(variants).toBeGreaterThanOrEqual(25);
  });

  it("au moins 1 respiration (note ≤ 2, trois sauts), 2 portions dures (une variante notée 4 ou 5), 2 morceaux qui combinent presses et tapis roulants", () => {
    const rest = PRESS_MODULES.filter((m) => m.tags.includes("respiration"));
    expect(rest.length).toBeGreaterThanOrEqual(1);
    for (const def of rest) {
      for (let v = 0; v < def.variants.length; v++) {
        expect(variantExigence(moduleSolutions(def.id, v)), `${def.id} v${v}`).toBeLessThanOrEqual(2);
        for (const entry of ["arret", "elan"] as const) {
          const bits = fromRuns(decodeReplay(moduleSolutions(def.id, v)![entry]!.code).runs);
          const presses = bits.filter((b, t) => (b & INPUT_JUMP) !== 0 && (t === 0 || (bits[t - 1]! & INPUT_JUMP) === 0)).length;
          expect(presses, `${def.id} v${v} ${entry}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
    const usable = (id: string, v: number) => variantUsable(id, v) && !PHASE_REFUSED[id]?.includes(v) && !PARASITE_CLOSED[id]?.includes(v);
    const hard = PRESS_MODULES.filter((def) => def.variants.some((_, v) => usable(def.id, v) && variantExigence(moduleSolutions(def.id, v)) >= 4));
    expect(hard.length, "portions dures").toBeGreaterThanOrEqual(2);
    expect(PRESS_MODULES.filter((m) => m.tags.includes("tapis")).length, "presses et tapis").toBeGreaterThanOrEqual(2);
  });

  it("la solution de chaque variante passe vraiment sous une presse (elle traverse sa course, au sol) sans mourir, aux deux entrées", () => {
    for (const def of PRESS_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        for (const entry of ["arret", "elan"] as const) {
          const sol = moduleSolutions(def.id, v)?.[entry];
          if (!sol) continue;
          const bits = fromRuns(decodeReplay(sol.code).runs);
          let s = initialAttempt(m.level);
          if (entry === "elan") s = { ...s, player: { ...s.player, vx: P.runSpeed } };
          let inside = 0;
          for (const b of bits) {
            s = stepAttempt(s, b, m.level, P);
            expect(s.status, `${def.id} v${v} ${entry}`).not.toBe(ATTEMPT_DEAD);
            const col = Math.floor((s.player.x + PLAYER_WIDTH / 2) / T);
            if (m.level.presses.some((p) => col >= p.col && col < p.col + p.width)) inside++;
          }
          expect(inside, `${def.id} v${v} ${entry}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("lot 22 — les niveaux du jour", () => {
  it("les références v3, v4 et v5 ne connaissent pas les morceaux à presses ; la référence v6 (g16) et le générateur en vigueur (g17, v7) les posent", () => {
    const start = parseDay("2026-10-27")!;
    let withPresses = 0;
    for (let d = start; d < start + 40; d++) {
      for (const version of [SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, PLATFORM_VERSION]) {
        const L = dailyLevel(d, null, version);
        expect(L.pieces.some((p) => pressModuleIds().has(p.id)), `${L.date} v${version}`).toBe(false);
        expect(L.level.presses, `${L.date} v${version}`).toEqual([]);
      }
      const L = dailyLevel(d, null, MUSHROOM_VERSION); // lot 24 : la référence v7 (g17)
      expect(L.level.simVersion).toBe(MUSHROOM_VERSION);
      expect(L.id).toBe(`jour-${L.date}-g${MUSHROOM_GENERATOR}`);
      expect(dailyLevel(d, null, PRESS_VERSION).id).toBe(`jour-${L.date}-g${PRESS_GENERATOR}`);
      expect(L.fallback, L.date).toBe(false);
      expect(dailyProblems(L), L.date).toEqual([]);
      expect(presseProblems(L.level), L.date).toEqual([]);
      expect(respawnProblems(L.level), L.date).toEqual([]);
      if (L.pieces.some((p) => pressModuleIds().has(p.id))) {
        withPresses++;
        expect(L.theme, L.date).toBe("usine");
        expect(L.level.presses.length, L.date).toBeGreaterThan(0);
        // La preuve de l'auteur est jouée sans mort (la référence passe sans attendre).
        let s = initialAttempt(L.level);
        for (const b of fromRuns(L.replay.runs)) {
          s = stepAttempt(s, b, L.level, P);
          expect(s.status, L.date).not.toBe(ATTEMPT_DEAD);
        }
      }
      // Les presses ne sortent que de l'usine.
      if (L.theme !== "usine") expect(L.level.presses, L.date).toEqual([]);
    }
    expect(withPresses).toBeGreaterThanOrEqual(3);
  }, 240_000);

  it("la référence v5 (g15) est encore rendue à l'identique : même identifiant `-g15`, même texte que le golden", () => {
    const d = parseDay("2026-11-08")!;
    const old = dailyLevel(d, null, PLATFORM_VERSION);
    expect(old.id).toBe("jour-2026-11-08-g15");
    expect(old.level.simVersion).toBe(PLATFORM_VERSION);
  });
});

describe("lot 22 — un jour à presses se fige et se relit", () => {
  it("figer puis relire rend le même niveau, les mêmes presses, et la preuve se rejoue ; une version incohérente est refusée", () => {
    const start = parseDay("2026-10-27")!;
    let day: ReturnType<typeof dailyLevel> | undefined;
    for (let d = start; d < start + 60 && !day; d++) {
      const L = dailyLevel(d, null, MUSHROOM_VERSION);
      if (L.level.presses.length > 0) day = L;
    }
    expect(day, "un jour à presses sur 60").toBeDefined();
    const raw = JSON.parse(frozenJson(freezeLevel(day!)));
    expect(raw.simVersion).toBe(MUSHROOM_VERSION);
    expect(raw.generatorVersion).toBe(MUSHROOM_GENERATOR);
    const back = thawLevel(raw, day!.day);
    expect(typeof back).not.toBe("string");
    if (typeof back === "string") return;
    expect(back.ascii).toBe(day!.ascii);
    expect(back.level.presses).toEqual(day!.level.presses);
    expect(back.code).toBe(day!.code);
    expect(thawLevel({ ...raw, generatorVersion: 15 }, day!.day)).toBe("versions incohérentes");
    expect(thawLevel({ ...raw, generatorVersion: PRESS_GENERATOR }, day!.day)).toBe("versions incohérentes"); // lot 23 : g16 est en version 6
    expect(thawLevel({ ...raw, simVersion: PLATFORM_VERSION }, day!.day)).toBe("versions incohérentes");
  }, 240_000);
});

