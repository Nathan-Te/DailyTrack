// Moteur A derrière l'interface commune (lab/interface.ts).
import type { Engine, PieceSpec, Snapshot, World, WorldConfig } from "../interface";
import { pieceBoxes } from "../pieces";
import { type TuningA, DEFAULT_TUNING_A, addPieceA, awakeA, cloneWorldA, createWorldA, snapshotA, stepA, type WorldA } from "./monde";
import { RAD_PER_BRAD, TURN } from "./trig";

export interface HandleA extends World {
  readonly w: WorldA;
}

function handle(w: WorldA): HandleA {
  return {
    w,
    get tick() {
      return w.tick;
    },
  };
}

export function moteurA(tuning: TuningA = DEFAULT_TUNING_A): Engine {
  return {
    name: "A",
    label: "A — moteur maison (entiers, Q16)",
    createWorld: (config: WorldConfig) => handle(createWorldA(config, tuning)),
    addPiece: (world: World, spec: PieceSpec) => addPieceA((world as HandleA).w, pieceBoxes(spec.kind, spec.rot), spec.x8, spec.y8, spec.vx8, spec.vy8),
    step: (world: World) => stepA((world as HandleA).w),
    snapshot: (world: World): Snapshot => {
      const w = (world as HandleA).w;
      return {
        tick: w.tick,
        pieces: snapshotA(w).map((p, id) => ({ id, x: p.x, y: p.y, angle: (p.angle > TURN / 2 ? p.angle - TURN : p.angle) * RAD_PER_BRAD, asleep: p.asleep, lost: p.lost })),
      };
    },
    clone: (world: World) => handle(cloneWorldA((world as HandleA).w)),
    awake: (world: World) => awakeA((world as HandleA).w),
    dispose: () => {},
  };
}
