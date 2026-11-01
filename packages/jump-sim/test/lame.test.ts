import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  BLADE_ROOM_TILES,
  MODULES,
  PARASITE_CLOSED,
  PHASE_HARD,
  PHASE_REFUSED,
  SLOW_MIN_EXIGENCE,
  UNITS_PER_TILE,
  bladeEnvelopes,
  bladeRoomProblems,
  bladeTooTight,
  buildModule,
  dailyLevel,
  dailyProblems,
  parseLevel,
  variantExigence,
  variantUsable,
  moduleSolutions,
  type Level,
} from "../src/index";
import { readFileSync } from "node:fs";
import { lameTablePath, lameTableSource } from "../tools/lame";
import { PHASES_PER_PERIOD, phaseOk, readPhases } from "../tools/phasesFile";

// Lot 31 — la place autour de la lame (`lame.ts`, générateur g25) et la portion dure selon la pire phase (`PHASE_HARD`).

/** Une cheminée de `width` colonnes (de la colonne 2 à 2 + width − 1), un sol dessous (ou une fosse si `floor` est faux), une scie sur un rail vertical à la colonne `rail`. */
function chimney(width: number, rail: number, floor = true): Level {
  const rows: string[] = [];
  const inner = ".".repeat(width);
  const wall = "##";
  for (let r = 0; r < 12; r++) rows.push(wall + inner + wall);
  rows[10] = rows[10]!.slice(0, 2) + (floor ? "#".repeat(width) : ".".repeat(width)) + wall;
  rows[11] = floor ? "#".repeat(width + 4) : rows[11]!;
  rows[9] = "#S" + ".".repeat(width - 1) + "F" + wall + "";
  return parseLevel([...rows, "", `section c 0-${width + 3}`, `scie s o 600 aller-retour ${rail},2 ${rail},8`].join("\n"));
}

describe("lot 31 — la règle de la place autour de la lame", () => {
  it("la cheminée de trois colonnes avec la scie au milieu (le morceau signalé) est refusée : 1,06 tuile de chaque côté", () => {
    const L = chimney(3, 3);
    expect(bladeEnvelopes(L)).toHaveLength(1);
    const problems = bladeRoomProblems(L);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("1.06");
  });

  it("une cheminée de quatre colonnes à rail central laisse 1,06 d'un côté et 2,06 de l'autre : permise ; trois colonnes, rail collé à une paroi : permise (2,06)", () => {
    expect(bladeRoomProblems(chimney(4, 3))).toEqual([]);
    expect(bladeRoomProblems(chimney(3, 2))).toEqual([]);
    expect(bladeRoomProblems(chimney(3, 4))).toEqual([]);
  });

  it("une cheminée de cinq colonnes à rail central est permise ; quatre colonnes avec le rail à 1,5 tuile de chaque paroi serait refusée", () => {
    expect(bladeRoomProblems(chimney(5, 4))).toEqual([]);
    // Quatre colonnes, rail à la colonne 3 : 1,06 à gauche, 2,06 à droite (permis) ; une scie plus grosse (rayon 1) à la même place : 0,5 et 1,5 : refusée.
    const big = parseLevel(["##....##", "##....##", "##....##", "##....##", "#S...F##", "########", "", "section c 0-7", "scie s 1 600 aller-retour 3,0 3,3"].join("\n"));
    expect(bladeRoomProblems(big)).toHaveLength(1);
  });

  it("la place exigée est de deux tuiles", () => {
    expect(BLADE_ROOM_TILES).toBe(2);
  });

  it("n'est pas un couloir : une fosse (aucun sol), l'air libre, une porte qui barre un puits d'une paroi à l'autre", () => {
    // Fosse : la même cheminée sans sol, la scie la traverse d'un bord à l'autre (comme `ascenseur`) — on n'y entre pas.
    expect(bladeRoomProblems(chimney(3, 3, false))).toEqual([]);
    // Air libre : aucune paroi.
    const open = parseLevel([".......", ".......", ".......", "#S...F#", "#######", "", "section c 0-6", "scie s o 600 aller-retour 3,0 3,2"].join("\n"));
    expect(bladeRoomProblems(open)).toEqual([]);
    // Porte : la scie va d'une paroi à l'autre (rail horizontal) dans un puits ouvert en haut (`ressort-scie`, `traverse`).
    const gate = parseLevel(["#...#", "#...#", "#...#", "#...#", "#S.F#", "#####", "", "section c 0-4", "scie s o 600 aller-retour 1,2 3,2"].join("\n"));
    expect(bladeRoomProblems(gate)).toEqual([]);
  });

  it("le morceau signalé : cheminee-scie v1, v2 et v3 (la scie au milieu) sont refusées ; les remplaçantes v5 à v9 (rail collé à une paroi) tiennent la règle", () => {
    const tight = bladeTooTight()["cheminee-scie"] ?? [];
    for (const v of [0, 1, 2, 3, 4]) expect(tight, `v${v}`).toContain(v);
    for (const v of [5, 6, 7, 8, 9]) {
      expect(tight, `v${v}`).not.toContain(v);
      expect(bladeRoomProblems(buildModule("cheminee-scie", v).level), `v${v}`).toEqual([]);
    }
  });

  it("`src/lameTable.ts` est celui que l'outil écrirait d'après les textes des morceaux (sinon : `npm run lame:modules -- --ecrire`), et `bladeTooTight` le rend", () => {
    expect(readFileSync(lameTablePath(), "utf8")).toBe(lameTableSource());
    const all: Record<string, number[]> = {};
    for (const def of MODULES) for (let v = 0; v < def.variants.length; v++) if (bladeRoomProblems(buildModule(def.id, v).level).length > 0) (all[def.id] ??= []).push(v);
    expect(bladeTooTight()).toEqual(all); // aucune variante à scie n'échappe au raccourci des étiquettes
  });

  it("chaque remplaçante passe toutes les règles : solutions aux deux entrées, toutes phases (attente ≤ 12 s), voies parasites, note de 1 à 5", () => {
    const phases = readPhases();
    for (const v of [5, 6, 7, 8, 9]) {
      const where = `cheminee-scie v${v}`;
      expect(variantUsable("cheminee-scie", v), `${where} utilisable`).toBe(true);
      expect(PHASE_REFUSED["cheminee-scie"]?.includes(v) ?? false, `${where} refusée toutes phases`).toBe(false);
      expect(PARASITE_CLOSED["cheminee-scie"]?.includes(v) ?? false, `${where} voie parasite`).toBe(false);
      const exigence = variantExigence(moduleSolutions("cheminee-scie", v));
      expect(exigence, where).toBeGreaterThanOrEqual(1);
      const entry = phases?.modules["cheminee-scie"]?.variants[v];
      expect(entry, `${where} : phases`).toBeTruthy();
      expect(entry!.phases.length, where).toBeGreaterThanOrEqual(Math.min(PHASES_PER_PERIOD, entry!.period));
      expect(entry!.phases.every(phaseOk), `${where} : chaque phase jouable, attente ≤ 12 s`).toBe(true);
    }
  });

  it("aucun jour g25 ne pose une scie trop proche d'une paroi (365 dates) ; le catalogue du jour ne contient plus les variantes refusées", () => {
    const first = daysFromCivil(2026, 11, 2);
    for (let k = 0; k < 365; k += 5) {
      const L = dailyLevel(first + k);
      expect(dailyProblems(L), L.date).toEqual([]);
      for (const p of L.pieces) expect(bladeTooTight()[p.id]?.includes(p.variant) ?? false, `${L.date} ${p.id} v${p.variant}`).toBe(false);
      expect(bladeRoomProblems(L.level), L.date).toEqual([]);
    }
  }, 120_000);

  it("la tuile est de 4 096 unités (le 1,06 du rapport est 4 352 / 4 096)", () => {
    expect(UNITS_PER_TILE).toBe(4096);
  });
});

