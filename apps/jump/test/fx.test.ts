import { describe, expect, it } from "vitest";
import { BurstPool, PARTICLES_PER_BURST, PARTICLE_POOL, PARTICLE_LIFE, Shake } from "../src/fx";

// Effets de la mort (lot 2) : affichage seulement, mais un pool qui ne grandit jamais et un tremblement qui s'éteint.

describe("éclatement en particules", () => {
  it("un pool de taille fixe, recyclé : des dizaines de morts n'allouent rien de plus", () => {
    const pool = new BurstPool();
    const particles = pool.particles;
    for (let i = 0; i < 40; i++) pool.burst(i, 0);
    expect(pool.particles).toBe(particles);
    expect(pool.particles).toHaveLength(PARTICLE_POOL);
    expect(pool.emitted).toBe(40 * PARTICLES_PER_BURST);
    expect(pool.alive).toBe(PARTICLE_POOL);
  });

  it("les éclats partent du lieu de la mort, retombent et s'éteignent en moins d'une seconde", () => {
    const pool = new BurstPool();
    pool.burst(10, -5);
    expect(pool.alive).toBe(PARTICLES_PER_BURST);
    pool.update(1 / 60);
    const live = pool.particles.filter((p) => p.age < p.life);
    expect(Math.max(...live.map((p) => Math.hypot(p.x - 10, p.y + 5)))).toBeLessThan(1);
    for (let t = 0; t < 60; t++) pool.update(1 / 60);
    expect(PARTICLE_LIFE * 1.2).toBeLessThan(1);
    expect(pool.alive).toBe(0);
  });
});

describe("tremblement d'écran", () => {
  it("bref : il s'éteint en moins de 0,3 s, et ne fait rien sans mort", () => {
    const shake = new Shake();
    expect(shake.offset(1 / 60)).toEqual({ x: 0, y: 0 });
    shake.start();
    expect(shake.active).toBe(true);
    let max = 0;
    for (let t = 0; t < 18; t++) {
      const o = shake.offset(1 / 60);
      max = Math.max(max, Math.abs(o.x), Math.abs(o.y));
    }
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(0.35);
    expect(shake.active).toBe(false);
  });
});
