import { BufferGeometry, Group, Line, LineDashedMaterial, Mesh, MeshBasicMaterial, Path, Shape, ShapeGeometry, Vector3 } from "three";
import { UNITS_PER_TILE, platformAt, sectionClock, type AttemptState, type Level, type Platform } from "@cdj/jump-sim";
import { platformLook } from "./announce";

// Le dessin des plateformes mobiles (lot 20), **affichage seul** : une dalle crème cernée d'encre (`PLATFORM_LOOK`, couleurs neutres de la charte « Cartouches » :
// jamais le rouge des dangers, jamais le jaune du personnage), qui ne ressemble à aucun bloc fixe (eux sont des tuiles de thème, sans cerne ni chevrons) ; sur
// sa face, un chevron par tuile qui montre le sens du déplacement et **s'efface avec la vitesse** (le ralenti de la table de la simulation : le signe annonce le
// demi-tour, continu, sans clignotement). Le trajet : un pointillé neutre (crème et encre en alternance, lisible sur n'importe quel fond) entre les deux
// extrémités, et l'empreinte de la plateforme à chacune. Rien n'est rouge.
//   - Lot 17 (principe) : pendant le carnage, une plateforme est un élément à horloge, donc **estompée** (`setFade`) comme les scies mobiles. Ses pièces (cerne en
//     anneau, face trouée des chevrons, chevrons) **ne se recouvrent pas** : estompées, elles ne s'additionnent pas ; opaques et sans mélange tant qu'on n'estompe pas.

const T = UNITS_PER_TILE;

/** Couleurs de la dalle : `--dj-papier` (face) et `--dj-encre` (cerne et chevrons), les valeurs de la charte (comme le repère de la voie lente). */
export const PLATFORM_LOOK = { face: 0xfff6e0, edge: 0x2a1e16 } as const;
/** Épaisseur visible de la dalle (tuiles, sous son dessus) et du cerne ; opacité du trajet. */
export const SLAB = 0.42;
const RIM = 0.07;
const PATH_OPACITY = 0.6;

