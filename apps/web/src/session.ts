import {
  ReplayPlayer,
  ReplayRecorder,
  SIM_VERSION,
  copyCar,
  createCar,
  createRace,
  decodeReplay,
  stepRace,
  type CarInput,
  type CarParams,
  type CarState,
  type RaceState,
  type Replay,
  type Track,
} from "@cdj/sim";
import type { BestRun } from "./records";

/** Le fantôme : la rediffusion du meilleur temps, rejouée en même temps que la course (même simulation). */
export interface Ghost {
  race: RaceState;
  player: ReplayPlayer;
  /** État au pas précédent, pour interpoler l'affichage. */
  previous: CarState;
}

/**
 * Fantôme d'un meilleur temps, ou `null` s'il n'y a pas de rediffusion utilisable (absente, d'une autre
 * version de la simulation, d'un autre circuit ou illisible : on ne plante jamais pour un fantôme).
 */
export function loadGhost(track: Track, best: BestRun | null): Ghost | null {
  if (!best?.replay || best.simVersion !== SIM_VERSION) return null;
  try {
    const replay = decodeReplay(best.replay);
    if (replay.trackId !== track.id || replay.simVersion !== SIM_VERSION) return null;
    const race = createRace(track);
    const previous = createCar();
    copyCar(race.car, previous);
    return { race, player: new ReplayPlayer(replay), previous };
  } catch {
    return null;
  }
}

/**
 * Une tentative : la course, l'enregistrement de ses commandes et le fantôme éventuel, avancés ensemble.
 * `params` : réglages de la voiture du joueur (panneau `?tune`) ; le fantôme roule toujours avec ceux par défaut,
 * ceux avec lesquels sa rediffusion a été enregistrée.
 */
export class RunSession {
  readonly race: RaceState;
  /** État de la voiture au pas précédent, pour interpoler l'affichage. */
  readonly previous: CarState = createCar();
  readonly ghost: Ghost | null;
  private readonly recorder = new ReplayRecorder();

  constructor(
    readonly track: Track,
    best: BestRun | null,
    params?: Readonly<CarParams>,
  ) {
    this.race = createRace(track, params);
    copyCar(this.race.car, this.previous);
    this.ghost = loadGhost(track, best);
  }

  /** Avance d'un pas de simulation. La commande appliquée est celle qui est enregistrée. */
  step(input: CarInput): void {
    copyCar(this.race.car, this.previous);
    if (this.race.finishMs < 0) this.recorder.record(input);
    stepRace(this.race, input);
    if (this.ghost) {
      copyCar(this.ghost.race.car, this.ghost.previous);
      stepRace(this.ghost.race, this.ghost.player.next());
    }
  }

  /** Évite d'interpoler à travers une téléportation (reprise au point de contrôle). */
  cutInterpolation(): void {
    copyCar(this.race.car, this.previous);
    if (this.ghost) copyCar(this.ghost.race.car, this.ghost.previous);
  }

  toReplay(): Replay {
    return this.recorder.toReplay(this.track.id);
  }
}
