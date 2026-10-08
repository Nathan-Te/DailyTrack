import {
  BOOST_HALF_LENGTH,
  CELL,
  NO_GROUND,
  WALL_HEIGHT,
  bankAt,
  blockHalfWidth,
  blockHalfWidthSlope,
  blockPadHalfWidth,
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
  type BankSample,
  type Block,
  type SurfaceKind,
  type Track,
} from "./track";
import { cuveHeight, shellAt, type ShellHit } from "./cuve";

export type { SurfaceKind } from "./track";
export type { ShellHit } from "./cuve";
export { createShellHit } from "./cuve";

/** Le moteur est coupé par une bande de cette demi-longueur (m) en travers de toute la route. */
export const CUT_HALF_LENGTH = 2;

/** Comportement d'un revêtement, lu sous chaque roue (multiplicateurs : 1 = la route, la référence). */
export interface SurfaceParams {
  /** Adhérence latérale. */
  grip: number;
  /** Motricité et freinage. */
  traction: number;
  /** Résistance au roulement ajoutée (m/s²). */
  rolling: number;
  /**
   * Part du comportement « glace » (0 = aucun, 1 = plein) : pointe plus haute, roue libre qui glisse peu, adhérence
   * rendue en roue libre et réalignement de la vitesse sur le cap. Les valeurs de ce comportement sont les clés
   * `ice*` de `CarParams` (réglables dans le panneau `?debug&tune`).
   */
  slick: number;
}

/**
 * Les revêtements. Nouveau revêtement ou nouvelle valeur = `SIM_VERSION` +1.
 * - route : la référence ;
 * - terre : l'arrière glisse facilement et se rattrape, accélération un peu molle ;
 * - glace (lot 16) : grip très faible à l'accélérateur et au frein, motricité faible, aucun roulement : plus rapide en
 *   ligne droite ; en roue libre l'adhérence revient et la vitesse se réaligne sur le cap (`slick`, clés `ice*`) ;
 * - herbe : ralentit nettement (roulement 7 m/s²) et glisse.
 */
