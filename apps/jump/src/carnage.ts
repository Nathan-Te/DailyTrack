import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  PLAYER_WIDTH,
  ReplayRunner,
  replayAttempt,
  tileOf,
  type AttemptState,
  type JumpReplay,
  type Level,
} from "@cdj/jump-sim";

// Le carnage (lot 3), **logique seule** (aucun rendu, testée) : à l'arrivée, toutes les vies du jour rejouées ensemble, par vagues.
//   - Le **héros** est l'essai qui vient de finir, rejoué depuis le départ (reprises comprises).
//   - Chaque autre vie part de son point de départ **au moment où le héros y passe** pour la première fois (son centre, vivant, en franchit
//     la colonne : c'est aussi la règle qui prend le point, lot 4) ; les vies nées au départ partent avec lui. Les vies de l'essai héros ne sont pas dupliquées
//     (l'appelant les écarte : `DayMemory.liveReplays(essai)`).
//   - Chaque vie est simulée dans **sa propre instance** de la simulation (`ReplayRunner`) : elle meurt exactement là où elle est morte.
//     Les dangers affichés sont ceux du monde du héros : une vie partie d'un point de passage à un autre instant que lors de sa vraie
//     course voit (à l'écran) des scies un peu décalées. C'est accepté et documenté (README du lot 3).

/** Après l'arrivée du héros, les vies encore en route ont au plus ce délai (pas) pour finir avant que le carnage s'arrête. */
export const CARNAGE_GRACE_TICKS = 180;
/** Et le carnage reste au moins ce délai (pas) après l'arrivée du héros : on voit « 1 arrivée ». */
export const CARNAGE_HOLD_TICKS = 90;

export type CarnageLifeStatus = "attend" | "court" | "morte" | "arrivée" | "finie";

export interface CarnageLife {
  replay: JumpReplay;
  /** Pas du héros où elle part (−1 : jamais, son point de départ n'a pas été atteint par le héros). */
  depart: number;
  status: CarnageLifeStatus;
  runner: ReplayRunner | null;
}

export type CarnageEvent =
  | { kind: "death"; life: number; x: number; y: number; cause: number }
  | { kind: "finish"; life: number }
  | { kind: "depart"; life: number };

/** Le héros vaut −1 dans les événements. */
export const HERO = -1;

/** Centre du personnage en colonne de tuile. */
const centerCol = (s: Readonly<AttemptState>) => tileOf(s.player.x + PLAYER_WIDTH / 2);

/**
 * Pas du héros où chaque point de départ est passé pour la première fois : `[−1]` (le départ `S`) → 0 ; point de passage `c` → premier pas
 * où le centre du héros vivant en atteint la colonne (même s'il le saute) ; −1 s'il ne l'a jamais passé. Rend aussi la durée du héros.
 */
export function departures(level: Level, hero: JumpReplay): { checkpoints: number[]; heroTicks: number } {
  const passed = level.checkpoints.map(() => -1);
  const runner = new ReplayRunner(level, hero);
  while (runner.step()) {
    const s = runner.state;
    if (s.status === ATTEMPT_DEAD) continue;
    const col = centerCol(s);
    for (let c = 0; c < passed.length; c++) {
      if (passed[c]! >= 0) continue;
      if (col >= level.checkpoints[c]!.col) passed[c] = runner.tick;
    }
  }
  return { checkpoints: passed, heroTicks: runner.tick };
}

/** Calendrier des départs : pour chaque vie, le pas du héros où elle part (−1 jamais). */
export function carnageSchedule(level: Level, hero: JumpReplay, lives: readonly JumpReplay[]): { depart: number[]; heroTicks: number } {
  const { checkpoints, heroTicks } = departures(level, hero);
  return { depart: lives.map((l) => (l.start.checkpoint < 0 ? 0 : (checkpoints[l.start.checkpoint] ?? -1))), heroTicks };
}

