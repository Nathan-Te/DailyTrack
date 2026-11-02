import "./legacy";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  CHECKPOINT_ZONE_GENERATOR,
  CHECKPOINT_ZONE_VERSION,
  DEFAULT_JUMP_PARAMS,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  MIN_HOLD_VERSION,
  PALIER_HEADROOM_ROWS,
  PASSAGE_ZONE_COLS,
  PASSAGE_ZONE_ROWS,
  PALIER_LENGTH,
  PLAYER_HEIGHT,
  PREMIER_JOUR_JUMP,
  UNITS_PER_TILE,
  assemble,
  centerCol,
  checkpointShortcutProblems,
  dailyLevel,
  initialAttempt,
  parseLevel,
  passageAccess,
  passageZoneAt,
  reassemble,
  stepAttempt,
  thawLevel,
  type AttemptState,
  type Level,
} from "../src/index";
import { beamSolve } from "../tools/beam";
import { PRESS_MIN, RELEASE_MIN } from "../src/index";
import { cageEntranceCells, leftJointCells } from "../src/passages";

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;

// Lot 32 — **un point de passage ne se valide que sur son palier** (version 14 de la simulation) et **aucun raccourci par point de passage** (règle du générateur g26).

/**
 * Une salle de 16 colonnes sur 14 rangées : un sol (rangée 12) avec le point de passage au milieu (colonne 9, rangée 11), et, rangée 4, une corniche haute d'où l'on part. `shelfTo` : jusqu'à quelle
 * colonne elle va (14 : elle recouvre le point de passage, on passe au-dessus ; 8 : elle s'arrête avant, on tombe dans le puits).
 */
function room(version: number, shelfTo: number, start: "corniche" | "sol" = "corniche"): Level {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) {
    let line = "#" + ".".repeat(14) + "#";
    if (r === 0 || r === 12 || r === 13) line = "#".repeat(16);
    if (r === 4) line = "#" + "#".repeat(shelfTo) + ".".repeat(14 - shelfTo) + "#";
    rows.push(line);
  }
  const put = (r: number, c: number, ch: string) => (rows[r] = rows[r]!.slice(0, c) + ch + rows[r]!.slice(c + 1));
  if (start === "corniche") put(3, 1, "S");
  else put(11, 2, "S");
  put(11, 9, "C");
  put(11, 14, "F");
  return parseLevel(rows.join("\n") + `\n\nversion ${version}\nmaintien 0\n`);
}

/** Joue des commandes depuis le départ et rend, pas à pas, le point de passage pris et la colonne du centre. */
function trace(level: Level, plan: (s: AttemptState, t: number) => number, steps: number): { checkpoint: number; col: number; feetRows: number }[] {
  let s = initialAttempt(level);
  const out: { checkpoint: number; col: number; feetRows: number }[] = [];
  for (let t = 0; t < steps; t++) {
    s = stepAttempt(s, plan(s, t), level, P);
    out.push({ checkpoint: s.checkpoint, col: centerCol(s.player), feetRows: (s.player.y + PLAYER_HEIGHT) / T });
    if (s.status === ATTEMPT_DEAD) break;
  }
  return out;
}

describe("lot 32 — versions", () => {
  it("la simulation passe à 14, le générateur à 26 ; la zone d'un point est le palier standard", () => {
    expect(JUMP_SIM_VERSION).toBe(CHECKPOINT_ZONE_VERSION);
    expect(CHECKPOINT_ZONE_VERSION).toBe(MIN_HOLD_VERSION + 1);
    expect(JUMP_GENERATOR_VERSION).toBe(CHECKPOINT_ZONE_GENERATOR);
    expect(PASSAGE_ZONE_COLS).toBe(PALIER_LENGTH);
    expect(PASSAGE_ZONE_ROWS).toBe(3);
    // Un palier de raccord est fermé au-dessus de lui assez haut pour un saut complet (4,1 tuiles, tête comprise 4,9).
    expect(PALIER_HEADROOM_ROWS).toBeGreaterThanOrEqual(5);
  });
});

describe("lot 32 — la zone du point de passage (version 14)", () => {
  // Le point est en (9, 11), son sol est la rangée 12 : la zone, ce sont les colonnes 9 et 10, les pieds entre la rangée 9 (3 rangées au-dessus du sol) et la rangée 12.
  const level = room(14, 8);
  const at = (col: number, feetRow: number) => passageZoneAt(level, { x: col * T + (T - 3072) / 2, y: feetRow * T - PLAYER_HEIGHT });

  it("posé sur le palier : dans la zone ; jusqu'à 3 rangées au-dessus du sol : dans la zone ; 4 rangées au-dessus : hors de la zone", () => {
    expect(at(9, 12)).toBe(0);
    expect(at(10, 12)).toBe(0);
    expect(at(9, 9)).toBe(0); // exactement 3 rangées au-dessus du sol
    expect(at(9, 9 - 1 / T)).toBe(-1); // un cran de plus
    expect(at(9, 8)).toBe(-1); // 4 rangées au-dessus
    expect(at(9, 4)).toBe(-1); // sur la corniche
  });

  it("les colonnes : celle du fanion et la suivante seulement", () => {
    expect(at(8, 12)).toBe(-1);
    expect(at(11, 12)).toBe(-1);
  });
});

