import { ATTEMPT_DEAD, ReplayRunner, type AttemptState, type JumpReplay, type Level } from "@cdj/jump-sim";

// Fantôme (lot 3), **logique seule** : le meilleur essai du jour rejoué par la simulation, **calé sur le chrono de l'essai en cours**
// (départ à la première commande : chrono 0, le fantôme attend au départ). Le chrono d'un essai vaut le nombre de pas rejoués depuis sa
// première commande (morts et reprises comprises) : le fantôme a donc joué exactement `chrono` pas de sa rediffusion. Un nouvel essai
// (chrono revenu en arrière) le ramène au départ. Ses morts et ses reprises sont les siennes : on les voit.

export class Ghost {
  private runner: ReplayRunner;

  constructor(
    readonly level: Level,
    readonly replay: JumpReplay,
  ) {
    this.runner = new ReplayRunner(level, replay);
  }

  /** Pas joués par le fantôme. */
  get tick(): number {
    return this.runner.tick;
  }

  get state(): AttemptState {
    return this.runner.state;
  }

  get prev(): AttemptState {
    return this.runner.prev;
  }

  get done(): boolean {
    return this.runner.done;
  }

  /** Mort en ce moment (il réapparaîtra sur son point de passage). */
  get dead(): boolean {
    return this.runner.state.status === ATTEMPT_DEAD;
  }

  /** Cale le fantôme sur le chrono `time` (pas) de l'essai en cours. */
  sync(time: number): void {
    if (time < this.runner.tick) this.runner = new ReplayRunner(this.level, this.replay);
    let moved = false;
    while (this.runner.tick < time && this.runner.step()) moved = true;
    // Rien n'a bougé ce coup-ci (chrono figé, ou fantôme au bout) : pas d'interpolation depuis un ancien état.
    if (!moved) this.runner.prev = this.runner.state;
  }
}

/**
 * Lot I5 : les temps de passage d'un essai (son chrono, en pas, au premier franchissement de chaque point de passage) — l'écart signé au record de la bande
 * du HUD (`+1,204` / `−0,412`) compare l'essai en cours à ceux du meilleur essai du jour. `undefined` : ce point n'a pas été franchi. Rejoue l'essai une fois
 * (à chaque nouveau record), jamais pendant la partie.
 */
export function checkpointTimes(level: Level, replay: JumpReplay): (number | undefined)[] {
  const out: (number | undefined)[] = level.checkpoints.map(() => undefined);
  const runner = new ReplayRunner(level, replay);
  while (runner.step()) {
    const s = runner.state;
    if (s.checkpoint >= 0 && s.checkpoint !== runner.prev.checkpoint && out[s.checkpoint] === undefined) out[s.checkpoint] = s.time;
  }
  return out;
}
