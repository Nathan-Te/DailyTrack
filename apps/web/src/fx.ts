import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  type Scene,
} from "three";
import { AXLE_REAR, NO_GROUND, type SurfaceKind } from "@cdj/sim";
import { skidLevel } from "./audioLogic";
import type { Telemetry } from "./telemetry";

// Effets visuels (lot 9) : fumée de pneus, traces au sol, particules par revêtement, flammes de turbo, étincelles contre
// un rebord, poussière à la réception, flash et confettis. Tout vit dans des tampons de taille fixe (aucune allocation
// par image) et ne fait que **lire** l'état de la voiture : un effet ne peut pas changer un résultat de `sim`.

/** Niveaux de qualité : 0 bas (peu de particules, pas de traces), 1 moyen, 2 haut. */
export type Quality = 0 | 1 | 2;
export const QUALITY_RATE: Record<Quality, number> = { 0: 0.25, 1: 0.6, 2: 1 };

/** Image-clé d'un effet : où est la voiture et que fait-elle (interpolé pour l'affichage). */
export interface FxFrame {
  dt: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tel: Telemetry;
  braking: boolean;
  boost: boolean;
  turbo: boolean;
  /** Course en cours (pas de décompte, pas de pause). */
  racing: boolean;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.35, d) * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

/** Réserve de particules : un tampon circulaire, la plus ancienne est recyclée. */
class Pool {
  readonly points: Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly grow: Float32Array;
  private readonly size0: Float32Array;
  private readonly alpha0: Float32Array;
  private readonly grav: Float32Array;
  private readonly drag: Float32Array;
  private next = 0;
  private alive = 0;
  private readonly material: ShaderMaterial;

  constructor(
    readonly max: number,
    additive: boolean,
  ) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1e9);
    this.life = new Float32Array(max).fill(1);
    this.grow = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute("aColor", new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage));
    g.setAttribute("aSize", new BufferAttribute(this.size, 1).setUsage(DynamicDrawUsage));
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      ...(additive ? { blending: AdditiveBlending } : {}),
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
  }

  setScale(scale: number) {
    this.material.uniforms.uScale!.value = scale;
  }

  get count(): number {
    return this.alive;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grow: number, r: number, g: number, b: number, a: number, grav = 0, drag = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size0[i] = size;
    this.grow[i] = grow;
    this.col[i * 4] = r;
    this.col[i * 4 + 1] = g;
    this.col[i * 4 + 2] = b;
    this.alpha0[i] = a;
    this.col[i * 4 + 3] = a;
    this.size[i] = size;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  update(dt: number) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const age = this.age[i]! + dt;
      this.age[i] = age;
      const life = this.life[i]!;
      if (age >= life) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      alive++;
      const t = age / life;
      const damp = 1 - Math.min(1, this.drag[i]! * dt);
      this.vel[i * 3] = this.vel[i * 3]! * damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * damp - this.grav[i]! * dt;
      this.vel[i * 3 + 2] = this.vel[i * 3 + 2]! * damp;
      this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2] = this.pos[i * 3 + 2]! + this.vel[i * 3 + 2]! * dt;
      const s = this.size0[i]! + this.grow[i]! * age;
      this.size[i] = s > 0 ? s : 0;
      this.col[i * 4 + 3] = this.alpha0[i]! * (1 - t) * (t < 0.1 ? t * 10 : 1);
    }
    this.alive = alive;
    const g = this.points.geometry;
    (g.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (g.getAttribute("aColor") as BufferAttribute).needsUpdate = true;
    (g.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
  }

  clear() {
    this.age.fill(1e9);
    this.size.fill(0);
    this.col.fill(0);
    this.alive = 0;
  }
}

/** Couleur (r, g, b) et opacité maximale des traces selon le revêtement : gomme noire, sillon brun, herbe arrachée, rayures claires. */
const SKID_STYLE: Record<SurfaceKind, { c: [number, number, number]; a: number }> = {
  road: { c: [0.04, 0.04, 0.05], a: 0.7 },
  dirt: { c: [0.22, 0.14, 0.07], a: 0.65 },
  grass: { c: [0.1, 0.26, 0.07], a: 0.55 },
  ice: { c: [0.96, 0.99, 1], a: 0.7 },
};
const SKID_WIDTH = 0.14; // demi-largeur d'une trace (m) : un pneu fait 0,3 m
const SKID_STEP = 1.1; // distance minimale entre deux segments (m)

