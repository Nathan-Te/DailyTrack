import { TILE_EMPTY, TILE_SOLID, isSpikeTile, type Level } from "@cdj/jump-sim";
import { Art } from "./artKit";
import { cellNoise, depthMap, neighbourMask, tileShape, type TileShape } from "./autotile";
import { mix } from "./contrast";
import { keepoutField, keepouts, type Keepout } from "./decor";
import { depthColor, type TileStyle } from "./themes";

// Dessin des blocs pleins (lot 9), **pur** : chaque tuile `#` selon ses 8 voisins (`autotile.ts`) — coins extérieurs arrondis ou chanfreinés,
// coins intérieurs raccordés, contour clair sur les faces exposées (plus clair dessus, plus sombre dessous), garniture du thème sur les
// faces du dessus, plein qui s'assombrit avec la profondeur (couleur par sommet : un dégradé, pas des carrés) et un motif procédural
// déterministe à l'intérieur. Tout est **fusionné** : un tampon par tronçon de `CHUNK_COLUMNS` colonnes (un appel de dessin chacun,
// écarté par la caméra hors champ). La géométrie ne déborde jamais d'une tuile, sauf de petites bosses de garniture (≤ `TRIM_BUMP`)
// au-dessus d'une face libre.
//
// Lisibilité : une face qui porte un pic n'a **ni contour ni garniture** (le pic, cerné de sombre, s'y détache sur le plein sombre) ; pas de
// bosse de garniture à moins de 1,5 tuile d'un danger, d'un ressort, d'un fanion ou de l'arrivée.

export const CHUNK_COLUMNS = 32;
/** Largeur des contours (tuiles) : dessus, côtés, dessous. */
export const RIM = { top: 0.1, side: 0.08, bottom: 0.07 } as const;
/** Hauteur maximale d'une bosse de garniture au-dessus de sa face. */
export const TRIM_BUMP = 0.1;
/** Profondeurs de dessin (tuiles) : plein, motif, contours, garniture. Toutes sous les dangers (0,05) et le personnage (0,2). */
export const TILE_Z = { base: 0, pattern: 0.002, rim: 0.004, trim: 0.006 } as const;

export interface TileChunk {
  col0: number;
  col1: number;
  art: Art;
}

export interface TileArt {
  chunks: TileChunk[];
  /** Tuiles pleines dessinées, et combien en plein intérieur (mesure, tests). */
  tiles: number;
  interior: number;
  /** Faces dont le contour a été retiré parce qu'elles portent un pic. */
  hazardFaces: number;
}

/** Couleur d'un sommet de la grille : la profondeur la plus faible des quatre cases qui le partagent, assombrie d'un bruit déterministe. */
function vertexColor(style: TileStyle, depth: Int16Array, level: Level, vx: number, vy: number): number {
  let d = 99;
  for (const [dc, dr] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
    const c = vx + dc;
    const r = vy + dr;
    if (c < 0 || c >= level.width || r < 0) continue;
    if (r >= level.height) {
      d = 0;
      continue;
    }
    const v = depth[r * level.width + c]!;
    d = Math.min(d, v < 0 ? 0 : v + 1);
  }
  if (d === 99) d = 4;
  // Sommet au bord d'une case vide : la couleur du bord ; plus loin, le dégradé vers le plein profond.
  const base = depthColor(style, d - 1);
  // Bruit qui assombrit seulement (le contraste avec les dangers ne fait que monter), et seulement loin du bord.
  if (d <= 1) return base;
  return mix(base, 0x000000, cellNoise(vx, vy, 7) * 0.16);
}