describe("lot 31 — portion dure selon la pire phase", () => {
  const phases = readPhases();

  it("`PHASE_HARD` est celle des phases gardées : une variante y est si l'une de ses phases est notée 4 ou 5", () => {
    expect(phases).toBeTruthy();
    const expected: Record<string, number[]> = {};
    for (const [id, m] of Object.entries(phases!.modules)) {
      m.variants.forEach((v, k) => {
        if (v && v.ok && v.phases.some((p) => p.exigence >= SLOW_MIN_EXIGENCE)) (expected[id] ??= []).push(k);
      });
    }
    expect(PHASE_HARD).toEqual(expected);
  });

  it("des variantes sont dures à une phase sans l'être sur leur course de référence (elles reçoivent maintenant une voie lente)", () => {
    const newlyHard = Object.entries(PHASE_HARD).flatMap(([id, list]) => list.filter((v) => variantUsable(id, v) && variantExigence(moduleSolutions(id, v)) < SLOW_MIN_EXIGENCE).map((v) => ({ id, v })));
    expect(newlyHard.length).toBeGreaterThan(10);
  });

  it("une variante notée 5 à une seule phase reçoit une voie lente dans un niveau du jour", () => {
    // Une variante dont la course de référence est notée moins de 4 mais dont une phase est notée 4 ou 5, posée ailleurs qu'en premier.
    const first = daysFromCivil(2026, 11, 2);
    let seen = 0;
    for (let k = 0; k < 120 && seen < 3; k++) {
      const L = dailyLevel(first + k);
      L.pieces.forEach((p, i) => {
        if (i === 0 || p.exigence >= SLOW_MIN_EXIGENCE || !PHASE_HARD[p.id]?.includes(p.variant)) return;
        seen++;
        expect(L.slowRoutes.filter((r) => r.piece === i), `${L.date} ${p.id} v${p.variant}`).toHaveLength(1);
      });
    }
    expect(seen).toBeGreaterThan(0);
  }, 120_000);
});
