import {
  BOOST_HALF_LENGTH,
  BOOST_HALF_WIDTH,
  CELL,
  HALF_ROAD,
  NO_GROUND,
  WALL_HEIGHT,
  blockHeight,
  blockSlope,
  canonP,
  canonQ,
  canonVecToWorld,
  cellKey,
  curveCenter,
  dirX,
  dirZ,
  isCurve,
  type Block,
  type Track,
} from "./track";

/** Revêtements. Une seule surface au lot 7 ; terre, glace et herbe arrivent au lot 8. */
export type SurfaceKind = "road";

/** Comportement d'un revêtement, lu sous chaque roue (multiplicateurs : 1 = la route, la référence). */
export interface SurfaceParams {
  /** Adhérence latérale. */
  grip: number;
  /** Motricité et freinage. */
  traction: number;
  /** Résistance au roulement ajoutée (m/s²). */
  rolling: number;
}

export const SURFACES: Readonly<Record<SurfaceKind, Readonly<SurfaceParams>>> = Object.freeze({
  road: Object.freeze({ grip: 1, traction: 1, rolling: 0 }),
});

/** Comportement du revêtement d'un échantillon de sol. */
export function surfaceAt(sample: Surface): Readonly<SurfaceParams> {
  return SURFACES[sample.kind];
}

/** Ce que la voiture « sent » sous elle en un point. */
export interface Surface {
  /** Hauteur du sol, ou `NO_GROUND` s'il n'y a rien (vide). */
  height: number;
  /** Gradient du sol (dh/dx, dh/dz). */
  gx: number;
  gz: number;
  boost: boolean;
  /** Revêtement (voir `surfaceAt`). */
  kind: SurfaceKind;
}

/** Contact avec un rebord : normale (vers l'intérieur de la route) et profondeur d'enfoncement. */
export interface WallHit {
  nx: number;
  nz: number;
  depth: number;
}

export interface World {
  sample(x: number, z: number, out: Surface): void;
  /** Vrai s'il y a pénétration d'un rebord pour un disque de rayon `radius` ; remplit `out`. */
  collide(x: number, z: number, y: number, radius: number, out: WallHit): boolean;
  /** Au-dessous de cette hauteur, la voiture est perdue. */
  readonly voidY: number;
}

export const createSurface = (): Surface => ({ height: 0, gx: 0, gz: 0, boost: false, kind: "road" });
export const createWallHit = (): WallHit => ({ nx: 0, nz: 0, depth: 0 });

/** Sol plat infini, sans rebord (scénario `plat`). */
export const FLAT_WORLD: World = {
  voidY: NO_GROUND,
  sample(_x, _z, out) {
    out.height = 0;
    out.gx = 0;
    out.gz = 0;
    out.boost = false;
  },
  collide() {
    return false;
  },
};

const wv = { x: 0, z: 0 };

/** Le monde d'un circuit : route, pentes, rebords, plaques d'accélération. Hors route, c'est le vide. */
export function trackWorld(track: Track): World {
  const last = track.blocks.length - 1;

  const blockAt = (x: number, z: number): Block | undefined => {
    return track.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  };

  return {
    voidY: track.voidY,

    sample(x, z, out) {
      const b = blockAt(x, z);
      out.gx = 0;
      out.gz = 0;
      out.boost = false;
      if (!b) {
        out.height = NO_GROUND;
        return;
      }
      const u = x - b.cx * CELL;
      const v = z - b.cz * CELL;
      const p = canonP(b.dir, u, v);
      const q = canonQ(b.dir, u, v);

      let onRoad: boolean;
      if (isCurve(b.kind)) {
        const c = curveCenter(b.kind);
        const dp = p - c.cp;
        const r = Math.sqrt(dp * dp + q * q);
        onRoad = q >= 0 && r >= c.r - HALF_ROAD && r <= c.r + HALF_ROAD;
      } else {
        const lat = p - CELL / 2;
        onRoad = lat >= -HALF_ROAD && lat <= HALF_ROAD;
      }
      if (!onRoad) {
        out.height = NO_GROUND;
        return;
      }
      out.height = blockHeight(b, q);
      const slope = blockSlope(b, q);
      out.gx = slope * dirX(b.dir);
      out.gz = slope * dirZ(b.dir);
      out.boost =
        b.kind === "boost" &&
        Math.abs(p - CELL / 2) <= BOOST_HALF_WIDTH &&
        Math.abs(q - CELL / 2) <= BOOST_HALF_LENGTH;
    },

    collide(x, z, y, radius, out) {
      const b = blockAt(x, z);
      if (!b) return false;
      const u = x - b.cx * CELL;
      const v = z - b.cz * CELL;
      const p = canonP(b.dir, u, v);
      const q = canonQ(b.dir, u, v);
      // Au-dessus des rebords, on les survole.
      if (y - blockHeight(b, q) > WALL_HEIGHT) return false;

      let np = 0;
      let nq = 0;
      let depth = 0;
      if (isCurve(b.kind)) {
        const c = curveCenter(b.kind);
        const dp = p - c.cp;
        const r = Math.sqrt(dp * dp + q * q);
        if (r < 1e-6) return false;
        const inner = c.r - HALF_ROAD + radius;
        const outer = c.r + HALF_ROAD - radius;
        if (r < inner) {
          depth = inner - r;
          np = dp / r;
          nq = q / r;
        } else if (r > outer) {
          depth = r - outer;
          np = -dp / r;
          nq = -q / r;
        }
      } else {
        const lat = p - CELL / 2;
        const limit = HALF_ROAD - radius;
        if (lat > limit) {
          depth = lat - limit;
          np = -1;
        } else if (lat < -limit) {
          depth = -limit - lat;
          np = 1;
        }
        // Bouts de piste : on ne sort pas du circuit par le départ ni par derrière l'arrivée.
        if (b.index === 0 && q < radius && radius - q > depth) {
          depth = radius - q;
          np = 0;
          nq = 1;
        } else if (b.index === last && q > CELL - radius && q - (CELL - radius) > depth) {
          depth = q - (CELL - radius);
          np = 0;
          nq = -1;
        }
      }
      if (depth <= 0) return false;
      canonVecToWorld(b.dir, np, nq, wv);
      out.nx = wv.x;
      out.nz = wv.z;
      out.depth = depth;
      return true;
    },
  };
}
