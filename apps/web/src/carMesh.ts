import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { AXLE_FRONT, AXLE_REAR, HALF_TRACK } from "@cdj/sim";
import { Pieces, brute, finiParSommet, ombreDeRoue, ombreDesFeux, srgb, type AngleRoues, type Fini } from "./voiture/pieces";

// Voiture low-poly (lots 9 et 9b), construite en code, **originale** : un coupé de rallye-raid trapu, carrosserie orange
// à bandes crème, profil galbé (sections successives lissées), bulle de toit vitrée, prise d'air, rétroviseurs,
// échappements, aileron sur deux jambes, quatre roues séparées (pneu, jante à cinq branches, disque et étrier de frein).
// Aucun modèle ni aucune forme de véhicule existant n'a été repris. Lot 40 : six maillages (caisse, feux, une roue complète par roue), à l'image
// identique ; le fantôme simple du Salon en reste un seul. La voiture dessinée suit la simulation, elle ne la change jamais.
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
/** Feux stop éteints et allumés. */
const STOP_OFF = 0x5a0f12;
const STOP_ON = 0xff2a2a;
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

/** Voiture low-poly orientée vers +z. `ghost` : version bleue translucide (teinte froide) ; `tint` : un fantôme d'une autre couleur (Salon) ; `opaque` : avec `ghost`, une voiture pleine à la couleur du fantôme (mode spectateur) ; `simple` : une version allégée (caisse, pneus et jantes seulement : une dizaine d'objets au lieu de cinquante, pour les fantômes du Salon). */
export function createCarMesh(ghost = false, tint?: number, simple = false, opaque = false): CarModel {
  const translucent = ghost && !opaque; // `opaque` (lot 27b) : la voiture d'un autre joueur regardée en rediffusion, à sa couleur, pleine
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

  // Calandre : un bandeau sombre (les phares, plus bas, sont dans le maillage des feux).
  m.quad([-0.6, 0.44, zf + 0.001], [0.6, 0.44, zf + 0.001], [0.6, 0.5, zf - 0.04], [-0.6, 0.5, zf - 0.04], 0x0a0a0c);

  const bodyMat = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.55,
    metalness: 0.1,
    side: DoubleSide,
    ...(translucent ? { transparent: true, opacity: 0.42, depthWrite: false } : {}),
  });
  const group = new Group();
  if (simple) {
    // Fantôme allégé (Salon) : quatre roues pleines fondues dans la caisse, une seule pièce, sans phares : deux appels de dessin au lieu d'une cinquantaine.
    const tireColor = tinted?.tire ?? 0x2a4f7a;
    for (const cx of [HALF_TRACK, -HALF_TRACK]) for (const cz of [AXLE_FRONT, -AXLE_REAR]) m.hexa(frustum(WHEEL_RADIUS * 0.1, 0.16, cz - 0.34, cz + 0.34, WHEEL_RADIUS * 1.9, 0.16, cz - 0.3, cz + 0.3).map(([x, y, z]) => [x + cx, y, z] as V3), { top: tireColor, side: tireColor });
    bodyMat.forceSinglePass = true; // transparent et à double face : sinon dessinée deux fois
    group.add(new Mesh(m.geometry(), bodyMat));
    return { group, update() {} };
  }
  group.add(new Mesh(m.geometry(), bodyMat));

  // Lot 40 : six maillages en tout (caisse, feux, quatre roues), à l'image identique à celle des cinquante-trois du lot 9b.
  // Feux, un seul maillage : les phares (sans éclairage, à double face : le bloc de droite est le miroir de celui de gauche, donc à l'envers ; on
  // les voit du dessus en vue capot) et les feux stop (deux barrettes et un troisième feu central, ternes puis rouge vif au freinage : leur
  // couleur est réécrite quand le frein change).
  const feux = new Pieces();
  const phare = (hex: number): Fini => ({ couleur: brute(hex), alpha: 0.5 });
  for (const s of [-1, 1]) {
    feux.quad([s * 0.78, 0.5, zf - 0.28], [s * 0.4, 0.5, zf - 0.08], [s * 0.4, 0.58, zf - 0.08], [s * 0.78, 0.6, zf - 0.3], phare(0xfff6c8));
    feux.quad([s * 0.62, 0.43, zf - 0.02], [s * 0.4, 0.43, zf - 0.02], [s * 0.4, 0.46, zf - 0.02], [s * 0.62, 0.46, zf - 0.02], phare(0xffffff));
  }
  const stopDebut = feux.sommets;
  const stopFini: Fini = { couleur: srgb(STOP_OFF), alpha: 0.4, recto: true };
  for (const s of [-1, 1]) feux.geometrie(new BoxGeometry(0.46, 0.11, 0.05), new Matrix4().makeTranslation(s * 0.58, 0.7, zr - 0.02), stopFini);
  feux.geometrie(new BoxGeometry(0.5, 0.04, 0.04), new Matrix4().makeTranslation(0, 0.99, zr + 0.14), stopFini);
  const stopFin = feux.sommets;
  const feuxGeo = feux.construire(translucent);
  // À double face (les phares) ; les feux stop, eux, ne montrent que leur face (l'envers est écarté dans le shader). Translucide : une seule passe.
  const feuxMat = finiParSommet(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, ...(translucent ? { transparent: true } : {}) }), { recto: true });
  feuxMat.forceSinglePass = true;
  const feuxMesh = new Mesh(feuxGeo, feuxMat);
  feuxMesh.customDepthMaterial = ombreDesFeux();
  group.add(feuxMesh);
  const feuxCouleurs = feuxGeo.getAttribute("color") as BufferAttribute;
  const allumer = (on: boolean) => {
    const c = srgb(on ? STOP_ON : STOP_OFF);
    for (let i = stopDebut; i < stopFin; i++) feuxCouleurs.setXYZ(i, c.r, c.g, c.b);
    feuxCouleurs.needsUpdate = true;
  };

  // Quatre roues : pneu à sculptures, jante à cinq branches, moyeu (ils tournent : dans le shader), disque de frein et étrier rouge (fixes). Une
  // géométrie par côté (la face extérieure est vers +x à gauche), un seul matériau et un seul angle pour les quatre.
  const roue = (side: number): BufferGeometry => {
    const p = new Pieces();
    const fini = (hex: number, alpha: number, rugosite: number, metal: number, tourne: boolean): Fini => ({ couleur: srgb(hex), alpha, rugosite, metal, tourne });
    const tire = fini(ghost ? (tinted?.tire ?? 0x2a4f7a) : 0x16171b, 0.45, 0.9, 0, true);
    const rim = fini(ghost ? (tinted?.rim ?? 0xcfe9ff) : 0xdfe3ec, 0.5, 0.35, 0.5, true);
    const hub = fini(ghost ? (tinted?.accent ?? 0x9fd4ff) : look.accent, 0.5, 1, 0, true);
    const disc = (tourne: boolean) => fini(0x3a3d46, 0.4, 1, 0.6, tourne);
    const caliper = fini(ghost ? (tinted?.accent ?? 0x9fd4ff) : 0xe02a1a, 0.5, 1, 0, false);
    const axe = (r: number, l: number, n: number) => new CylinderGeometry(r, r, l, n).rotateZ(Math.PI / 2);
    const en = (x: number, y = 0, z = 0) => new Matrix4().makeTranslation(x, y, z);
    p.geometrie(axe(WHEEL_RADIUS, 0.3, 18), null, tire);
    p.geometrie(axe(WHEEL_RADIUS * 0.94, 0.34, 9), null, tire); // sculptures : un polygone plus grossier qui dépasse
    p.geometrie(axe(WHEEL_RADIUS * 0.66, 0.31, 14), null, rim);
    p.geometrie(axe(WHEEL_RADIUS * 0.5, 0.33, 14), en(side * 0.004), disc(true)); // fond sombre : les branches se détachent
    const spoke = new BoxGeometry(0.34, WHEEL_RADIUS * 0.62, 0.07);
    for (let k = 0; k < 5; k++) p.geometrie(spoke, en(side * 0.012).multiply(new Matrix4().makeRotationX((k / 5) * Math.PI)), rim);
    p.geometrie(axe(0.075, 0.38, 8), en(side * 0.012), hub);
    p.geometrie(axe(WHEEL_RADIUS * 0.58, 0.04, 14), en(-side * 0.07), disc(false));
    p.geometrie(new BoxGeometry(0.08, 0.14, 0.2), en(-side * 0.07, 0.2, -0.12), caliper);
    return p.construire(translucent);
  };
  const angle: AngleRoues = { value: 0 };
  const roueMat = finiParSommet(new MeshStandardMaterial({ vertexColors: true, flatShading: true, ...(translucent ? { transparent: true } : {}) }), { angle });
  const roueOmbre = ombreDeRoue(angle);
  const geos = [roue(1), roue(-1)];
  const wheels = [0, 1, 2, 3].map((i) => {
    const holder = new Mesh(geos[i % 2]!, roueMat);
    holder.customDepthMaterial = roueOmbre;
    const front = i < 2;
    holder.position.set(i % 2 === 0 ? HALF_TRACK : -HALF_TRACK, WHEEL_RADIUS, front ? AXLE_FRONT : -AXLE_REAR);
    group.add(holder);
    return holder;
  });

  let freine = false;
  return {
    group,
    update(s) {
      angle.value += (s.forward / WHEEL_RADIUS) * s.dt;
      if (angle.value > 1e4) angle.value -= 1e4;
      wheels.forEach((w, i) => {
        w.position.y = WHEEL_RADIUS - clampTravel(s.droop[i]!);
        w.rotation.y = i < 2 ? s.steerAngle : 0;
      });
      if (s.braking !== freine) allumer((freine = s.braking));
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
