import { initialPlayer, isDefaultJumpParams, stepPlayer, type JumpParams, type Level, type PlayerState } from "@cdj/jump-sim";

// Une session de jeu : le niveau, les réglages (lus à chaque pas : le panneau `?debug&tune` les change en direct), l'état courant et le
// précédent (pour interpoler l'affichage). « Recommencer » est un événement de la session, pas une commande de la simulation.

export class JumpSession {
  state: PlayerState;
  prev: PlayerState;
  /** Pas joués depuis le départ (ou le dernier « recommencer »). */
  ticks = 0;
  /** Vrai dès que les réglages ont différé des défauts pendant la partie : elle ne sera jamais enregistrée (lot 3). */
  private wasTuned: boolean;

  constructor(
    readonly level: Level,
    readonly params: JumpParams,
  ) {
    this.state = initialPlayer(level);
    this.prev = this.state;
    this.wasTuned = !isDefaultJumpParams(params);
  }

  /** Partie aux réglages modifiés (même s'ils ont été remis aux défauts depuis le départ). */
  get tuned(): boolean {
    return this.wasTuned || !isDefaultJumpParams(this.params);
  }

  step(input: number): PlayerState {
    if (!isDefaultJumpParams(this.params)) this.wasTuned = true;
    this.prev = this.state;
    this.state = stepPlayer(this.state, input, this.level, this.params);
    this.ticks++;
    return this.state;
  }

  /** Retour au départ : nouvel essai, sans interpolation depuis l'ancienne position. */
  restart(): void {
    this.state = initialPlayer(this.level);
    this.prev = this.state;
    this.ticks = 0;
    this.wasTuned = !isDefaultJumpParams(this.params);
  }
}