describe("lot 32 — franchir un point de passage par le haut", () => {
  const horizontally = (s: AttemptState) => (centerCol(s.player) < 13 ? INPUT_RIGHT : 0);

  it("version 13 : courir au-dessus du point, sur la corniche, le prend (le raccourci du Jump n° 18)", () => {
    const steps = trace(room(13, 14), horizontally, 220);
    expect(steps.some((s) => s.col >= 9 && s.checkpoint === 0)).toBe(true);
    expect(steps.find((s) => s.col >= 9)!.feetRows).toBeLessThan(5); // sur la corniche (rangée 4), 8 rangées au-dessus du sol
  });

  it("version 14 : traversé 8 rangées au-dessus de son sol, le point ne se valide pas, jusqu'au bout de la corniche", () => {
    const steps = trace(room(14, 14), horizontally, 220);
    expect(steps.some((s) => s.col >= 12)).toBe(true);
    expect(steps.every((s) => s.checkpoint === -1)).toBe(true);
  });

  it("version 14 : en tombant du haut du puits, le point se valide à la pose dans la zone, pas avant", () => {
    // Droite jusqu'à la colonne 9 (le bord de la corniche est en 8), puis on retient (gauche) pour tomber droit dans le puits.
    let past = -1;
    const steps = trace(room(14, 8), (s, t) => {
      if (past < 0 && centerCol(s.player) >= 9) past = t;
      return past < 0 ? INPUT_RIGHT : s.player.vx > 30 ? INPUT_LEFT : 0;
    }, 700);
    const first = steps.findIndex((s) => s.checkpoint === 0);
    expect(first, "le point finit par se valider").toBeGreaterThan(0);
    // Pas avant d'être à moins de 3 rangées du sol.
    expect(steps[first]!.feetRows).toBeGreaterThanOrEqual(9);
    expect(steps[first - 1]!.feetRows).toBeLessThan(steps[first]!.feetRows);
    expect(steps.slice(0, first).every((s) => s.checkpoint === -1)).toBe(true);
    // La même chute en version 13 le prend en passant la colonne, tout en haut.
    let past13 = -1;
    const old = trace(room(13, 8), (s, t) => {
      if (past13 < 0 && centerCol(s.player) >= 9) past13 = t;
      return past13 < 0 ? INPUT_RIGHT : s.player.vx > 30 ? INPUT_LEFT : 0;
    }, 700);
    const first13 = old.findIndex((s) => s.checkpoint === 0);
    expect(old[first13]!.feetRows).toBeLessThan(7);
  });

  it("version 14 : courir sur le sol à travers le palier le valide, comme avant", () => {
    const steps = trace(room(14, 14, "sol"), (s) => (centerCol(s.player) < 13 ? INPUT_RIGHT : 0), 260);
    const taken = steps.findIndex((s) => s.checkpoint === 0);
    expect(taken).toBeGreaterThan(0);
    expect(steps[taken]!.col).toBe(9);
  });
});

describe("lot 32 — les blocs alternés ne sont plus remis à A en prenant un point de passage", () => {
  /** Une salle avec un bloc A et un bloc B (en hauteur, hors du chemin) et un point de passage au sol, colonne 9. */
  const withAlts = (version: number): Level => {
    const rows: string[] = [];
    for (let r = 0; r < 14; r++) rows.push(r === 0 || r >= 12 ? "#".repeat(16) : "#" + ".".repeat(14) + "#");
    const put = (r: number, c: number, ch: string) => (rows[r] = rows[r]!.slice(0, c) + ch + rows[r]!.slice(c + 1));
    put(11, 2, "S");
    put(11, 9, "C");
    put(11, 14, "F");
    put(3, 3, "A");
    put(3, 5, "B");
    return parseLevel(rows.join("\n") + `\n\nversion ${version}\nmaintien 0\n`);
  };
  /** Un saut sur place à gauche du point (la parité passe à B), puis la course jusqu'après le point. */
  const parityAfter = (version: number): { before: number; after: number; checkpoint: number } => {
    const level = withAlts(version);
    let s = initialAttempt(level);
    let jumped = 0;
    for (let t = 0; t < 40; t++) s = stepAttempt(s, t < 20 ? 4 : 0, level, P); // saut tenu sur place, puis posé
    const before = s.alt ?? 0;
    jumped = 1;
    for (let t = 0; t < 300 && jumped; t++) {
      s = stepAttempt(s, INPUT_RIGHT, level, P);
      if (centerCol(s.player) >= 11) break;
    }
    return { before, after: s.alt ?? 0, checkpoint: s.checkpoint };
  };

  it("version 13 : franchir le point remet A ; version 14 : la parité reste B", () => {
    const old = parityAfter(13);
    expect(old.before).toBe(1);
    expect(old.checkpoint).toBe(0);
    expect(old.after).toBe(0);
    const now = parityAfter(14);
    expect(now.before).toBe(1);
    expect(now.checkpoint).toBe(0);
    expect(now.after).toBe(1);
  });
});