/**
 * Traces de pneus : un ruban de quadrilatères en tampon circulaire, posé sur la route, une trace par roue arrière (2 emplacements de roue utilisés sur 4).
 * Chaque sommet porte sa transparence : la trace **s'estompe** à son début et à sa fin, et prend la teinte du revêtement.
 * Seule la partie modifiée du tampon part au processeur graphique.
 */
class Skids {
  readonly mesh: Mesh;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private head = 0;
  /** Segments posés depuis le début (outil de test). */
  created = 0;
  private readonly last = [0, 1, 2, 3].map(() => ({ ok: false, x: 0, y: 0, z: 0, a: 0, seg: -1 }));

  constructor(readonly segments: number) {
    this.pos = new Float32Array(segments * 6 * 3);
    this.col = new Float32Array(segments * 6 * 4);
    const g = new BufferGeometry();
    // BufferAttribute (et non Float32BufferAttribute, qui copie le tableau) : on écrit directement dans `pos` et `col`.
    g.setAttribute("position", new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute("color", new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage));
    this.mesh = new Mesh(
      g,
      new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Fait mourir la trace de la roue `w` : le dernier segment s'estompe. */
  private end(w: number) {
    const l = this.last[w]!;
    if (l.ok && l.seg >= 0) {
      for (const v of [2, 4, 5]) this.col[l.seg * 24 + v * 4 + 3] = 0;
      this.touch(l.seg);
    }
    l.ok = false;
    l.seg = -1;
  }

  private touch(seg: number) {
    (this.mesh.geometry.getAttribute("position") as BufferAttribute).addUpdateRange(seg * 18, 18);
    (this.mesh.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.mesh.geometry.getAttribute("color") as BufferAttribute).addUpdateRange(seg * 24, 24);
    (this.mesh.geometry.getAttribute("color") as BufferAttribute).needsUpdate = true;
  }

  /** La roue `w` (0-3) pose une trace d'intensité `level` ∈ [0, 1] (0 : elle n'en pose plus) au point (x, y, z). */
  wheel(w: number, level: number, kind: SurfaceKind, x: number, y: number, z: number, nx = 0, ny = 1, nz = 0) {
    const l = this.last[w]!;
    if (level <= 0.02) {
      this.end(w);
      return;
    }
    const style = SKID_STYLE[kind];
    const alpha = Math.min(1, level * 1.4) * style.a;
    if (!l.ok) {
      l.ok = true;
      l.x = x;
      l.y = y;
      l.z = z;
      l.a = 0; // début de trace : on part de transparent
      l.seg = -1;
      return;
    }
    const dx = x - l.x;
    const dy = y - l.y;
    const dz = z - l.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= 8) {
      this.end(w);
      return;
    }
    if (d < SKID_STEP) return;
    // Largeur du ruban : perpendiculaire à la marche, dans le plan de la surface (normale n) — sur la route, horizontale ; sur une paroi, le long d'elle.
    let px = ny * dz - nz * dy;
    let py = nz * dx - nx * dz;
    let pz = nx * dy - ny * dx;
    const pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
    px = (px / pl) * SKID_WIDTH;
    py = (py / pl) * SKID_WIDTH;
    pz = (pz / pl) * SKID_WIDTH;
    const seg = this.head;
    const i = seg * 18;
    const v = [l.x - px, l.y - py, l.z - pz, l.x + px, l.y + py, l.z + pz, x + px, y + py, z + pz, l.x - px, l.y - py, l.z - pz, x + px, y + py, z + pz, x - px, y - py, z - pz];
    for (let k = 0; k < 18; k++) this.pos[i + k] = v[k]!;
    const j = seg * 24;
    for (let k = 0; k < 6; k++) {
      const a = k === 0 || k === 1 || k === 3 ? l.a : alpha;
      this.col[j + k * 4] = style.c[0];
      this.col[j + k * 4 + 1] = style.c[1];
      this.col[j + k * 4 + 2] = style.c[2];
      this.col[j + k * 4 + 3] = a;
    }
    this.touch(seg);
    this.head = (this.head + 1) % this.segments;
    this.created++;
    l.x = x;
    l.y = y;
    l.z = z;
    l.a = alpha;
    l.seg = seg;
  }

  clear() {
    this.pos.fill(0);
    this.col.fill(0);
    this.head = 0;
    for (const l of this.last) {
      l.ok = false;
      l.seg = -1;
    }
    (this.mesh.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.mesh.geometry.getAttribute("color") as BufferAttribute).needsUpdate = true;
  }
}

const CONFETTI = [0xff4b4b, 0xffd22e, 0x4bd0ff, 0x6bff8a, 0xff6bf0, 0xffffff] as const;
const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const DUST: Record<Exclude<SurfaceKind, "road">, { c: [number, number, number]; a: number; size: number; grow: number; life: number; up: number }> = {
  dirt: { c: [0.64, 0.5, 0.34], a: 0.5, size: 0.7, grow: 1.4, life: 0.85, up: 1.6 },
  ice: { c: [0.85, 0.96, 1], a: 0.7, size: 0.28, grow: 0.2, life: 0.5, up: 2.6 },
  grass: { c: [0.35, 0.62, 0.22], a: 0.8, size: 0.24, grow: 0.1, life: 0.6, up: 3.2 },
};

export class Effects {
  readonly smoke = new Pool(420, false);
  readonly glow = new Pool(320, true);
  private readonly skids = new Skids(2400);
  /** Segments de traces posés (outil de test). */
  get marks(): number {
    return this.skids.created;
  }
  quality: Quality = 2;
  enabled = true;
  /** Particules émises (outil de test : pour vérifier qu'un effet se déclenche). */
  readonly emitted = { smoke: 0, surface: 0, spark: 0, flame: 0, land: 0, confetti: 0, flash: 0, skid: 0 };
  private acc = { smoke: 0, surface: 0, spark: 0, flame: 0 };

