import { Rng } from "@cdj/core";
import { Art } from "./artKit";
import { textSeed } from "./decor";
import type { ParallaxLayer, Theme } from "./themes";

// Fond en parallaxe (lot 9), **pur** : deux ou trois plans de formes procédurales par thème, construits une fois (graine = identifiant du
// niveau + thème + rang du plan). Chaque plan a son facteur (0 : figé à l'écran ; 1 : il défile avec le niveau). Les couleurs restent
// sombres et proches du ciel (test : contraste ≤ `PARALLAX_MAX_CONTRAST`) pour ne jamais concurrencer le premier plan.
//
// Repère d'un plan : tuiles, y vers le haut, y = 0 sur son horizon ; sous l'horizon, le plan est plein jusqu'à `BOTTOM` (il couvre le bas
// de l'écran quelle que soit la hauteur de la caméra). `layerOffset` dit où poser le plan pour une caméra donnée.

/** Profondeur du plein sous l'horizon (tuiles). */
export const BOTTOM = 120;
/** Marge horizontale construite de chaque côté de ce que le plan peut montrer (tuiles) : la moitié de l'image la plus large, et plus. */
export const SPAN_MARGIN = 48;
/** Le facteur vertical d'un plan est une fraction de son facteur horizontal (le fond bouge peu en hauteur). */
export const VERTICAL_SHARE = 0.5;
/** Profondeur de dessin des plans : du plus loin (−5) au plus proche, tous derrière le décor du fond (−0,6). */
export const PARALLAX_Z0 = -5;

export interface LayerArt {
  layer: ParallaxLayer;
  art: Art;
  /** Plage construite (repère du plan). */
  x0: number;
  x1: number;
}

/** Plage à construire pour un niveau de `width` tuiles : ce que la caméra peut montrer, sur toute la largeur du niveau. */
export function layerSpan(width: number, factor: number): { x0: number; x1: number } {
  return { x0: -SPAN_MARGIN, x1: width * factor + SPAN_MARGIN };
}

/**
 * Position du plan pour une caméra centrée en (`camX`, `camY`) (tuiles, y vers le haut), `mid` = centre vertical du niveau. `motion` :
 * 1 normal, 0 figé (mouvement réduit). L'horizon se trouve `layer.horizon` tuiles sous le centre de l'écran quand la caméra est à `mid`.
 */
export function layerOffset(layer: ParallaxLayer, camX: number, camY: number, mid: number, motion = 1): { x: number; y: number } {
  const f = layer.factor * motion;
  const fy = f * VERTICAL_SHARE;
  return { x: camX * (1 - f), y: camY - fy * (camY - mid) - layer.horizon };
}

function profile(art: Art, xs: readonly number[], ys: readonly number[], z: number, color: number): void {
  for (let i = 0; i + 1 < xs.length; i++) {
    art.quad([xs[i]!, -BOTTOM, xs[i + 1]!, -BOTTOM, xs[i + 1]!, ys[i + 1]!, xs[i]!, ys[i]!], z, color);
  }
}

