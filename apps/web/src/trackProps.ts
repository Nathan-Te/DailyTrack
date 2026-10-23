// Glyphes des panneaux de piste (lot 23) : le style d'un panneau selon ce qu'il annonce, et le dessin de ses chevrons, de sa rampe ou de sa cuve.
// Présentation seule. Lot 43 : les accessoires de l'ancienne scène (arches, portes, panneaux sur poteau, bandeaux) sont partis avec elle dans
// `scene/existant.ts`, chargé à la demande ; ne restent ici que les glyphes, que le palier 1 (premier chargement) dessine aussi.
import { CUVE_LEFT, CUVE_RIGHT } from "@cdj/sim";
import type { Builder, V3 } from "./meshKit";
import type { SignKind } from "./signage";

export interface SignStyle {
  plate: number;
  ink: number;
  border: number;
}

export const SIGN_STYLES: Record<string, SignStyle> = {
  yellow: { plate: 0xffc61a, ink: 0x14161c, border: 0x14161c },
  orange: { plate: 0xff8a1a, ink: 0x14161c, border: 0x14161c },
  red: { plate: 0xe8283a, ink: 0xffffff, border: 0xffffff },
  blue: { plate: 0x1f6fd0, ink: 0xffffff, border: 0xffffff },
};

export function signStyleOf(kind: SignKind, severity: 1 | 2 | 3): keyof typeof SIGN_STYLES {
  if (kind === "cuve") return "blue";
  if (kind === "jump") return "orange";
  return severity === 3 ? "red" : severity === 2 ? "orange" : "yellow";
}

export type P2 = [number, number];

/** Pose d'un panneau : centre, et les trois axes du monde (vers la droite du conducteur, vers le haut, vers le conducteur). */
export interface Plane {
  c: V3;
  right: V3;
  up: V3;
  toward: V3;
}

export function pointOn(pl: Plane, u: number, v: number, depth: number): V3 {
  return [pl.c[0] + pl.right[0] * u + pl.up[0] * v + pl.toward[0] * depth, pl.c[1] + pl.right[1] * u + pl.up[1] * v + pl.toward[1] * depth, pl.c[2] + pl.right[2] * u + pl.up[2] * v + pl.toward[2] * depth];
}

export function poly(g: Builder, pl: Plane, pts: P2[], depth: number, color: number) {
  // éventail depuis le premier point (les formes utilisées sont convexes ou découpées avant)
  for (let i = 1; i + 1 < pts.length; i++) g.tri(pointOn(pl, ...pts[0]!, depth), pointOn(pl, ...pts[i]!, depth), pointOn(pl, ...pts[i + 1]!, depth), color);
}

export const rect = (u0: number, v0: number, u1: number, v1: number): P2[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

/** Un chevron « > » (pointe à droite pour `dir` = 1, à gauche pour −1), centré en `u0`. */
function chevron(g: Builder, pl: Plane, u0: number, dir: 1 | -1, scale: number, depth: number, color: number) {
  const m = (u: number, v: number): P2 => [u0 + dir * u * scale, v * scale];
  poly(g, pl, [m(-0.34, 0.62), m(0.02, 0.62), m(0.46, 0), m(0.1, 0)], depth, color);
  poly(g, pl, [m(0.1, 0), m(0.46, 0), m(0.02, -0.62), m(-0.34, -0.62)], depth, color);
}

/** Glyphe d'un panneau, dans l'espace (u, v) ∈ [−0.9, 0.9]². `cuve` : bits de la paroi annoncée. */
export function drawGlyph(g: Builder, pl: Plane, kind: SignKind, severity: 1 | 2 | 3, cuve: number, depth: number, ink: number) {
  if (kind === "left" || kind === "right") {
    const dir = kind === "right" ? 1 : -1;
    const n = severity; // 1 ample, 2 large, 3 serré : autant de chevrons
    const scale = n === 1 ? 1.05 : n === 2 ? 0.85 : 0.74;
    const step = n === 1 ? 0 : n === 2 ? 0.46 : 0.4;
    for (let i = 0; i < n; i++) chevron(g, pl, (i - (n - 1) / 2) * step * dir, dir, scale, depth, ink);
  } else if (kind === "jump") {
    // un tremplin : la rampe qui monte vers la droite, et un trait de ciel au-dessus
    poly(g, pl, [[-0.62, -0.42], [0.62, -0.42], [0.62, 0.3]], depth, ink);
    poly(g, pl, rect(-0.62, -0.58, 0.62, -0.46), depth, ink);
    poly(g, pl, [[0.12, 0.5], [0.5, 0.5], [0.5, 0.12]], depth, ink);
  } else {
    // une cuve : un « U » dont la paroi annoncée est plus haute
    const hl = (cuve & CUVE_LEFT) !== 0;
    const hr = (cuve & CUVE_RIGHT) !== 0;
    poly(g, pl, rect(-0.56, -0.55, 0.56, -0.33), depth, ink);
    poly(g, pl, rect(-0.56, -0.55, -0.34, hl ? 0.6 : 0.05), depth, ink);
    poly(g, pl, rect(0.34, -0.55, 0.56, hr ? 0.6 : 0.05), depth, ink);
    if (!hl && !hr) {
      poly(g, pl, rect(-0.56, -0.55, -0.34, 0.6), depth, ink);
      poly(g, pl, rect(0.34, -0.55, 0.56, 0.6), depth, ink);
    }
  }
}
