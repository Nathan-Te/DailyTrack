// La lumière de chaque thème (direction C du lot 38, construite directement par le palier 1 depuis le lot 43 ; lot 44 : sortie de `directionC.ts`, qui
// est parti avec les directions) : ciel, brume, soleil, hémisphère, exposition, ombres, sol, lampes de la nuit ; l'occlusion par sommets et la flaque de lumière des lampadaires. Quelques nombres par thème et un passage sur les sommets.
import { CanvasTexture, type BufferGeometry } from "three";
import type { PaletteName } from "@cdj/sim";

/** La lumière d'un thème (C). */
export interface ThemeC {
  ciel: [zenith: number, haut: number, horizon: number];
  brume: [couleur: number, near: number, far: number];
  soleil: [couleur: number, intensite: number];
  hemi: [ciel: number, sol: number, intensite: number];
  ambiante: number;
  exposition: number;
  /** Ombres portées : intensité (0–1) et flou du bord (rayon PCF, 1 = net). */
  ombre: [intensite: number, rayon: number];
  /** Force de l'occlusion par sommets (0–1). */
  ao: number;
  /** Couleurs du sol lointain (texture du thème). */
  sol: [string, string];
  /** Teinte des silhouettes lointaines vers l'horizon (0 = inchangées). */
  silhouettes: number;
  /** Nuit : des lampes qui éclairent vraiment (lumières ponctuelles posées sur les lampadaires les plus proches de la voiture). */
  lampes?: { couleur: number; nombre: number; intensite: number; portee: number };
}

export const THEMES_C: Record<PaletteName, ThemeC> = {
  stade: { ciel: [0x1a63d6, 0x5aa2ec, 0xc4e6ff], brume: [0xc4e6ff, 190, 540], soleil: [0xfff6e6, 3.1], hemi: [0xd8ecff, 0x4f9a3a, 0.62], ambiante: 0.1, exposition: 1.0, ombre: [1, 1], ao: 0.55, sol: ["#4aa83a", "#56b544"], silhouettes: 0.25 },
  desert: { ciel: [0x2f8fd0, 0x9cc6dc, 0xf2c08a], brume: [0xf0c590, 90, 320], soleil: [0xffe2b0, 2.8], hemi: [0xffe8c8, 0xc8904c, 0.55], ambiante: 0.12, exposition: 1.02, ombre: [0.9, 1], ao: 0.5, sol: ["#d9a35f", "#c78f4c"], silhouettes: 0.35 },
  neige: { ciel: [0xb9cde0, 0xdbe6f0, 0xf2f6fa], brume: [0xeef3f7, 50, 230], soleil: [0xffffff, 1.2], hemi: [0xf4f9ff, 0xe6eef6, 1.3], ambiante: 0.2, exposition: 1.05, ombre: [0.35, 4], ao: 0.35, sol: ["#f4f8fb", "#e3ecf4"], silhouettes: 0.45 },
  nuit: { ciel: [0x010208, 0x050a22, 0x10193e], brume: [0x060a1c, 35, 180], soleil: [0x8ea6ff, 0.32], hemi: [0x1c2550, 0x05060f, 0.14], ambiante: 0.03, exposition: 1.0, ombre: [0.6, 1], ao: 0.6, sol: ["#0a0d1c", "#0a0d1c"], silhouettes: 0.2, lampes: { couleur: 0xffa94d, nombre: 4, intensite: 260, portee: 26 } },
  campagne: { ciel: [0x3f6fc4, 0xc9a7a0, 0xffc77a], brume: [0xf6c88a, 110, 360], soleil: [0xffb35c, 2.7], hemi: [0xffdcae, 0x5f8a34, 0.48], ambiante: 0.1, exposition: 1.0, ombre: [0.95, 1], ao: 0.5, sol: ["#6fb44c", "#5c9e3c"], silhouettes: 0.3 },
  canyon: { ciel: [0x4a3b8c, 0xb06a8a, 0xffa25a], brume: [0xf4a065, 90, 320], soleil: [0xff8a3c, 3.0], hemi: [0xffc49a, 0xa8552e, 0.5], ambiante: 0.1, exposition: 1.02, ombre: [1, 1], ao: 0.55, sol: ["#d49a55", "#b8743a"], silhouettes: 0.3 },
  alpin: { ciel: [0x0f4fb8, 0x4f95dc, 0xd6ecfa], brume: [0xd6ecfa, 170, 540], soleil: [0xfffaf0, 2.9], hemi: [0xdcecff, 0x6f9a5a, 0.58], ambiante: 0.1, exposition: 1.0, ombre: [0.95, 1], ao: 0.45, sol: ["#86b56f", "#74a25e"], silhouettes: 0.2 },
  ville: { ciel: [0x5f86b4, 0x9fb7cf, 0xd4dbe2], brume: [0xc9d1d9, 80, 300], soleil: [0xfff1d8, 2.0], hemi: [0xe6ecf5, 0x7c8088, 0.7], ambiante: 0.14, exposition: 0.98, ombre: [0.75, 2], ao: 0.65, sol: ["#9a9da4", "#8f9298"], silhouettes: 0.4 },
  neon: { ciel: [0x06000f, 0x1a0636, 0x3a0b66], brume: [0x14062a, 40, 200], soleil: [0xff9af0, 0.4], hemi: [0x4a2a80, 0x0a0518, 0.16], ambiante: 0.04, exposition: 1.0, ombre: [0.5, 1], ao: 0.6, sol: ["#1a0830", "#1a0830"], silhouettes: 0.2, lampes: { couleur: 0xff4fd8, nombre: 4, intensite: 220, portee: 24 } },
};

/**
 * Occlusion par sommets : sur chaque face pentue (mur, flanc, tronc, façade), les sommets du bas s'assombrissent jusqu'à `force` × 50 % sur 1,6 m
 * au-dessus du point le plus bas de la face. Une seule fois, à la construction ; rien par image. Les faces horizontales ne changent pas.
 */
export function occlusionSommets(g: BufferGeometry, force: number): void {
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  if (!pos || !col || g.index) return;
  const p = pos.array as ArrayLike<number>;
  const c = col.array as Float32Array;
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const ax = p[i * 3]!, ay = p[i * 3 + 1]!, az = p[i * 3 + 2]!;
    const bx = p[i * 3 + 3]! - ax, by = p[i * 3 + 4]! - ay, bz = p[i * 3 + 5]! - az;
    const cx = p[i * 3 + 6]! - ax, cy = p[i * 3 + 7]! - ay, cz = p[i * 3 + 8]! - az;
    const nx = by * cz - bz * cy;
    const ny = bz * cx - bx * cz;
    const nz = bx * cy - by * cx;
    const n = Math.hypot(nx, ny, nz) || 1;
    if (Math.abs(ny / n) > 0.6) continue;
    const y0 = Math.min(ay, ay + by, ay + cy);
    for (let k = 0; k < 3; k++) {
      const y = p[(i + k) * 3 + 1]!;
      const f = 1 - force * 0.5 * (1 - Math.min(1, (y - y0) / 1.6));
      for (let j = 0; j < 3; j++) c[(i + k) * 3 + j] = c[(i + k) * 3 + j]! * f;
    }
  }
  col.needsUpdate = true;
}

/** Flaque de lumière : un disque doux (la lumière, en 3D, peut avoir un dégradé : voir le document de direction). */
export function textureFlaque(couleur: number): CanvasTexture {
  const n = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const r = (couleur >> 16) & 255;
  const g = (couleur >> 8) & 255;
  const b = couleur & 255;
  const grad = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.22)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, n, n);
  return new CanvasTexture(canvas);
}