/** Contour d'une tuile (sens horaire depuis le haut-gauche, y vers le haut), coins extérieurs coupés selon le style. */
function outline(x: number, yTop: number, shape: TileShape, style: TileStyle): number[] {
  const r = style.radius;
  const yBot = yTop - 1;
  const pts: number[] = [];
  // Centres et angles des quatre coins : haut-gauche, haut-droite, bas-droite, bas-gauche.
  const corners = [
    { cx: x, cy: yTop, sx: 1, sy: -1, a0: Math.PI, a1: Math.PI / 2 },
    { cx: x + 1, cy: yTop, sx: -1, sy: -1, a0: Math.PI / 2, a1: 0 },
    { cx: x + 1, cy: yBot, sx: -1, sy: 1, a0: 0, a1: -Math.PI / 2 },
    { cx: x, cy: yBot, sx: 1, sy: 1, a0: -Math.PI / 2, a1: -Math.PI },
  ];
  for (let k = 0; k < 4; k++) {
    const c = corners[k]!;
    if (!shape.outer[k]) {
      pts.push(c.cx, c.cy);
      continue;
    }
    // Centre de l'arc à (r, r) du coin, vers l'intérieur de la tuile.
    const ox = c.cx + c.sx * r;
    const oy = c.cy + c.sy * r;
    if (style.corner === "chanfrein") {
      pts.push(ox + Math.cos(c.a0) * r, oy + Math.sin(c.a0) * r, ox + Math.cos(c.a1) * r, oy + Math.sin(c.a1) * r);
    } else {
      for (let s = 0; s <= 4; s++) {
        const a = c.a0 + ((c.a1 - c.a0) * s) / 4;
        pts.push(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
      }
    }
  }
  return pts;
}

/** Interpolation bilinéaire des couleurs des quatre coins (haut-gauche, haut-droite, bas-droite, bas-gauche) en (u, v) ∈ [0, 1]². */
function bilinear(c: readonly number[], u: number, v: number): number {
  return mix(mix(c[3]!, c[2]!, u), mix(c[0]!, c[1]!, u), v);
}

/**
 * Construit le dessin des blocs pleins d'un niveau. `list` : ce que la garniture doit éviter (par défaut, `keepouts(level)`).
 */
export function buildTileArt(level: Level, style: TileStyle, list: readonly Keepout[] = keepouts(level)): TileArt {
  const depth = depthMap(level);
  const keep = keepoutField(level, list);
  const W = level.width;
  const tileAt = (c: number, r: number) => (c < 0 || c >= W || r < 0 || r >= level.height ? -1 : level.tiles[r * W + c]!);
  const spikeAt = (c: number, r: number) => isSpikeTile(tileAt(c, r));
  const chunks: TileChunk[] = [];
  let tiles = 0;
  let interior = 0;
  let hazardFaces = 0;
  for (let c0 = 0; c0 < W; c0 += CHUNK_COLUMNS) {
    const c1 = Math.min(W, c0 + CHUNK_COLUMNS);
    const art = new Art();
    for (let row = 0; row < level.height; row++) {
      for (let col = c0; col < c1; col++) {
        if (level.tiles[row * W + col] !== TILE_SOLID) continue;
        tiles++;
        const shape = tileShape(neighbourMask(level, col, row));
        const x = col;
        const yTop = -row;
        const yBot = yTop - 1;
        const corner = [vertexColor(style, depth, level, col, row), vertexColor(style, depth, level, col + 1, row), vertexColor(style, depth, level, col + 1, row + 1), vertexColor(style, depth, level, col, row + 1)];
        // ——— Plein ———
        if (!shape.outer.some(Boolean)) {
          art.rect(x, yBot, x + 1, yTop, TILE_Z.base, [corner[3]!, corner[2]!, corner[1]!, corner[0]!]);
        } else {
          const pts = outline(x, yTop, shape, style);
          const colors: number[] = [];
          for (let k = 0; k < pts.length; k += 2) colors.push(bilinear(corner, pts[k]! - x, pts[k + 1]! - yBot));
          art.fan(x + 0.5, yTop - 0.5, pts, TILE_Z.base, bilinear(corner, 0.5, 0.5), colors);
        }
        if (shape.interior) interior++;
        const d = depth[row * W + col]!;
        if (d >= 1) pattern(art, style, col, row, d);
        // ——— Contours des faces exposées (sauf une face qui porte un pic) ———
        const holds = { top: spikeAt(col, row - 1), right: spikeAt(col + 1, row), bottom: spikeAt(col, row + 1), left: spikeAt(col - 1, row) };
        const r = style.radius;
        const cut = (k: number) => (shape.outer[k] ? r : 0);
        const z = TILE_Z.rim;
        if (shape.top) {
          if (holds.top) hazardFaces++;
          else art.rect(x + cut(0), yTop - RIM.top, x + 1 - cut(1), yTop, z, style.rimTop);
        }
        if (shape.bottom) {
          if (holds.bottom) hazardFaces++;
          else art.rect(x + cut(3), yBot, x + 1 - cut(2), yBot + RIM.bottom, z, style.rimBottom);
        }
        if (shape.left) {
          if (holds.left) hazardFaces++;
          else art.rect(x, yBot + cut(3), x + RIM.side, yTop - cut(0), z, style.rimSide);
        }
        if (shape.right) {
          if (holds.right) hazardFaces++;
          else art.rect(x + 1 - RIM.side, yBot + cut(2), x + 1, yTop - cut(1), z, style.rimSide);
        }
        // Coins extérieurs : le contour suit l'arc (ou le chanfrein), de la couleur de la face du dessus (ou du dessous).
        const sides = [
          [holds.top, holds.left],
          [holds.top, holds.right],
          [holds.bottom, holds.right],
          [holds.bottom, holds.left],
        ] as const;
        for (let k = 0; k < 4; k++) {
          if (!shape.outer[k] || (sides[k]![0] && sides[k]![1])) continue;
          const color = k < 2 ? style.rimTop : style.rimBottom;
          const w = k < 2 ? RIM.top : RIM.bottom;
          const cx = k === 0 || k === 3 ? x + r : x + 1 - r;
          const cy = k < 2 ? yTop - r : yBot + r;
          const a0 = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][k]!;
          if (style.corner === "arrondi") art.arcBand(cx, cy, r - w, r, a0, a0 - Math.PI / 2, z, color);
          else {
            const p0x = cx + Math.cos(a0) * r;
            const p0y = cy + Math.sin(a0) * r;
            const p1x = cx + Math.cos(a0 - Math.PI / 2) * r;
            const p1y = cy + Math.sin(a0 - Math.PI / 2) * r;
            const q = (r - w) / r;
            art.quad([p0x, p0y, p1x, p1y, cx + (p1x - cx) * q, cy + (p1y - cy) * q, cx + (p0x - cx) * q, cy + (p0y - cy) * q], z, color);
          }
        }
        // Coins intérieurs : le carré où les contours des deux voisins se rejoignent (la diagonale vide ne porte pas de pic).
        const inner = [
          [x, yTop - RIM.top, x + RIM.side, yTop, col - 1, row - 1, style.rimTop],
          [x + 1 - RIM.side, yTop - RIM.top, x + 1, yTop, col + 1, row - 1, style.rimTop],
          [x + 1 - RIM.side, yBot, x + 1, yBot + RIM.bottom, col + 1, row + 1, style.rimBottom],
          [x, yBot, x + RIM.side, yBot + RIM.bottom, col - 1, row + 1, style.rimBottom],
        ] as const;
        for (let k = 0; k < 4; k++) {
          if (!shape.inner[k]) continue;
          const [ax, ay, bx, by, dc, dr, color] = inner[k]!;
          if (spikeAt(dc, dr)) continue;
          art.rect(ax, ay, bx, by, z, color);
        }
        // ——— Garniture : seulement sur une face du dessus libre (une case vide au-dessus, sans pic) ———
        if (shape.top && tileAt(col, row - 1) === TILE_EMPTY) {
          const bumps = row - 1 >= 0 && keep[(row - 1) * W + col]! >= 1.5 && keep[row * W + col]! >= 1.5;
          trim(art, style, col, row, cut(0), cut(1), bumps);
        }
      }
    }
    chunks.push({ col0: c0, col1: c1, art });
  }
  return { chunks, tiles, interior, hazardFaces };
}

