// Tampon de géométrie **pur** (lot 9) : positions, couleurs par sommet et indices, sans Three.js. Les tuiles, le décor et la parallaxe s'y
// construisent une fois, au chargement ; `scene.ts` en fait une `BufferGeometry` par tronçon (un appel de dessin chacun). Rien n'est créé
// pendant le jeu.
//
// Couleurs : une couleur 0xRRGGBB est donnée en sRGB et rangée **linéaire** (comme `Color.setHex` de Three.js : les couleurs de sommet
// sont lues dans l'espace de travail linéaire), pour que l'image montre exactement la couleur du thème.

const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const s = i / 255;
  LINEAR[i] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export class Art {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly idx: number[] = [];
  /** Nombre de triangles écrits (mesure). */
  triangles = 0;

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  vertex(x: number, y: number, z: number, rgb: number): number {
    this.pos.push(x, y, z);
    this.col.push(LINEAR[(rgb >> 16) & 255]!, LINEAR[(rgb >> 8) & 255]!, LINEAR[rgb & 255]!);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
    this.triangles++;
  }

  /** Rectangle [x0, x1] × [y0, y1] (y vers le haut), une couleur, ou quatre (bas-gauche, bas-droite, haut-droite, haut-gauche). */
  rect(x0: number, y0: number, x1: number, y1: number, z: number, rgb: number | readonly [number, number, number, number]): void {
    const c = typeof rgb === "number" ? [rgb, rgb, rgb, rgb] : rgb;
    const a = this.vertex(x0, y0, z, c[0]!);
    const b = this.vertex(x1, y0, z, c[1]!);
    const d = this.vertex(x1, y1, z, c[2]!);
    const e = this.vertex(x0, y1, z, c[3]!);
    this.tri(a, b, d);
    this.tri(a, d, e);
  }

  /** Quadrilatère quelconque (sommets dans l'ordre). */
  quad(pts: readonly number[], z: number, rgb: number): void {
    const v = [0, 1, 2, 3].map((k) => this.vertex(pts[k * 2]!, pts[k * 2 + 1]!, z, rgb));
    this.tri(v[0]!, v[1]!, v[2]!);
    this.tri(v[0]!, v[2]!, v[3]!);
  }

  /** Polygone convexe en éventail depuis (cx, cy) ; `colors` : une couleur par point du contour (ou une seule). */
  fan(cx: number, cy: number, pts: readonly number[], z: number, center: number, colors: number | readonly number[]): void {
    const c0 = this.vertex(cx, cy, z, center);
    const n = pts.length / 2;
    const first = this.pos.length / 3;
    for (let k = 0; k < n; k++) this.vertex(pts[k * 2]!, pts[k * 2 + 1]!, z, typeof colors === "number" ? colors : colors[k]!);
    for (let k = 0; k < n; k++) this.tri(c0, first + k, first + ((k + 1) % n));
  }

  /** Disque plein de rayon `r` (`seg` côtés). */
  disc(x: number, y: number, r: number, z: number, rgb: number, seg = 10): void {
    const pts: number[] = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    this.fan(x, y, pts, z, rgb, rgb);
  }

  /** Demi-disque bombé vers le haut (côté plat en bas, à `y`). */
  half(x: number, y: number, r: number, z: number, rgb: number, seg = 8): void {
    const pts: number[] = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    this.fan(x, y, pts, z, rgb, rgb);
  }

  /** Bande entre deux arcs (rayons `r0` < `r1`) autour de (cx, cy), de l'angle `a0` à `a1`. */
  arcBand(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, z: number, rgb: number, seg = 4): void {
    let prevIn = -1;
    let prevOut = -1;
    for (let k = 0; k <= seg; k++) {
      const a = a0 + ((a1 - a0) * k) / seg;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const vin = this.vertex(cx + cos * r0, cy + sin * r0, z, rgb);
      const vout = this.vertex(cx + cos * r1, cy + sin * r1, z, rgb);
      if (k > 0) {
        this.tri(prevIn, prevOut, vout);
        this.tri(prevIn, vout, vin);
      }
      prevIn = vin;
      prevOut = vout;
    }
  }

  /** Bornes horizontales des sommets écrits (pour le découpage en tronçons et les tests). */
  bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < this.pos.length; i += 3) {
      minX = Math.min(minX, this.pos[i]!);
      maxX = Math.max(maxX, this.pos[i]!);
      minY = Math.min(minY, this.pos[i + 1]!);
      maxY = Math.max(maxY, this.pos[i + 1]!);
    }
    return { minX, maxX, minY, maxY };
  }
}
