import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3, type Object3D } from "three";
import type { GameEvent } from "./events";
import type { Palette } from "./palette";
import type { FeelLevels } from "./settings";

// Sensations du lot 8, **affichage seulement** : particules (poussière, frottement, débris, éclat du ressort, confettis), traînée à pleine
// vitesse, clignement des yeux, secousse des grosses chutes, vibrations. Tout s'abonne aux événements de jeu (`events.ts`), rien ne lit ni
// n'écrit la simulation (sauf la position du personnage, lue pour poser le frottement de la glisse et la traînée). Tout est plafonné et
// recyclé (pools : jamais d'objet créé pendant le jeu). Le hasard de l'aspect vient d'un petit générateur maison.

/** Taille du pool de particules (toutes sortes confondues). */
export const FEEL_POOL = 220;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  /** Accélération verticale (tuiles/s², y vers le haut) et freinage (1/s). */
  gravity: number;
  drag: number;
  color: number;
}

/** Pool de particules (logique, testée) : positions en tuiles, **y vers le haut** (le monde affiché). */
export class Particles {
  readonly items: Particle[] = [];
  private next = 0;
  private seed = 0x2468ace;
  emitted = 0;
  /** Part gardée de chaque émission (réglage « effets ») ; 0 : rien n'est émis. */
  amount = 1;

  constructor(readonly size = FEEL_POOL) {
    for (let i = 0; i < size; i++) this.items.push({ x: 0, y: 0, vx: 0, vy: 0, age: 1, life: 0, size: 0, spin: 0, gravity: 0, drag: 0, color: 0 });
  }

  rand(): number {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return this.seed / 4294967296;
  }

  /** Nombre réellement émis pour `count` demandés (au moins 1 si la part est non nulle et `count` ≥ 1). */
  scaled(count: number): number {
    if (this.amount <= 0 || count <= 0) return 0;
    return Math.max(1, Math.round(count * this.amount));
  }

  /**
   * `count` particules en (x, y) : vitesse dans un cône (`angle` au centre, `spread` de chaque côté, rad), norme dans [vmin, vmax].
   * Le pool plein, les plus vieilles sont réutilisées.
   */
  emit(o: { x: number; y: number; count: number; angle: number; spread: number; vmin: number; vmax: number; life: number; size: number; gravity: number; drag: number; colors: readonly number[]; jitter?: number }): number {
    const n = this.scaled(o.count);
    for (let i = 0; i < n; i++) {
      const p = this.items[this.next]!;
      this.next = (this.next + 1) % this.size;
      const a = o.angle + (this.rand() * 2 - 1) * o.spread;
      const v = o.vmin + this.rand() * (o.vmax - o.vmin);
      const j = o.jitter ?? 0;
      p.x = o.x + (this.rand() - 0.5) * j;
      p.y = o.y + (this.rand() - 0.5) * j * 0.5;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.age = 0;
      p.life = o.life * (0.7 + this.rand() * 0.6);
      p.size = o.size * (0.7 + this.rand() * 0.6);
      p.spin = (this.rand() - 0.5) * 16;
      p.gravity = o.gravity;
      p.drag = o.drag;
      p.color = o.colors[Math.floor(this.rand() * o.colors.length)] ?? 0xffffff;
      this.emitted++;
    }
    return n;
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.vy += p.gravity * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  get alive(): number {
    let n = 0;
    for (const p of this.items) if (p.age < p.life) n++;
    return n;
  }

  clear(): void {
    for (const p of this.items) p.age = p.life = 0;
  }
}

/** Les particules à l'écran : un `InstancedMesh` à couleur par instance, mis à jour à chaque image (un seul appel de dessin). */
export class ParticleMesh {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly hide = new Matrix4().makeScale(0, 0, 0);
  private readonly scale = new Vector3();
  private readonly color = new Color();
  private readonly colors: number[];