/** Mélange de deux couleurs (`t` : 0 la première, 1 la seconde). */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function polygon<P extends Path>(pts: readonly [number, number][], path: P): P {
  pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

/** Un chevron « › » centré (pointe à droite), de 0,26 de large. */
const CHEVRON: [number, number][] = [
  [-0.09, -0.11],
  [-0.01, -0.11],
  [0.11, 0],
  [-0.01, 0.11],
  [-0.09, 0.11],
  [0.03, 0],
];

export interface PlatformStats {
  /** Pour chaque plateforme (ordre de `level.platforms`) : sa vitesse en part de sa pointe (0 à 1) et son sens, tels que dessinés. */
  speed: number[];
  dir: number[];
  /** Où elle est dessinée (coin haut-gauche, tuiles, y vers le bas comme la simulation). */
  x: number[];
  y: number[];
  /** L'opacité dessinée (1 : normale). */
  opacity: number;
}

export interface PlatformArt {
  readonly stats: PlatformStats;
  /** Pose les plateformes dans l'état `state` (interpolé depuis `prev` à `alpha`) ; `fade` : l'estompage du carnage (1 : aucun). */
  update(prev: Readonly<AttemptState>, state: Readonly<AttemptState>, alpha: number, fade: number): void;
}

/** Les plateformes d'un niveau et leur trajet ; `null` si le niveau n'en a pas. */
export function createPlatformArt(world: Group, level: Level): PlatformArt | null {
  if (level.platforms.length === 0) return null;
  const faceMat = new MeshBasicMaterial({ color: PLATFORM_LOOK.face });
  const rimMat = new MeshBasicMaterial({ color: PLATFORM_LOOK.edge });
  // Un matériau de chevron par plateforme : sa couleur va de la face (à l'arrêt) à l'encre (à pleine vitesse).
  const mats = [faceMat, rimMat];
  const stats: PlatformStats = { speed: level.platforms.map(() => 0), dir: level.platforms.map(() => 0), x: level.platforms.map(() => 0), y: level.platforms.map(() => 0), opacity: 1 };
  const groups = level.platforms.map((p) => {
    const w = p.width;
    const g = new Group();
    const outer = rect(0, 0, w, -SLAB);
    const inner = rect(RIM, -RIM, w - RIM, -SLAB + RIM);
    // Le cerne : un anneau ; la face : le rectangle intérieur troué d'un chevron par tuile ; les chevrons : exactement ces trous.
    const rimShape = polygon(outer, new Shape());
    rimShape.holes.push(polygon(inner, new Path()));
    const faceShape = polygon(inner, new Shape());
    const chevrons: Mesh[] = [];
    const chevronMat = new MeshBasicMaterial({ color: PLATFORM_LOOK.face });
    mats.push(chevronMat);
    for (let k = 0; k < w; k++) {
      const cx = k + 0.5;
      const cy = -SLAB / 2;
      const hole = CHEVRON.map(([x, y]) => [cx + x, cy + y] as [number, number]);
      faceShape.holes.push(polygon(hole, new Path()));
      const chev = new Mesh(new ShapeGeometry(polygon(CHEVRON, new Shape())), chevronMat);
      chev.position.set(cx, cy, 0.002);
      chevrons.push(chev);
    }
    const rim = new Mesh(new ShapeGeometry(rimShape), rimMat);
    const face = new Mesh(new ShapeGeometry(faceShape), faceMat);
    face.position.z = 0.001;
    g.add(rim, face, ...chevrons);
    g.position.z = 0.12;
    g.userData.chevrons = chevrons;
    g.userData.chevronMat = chevronMat;
    world.add(g);
    return g;
  });
  // Le trajet : deux pointillés qui alternent (crème, encre), de l'empreinte d'une extrémité à l'autre, et l'empreinte de la dalle à chaque extrémité.
  const dash = 0.22;
  const pathMats = [new LineDashedMaterial({ color: PLATFORM_LOOK.face, dashSize: dash, gapSize: dash, transparent: true, opacity: PATH_OPACITY }), new LineDashedMaterial({ color: PLATFORM_LOOK.edge, dashSize: dash, gapSize: dash, transparent: true, opacity: PATH_OPACITY })];
  const dashed = (pts: Vector3[], mat: LineDashedMaterial, shift: number) => {
    // Le second pointillé est décalé d'un pointillé sur le trajet pour que crème et encre alternent.
    const line = new Line(new BufferGeometry().setFromPoints(pts), mat);
    line.computeLineDistances();
    if (shift !== 0) {
      const dist = line.geometry.getAttribute("lineDistance");
      for (let i = 0; i < dist.count; i++) dist.setX(i, dist.getX(i) + shift);
    }
    world.add(line);
  };
  for (const p of level.platforms) {
    const at = (cell: Platform["a"]) => ({ x: cell.col, y: cell.row });
    const a = at(p.a);
    const b = at(p.b);
    // Le centre de la dalle à chaque extrémité (milieu de sa largeur, milieu de son épaisseur visible).
    const ca = new Vector3(a.x + p.width / 2, -a.y - SLAB / 2, 0.011);
    const cb = new Vector3(b.x + p.width / 2, -b.y - SLAB / 2, 0.011);
    dashed([ca, cb], pathMats[0]!, 0);
    dashed([ca, cb], pathMats[1]!, dash);
    // L'empreinte de la dalle à chaque extrémité (un rectangle pointillé).
    for (const e of [a, b]) {
      const loop = [new Vector3(e.x, -e.y, 0.011), new Vector3(e.x + p.width, -e.y, 0.011), new Vector3(e.x + p.width, -e.y - SLAB, 0.011), new Vector3(e.x, -e.y - SLAB, 0.011), new Vector3(e.x, -e.y, 0.011)];
      dashed(loop, pathMats[0]!, 0);
      dashed(loop, pathMats[1]!, dash);
    }
  }
  let fade = 1;
  const lastDir: number[] = level.platforms.map(() => 1);
  return {
    stats,
    update(prev, state, alpha, nextFade) {
      const v = Math.max(0, Math.min(1, nextFade));
      if (v !== fade) {
        fade = v;
        for (const m of [...mats, ...pathMats]) {
          // Opaque et sans mélange tant qu'on n'estompe pas : le dessin d'une partie ordinaire est celui de toujours.
          m.transparent = v < 1 || pathMats.includes(m as LineDashedMaterial);
          m.opacity = pathMats.includes(m as LineDashedMaterial) ? PATH_OPACITY * v : v;
        }
        stats.opacity = v;
      }
      level.platforms.forEach((p, i) => {
        const pa = platformAt(level, prev.sections, prev.time, i);
        const pb = platformAt(level, state.sections, state.time, i);
        // Pas d'interpolation à travers un saut de position (réapparition d'une section en v3).
        const far = Math.abs(pb.x - pa.x) + Math.abs(pb.y - pa.y) > T;
        const x = (far ? pb.x : pa.x + (pb.x - pa.x) * alpha) / T;
        const y = (far ? pb.y : pa.y + (pb.y - pa.y) * alpha) / T;
        const g = groups[i]!;
        g.position.x = x;
        g.position.y = -y;
        stats.x[i] = x;
        stats.y[i] = y;
        const look = platformLook(p, sectionClock(level, state.sections, state.time, p.section));
        if (look.dir !== 0) lastDir[i] = look.dir;
        stats.speed[i] = look.speed;
        stats.dir[i] = lastDir[i]!;
        // Le chevron : sens du déplacement (droite/gauche, bas/haut) ; sa couleur va de la face (à l'arrêt) à l'encre (à pleine vitesse).
        const rot = p.axis === "h" ? (lastDir[i]! > 0 ? 0 : Math.PI) : lastDir[i]! > 0 ? -Math.PI / 2 : Math.PI / 2;
        for (const c of g.userData.chevrons as Mesh[]) c.rotation.z = rot;
        (g.userData.chevronMat as MeshBasicMaterial).color.setHex(mix(PLATFORM_LOOK.face, PLATFORM_LOOK.edge, look.speed));
      });
    },
  };
}
