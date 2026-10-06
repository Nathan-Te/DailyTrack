/** Générateur pseudo-aléatoire à graine explicite (mulberry32) : entiers uniquement, identique partout. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Entier non signé sur 32 bits. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Entier uniforme dans [0, n). */
  int(n: number): number {
    return this.next() % n;
  }

  /** Vrai avec une probabilité de `percent` %. */
  chance(percent: number): boolean {
    return this.int(100) < percent;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }

  /** Mélange de Fisher-Yates (copie). */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

/** Mélange deux entiers en une graine (pour dériver une graine par jour et par tentative). */
export function mixSeed(a: number, b: number): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
