import { formatDay, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_TICKS,
  AUTHOR_MIN_TICKS,
  EXIGENCE_PEAK,
  EXIGENCE_RATE_MAX,
  EXIGENCE_RATE_MIN,
  FALLBACK_PIECES,
  JUMP_GENERATOR_VERSION,
  LEVEL_ID_PATTERN,
  MAX_DAILY_HEIGHT,
  MAX_PIECES,
  MAX_PRECISION_RUN,
  MEDAL_PERCENT,
  MIN_PIECES,
  MODULES,
  PALIER_MIN,
  PREMIER_JOUR_JUMP,
  RESPIRATION_FROM,
  RESPIRATION_TO,
  REST_GROUPS,
  TILE_SOLID,
  UNITS_PER_TILE,
  PLAYER_WIDTH,
  DEFAULT_JUMP_PARAMS,
  assemble,
  dailyLevel,
  dailyLevelId,
  dailyProblems,
  decodeReplay,
  encodeReplay,
  exigenceOfPieces,
  fallbackLevel,
  isRestedModule,
  jumpMedalFor,
  jumpMedalsFor,
  levelNumber,
  replayAttempt,
  restGroup,
  fromRuns,
  initialAttempt,
  stepAttempt,
  type DailyLevel,
} from "../src/index";

// Le niveau du jour (lot 5) sur 60 dates fixes à partir du premier jour (jamais « aujourd'hui » : les tests ne lisent pas l'heure).

const DATES = Array.from({ length: 60 }, (_, k) => PREMIER_JOUR_JUMP + k);
const levels: DailyLevel[] = DATES.map((d) => dailyLevel(d));
const T = UNITS_PER_TILE;

describe("niveau du jour : identité et pureté", () => {
  it("le premier jour est le 16/10/2026, niveau n° 1", () => {
    expect(formatDay(PREMIER_JOUR_JUMP)).toBe("2026-10-16");
    expect(levelNumber(PREMIER_JOUR_JUMP)).toBe(1);
    expect(levelNumber(parseDay("2026-11-15")!)).toBe(31);
    expect(levelNumber(PREMIER_JOUR_JUMP - 1)).toBe(0);
  });

  it("identifiant jour-AAAA-MM-JJ-g<N>, accepté par les rediffusions", () => {
    for (const L of levels) {
      expect(L.id).toBe(`jour-${L.date}-g${JUMP_GENERATOR_VERSION}`);
      expect(L.id).toMatch(/^jour-\d{4}-\d{2}-\d{2}-g\d+$/);
      expect(L.id).toMatch(LEVEL_ID_PATTERN);
      expect(L.replay.levelId).toBe(L.id);
      expect(L.number).toBe(levelNumber(L.day));
    }
    expect(dailyLevelId(parseDay("2026-12-25")!)).toBe(`jour-2026-12-25-g${JUMP_GENERATOR_VERSION}`);
  });

  it("déterministe : la même date donne le même niveau (même texte, même preuve), sans dépendre de l'ordre des appels", () => {
    // Le cache rend le même objet ; on recompose aussi à travers un autre ordre de dates (aucun état caché entre deux dates).
    expect(dailyLevel(DATES[3]!)).toBe(levels[3]);
    const fresh = assemble(levels[7]!.pieces.map((p) => ({ id: p.id, variant: p.variant })));
    expect(fresh.ascii).toBe(levels[7]!.ascii);
  });

  it("trois dates voisines donnent trois niveaux différents", () => {
    const hashes = new Set(levels.map((L) => L.hash));
    expect(hashes.size).toBe(levels.length);
  });

  it("le secours n'est jamais utilisé, et le tirage retenu est l'un des premiers", () => {
    for (const L of levels) {
      expect(L.fallback, L.date).toBe(false);
      expect(L.chosen).toBeGreaterThanOrEqual(0);
      expect(L.attempts[L.chosen]!.status).toBe("valide");
    }
  });
});