export const SURFACES: Readonly<Record<SurfaceKind, Readonly<SurfaceParams>>> = Object.freeze({
  road: Object.freeze({ grip: 1, traction: 1, rolling: 0, slick: 0 }),
  dirt: Object.freeze({ grip: 0.7, traction: 0.85, rolling: 1.5, slick: 0 }),
  ice: Object.freeze({ grip: 0.3, traction: 0.4, rolling: 0, slick: 1 }),
  grass: Object.freeze({ grip: 0.5, traction: 0.55, rolling: 7, slick: 0 }),
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
  /** Plaque de super turbo / bande de moteur coupé sous ce point. */
  turbo: boolean;
  cut: boolean;
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
  /**
   * Cuve (lot 18) : si (x, z) est dans un bloc de cuve, remplit `out` (distance signée à la paroi, normale, direction d'avance) pour
   * un point à la hauteur `y` et renvoie vrai. Faux partout ailleurs : la voiture suit alors le modèle ordinaire (ressorts sur `sample`).
   */
  shell?(x: number, z: number, y: number, out: ShellHit): boolean;
  /** Au-dessous de cette hauteur, la voiture est perdue. */
  readonly voidY: number;
}

export const createSurface = (): Surface => ({ height: 0, gx: 0, gz: 0, boost: false, turbo: false, cut: false, kind: "road" });
export const createWallHit = (): WallHit => ({ nx: 0, nz: 0, depth: 0 });

/** Sol plat infini, sans rebord (scénario `plat`). */
export const FLAT_WORLD: World = {
  voidY: NO_GROUND,
  sample(_x, _z, out) {
    out.height = 0;
    out.gx = 0;
    out.gz = 0;
    out.boost = false;
    out.turbo = false;
    out.cut = false;
    out.kind = "road";
  },
  collide() {
    return false;
  },
};

const wv = { x: 0, z: 0 };
const bank: BankSample = { h: 0, gp: 0, gq: 0 };

/** Le monde d'un circuit : route, pentes, rebords, plaques d'accélération. Hors route, c'est le vide. */
export function trackWorld(track: Track): World {
  const last = track.blocks.length - 1;

  const blockAt = (x: number, z: number): Block | undefined => {
    return track.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  };

  const hasCuve = track.blocks.some((b) => b.cuve > 0);
  const world: World = {
    voidY: track.voidY,
    // Toujours présent (même forme d'objet pour tous les circuits : les appels `world.sample` restent monomorphes), vide sans cuve.
    shell: undefined,

    sample(x, z, out) {
      const b = blockAt(x, z);
      out.gx = 0;
      out.gz = 0;
      out.boost = false;
      out.turbo = false;
      out.cut = false;
      if (!b) {
        out.height = NO_GROUND;
        return;
      }
      const u = x - b.cx * CELL;
      const v = z - b.cz * CELL;
      const p = canonP(b.dir, u, v);
      const q = canonQ(b.dir, u, v);

      let onRoad: boolean;
      let cuveH = 0;
      if (b.cuve) {
        // Cuve : un sol approché (paroi tronquée à ≈ 80°) pour les lecteurs de hauteur ; la voiture, elle, suit `shell`.
        cuveH = cuveHeight(b, p, q);
        onRoad = cuveH === cuveH; // pas NaN
      } else if (b.kind === "gap") {
        onRoad = false; // le vide d'un saut : rien sous la voiture
      } else if (isCurve(b.kind)) {
        const c = curveCenter(b.kind);
        const dp = p - c.cp;
        const r = Math.sqrt(dp * dp + q * q);
        const hw = b.w0 / 2; // un virage garde sa largeur
        onRoad = q >= 0 && r >= c.r - hw && r <= c.r + hw;
      } else {
        const lat = p - CELL / 2;
        const hw = blockHalfWidth(b, q);
        onRoad = lat >= -hw && lat <= hw;
      }
      if (!onRoad) {
        out.height = NO_GROUND;
        return;
      }
      out.kind = b.surface;
      out.height = blockHeight(b, q) + cuveH;
      const slope = blockSlope(b, q);
      out.gx = slope * dirX(b.dir);
      out.gz = slope * dirZ(b.dir);
      if (b.banked) {
        // Virage relevé : la hauteur monte vers l'extérieur ; le gradient (p, q) devient un gradient du monde.
        bankAt(b, p, q, bank);
        out.height += bank.h;
        canonVecToWorld(b.dir, bank.gp, bank.gq, wv);
        out.gx += wv.x;
        out.gz += wv.z;
      }
      // Les plaques font la moitié de la largeur de la route (3,5 m de demi-largeur sur 14 m, comme avant le lot 12).
      const onPad = Math.abs(p - CELL / 2) <= blockPadHalfWidth(b) && Math.abs(q - CELL / 2) <= BOOST_HALF_LENGTH;
      out.boost = b.kind === "boost" && onPad;
      out.turbo = b.kind === "turbo" && onPad;
      out.cut = b.kind === "cut" && Math.abs(q - CELL / 2) <= CUT_HALF_LENGTH;
    },

    collide(x, z, y, radius, out) {
      const b = blockAt(x, z);
      if (!b || b.kind === "gap" || b.cuve) return false; // une cuve a ses parois (`shell`)
      const u = x - b.cx * CELL;
      const v = z - b.cz * CELL;
      const p = canonP(b.dir, u, v);
      const q = canonQ(b.dir, u, v);
      // Au-dessus des rebords, on les survole (en virage relevé, le rebord extérieur est plus haut).
      let floor = blockHeight(b, q);
      if (b.banked) {
        bankAt(b, p, q, bank);
        floor += bank.h;
      }
      if (y - floor > WALL_HEIGHT) return false;

      let np = 0;
      let nq = 0;
      let depth = 0;
      if (b.open) {
        // Section sans rebords : seuls les bouts du circuit arrêtent la voiture (traités plus bas), pas les côtés.
      } else if (isCurve(b.kind)) {
        const c = curveCenter(b.kind);
        const dp = p - c.cp;
        const r = Math.sqrt(dp * dp + q * q);
        if (r < 1e-6) return false;
        const hw = b.w0 / 2;
        const inner = c.r - hw + radius;
        const outer = c.r + hw - radius;
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
        const hw = blockHalfWidth(b, q);
        const slope = blockHalfWidthSlope(b, q);
        if (slope === 0) {
          const limit = hw - radius;
          if (lat > limit) {
            depth = lat - limit;
            np = -1;
          } else if (lat < -limit) {
            depth = -limit - lat;
            np = 1;
          }
        } else {
          // Bloc de transition : les rebords sont inclinés (pente `slope`) ; distance du centre au rebord = écart / √(1 + pente²),
          // normale inclinée du même angle (vers l'intérieur : (−1, pente) à gauche, (+1, pente) à droite).
          const k = Math.sqrt(1 + slope * slope);
          const side = lat >= 0 ? lat : -lat;
          const dist = (hw - side) / k;
          if (dist < radius) {
            depth = radius - dist;
            np = (lat >= 0 ? -1 : 1) / k;
            nq = slope / k;
          }
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
  // Cuves (lot 18) : seul un circuit qui en a une répond à `shell` ; les autres suivent exactement le chemin d'avant (aucun coût de plus).
  if (hasCuve) {
    world.shell = (x, z, y, out) => {
      const b = blockAt(x, z);
      if (!b || !b.cuve) return false;
      const u = x - b.cx * CELL;
      const v = z - b.cz * CELL;
      shellAt(b, canonP(b.dir, u, v), canonQ(b.dir, u, v), y - b.y0, out);
      return true;
    };
  }
  return world;
}
