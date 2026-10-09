import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { AXLE_FRONT, AXLE_REAR, HALF_TRACK } from "@cdj/sim";

// Voiture low-poly (lots 9 et 9b), construite en code, **originale** : un coupé de rallye-raid trapu, carrosserie orange
// à bandes crème, profil galbé (sections successives lissées), bulle de toit vitrée, prise d'air, rétroviseurs,
// échappements, aileron sur deux jambes, quatre roues séparées (pneu, jante à cinq branches, disque et étrier de frein).
// Aucun modèle ni aucune forme de véhicule existant n'a été repris.
// Repère : orientée vers +z (cap 0), origine au sol, y vers le haut, x vers la gauche (comme `HALF_TRACK`).

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
  /** Éventail autour d'un centre (disque, polygone convexe). */
  fan(center: V3, ring: V3[], color: number) {
    for (let i = 0; i < ring.length; i++) this.tri(center, ring[i]!, ring[(i + 1) % ring.length]!, color);
  }
  /** Hexaèdre : 4 sommets du bas (arrière gauche, arrière droit, avant droit, avant gauche), puis 4 du haut. */
  hexa(v: V3[], colors: { top: number; side: number; front?: number; back?: number; bottom?: number }) {
    const [a, b, c, d, e, f, g, h] = v as [V3, V3, V3, V3, V3, V3, V3, V3];
    this.quad(e, f, g, h, colors.top);
    this.quad(a, e, h, d, colors.side);
    this.quad(b, c, g, f, colors.side);
    this.quad(d, h, g, c, colors.front ?? colors.side);
    this.quad(a, b, f, e, colors.back ?? colors.side);
    this.quad(a, d, c, b, colors.bottom ?? 0x111111);
  }
  /**
   * Caisse par sections : `rings[i]` est le contour (points (x, y), sens horaire vu de l'arrière) à l'avance `zs[i]` ;
   * `edge(arête, tronçon)` donne la couleur de chaque face. Les deux bouts sont fermés.
   */
  loft(zs: number[], rings: [number, number][][], edge: (e: number, s: number) => number, capBack: number, capFront: number) {
    const n = rings[0]!.length;
    for (let s = 0; s + 1 < zs.length; s++) {
      for (let e = 0; e < n; e++) {
        const e2 = (e + 1) % n;
        const a = rings[s]![e]!;
        const b = rings[s]![e2]!;
        const c = rings[s + 1]![e2]!;
        const d = rings[s + 1]![e]!;
        this.quad([a[0], a[1], zs[s]!], [b[0], b[1], zs[s]!], [c[0], c[1], zs[s + 1]!], [d[0], d[1], zs[s + 1]!], edge(e, s));
      }
    }
    const cap = (ring: [number, number][], z: number, color: number, flip: boolean) => {
      const cx = ring.reduce((t, p) => t + p[0], 0) / n;
      const cy = ring.reduce((t, p) => t + p[1], 0) / n;
      const pts = ring.map((p): V3 => [p[0], p[1], z]);
      this.fan([cx, cy, z], flip ? pts.reverse() : pts, color);
    };
    cap(rings[0]!, zs[0]!, capBack, false);
    cap(rings[rings.length - 1]!, zs[zs.length - 1]!, capFront, true);
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

export interface CarLook {
  body: number;
  trim: number;
  glass: number;
  stripe: number;
  accent: number;
}
const LOOK: CarLook = { body: 0xff6a1f, trim: 0x1d2029, glass: 0x16283a, stripe: 0xf6ecd2, accent: 0xd8321a };
const GHOST_LOOK: CarLook = { body: 0x57b4ff, trim: 0x2a4f7a, glass: 0x2a4f7a, stripe: 0xcfe9ff, accent: 0x9fd4ff };

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
  /** Descente voulue de chaque roue par rapport à sa position de repos (m), dans l'ordre avant gauche, avant droit,
   *  arrière gauche, arrière droit : positif = la roue descend (détente), négatif = elle remonte (compression). */
  droop: readonly [number, number, number, number];
  /** Temps écoulé (s). */
  dt: number;
}

