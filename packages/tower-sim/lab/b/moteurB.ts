// Moteur B — Rapier 2D, version DÉTERMINISTE (`@dimforge/rapier2d-deterministic-compat`, version figée dans package.json : 0.21.0).
// « -compat » : le WebAssembly est inclus dans le JavaScript en base64, donc le même code se charge sur Node et dans les navigateurs, sans réglage de l'outil de construction.
// C'est la seule dépendance externe du lab (docs/tower/consignes.md) : le test de pureté ne scanne pas ce dossier.
import RAPIER from "@dimforge/rapier2d-deterministic-compat";
import type { Engine, PieceSpec, Snapshot, World, WorldConfig } from "../interface";
import { LOST_Y } from "../interface";
import { pieceBoxes } from "../pieces";

type RapierModule = typeof RAPIER;

interface Piece {
  body: RAPIER.RigidBody | null;
  last: { x: number; y: number; angle: number };
  lost: boolean;
}

export interface HandleB extends World {
  R: RapierModule;
  world: RAPIER.World;
  config: WorldConfig;
  pieces: Piece[];
  ticks: number;
}

let ready: Promise<RapierModule> | null = null;

/** Charge le WebAssembly (une fois) ; rend le moteur B. */
export async function chargerMoteurB(): Promise<Engine> {
  ready ??= RAPIER.init().then(() => RAPIER);
  const R = await ready;
  return moteurB(R);
}

function attach(R: RapierModule, world: RAPIER.World, config: WorldConfig, pieces: Piece[], ticks: number): HandleB {
  const h: HandleB = {
    R, world, config, pieces, ticks,
    get tick() {
      return h.ticks;
    },
  };
  return h;
}

function moteurB(R: RapierModule): Engine {
  const friction = (c: WorldConfig): number => c.frictionPct / 100;
  const restitution = (c: WorldConfig): number => c.restitutionPct / 100;
  return {
    name: "B",
    label: "B — Rapier 2D déterministe (WebAssembly)",
    createWorld(config) {
      const world = new R.World({ x: 0, y: -config.gravityCm / 100 });
      world.timestep = 1 / config.hz;
      world.integrationParameters.numSolverIterations = config.iterations;
      world.createCollider(
        R.ColliderDesc.cuboid(config.platformHalf8 / 8, 0.5).setTranslation(0, -0.5).setFriction(friction(config)).setRestitution(restitution(config)),
      );
      return attach(R, world, config, [], 0);
    },
    addPiece(w, spec: PieceSpec) {
      const h = w as HandleB;
      const body = h.world.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(spec.x8 / 8, spec.y8 / 8).setLinvel(spec.vx8 / 8, spec.vy8 / 8).setCanSleep(h.config.sleep),
      );
      for (const b of pieceBoxes(spec.kind, spec.rot)) {
        h.world.createCollider(
          R.ColliderDesc.cuboid(b.hw / 8, b.hh / 8).setTranslation(b.cx / 8, b.cy / 8).setDensity(1).setFriction(friction(h.config)).setRestitution(restitution(h.config)),
          body,
        );
      }
      h.pieces.push({ body, last: { x: spec.x8 / 8, y: spec.y8 / 8, angle: 0 }, lost: false });
      return h.pieces.length - 1;
    },
    step(w) {
      const h = w as HandleB;
      h.world.step();
      h.ticks++;
      for (const p of h.pieces) {
        if (p.lost || !p.body) continue;
        const t = p.body.translation();
        p.last = { x: t.x, y: t.y, angle: p.body.rotation() };
        if (t.y < LOST_Y) {
          p.lost = true;
          h.world.removeRigidBody(p.body);
          p.body = null;
        }
      }
    },
    snapshot(w): Snapshot {
      const h = w as HandleB;
      return {
        tick: h.ticks,
        pieces: h.pieces.map((p, id) => ({
          id,
          x: p.body && !p.lost ? p.body.translation().x : p.last.x,
          y: p.body && !p.lost ? p.body.translation().y : p.last.y,
          angle: p.body && !p.lost ? p.body.rotation() : p.last.angle,
          asleep: p.body ? p.body.isSleeping() : true,
          lost: p.lost,
        })),
      };
    },
    clone(w) {
      // Instantané binaire de tout le monde Rapier, puis on retrouve les corps par leur ordre de création (handles conservés).
      const h = w as HandleB;
      const world = R.World.restoreSnapshot(h.world.takeSnapshot());
      const bodies: RAPIER.RigidBody[] = [];
      world.forEachRigidBody((b) => bodies.push(b));
      const byHandle = new Map(bodies.map((b) => [b.handle, b]));
      const pieces = h.pieces.map((p) => ({ body: p.body ? byHandle.get(p.body.handle) ?? null : null, last: { ...p.last }, lost: p.lost }));
      return attach(R, world, h.config, pieces, h.ticks);
    },
    awake(w) {
      return (w as HandleB).pieces.filter((p) => p.body && !p.body.isSleeping()).length;
    },
    dispose(w) {
      (w as HandleB).world.free();
    },
  };
}
