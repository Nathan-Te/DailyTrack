import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  PARASITE_CLOSED,
  PLAYER_WIDTH,
  PRESS_MIN,
  RELEASE_MIN,
  SLOW_BRONZE_MARGIN,
  SLOW_COST_MIN_TICKS,
  SLOW_MIN_EXIGENCE,
  SLOW_ZONE_WIDTH,
  UNITS_PER_TILE,
  centerCol,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  fromRuns,
  initialAttempt,
  isCleanRun,
  jumpMedalFor,
  jumpMedalsFor,
  medalsWithSlow,
  reassemble,
  replayAttempt,
  slowCostMin,
  slowShortcutProblems,
  stepAttempt,
  tileOf,
  type AttemptState,
  type DailyLevel,
} from "../src/index";
import { beamSolve } from "../tools/beam";
import { slowGigue, slowStart } from "../tools/voies";

// Lot 16 — la seconde voie sur les portions dures (générateur g11) : règles vérifiées sur chaque jour régénéré.

/** Les jours régénérés par le lot (le 23/10/2026 et avant sont figés) : deux semaines à partir du 24/10/2026. */
const FIRST = parseDay("2026-10-24")!;
const DAYS: DailyLevel[] = Array.from({ length: 14 }, (_, k) => dailyLevel(FIRST + k));
const T = UNITS_PER_TILE;

describe("lot 16 — une voie lente par portion dure", () => {
  it("chaque morceau noté 4 ou 5 (sauf le premier, qui part à l'arrêt du départ) a exactement une voie lente ; les autres n'en ont pas", () => {
    let routes = 0;
    for (const L of DAYS) {
      expect(L.pieces[0]!.exigence, L.date).toBeLessThan(SLOW_MIN_EXIGENCE);
      L.pieces.forEach((p, k) => {
        const mine = L.slowRoutes.filter((r) => r.piece === k);
        expect(mine.length, `${L.date} ${p.id}`).toBe(p.exigence >= SLOW_MIN_EXIGENCE ? 1 : 0);
      });
      routes += L.slowRoutes.length;
      expect(dailyProblems(L), L.date).toEqual([]);
    }
    expect(routes).toBeGreaterThanOrEqual(DAYS.length);
  });

  it("coût : la voie lente prend au moins max(+50 % du temps de la portion, +3 s) de plus que la voie rapide, mesuré sur les deux solutions", () => {
    expect(slowCostMin(120)).toBe(SLOW_COST_MIN_TICKS);
    expect(slowCostMin(1000)).toBe(500);
    expect(slowCostMin(1001)).toBe(501);
    for (const L of DAYS) {
      const inputs = fromRuns(L.replay.runs);
      for (const r of L.slowRoutes) {
        const where = `${L.date} ${L.pieces[r.piece]!.id}`;
        expect(r.slowTicks, where).toBeGreaterThanOrEqual(r.fastTicks + slowCostMin(r.fastTicks));
        // La portion rapide : de l'entrée sur le palier à la sortie canonique du palier suivant (ou l'arrivée), sur la preuve.
        let s = initialAttempt(L.level);
        let fork = -1;
        let end = -1;
        for (let t = 0; t < inputs.length && end < 0; t++) {
          s = stepAttempt(s, inputs[t]!, L.level, DEFAULT_JUMP_PARAMS);
          if (fork < 0 && centerCol(s.player) >= r.palierIn.col0) fork = t + 1;
          if (fork >= 0 && (s.status === ATTEMPT_FINISHED || centerCol(s.player) > r.palierOut.col1)) end = t + 1;
        }
        expect([fork, end - fork], where).toEqual([r.fork, r.fastTicks]);
        // La voie lente enregistrée : la preuve jusqu'à `fork`, puis ses commandes ; rejouée, elle passe le palier suivant sans mourir.
        const replay = decodeReplay(r.code);
        expect(replay.simVersion, where).toBe(L.level.simVersion);
        const all = fromRuns(replay.runs);
        expect(all.slice(0, r.fork), where).toEqual(inputs.slice(0, r.fork));
        expect(all.length - r.fork, where).toBe(r.slowTicks);
        const res = replayAttempt(L.level, replay, L.id);
        expect(res.deaths.length, where).toBe(0);
        const last = r.piece === L.pieces.length - 1;
        if (last) expect(res.finished, where).toBe(true);
        else {
          expect(centerCol(res.final.player), where).toBe(r.palierOut.col1 + 1);
          expect(isCleanRun(res.final.player), where).toBe(true);
        }
        // Elle passe bien par la cage et la galerie : au-dessus du haut du morceau contourné.
        let top = Infinity;
        let st = initialAttempt(L.level);
        for (const bits of all) {
          st = stepAttempt(st, bits, L.level, DEFAULT_JUMP_PARAMS);
          if (centerCol(st.player) > r.zone + 3 && centerCol(st.player) < r.palierOut.col0) top = Math.min(top, st.player.y);
        }
        expect(top, where).toBeLessThan(L.pieces[r.piece]!.top * T);
      }
    }
  });

  it("difficulté : la voie lente est notée 2 au plus (gigue ±3 ≥ 85 %, appuis humains), à la mesure des morceaux", () => {
    for (const L of DAYS) {
      for (const r of L.slowRoutes) {
        const g = slowGigue(L, r);
        const where = `${L.date} ${L.pieces[r.piece]!.id} ${g.gigue.join("/")}`;
        expect(g.note, where).toBeGreaterThanOrEqual(1);
        expect(g.note, where).toBeLessThanOrEqual(2);
        // Appuis de saut d'au moins `PRESS_MIN` pas, relâchés au moins `RELEASE_MIN` pas (jouable au clavier).
        const { inputs } = slowStart(L, r);
        let press = 0;
        let release = RELEASE_MIN;
        for (const bits of inputs) {
          if (bits & 4) {
            if (press === 0) expect(release, where).toBeGreaterThanOrEqual(RELEASE_MIN);
            press++;
            release = 0;
          } else {
            if (press > 0) expect(press, where).toBeGreaterThanOrEqual(PRESS_MIN);
            press = 0;
            release++;
          }
        }
      }
    }
  }, 300_000); // lot 20 : ≈ 80 s mesurées en local (g15 : des niveaux à plateformes, solveur à horloges), 122 s sur le runner chargé de la CI (limite d'avant : 120 s)
});