describe("niveau du jour : la preuve par rejeu", () => {
  it("la rediffusion de l'auteur, rejouée, arrive sans mourir ; son temps est le temps de l'auteur, dans [25 ; 40] s", () => {
    for (const L of levels) {
      const r = replayAttempt(L.level, decodeReplay(L.code), L.id);
      expect(r.finished, L.date).toBe(true);
      expect(r.deaths).toHaveLength(0);
      expect(r.time).toBe(L.authorTicks);
      expect(L.authorTicks).toBeGreaterThanOrEqual(AUTHOR_MIN_TICKS);
      expect(L.authorTicks).toBeLessThanOrEqual(AUTHOR_MAX_TICKS);
      expect(encodeReplay(L.replay)).toBe(L.code);
    }
  });

  it("chaque morceau commence là où sa solution démarre, l'un après l'autre jusqu'à l'arrivée", () => {
    for (const L of levels) {
      expect(L.pieces[0]!.start).toBe(0);
      L.pieces.forEach((p, k) => {
        expect(p.end).toBeGreaterThan(p.start);
        if (k > 0) expect(p.start).toBe(L.pieces[k - 1]!.end);
      });
      expect(L.pieces[L.pieces.length - 1]!.end).toBe(L.authorTicks);
    }
  });

  it("toutes les règles du niveau du jour tiennent (dailyProblems vide)", () => {
    for (const L of levels) expect(dailyProblems(L), L.date).toEqual([]);
  });
});

describe("niveau du jour : quotas et budget", () => {
  it("de 6 à 10 morceaux, jamais deux fois le même", () => {
    for (const L of levels) {
      expect(L.pieces.length).toBeGreaterThanOrEqual(MIN_PIECES);
      expect(L.pieces.length).toBeLessThanOrEqual(MAX_PIECES);
      expect(new Set(L.pieces.map((p) => p.id)).size).toBe(L.pieces.length);
    }
  });

  it("au moins un mural, au moins une scie, jamais plus de deux « précision » d'affilée", () => {
    for (const L of levels) {
      expect(L.pieces.some((p) => p.tags.includes("mural")), L.date).toBe(true);
      expect(L.pieces.some((p) => p.tags.includes("scie")), L.date).toBe(true);
      let run = 0;
      for (const p of L.pieces) {
        run = p.tags.includes("precision") ? run + 1 : 0;
        expect(run).toBeLessThanOrEqual(MAX_PRECISION_RUN);
      }
    }
  });

  it("un seul morceau « respiration », au milieu (entre 35 et 65 % de la durée)", () => {
    for (const L of levels) {
      const rest = L.pieces.filter((p) => p.tags.includes("respiration"));
      expect(rest, L.date).toHaveLength(1);
      const mid = ((rest[0]!.start + rest[0]!.end) / 2 / L.authorTicks) * 1000;
      expect(mid).toBeGreaterThanOrEqual(RESPIRATION_FROM);
      expect(mid).toBeLessThanOrEqual(RESPIRATION_TO);
    }
  });

  it("budget d'exigence : dans la fenêtre fixe, au moins un morceau d'exigence 4 ou plus, dernier tiers ≥ premier tiers", () => {
    for (const L of levels) {
      expect(L.exigence).toEqual(exigenceOfPieces(L.pieces, L.authorTicks));
      expect(L.exigence.sum).toBe(L.pieces.reduce((s, p) => s + p.exigence, 0));
      expect(L.exigence.rate, L.date).toBeGreaterThanOrEqual(EXIGENCE_RATE_MIN);
      expect(L.exigence.rate, L.date).toBeLessThanOrEqual(EXIGENCE_RATE_MAX);
      expect(L.pieces.some((p) => p.exigence >= EXIGENCE_PEAK)).toBe(true);
      expect(L.exigence.thirds[2]).toBeGreaterThanOrEqual(L.exigence.thirds[0]);
    }
  });

  it("pas de difficulté selon le jour de la semaine : l'exigence moyenne de chaque jour de la semaine reste dans la fenêtre", () => {
    const byWeekday: number[][] = [[], [], [], [], [], [], []];
    for (const L of levels) byWeekday[(((L.day + 4) % 7) + 7) % 7]!.push(L.exigence.rate);
    const means = byWeekday.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
    for (const m of means) {
      expect(m).toBeGreaterThanOrEqual(EXIGENCE_RATE_MIN);
      expect(m).toBeLessThanOrEqual(EXIGENCE_RATE_MAX);
    }
  });

  it("repos : chaque morceau d'un groupe au repos est absent ce jour-là ; trois groupes non vides", () => {
    const sizes = new Array<number>(REST_GROUPS).fill(0);
    for (const m of MODULES) sizes[restGroup(m.id)]!++;
    for (const n of sizes) expect(n).toBeGreaterThan(0);
    for (const L of levels) for (const p of L.pieces) expect(isRestedModule(p.id, L.day), `${L.date} ${p.id}`).toBe(false);
  });

  it("deux jours consécutifs ont peu de morceaux en commun (seulement le groupe disponible les deux jours)", () => {
    for (let k = 1; k < levels.length; k++) {
      const a = new Set(levels[k - 1]!.pieces.map((p) => p.id));
      const common = levels[k]!.pieces.filter((p) => a.has(p.id));
      const shared = MODULES.filter((m) => !isRestedModule(m.id, levels[k]!.day) && !isRestedModule(m.id, levels[k - 1]!.day)).length;
      expect(common.length).toBeLessThanOrEqual(shared);
      for (const p of common) expect(restGroup(p.id)).toBe((((levels[k]!.day + 1) % 3) + 3) % 3);
    }
  });
});