/** Motif du plein (profondeur ≥ 1) : un relief discret, déterministe par case. */
function pattern(art: Art, s: TileStyle, col: number, row: number, depth: number): void {
  const x = col;
  const yTop = -row;
  const z = TILE_Z.pattern;
  const n = cellNoise(col, row, 11);
  const n2 = cellNoise(col, row, 23);
  const color = depth >= 2 ? s.speck : mix(s.speck, s.fill, 0.4);
  // Les motifs à joints (plaques, briques, grille) s'arrêtent à 3 tuiles du bord : au-delà, le plein profond reste lisse (son dégradé et
  // quelques taches), pour que les grandes masses ne se lisent pas comme un quadrillage.
  const seams = depth <= 3;
  switch (s.pattern) {
    case "pierres":
      if (n < 0.34) {
        const r = 0.12 + n2 * 0.12;
        art.disc(x + 0.3 + n2 * 0.4, yTop - 0.3 - n * 1.2, r, z, color, 8);
      }
      break;
    case "cristaux":
      if (n < 0.28) art.disc(x + 0.28 + n2 * 0.44, yTop - 0.28 - n * 1.5, 0.1 + n2 * 0.1, z, mix(color, s.fill, 0.5), 6);
      break;
    case "plaques": {
      // Plaques de 3 × 2 tuiles posées en quinconce : joints, et un boulon au coin de chaque plaque.
      const shift = Math.floor(row / 2) % 2 ? 1 : 0;
      const left = (col + shift) % 3 === 0;
      const top = row % 2 === 0;
      if (seams) {
        if (left) art.rect(x, yTop - 1, x + 0.035, yTop, z, color);
        if (top) art.rect(x, yTop - 0.035, x + 1, yTop, z, color);
        if (left && top) art.rect(x + 0.1, yTop - 0.16, x + 0.16, yTop - 0.1, z, color);
      } else if (n < 0.08) art.rect(x + 0.3, yTop - 0.36, x + 0.36, yTop - 0.3, z, color);
      break;
    }
    case "briques":
      // Assises d'une demi-tuile, joints verticaux décalés d'une assise à l'autre.
      if (seams) {
        art.rect(x, yTop - 0.03, x + 1, yTop, z, color);
        art.rect(x, yTop - 0.53, x + 1, yTop - 0.5, z, color);
        art.rect(x + (row % 2 ? 0.25 : 0.75), yTop - 0.5, x + (row % 2 ? 0.28 : 0.78), yTop, z, color);
        art.rect(x + (row % 2 ? 0.75 : 0.25), yTop - 1, x + (row % 2 ? 0.78 : 0.28), yTop - 0.5, z, color);
      } else if (n < 0.2) art.rect(x + 0.2 + n2 * 0.4, yTop - 0.4 - n, x + 0.45 + n2 * 0.4, yTop - 0.3 - n, z, color);
      break;
    case "grille":
      if (seams) {
        if (col % 2 === 0) art.rect(x, yTop - 1, x + 0.025, yTop, z, color);
        if (row % 2 === 0) art.rect(x, yTop - 0.025, x + 1, yTop, z, color);
      } else if (n < 0.12) art.rect(x + 0.4, yTop - 0.6, x + 0.46, yTop - 0.54, z, color);
      break;
  }
}

