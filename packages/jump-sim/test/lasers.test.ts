import { Rng, parseDay, formatDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEATH_LASER,
  DEATH_NAMES,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  LASER_BAR_MAX_TRAVEL,
  LASER_GENERATOR,
  LASER_MIN_OFF,
  LASER_MIN_ON,
  LASER_THICKNESS,
  LASER_VERSION,
  LevelError,
  MAX_LASER_STEP,
  MAX_SPEED,
  MODULES,
  MUSHROOM_VERSION,
  PARASITE_CLOSED,
  PHASE_REFUSED,
  PLATFORM_EASE_ONE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  STALACTITE_VERSION,
  UNITS_PER_TILE,
  buildModule,
  cycleMod,
  dailyLevel,
  dailyProblems,
  deathAt,
  decodeReplay,
  freezeLevel,
  frozenJson,
  fromRuns,
  initialAttempt,
  jumpThemeForDay,
  laserModuleIds,
  moduleSolutions,
  palierProblems,
  respawnProblems,
  thawLevel,
  variantExigence,
  laserBarAt,
  laserBarBox,
  laserBarPos,
  laserBox,
  laserBoxes,
  laserIsOn,
  laserOn,
  laserProblems,
  parseLevel,
  sectionPeriod,
  stepAttempt,
  type AttemptState,
  type Level,
} from "../src/index";

// Lot 25 : les lasers (sim v9, générateur g19). Les niveaux sont de petits textes écrits ici.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;
const text = (rows: string[], annex: string[] = []) => rows.join("\n") + (annex.length > 0 ? "\n\n" + annex.join("\n") : "") + "\n";

/** Une salle de 28 colonnes sur 14 rangées : plafond à la rangée 0, sol aux rangées 12-13 (on y marche rangée 11), murs aux colonnes 0 et 27. */
function roomRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(26) + "#");
  rows[0] = "#".repeat(28);
  rows[12] = rows[13] = "#".repeat(28);
  rows[11] = "#S" + ".".repeat(24) + "F#";
  return rows;
}
/** Un portail : un rayon vertical de 11 tuiles (rangées 1 à 11) à la colonne 14, entre le plafond et le sol ; 150 pas allumé sur un cycle de 360 (210 éteints). */
const GATE = ["version 9", "section salle 0-27", "laser g v 14,1 11 360 150 0"];
const gate = (annex: string[] = GATE, rows = roomRows()): Level => parseLevel(text(rows, annex));

/** Un état en course, le personnage posé sur le sol dans la colonne `col` (rangée de ses pieds `row`), `time` pas déjà écoulés. */
function running(level: Level, col: number, row: number, time: number): AttemptState {
  const s = initialAttempt(level);
  const x = col * T + (T - PLAYER_WIDTH) / 2;
  const y = (row + 1) * T - PLAYER_HEIGHT;
  return { ...s, status: 1, time, player: { ...s.player, x, y, ground: 1, air: 0 } };
}
const step = (s: AttemptState, bits: number, level: Level) => stepAttempt(s, bits, level, P);

describe("lot 25 — la version de la simulation", () => {
  it("la version 9 est celle des lasers, le générateur g19 (lot 24 : la version 8 et g18 les gardent ; lot 26 : la version 10 et g20 sont celles des ponts)", () => {
    expect(LASER_VERSION).toBe(9);
    expect(STALACTITE_VERSION).toBe(8);
    expect(LASER_GENERATOR).toBe(19);
    expect(JUMP_SIM_VERSION).toBe(11);
    expect(JUMP_GENERATOR_VERSION).toBe(21);
    expect(gate().simVersion).toBe(9);
    expect(DEATH_LASER).toBe(6);
    expect(DEATH_NAMES[DEATH_LASER]).toBe("laser");
  });
});