describe("niveau du jour : assemblage", () => {
  it("hauteur bornée (≤ 48 rangées) ; la rangée du haut est pleine", () => {
    for (const L of levels) {
      expect(L.level.height).toBeLessThanOrEqual(MAX_DAILY_HEIGHT);
      for (let c = 0; c < L.level.width; c++) expect(L.level.tiles[c]).toBe(TILE_SOLID);
    }
  });

  it("premier morceau à l'arrêt, tous les suivants en élan", () => {
    for (const L of levels) {
      expect(L.pieces[0]!.entry).toBe("arret");
      for (const p of L.pieces.slice(1)) expect(p.entry).toBe("elan");
    }
  });

  it("paliers alignés : la sortie d'un morceau et l'entrée du suivant sont sur la même rangée, avec la colonne de raccord entre les deux", () => {
    for (const L of levels) {
      for (let k = 1; k < L.pieces.length; k++) {
        const a = L.pieces[k - 1]!;
        const b = L.pieces[k]!;
        expect(b.entryRow).toBe(a.exitRow);
        expect(b.col0).toBe(a.col1 + 2);
        const joint = a.col1 + 1;
        const lv = L.level;
        // Sol plein sous le raccord et sous les paliers voisins, vide au-dessus.
        for (let c = joint - PALIER_MIN; c <= joint + PALIER_MIN; c++) expect(lv.tiles[a.exitRow * lv.width + c], `${L.date} col ${c}`).toBe(TILE_SOLID);
        expect(lv.tiles[(a.exitRow - 1) * lv.width + joint]).toBe(0);
      }
    }
  });

  it("un point de passage par morceau, sauf le premier (qui a le départ), posé au sol de sa colonne de raccord", () => {
    for (const L of levels) {
      const lv = L.level;
      expect(lv.checkpoints).toHaveLength(L.pieces.length - 1);
      L.pieces.slice(1).forEach((p, k) => {
        const cp = lv.checkpoints[k]!;
        expect(cp.col).toBe(p.col0 - 1);
        expect(cp.row).toBe(p.entryRow - 1);
        expect(lv.tiles[(cp.row + 1) * lv.width + cp.col]).toBe(TILE_SOLID);
      });
      expect(lv.start).toEqual({ col: 0, row: L.pieces[0]!.entryRow - 1 });
      const last = L.pieces[L.pieces.length - 1]!;
      expect(lv.finish).toEqual({ col: last.col1 + 1, row: last.exitRow - 1 });
    }
  });

  it("chaque morceau est une section ; ses scies mobiles en font partie", () => {
    for (const L of levels) {
      expect(L.level.sections.map((s) => [s.name, s.c0, s.c1])).toEqual(L.pieces.map((p) => [p.id, p.col0, p.col1]));
      for (const saw of L.level.saws) {
        if (saw.section < 0) continue;
        const p = L.pieces[saw.section]!;
        expect(saw.id.startsWith(`${p.id}/`)).toBe(true);
      }
    }
  });

  it("hors des morceaux tout est plein : les colonnes de raccord n'ont que du sol, du vide au-dessus et des blocs", () => {
    for (const L of levels.slice(0, 10)) {
      const rows = L.ascii.split("\n\n")[0]!.split("\n");
      for (let k = 1; k < L.pieces.length; k++) {
        const col = L.pieces[k]!.col0 - 1;
        for (const row of rows) expect(".#C").toContain(row[col]);
      }
    }
  });

  it("le départ d'un morceau est rejoint à moins d'un demi-pas de course près (raccord du lot 4)", () => {
    for (const L of levels.slice(0, 10)) {
      // Rejoue pas à pas et lit la position au pas où chaque morceau commence.
      let s = initialAttempt(L.level);
      const inputs = fromRuns(L.replay.runs);
      const starts = new Set(L.pieces.slice(1).map((p) => p.start));
      let tick = 0;
      for (const bits of inputs) {
        if (starts.has(tick)) {
          const p = L.pieces.find((q) => q.start === tick)!;
          const goal = (p.col0 - 1) * T + (T - PLAYER_WIDTH) / 2;
          expect(Math.abs(s.player.x - goal), `${L.date} ${p.id}`).toBeLessThanOrEqual(375);
          expect(s.player.ground).toBe(1);
        }
        s = stepAttempt(s, bits, L.level, DEFAULT_JUMP_PARAMS);
        tick++;
      }
    }
  });
});