/** Le carnage pas à pas : le héros et toutes les vies, chacune dans sa simulation. */
export class Carnage {
  readonly hero: ReplayRunner;
  readonly lives: CarnageLife[];
  /** Vies du héros (son essai découpé) : elles comptent dans « N vies ». */
  readonly heroLives: number;
  readonly heroTicks: number;
  /** Pas joués depuis le départ du carnage (= pas du héros). */
  tick = 0;
  arrivals = 0;
  deaths = 0;
  /** Vies en course en ce moment (héros non compris). */
  running = 0;
  private ended = false;

  constructor(
    readonly level: Level,
    hero: JumpReplay,
    lives: readonly JumpReplay[],
  ) {
    this.hero = new ReplayRunner(level, hero);
    this.heroLives = replayAttempt(level, hero).lives.length;
    const plan = carnageSchedule(level, hero, lives);
    this.heroTicks = plan.heroTicks;
    this.lives = lives.map((replay, i) => ({ replay, depart: plan.depart[i]!, status: "attend", runner: null }));
  }

  /** Vies du carnage : celles du héros plus celles qui partiront. */
  get total(): number {
    return this.heroLives + this.lives.filter((l) => l.depart >= 0).length;
  }

  /** Fini : le héros est arrivé (depuis `CARNAGE_HOLD_TICKS` au moins) et toutes les vies ont fini (ou le délai de grâce est passé). */
  get done(): boolean {
    return this.ended;
  }

  /** Un pas : le héros, les départs dus, chaque vie en course. Rend ce qui s'est passé (morts, arrivées, départs). */
  step(): CarnageEvent[] {
    if (this.ended) return [];
    const events: CarnageEvent[] = [];
    const hero = this.hero;
    if (hero.step()) {
      if (hero.state.status === ATTEMPT_DEAD && hero.prev.status !== ATTEMPT_DEAD) {
        this.deaths++;
        events.push({ kind: "death", life: HERO, x: hero.state.deathX, y: hero.state.deathY, cause: hero.state.deathCause });
      }
      if (hero.state.status === ATTEMPT_FINISHED && hero.prev.status !== ATTEMPT_FINISHED) {
        this.arrivals++;
        events.push({ kind: "finish", life: HERO });
      }
    }
    const t = this.tick;
    let running = 0;
    for (let i = 0; i < this.lives.length; i++) {
      const life = this.lives[i]!;
      if (life.status === "attend") {
        if (life.depart < 0 || life.depart > t) continue;
        life.runner = new ReplayRunner(this.level, life.replay);
        life.status = "court";
        events.push({ kind: "depart", life: i });
      }
      if (life.status !== "court") continue;
      const r = life.runner!;
      if (!r.step()) {
        life.status = "finie";
        continue;
      }
      if (r.state.status === ATTEMPT_DEAD && r.prev.status !== ATTEMPT_DEAD) {
        life.status = "morte";
        this.deaths++;
        events.push({ kind: "death", life: i, x: r.state.deathX, y: r.state.deathY, cause: r.state.deathCause });
      } else if (r.state.status === ATTEMPT_FINISHED) {
        life.status = "arrivée";
        this.arrivals++;
        events.push({ kind: "finish", life: i });
      } else if (r.done) life.status = "finie";
      else running++;
    }
    this.running = running;
    this.tick++;
    const pending = this.lives.some((l) => l.status === "court" || (l.status === "attend" && l.depart >= 0));
    if (hero.done && this.tick >= this.heroTicks + CARNAGE_HOLD_TICKS && (!pending || this.tick >= this.heroTicks + CARNAGE_GRACE_TICKS)) this.ended = true;
    return events;
  }

  /** Arrête tout (une commande passe le carnage). */
  stop(): void {
    this.ended = true;
  }
}

/** « 47 vies · 1 arrivée » */
export function carnageLabel(lives: number, arrivals: number): string {
  return `${lives} ${lives > 1 ? "vies" : "vie"} · ${arrivals} ${arrivals > 1 ? "arrivées" : "arrivée"}`;
}