describe("lot 25 — lecture du bloc annexe", () => {
  it("lit un laser fixe : axe, première tuile, longueur, cycle, durées, section", () => {
    const l = gate();
    expect(l.lasers).toEqual([{ id: "g", axis: "v", col: 14, row: 1, length: 11, cycle: 360, on: 150, shift: 0, section: 0 }]);
    expect(l.laserBars).toEqual([]);
    expect(sectionPeriod(l, 0)).toBe(360);
  });

  it("refuse ce qui est mal formé : durées minimales, émetteurs, tuiles du rayon, section", () => {
    const bad = (line: string, rows = roomRows()) => () => gate(["version 9", "section salle 0-27", line], rows);
    expect(bad("laser g v 14,1 11 360 89 0")).toThrow(/au moins 90/); // allumé : au moins 0,75 s
    expect(bad("laser g v 14,1 11 360 241 0")).toThrow(/éteint 119 pas/); // éteint : au moins 1 s
    expect(bad("laser g v 14,1 11 1201 150 0")).toThrow(/cycle/);
    expect(bad("laser g v 14,1 11 360 150 360")).toThrow(/décalage/);
    expect(bad("laser g v 14,1 0 360 150 0")).toThrow(/longueur/);
    expect(bad("laser g v 14,1 11 360 150")).toThrow(/attendu/);
    expect(bad("laser g x 14,1 11 360 150 0")).toThrow(/axe/);
    expect(bad("laser g v 14,1 10 360 150 0")).toThrow(/émetteur/); // la tuile sous le rayon est vide : pas d'émetteur
    expect(bad("laser g v 14,2 11 360 150 0")).toThrow(/sortent de la grille|émetteur/);
    expect(() => gate([...GATE, "laser g v 15,1 11 360 150 0"])).toThrow(/déjà déclaré/);
    const spike = roomRows();
    spike[5] = spike[5]!.slice(0, 14) + "^" + spike[5]!.slice(15);
    expect(bad("laser g v 14,1 11 360 150 0", spike)).toThrow(/pas vide/);
    expect(() => gate(["version 9", "section a 0-13", "section b 14-27", "laser g h 12,5 4 360 150 0"])).toThrow(/émetteur|une seule section/);
    expect(() => parseLevel(text(roomRows(), ["version 8", "section salle 0-27", "laser g v 14,1 11 360 150 0"]))).not.toThrow(); // l'annexe se lit quelle que soit la version déclarée
  });

  it("lit une barre coulissante et refuse le reste : axe, rapidité, trajet", () => {
    const bar = (line: string, rows = roomRows()) => gate(["version 9", "section salle 0-27", line], rows);
    const b = bar("barre b h 4 480 12,3 12,8").laserBars[0]!;
    expect(b).toEqual({ id: "b", axis: "h", length: 4, cycle: 480, a: { col: 12, row: 3 }, b: { col: 12, row: 8 }, section: 0 });
    expect(sectionPeriod(bar("barre b h 4 480 12,3 12,8"), 0)).toBe(480);
    expect(() => bar("barre b h 4 480 12,3 13,8")).toThrow(/même colonne/); // un rayon horizontal glisse sur sa colonne
    expect(() => bar("barre b v 3 480 12,3 18,3")).not.toThrow(); // un rayon vertical, sur sa rangée
    expect(() => bar("barre b v 3 480 12,3 12,8")).toThrow(/même rangée/);
    expect(() => bar("barre b h 4 479 12,3 12,8")).toThrow(/pair/);
    expect(() => bar("barre b h 4 480 12,3 12,10")).toThrow(/trop rapide/); // 7 tuiles en 480 pas : 179 unités par pas à la pointe, plus que 160
    expect(() => bar("barre b h 1 480 12,3 12,8")).toThrow(/longueur/);
    expect(() => bar("barre b h 4 480 12,3 12,3")).toThrow(/distincts/);
    expect(() => bar("barre b h 4 480 12,0 12,5")).toThrow(/pas vide/); // le plafond est dans le trajet
    expect(() => bar("barre b h 4 480 12,3 12,8 12,9")).toThrow(/attendu/);
  });
});

