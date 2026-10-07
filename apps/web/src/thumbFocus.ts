import { THEMES, isCurve, trackCenterline, turnsLeft, type Block, type Signature, type ThemeName, type Track } from "@cdj/sim";

// Cadrage des miniatures (lot 13) : quelle portion du circuit montrer, et comment l'orienter. Logique pure (aucun DOM, aucun
// Three.js), donc testée par Vitest ; `thumbnail.ts` s'en sert pour la caméra 3D comme pour le repli 2D.

/** Nombre de blocs montrés : de quoi lire un enchaînement (≈ 250 m de route) sans réduire la route à un fil. */
export const FOCUS_BLOCKS = 8;
/** Marge autour de la route (m), en plus de sa demi-largeur (qui varie : 14, 20 ou 26 m) : rebords et un peu de décor. */
export const FOCUS_MARGIN = 4;

export interface Focus {
  /** Premier et dernier bloc de la portion (inclus). */
  from: number;
  to: number;
  /** Pourquoi cette portion : le passage signature du thème, ou la zone la plus sinueuse. */
  reason: "signature" | "winding";
  /** Points (x, y, z) de la route de la portion, élargis de la marge : tout doit entrer dans l'image. */
  points: [number, number, number][];
  /** Centre de la portion (x, z). */
  center: [number, number];
  /** « Droite de l'écran » dans le plan (vecteur unitaire x, z) : l'axe principal de la portion, orienté du départ vers l'arrivée. */
  right: [number, number];
}

const isTight = (b: Block) => b.kind === "curveL" || b.kind === "curveR";

/**
 * Blocs du passage signature du thème (voir `signatureParts`, generator.ts), ou `null` s'ils n'y sont pas :
 * super turbo puis grand virage relevé · tremplin sur la terre · chicane large sur la glace · moteur coupé et point de
 * contrôle · étranglement puis virage serré sur la terre.
 */
export function signatureBlocks(track: Track, sig: Signature): [number, number] | null {
  const bs = track.blocks;
  const find = (pred: (b: Block, i: number) => boolean) => bs.findIndex(pred);
  switch (sig) {
    case "turboBank": {
      const t = find((b) => b.kind === "turbo");
      if (t < 0) return null;
      const bank = find((b) => b.index > t && b.banked);
      return [t, bank > t ? bank : t];
    }
    case "dirtJump": {
      const j = find((b) => b.kind === "jump" && b.surface === "dirt");
      return j < 0 ? null : [j, j];
    }
    case "iceChicane": {
      const c = find((b, i) => isCurve(b.kind) && b.surface === "ice" && i + 1 < bs.length && isCurve(bs[i + 1]!.kind) && turnsLeft(b.kind) !== turnsLeft(bs[i + 1]!.kind));
      return c < 0 ? null : [c, c + 1];
    }
    case "cutRun": {
      const c = find((b) => b.kind === "cut");
      return c < 0 ? null : [c, Math.min(bs.length - 1, c + 3)];
    }
    case "dirtPinch": {
      // virage serré sur la terre, sur la route étroite (14 m) ; l'étranglement qui y mène (blocs de transition) est inclus
      const c = find((b) => isTight(b) && b.surface === "dirt" && b.w0 <= 14);
      if (c < 0) return null;
      let from = c;
      while (from > 0 && c - from < 4 && (bs[from - 1]!.w0 !== bs[from - 1]!.w1 || bs[from - 1]!.surface === "dirt")) from--;
      return [from, c];
    }
  }
}

/** Fenêtre de `size` blocs centrée sur [a0, a1], ramenée dans le circuit. */
function windowAround(n: number, a0: number, a1: number, size: number): [number, number] {
  const len = Math.min(n, size);
  const start = Math.max(0, Math.min(n - len, Math.round((a0 + a1) / 2 - (len - 1) / 2)));
  return [start, start + len - 1];
}

/** Portion de `size` blocs la plus sinueuse : le plus de virages, puis (à égalité) la plus compacte. */
function windiestWindow(track: Track, size: number): [number, number] {
  const bs = track.blocks;
  const n = bs.length;
  const len = Math.min(n, size);
  const line = trackCenterline(track);
  let best: [number, number] = [0, len - 1];
  let bestScore = -Infinity;
  for (let s = 0; s + len <= n; s++) {
    let curves = 0;
    for (let i = s; i < s + len; i++) if (isCurve(bs[i]!.kind)) curves++;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let k = 0; k < line.x.length; k++) {
      const b = line.block[k]!;
      if (b < s || b >= s + len) continue;
      x0 = Math.min(x0, line.x[k]!);
      x1 = Math.max(x1, line.x[k]!);
      z0 = Math.min(z0, line.z[k]!);
      z1 = Math.max(z1, line.z[k]!);
    }
    const area = (x1 - x0 + 64) * (z1 - z0 + 64);
    const score = curves * 1e6 - area; // les virages d'abord ; à égalité, la portion la plus ramassée
    if (score > bestScore) {
      bestScore = score;
      best = [s, s + len - 1];
    }
  }
  return best;
}

/** La portion à montrer pour un circuit du thème donné. */
export function pickFocus(track: Track, theme: ThemeName, size = FOCUS_BLOCKS): Focus {
  const n = track.blocks.length;
  const sig = signatureBlocks(track, THEMES[theme].signature);
  const [from, to] = sig ? windowAround(n, sig[0], sig[1], size) : windiestWindow(track, size);
  const line = trackCenterline(track);
  const points: [number, number, number][] = [];
  const path: [number, number][] = [];
  for (let k = 0; k < line.x.length; k++) {
    const b = line.block[k]!;
    if (b < from || b > to) continue;
    const blk = track.blocks[b]!;
    const m = Math.max(blk.w0, blk.w1) / 2 + FOCUS_MARGIN;
    const x = line.x[k]!;
    const y = line.y[k]!;
    const z = line.z[k]!;
    path.push([x, z]);
    points.push([x - m, y, z - m], [x + m, y, z - m], [x - m, y, z + m], [x + m, y, z + m]);
  }
  // Axe principal (moindres carrés) du tracé, orienté du premier au dernier point : il devient l'horizontale de l'écran,
  // le format 16:9 est fait pour ça.
  let cx = 0;
  let cz = 0;
  for (const [x, z] of path) {
    cx += x;
    cz += z;
  }
  cx /= path.length;
  cz /= path.length;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, z] of path) {
    sxx += (x - cx) * (x - cx);
    szz += (z - cz) * (z - cz);
    sxz += (x - cx) * (z - cz);
  }
  // Direction propre de la matrice [[sxx, sxz], [sxz, szz]] : sans trigonométrie, par la formule des valeurs propres.
  const tr = sxx + szz;
  const det = sxx * szz - sxz * sxz;
  const lambda = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  let rx = sxz !== 0 ? lambda - szz : sxx >= szz ? 1 : 0;
  let rz = sxz !== 0 ? sxz : sxx >= szz ? 0 : 1;
  const norm = Math.sqrt(rx * rx + rz * rz) || 1;
  rx /= norm;
  rz /= norm;
  const first = path[0]!;
  const last = path[path.length - 1]!;
  if ((last[0] - first[0]) * rx + (last[1] - first[1]) * rz < 0) {
    rx = -rx;
    rz = -rz;
  }
  return { from, to, reason: sig ? "signature" : "winding", points, center: [cx, cz], right: [rx, rz] };
}