  constructor(scene: Scene) {
    scene.add(this.skids.mesh, this.smoke.points, this.glow.points);
  }

  /** `height` : hauteur de la fenêtre en pixels, `fov` : champ de vision vertical (degrés). */
  setViewport(height: number, fov: number, pixelRatio: number) {
    const scale = (height * pixelRatio) / (2 * Math.tan((fov * Math.PI) / 360));
    this.smoke.setScale(scale);
    this.glow.setScale(scale);
  }

  get particles(): number {
    return this.smoke.count + this.glow.count;
  }

  reset() {
    this.smoke.clear();
    this.glow.clear();
    this.skids.clear();
  }

  private rate(key: keyof Effects["acc"], perSecond: number, dt: number): number {
    this.acc[key] += perSecond * QUALITY_RATE[this.quality] * dt;
    const n = Math.floor(this.acc[key]);
    this.acc[key] -= n;
    return n;
  }

  /** Une image : émet selon ce que fait la voiture, puis fait vivre les particules. */
  update(f: FxFrame) {
    const { dt } = f;
    if (this.enabled && dt > 0 && f.racing) this.emit(f);
    if (dt > 0) {
      this.smoke.update(dt);
      this.glow.update(dt);
    }
  }

  private emit(f: FxFrame) {
    const { dt, tel } = f;
    const sinY = Math.sin(f.yaw);
    const cosY = Math.cos(f.yaw);
    const speed = tel.speed;
    const grounded = tel.grounded;

    // Fumée de pneus et traces : dérive franche, dérapage au frein (`drift`) ou freinage appuyé à bonne vitesse.
    // Seules les roues arrière marquent.
    const slip = skidLevel(tel.slide, speed, f.braking, grounded);
    const hardBrake = f.braking && grounded && speed > 14 ? 0.55 * Math.min(1, speed / 32) : 0;
    // Sur une paroi (lot 18) : les pneus pressés laissent leur trace tant que la voiture va vite.
    const wallRide = tel.onWall && speed > 12 ? 0.4 : 0;
    const skid = Math.max(slip, tel.drift * 0.9 * (grounded ? 1 : 0), hardBrake, wallRide);
    const rear = [tel.wheels[2]!, tel.wheels[3]!] as const;
    for (let w = 0; w < 4; w++) {
      const wheel = tel.wheels[w]!;
      const level = this.quality === 0 || w < 2 || wheel.ground < NO_GROUND / 2 ? 0 : skid; // roues arrière seulement
      if (level > 0.12) this.emitted.skid++;
      const n = tel.normal;
      this.skids.wheel(w, level > 0.12 ? level : 0, wheel.surface, wheel.x + n.x * 0.03, wheel.ground + n.y * 0.03, wheel.z + n.z * 0.03, n.x, n.y, n.z);
    }
    if (skid > 0.08) {
      for (let k = this.rate("smoke", 55 * skid * 2, dt); k > 0; k--) {
        const wheel = rear[k % 2]!;
        this.emitted.smoke++;
        this.smoke.spawn(wheel.x, wheel.ground + 0.2, wheel.z, rnd(-0.6, 0.6) - sinY * speed * 0.1, rnd(0.5, 1.4), rnd(-0.6, 0.6) - cosY * speed * 0.1, rnd(0.7, 1.2), 0.8, 2.2, 0.85, 0.85, 0.88, 0.42, 0, 0.8);
      }
    }

    // Particules du revêtement : poussière (terre), éclats (glace), brins (herbe).
    if (grounded && speed > 5 && tel.surface !== "road") {
      const d = DUST[tel.surface];
      for (let k = this.rate("surface", speed * 2.2, dt); k > 0; k--) {
        const wheel = rear[k % 2]!;
        this.emitted.surface++;
        this.smoke.spawn(wheel.x, wheel.ground + 0.15, wheel.z, rnd(-1.4, 1.4) - sinY * speed * 0.12, rnd(0.5, 1) * d.up, rnd(-1.4, 1.4) - cosY * speed * 0.12, d.life * rnd(0.7, 1.2), d.size, d.grow, d.c[0], d.c[1], d.c[2], d.a, tel.surface === "dirt" ? 0 : 9, tel.surface === "dirt" ? 1.2 : 0.3);
      }
    }

    // Étincelles : la caisse frotte un rebord.
    if (tel.wall && speed > 4) {
      for (let k = this.rate("spark", 110, dt); k > 0; k--) {
        this.emitted.spark++;
        const w = tel.wall;
        this.glow.spawn(w.x, f.y + rnd(0.2, 0.9), w.z, w.nx * rnd(1, 5) + rnd(-2, 2) + sinY * speed * 0.15, rnd(1, 5), w.nz * rnd(1, 5) + rnd(-2, 2) + cosY * speed * 0.15, rnd(0.2, 0.45), 0.2, -0.2, 1, rnd(0.7, 0.95), 0.35, 1, 14, 0.5);
      }
    }

    // Étincelles sur la paroi d'une cuve : à vitesse, les roues arrière et le bas de caisse frottent (lot 18).
    if (tel.onWall && speed > 18) {
      const n = tel.normal;
      for (let k = this.rate("spark", 60 * Math.min(1.5, speed / 36), dt); k > 0; k--) {
        const wheel = rear[k % 2]!;
        this.emitted.spark++;
        this.glow.spawn(wheel.x + n.x * 0.15, wheel.ground + n.y * 0.15, wheel.z + n.z * 0.15, n.x * rnd(1, 4) + rnd(-2, 2) - sinY * speed * 0.15, n.y * rnd(1, 4) + rnd(0, 3), n.z * rnd(1, 4) + rnd(-2, 2) - cosY * speed * 0.15, rnd(0.2, 0.4), 0.18, -0.2, 1, rnd(0.7, 0.95), 0.35, 1, 14, 0.5);
      }
    }

    // Flammes : plaque (orange) et super turbo (bleu-blanc), à l'échappement.
    if (f.boost || f.turbo) {
      const c = f.turbo ? [0.55, 0.85, 1] : [1, 0.6, 0.16];
      for (let k = this.rate("flame", f.turbo ? 150 : 100, dt); k > 0; k--) {
        const side = k % 2 === 0 ? 0.42 : -0.42;
        const back = -AXLE_REAR - 0.8;
        const wx = f.x + sinY * back + cosY * side;
        const wz = f.z + cosY * back - sinY * side;
        this.emitted.flame++;
        this.glow.spawn(wx, f.y + 0.6, wz, -sinY * (speed * 0.45 + 5) + rnd(-0.5, 0.5), rnd(-0.2, 0.7), -cosY * (speed * 0.45 + 5) + rnd(-0.5, 0.5), rnd(0.16, 0.3), f.turbo ? 0.8 : 0.6, -1.4, c[0]!, c[1]!, c[2]!, 0.9, 0, 1.5);
      }
    }
  }