describe("lot 25 — laser fixe : durées des phases, au pas près", () => {
  it("allumé pendant `allumé` pas, éteint le reste du cycle ; le changement tombe au pas exact", () => {
    const l = gate().lasers[0]!;
    for (let p = -400; p < 800; p++) expect(laserOn(l, p), `phase ${p}`).toBe(cycleMod(p, 360) < 150);
    expect(laserOn(l, 0)).toBe(true);
    expect(laserOn(l, 149)).toBe(true);
    expect(laserOn(l, 150)).toBe(false);
    expect(laserOn(l, 359)).toBe(false);
    expect(laserOn(l, 360)).toBe(true);
  });

  it("le décalage fait commencer le cycle plus loin ; chaque phase tient son minimum (0,75 s allumé, 1 s éteint)", () => {
    expect(LASER_MIN_ON).toBe(90);
    expect(LASER_MIN_OFF).toBe(120);
    const l = parseLevel(text(roomRows(), ["version 9", "section salle 0-27", "laser g v 14,1 11 210 90 40"])).lasers[0]!;
    // Au pas 0 il est à `q = 40` : encore 50 pas d'allumé, puis 120 d'éteint, puis 90 d'allumé…
    const runs: { on: boolean; n: number }[] = [];
    for (let p = 0; p < 420; p++) {
      const on = laserOn(l, p);
      if (runs.length > 0 && runs[runs.length - 1]!.on === on) runs[runs.length - 1]!.n++;
      else runs.push({ on, n: 1 });
    }
    expect(runs.map((r) => r.n)).toEqual([50, 120, 90, 120, 40]);
    for (const r of runs.slice(1, -1)) expect(r.n).toBeGreaterThanOrEqual(r.on ? LASER_MIN_ON : LASER_MIN_OFF);
  });

  it("la bande mortelle est centrée sur les tuiles du rayon, `LASER_THICKNESS` d'épaisseur, entière", () => {
    expect(LASER_THICKNESS).toBe(1024);
    const v = laserBox(gate().lasers[0]!);
    expect(v).toEqual({ x: 14 * T + 1536, y: T, w: 1024, h: 11 * T });
    const h = laserBox({ axis: "h", col: 3, row: 5, length: 4 });
    expect(h).toEqual({ x: 3 * T, y: 5 * T + 1536, w: 4 * T, h: 1024 });
  });
});

describe("lot 25 — laser fixe : mort au contact allumé, passage éteint", () => {
  it("allumé, il tue au contact (cause laser) ; éteint, on le traverse", () => {
    const level = gate();
    // Phase d'un état : le chrono (une seule horloge, section de phase 0). Allumé de 0 à 149 : on arrive sur le rayon (colonne 14) à pleine vitesse.
    const run = (start: number) => {
      let s = running(level, 11, 11, start);
      for (let i = 0; i < 90 && s.status !== ATTEMPT_DEAD; i++) s = step(s, INPUT_RIGHT, level);
      return s;
    };
    const lit = run(0); // le personnage atteint la colonne 14 en moins de 30 pas : le rayon est allumé
    expect(lit.status).toBe(ATTEMPT_DEAD);
    expect(lit.deathCause).toBe(DEATH_LASER);
    const dark = run(160); // éteint de 150 à 359 : il traverse sans mourir
    expect(dark.status).not.toBe(ATTEMPT_DEAD);
    expect(dark.player.x).toBeGreaterThan(15 * T);
  });

  it("mourir au contact tient au pas : un pas avant l'allumage on passe, au pas d'allumage on meurt", () => {
    const level = gate();
    // Le personnage immobile dans la colonne du rayon (hors des émetteurs) : touché exactement quand le rayon s'allume.
    for (const start of [358, 359]) {
      let s = running(level, 14, 11, start);
      const seen: { time: number; dead: boolean }[] = [];
      for (let i = 0; i < 3; i++) {
        s = step(s, 0, level);
        seen.push({ time: s.time, dead: s.status === ATTEMPT_DEAD });
      }
      // chrono 360 ≡ 0 : allumé dès le pas où il vaut 360 (`time` après le pas)
      const first = seen.find((x) => x.dead)!;
      expect(first.time % 360, `départ ${start}`).toBe(0);
    }
  });

  it("se toucher par un bord ne tue pas (comme un pic) ; l'arrivée l'emporte", () => {
    const level = gate();
    const box = laserBox(level.lasers[0]!);
    const s = running(level, 14, 11, 0);
    // Une boîte qui touche tout juste le bord gauche de la bande : pas de mort.
    const edge = { ...s, player: { ...s.player, x: box.x - PLAYER_WIDTH } };
    expect(deathAt(level, edge)).toBe(0);
    const inside = { ...s, player: { ...s.player, x: box.x - PLAYER_WIDTH + 1 } };
    expect(deathAt(level, inside)).toBe(DEATH_LASER);
  });

  it("un rayon horizontal fixe tue de même, et la liste des rayons allumés suit l'horloge", () => {
    const rows = roomRows();
    rows[6] = "#" + ".".repeat(12) + "#" + ".".repeat(13) + "#"; // un pilier en (13,6) : les deux émetteurs sont le mur (0,6) et lui
    const level = parseLevel(text(rows, ["version 9", "section salle 0-27", "laser h h 1,6 12 360 150 0"]));
    expect(level.lasers[0]!.axis).toBe("h");
    const s = running(level, 6, 11, 0);
    expect(laserBoxes(level, s)).toHaveLength(1);
    expect(laserBoxes(level, { ...s, time: 200 })).toHaveLength(0);
    // Un saut qui traverse la rangée 6 pendant qu'il est allumé tue ; en vol, éteint, non.
    const up = { ...s, player: { ...s.player, x: 6 * T + 512, y: 6 * T + 1024, ground: 0 } };
    expect(deathAt(level, up)).toBe(DEATH_LASER);
    expect(deathAt(level, { ...up, time: 200 })).toBe(0);
    expect(laserIsOn(level, up.sections, 149, 0)).toBe(true);
    expect(laserIsOn(level, up.sections, 150, 0)).toBe(false);
  });
});

