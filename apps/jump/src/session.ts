import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  TICK_RATE,
  initialAttempt,
  isDefaultJumpParams,
  stepAttempt,
  type AttemptState,
  type JumpParams,
  type Level,
} from "@cdj/jump-sim";

// Une session de jeu : le niveau, les réglages (lus à chaque pas : le panneau `?debug&tune` les change en direct), l'essai courant et
// l'état précédent (pour interpoler l'affichage), et ce que la session retient (lot 2) : morts, meilleur temps, dernière mort.
// « Recommencer » est un événement de la session, pas une commande de la simulation, et **ce n'est pas une mort**.
// Mémoire de la session seulement : l'enregistrement viendra au lot 3.

/** Ce qui vient d'arriver pendant un pas (l'affichage s'en sert : éclatement, tremblement, bandeau). */
export type SessionEvent =
  | { kind: "death"; cause: number; x: number; y: number }
  | { kind: "respawn" }
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
  /** Essais commencés (le premier compris). */
  attempts = 1;
  /** Vrai dès que les réglages ont différé des défauts pendant l'essai : il ne sera jamais enregistré (lot 3). */
  private wasTuned: boolean;

  constructor(
    readonly level: Level,
    readonly params: JumpParams,
  ) {
    this.state = initialAttempt(level);
    this.prev = this.state;
    this.wasTuned = !isDefaultJumpParams(params);
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
    if (s.status === ATTEMPT_DEAD && before.status !== ATTEMPT_DEAD) {
      this.deaths++;
      this.lastDeath = { cause: s.deathCause, x: s.deathX, y: s.deathY, time: s.time };
      return { kind: "death", cause: s.deathCause, x: s.deathX, y: s.deathY };
    }
    if (s.status === ATTEMPT_READY && before.status === ATTEMPT_DEAD) {
      this.newAttempt();
      return { kind: "respawn" };
    }
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
    this.state = initialAttempt(this.level);
    this.newAttempt();
  }

  private newAttempt(): void {
    this.prev = this.state;
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