/** Construit un plan. */
export function buildLayer(layer: ParallaxLayer, x0: number, x1: number, seed: number, z = PARALLAX_Z0): LayerArt {
  const rng = new Rng(seed);
  const art = new Art();
  const h = layer.height;
  const c = layer.color;
  const a = layer.accent;
  const r01 = () => rng.int(10_000) / 10_000;
  switch (layer.kind) {
    case "collines": {
      const p1 = r01() * 6.28;
      const p2 = r01() * 6.28;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let x = x0; x <= x1 + 1; x += 1) {
        xs.push(x);
        ys.push(h * (0.5 + 0.28 * Math.sin(x * 0.09 + p1) + 0.22 * Math.sin(x * 0.037 + p2)));
      }
      profile(art, xs, ys, z, c);
      break;
    }
    case "arbres": {
      const xs: number[] = [];
      const ys: number[] = [];
      const p = r01() * 6.28;
      for (let x = x0; x <= x1 + 1; x += 1) {
        xs.push(x);
        ys.push(h * 0.18 * (1 + Math.sin(x * 0.12 + p)));
      }
      profile(art, xs, ys, z, c);
      for (let x = x0 + r01() * 3; x < x1; x += 2.6 + r01() * 2.4) {
        const th = h * (0.45 + r01() * 0.5);
        const base = h * 0.18 * (1 + Math.sin(x * 0.12 + p)) - 0.5;
        art.rect(x - 0.22, base, x + 0.22, base + th, z, c);
        const r = 0.8 + r01() * 0.7;
        const tint = r01() < 0.35 ? a : c;
        art.disc(x, base + th + r * 0.4, r, z, tint, 12);
        art.disc(x - r * 0.6, base + th - r * 0.1, r * 0.7, z, tint, 10);
        art.disc(x + r * 0.6, base + th, r * 0.75, z, tint, 10);
      }
      break;
    }
    case "cheminees": {
      art.rect(x0, -BOTTOM, x1, 0, z, c);
      for (let x = x0; x < x1; ) {
        const w = 3 + r01() * 5;
        const bh = 1.5 + r01() * (h * 0.55);
        art.rect(x, 0, x + w, bh, z, c);
        if (r01() < 0.55) {
          const cx = x + 0.6 + r01() * (w - 1.6);
          const ch = bh + 1.5 + r01() * (h * 0.6);
          art.rect(cx, bh, cx + 0.8, ch, z, c);
          art.rect(cx - 0.1, ch - 0.9, cx + 0.9, ch - 0.6, z, a);
          // Fumée : quelques bouffées rondes, très proches du ciel.
          for (let k = 0; k < 3; k++) art.disc(cx + 0.4 + k * 0.7 + r01() * 0.3, ch + 0.7 + k * 0.8, 0.5 + k * 0.25, z, a, 10);
        }
        // Toit en dents de scie d'atelier : des marches rectangulaires (jamais de pointe).
        if (r01() < 0.4) for (let k = 0; k + 1.2 <= w; k += 1.4) art.rect(x + k, bh, x + k + 0.7, bh + 0.5, z, c);
        x += w + r01() * 0.6;
      }
      break;
    }
    case "poutres": {
      art.rect(x0, -BOTTOM, x1, 0, z, c);
      const y1 = h * 0.35;
      const y2 = h;
      // Poutres minces et sombres : un trait du fond ne doit jamais se lire comme une plateforme.
      art.rect(x0, y1 - 0.1, x1, y1 + 0.1, z, a);
      art.rect(x0, y2 - 0.14, x1, y2 + 0.14, z, a);
      const step = 7;
      const start = Math.floor(x0 / step) * step;
      for (let x = start; x < x1; x += step) {
        art.rect(x - 0.22, 0, x + 0.22, y2, z, c);
        // Croisillons entre deux poteaux (barres minces).
        const t = 0.1;
        art.quad([x, y1, x + t * 1.4, y1, x + step, y2 - t, x + step - t * 1.4, y2], z, a);
        art.quad([x, y2 - t, x + t * 1.4, y2, x + step, y1 + t, x + step - t * 1.4, y1], z, a);
        art.rect(x - 0.12, y1 - 0.06, x + 0.12, y1 + 0.06, z, a);
      }
      break;
    }
    case "montagnes": {
      const xs: number[] = [x0];
      const ys: number[] = [h * 0.2];
      for (let x = x0; x < x1 + 12; ) {
        const w = 5 + r01() * 8;
        const peak = h * (0.45 + r01() * 0.55);
        xs.push(x + w / 2, x + w);
        ys.push(peak, h * (0.1 + r01() * 0.25));
        // Neige au sommet : un losange aplati sous la crête, à la couleur d'accent (peu contrastée).
        art.quad([x + w / 2, peak, x + w / 2 + w * 0.12, peak - h * 0.16, x + w / 2, peak - h * 0.1, x + w / 2 - w * 0.12, peak - h * 0.16], z + 0.001, a);
        x += w;
      }
      profile(art, xs, ys, z, c);
      break;
    }
    case "etoiles": {
      // Ciel étoilé : de petits carrés (jamais de branches pointues), répartis loin au-dessus et autour de l'horizon.
      const area = (x1 - x0) * (h + 30);
      const n = Math.floor(area / 7);
      for (let k = 0; k < n; k++) {
        const x = x0 + r01() * (x1 - x0);
        const y = -14 + r01() * (h + 30);
        const s = 0.07 + r01() * 0.1;
        art.rect(x - s, y - s, x + s, y + s, z, r01() < 0.25 ? a : c);
      }
      break;
    }
    case "lune": {
      // Une lune ronde, ses cratères ; posée au milieu de ce que le plan montre quand la caméra est au milieu du niveau.
      const x = (x0 + x1) / 2 + 6;
      const y = h * 0.25;
      art.disc(x, y, 2.2, z, c, 28);
      art.disc(x - 0.7, y + 0.5, 0.45, z + 0.001, a, 12);
      art.disc(x + 0.6, y - 0.4, 0.6, z + 0.001, a, 12);
      art.disc(x + 0.2, y + 1.1, 0.25, z + 0.001, a, 10);
      break;
    }
    case "grille": {
      // Sol en grille : un plan plein, des lignes horizontales qui se resserrent vers l'horizon, des lignes de fuite.
      art.rect(x0, -BOTTOM, x1, 0, z, c);
      for (let k = 1; k <= 9; k++) {
        const y = -(k * k) * 0.12 * h * 0.25;
        art.rect(x0, y - 0.03, x1, y + 0.03, z + 0.001, a);
      }
      art.rect(x0, -0.06, x1, 0.06, z + 0.001, a);
      const step = 6;
      for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
        const vx = x * 0.35;
        art.quad([vx - 0.03, 0, vx + 0.03, 0, x + 0.12, -h * 2.5, x - 0.12, -h * 2.5], z + 0.001, a);
      }
      break;
    }
    case "skyline": {
      art.rect(x0, -BOTTOM, x1, 0, z, c);
      for (let x = x0; x < x1; ) {
        const w = 2.5 + r01() * 4;
        const bh = 1 + r01() * h;
        art.rect(x, 0, x + w, bh, z, c);
        // Fenêtres allumées, rares et sombres ; une antenne de temps en temps.
        for (let wy = 0.6; wy < bh - 0.5; wy += 1.1) for (let wx = 0.4; wx < w - 0.6; wx += 0.9) if (r01() < 0.22) art.rect(x + wx, wy, x + wx + 0.35, wy + 0.45, z + 0.001, a);
        if (r01() < 0.3) art.rect(x + w / 2 - 0.08, bh, x + w / 2 + 0.08, bh + 1.6, z, c);
        x += w + 0.3 + r01() * 0.8;
      }
      break;
    }
  }
  return { layer, art, x0, x1 };
}

/** Les plans d'un thème pour un niveau (du plus lointain au plus proche). */
export function buildParallax(theme: Theme, width: number, levelId: string): LayerArt[] {
  return theme.parallax.map((layer, i) => {
    const span = layerSpan(width, layer.factor);
    return buildLayer(layer, span.x0, span.x1, textSeed(`${levelId}:${theme.name}:plan${i}`), PARALLAX_Z0 + i * 0.5);
  });
}

/** Plans montrés selon les réglages : tous normalement, seulement le plus lointain avec les effets réduits (ou aucun). */
export function visibleLayers(count: number, lite: boolean): number {
  return lite ? Math.min(1, count) : count;
}