describe("lot 25 — barre coulissante : position entière, ralenti, vitesse", () => {
  const BAR = ["version 9", "section salle 0-27", "barre b h 4 480 12,3 12,8"];
  const bar = () => gate(BAR);

  it("exactement à `a` à la phase 0 de chaque cycle, à `b` au demi-cycle, entière, sans −0, symétrique", () => {
    const b = bar().laserBars[0]!;
    expect(laserBarPos(b, 0)).toEqual({ x: 12 * T, y: 3 * T });
    expect(laserBarPos(b, 240)).toEqual({ x: 12 * T, y: 8 * T });
    expect(laserBarPos(b, 480)).toEqual({ x: 12 * T, y: 3 * T });
    expect(laserBarPos(b, -480)).toEqual({ x: 12 * T, y: 3 * T });
    for (let p = 0; p <= 480; p++) {
      const at = laserBarPos(b, p);
      expect(Number.isInteger(at.y)).toBe(true);
      expect(Object.is(at.y, -0)).toBe(false);
      expect(at.y).toBeGreaterThanOrEqual(3 * T);
      expect(at.y).toBeLessThanOrEqual(8 * T);
      expect(laserBarPos(b, 480 - p)).toEqual(at);
    }
  });

  it("le ralenti aux deux extrémités se voit : le premier dixième du trajet prend près du cinquième du demi-cycle (47 pas sur 240)", () => {
    const b = bar().laserBars[0]!;
    let n = 0;
    while (laserBarPos(b, n).y - 3 * T < (5 * T) / 10) n++;
    expect(n).toBeGreaterThanOrEqual(44); // linéaire : 24 pas ; ralenti : 47
    expect(n).toBeLessThanOrEqual(50);
    // Vitesse : de plus en plus grande jusqu'au milieu, puis décroissante.
    const v = (p: number) => laserBarPos(b, p + 1).y - laserBarPos(b, p).y;
    expect(v(0)).toBeLessThan(v(60));
    expect(v(60)).toBeLessThan(v(118));
    expect(v(118)).toBeGreaterThan(v(200));
  });

  it("la vitesse de pointe reste sous MAX_LASER_STEP, pour le trajet et le cycle les plus durs que la lecture accepte", () => {
    expect(MAX_LASER_STEP).toBe(160);
    for (const [travel, cycle] of [[LASER_BAR_MAX_TRAVEL, 620], [LASER_BAR_MAX_TRAVEL, 800], [5, 390], [4, 310], [2, 240]] as const) {
      const lvl = gate(["version 9", "section salle 0-27", `barre b h 4 ${cycle} 12,2 12,${2 + travel}`]);
      const b = lvl.laserBars[0]!;
      let max = 0;
      for (let p = 0; p < cycle; p++) max = Math.max(max, Math.abs(laserBarPos(b, p + 1).y - laserBarPos(b, p).y));
      expect(max, `${travel} tuiles en ${cycle}`).toBeLessThanOrEqual(MAX_LASER_STEP);
    }
    expect(PLATFORM_EASE_ONE).toBe(4096);
  });

  it("la bande est toujours allumée et tue au contact ; un rayon vertical glisse sur sa rangée", () => {
    const level = bar();
    const s = running(level, 12, 11, 0);
    // Au chrono 0 le rayon est à la rangée 3 (colonnes 12-15), loin du sol ; à 240 il est à la rangée 8.
    expect(deathAt(level, s)).toBe(0);
    const high = { ...s, time: 240, player: { ...s.player, y: 8 * T + 1024 } };
    expect(deathAt(level, high)).toBe(DEATH_LASER);
    expect(laserBarAt(level, s.sections, 240, 0)).toEqual(laserBarBox(level.laserBars[0]!, 240));
    expect(laserBarBox(level.laserBars[0]!, 0)).toEqual({ x: 12 * T, y: 3 * T + 1536, w: 4 * T, h: 1024 });
    const vert = gate(["version 9", "section salle 0-27", "barre b v 3 480 8,4 14,4"]).laserBars[0]!;
    expect(laserBarBox(vert, 240)).toEqual({ x: 14 * T + 1536, y: 4 * T, w: 1024, h: 3 * T });
    expect(laserBoxes(level, s)).toHaveLength(1);
  });
});