  /** Réception d'un saut : couronne de poussière, d'autant plus grande que l'impact est fort ∈ [0, 1]. */
  landing(x: number, y: number, z: number, strength: number) {
    const n = Math.round(10 + 22 * strength * QUALITY_RATE[this.quality]);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = rnd(2, 5) * (0.5 + strength);
      this.emitted.land++;
      this.smoke.spawn(x + Math.cos(a) * 0.8, y + 0.15, z + Math.sin(a) * 0.8, Math.cos(a) * v, rnd(0.6, 1.8), Math.sin(a) * v, rnd(0.5, 0.9), 0.7, 2, 0.78, 0.74, 0.68, 0.5, 0, 2.2);
    }
  }

  /** Point de contrôle : gerbe d'étincelles bleues et blanches autour de la voiture. */
  checkpoint(x: number, y: number, z: number) {
    const n = Math.round(46 * QUALITY_RATE[this.quality]) + 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(3, 9);
      this.emitted.flash++;
      this.glow.spawn(x, y + rnd(0.6, 1.6), z, Math.cos(a) * v, rnd(2, 7), Math.sin(a) * v, rnd(0.5, 0.9), 0.35, -0.2, 0.5, 0.8, 1, 0.9, 9, 0.8);
    }
  }

  /** Arrivée : une pluie de confettis autour de la voiture. */
  confetti(x: number, y: number, z: number) {
    const n = Math.round(150 * QUALITY_RATE[this.quality]) + 20;
    for (let i = 0; i < n; i++) {
      const [r, g, b] = rgb(CONFETTI[i % CONFETTI.length]!);
      const a = Math.random() * Math.PI * 2;
      const d = rnd(0, 5);
      this.emitted.confetti++;
      this.smoke.spawn(x + Math.cos(a) * d, y + rnd(5, 9), z + Math.sin(a) * d, rnd(-1.5, 1.5), rnd(-2, 1), rnd(-1.5, 1.5), rnd(2.2, 3.2), 0.38, 0, r, g, b, 1, 4, 0.5);
    }
  }
}

