// Retouche 38b — bruits périodiques (ils se répètent sans couture) pour les textures calculées au chargement : matières (palier 2), nuages
// (palier 3). Purs : la même graine donne la même texture partout.

/** Petit générateur à graine (les textures sont les mêmes pour tout le monde). */
export function graine(n: number): () => number {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit de valeur périodique (il se répète sans couture) : `cellules` mailles par côté, interpolation douce. Valeurs dans [0, 1]. */
export function bruit(n: number, cellules: number, rnd: () => number): Float32Array {
  const grille = new Float32Array(cellules * cellules);
  for (let i = 0; i < grille.length; i++) grille[i] = rnd();
  const out = new Float32Array(n * n);
  const lisse = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) {
    const fy = (y / n) * cellules;
    const y0 = Math.floor(fy);
    const ty = lisse(fy - y0);
    const ya = (y0 % cellules) * cellules;
    const yb = ((y0 + 1) % cellules) * cellules;
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cellules;
      const x0 = Math.floor(fx);
      const tx = lisse(fx - x0);
      const xa = x0 % cellules;
      const xb = (x0 + 1) % cellules;
      const a = grille[ya + xa]! + (grille[ya + xb]! - grille[ya + xa]!) * tx;
      const b = grille[yb + xa]! + (grille[yb + xb]! - grille[yb + xa]!) * tx;
      out[y * n + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Bruit fractal : `octaves` bruits de plus en plus fins, normalisé dans [0, 1]. */
export function fractal(n: number, base: number, octaves: number, rnd: () => number): Float32Array {
  const out = new Float32Array(n * n);
  let amp = 1;
  let total = 0;
  for (let o = 0, c = base; o < octaves && c <= n; o++, c *= 2) {
    const b = bruit(n, c, rnd);
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + b[i]! * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / total;
  return out;
}

