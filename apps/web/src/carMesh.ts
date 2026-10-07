import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { AXLE_FRONT, AXLE_REAR, HALF_TRACK } from "@cdj/sim";

// Voiture low-poly (lot 9), construite en code, **originale** : un coupé de rallye-raid trapu, carrosserie orange et
// crème à bandeau sombre, nez en coin, bulle de toit en pyramide tronquée, aileron sur deux jambes, quatre roues
// séparées (jantes à rayons). Aucun modèle ni aucune forme de véhicule existant n'a été repris.
// Repère : orienté vers +z (cap 0), origine au sol, y vers le haut, x vers la gauche (comme `HALF_TRACK`).

type V3 = [number, number, number];

/** Rayon des roues (m) : le centre d'une roue au repos est à cette hauteur. */
export const WHEEL_RADIUS = 0.38;
/** Débattement des suspensions (m) : compression et détente autour du repos. */
export const TRAVEL_UP = 0.15;
export const TRAVEL_DOWN = 0.22;

class Mesh3 {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  private static readonly rgb = (hex: number): V3 => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  tri(a: V3, b: V3, c: V3, color: number) {
    const [r, g, bl] = Mesh3.rgb(color);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(r, g, bl);
    }
  }
  quad(a: V3, b: V3, c: V3, d: V3, color: number) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }
  /** Hexaèdre quelconque : 4 sommets du bas (arrière gauche, arrière droit, avant droit, avant gauche), puis 4 du haut. */
  hexa(v: V3[], colors: { top: number; side: number; front?: number; back?: number; bottom?: number }) {
    const [a, b, c, d, e, f, g, h] = v as [V3, V3, V3, V3, V3, V3, V3, V3];
    this.quad(e, f, g, h, colors.top);
    this.quad(a, e, h, d, colors.side); // gauche
    this.quad(b, c, g, f, colors.side); // droite
    this.quad(d, h, g, c, colors.front ?? colors.side);
    this.quad(a, b, f, e, colors.back ?? colors.side);
    this.quad(a, d, c, b, colors.bottom ?? 0x111111);
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Boîte tronc de pyramide : `w0` × `z0..z1` en bas à `y0`, `w1` × `t0..t1` en haut à `y1` (z de l'arrière vers l'avant). */
function frustum(y0: number, w0: number, z0: number, z1: number, y1: number, w1: number, t0: number, t1: number): V3[] {
  return [
    [w0, y0, z0], [-w0, y0, z0], [-w0, y0, z1], [w0, y0, z1],
    [w1, y1, t0], [-w1, y1, t0], [-w1, y1, t1], [w1, y1, t1],
  ];
}

export interface CarLook {
  body: number;
  trim: number;
  glass: number;
  stripe: number;
}
const LOOK: CarLook = { body: 0xff6a1f, trim: 0x20232e, glass: 0x1b2a3a, stripe: 0xf6ecd2 };
const GHOST_LOOK: CarLook = { body: 0x57b4ff, trim: 0x2a4f7a, glass: 0x2a4f7a, stripe: 0xcfe9ff };

export interface CarModel {
  group: Group;
  /** Place les roues, les fait tourner et braquer, allume les feux stop. */
  update(s: WheelPose): void;
}

export interface WheelPose {
  /** Vitesse le long du cap (m/s) : la rotation des roues. */
  forward: number;
  /** Angle de braquage des roues avant (rad, positif = à gauche). */
  steerAngle: number;
  /** Frein actif : feux stop allumés. */
  braking: boolean;
  /** Hauteur voulue du centre de chaque roue au-dessus du plan de la caisse, relativement au repos (m), dans l'ordre
   *  avant gauche, avant droit, arrière gauche, arrière droit : positif = la roue descend (détente). */
  droop: readonly [number, number, number, number];
  /** Temps écoulé (s). */
  dt: number;
}

/** Voiture low-poly orientée vers +z. `ghost` : version bleue translucide (teinte froide). */
export function createCarMesh(ghost = false): CarModel {
  const look = ghost ? GHOST_LOOK : LOOK;
  const m = new Mesh3();
  const L = HALF_TRACK + 0.1; // demi-largeur de caisse
  const zr = -AXLE_REAR - 0.75;
  const zf = AXLE_FRONT + 0.85;
  // Caisse basse (bas de caisse sombre, flancs orange) et nez en coin.
  m.hexa(frustum(0.3, L, zr, zf - 0.7, 0.78, L - 0.04, zr + 0.05, zf - 0.75), { top: look.body, side: look.body, front: look.body, back: look.trim, bottom: look.trim });
  m.hexa(frustum(0.3, L, zf - 0.7, zf, 0.62, L - 0.1, zf - 0.7, zf - 0.05), { top: look.body, side: look.body, front: look.trim, bottom: look.trim });
  // Bandeau crème sur les flancs (deux plaquettes fines, juste hors de la caisse).
  for (const s of [-1, 1]) {
    const x = s * (L + 0.005);
    m.quad([x, 0.5, zr + 0.4], [x, 0.5, zf - 0.9], [x, 0.62, zf - 0.9], [x, 0.62, zr + 0.4], look.stripe);
  }
  // Bulle de toit : pyramide tronquée, vitres sombres, toit de la couleur de la caisse.
  m.hexa(frustum(0.78, L - 0.12, -0.95, 0.85, 1.28, L - 0.45, -0.6, 0.15), { top: look.body, side: look.glass, front: look.glass, back: look.glass, bottom: look.trim });
  // Capot : prise d'air.
  m.hexa(frustum(0.74, 0.35, 0.95, 1.55, 0.82, 0.3, 1.0, 1.5), { top: look.trim, side: look.trim });
  // Aileron : deux jambes et un plan.
  for (const s of [-1, 1]) m.hexa(frustum(0.74, 0.04, zr + 0.2, zr + 0.3, 1.2, 0.04, zr + 0.2, zr + 0.3).map(([x, y, z]) => [x + s * 0.55, y, z] as V3), { top: look.trim, side: look.trim });
  m.hexa(frustum(1.2, L + 0.05, zr - 0.05, zr + 0.55, 1.26, L + 0.05, zr - 0.05, zr + 0.55), { top: look.stripe, side: look.trim });
  // Phares (avant) : toujours allumés, légèrement émissifs.
  const lights = new Mesh3();
  for (const s of [-1, 1]) lights.quad([s * 0.7, 0.55, zf - 0.04], [s * 0.35, 0.55, zf - 0.04], [s * 0.35, 0.65, zf - 0.04], [s * 0.7, 0.65, zf - 0.04], 0xfff3b0);

  const bodyMat = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    ...(ghost ? { transparent: true, opacity: 0.42, depthWrite: false } : {}),
  });
  const group = new Group();
  group.add(new Mesh(m.geometry(), bodyMat));
  group.add(new Mesh(lights.geometry(), new MeshBasicMaterial({ vertexColors: true, ...(ghost ? { transparent: true, opacity: 0.5 } : {}) })));

  // Feux stop : deux barrettes à l'arrière, ternes puis rouge vif au freinage.
  const stopMat = new MeshBasicMaterial({ color: 0x5a0f12, ...(ghost ? { transparent: true, opacity: 0.4 } : {}) });
  for (const s of [-1, 1]) {
    const bar = new Mesh(new BoxGeometry(0.5, 0.1, 0.04), stopMat);
    bar.position.set(s * 0.55, 0.66, zr - 0.02);
    group.add(bar);
  }

  // Quatre roues : pneu (cylindre à axe x), jante claire, quatre rayons.
  const tireMat = new MeshStandardMaterial({ color: ghost ? 0x2a4f7a : 0x16171b, flatShading: true, ...(ghost ? { transparent: true, opacity: 0.45 } : {}) });
  const rimMat = new MeshStandardMaterial({ color: ghost ? 0xcfe9ff : 0xd9dde6, flatShading: true, ...(ghost ? { transparent: true, opacity: 0.5 } : {}) });
  const tireGeo = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, 0.32, 8);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new BoxGeometry(0.34, WHEEL_RADIUS * 1.0, 0.07);
  const wheels = [0, 1, 2, 3].map((i) => {
    const holder = new Group(); // braquage (avant) et position
    const spin = new Group(); // rotation autour de l'axe
    spin.add(new Mesh(tireGeo, tireMat), new Mesh(rimGeo, rimMat));
    for (const a of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      const spoke = new Mesh(spokeGeo, tireMat);
      spoke.rotation.x = a;
      spin.add(spoke);
    }
    holder.add(spin);
    const front = i < 2;
    holder.position.set(i % 2 === 0 ? HALF_TRACK : -HALF_TRACK, WHEEL_RADIUS, front ? AXLE_FRONT : -AXLE_REAR);
    group.add(holder);
    return { holder, spin };
  });

  let angle = 0;
  return {
    group,
    update(s) {
      angle += (s.forward / WHEEL_RADIUS) * s.dt;
      if (angle > 1e4) angle -= 1e4;
      wheels.forEach((w, i) => {
        w.holder.position.y = WHEEL_RADIUS - clampTravel(s.droop[i]!);
        w.holder.rotation.y = i < 2 ? s.steerAngle : 0;
        w.spin.rotation.x = angle;
      });
      stopMat.color.setHex(s.braking ? 0xff2a2a : 0x5a0f12);
    },
  };
}

/** Garde la roue dans son débattement. */
export function clampTravel(droop: number): number {
  return droop < -TRAVEL_UP ? -TRAVEL_UP : droop > TRAVEL_DOWN ? TRAVEL_DOWN : droop;
}