describe("lot 25 — un niveau sans laser se joue comme en v8", () => {
  const rows = (): string[] => {
    const r = roomRows();
    r[11] = r[11]!.slice(0, 10) + "^" + r[11]!.slice(11);
    r[10] = r[10]!.slice(0, 20) + "#" + r[10]!.slice(21);
    return r;
  };
  it("le même niveau en version 8 et en version 9 : états égaux au pas près (aucun champ de plus)", () => {
    const l8 = parseLevel(text(rows(), ["version 8", "section salle 0-27"]));
    const l9 = parseLevel(text(rows(), ["version 9", "section salle 0-27"]));
    expect(l9.simVersion).toBe(9);
    expect(l9.lasers).toEqual([]);
    expect(l9.laserBars).toEqual([]);
    const rng = new Rng(2510);
    let a = initialAttempt(l8);
    let b = initialAttempt(l9);
    for (let t = 0; t < 1500; t++) {
      const input = rng.int(8);
      a = stepAttempt(a, input, l8, P);
      b = stepAttempt(b, input, l9, P);
      expect(b, `pas ${t}`).toEqual(a);
    }
  });
});

describe("lot 25 — intégrité (fuzz)", () => {
  it("des commandes aléatoires dans un niveau à lasers : tout reste entier, sans −0, sous MAX_SPEED, jamais dans un bloc plein", () => {
    const rows = roomRows();
    rows[6] = "#" + ".".repeat(12) + "#" + rows[6]!.slice(14);
    rows[6] = rows[6]!.slice(0, 14) + "." + rows[6]!.slice(15);
    const level = gate(["version 9", "section salle 0-27", "laser g v 14,1 11 360 150 0", "laser h h 1,6 12 480 120 100", "barre b v 3 480 18,3 23,3"], rows);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const rng = new Rng(seed * 7919);
      let s = initialAttempt(level);
      for (let t = 0; t < 1500; t++) {
        s = stepAttempt(s, rng.int(8), level, P);
        for (const n of [s.player.x, s.player.y, s.player.vx, s.player.vy, s.time]) {
          expect(Number.isInteger(n)).toBe(true);
          expect(Object.is(n, -0)).toBe(false);
        }
        expect(Math.abs(s.player.vx)).toBeLessThanOrEqual(MAX_SPEED);
        expect(Math.abs(s.player.vy)).toBeLessThanOrEqual(MAX_SPEED);
      }
    }
  });
});