describe("lot 32 — aucun raccourci par point de passage : le niveau du Jump n° 18", () => {
  // Le 02/11/2026, g21 : le premier morceau est `chute-pics:4`. Un couloir de quatre rangées libres court au-dessus du morceau jusqu'au puits du palier d'arrivée (ouvert jusqu'en haut) : on saute le puits
  // à pics au départ, on court sur le haut du mur, on franchit la colonne du point 1/10 à 23 rangées de son sol, puis on reprend au point.
  const frozen = () => {
    const d = thawLevel(JSON.parse(readFileSync(join(import.meta.dirname, "../../../apps/jump/public/levels/2026-11-02.json"), "utf8")), parseDay("2026-11-02")!);
    if (typeof d === "string") throw new Error(d);
    return d;
  };

  it("la propagation le voit : le point 1 est relié au départ sans la portion (ni sa voie lente) dans le niveau figé du n° 18", () => {
    const d = frozen();
    const asm = reassemble(d);
    const access = passageAccess({ level: d.level, paliers: d.paliers, slow: asm.slow });
    expect(access.find((a) => a.index === 1)!.open).toBe(true);
    expect(checkpointShortcutProblems({ level: d.level, paliers: d.paliers, slow: asm.slow }).join(" ; ")).toContain("point de passage 1");
  });

  it("le solveur (appuis humains) trouve le chemin : le point 1 se rejoint par le haut, le côté gauche du palier et la cage fermés", () => {
    const d = frozen();
    const zone = d.paliers[1]!;
    const tiles = [...d.level.tiles];
    for (const c of leftJointCells(zone)) tiles[c.row * d.level.width + c.col] = 1;
    const level = { ...d.level, tiles, finish: { col: zone.col0, row: zone.row - 1 } };
    const inputs = beamSolve(level, { start: initialAttempt(d.level), goal: (s) => passageZoneAt(d.level, s.player) === 0, beam: 400, chunk: 4, maxTicks: 700, pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
    expect(inputs).not.toBeNull();
    expect(cageEntranceCells({ zone: 0, entryRow: 10 }).length).toBe(3);
  }, 120_000);

  it("le même motif, assemblé par le générateur courant : le puits du palier est fermé, plus aucun chemin", () => {
    // Le morceau d'un puits profond (`chute-pics`), suivi d'un morceau ordinaire : version 13 (puits ouverts jusqu'en haut) puis version 14 (fermés à `PALIER_HEADROOM_ROWS` rangées).
    const picks = [
      { id: "chute-pics", variant: 4 },
      { id: "mur-seul", variant: 0 },
      { id: "saut-long", variant: 0 },
    ];
    const before = assemble(picks, { slow: true, simVersion: MIN_HOLD_VERSION });
    const after = assemble(picks, { slow: true, simVersion: CHECKPOINT_ZONE_VERSION });
    expect(checkpointShortcutProblems(before).length, "version 13 : le raccourci existe").toBeGreaterThan(0);
    expect(checkpointShortcutProblems(after), "version 14 : fermé").toEqual([]);
    // Le palier du point 1 : fermé à 6 rangées au-dessus du sol, plein au-dessus.
    const p = after.paliers[1]!;
    const rows = after.ascii.split("\n");
    for (let c = p.col0; c <= p.col1; c++) {
      expect(rows[p.row - PALIER_HEADROOM_ROWS]![c], `libre au ras du plafond en ${c}`).toBe(".");
      expect(rows[p.row - PALIER_HEADROOM_ROWS - 1]![c], `plein au-dessus de ${c}`).toBe("#");
    }
  });
});

describe("lot 32 — le générateur g26 : 120 dates sans raccourci", () => {
  const DAYS: number[] = Array.from({ length: 120 }, (_, k) => PREMIER_JOUR_JUMP + k);

  it("aucun point de passage relié à celui d'avant sans la portion ni sa voie lente ; aucun niveau de secours ; la version 14", () => {
    let points = 0;
    for (const day of DAYS) {
      const L = dailyLevel(day);
      expect(L.level.simVersion, L.date).toBe(CHECKPOINT_ZONE_VERSION);
      expect(L.id, L.date).toBe(`jour-${L.date}-g${JUMP_GENERATOR_VERSION}`);
      expect(L.fallback, L.date).toBe(false);
      const asm = reassemble(L);
      expect(asm.slow.every((r) => r.sealed), `${L.date} descente scellée`).toBe(true);
      const access = passageAccess({ level: L.level, paliers: L.paliers, slow: asm.slow });
      points += access.length;
      expect(access.filter((a) => a.open).map((a) => a.index), L.date).toEqual([]);
    }
    expect(points).toBeGreaterThan(900);
  }, 1_200_000);
});
