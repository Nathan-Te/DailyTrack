import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  TICK_RATE,
  AttemptRecorder,
  initialAttempt,
  isDefaultJumpParams,
  stepAttempt,
  type AttemptState,
  type JumpParams,
  type Level,
  type RecordedAttempt,
} from "@cdj/jump-sim";

// Une session de jeu : le niveau, les réglages (lus à chaque pas : le panneau `?debug&tune` les change en direct), l'essai courant et
// l'état précédent (pour interpoler l'affichage), et ce que la session retient (lot 2) : morts, meilleur temps, dernière mort.
// « Recommencer » est un événement de la session, pas une commande de la simulation, et **ce n'est pas une mort**.
// Lot 3 : chaque essai est enregistré (`AttemptRecorder`) ; un essai clos (arrivée, mort sans point de passage, « recommencer ») attend
// dans `takeEssai()` que le jeu le confie à la mémoire du jour, qui le **rejoue** avant d'en garder quoi que ce soit.

/** Ce qui vient d'arriver pendant un pas (l'affichage s'en sert : éclatement, tremblement, bandeau). */
export type SessionEvent =
  | { kind: "death"; cause: number; x: number; y: number }
  /** Retour en jeu après une mort : au départ (nouvel essai) ou sur un point de passage (le même essai continue, chrono compris). */
  | { kind: "respawn"; checkpoint: boolean }
  /** Point de passage atteint (lot 2b). */
  | { kind: "checkpoint"; index: number }
  | { kind: "finish"; time: number; best: boolean };

export interface LastDeath {
  cause: number;
  /** Centre du personnage à la mort, unités. */
  x: number;
  y: number;
  /** Chrono de l'essai à la mort, en pas. */
  time: number;
}

export class JumpSession {
  state: AttemptState;
  prev: AttemptState;
  /** Pas joués depuis le départ (ou le dernier « recommencer »). */
  ticks = 0;
  /** Morts de la session (recommencer n'en est pas une). */
  deaths = 0;
  /** Meilleur temps d'arrivée de la session, en pas (null : pas encore d'arrivée). */
  best: number | null = null;
  lastDeath: LastDeath | null = null;
  /** Morts dans l'essai en cours (reprises sur un point de passage, lot 2b) : 0 = essai sans faute. */
  attemptDeaths = 0;
  /** Essais commencés (le premier compris). */
  attempts = 1;
  /** Vrai dès que les réglages ont différé des défauts pendant l'essai : il ne sera jamais enregistré (lot 3). */
  private wasTuned: boolean;
  /** Enregistreur des essais (lot 3) ; null : rien n'est enregistré (lecture d'une rediffusion). */
  readonly recorder: AttemptRecorder | null;
  /** Essais clos, pas encore confiés à la mémoire du jour (avec leur drapeau « réglages modifiés »). */
  private closed: { essai: RecordedAttempt; tuned: boolean }[] = [];

  constructor(
    readonly level: Level,
    readonly params: JumpParams,
    levelId: string | null = null,
  ) {
    this.state = initialAttempt(level);
    this.prev = this.state;
    this.wasTuned = !isDefaultJumpParams(params);
    this.recorder = levelId ? new AttemptRecorder(levelId) : null;
  }

  /** Le prochain essai clos (arrivée, mort sans point de passage, « recommencer »), à confier à la mémoire du jour. */
  takeEssai(): { essai: RecordedAttempt; tuned: boolean } | null {
    return this.closed.shift() ?? null;
  }

  /** La page se ferme : l'essai en cours est clos comme un abandon (ses vies sont gardées). */
  flush(): void {
    const ab = this.recorder?.abandon();
    if (ab) this.closed.push({ essai: ab, tuned: this.tuned });
  }

  /** Essai aux réglages modifiés (même s'ils ont été remis aux défauts depuis le départ). */
  get tuned(): boolean {
    return this.wasTuned || !isDefaultJumpParams(this.params);
  }

  /** Un pas ; rend l'événement survenu (mort, réapparition, arrivée), sinon null. */
  step(input: number): SessionEvent | null {
    if (!isDefaultJumpParams(this.params)) this.wasTuned = true;
    const before = this.state;
    this.prev = before;
    this.state = stepAttempt(before, input, this.level, this.params);
    this.ticks++;
    const s = this.state;
    const done = this.recorder?.step(before, input, s);
    if (done) this.closed.push({ essai: done, tuned: this.tuned });
    if (s.status === ATTEMPT_DEAD && before.status !== ATTEMPT_DEAD) {
      this.deaths++;
      this.attemptDeaths++;
      this.lastDeath = { cause: s.deathCause, x: s.deathX, y: s.deathY, time: s.time };
      return { kind: "death", cause: s.deathCause, x: s.deathX, y: s.deathY };
    }
    if (s.status === ATTEMPT_READY && before.status === ATTEMPT_DEAD) {
      this.newAttempt();
      return { kind: "respawn", checkpoint: false };
    }
    if (s.status === ATTEMPT_RUNNING && before.status === ATTEMPT_DEAD) {
      this.prev = s; // pas d'interpolation depuis le lieu de la mort
      return { kind: "respawn", checkpoint: true };
    }
    if (s.checkpoint !== before.checkpoint && s.checkpoint >= 0 && s.status === ATTEMPT_RUNNING) return { kind: "checkpoint", index: s.checkpoint };
    if (s.status === ATTEMPT_FINISHED && before.status !== ATTEMPT_FINISHED) {
      // Un essai aux réglages modifiés n'est pas un vrai temps : il ne devient pas le meilleur de la session.
      const counted = !this.tuned;
      const best = counted && (this.best === null || s.time < this.best);
      if (best) this.best = s.time;
      return { kind: "finish", time: s.time, best };
    }
    return null;
  }

  /** « Recommencer » : nouvel essai depuis l'état initial, sans interpolation depuis l'ancienne position. Ne compte pas comme une mort. */
  restart(): void {
    this.flush();
    this.state = initialAttempt(this.level);
    this.newAttempt();
  }

  private newAttempt(): void {
    this.prev = this.state;
    this.attemptDeaths = 0;
    this.ticks = 0;
    this.attempts++;
    this.wasTuned = !isDefaultJumpParams(this.params);
  }
}

/** Un temps en pas → « 12,345 s » (secondes à 3 décimales, virgule française). Affichage seulement. */
export function formatTicks(ticks: number): string {
  const ms = Math.round((ticks * 1000) / TICK_RATE);
  const s = Math.floor(ms / 1000);
  return `${s},${String(ms % 1000).padStart(3, "0")} s`;
}
