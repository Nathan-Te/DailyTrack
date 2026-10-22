// Lot 38 — pièces communes des directions : bandeaux de texte dessinés au chargement (DÉPART, ARRIVÉE), damiers, glyphes des panneaux, et les
// couleurs de la marque Track (charte « Cartouches », jetons de @cdj/ui) que les éléments de course reprennent en 3D.
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, SRGBColorSpace } from "three";
import type { Builder, V3 } from "../meshKit";
import { pt, type Repere } from "./outils";

/**
 * Couleurs de la marque (jetons `--track-*` et `--dj-*` de packages/ui/src/jetons.ts, recopiés en nombres : le rendu 3D ne lit pas le CSS).
 * Le portique de départ et l'arrivée portent la marque, comme le HUD et le bouton « Courir ».
 */
export const MARQUE = {
  asphalte: 0x1e1b19,
  coque: 0x4a4440,
  livree: 0xe8552d,
  livreeOmbre: 0x8e2e14,
  creme: 0xede3cf,
  papier: 0xfff6e0,
  encre: 0x2a1e16,
  ambre: 0xf2b544,
  moutarde: 0xe8b23a,
  auteur: 0x2e9e5b,
} as const;

const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

export interface StyleBandeau {
  fond: number;
  encre: number;
  /** Police (canvas) : par défaut Barlow Condensed 800 italique, celle des chiffres du HUD. */
  police?: string;
  /** Damier en haut et en bas (arrivée) : deux couleurs. */
  damier?: [number, number];
  /** Livrée à 115° en haut et en bas (départ). */
  livree?: [number, number];
  /** Cadre (épaisseur en pixels) et sa couleur. */
  cadre?: [number, number];
  /** Points de diodes (panneau lumineux de B). */
  diodes?: boolean;
}

/** La police des bandeaux : celle des chiffres du HUD (Barlow Condensed 800 italique), chargée avant la construction de la scène. */
export const POLICE_BANDEAU = "italic 800 84px 'Barlow Condensed', 'Archivo', sans-serif";

/** Texture d'un bandeau de texte, 512 × 128 (comme `bannerTexture` de trackProps.ts), dans le style donné. */
export function textureBandeau(texte: string, s: StyleBandeau): CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = css(s.fond);
  ctx.fillRect(0, 0, w, h);
  if (s.damier) {
    const c = 16;
    for (let i = 0; i < w / c; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = css(s.damier[(i + j) % 2]!);
        ctx.fillRect(i * c, j * c, c, c);
        ctx.fillRect(i * c, h - (j + 1) * c, c, c);
      }
    }
  }
  if (s.livree) {
    for (const y0 of [0, h - 18]) {
      ctx.fillStyle = css(s.livree[0]);
      ctx.fillRect(0, y0, w, 18);
      ctx.fillStyle = css(s.livree[1]);
      for (let x = -40; x < w + 40; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, y0 + 18);
        ctx.lineTo(x + 14, y0 + 18);
        ctx.lineTo(x + 14 + 8.4, y0);
        ctx.lineTo(x + 8.4, y0);
        ctx.fill();
      }
    }
  }
  if (s.cadre) {
    ctx.strokeStyle = css(s.cadre[1]);
    ctx.lineWidth = s.cadre[0];
    ctx.strokeRect(s.cadre[0] / 2, s.cadre[0] / 2, w - s.cadre[0], h - s.cadre[0]);
  }
  ctx.fillStyle = css(s.encre);
  ctx.font = s.police ?? POLICE_BANDEAU;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texte, w / 2, h / 2 + 4);
  if (s.diodes) {
    // Grille de diodes : des points sombres entre les « diodes » (un panneau lumineux de bord de piste).
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
    for (let x = 0; x < w; x += 6) ctx.fillRect(x, 0, 2, h);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Un quadrilatère texturé, coins bas-gauche, bas-droite, haut-droite, haut-gauche du point de vue du lecteur. */
export function bandeau(tex: CanvasTexture, bl: V3, br: V3, tr: V3, tl: V3): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute([...bl, ...br, ...tr, ...tl], 3));
  geo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ map: tex, side: DoubleSide }));
  mesh.userData.banner = true;
  return mesh;
}

/** Les deux faces d'un bandeau posé dans le plan (gauche, haut) du repère, à l'avance `a` ± `e` : lu par qui arrive et par qui repart. */
export function bandeauDeuxFaces(out: Mesh[], tex: CanvasTexture, r: Repere, g: number, h0: number, h1: number, a: number, e: number) {
  // Face avant (vue par qui arrive, donc depuis l'arrière du repère) : sa gauche est la gauche du conducteur.
  out.push(bandeau(tex, pt(r, g, h0, a - e), pt(r, -g, h0, a - e), pt(r, -g, h1, a - e), pt(r, g, h1, a - e)));
  out.push(bandeau(tex, pt(r, -g, h0, a + e), pt(r, g, h0, a + e), pt(r, g, h1, a + e), pt(r, -g, h1, a + e)));
}

/** Damier au sol en travers de la route (arrivée) : `cols` colonnes de `c` m sur `rangs` rangs, centré sur l'axe. */
export function damierSol(b: Builder, r: Repere, demiLargeur: number, rangs: number, c: number, h: number, c1: number, c2: number) {
  const n = Math.round((demiLargeur * 2) / c);
  const w = (demiLargeur * 2) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < rangs; j++) {
      const g0 = -demiLargeur + i * w;
      const a0 = -c * rangs * 0.5 + j * c;
      b.quad(pt(r, g0, h, a0), pt(r, g0 + w, h, a0), pt(r, g0 + w, h, a0 + c), pt(r, g0, h, a0 + c), (i + j) % 2 === 0 ? c1 : c2);
    }
  }
}

/** Chevron « > » plein (pointe vers l'avant du repère) au sol, centré en `a`, demi-largeur `l`, épaisseur `e`. */
export function chevronSol(b: Builder, r: Repere, a: number, l: number, e: number, h: number, couleur: number) {
  // Deux bras : de (−l, a − l·0,7) à (0, a) puis à (+l, a − l·0,7).
  const bras = (s: number) => {
    b.quad(pt(r, s * l, h, a - l * 0.7), pt(r, s * (l - e), h, a - l * 0.7), pt(r, 0, h, a - e * 1.2), pt(r, 0, h, a), couleur);
  };
  bras(1);
  bras(-1);
}