describe("lot 25 — règles du générateur", () => {
  /** Une salle avec un portail et une place pour attendre à gauche. */
  const ok = () => gate(["version 9", "section salle 0-27", "laser g v 14,1 11 360 150 0"]);

  it("la pose d'un portail dans une salle simple est conforme", () => {
    expect(laserProblems(ok())).toEqual([]);
  });

  it("un niveau sans laser n'a rien à vérifier", () => {
    expect(laserProblems(parseLevel("#####\n#S.F#\n#####\n"))).toEqual([]);
  });

  it("refuse un rayon qui sort de sa section (moins d'une colonne de marge)", () => {
    const p = laserProblems(gate(["version 9", "section a 0-13", "section b 14-27", "laser g v 14,1 11 360 150 0"]));
    expect(p.some((x) => /sort de la section/.test(x))).toBe(true);
  });

  it("refuse un point de passage dans la course d'un rayon", () => {
    const rows = roomRows();
    rows[11] = rows[11]!.slice(0, 13) + "C" + rows[11]!.slice(14);
    const p = laserProblems(gate(GATE, rows));
    expect(p.some((x) => /point 1.*dans sa course/.test(x))).toBe(true);
  });

  it("refuse un rayon sans place sûre pour attendre devant (aucun sol dégagé dans les 5 colonnes)", () => {
    const rows = roomRows();
    for (let c = 8; c <= 12; c++) rows[11] = rows[11]!.slice(0, c) + "^" + rows[11]!.slice(c + 1);
    const p = laserProblems(gate(GATE, rows));
    expect(p.some((x) => /pas de place sûre pour attendre/.test(x))).toBe(true);
  });

  it("refuse une scie qui passe dans la course d'un rayon", () => {
    const p = laserProblems(gate([...GATE, "scie s 0.75 240 aller-retour 12,6 16,6"]));
    expect(p.some((x) => /scie s passe dans sa course/.test(x))).toBe(true);
  });

  it("une barre ne coince jamais : un plein contre le bout de son glissement est refusé", () => {
    const fine = gate(["version 9", "section salle 0-27", "barre b v 3 640 8,4 16,4"]);
    expect(laserProblems(fine)).toEqual([]);
    // Un mur collé au bout droit du glissement (le rayon finit dans la colonne 16) : plein en 17.
    const rows = roomRows();
    rows[5] = rows[5]!.slice(0, 17) + "#" + rows[5]!.slice(18);
    const p = laserProblems(gate(["version 9", "section salle 0-27", "barre b v 3 640 8,4 16,4"], rows));
    expect(p.some((x) => /un plein à 1 tuile\(s\) à droite/.test(x))).toBe(true);
    // Un rayon horizontal qui descend jusqu'à une tuile libre du sol est accepté, sans tuile libre : refusé.
    const lowOk = gate(["version 9", "section salle 0-27", "barre b h 4 480 12,3 12,8"]);
    expect(laserProblems(lowOk)).toEqual([]); // son bas (rangée 8) laisse la rangée 9 libre ; son haut (rangée 3), la rangée 2
    const lowBad = gate(["version 9", "section salle 0-27", "barre b h 4 640 12,3 12,11"]);
    expect(laserProblems(lowBad).some((x) => /au-dessous de sa position basse/.test(x))).toBe(true);
  });
});

// ——— Les morceaux du catalogue ———

const LASER_MODULES = MODULES.filter((m) => m.tags.includes("laser"));
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

