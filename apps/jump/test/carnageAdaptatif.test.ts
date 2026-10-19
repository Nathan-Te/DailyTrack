import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyLevel, demoAttempts, lifeReplay, replayAttempt, type JumpReplay } from "@cdj/jump-sim";
import { Carnage } from "../src/carnage";
import {
  CarnageGovernor,
  EVERYONE_LIVES_STEPS,
  EVERYONE_PARTICLE_STEPS,
  FRAME_INTERVAL_LIMIT_MS,
  FRAME_WORK_LIMIT_MS,
  GOVERNOR_LEVELS,
  GOVERNOR_WARMUP_MS,
  GOVERNOR_WATCH_MS,
  GOVERNOR_WINDOW_MS,
} from "../src/carnageGovernor";
import { everyoneLabel } from "../src/everyone";

// Lot P4 (plateforme) : le carnage de tout le monde s'adapte à l'appareil. Le gouverneur (paliers 150 → 100 → 60 vies, puis les particules),
// la limite des vies montrées dans le carnage (rendu seul : les vies gardées se jouent à l'identique), et le compteur, qui dit toujours le vrai
// total.

/** Des images régulières de `work` ms de travail et `interval` ms d'intervalle, pendant `ms` (heure de la page à partir de `from`). */
function feed(g: CarnageGovernor, from: number, ms: number, work: number, interval = 16.7): { now: number; changes: number } {
  let changes = 0;
  let now = from;
  for (; now < from + ms; now += interval) if (g.observe(work, interval, now)) changes++;
  return { now, changes };
}

describe("le gouverneur du carnage de tout le monde", () => {
  it("les paliers : 150, 100, 60 vies, puis les particules à moitié, puis aucune", () => {
    expect(GOVERNOR_LEVELS).toBe(5);
    expect([...EVERYONE_LIVES_STEPS]).toEqual([150, 100, 60, 60, 60]);
    expect([...EVERYONE_PARTICLE_STEPS]).toEqual([1, 1, 1, 0.5, 0]);
    const g = new CarnageGovernor();
    expect([g.level, g.maxLives, g.particles]).toEqual([0, 150, 1]);
  });

  it("un appareil rapide : aucun allègement", () => {
    const g = new CarnageGovernor();
    expect(feed(g, 0, GOVERNOR_WATCH_MS + 2000, FRAME_WORK_LIMIT_MS - 3).changes).toBe(0);
    expect(g.level).toBe(0);
    expect(g.windows.length).toBeGreaterThanOrEqual(3);
  });

  it("un appareil lent : un palier par fenêtre d'une seconde trop lourde, après l'échauffement, jusqu'au dernier ; jamais de remontée", () => {
    const g = new CarnageGovernor();
    // L'échauffement ne compte pas, même très lourd.
    feed(g, 0, GOVERNOR_WARMUP_MS, 80);
    expect(g.level).toBe(0);
    // Puis chaque seconde trop lourde (travail moyen au-delà du seuil) descend d'un palier.
    let t = feed(g, GOVERNOR_WARMUP_MS, GOVERNOR_WINDOW_MS + 20, FRAME_WORK_LIMIT_MS + 2).now;
    expect([g.level, g.maxLives]).toEqual([1, 100]);
    t = feed(g, t, GOVERNOR_WINDOW_MS + 20, FRAME_WORK_LIMIT_MS + 2).now;
    expect([g.level, g.maxLives]).toEqual([2, 60]);
    t = feed(g, t, GOVERNOR_WINDOW_MS + 20, FRAME_WORK_LIMIT_MS + 2).now;
    expect([g.level, g.maxLives, g.particles]).toEqual([3, 60, 0.5]);
    // L'appareil se reprend : on ne remonte pas pendant ce carnage (pas de va-et-vient visible).
    feed(g, t, GOVERNOR_WINDOW_MS + 20, 1);
    expect(g.level).toBe(3);
    const h = new CarnageGovernor();
    feed(h, 0, GOVERNOR_WATCH_MS, 40);
    expect([h.level, h.maxLives, h.particles]).toEqual([4, 60, 0]);
  });

  it("moins de 50 images/s (le processeur graphique ne suit pas) allège aussi, même avec peu de travail sur le fil principal", () => {
    const g = new CarnageGovernor();
    feed(g, 0, GOVERNOR_WARMUP_MS + GOVERNOR_WINDOW_MS + 100, 2, FRAME_INTERVAL_LIMIT_MS + 5);
    expect(g.level).toBe(1);
  });

  it("au-delà des premières secondes, le palier ne bouge plus ; une image de plus de 250 ms (onglet caché) n'est pas une mesure", () => {
    const g = new CarnageGovernor();
    feed(g, 0, GOVERNOR_WATCH_MS + 10, 1);
    feed(g, GOVERNOR_WATCH_MS + 10, 3000, 50);
    expect(g.level).toBe(0);
    const h = new CarnageGovernor();
    h.observe(1, 16, 0);
    for (let t = GOVERNOR_WARMUP_MS; t < GOVERNOR_WARMUP_MS + 3 * GOVERNOR_WINDOW_MS; t += 400) h.observe(300, 400, t);
    expect(h.level).toBe(0);
  });

  it("un palier imposé (mesure, tests : `__jump.carnage.govern`) ne bouge jamais", () => {
    const g = new CarnageGovernor({ locked: 2 });
    expect([g.level, g.maxLives]).toEqual([2, 60]);
    feed(g, 0, GOVERNOR_WATCH_MS, 50);
    expect(g.level).toBe(2);
    expect(new CarnageGovernor({ locked: 99 }).level).toBe(GOVERNOR_LEVELS - 1);
  });
});