describe("médailles", () => {
  it("en pas entiers, arrondies au pas supérieur, ordonnées : auteur < or < argent < bronze", () => {
    for (const L of levels) {
      const m = L.medals;
      expect(m).toEqual(jumpMedalsFor(L.authorTicks));
      for (const v of Object.values(m)) expect(Number.isInteger(v)).toBe(true);
      expect(m.author).toBe(L.authorTicks);
      expect(m.author).toBeLessThan(m.gold);
      expect(m.gold).toBeLessThan(m.silver);
      expect(m.silver).toBeLessThan(m.bronze);
      expect(m.gold).toBe(Math.ceil((L.authorTicks * MEDAL_PERCENT.gold) / 100));
      expect(m.silver).toBe(Math.ceil((L.authorTicks * MEDAL_PERCENT.silver) / 100));
      expect(m.bronze).toBe(Math.ceil((L.authorTicks * MEDAL_PERCENT.bronze) / 100));
    }
  });

  it("la médaille d'un temps : auteur, or, argent, bronze ou rien", () => {
    const m = jumpMedalsFor(3600);
    expect(m).toEqual({ author: 3600, gold: 3960, silver: 4680, bronze: 5760 });
    expect(jumpMedalFor(3500, m)).toBe("author");
    expect(jumpMedalFor(3600, m)).toBe("author");
    expect(jumpMedalFor(3601, m)).toBe("gold");
    expect(jumpMedalFor(3960, m)).toBe("gold");
    expect(jumpMedalFor(4680, m)).toBe("silver");
    expect(jumpMedalFor(5760, m)).toBe("bronze");
    expect(jumpMedalFor(5761, m)).toBeNull();
    expect(jumpMedalsFor(3001)).toEqual({ author: 3001, gold: 3302, silver: 3902, bronze: 4802 });
  });
});

describe("niveau de secours", () => {
  it("assemblé et validé par le rejeu, il tient toutes les règles", () => {
    const f = fallbackLevel(PREMIER_JOUR_JUMP);
    expect(typeof f).not.toBe("string");
    if (typeof f === "string") return;
    expect(f.fallback).toBe(true);
    expect(f.pieces.map((p) => `${p.id}:${p.variant}`)).toEqual(FALLBACK_PIECES.map((p) => `${p.id}:${p.variant}`));
    expect(dailyProblems(f)).toEqual([]);
    const r = replayAttempt(f.level, decodeReplay(f.code), f.id);
    expect(r.finished).toBe(true);
    expect(r.deaths).toHaveLength(0);
  });
});