describe("lot 16 — aucun raccourci", () => {
  it("chaque voie n'est reliée au niveau que par son entrée et sa descente ; aucune scie ne la touche ; la descente ne donne pas sur le haut du morceau suivant", () => {
    for (const L of DAYS) {
      const asm = reassemble(L);
      expect(asm.slow.map((r) => r.piece), L.date).toEqual(L.slowRoutes.map((r) => r.piece));
      expect(slowShortcutProblems({ ...asm, level: L.level }), L.date).toEqual([]);
      // Les cases creusées sont hors du morceau contourné (au-dessus de son haut, ou dans la zone de bifurcation, ou au-dessus du palier
      // suivant) : la grille du morceau n'est pas touchée.
      for (const r of asm.slow) {
        const p = L.pieces[r.piece]!;
        for (const c of r.carved) {
          const inside = c.col >= p.col0 && c.col <= p.col1 && c.row >= p.top;
          expect(inside, `${L.date} ${p.id} ${c.col},${c.row}`).toBe(false);
        }
      }
    }
  });

  it("le solveur ne trouve pas plus court par la voie lente : sans entrer dans le morceau, la sortie du palier suivant demande au moins le coût minimal", () => {
    // La recherche des morceaux (faisceau, appuis humains), du pas où la preuve entre sur le palier, interdite dans la grille du morceau
    // contourné : le seul chemin est la voie lente ; elle ne trouve rien sous `rapide + coût minimal`.
    let searched = 0;
    for (const L of DAYS.slice(0, 4)) {
      for (const r of L.slowRoutes) {
        const p = L.pieces[r.piece]!;
        const { start } = slowStart(L, r);
        const last = r.piece === L.pieces.length - 1;
        const goal = (s: AttemptState) => (last ? s.status === ATTEMPT_FINISHED : centerCol(s.player) > r.palierOut.col1);
        const lost = (s: AttemptState) => {
          const c0 = tileOf(s.player.x);
          const c1 = tileOf(s.player.x + PLAYER_WIDTH - 1);
          return c1 >= p.col0 && c0 <= p.col1 && s.player.y >= p.top * T;
        };
        const found = beamSolve(L.level, { start, goal, lost, beam: 300, chunk: 6, maxTicks: r.fastTicks + slowCostMin(r.fastTicks) - 1, pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
        expect(found, `${L.date} ${p.id}`).toBeNull();
        searched++;
      }
    }
    expect(searched).toBeGreaterThan(3);
  }, 300_000);

  it("les voies parasites fermées (`PARASITE_CLOSED`) ne sont jamais posées", () => {
    for (const L of DAYS) for (const p of L.pieces) expect(PARASITE_CLOSED[p.id]?.includes(p.variant) ?? false, `${L.date} ${p.id}`).toBe(false);
  });

  it("src/parasites.ts suit modules/voies.json (sinon : relancer voies:modules)", () => {
    const file = JSON.parse(readFileSync(join(import.meta.dirname, "../modules/voies.json"), "utf8")) as { modules: Record<string, Record<string, { verdict: string }>> };
    const closed: Record<string, number[]> = {};
    for (const [id, vs] of Object.entries(file.modules)) {
      const ko = Object.entries(vs).filter(([, v]) => v.verdict === "fermee").map(([k]) => Number(k));
      if (ko.length > 0) closed[id] = ko;
    }
    expect(PARASITE_CLOSED).toEqual(closed);
  });
});

describe("lot 16 — médailles et temps de référence", () => {
  it("l'or n'est atteignable que par les voies rapides ; le bronze l'est en prenant toutes les voies lentes, avec une marge", () => {
    for (const L of DAYS) {
      const m = L.medals;
      expect(m).toEqual(medalsWithSlow(L.authorTicks, L.slowRoutes));
      const extras = L.slowRoutes.map((r) => r.slowTicks - r.fastTicks);
      expect(L.slowTicks, L.date).toBe(L.authorTicks + extras.reduce((a, b) => a + b, 0));
      // Une seule voie lente prise (n'importe laquelle) : plus d'or.
      for (const x of extras) expect(jumpMedalFor(L.authorTicks + x, m), L.date).not.toBe("gold");
      expect(m.gold, L.date).toBeLessThan(L.authorTicks + Math.min(...extras));
      // Toutes les voies lentes : le bronze au moins, avec `SLOW_BRONZE_MARGIN` de marge.
      expect(m.bronze * 100, L.date).toBeGreaterThanOrEqual(L.slowTicks * SLOW_BRONZE_MARGIN);
      expect(jumpMedalFor(L.slowTicks, m), L.date).not.toBeNull();
      expect(m.author < m.gold && m.gold <= m.silver && m.silver <= m.bronze, L.date).toBe(true);
    }
  });

  it("l'ajustement est minimal : sans voie lente, les médailles du temps de l'auteur ; sinon l'or ne baisse et le bronze ne monte que si une règle l'exige", () => {
    expect(medalsWithSlow(3600, [])).toEqual(jumpMedalsFor(3600));
    // Surcoût de 3 s sur 30 s : l'or (×1,10 = +3 s) passerait à égalité ; il descend d'un pas sous ce temps.
    expect(medalsWithSlow(3600, [{ fastTicks: 300, slowTicks: 660 }]).gold).toBe(3600 + 360 - 1);
    // Surcoût de 5 s : l'or ×1,10 tient déjà, rien ne bouge.
    expect(medalsWithSlow(3600, [{ fastTicks: 300, slowTicks: 900 }])).toEqual(jumpMedalsFor(3600));
    // Quatre voies de 6 s : toutes les voies lentes = 54 s, le bronze (×1,60 = 57,6 s) est au-dessus de 54 × 1,10 = 59,4 s ? non : il monte.
    const m = medalsWithSlow(3600, Array.from({ length: 4 }, () => ({ fastTicks: 300, slowTicks: 1020 })));
    expect(m.bronze).toBe(Math.ceil((6480 * SLOW_BRONZE_MARGIN) / 100));
    expect(m.gold).toBe(jumpMedalsFor(3600).gold);
  });
});

describe("lot 16 — la zone de bifurcation", () => {
  it("palier · zone (mur, cage, mur, palier bis) · morceau : la piste rapide passe sous la cage, une rangée libre, sans rien d'autre", () => {
    for (const L of DAYS) {
      const lv = L.level;
      const at = (c: number, r: number) => lv.tiles[r * lv.width + c]!;
      for (const r of L.slowRoutes) {
        const p = L.pieces[r.piece]!;
        expect(r.zone, L.date).toBe(r.palierIn.col1 + 1);
        expect(p.col0, L.date).toBe(r.zone + SLOW_ZONE_WIDTH);
        for (let c = r.zone; c < p.col0; c++) {
          expect(at(c, r.entryRow), `${L.date} sol ${c}`).toBe(1);
          expect(at(c, r.entryRow - 1), `${L.date} piste ${c}`).toBe(0);
        }
        // Le toit de la cage (rangée E−2) au-dessus de la piste, puis le palier bis ouvert jusqu'en haut du morceau.
        for (let c = r.zone; c < r.zone + 4; c++) expect(at(c, r.entryRow - 2), `${L.date} toit ${c}`).toBe(1);
        for (let c = r.zone + 4; c < p.col0; c++) for (let row = p.top; row < r.entryRow; row++) expect(at(c, row), `${L.date} palier bis ${c},${row}`).toBe(0);
        // Les corniches alternent contre les murs, trois rangées d'écart ; la dernière est le sol de la galerie.
        r.ledges.forEach((l, i) => {
          expect(l.row, L.date).toBe(r.entryRow - 5 - 3 * i);
          expect(l.col, L.date).toBe(r.zone + 1 + (i % 2));
          expect(at(l.col, l.row), L.date).toBe(1);
        });
        expect(r.ledges[r.ledges.length - 1]!.row).toBe(r.galleryRow);
        expect(r.galleryRow, L.date).toBeLessThan(p.top);
      }
    }
  });

  it("la course sous la cage reste une course propre (la preuve n'y touche à rien) et ne change pas la référence d'un pas de plus que la zone", () => {
    for (const L of DAYS) {
      const inputs = fromRuns(L.replay.runs);
      let s = initialAttempt(L.level);
      for (let t = 0; t < inputs.length; t++) {
        s = stepAttempt(s, inputs[t]!, L.level, DEFAULT_JUMP_PARAMS);
        expect(s.status).not.toBe(ATTEMPT_DEAD);
        for (const r of L.slowRoutes) {
          const c = centerCol(s.player);
          if (c >= r.zone && c < r.zone + 4) expect(isCleanRun(s.player), `${L.date} pas ${t}`).toBe(true);
        }
      }
    }
  });
});
