import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3, type Object3D } from "three";

// Effets de la mort (lot 2), **affichage seulement** : éclatement en particules de la couleur du personnage (un pool recyclé, jamais
// d'objet créé pendant le jeu) et court tremblement d'écran. Les deux se coupent par `?fx=off`. Rien ici ne lit ni n'écrit la simulation :
// on reçoit une position et une couleur, c'est tout. Le hasard des éclats vient d'un petit générateur maison (l'aspect seul en dépend).

/** Taille du pool : deux morts qui se chevauchent tiennent dedans. */
export const PARTICLE_POOL = 64;
/** Éclats par mort. */
export const PARTICLES_PER_BURST = 28;
/** Durée de vie d'un éclat (s). */
export const PARTICLE_LIFE = 0.55;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
}

/** Logique des éclats, sans Three.js (testée) : positions en tuiles, y vers le haut. */
export class BurstPool {
  readonly particles: Particle[] = [];
  private next = 0;
  private seed = 12345;
  /** Éclats émis depuis le départ (pour `__jump.fx`). */
  emitted = 0;

  constructor(readonly size = PARTICLE_POOL) {
    for (let i = 0; i < size; i++) this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, age: 1, life: 0, size: 0, spin: 0 });
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return this.seed / 4294967296;
  }

  /** Éclatement en (x, y) : les plus vieux éclats sont réutilisés si le pool est plein. */
  burst(x: number, y: number, count = PARTICLES_PER_BURST): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.next]!;
      this.next = (this.next + 1) % this.size;
      const a = this.rand() * Math.PI * 2;
      const speed = 6 + this.rand() * 12;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed + 5;
      p.age = 0;
      p.life = PARTICLE_LIFE * (0.6 + this.rand() * 0.6);
      p.size = 0.12 + this.rand() * 0.16;
      p.spin = (this.rand() - 0.5) * 20;
      this.emitted++;
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.vy -= 40 * dt;
      p.vx *= 1 - 2.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  get alive(): number {
    return this.particles.filter((p) => p.age < p.life).length;
  }

  clear(): void {
    for (const p of this.particles) p.age = p.life = 0;
  }
}

/** Tremblement d'écran : une amplitude qui décroît linéairement en `duration` s (lot 14), un décalage pseudo-aléatoire par image. */
export class Shake {
  private amp = 0;
  private t = 0;
  private decay = 1;
  start(amplitude = 0.1, duration = 0.12): void {
    if (!(amplitude > 0) || !(duration > 0)) return;
    if (amplitude >= this.amp) this.decay = amplitude / duration;
    this.amp = Math.max(this.amp, amplitude);
  }
  /** Décalage (tuiles) pour cette image. */
  offset(dt: number): { x: number; y: number } {
    this.t += dt;
    this.amp = Math.max(0, this.amp - dt * this.decay);
    if (this.amp === 0) return { x: 0, y: 0 };
    return { x: Math.sin(this.t * 71) * this.amp, y: Math.cos(this.t * 53) * this.amp };
  }
  get active(): boolean {
    return this.amp > 0;
  }
}

/** Les éclats à l'écran : un seul `InstancedMesh`, mis à jour à chaque image. */
export class BurstMesh {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly hide = new Matrix4().makeScale(0, 0, 0);
  private readonly scale = new Vector3();

  constructor(
    readonly pool: BurstPool,
    color: number,
    parent: Object3D,
  ) {
    this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: new Color(color), transparent: true }), pool.size);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.position.z = 0.4;
    parent.add(this.mesh);
    this.sync();
  }

  sync(): void {
    let i = 0;
    for (const p of this.pool.particles) {
      if (p.age >= p.life) this.mesh.setMatrixAt(i, this.hide);
      else {
        const k = 1 - p.age / p.life;
        const s = p.size * (0.4 + 0.6 * k);
        this.m.makeRotationZ(p.spin * p.age);
        this.m.scale(this.scale.set(s, s, 1));
        this.m.setPosition(p.x, p.y, 0);
        this.mesh.setMatrixAt(i, this.m);
      }
      i++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
