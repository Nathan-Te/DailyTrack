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
  PALIER_GUARD,
  PALIER_LENGTH,
  PLAYER_HEIGHT,
  RACCORD_TAIL,
  INPUT_RIGHT,
  LONGEST_RUN_MAX,
  MAX_LONG,
  MIN_LONG,
  longestRunOf,
  PREMIER_JOUR_JUMP,
  RESPIRATION_FROM,
  RESPIRATION_TO,
  REST_GROUPS,
  REST_OPEN,
  isOpenGroup,
  TILE_SOLID,
  TICK_RATE,
  UNITS_PER_TILE,
  DEFAULT_JUMP_PARAMS,
  ATTEMPT_FINISHED,
  assemble,
  buildModule,
  centerCol,
  checkpointAttempt,
  dailyLevel,
  dailyLevelId,
  dailyProblems,
  decodeReplay,
  encodeReplay,
  TENSION_RISES,
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
  isCleanRun,
  moduleSolutions,
  moduleStart,
  stepAttempt,
  type DailyLevel,
} from "../src/index";
import { emptyRun } from "../tools/vide";

// Le niveau du jour (lots 5 et 6) sur 60 dates fixes à partir du premier jour (jamais « aujourd'hui » : les tests ne lisent pas l'heure).

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
  it(`de ${MIN_PIECES} à ${MAX_PIECES} morceaux, jamais deux fois le même`, () => {
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

  it("lot 7b : la tension monte jusqu'à la fin — dernier tiers ≥ deuxième tiers, et la règle est bien dans dailyProblems", () => {
    expect(TENSION_RISES).toBe(true);
    for (const L of levels) expect(L.exigence.thirds[2], L.date).toBeGreaterThanOrEqual(L.exigence.thirds[1]);
    // La règle est appliquée : un niveau valide dont le dernier tiers est moins exigeant que le deuxième est refusé.
    const L = levels[0]!;
    expect(dailyProblems(L)).toEqual([]);
    const flat = { ...L, exigence: { ...L.exigence, thirds: [10, 30, 20] as [number, number, number] } };
    expect(dailyProblems(flat).some((m) => m.includes("deuxième"))).toBe(true);
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

  it("repos : chaque morceau d'un groupe au repos est absent ce jour-là ; groupes non vides, de tailles égales à un près ; REST_OPEN groupes ouverts par jour", () => {
    const sizes = new Array<number>(REST_GROUPS).fill(0);
    for (const m of MODULES) sizes[restGroup(m.id)]!++;
    for (const n of sizes) expect(n).toBeGreaterThan(0);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    for (const L of levels) {
      const open = Array.from({ length: REST_GROUPS }, (_, g) => g).filter((g) => isOpenGroup(g, L.day));
      expect(open).toHaveLength(REST_OPEN);
      // Les groupes ouverts sont consécutifs (modulo REST_GROUPS) et la fenêtre avance de REST_OPEN groupes par jour.
      expect(open.every((g) => isOpenGroup((g + REST_GROUPS - 1) % REST_GROUPS, L.day) || isOpenGroup((g + 1) % REST_GROUPS, L.day))).toBe(true);
      expect(isOpenGroup((((REST_OPEN * L.day) % REST_GROUPS) + REST_GROUPS) % REST_GROUPS, L.day)).toBe(true);
    }
    for (const L of levels) for (const p of L.pieces) expect(isRestedModule(p.id, L.day), `${L.date} ${p.id}`).toBe(false);
  });

  it("deux jours consécutifs n'ont en commun que des morceaux des 2 × REST_OPEN − REST_GROUPS groupes ouverts les deux jours", () => {
    for (let k = 1; k < levels.length; k++) {
      const a = new Set(levels[k - 1]!.pieces.map((p) => p.id));
      const common = levels[k]!.pieces.filter((p) => a.has(p.id));
      const both = Array.from({ length: REST_GROUPS }, (_, g) => g).filter((g) => isOpenGroup(g, levels[k]!.day) && isOpenGroup(g, levels[k - 1]!.day));
      expect(both).toHaveLength(2 * REST_OPEN - REST_GROUPS);
      for (const p of common) expect(both).toContain(restGroup(p.id));
    }
  });
});

describe("niveau du jour : assemblage", () => {
  it("hauteur bornée (≤ 56 rangées) ; la rangée du haut est pleine", () => {
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

  it("paliers partagés (lot 6) : le palier de sortie d'un morceau est le palier d'entrée du suivant, sans colonne de raccord", () => {
    for (const L of levels) {
      const lv = L.level;
      const at = (c: number, r: number) => lv.tiles[r * lv.width + c];
      expect(L.paliers).toHaveLength(L.pieces.length + 1);
      expect(L.paliers[0]).toEqual({ col0: PALIER_GUARD, col1: PALIER_GUARD + PALIER_LENGTH - 1, row: L.pieces[0]!.entryRow });
      for (let k = 1; k < L.pieces.length; k++) {
        const a = L.pieces[k - 1]!;
        const b = L.pieces[k]!;
        expect(b.entryRow).toBe(a.exitRow);
        // Entre deux morceaux : exactement un palier standard, ni plus ni moins.
        expect(b.col0).toBe(a.col1 + 1 + PALIER_LENGTH);
        const p = L.paliers[k]!;
        expect(p).toEqual({ col0: a.col1 + 1, col1: a.col1 + PALIER_LENGTH, row: a.exitRow });
        // Sol plein, plein dessous, vide au-dessus jusqu'en haut du plus haut des deux morceaux (un rebord, pas un couloir).
        const roof = Math.min(a.top, b.top);
        for (let c = p.col0; c <= p.col1; c++) {
          for (let r = 0; r < lv.height; r++) expect(at(c, r) === TILE_SOLID, `${L.date} palier ${k} (${c}, ${r})`).toBe(r < roof || r >= p.row);
        }
      }
      const last = L.pieces[L.pieces.length - 1]!;
      expect(L.paliers[L.pieces.length]).toEqual({ col0: last.col1 + 1, col1: last.col1 + PALIER_LENGTH, row: last.exitRow });
      expect(lv.width).toBe(last.col1 + PALIER_LENGTH + 2);
    }
  });

  it("un point de passage par morceau, sauf le premier (qui a le départ), au début du palier qui le précède ; l'arrivée juste après le dernier palier", () => {
    for (const L of levels) {
      const lv = L.level;
      expect(lv.checkpoints).toHaveLength(L.pieces.length - 1);
      L.pieces.slice(1).forEach((p, k) => {
        const cp = lv.checkpoints[k]!;
        expect(cp.col).toBe(p.col0 - PALIER_LENGTH);
        expect(cp.col).toBe(L.paliers[k + 1]!.col0);
        expect(cp.row).toBe(p.entryRow - 1);
        expect(lv.tiles[(cp.row + 1) * lv.width + cp.col]).toBe(TILE_SOLID);
      });
      expect(lv.start).toEqual({ col: PALIER_GUARD, row: L.pieces[0]!.entryRow - 1 });
      const last = L.paliers[L.paliers.length - 1]!;
      expect(lv.finish).toEqual({ col: last.col1 + 1, row: last.row - 1 });
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

  it("hors des morceaux tout est plein : les colonnes des paliers n'ont que du sol, du vide au-dessus, des blocs et les repères", () => {
    for (const L of levels.slice(0, 10)) {
      const rows = L.ascii.split("\n\n")[0]!.split("\n");
      for (const p of L.paliers) for (let c = p.col0; c <= p.col1; c++) for (const row of rows) expect(".#CS").toContain(row[c]);
    }
  });

  it("la solution suivante démarre au pas de sortie de la précédente : centre au bord du palier, en course propre, puis les commandes du morceau en élan", () => {
    for (const L of levels.slice(0, 20)) {
      let s = initialAttempt(L.level);
      const inputs = fromRuns(L.replay.runs);
      const starts = new Map(L.pieces.slice(1).map((p) => [p.start, p]));
      let prevCol = centerCol(s.player);
      for (let tick = 0; tick <= inputs.length; tick++) {
        const p = starts.get(tick);
        if (p) {
          // Le pas qui vient d'être joué est la sortie du morceau précédent : le centre vient de passer le bord droit du palier partagé.
          expect(centerCol(s.player), `${L.date} ${p.id}`).toBe(p.col0);
          expect(prevCol, `${L.date} ${p.id}`).toBeLessThan(p.col0);
          expect(isCleanRun(s.player), `${L.date} ${p.id}`).toBe(true);
          expect(s.player.y + PLAYER_HEIGHT).toBe(p.entryRow * T);
          // Puis la solution en élan du morceau, depuis son entrée, sans course entre les deux.
          const sol = moduleSolutions(p.id, p.variant)!.elan!;
          // (Selon la position d'entrée, la sortie peut venir quelques pas après la fin des commandes stockées : droite tenue, `RACCORD_TAIL`.)
          const own = [...fromRuns(decodeReplay(sol.code).runs), ...new Array<number>(RACCORD_TAIL).fill(INPUT_RIGHT)];
          expect(inputs.slice(p.start, p.end), `${L.date} ${p.id}`).toEqual(own.slice(sol.entryTick, sol.entryTick + p.end - p.start));
        }
        if (tick === inputs.length) break;
        prevCol = centerCol(s.player);
        s = stepAttempt(s, inputs[tick]!, L.level, DEFAULT_JUMP_PARAMS);
      }
      expect(s.status).toBe(ATTEMPT_FINISHED);
    }
  });

  it("la reprise sur un point de passage donne exactement l'entrée « arrêt » du morceau seul, et sa solution en sort", () => {
    for (const L of levels.slice(0, 20)) {
      const lv = L.level;
      L.pieces.slice(1).forEach((p, i) => {
        const k = i + 1;
        const where = `${L.date} ${p.id}`;
        const m = buildModule(p.id, p.variant);
        // Un essai qui a pris ce point et qui meurt plus loin : tout a démarré ; reprise.
        const running = { ...initialAttempt(lv), checkpoint: i, time: 5000, sections: lv.sections.map(() => 1000) };
        let s = checkpointAttempt(lv, running);
        const alone = moduleStart(m, "arret");
        const dx = (L.paliers[k]!.col0 - m.palierIn.col0) * T;
        expect(lv.checkpoints[i]!.col, where).toBe(L.paliers[k]!.col0);
        const dy = (p.entryRow - m.entryRow) * T;
        expect({ ...s.player, x: s.player.x - dx, y: s.player.y - dy }, where).toEqual(alone.player);
        // Les sections de ce morceau et d'après sont à l'arrêt, celles d'avant gardent leur cycle.
        expect(s.sections.slice(k).every((v) => v === -1), where).toBe(true);
        expect(s.sections.slice(0, k).every((v) => v === 1000), where).toBe(true);
        // La solution « arrêt » du morceau seul, jouée depuis là, le traverse et sort en course propre (ou arrive, pour le dernier).
        const sol = moduleSolutions(p.id, p.variant)!.arret!;
        const own = fromRuns(decodeReplay(sol.code).runs);
        const last = k === L.pieces.length - 1;
        expect(m.palierIn.col0, where).toBe(PALIER_GUARD);
        for (let t = 0; t < sol.exitTick && s.status !== ATTEMPT_FINISHED; t++) s = stepAttempt(s, own[t]!, lv, DEFAULT_JUMP_PARAMS);
        if (last) expect(s.status, where).toBe(ATTEMPT_FINISHED);
        else {
          expect(centerCol(s.player), where).toBe(L.pieces[k + 1]!.col0);
          expect(isCleanRun(s.player), where).toBe(true);
        }
      });
    }
  });
});

describe("course à vide (lot 6)", () => {
  // Sur la rediffusion de l'auteur : temps au sol sans appui de saut, centre au-dessus d'un palier de raccord.
  const runs = levels.map((L) => {
    const zones = L.paliers.slice(1, -1).map((p) => ({ c0: p.col0, c1: p.col1 }));
    return { L, r: emptyRun(L.level, initialAttempt(L.level), fromRuns(L.replay.runs), zones) };
  });

  it("la règle du générateur compte comme la mesure : `palierTicks` = le temps au sol sans appui de saut sur chaque palier de raccord", () => {
    for (const { L, r } of runs) expect(L.palierTicks, L.date).toEqual(r.zones);
  });

  it("moins de 0,25 s par raccord en moyenne, et moins de 6 % du temps de l'auteur au total, sur 60 dates", () => {
    const all = runs.flatMap(({ r }) => r.zones);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    expect(mean).toBeLessThan(0.25 * TICK_RATE);
    for (const { L, r } of runs) {
      const total = r.zones.reduce((a, b) => a + b, 0);
      expect(total, L.date).toBeLessThan(0.06 * L.authorTicks);
    }
  });
});

describe("lot 7 : variété", () => {
  it("une seule famille de chaque par niveau ; de 1 à 2 enchaînements longs", () => {
    for (const L of levels) {
      expect(new Set(L.pieces.map((p) => p.family)).size, L.date).toBe(L.pieces.length);
      const longs = L.pieces.filter((p) => p.long).length;
      expect(longs, L.date).toBeGreaterThanOrEqual(MIN_LONG);
      expect(longs, L.date).toBeLessThanOrEqual(MAX_LONG);
      for (const p of L.pieces) {
        const def = MODULES.find((m) => m.id === p.id)!;
        expect(p.family).toBe(def.family);
        expect(p.long).toBe(def.long);
      }
    }
  });

  it("cible de répétition : deux jours consécutifs ont au plus 1,5 morceau en commun en moyenne, 4 au plus", () => {
    const common: number[] = [];
    for (let k = 1; k < levels.length; k++) {
      const a = new Set(levels[k - 1]!.pieces.map((p) => p.id));
      common.push(levels[k]!.pieces.filter((p) => a.has(p.id)).length);
    }
    expect(Math.max(...common)).toBeLessThanOrEqual(4);
    expect(common.reduce((a, b) => a + b, 0) / common.length).toBeLessThanOrEqual(1.5);
  });

  it("plus longue course au sol sans saut (rediffusion de l'auteur) : 1,2 s au plus en moyenne, 2 s au plus ; `longestRun` = la mesure des outils", () => {
    const runs = levels.map((L) => {
      const r = emptyRun(L.level, initialAttempt(L.level), fromRuns(L.replay.runs), []);
      expect(L.longestRun, L.date).toBe(r.longestTicks);
      expect(longestRunOf(L.level, fromRuns(L.replay.runs))).toBe(L.longestRun);
      expect(L.longestRun, L.date).toBeLessThanOrEqual(LONGEST_RUN_MAX);
      expect(L.longestRun, L.date).toBeLessThanOrEqual(2 * TICK_RATE);
      return L.longestRun;
    });
    expect(runs.reduce((a, b) => a + b, 0) / runs.length).toBeLessThanOrEqual(1.2 * TICK_RATE);
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
