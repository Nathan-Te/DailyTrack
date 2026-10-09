import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { blockPoint, type Block } from "@cdj/sim";

// Kit de maillage (lot 23, extrait de trackMesh.ts) : un constructeur de maillages fusionnés à couleurs par sommet, quelques outils de
// couleur, un générateur à graine et le passage du repère d'un bloc au monde. Présentation seule.

export type V3 = [number, number, number];

/** Halo (lot 23) : un point lumineux flou, posé par un constructeur et dessiné plus tard en un seul `Points`. */
export interface HaloSpec {
  x: number;
  y: number;
  z: number;
  color: number;
  size: number;
}

export class Builder {
  /** Halos à dessiner (lot 23) : lampadaires, néons, turbos, portes. */
  readonly halos: HaloSpec[] = [];
  halo(x: number, y: number, z: number, color: number, size: number) {
    if (this.mute) return;
    this.halos.push({ x, y, z, color, size });
  }

  readonly pos: number[] = [];
  readonly col: number[] = [];
  private readonly c = new Color();
  /** Muet : les formes ne sont pas construites (mais l'appelant a tiré ses nombres au hasard comme d'habitude). */
  mute = false;

  tri(a: V3, b: V3, c: V3, color: number) {
    if (this.mute) return;
    this.c.set(color);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: number) {
    if (this.mute) return;
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Boîte alignée sur les axes. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) {
    if (this.mute) return;
    const p = (x: number, y: number, z: number): V3 => [x, y, z];
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), color);
    this.quad(p(x0, y0, z1), p(x0, y1, z1), p(x1, y1, z1), p(x1, y0, z1), color);
    this.quad(p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1), color);
    this.quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), color);
    this.quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), color);
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y0, z0), color);
  }

  /**
   * Tronc de cône à `sides` facettes (pointe si `r1` ≈ 0), posé en (cx, y0, cz). Si `top` diffère de `color`, le tiers
   * supérieur prend la couleur `top` (neige sur un sapin, sommet clair d'une montagne, dessus d'un feuillage).
   */
  prism(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, sides: number, color: number, top = color, twist = 0) {
    if (this.mute) return;
    const ring = (r: number, y: number, k: number): V3 => {
      const a = twist + (k / sides) * Math.PI * 2;
      return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    };
    const split = top === color ? 1 : 0.58;
    const rm = r0 + (r1 - r0) * split;
    const ym = y0 + h * split;
    for (let k = 0; k < sides; k++) {
      const a0 = ring(r0, y0, k);
      const a1 = ring(r0, y0, k + 1);
      const m0 = ring(rm, ym, k);
      const m1 = ring(rm, ym, k + 1);
      this.quad(a0, a1, m1, m0, color);
      if (split < 1) {
        const t0 = ring(r1, y0 + h, k);
        const t1 = ring(r1, y0 + h, k + 1);
        this.quad(m0, m1, t1, t0, top);
      }
      if (r1 > 0.001) {
        const e0 = ring(r1, y0 + h, k);
        const e1 = ring(r1, y0 + h, k + 1);
        this.tri([cx, y0 + h, cz], e0, e1, top);
      }
    }
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Éclaircit (`f` > 1) ou assombrit (`f` < 1) une couleur 0xRRGGBB. */
export function shade(hex: number, f: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((hex >> 16) & 255) << 16) | (c((hex >> 8) & 255) << 8) | c(hex & 255);
}

/** Mélange deux couleurs : `t` = 0 → a, 1 → b. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Petit générateur à graine (mulberry32) : le décor est le même pour tout le monde, et ne touche jamais à `sim`. */
export function seeded(text: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
  let a = (h ^ (h >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


const pt = { x: 0, z: 0 };

/** Point du monde au repère (p, q) du bloc, à la hauteur `y`. */
export function world(b: Block, p: number, q: number, y: number): V3 {
  blockPoint(b, p, q, pt);
  return [pt.x, y, pt.z];
}

