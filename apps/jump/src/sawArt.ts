import { BufferGeometry, Group, Line, LineDashedMaterial, Mesh, MeshBasicMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, Vector3 } from "three";
import { UNITS_PER_TILE, type Level } from "@cdj/jump-sim";

// Le dessin des scies (lots 2 et 9), **affichage seul** : un disque denté avec un moyeu et un cerne sombre, qui tourne ; le trajet d'une scie
// mobile en pointillés discrets.
//   - Lot 17 : pendant le carnage, les scies **mobiles** (celles qui suivent l'horloge) sont **estompées** (`setFade`) pour qu'on lise les morts
//     avant les dangers, dont la phase ne correspond de toute façon pas à celle des autres vies. Les scies fixes ne changent pas. Une scie
//     mobile est faite de trois pièces qui **ne se recouvrent pas** (cerne en anneau, disque troué du moyeu, moyeu) : estompées, elles ne
//     s'additionnent pas (le cerne ne transparaît pas sous le disque).

const T = UNITS_PER_TILE;
/** Épaisseur du cerne sombre autour de la scie (tuiles), et opacité du trajet d'une scie mobile. */
const RIM = 0.07;
const PATH_OPACITY = 0.45;

/** Les sommets du disque denté (sans répéter le premier) : `teeth` dents, corps de rayon `body`, pointes à `tip` (tuiles). */
function sawPoints(body: number, tip: number, teeth: number): [number, number][] {
  const n = teeth * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? body : tip;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** Trace le polygone dans `path` (fermé) et le rend. */
function polygon<P extends Path>(pts: readonly [number, number][], path: P): P {
  pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

/** Disque denté plein. */
function sawShape(body: number, tip: number, teeth: number): ShapeGeometry {
  return new ShapeGeometry(polygon(sawPoints(body, tip, teeth), new Shape()));
}

/** Disque denté troué d'un carré (le moyeu) ou d'un autre disque denté (le cerne en anneau). */
function sawWithHole(outer: readonly [number, number][], hole: readonly [number, number][]): ShapeGeometry {
  const shape = polygon(outer, new Shape());
  shape.holes.push(polygon(hole, new Path()));
  return new ShapeGeometry(shape);
}

export interface SawArt {
  /** Les scies, dans l'ordre de `level.saws` : leur groupe (position) et leur disque (rotation). */
  readonly saws: readonly { g: Group; disc: Mesh }[];
  /** Estompe les scies mobiles et leur trajet (1 : normal, sans transparence). Les scies fixes ne changent jamais. */
  setFade(opacity: number): void;
  /** L'opacité dessinée de chaque scie (1 pour une scie fixe). */
  readonly opacity: readonly number[];
}

/** Les scies d'un niveau et le trajet des mobiles (`colors.body` : le corps ; `colors.outline` : le moyeu et le cerne). */
export function createSawArt(world: Group, level: Level, colors: { body: number; outline: number }): SawArt {
  const fixed = [new MeshBasicMaterial({ color: colors.body }), new MeshBasicMaterial({ color: colors.outline }), new MeshBasicMaterial({ color: colors.outline })] as const;
  // Les scies mobiles ont leurs matériaux : seules elles s'estompent.
  const moving = [new MeshBasicMaterial({ color: colors.body }), new MeshBasicMaterial({ color: colors.outline }), new MeshBasicMaterial({ color: colors.outline })] as const;
  const opacity: number[] = [];
  const saws = level.saws.map((saw) => {
    const body = saw.radius / T;
    const tip = body + Math.min(0.14, body * 0.25);
    const g = new Group();
    const teeth = Math.max(8, Math.round(body * 18));
    const mobile = saw.cycle !== 0;
    const [sawMat, hubMat, rimMat] = mobile ? moving : fixed;
    const hubSize = body * 0.45;
    let disc: Mesh;
    let rim: Mesh;
    if (mobile) {
      const half = hubSize / 2;
      const square: [number, number][] = [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
      ];
      disc = new Mesh(sawWithHole(sawPoints(body, tip, teeth), square), sawMat);
      rim = new Mesh(sawWithHole(sawPoints(body + RIM, tip + RIM, teeth), sawPoints(body, tip, teeth)), rimMat);
    } else {
      disc = new Mesh(sawShape(body, tip, teeth), sawMat);
      // Lot 9 : cerne sombre derrière la scie (dents comprises), comme les pics.
      rim = new Mesh(sawShape(body + RIM, tip + RIM, teeth), rimMat);
    }
    const hub = new Mesh(new PlaneGeometry(hubSize, hubSize), hubMat);
    hub.position.z = 0.01;
    disc.add(hub);
    rim.position.z = -0.01;
    disc.add(rim);
    g.add(disc);
    g.position.z = 0.15;
    world.add(g);
    opacity.push(1);
    return { g, disc };
  });
  const pathMat = new LineDashedMaterial({ color: colors.body, dashSize: 0.25, gapSize: 0.3, transparent: true, opacity: PATH_OPACITY });
  for (const saw of level.saws) {
    if (saw.cycle === 0) continue;
    const pts = saw.points.map((p) => new Vector3(p.x / T, -p.y / T, 0.01));
    if (saw.mode === "boucle") pts.push(pts[0]!.clone());
    const line = new Line(new BufferGeometry().setFromPoints(pts), pathMat);
    line.computeLineDistances();
    world.add(line);
  }
  let fade = 1;
  return {
    saws,
    opacity,
    setFade(value) {
      const v = Math.max(0, Math.min(1, value));
      if (v === fade) return;
      fade = v;
      for (const m of moving) {
        // Opaque et sans mélange tant qu'on n'estompe pas : le dessin d'une partie ordinaire n'a pas changé.
        m.transparent = v < 1;
        m.opacity = v;
      }
      pathMat.opacity = PATH_OPACITY * v;
      level.saws.forEach((saw, k) => (opacity[k] = saw.cycle === 0 ? 1 : v));
    },
  };
}