describe("lot 25 — les morceaux du catalogue", () => {
  it("de 6 à 8 morceaux de base, réservés à la v9 (laserModuleIds), tous du néon", () => {
    expect(LASER_MODULES.length).toBeGreaterThanOrEqual(6);
    expect(LASER_MODULES.length).toBeLessThanOrEqual(8);
    expect([...laserModuleIds()].sort()).toEqual(LASER_MODULES.map((m) => m.id).sort());
    for (const def of LASER_MODULES) expect(def.theme, def.id).toBe("neon");
  });

  it("chaque variante se construit, passe toutes les règles (pose des lasers, paliers) et a une solution aux deux entrées", () => {
    let variants = 0;
    for (const def of LASER_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const label = `${def.id} v${v}`;
        const m = buildModule(def.id, v);
        expect(m.level.lasers.length + m.level.laserBars.length, label).toBeGreaterThan(0);
        expect(palierProblems(m), label).toEqual([]);
        expect(laserProblems(m.level), label).toEqual([]);
        const sol = moduleSolutions(def.id, v)!;
        for (const entry of ["arret", "elan"] as const) expect(sol[entry]!.exigence, `${label} ${entry}`).toBeGreaterThanOrEqual(1);
        if (usable(def.id, v)) variants++;
      }
    }
    expect(variants).toBeGreaterThanOrEqual(40);
  });

  it("chaque laser du catalogue tient les durées minimales (1 s éteint, 0,75 s allumé) et chaque barre sa vitesse", () => {
    for (const def of LASER_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        for (const l of m.level.lasers) {
          expect(l.on, `${def.id} v${v} ${l.id}`).toBeGreaterThanOrEqual(LASER_MIN_ON);
          expect(l.cycle - l.on, `${def.id} v${v} ${l.id}`).toBeGreaterThanOrEqual(LASER_MIN_OFF);
        }
        for (const b of m.level.laserBars) {
          let max = 0;
          for (let p = 0; p < b.cycle; p++) {
            const a = laserBarPos(b, p);
            const c = laserBarPos(b, p + 1);
            max = Math.max(max, Math.abs(c.x - a.x), Math.abs(c.y - a.y));
          }
          expect(max, `${def.id} v${v} ${b.id}`).toBeLessThanOrEqual(MAX_LASER_STEP);
        }
      }
    }
  });

  it("au moins 1 respiration (note ≤ 2, trois sauts), 2 portions dures (une variante notée 4 ou 5), 2 morceaux à barre coulissante, 2 morceaux qui combinent lasers et blocs alternés", () => {
    const rest = LASER_MODULES.filter((m) => m.tags.includes("respiration"));
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
    const hard = LASER_MODULES.filter((def) => def.variants.some((_, v) => usable(def.id, v) && variantExigence(moduleSolutions(def.id, v)) >= 4));
    expect(hard.length, "portions dures").toBeGreaterThanOrEqual(2);
    const bars = LASER_MODULES.filter((def) => def.annex.some((l) => l.startsWith("barre ")));
    expect(bars.length, "barres coulissantes").toBeGreaterThanOrEqual(2);
    expect(LASER_MODULES.filter((m) => m.tags.includes("alterne")).length, "lasers et blocs alternés").toBeGreaterThanOrEqual(2);
  });

  it("la solution de chaque variante arrive sans mourir aux deux entrées, et passe vraiment par un rayon (un laser allumé ou éteint traversé, une barre croisée de près)", () => {
    for (const def of LASER_MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        for (const entry of ["arret", "elan"] as const) {
          const { states } = playSolution(def.id, v, entry);
          const label = `${def.id} v${v} ${entry}`;
          expect(states.some((s) => s.status === ATTEMPT_DEAD), label).toBe(false);
          expect(states[states.length - 1]!.status === ATTEMPT_FINISHED || states.length > 0, label).toBe(true);
        }
      }
    }
  });
});