  constructor(
    readonly pool: Particles,
    parent: Object3D,
  ) {
    this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: 0xffffff }), pool.size);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.position.z = 0.35;
    this.colors = pool.items.map(() => -1);
    for (let i = 0; i < pool.size; i++) this.mesh.setColorAt(i, this.color.set(0xffffff));
    parent.add(this.mesh);
    this.sync();
  }

  sync(): void {
    let i = 0;
    let recolor = false;
    for (const p of this.pool.items) {
      if (p.age >= p.life) this.mesh.setMatrixAt(i, this.hide);
      else {
        const k = 1 - p.age / p.life;
        const s = p.size * (0.3 + 0.7 * k);
        this.m.makeRotationZ(p.spin * p.age);
        this.m.scale(this.scale.set(s, s, 1));
        this.m.setPosition(p.x, p.y, 0);
        this.mesh.setMatrixAt(i, this.m);
        if (this.colors[i] !== p.color) {
          this.colors[i] = p.color;
          this.mesh.setColorAt(i, this.color.set(p.color));
          recolor = true;
        }
      }
      i++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (recolor && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Mélange de deux couleurs (0 : a, 1 : b). */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

const UP = Math.PI / 2;

/** Couleurs des effets, tirées de la palette du jour. */
export interface FeelColors {
  dust: readonly number[];
  spark: readonly number[];
  crumble: readonly number[];
  spring: readonly number[];
  confetti: readonly number[];
}

export function feelColors(p: Palette): FeelColors {
  return {
    dust: [mixColor(p.tile, 0xffffff, 0.55), mixColor(p.tile, p.background, 0.2), mixColor(p.tile, 0xffffff, 0.3)],
    spark: [0xffffff, mixColor(p.player, 0xffffff, 0.5)],
    crumble: [p.crumble, mixColor(p.crumble, 0x000000, 0.35), mixColor(p.crumble, 0xffffff, 0.3)],
    spring: [p.spring, 0xffffff],
    confetti: [p.finish, p.spring, p.hazard, p.player, 0xffffff, 0x39ff88],
  };
}

/** Secousse d'une grosse chute : à partir de cette intensité (vitesse de chute ÷ chute maximale). */
export const BIG_FALL = 0.85;

/** Ce que les effets demandent à la caméra et au téléphone. */
export interface FeelOutput {
  /** Amplitude de secousse à lancer (tuiles), 0 : aucune. */
  shake: number;
  /** Motif de vibration (ms), null : aucune. */
  vibrate: number | number[] | null;
}

/** Vibration d'un événement (null : aucune). Très courtes. Seulement pour la partie du joueur (ni carnage, ni lecture). */
export function vibrationFor(e: GameEvent): number | number[] | null {
  if (e.source !== "jeu") return null;
  if (e.kind === "mort") return 35;
  if (e.kind === "atterrissage" && e.intensity >= BIG_FALL) return 18;
  if (e.kind === "arrivee") return [25, 50, 40];
  return null;
}

/**
 * Particules d'un événement (dans `pool`), et ce qu'il demande à la caméra (secousse) et au téléphone (vibration). Les autres vies du
 * carnage n'ont pas de particules ici (leurs morts éclatent dans le pool du carnage).
 */
export function feelEvent(e: GameEvent, pool: Particles, colors: FeelColors, levels: FeelLevels): FeelOutput {
  const out: FeelOutput = { shake: 0, vibrate: levels.vibration ? vibrationFor(e) : null };
  if (e.source === "vie") return out;
  const x = e.x;
  const y = -e.y; // monde affiché : y vers le haut
  const dust = { life: 0.45, size: 0.18, gravity: 3, drag: 4, colors: colors.dust };
  switch (e.kind) {
    case "saut":
      pool.emit({ ...dust, x, y, count: 6, angle: UP, spread: 1.3, vmin: 1.5, vmax: 4, jitter: 0.5 });
      break;
    case "sautMural":
      // Bouffée contre le mur quitté.
      pool.emit({ ...dust, x: x + e.side * 0.4, y, count: 7, angle: e.side < 0 ? 0 : Math.PI, spread: 0.9, vmin: 2, vmax: 5, jitter: 0.6 });
      break;
    case "atterrissage": {
      const n = Math.round(2 + 10 * e.intensity);
      pool.emit({ ...dust, x, y, count: n, angle: UP, spread: 1.45, vmin: 1 + 5 * e.intensity, vmax: 3 + 8 * e.intensity, jitter: 0.6 });
      if (e.intensity >= BIG_FALL) out.shake = 0.12 + 0.2 * Math.min(1, (e.intensity - BIG_FALL) / (1 - BIG_FALL));
      break;
    }
    case "pas":
      // Poussière de course à pleine vitesse seulement.
      if (e.full && levels.continuous) pool.emit({ ...dust, life: 0.35, size: 0.14, x, y: y + 0.05, count: 2, angle: UP, spread: 0.9, vmin: 0.8, vmax: 2, jitter: 0.3 });
      break;
    case "derapage":
      // Lot 8b : poussière soulevée devant, dans le sens du mouvement (le pied avant freine).
      pool.emit({ ...dust, life: 0.4, size: 0.15, x: x + e.side * 0.3, y: y + 0.05, count: 6, angle: e.side > 0 ? 0.55 : Math.PI - 0.55, spread: 0.45, vmin: 1.5, vmax: 4.5, jitter: 0.25 });
      break;
    case "friableCraque":
      pool.emit({ x, y: y + 0.4, count: 3, angle: UP, spread: 1, vmin: 1, vmax: 3, life: 0.4, size: 0.12, gravity: -25, drag: 1, colors: colors.crumble, jitter: 0.8 });
      break;
    case "friableTombe":
      pool.emit({ x, y, count: 9, angle: -UP, spread: 1.4, vmin: 1, vmax: 5, life: 0.75, size: 0.24, gravity: -30, drag: 0.5, colors: colors.crumble, jitter: 0.8 });
      break;
    case "ressort":
      pool.emit({ x, y, count: 10, angle: UP, spread: 1.2, vmin: 4, vmax: 9, life: 0.35, size: 0.12, gravity: -8, drag: 5, colors: colors.spring, jitter: 0.6 });
      break;
    case "arrivee":
      pool.emit({ x, y: y + 1, count: 46, angle: UP, spread: 1.1, vmin: 6, vmax: 14, life: 1.7, size: 0.2, gravity: -16, drag: 1.6, colors: colors.confetti, jitter: 0.6 });
      break;
    case "mort":
      if (e.source === "jeu") out.shake = 0.35;
      break;
    default:
      break;
  }
  out.shake *= levels.shake;
  return out;
}

/** Frottement de la glisse murale, émis en continu (une particule tous les `SLIDE_EVERY` s) tant qu'elle dure. */
export const SLIDE_EVERY = 0.05;

/** Le frottement : `x`, `y` = point de contact (tuiles, y vers le haut), `side` = côté du mur. */
export function slideSpark(pool: Particles, colors: FeelColors, x: number, y: number, side: number): void {
  pool.emit({ x, y, count: 1, angle: UP, spread: 0.5, vmin: 0.6, vmax: 1.8, life: 0.3, size: 0.12, gravity: 2, drag: 3, colors: side ? colors.spark.concat(colors.dust) : colors.dust, jitter: 0.3 });
}

// ——— Traînée et clignement ———

/** Nombre d'images de la traînée et intervalle entre deux (s). */
export const TRAIL_LENGTH = 5;
export const TRAIL_EVERY = 0.03;

/** Opacité de la première image de la traînée (lot 8b : 0,14 au lieu de 0,24, plus discrète). */
export const TRAIL_ALPHA = 0.14;

/** Lot 8c : force de la traînée en élan plein (de 1 à la course jusqu'à celle-ci à `sprintSpeed`). */
export const TRAIL_SPRINT_STRENGTH = 2.4;

/**
 * Force de la traînée (lot 8c) : 1 à la course, puis elle monte avec la vitesse jusqu'à `TRAIL_SPRINT_STRENGTH` en élan plein (`top` :
 * vitesse d'élan) ; 0 sous la course (pas de traînée).
 */
export function trailStrength(speed: number, runSpeed: number, top: number): number {
  if (speed < runSpeed) return 0;
  if (top <= runSpeed) return 1;
  const k = Math.min(1, (speed - runSpeed) / (top - runSpeed));
  return 1 + (TRAIL_SPRINT_STRENGTH - 1) * k * k;
}

/**
 * Traînée à pleine vitesse : les dernières positions, de plus en plus pâles ; elle s'efface d'elle-même à l'arrêt. Lot 8b : seulement à
 * pleine vitesse ou en élan (`active`), plus marquée en élan (`strength`, lot 8c : de 1 à `TRAIL_SPRINT_STRENGTH` en élan plein).
 */
export class Trail {
  readonly points: { x: number; y: number; alpha: number }[] = [];
  private since = 0;
  private fade = 0;
  private strength = 1;

  update(dt: number, x: number, y: number, active: boolean, strength = 1): void {
    this.strength = Math.max(0, Math.min(TRAIL_SPRINT_STRENGTH, strength));
    this.fade = Math.max(0, Math.min(1, this.fade + (active ? dt * 6 : -dt * 5)));
    this.since += dt;
    if (this.since >= TRAIL_EVERY) {
      this.since = 0;
      this.points.unshift({ x, y, alpha: 1 });
      if (this.points.length > TRAIL_LENGTH) this.points.length = TRAIL_LENGTH;
    }
    for (let i = 0; i < this.points.length; i++) this.points[i]!.alpha = this.fade * TRAIL_ALPHA * this.strength * (1 - i / TRAIL_LENGTH);
  }

  clear(): void {
    this.points.length = 0;
    this.fade = 0;
  }
}

/** Clignement : les yeux se ferment 0,12 s toutes les 2,2 à 5,2 s (hasard de l'affichage). `closed` ∈ [0, 1]. */
export class Blink {
  private wait = 2.5;
  private t = 0;
  private seed = 0x13579b;
  closed = 0;
  update(dt: number): number {
    this.t += dt;
    if (this.t >= this.wait) {
      const k = (this.t - this.wait) / 0.12;
      this.closed = k < 0.5 ? k * 2 : Math.max(0, 2 - k * 2);
      if (k >= 1) {
        this.t = 0;
        this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
        this.wait = 2.2 + (this.seed / 4294967296) * 3;
        this.closed = 0;
      }
    } else this.closed = 0;
    return this.closed;
  }
}

/** Délai minimal entre deux vibrations (ms) : jamais de bourdonnement continu. */
export const VIBRATE_GAP_MS = 120;

/** Vibreur protégé : rien sur un appareil sans `navigator.vibrate` (iPhone), jamais deux vibrations à moins de `VIBRATE_GAP_MS`. */
export class Vibrator {
  private last = -Infinity;
  count = 0;
  constructor(private readonly fn: ((p: number | number[]) => boolean) | null) {}
  play(pattern: number | number[], nowMs: number): boolean {
    if (!this.fn || nowMs - this.last < VIBRATE_GAP_MS) return false;
    this.last = nowMs;
    try {
      this.fn(pattern);
      this.count++;
      return true;
    } catch {
      return false;
    }
  }
}