/** Contour de caisse à l'avance donnée : bas, bas de caisse, épaule, dessus (largeur `w`, de `y0` à `y1`). */
const bodyRing = (w: number, y0: number, y1: number): [number, number][] => {
  const h = y1 - y0;
  return [
    [-w * 0.84, y0],
    [w * 0.84, y0],
    [w, y0 + h * 0.3],
    [w * 0.97, y0 + h * 0.72],
    [w * 0.7, y1],
    [-w * 0.7, y1],
    [-w * 0.97, y0 + h * 0.72],
    [-w, y0 + h * 0.3],
  ];
};

const mix = (a: number, b: number, t: number): number => {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Aspect d'un fantôme de la couleur `tint` (Salon, lot 26) : caisse de cette couleur, détails clairs ou foncés dérivés d'elle. */
export function tintedGhostLook(tint: number): CarLook & { tire: number; rim: number } {
  return { body: tint, trim: mix(tint, 0x10141c, 0.62), glass: mix(tint, 0x10141c, 0.6), stripe: mix(tint, 0xffffff, 0.8), accent: mix(tint, 0xffffff, 0.5), tire: mix(tint, 0x10141c, 0.7), rim: mix(tint, 0xffffff, 0.85) };
}

/** Voiture low-poly orientée vers +z. `ghost` : version bleue translucide (teinte froide) ; `tint` : un fantôme d'une autre couleur (Salon) ; `simple` : une version allégée (caisse, pneus et jantes seulement : une dizaine d'objets au lieu de cinquante, pour les fantômes du Salon). */
export function createCarMesh(ghost = false, tint?: number, simple = false): CarModel {
  const tinted = ghost && tint !== undefined ? tintedGhostLook(tint) : null;
  const look: CarLook = tinted ?? (ghost ? GHOST_LOOK : LOOK);
  const m = new Mesh3();
  const zr = -AXLE_REAR - 0.75;
  const zf = AXLE_FRONT + 0.85;
  const W = HALF_TRACK + 0.12;

  // Caisse : sections de l'arrière (haut, large) au nez (bas, étroit). Bas de caisse sombre, flancs orange.
  const zs = [zr, zr + 0.45, -0.5, 0.7, 1.55, zf - 0.2, zf];
  const sec: [number, number, number][] = [
    [W - 0.06, 0.34, 0.9],
    [W, 0.3, 0.98],
    [W + 0.02, 0.3, 0.96],
    [W, 0.3, 0.82],
    [W - 0.06, 0.3, 0.68],
    [W - 0.14, 0.32, 0.56],
    [W - 0.24, 0.36, 0.5],
  ];
  m.loft(
    zs,
    sec.map(([w, y0, y1]) => bodyRing(w, y0, y1)),
    (e) => (e === 0 || e === 1 ? look.trim : e === 2 || e === 7 ? look.trim : look.body),
    look.trim,
    look.trim,
  );
  // Bandes crème : deux le long du dessus (capot, toit, coffre), un liseré sur chaque flanc.
  for (let s = 0; s + 1 < zs.length; s++) {
    const y = (i: number) => sec[i]![2] + 0.004;
    for (const x of [-0.2, 0.1]) m.quad([x, y(s), zs[s]!], [x + 0.1, y(s), zs[s]!], [x + 0.1, y(s + 1), zs[s + 1]!], [x, y(s + 1), zs[s + 1]!], look.stripe);
  }
  for (const side of [-1, 1]) {
    const x = (i: number) => side * (sec[i]![0] + 0.004);
    for (let s = 1; s < 4; s++) {
      const yl = (i: number) => sec[i]![1] + (sec[i]![2] - sec[i]![1]) * 0.45;
      m.quad([x(s), yl(s), zs[s]!], [x(s), yl(s) + 0.07, zs[s]!], [x(s + 1), yl(s + 1) + 0.07, zs[s + 1]!], [x(s + 1), yl(s + 1), zs[s + 1]!], look.stripe);
    }
    // Rond de portière blanc (numéro) : disque plat sur le flanc.
    const cx = side * (W + 0.012);
    const ring: V3[] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ring.push([cx, 0.62 + Math.sin(a) * 0.16, -0.2 + Math.cos(a) * 0.2]);
    }
    m.fan([cx, 0.62, -0.2], side > 0 ? ring.reverse() : ring, look.stripe);
  }

  // Bulle de toit : vitres sombres sur les côtés, lunette et pare-brise inclinés, toit de la couleur de la caisse.
  const cz = [-1.15, -0.55, 0.3, 1.0];
  const cab: [number, number, number][] = [
    [W - 0.2, 0.9, 0.98],
    [W - 0.32, 0.9, 1.32],
    [W - 0.34, 0.9, 1.34],
    [W - 0.16, 0.8, 0.84],
  ];
  const cabRing = ([w, y0, y1]: [number, number, number]): [number, number][] => [
    [-w, y0],
    [w, y0],
    [w * 0.9, y0 + (y1 - y0) * 0.55],
    [w * 0.7, y1],
    [-w * 0.7, y1],
    [-w * 0.9, y0 + (y1 - y0) * 0.55],
  ];
  m.loft(
    cz,
    cab.map(cabRing),
    (e, s) => (e === 3 ? (s === 1 ? look.body : look.glass) : e === 0 ? look.trim : e === 1 || e === 5 ? look.glass : s === 1 ? look.body : look.glass),
    look.glass,
    look.glass,
  );
  // Bandes sur le toit.
  for (const x of [-0.2, 0.1]) m.quad([x, cab[1]![2] + 0.004, cz[1]!], [x + 0.1, cab[1]![2] + 0.004, cz[1]!], [x + 0.1, cab[2]![2] + 0.004, cz[2]!], [x, cab[2]![2] + 0.004, cz[2]!], look.stripe);

  // Capot : prise d'air à deux fentes. Rétroviseurs. Échappements. Aileron. Becquet et diffuseur.
  m.hexa(frustum(0.7, 0.32, 0.85, 1.5, 0.78, 0.26, 0.95, 1.45), { top: look.trim, side: look.trim });
  for (const s of [-1, 1]) {
    m.hexa(frustum(0.9, 0.09, 0.45, 0.62, 1.04, 0.07, 0.48, 0.58).map(([x, y, z]) => [x + s * (W - 0.05), y, z] as V3), { top: look.body, side: look.body });
    m.hexa(frustum(0.36, 0.07, zr - 0.12, zr + 0.14, 0.5, 0.06, zr - 0.1, zr + 0.1).map(([x, y, z]) => [x + s * 0.5, y, z] as V3), { top: 0x6b7080, side: 0x40444f, back: 0x0a0a0c });
    m.hexa(frustum(0.7, 0.04, zr + 0.2, zr + 0.3, 1.2, 0.04, zr + 0.2, zr + 0.3).map(([x, y, z]) => [x + s * 0.55, y, z] as V3), { top: look.trim, side: look.trim });
  }
  m.hexa(frustum(1.2, W - 0.06, zr - 0.08, zr + 0.5, 1.25, W - 0.06, zr - 0.08, zr + 0.5), { top: look.body, side: look.trim });
  m.hexa(frustum(1.245, W - 0.04, zr - 0.1, zr - 0.04, 1.29, W - 0.04, zr - 0.1, zr - 0.04), { top: look.stripe, side: look.stripe }); // bord d'attaque crème
  m.hexa(frustum(0.3, W - 0.2, zf - 0.55, zf + 0.12, 0.38, W - 0.16, zf - 0.55, zf + 0.12), { top: look.trim, side: look.trim }); // becquet avant
  m.hexa(frustum(0.28, W - 0.3, zr - 0.04, zr + 0.35, 0.36, W - 0.34, zr - 0.04, zr + 0.35), { top: look.trim, side: look.trim }); // diffuseur

  // Calandre et phares : bandeau sombre, deux blocs optiques clairs qui brillent (matériau sans éclairage).
  const lights = new Mesh3();
  m.quad([-0.6, 0.44, zf + 0.001], [0.6, 0.44, zf + 0.001], [0.6, 0.5, zf - 0.04], [-0.6, 0.5, zf - 0.04], 0x0a0a0c);
  for (const s of [-1, 1]) {
    lights.quad([s * 0.78, 0.5, zf - 0.28], [s * 0.4, 0.5, zf - 0.08], [s * 0.4, 0.58, zf - 0.08], [s * 0.78, 0.6, zf - 0.3], 0xfff6c8);
    lights.quad([s * 0.62, 0.43, zf - 0.02], [s * 0.4, 0.43, zf - 0.02], [s * 0.4, 0.46, zf - 0.02], [s * 0.62, 0.46, zf - 0.02], 0xffffff);
  }

  const bodyMat = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.55,
    metalness: 0.1,
    side: DoubleSide,
    ...(ghost ? { transparent: true, opacity: 0.42, depthWrite: false } : {}),
  });
  const group = new Group();
  if (simple) {
    // Fantôme allégé (Salon) : quatre roues pleines fondues dans la caisse, une seule pièce, sans phares : deux appels de dessin au lieu d'une cinquantaine.
    const tireColor = tinted?.tire ?? 0x2a4f7a;
    for (const cx of [HALF_TRACK, -HALF_TRACK]) for (const cz of [AXLE_FRONT, -AXLE_REAR]) m.hexa(frustum(WHEEL_RADIUS * 0.1, 0.16, cz - 0.34, cz + 0.34, WHEEL_RADIUS * 1.9, 0.16, cz - 0.3, cz + 0.3).map(([x, y, z]) => [x + cx, y, z] as V3), { top: tireColor, side: tireColor });
    bodyMat.forceSinglePass = true; // transparent et à double face : sinon dessinée deux fois
  }
  group.add(new Mesh(m.geometry(), bodyMat));
  if (!simple) group.add(new Mesh(lights.geometry(), new MeshBasicMaterial({ vertexColors: true, ...(ghost ? { transparent: true, opacity: 0.5 } : {}) })));

  // Feux stop : une barrette de chaque côté du coffre, ternes puis rouge vif au freinage, plus un troisième feu central.
  const stopMat = new MeshBasicMaterial({ color: 0x5a0f12, ...(ghost ? { transparent: true, opacity: 0.4 } : {}) });
  if (!simple) {
    for (const s of [-1, 1]) {
      const bar = new Mesh(new BoxGeometry(0.46, 0.11, 0.05), stopMat);
      bar.position.set(s * 0.58, 0.7, zr - 0.02);
      group.add(bar);
    }
    const third = new Mesh(new BoxGeometry(0.5, 0.04, 0.04), stopMat);
    third.position.set(0, 0.99, zr + 0.14);
    group.add(third);
  }

  // Quatre roues : pneu à sculptures, jante à cinq branches, moyeu, disque de frein (fixe) et étrier rouge (fixe).
  const tireMat = new MeshStandardMaterial({ color: ghost ? (tinted?.tire ?? 0x2a4f7a) : 0x16171b, flatShading: true, roughness: 0.9, ...(ghost ? { transparent: true, opacity: 0.45 } : {}) });
  const rimMat = new MeshStandardMaterial({ color: ghost ? (tinted?.rim ?? 0xcfe9ff) : 0xdfe3ec, flatShading: true, metalness: 0.5, roughness: 0.35, ...(ghost ? { transparent: true, opacity: 0.5 } : {}) });
  const hubMat = new MeshStandardMaterial({ color: ghost ? (tinted?.accent ?? 0x9fd4ff) : look.accent, flatShading: true, ...(ghost ? { transparent: true, opacity: 0.5 } : {}) });
  const discMat = new MeshStandardMaterial({ color: 0x3a3d46, flatShading: true, metalness: 0.6, ...(ghost ? { transparent: true, opacity: 0.4 } : {}) });
  const tireGeo = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const shoulderGeo = new CylinderGeometry(WHEEL_RADIUS * 0.94, WHEEL_RADIUS * 0.94, 0.34, 9); // sculptures : un polygone plus grossier qui dépasse
  shoulderGeo.rotateZ(Math.PI / 2);
  const rimGeo = new CylinderGeometry(WHEEL_RADIUS * 0.66, WHEEL_RADIUS * 0.66, 0.31, 14);
  rimGeo.rotateZ(Math.PI / 2);
  const faceGeo = new CylinderGeometry(WHEEL_RADIUS * 0.5, WHEEL_RADIUS * 0.5, 0.33, 14);
  faceGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new BoxGeometry(0.34, WHEEL_RADIUS * 0.62, 0.07);
  const hubGeo = new CylinderGeometry(0.075, 0.075, 0.38, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const discGeo = new CylinderGeometry(WHEEL_RADIUS * 0.58, WHEEL_RADIUS * 0.58, 0.04, 14);
  discGeo.rotateZ(Math.PI / 2);
  const caliperGeo = new BoxGeometry(0.08, 0.14, 0.2);
  const caliperMat = new MeshStandardMaterial({ color: ghost ? (tinted?.accent ?? 0x9fd4ff) : 0xe02a1a, flatShading: true, ...(ghost ? { transparent: true, opacity: 0.5 } : {}) });
  const wheels = (simple ? [] : [0, 1, 2, 3]).map((i) => {
    const holder = new Group(); // braquage (avant) et position
    const spin = new Group(); // rotation autour de l'axe
    const side = i % 2 === 0 ? 1 : -1; // + : roue de gauche, la face extérieure est vers +x
    {
      spin.add(new Mesh(tireGeo, tireMat), new Mesh(shoulderGeo, tireMat), new Mesh(rimGeo, rimMat));
      const face = new Mesh(faceGeo, discMat); // fond sombre : les branches se détachent
      face.position.x = side * 0.004;
      spin.add(face);
      for (let k = 0; k < 5; k++) {
        const spoke = new Mesh(spokeGeo, rimMat);
        spoke.rotation.x = (k / 5) * Math.PI;
        spoke.position.x = side * 0.012;
        spin.add(spoke);
      }
      const hub = new Mesh(hubGeo, hubMat);
      hub.position.x = side * 0.012;
      spin.add(hub);
      holder.add(spin);
      const disc = new Mesh(discGeo, discMat);
      disc.position.x = -side * 0.07;
      const caliper = new Mesh(caliperGeo, caliperMat);
      caliper.position.set(-side * 0.07, 0.2, -0.12);
      holder.add(disc, caliper);
    }
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

/** Boîte tronc de pyramide : `w0` × `z0..z1` en bas à `y0`, `w1` × `t0..t1` en haut à `y1` (z de l'arrière vers l'avant). */
function frustum(y0: number, w0: number, z0: number, z1: number, y1: number, w1: number, t0: number, t1: number): V3[] {
  return [
    [w0, y0, z0], [-w0, y0, z0], [-w0, y0, z1], [w0, y0, z1],
    [w1, y1, t0], [-w1, y1, t0], [-w1, y1, t1], [w1, y1, t1],
  ];
}

/** Garde la roue dans son débattement. */
export function clampTravel(droop: number): number {
  return droop < -TRAVEL_UP ? -TRAVEL_UP : droop > TRAVEL_DOWN ? TRAVEL_DOWN : droop;
}

// --- Ombre portée ------------------------------------------------------------------------------
// Une tache sombre et douce sous la voiture, posée sur le sol (pas sur la caisse : elle ne penche pas). Elle s'élargit et
// s'estompe quand la voiture décolle. Pas de carte d'ombres : coût nul, même sur un vieux téléphone.

function shadowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  grad.addColorStop(0, "rgba(0,0,0,0.85)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.5)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function createShadow(): Mesh {
  const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.rotation.order = "YXZ";
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

/** Pose l'ombre sous la voiture : `ground` = hauteur du sol, `height` = hauteur de la caisse au-dessus (≥ 0). */
export function placeShadow(mesh: Mesh, x: number, z: number, yaw: number, ground: number, height: number): void {
  const lift = Math.min(1, Math.max(0, height) / 6);
  mesh.position.set(x, ground + 0.05, z);
  mesh.rotation.y = yaw;
  mesh.scale.set(2.7 * (1 + lift * 0.6), 5.2 * (1 + lift * 0.4), 1);
  (mesh.material as MeshBasicMaterial).opacity = 0.62 * (1 - lift * 0.75);
}