/** Garniture d'une face du dessus : `cl` / `cr` = coupe des coins (la garniture s'arrête où l'arrondi commence). */
function trim(art: Art, s: TileStyle, col: number, row: number, cl: number, cr: number, bumps: boolean): void {
  const x0 = col + cl * 0.6;
  const x1 = col + 1 - cr * 0.6;
  const yTop = -row;
  const z = TILE_Z.trim;
  const n = cellNoise(col, row, 3);
  const n2 = cellNoise(col, row, 5);
  switch (s.trim) {
    case "herbe": {
      // Herbe : bande, liseré clair, mousse qui coule sur la face (gouttes rondes), touffes rondes au-dessus.
      art.rect(x0, yTop - 0.16, x1, yTop, z, s.trimA);
      art.rect(x0, yTop - 0.045, x1, yTop, z + 0.0005, s.trimB);
      art.disc(col + 0.25 + n * 0.5, yTop - 0.16, 0.055 + n2 * 0.04, z, s.trimA, 8);
      if (n2 > 0.5) art.disc(col + 0.15 + n2 * 0.7, yTop - 0.15, 0.045, z, s.trimA, 8);
      if (bumps) {
        art.half(col + 0.2 + n * 0.25, yTop, 0.07 + n2 * 0.03, z, s.trimA, 6);
        if (n > 0.4) art.half(col + 0.55 + n2 * 0.3, yTop, 0.06, z, s.trimA, 6);
      }
      break;
    }
    case "rivets": {
      // Bande d'acier, joint sombre, deux rivets.
      art.rect(x0, yTop - 0.13, x1, yTop, z, s.trimA);
      art.rect(x0, yTop - 0.16, x1, yTop - 0.13, z, s.speck);
      art.rect(x0, yTop - 0.03, x1, yTop, z + 0.0005, s.trimB);
      for (const u of [0.22, 0.78]) if (col + u > x0 + 0.03 && col + u < x1 - 0.03) art.rect(col + u - 0.03, yTop - 0.1, col + u + 0.03, yTop - 0.05, z + 0.0005, s.trimB);
      break;
    }
    case "givre": {
      // Givre : couche blanche, gouttes de givre rondes sur la face, petits tas de neige au-dessus.
      art.rect(x0, yTop - 0.09, x1, yTop, z, s.trimA);
      art.disc(col + 0.2 + n * 0.6, yTop - 0.09, 0.045 + n2 * 0.03, z, s.trimB, 8);
      if (n2 > 0.35) art.disc(col + 0.1 + n2 * 0.8, yTop - 0.09, 0.035, z, s.trimB, 8);
      if (bumps && n > 0.3) art.half(col + 0.3 + n2 * 0.4, yTop, 0.06 + n * 0.03, z, s.trimA, 6);
      break;
    }
    case "etoiles": {
      // Lisière étoilée : un liseré pâle, et des points d'étoile dans la face.
      art.rect(x0, yTop - 0.05, x1, yTop, z, s.trimA);
      if (n < 0.6) art.rect(col + 0.15 + n2 * 0.6, yTop - 0.17, col + 0.2 + n2 * 0.6, yTop - 0.12, z, s.trimB);
      if (n2 < 0.3) art.rect(col + 0.6 - n * 0.4, yTop - 0.3, col + 0.64 - n * 0.4, yTop - 0.26, z, mix(s.trimB, s.face, 0.4));
      break;
    }
    case "neon": {
      // Liseré lumineux : un trait vif, un halo sombre dessous, un second trait d'accent plus fin.
      art.rect(x0, yTop - 0.14, x1, yTop, z, mix(s.trimA, s.face, 0.72));
      art.rect(x0, yTop - 0.06, x1, yTop, z + 0.0005, s.trimA);
      art.rect(x0, yTop - 0.19, x1, yTop - 0.165, z, s.trimB);
      break;
    }
  }
}

/** Vrai si toute la géométrie d'un tronçon reste dans ses tuiles pleines, aux bosses de garniture près (au plus `slack` au-dessus d'une face). */
export function insideTiles(level: Level, art: Art, slack = TRIM_BUMP): boolean {
  const eps = 1e-6;
  for (let i = 0; i < art.pos.length; i += 3) {
    const x = art.pos[i]!;
    const y = -art.pos[i + 1]!;
    let ok = false;
    for (let c = Math.floor(x - eps); c <= Math.floor(x + eps) && !ok; c++) {
      for (let r = Math.floor(y - eps); r <= Math.floor(y + slack + eps) && !ok; r++) {
        if (c < 0 || c >= level.width || r < 0 || r >= level.height || level.tiles[r * level.width + c] !== TILE_SOLID) continue;
        ok = x >= c - eps && x <= c + 1 + eps && y >= r - slack - eps && y <= r + 1 + eps;
      }
    }
    if (!ok) return false;
  }
  return true;
}