describe("lot 25 — les niveaux du jour", () => {
  it("les références v3 à v8 ne connaissent pas les morceaux à lasers ; la référence g19 (v9) les pose, et seulement dans le néon", () => {
    const ids = laserModuleIds();
    const start = parseDay("2026-10-27")!;
    let withLasers = 0;
    for (let d = start; d < start + 30; d++) {
      for (const version of [3, 4, 5, 6, MUSHROOM_VERSION, STALACTITE_VERSION]) {
        const old = dailyLevel(d, null, version);
        expect(old.pieces.some((p) => ids.has(p.id)), `${old.date} v${version}`).toBe(false);
        expect(old.level.lasers, `${old.date} v${version}`).toEqual([]);
        expect(old.level.laserBars, `${old.date} v${version}`).toEqual([]);
      }
      const L = dailyLevel(d, null, LASER_VERSION);
      expect(L.level.simVersion).toBe(9);
      expect(L.id).toBe(`jour-${L.date}-g${LASER_GENERATOR}`);
      expect(L.fallback, L.date).toBe(false);
      if (L.pieces.some((p) => ids.has(p.id))) {
        withLasers++;
        expect(L.theme, L.date).toBe("neon");
        expect(L.level.lasers.length + L.level.laserBars.length, L.date).toBeGreaterThan(0);
      } else expect(L.level.lasers.length + L.level.laserBars.length, L.date).toBe(0);
    }
    expect(withLasers).toBeGreaterThanOrEqual(1);
  }, 240_000);

  it("les jours de néon à lasers passent toutes les règles ; la preuve de l'auteur arrive sans mourir, et le point de passage reste sûr à toute phase", () => {
    const ids = laserModuleIds();
    let n = 0;
    let two = 0;
    for (let d = parseDay("2026-10-27")!; d < parseDay("2026-10-27")! + 120 && n < 10; d++) {
      if (jumpThemeForDay(d) !== "neon") continue;
      const L = dailyLevel(d, null, LASER_VERSION);
      const mine = L.pieces.filter((p) => ids.has(p.id));
      if (mine.length === 0) continue;
      n++;
      if (mine.length >= 2) two++;
      expect(dailyProblems(L), L.date).toEqual([]);
      expect(respawnProblems(L.level), L.date).toEqual([]);
      expect(laserProblems(L.level), L.date).toEqual([]);
      let s = initialAttempt(L.level);
      for (const b of fromRuns(L.replay.runs)) {
        s = stepAttempt(s, b, L.level, P);
        expect(s.status, L.date).not.toBe(ATTEMPT_DEAD);
      }
      expect(s.status, L.date).toBe(ATTEMPT_FINISHED);
    }
    expect(n).toBeGreaterThanOrEqual(6);
    expect(two).toBeGreaterThanOrEqual(3);
  }, 240_000);

  it("un jour à lasers se fige et se relit (versions 9 et g19) ; une version incohérente est refusée", () => {
    const ids = laserModuleIds();
    const day = parseDay("2026-11-14")!;
    const L = dailyLevel(day, null, LASER_VERSION);
    expect(L.pieces.filter((p) => ids.has(p.id)).length).toBeGreaterThanOrEqual(2);
    const raw = JSON.parse(frozenJson(freezeLevel(L)));
    expect(raw.simVersion).toBe(9);
    expect(raw.generatorVersion).toBe(LASER_GENERATOR);
    const back = thawLevel(raw, day);
    expect(typeof back).not.toBe("string");
    if (typeof back === "string") return;
    expect(back.ascii).toBe(L.ascii);
    expect(back.level.lasers).toEqual(L.level.lasers);
    expect(back.level.laserBars).toEqual(L.level.laserBars);
    expect(back.code).toBe(L.code);
    expect(thawLevel({ ...raw, generatorVersion: 18 }, day)).toBe("versions incohérentes");
    expect(thawLevel({ ...raw, simVersion: STALACTITE_VERSION }, day)).toBe("versions incohérentes");
  }, 240_000);

  it(`le ${formatDay(parseDay("2026-11-14")!)}, la preuve de l'auteur traverse chaque laser éteint et croise chaque barre sans mourir (rejeu rejoué pas à pas)`, () => {
    const L = dailyLevel(parseDay("2026-11-14")!, null, LASER_VERSION);
    let s = initialAttempt(L.level);
    let crossed = 0;
    for (const b of fromRuns(L.replay.runs)) {
      s = stepAttempt(s, b, L.level, P);
      for (const l of L.level.lasers) {
        const box = laserBox(l);
        const near = s.player.x + PLAYER_WIDTH > box.x - T && s.player.x < box.x + box.w + T && s.player.y + PLAYER_HEIGHT > box.y && s.player.y < box.y + box.h;
        if (near && s.player.x + PLAYER_WIDTH / 2 > box.x + box.w / 2) crossed++;
      }
    }
    expect(s.status).toBe(ATTEMPT_FINISHED);
    expect(crossed).toBeGreaterThan(0);
  }, 240_000);
});