/**
 * Qualité automatique : si les images sont trop lentes (intervalle moyen au-dessus de `slowMs`), on réduit particules et
 * traces ; si elles sont rapides pendant un moment, on remonte. Ne touche qu'aux effets, jamais à la simulation.
 */
export class QualityGovernor {
  level: Quality = 2;
  /** Intervalle moyen entre images (ms), lissé. */
  average = 16.7;
  private since = 0;
  private fast = 0;

  constructor(
    private readonly slowMs = 26,
    private readonly fastMs = 19,
    /** `true` : qualité figée (`?quality=`). */
    public locked = false,
  ) {}

  /** `ms` : durée de l'image qui vient de s'écouler. Renvoie vrai si le niveau a changé. */
  observe(ms: number): boolean {
    if (this.locked || ms <= 0 || ms > 500) return false; // 500 ms : onglet en pause, pas une mesure
    this.average += (ms - this.average) * 0.08;
    this.since += ms;
    if (this.since < 1000) return false;
    this.since = 0;
    if (this.average > this.slowMs && this.level > 0) {
      this.level = (this.level - 1) as Quality;
      this.fast = 0;
      return true;
    }
    this.fast = this.average < this.fastMs ? this.fast + 1 : 0;
    if (this.fast >= 4 && this.level < 2) {
      this.level = (this.level + 1) as Quality;
      this.fast = 0;
      return true;
    }
    return false;
  }
}