describe("la limite des vies montrées dans le carnage", () => {
  const D = dailyLevel(daysFromCivil(2026, 10, 20));
  const lives: JumpReplay[] = [];
  for (const a of demoAttempts(D.level, D.replay, 0x77, { attempts: 30, maxLives: 8 })) {
    for (const life of replayAttempt(D.level, a.replay, D.id).lives) if (life.end === "mort") lives.push(lifeReplay(a.replay, life));
  }

  /** Joue le carnage jusqu'au bout ; rend le maximum de vies en course, les vies parties, les morts. */
  function play(c: Carnage, onTick?: (tick: number) => void): { maxRunning: number; departed: Set<number>; deaths: number } {
    const departed = new Set<number>();
    let maxRunning = 0;
    for (let t = 0; t < 40_000 && !c.done; t++) {
      onTick?.(t);
      for (const e of c.step()) if (e.kind === "depart") departed.add(e.life);
      maxRunning = Math.max(maxRunning, c.running);
    }
    return { maxRunning, departed, deaths: c.deaths };
  }

  it("au plus `limit` vies : celles d'après (dans l'ordre de l'échantillon) ne partent pas ; les vies gardées se jouent à l'identique ; le total ne change pas", () => {
    expect(lives.length).toBeGreaterThan(20);
    const full = new Carnage(D.level, D.replay, lives);
    const limited = new Carnage(D.level, D.replay, lives);
    limited.limit = 12;
    const total = full.total;
    expect(limited.total).toBe(total); // le compteur garde le vrai total
    const a = play(full);
    const b = play(limited);
    expect(Math.max(...b.departed)).toBeLessThan(12);
    expect(b.maxRunning).toBeLessThanOrEqual(12);
    expect(limited.total).toBe(total);
    // Les vies gardées font exactement ce qu'elles faisaient (même statut final) : la simulation de chacune ne dépend pas des autres.
    for (let i = 0; i < 12; i++) expect(limited.lives[i]!.status).toBe(full.lives[i]!.status);
    expect(b.deaths).toBeLessThanOrEqual(a.deaths);
  });

  it("baisser la limite en cours de carnage arrête les vies en trop là où elles sont ; elles ne repartent pas", () => {
    const c = new Carnage(D.level, D.replay, lives);
    const total = c.total;
    let runningAfter = 0;
    play(c, (t) => {
      if (t === 120) c.limit = 5;
      if (t > 120) runningAfter = Math.max(runningAfter, c.running);
    });
    expect(runningAfter).toBeLessThanOrEqual(5);
    expect(c.lives.slice(5).every((l) => l.status !== "court")).toBe(true);
    expect(c.total).toBe(total);
  });

  it("le compteur du carnage de tout le monde dit le vrai total, quel que soit le palier (« 150 vies de 9 joueurs »)", () => {
    // Le compteur est calculé avant le carnage, sur l'échantillon entier (`everyonePlan`) ; le gouverneur ne le touche pas.
    expect(everyoneLabel(150, 9)).toBe("150 vies de 9 joueurs");
    const c = new Carnage(D.level, D.replay, lives);
    c.limit = EVERYONE_LIVES_STEPS[GOVERNOR_LEVELS - 1]!;
    expect(c.total).toBe(new Carnage(D.level, D.replay, lives).total);
  });
});
