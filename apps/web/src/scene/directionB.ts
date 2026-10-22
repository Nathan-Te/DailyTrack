// Lot 38 — direction B, « Détaillé » : des formes chanfreinées et de petites pièces qui racontent quelque chose (piles de pneus, drapeaux, câbles,
// rivets, feux de départ, arche gonflable, logos de sponsors fictifs), des matériaux variés (métal, caoutchouc, béton, bois, toile), et un rebord
// propre à chaque thème. **Le même nombre d'appels de rendu** que l'existant : toutes les pièces sont fusionnées dans les calques (un maillage
// chacun) et tous les logos sont dans un seul atlas (un maillage). Le coût est en triangles et en temps de construction : mesurés par la vitrine.
import { CanvasTexture, SRGBColorSpace } from "three";
import { CELL, CUT_HALF_LENGTH, SHOULDER_EDGE, blockHalfWidth, blockPadHalfWidth, isCurve, type Block, type PaletteName } from "@cdj/sim";
import { Builder, mix, shade, type V3 } from "../meshKit";
import { drawGlyph, signStyleOf } from "../trackProps";
import type { SignSpec } from "../signage";
import { placesDeDecor } from "./composer";
import { Affiches, boite, boiteChanfreinee, face, pt, repereBloc, repereSegment, repereSol, sol, tube, type Repere } from "./outils";
import { MARQUE, bandeau, chevronSol, damierSol, textureBandeau } from "./pieces";
import { STYLE_ORIGINE, onBlock, type StyleRoute, type TronconRebord } from "./route";
import { ORIGINE } from "./origine";
import { HORIZONS, type Calques, type Contexte, type Direction, type PlaceDecor } from "./types";
import { ambianceDOrigine } from "./composer";

// --- Matières (couleurs de base : B varie les matériaux par la couleur et la forme, sur un seul matériau) ----------------------------------

const METAL = 0x8a9099;
const METAL_SOMBRE = 0x4a4f58;
const CAOUTCHOUC = 0x1d1d20;
const BETON = 0xb9bbbe;
const BOIS = 0x8a5a36;
const BOIS_CLAIR = 0xb88454;
const PEAU = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69] as const;

// --- L'atlas des affiches : sponsors fictifs et panneaux, dessinés une fois dans un canvas (aucun fichier) --------------------------------

/** Les cases de l'atlas (4 colonnes × 4 rangées de 256 × 128). */
export const LOGOS = ["dujour", "volta", "mistral", "pneusroc", "gazole", "eclair", "boulon", "cafe", "chrono", "distance2", "distance1", "col", "glacier", "taxi", "motel", "rodeo"] as const;
type Logo = (typeof LOGOS)[number];

function rect(logo: Logo): [number, number, number, number] {
  const i = LOGOS.indexOf(logo);
  const cx = i % 4;
  const cy = Math.floor(i / 4);
  // v = 1 en haut de la texture (flipY de three.js)
  return [cx / 4 + 0.004, 1 - (cy + 1) / 4 + 0.008, (cx + 1) / 4 - 0.004, 1 - cy / 4 - 0.008];
}

let atlasMemo: CanvasTexture | null = null;
/** L'atlas, dessiné au premier besoin (≈ 1024 × 512 px). Logos inventés : aucune marque réelle. */
export function atlasB(): CanvasTexture {
  if (atlasMemo) return atlasMemo;
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const cell = (logo: Logo, f: (x: number, y: number, w: number, h: number) => void) => {
    const i = LOGOS.indexOf(logo);
    ctx.save();
    f((i % 4) * 256, Math.floor(i / 4) * 128, 256, 128);
    ctx.restore();
  };
  const texte = (t: string, x: number, y: number, police: string, couleur: string) => {
    ctx.font = police;
    ctx.fillStyle = couleur;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t, x, y);
  };
  const fond = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  cell("dujour", (x, y, w, h) => {
    fond(x, y, w, h, "#EDE3CF");
    fond(x + 34, y + 30, 192, 66, "#C2401F");
    fond(x + 28, y + 24, 192, 66, "#2A1E16");
    texte("DU JOUR", x + 124, y + 59, "400 44px 'Archivo Black', 'Archivo', sans-serif", "#EDE3CF");
  });
  cell("volta", (x, y, w, h) => {
    fond(x, y, w, h, "#16181F");
    ctx.fillStyle = "#FFD23F";
    ctx.beginPath();
    ctx.moveTo(x + 40, y + 20);
    ctx.lineTo(x + 70, y + 20);
    ctx.lineTo(x + 58, y + 58);
    ctx.lineTo(x + 78, y + 58);
    ctx.lineTo(x + 40, y + 110);
    ctx.lineTo(x + 50, y + 70);
    ctx.lineTo(x + 30, y + 70);
    ctx.fill();
    texte("VOLTA", x + 160, y + 66, "italic 800 58px 'Barlow Condensed', sans-serif", "#FFD23F");
  });
  cell("mistral", (x, y, w, h) => {
    fond(x, y, w, h, "#1F5FBF");
    fond(x, y + 92, w, 14, "#FFFFFF");
    texte("MISTRAL", x + 128, y + 54, "italic 800 56px 'Barlow Condensed', sans-serif", "#FFFFFF");
  });
  cell("pneusroc", (x, y, w, h) => {
    fond(x, y, w, h, "#E8283A");
    ctx.strokeStyle = "#16181F";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(x + 48, y + 64, 30, 0, Math.PI * 2);
    ctx.stroke();
    texte("PNEUS ROC", x + 160, y + 66, "italic 800 40px 'Barlow Condensed', sans-serif", "#FFFFFF");
  });
  cell("gazole", (x, y, w, h) => {
    fond(x, y, w, h, "#F4F4F4");
    fond(x, y, 70, h, "#21A35A");
    texte("G+", x + 35, y + 66, "800 44px 'Archivo', sans-serif", "#FFFFFF");
    texte("GAZOLE+", x + 162, y + 66, "800 40px 'Archivo', sans-serif", "#21A35A");
  });
  cell("eclair", (x, y, w, h) => {
    fond(x, y, w, h, "#E8552D");
    texte("ÉCLAIR", x + 128, y + 58, "italic 800 64px 'Barlow Condensed', sans-serif", "#16181F");
    fond(x + 20, y + 100, 216, 8, "#16181F");
  });
  cell("boulon", (x, y, w, h) => {
    fond(x, y, w, h, "#3A3F4D");
    ctx.fillStyle = "#C9CED6";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + 48 + Math.cos(a) * 22, y + 64 + Math.sin(a) * 22, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    texte("BOULON", x + 162, y + 54, "800 40px 'Archivo', sans-serif", "#FFFFFF");
    texte("& FILS", x + 162, y + 92, "700 24px 'Archivo', sans-serif", "#E8283A");
  });
  cell("cafe", (x, y, w, h) => {
    fond(x, y, w, h, "#5B3A24");
    texte("CAFÉ DU COIN", x + 128, y + 64, "italic 800 40px 'Barlow Condensed', sans-serif", "#F2E2C4");
  });
  cell("chrono", (x, y, w, h) => {
    fond(x, y, w, h, "#0B0D12");
    texte("0:32.418", x + 128, y + 66, "700 52px 'JetBrains Mono', monospace", "#FFB000");
  });
  cell("distance2", (x, y, w, h) => {
    fond(x, y, w, h, "#16181F");
    ctx.fillStyle = "#FFFFFF";
    for (const dx of [70, 140]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + 110);
      ctx.lineTo(x + dx + 30, y + 110);
      ctx.lineTo(x + dx + 70, y + 18);
      ctx.lineTo(x + dx + 40, y + 18);
      ctx.fill();
    }
  });
  cell("distance1", (x, y, w, h) => {
    fond(x, y, w, h, "#16181F");
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(x + 105, y + 110);
    ctx.lineTo(x + 135, y + 110);
    ctx.lineTo(x + 175, y + 18);
    ctx.lineTo(x + 145, y + 18);
    ctx.fill();
  });
  cell("col", (x, y, w, h) => {
    fond(x, y, w, h, "#FFFFFF");
    ctx.strokeStyle = "#E8283A";
    ctx.lineWidth = 10;
    ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
    texte("COL 2 104 m", x + 128, y + 66, "800 40px 'Archivo', sans-serif", "#16181F");
  });
  cell("glacier", (x, y, w, h) => {
    fond(x, y, w, h, "#BFE3F5");
    texte("GLACIER", x + 128, y + 66, "italic 800 56px 'Barlow Condensed', sans-serif", "#1F5FBF");
  });
  cell("taxi", (x, y, w, h) => {
    fond(x, y, w, h, "#FFC61A");
    for (let k = 0; k < 16; k++) fond(x + k * 16, y + (k % 2) * 10, 16, 10, "#16181F");
    texte("TAXI", x + 128, y + 74, "800 52px 'Archivo', sans-serif", "#16181F");
  });
  cell("motel", (x, y, w, h) => {
    fond(x, y, w, h, "#16181F");
    texte("MOTEL", x + 128, y + 66, "italic 800 64px 'Barlow Condensed', sans-serif", "#FF2BD6");
  });
  cell("rodeo", (x, y, w, h) => {
    fond(x, y, w, h, "#E0A466");
    texte("RODÉO", x + 128, y + 66, "800 50px 'Archivo', sans-serif", "#7A2E14");
  });
  atlasMemo = new CanvasTexture(canvas);
  atlasMemo.colorSpace = SRGBColorSpace;
  atlasMemo.anisotropy = 4;
  return atlasMemo;
}

/** Les sponsors d'un thème : ceux qu'on voit sur ses panneaux. */
const SPONSORS: Record<PaletteName, Logo[]> = {
  stade: ["dujour", "volta", "mistral", "pneusroc", "eclair", "boulon"],
  desert: ["pneusroc", "gazole", "rodeo", "volta", "dujour"],
  neige: ["glacier", "mistral", "dujour", "volta"],
  nuit: ["volta", "motel", "eclair", "dujour"],
  campagne: ["cafe", "gazole", "dujour", "boulon"],
  canyon: ["rodeo", "gazole", "pneusroc", "dujour"],
  alpin: ["col", "glacier", "mistral", "dujour"],
  ville: ["taxi", "cafe", "eclair", "dujour", "boulon"],
  neon: ["motel", "volta", "eclair"],
};

// --- Pièces ---------------------------------------------------------------------------------------------------------------------------

/** Une pile de `n` pneus (prismes à six pans), le haut peint en `haut` (une pile sur deux en blanc, comme au bord des circuits). */
function pneus(g: Builder, x: number, y: number, z: number, n: number, haut = CAOUTCHOUC, r = 0.42) {
  for (let i = 0; i < n; i++) g.prism(x, y + i * 0.3, z, r, r * 0.92, 0.29, 6, i === n - 1 ? haut : CAOUTCHOUC, i === n - 1 ? haut : CAOUTCHOUC, i * 0.4);
}

function drapeau(g: Builder, x: number, y: number, z: number, h: number, couleur: number, a: number) {
  g.box(x - 0.05, y, z - 0.05, x + 0.05, y + h, z + 0.05, METAL);
  const f: V3 = [Math.cos(a), 0, Math.sin(a)];
  const P = (d: number, hh: number, w: number): V3 => [x + f[0] * d, y + h - hh + w, z + f[2] * d];
  g.quad(P(0.05, 0.1, 0), P(0.9, 0.2, 0.05), P(0.9, 1.1, 0.05), P(0.05, 1.1, 0), couleur);
  g.quad(P(0.9, 0.2, 0.05), P(1.7, 0.1, 0), P(1.7, 1.0, 0), P(0.9, 1.1, 0.05), shade(couleur, 0.85));
}

/** Un mât en treillis : quatre montants et des diagonales sur chaque face (B : la structure se voit). */
function treillisVertical(g: Builder, r: Repere, gc: number, ac: number, h0: number, h1: number, cote: number, couleur: number) {
  const s = cote / 2;
  const coins: [number, number][] = [[-s, -s], [s, -s], [s, s], [-s, s]];
  for (const [dg, da] of coins) tube(g, pt(r, gc + dg, h0, ac + da), pt(r, gc + dg, h1, ac + da), 0.07, 4, couleur);
  const pas = 1.4;
  for (let k = 0; k < 4; k++) {
    const [g0, a0] = coins[k]!;
    const [g1, a1] = coins[(k + 1) % 4]!;
    for (let y = h0, i = 0; y + pas <= h1 + 0.01; y += pas, i++) {
      const [ga, aa, gb, ab] = i % 2 === 0 ? [g0, a0, g1, a1] : [g1, a1, g0, a0];
      tube(g, pt(r, gc + ga, y, ac + aa), pt(r, gc + gb, y + pas, ac + ab), 0.045, 3, couleur);
    }
  }
}

/** Une poutre en treillis de `g0` à `g1` (le long de la gauche du repère), section `haut` × `prof`, à la hauteur `h`. */
function treillisPoutre(g: Builder, r: Repere, g0: number, g1: number, h: number, haut: number, prof: number, couleur: number) {
  const coins: [number, number][] = [[0, -prof / 2], [0, prof / 2], [haut, prof / 2], [haut, -prof / 2]];
  for (const [dh, da] of coins) tube(g, pt(r, g0, h + dh, da), pt(r, g1, h + dh, da), 0.08, 4, couleur);
  const n = Math.max(2, Math.round((g1 - g0) / 1.6));
  const pas = (g1 - g0) / n;
  for (let i = 0; i < n; i++) {
    const a = g0 + i * pas;
    const b = a + pas;
    for (const da of [-prof / 2, prof / 2]) tube(g, pt(r, a, h, da), pt(r, b, h + haut, da), 0.045, 3, couleur);
    tube(g, pt(r, a, h + haut, -prof / 2), pt(r, b, h + haut, prof / 2), 0.045, 3, couleur);
  }
}

/** Un câble qui pend entre `a` et `b` (chaînette approchée : six segments), de flèche `f`. */
function cable(g: Builder, a: V3, b: V3, f: number, couleur = CAOUTCHOUC) {
  const n = 6;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - f * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    tube(g, prev, p, 0.04, 3, couleur);
    prev = p;
  }
}

/** Panneau publicitaire sur deux pieds, logo sur les deux faces. */
function panneauPub(c: Calques, r: Repere, w: number, h: number, logo: Logo, haut = 0.6) {
  for (const s of [-1, 1]) boite(c.decor, r, s * (w - 0.3) - 0.07, s * (w - 0.3) + 0.07, 0, haut + 0.2, -0.07, 0.07, METAL_SOMBRE);
  boiteChanfreinee(c.decor, r, -w - 0.08, w + 0.08, haut - 0.08, haut + h + 0.08, -0.12, 0.12, 0.05, METAL_SOMBRE);
  c.affiches.face(r, -w, w, haut, haut + h, -0.13, rect(logo));
  c.affiches.quad(pt(r, -w, haut, 0.13), pt(r, w, haut, 0.13), pt(r, w, haut + h, 0.13), pt(r, -w, haut + h, 0.13), rect(logo));
}

/** Une rangée de spectateurs (deux boîtes chacun : corps de couleur, tête), sur une estrade basse. */
function foule(g: Builder, r: Repere, n: number, largeur: number, rnd: () => number, estrade = true) {
  if (estrade) boite(g, r, -largeur / 2 - 0.3, largeur / 2 + 0.3, 0, 0.4, -0.8, 0.8, BOIS_CLAIR);
  const couleurs = [MARQUE.livree, 0x2e7dff, MARQUE.moutarde, 0xf4f4f4, 0x21a35a, 0xc084fc, 0xe8283a];
  for (let i = 0; i < n; i++) {
    const gx = -largeur / 2 + (i + 0.5) * (largeur / n) + (rnd() - 0.5) * 0.3;
    const a = (rnd() - 0.5) * 0.6;
    const h = 0.4 + (estrade ? 0 : -0.4);
    const t = 1.5 + rnd() * 0.25;
    boite(g, r, gx - 0.22, gx + 0.22, h, h + t - 0.35, a - 0.14, a + 0.14, couleurs[Math.floor(rnd() * couleurs.length)]!);
    boite(g, r, gx - 0.13, gx + 0.13, h + t - 0.33, h + t, a - 0.12, a + 0.12, PEAU[Math.floor(rnd() * PEAU.length)]!);
  }
}

function camionnette(g: Builder, r: Repere, couleur: number) {
  boiteChanfreinee(g, r, -1.1, 1.1, 0.5, 2.6, -2.6, 1.2, 0.15, couleur);
  boiteChanfreinee(g, r, -1.05, 1.05, 0.5, 2.0, 1.2, 2.6, 0.25, couleur);
  face(g, r, -0.95, 0.95, 1.35, 1.9, 2.61, 0x22303f);
  for (const [gg, aa] of [[-1.1, -1.8], [1.1, -1.8], [-1.1, 1.8], [1.1, 1.8]] as const) {
    tube(g, pt(r, gg - 0.15 * Math.sign(gg), 0.42, aa), pt(r, gg + 0.12 * Math.sign(gg), 0.42, aa), 0.42, 8, CAOUTCHOUC);
  }
  face(g, r, -1.12, 1.12, 1.1, 1.4, -2.61, 0xffffff);
}

function cone(g: Builder, x: number, y: number, z: number) {
  g.box(x - 0.3, y, z - 0.3, x + 0.3, y + 0.05, z + 0.3, CAOUTCHOUC);
  g.prism(x, y + 0.05, z, 0.22, 0.04, 0.7, 6, 0xff6a1a, 0xffffff);
}

function sapinNeige(g: Builder, x: number, y: number, z: number, h: number, vert: number, neige: number | null) {
  g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.2, z + 0.2, 0x5b3d26);
  for (let t = 0; t < 4; t++) {
    const f = t / 4;
    g.prism(x, y + h * (0.14 + f * 0.22), z, (2.0 - f * 1.3) * (h / 8), 0.05, h * 0.34, 7, shade(vert, 1 - f * 0.08), neige ?? shade(vert, 1.2), t * 0.4);
  }
}

function lampadaireB(c: Calques, r: Repere, h: number, lumiere: number) {
  boite(c.decor, r, -0.3, 0.3, 0, 0.5, -0.3, 0.3, BETON);
  tube(c.decor, pt(r, 0, 0.5, 0), pt(r, 0, h, 0), 0.1, 6, METAL_SOMBRE, 0.07);
  tube(c.decor, pt(r, 0, h, 0), pt(r, 0, h + 0.3, 1.4), 0.06, 4, METAL_SOMBRE);
  boiteChanfreinee(c.decor, r, -0.28, 0.28, h, h + 0.35, 1.1, 1.9, 0.08, METAL_SOMBRE);
  boite(c.decorLumineux, r, -0.22, 0.22, h - 0.02, h + 0.02, 1.2, 1.8, lumiere);
  c.decorLumineux.halo(...pt(r, 0, h - 0.1, 1.5), lumiere, 6);
}

function chalet(g: Builder, r: Repere, w: number) {
  boite(g, r, -w, w, 0, 0.8, -w * 0.8, w * 0.8, 0x8a8f99);
  boite(g, r, -w, w, 0.8, 3.4, -w * 0.8, w * 0.8, BOIS);
  for (let y = 1.0; y < 3.3; y += 0.35) face(g, r, -w - 0.01, w + 0.01, y, y + 0.04, -w * 0.8 - 0.01, shade(BOIS, 0.75));
  // Toit à deux pans, neigeux, qui déborde.
  const d = w * 0.8 + 0.6;
  g.quad(pt(r, -w - 0.6, 3.4, -d), pt(r, w + 0.6, 3.4, -d), pt(r, w + 0.6, 5.2, 0), pt(r, -w - 0.6, 5.2, 0), 0xf2f6fa);
  g.quad(pt(r, w + 0.6, 3.4, d), pt(r, -w - 0.6, 3.4, d), pt(r, -w - 0.6, 5.2, 0), pt(r, w + 0.6, 5.2, 0), 0xf2f6fa);
  g.tri(pt(r, -w, 3.4, -w * 0.8), pt(r, -w, 3.4, w * 0.8), pt(r, -w, 5.0, 0), BOIS_CLAIR);
  g.tri(pt(r, w, 3.4, w * 0.8), pt(r, w, 3.4, -w * 0.8), pt(r, w, 5.0, 0), BOIS_CLAIR);
  // Balcon, fenêtres, cheminée.
  boite(g, r, -w + 0.3, w - 0.3, 2.0, 2.1, -w * 0.8 - 1.0, -w * 0.8, BOIS_CLAIR);
  for (let gg = -w + 0.4; gg <= w - 0.4; gg += 0.5) boite(g, r, gg - 0.04, gg + 0.04, 2.1, 2.9, -w * 0.8 - 0.98, -w * 0.8 - 0.9, BOIS_CLAIR);
  for (const gg of [-w * 0.5, w * 0.5]) face(g, r, gg - 0.45, gg + 0.45, 2.2, 3.0, -w * 0.8 - 0.02, 0x2a3442);
  boite(g, r, w * 0.4, w * 0.4 + 0.5, 4.2, 5.8, -0.2, 0.3, 0x8a8f99);
}

function citerne(g: Builder, x: number, y: number, z: number) {
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]] as const) tube(g, [x + dx, y, z + dz], [x + dx * 0.6, y + 7, z + dz * 0.6], 0.12, 4, BOIS);
  g.prism(x, y + 7, z, 1.9, 1.9, 2.6, 10, BOIS_CLAIR, BOIS_CLAIR);
  g.prism(x, y + 9.6, z, 2.0, 0.1, 0.9, 10, METAL_SOMBRE);
}

function cactusB(g: Builder, x: number, y: number, z: number, h: number, rnd: () => number) {
  const v = mix(0x3f7a38, 0x5a9a48, rnd());
  g.prism(x, y, z, 0.4, 0.3, h, 8, v, shade(v, 1.15));
  for (const s of [-1, 1]) {
    if (rnd() < 0.25) continue;
    const ay = y + h * (0.3 + rnd() * 0.3);
    tube(g, [x, ay, z], [x + s * 1.0, ay + 0.2, z], 0.24, 6, v);
    g.prism(x + s * 1.0, ay + 0.1, z, 0.24, 0.2, 1 + rnd(), 6, v, shade(v, 1.15));
  }
}

function rocheB(g: Builder, x: number, y: number, z: number, r: number, couleur: number, rnd: () => number) {
  g.prism(x, y, z, r, r * 0.6, r * 0.7, 7, couleur, shade(couleur, 1.12), rnd() * 3);
  g.prism(x + r * 0.5, y, z + r * 0.3, r * 0.5, r * 0.3, r * 0.5, 6, shade(couleur, 0.9), couleur, rnd() * 3);
}

function immeubleB(c: Calques, r: Repere, w: number, d: number, h: number, mur: number, rnd: () => number) {
  const g = c.decor;
  boite(g, r, -w, w, 0, h, -d, d, mur, shade(mur, 0.92));
  boite(g, r, -w - 0.25, w + 0.25, h, h + 0.7, -d - 0.25, d + 0.25, shade(mur, 0.8));
  // Rez-de-chaussée : vitrine sombre et store rayé.
  face(g, r, -w + 0.4, w - 0.4, 0.3, 3.0, -d - 0.02, 0x22303f);
  const store = [0xe8283a, 0x21a35a, 0x1f5fbf, MARQUE.moutarde][Math.floor(rnd() * 4)]!;
  for (let k = 0, gg = -w + 0.2; gg < w - 0.2; k++, gg += 0.8) g.quad(pt(r, gg, 3.4, -d), pt(r, Math.min(w - 0.2, gg + 0.8), 3.4, -d), pt(r, Math.min(w - 0.2, gg + 0.8), 2.8, -d - 1.2), pt(r, gg, 2.8, -d - 1.2), k % 2 === 0 ? store : 0xffffff);
  // Étages : fenêtres encadrées, un balcon sur deux.
  for (let y = 4.2, i = 0; y < h - 1.5; y += 3.2, i++) {
    for (let gg = -w + 1; gg < w - 0.8; gg += 2.2) {
      face(g, r, gg, gg + 1.3, y, y + 1.7, -d - 0.02, 0x2f4a66);
      face(g, r, gg - 0.12, gg + 1.42, y - 0.12, y, -d - 0.03, 0xe8e8e8);
    }
    if (i % 2 === 1) boite(g, r, -w + 0.6, w - 0.6, y - 0.3, y - 0.15, -d - 0.9, -d, shade(mur, 0.85));
  }
  // Sur le toit : une citerne ou une antenne.
  if (rnd() < 0.5) g.prism(r.o[0], r.o[1] + h + 0.7, r.o[2], 1.0, 1.0, 1.8, 8, METAL_SOMBRE);
}

// --- Rebords propres à chaque thème ---------------------------------------------------------------------------------------------------

type Profil = [dehors: number, haut: number][];

/** Un profil extrudé le long du tronçon, par morceaux de `pas` m (bandes de couleur alignées sur la distance parcourue). */
function extruder(g: Builder, t: TronconRebord, profil: Profil, pas: number, couleur: (n: number, k: number) => number) {
  const ox = t.dehors[0];
  const oz = t.dehors[1];
  const at = (u: number, out: number, up: number): V3 => [t.a[0] + (t.b[0] - t.a[0]) * u + ox * out, t.a[1] + (t.b[1] - t.a[1]) * u + up, t.a[2] + (t.b[2] - t.a[2]) * u + oz * out];
  let u = 0;
  while (u < 1 - 1e-6) {
    const s = t.s + u * t.longueur;
    const n = Math.floor(s / pas + 1e-6);
    const fin = Math.min(1, ((n + 1) * pas - t.s) / t.longueur);
    for (let k = 0; k + 1 < profil.length; k++) {
      const [o0, h0] = profil[k]!;
      const [o1, h1] = profil[k + 1]!;
      g.quad(at(u, o0, h0), at(fin, o0, h0), at(fin, o1, h1), at(u, o1, h1), couleur(n, k));
    }
    u = fin;
  }
}

/** Points réguliers le long du tronçon (tous les `pas` m, alignés sur la distance parcourue) : rend (point au pied, numéro). */
function jalons(t: TronconRebord, pas: number, decal = 0): { p: V3; n: number }[] {
  const out: { p: V3; n: number }[] = [];
  const debut = Math.ceil((t.s - decal) / pas) * pas + decal;
  for (let s = debut; s < t.s + t.longueur; s += pas) {
    const u = (s - t.s) / t.longueur;
    out.push({ p: [t.a[0] + (t.b[0] - t.a[0]) * u, t.a[1] + (t.b[1] - t.a[1]) * u, t.a[2] + (t.b[2] - t.a[2]) * u], n: Math.round((s - decal) / pas) });
  }
  return out;
}

const JERSEY: Profil = [[0, 0], [0, 0.14], [0.2, 0.42], [0.3, 1.4], [0.55, 1.4], [0.6, -0.6]];

export type RebordB = "beton" | "pneus" | "bois" | "roche" | "glissiere" | "neige";
export const REBORDS_B: Record<PaletteName, RebordB> = { stade: "beton", nuit: "beton", ville: "beton", neon: "beton", desert: "pneus", campagne: "bois", canyon: "roche", alpin: "glissiere", neige: "neige" };

/** Le rebord de B pour un thème. Le mur de la simulation reste là où il est (au bord de la route) : seul l'habillage change. */
export function rebordB(nom: PaletteName, sorte: RebordB = REBORDS_B[nom]) {
  return (g: Builder, t: TronconRebord, lum?: Builder) => {
    const h = t.hauteur;
    const ox = t.dehors[0];
    const oz = t.dehors[1];
    const r = repereSegment(t.a, t.b);
    if (sorte === "beton") {
      const prof: Profil = JERSEY.map(([o, y]) => [o, y > 1 ? h : y] as [number, number]);
      // Béton peint par bandes de 4 m, joints sombres ; un catadioptre ambre tous les 8 m (la nuit, il s'allume).
      extruder(g, t, prof, 4, (n, k) => (k >= 3 ? shade(t.couleurs[n % 2]!, 0.9) : t.couleurs[n % 2]!));
      for (const { p, n } of jalons(t, 4)) {
        g.quad([p[0], p[1] + 0.02, p[2]], [p[0], p[1] + h, p[2]], [p[0] + ox * 0.32, p[1] + h, p[2] + oz * 0.32], [p[0] + ox * 0.02, p[1] + 0.14, p[2] + oz * 0.02], 0x3a3f4d);
        if (n % 2 === 0 && lum) {
          const q: V3 = [p[0] + ox * 0.28 + r.f[0] * 2, p[1] + h * 0.8, p[2] + oz * 0.28 + r.f[2] * 2];
          lum.quad([q[0] - r.f[0] * 0.15, q[1] - 0.08, q[2] - r.f[2] * 0.15], [q[0] + r.f[0] * 0.15, q[1] - 0.08, q[2] + r.f[2] * 0.15], [q[0] + r.f[0] * 0.15, q[1] + 0.08, q[2] + r.f[2] * 0.15], [q[0] - r.f[0] * 0.15, q[1] + 0.08, q[2] - r.f[2] * 0.15], 0xffb000);
        }
      }
    } else if (sorte === "pneus") {
      // Mur de pneus : une pile tous les 1,1 m (seule la moitié tournée vers la route est dessinée : trois pans, deux tons), une sur deux au haut
      // peint en blanc, et la courroie de caoutchouc devant. ≈ 15 triangles par pile.
      for (const { p, n } of jalons(t, 1.1)) {
        const c: V3 = [p[0] + ox * 0.5, p[1], p[2] + oz * 0.5];
        const pan = (k: number): V3 => {
          const a = Math.atan2(-oz, -ox) + ((k - 1.5) * Math.PI) / 3;
          return [c[0] + Math.cos(a) * 0.5, c[1], c[2] + Math.sin(a) * 0.5];
        };
        const haut = n % 2 === 0 ? t.couleurs[1] : CAOUTCHOUC;
        for (let k = 0; k < 3; k++) {
          const a0 = pan(k);
          const a1 = pan(k + 1);
          g.quad(a0, a1, [a1[0], a1[1] + 0.85, a1[2]], [a0[0], a0[1] + 0.85, a0[2]], CAOUTCHOUC);
          g.quad([a0[0], a0[1] + 0.85, a0[2]], [a1[0], a1[1] + 0.85, a1[2]], [a1[0], a1[1] + h, a1[2]], [a0[0], a0[1] + h, a0[2]], haut);
          g.tri([c[0], c[1] + h, c[2]], [a0[0], a0[1] + h, a0[2]], [a1[0], a1[1] + h, a1[2]], shade(haut, 0.85));
        }
      }
      extruder(g, t, [[0.0, 0.3], [0.0, 1.0]], 4, (n) => (n % 2 === 0 ? 0x2a2a30 : 0x222226));
    } else if (sorte === "bois") {
      // Clôture de bois : poteaux tous les 2,4 m, trois lisses, une planche basse.
      for (const { p } of jalons(t, 2.4)) g.box(p[0] + ox * 0.15 - 0.09, p[1] - 0.3, p[2] + oz * 0.15 - 0.09, p[0] + ox * 0.15 + 0.09, p[1] + h + 0.1, p[2] + oz * 0.15 + 0.09, t.couleurs[0]);
      for (const y of [0.45, 0.85, 1.25]) extruder(g, t, [[0.02, y], [0.02, y + 0.14], [0.1, y + 0.14]], 6, (n) => (n % 2 === 0 ? t.couleurs[1] : shade(t.couleurs[1], 0.92)));
      extruder(g, t, [[0.0, 0], [0.0, 0.3]], 6, () => shade(t.couleurs[0], 0.9));
    } else if (sorte === "roche") {
      // Blocs de roche empilés : hauteurs et retraits irréguliers (tirés de la distance : le même mur pour tout le monde).
      for (const { p, n } of jalons(t, 2.2)) {
        const k = ((n * 2654435761) >>> 0) / 4294967296;
        const hh = h * (0.9 + k * 0.45);
        const c = k < 0.5 ? t.couleurs[0] : t.couleurs[1];
        const rr: Repere = { o: [p[0] + ox * 0.5, p[1], p[2] + oz * 0.5], f: r.f, l: r.l };
        boiteChanfreinee(g, rr, -0.55 - k * 0.2, 0.5, -0.6, hh, -1.25, 1.25, 0.25, c, shade(c, 1.12));
      }
    } else if (sorte === "glissiere") {
      // Glissière double : poteaux tous les 2 m, deux lisses en « W », un catadioptre rouge et blanc tous les 8 m.
      for (const { p, n } of jalons(t, 2)) {
        g.box(p[0] + ox * 0.35 - 0.07, p[1] - 0.4, p[2] + oz * 0.35 - 0.07, p[0] + ox * 0.35 + 0.07, p[1] + h, p[2] + oz * 0.35 + 0.07, METAL_SOMBRE);
        if (n % 4 === 0 && lum) {
          const q: V3 = [p[0] + ox * 0.2, p[1] + h - 0.1, p[2] + oz * 0.2];
          lum.quad([q[0] - r.f[0] * 0.12, q[1] - 0.25, q[2] - r.f[2] * 0.12], [q[0] + r.f[0] * 0.12, q[1] - 0.25, q[2] + r.f[2] * 0.12], [q[0] + r.f[0] * 0.12, q[1] + 0.1, q[2] + r.f[2] * 0.12], [q[0] - r.f[0] * 0.12, q[1] + 0.1, q[2] - r.f[2] * 0.12], n % 8 === 0 ? 0xe8283a : 0xffffff);
        }
      }
      for (const y of [0.55, 1.05]) extruder(g, t, [[0.25, y - 0.18], [0.18, y - 0.1], [0.25, y], [0.18, y + 0.1], [0.25, y + 0.18]], 4, (n, k) => (k % 2 === 0 ? (n % 2 === 0 ? t.couleurs[0] : t.couleurs[1]) : shade(METAL, 1.1)));
    } else {
      // Banquise : une congère tassée (blanc bleuté) et un jalon bleu et blanc tous les 6 m.
      extruder(g, t, [[0, 0], [0.15, 0.7], [0.45, 1.25], [0.9, h], [1.6, 0.5], [2.0, -0.6]], 8, (_n, k) => (k < 2 ? 0xe9f1f8 : k < 4 ? 0xffffff : 0xdce8f2));
      for (const { p, n } of jalons(t, 6)) {
        const q: V3 = [p[0] + ox * 0.6, p[1] + 1.2, p[2] + oz * 0.6];
        g.box(q[0] - 0.06, q[1], q[2] - 0.06, q[0] + 0.06, q[1] + 1.6, q[2] + 0.06, n % 2 === 0 ? t.couleurs[0] : 0xffffff);
        g.box(q[0] - 0.07, q[1] + 1.2, q[2] - 0.07, q[0] + 0.07, q[1] + 1.6, q[2] + 0.07, 0xe8283a);
      }
    }
  };
}

export function routeB(nom: PaletteName, sorte: RebordB = REBORDS_B[nom]): StyleRoute {
  const rebord = rebordB(nom, sorte);
  return {
    ...STYLE_ORIGINE,
    rebord(g, t, _pal, lum) {
      rebord(g, t, lum);
    },
    bordureVide(g, l, t, pal, milieu) {
      // Bord du vide : la bordure de l'existant et des balises réfléchissantes tous les 8 m (plots blancs, catadioptre).
      STYLE_ORIGINE.bordureVide(g, l, t, pal, milieu);
      for (const { p } of jalons(t, 8)) {
        g.box(p[0] - 0.08, p[1], p[2] - 0.08, p[0] + 0.08, p[1] + 1.0, p[2] + 0.08, 0xf4f4f4);
        g.box(p[0] - 0.09, p[1] + 0.7, p[2] - 0.09, p[0] + 0.09, p[1] + 0.85, p[2] + 0.09, CAOUTCHOUC);
        l.box(p[0] - 0.1, p[1] + 0.86, p[2] - 0.1, p[0] + 0.1, p[1] + 0.96, p[2] + 0.1, 0xffb000);
      }
    },
  };
}

// --- Éléments ---------------------------------------------------------------------------------------------------------------------

function ecart(b: Block, q: number): number {
  return b.shoulder ? SHOULDER_EDGE - 0.6 : blockHalfWidth(b, q) + 1.6;
}

/** Portique en treillis : deux mâts, une poutre, un panneau ; câbles, pneus et drapeaux au pied. Rend le repère, l'écart et la hauteur. */
function portiqueTreillis(c: Calques, x: Contexte, b: Block, q: number, couleur: number) {
  const r = repereBloc(b, q);
  const w = ecart(b, q);
  const h = 8.4;
  for (const s of [-1, 1]) {
    boiteChanfreinee(c.solide, r, s * w - 0.9, s * w + 0.9, -0.1, 0.9, -0.9, 0.9, 0.15, BETON);
    treillisVertical(c.solide, r, s * w, 0, 0.9, h + 1.8, 0.9, couleur);
    // Pied : sponsors sur le socle, piles de pneus, câble qui descend de la poutre.
    const logos = SPONSORS[x.palette];
    c.affiches.face(r, s * w - 0.85, s * w + 0.85, 0.05, 0.85, -0.91, rect(logos[(s + 1) / 2 % logos.length]!));
    for (const [dg, da] of [[1.6, -0.6], [1.6, 0.4], [2.3, 0]] as const) pneus(c.solide, ...pt(r, s * (w + dg), 0, da), 3, (dg + da) % 2 ? 0xf4f4f4 : CAOUTCHOUC);
    cable(c.solide, pt(r, s * w, h + 1.0, 0.5), pt(r, s * (w + 3.5), 0, 2.5), 0.8);
    drapeau(c.solide, ...pt(r, s * w, h + 1.8, 0), 2.2, s > 0 ? MARQUE.livree : 0x2e7dff, 0.3);
  }
  treillisPoutre(c.solide, r, -w - 0.45, w + 0.45, h, 1.8, 1.0, couleur);
  return { r, w, h };
}

/**
 * Les feux de départ : cinq boîtiers de deux feux rouges sous la poutre, à l'avance `a`. Allumés ici ; un lot de mise en œuvre peut les allumer un à
 * un pendant le décompte (« 3, 2, 1 ») puis les éteindre au « PARTEZ ! » (présentation seule, lue dans l'état de la course).
 */
export function feuxDeDepart(c: Calques, r: Repere, h: number, a: number) {
  for (let i = 0; i < 5; i++) {
    const gg = (i - 2) * 1.1;
    boiteChanfreinee(c.solide, r, gg - 0.4, gg + 0.4, h - 1.5, h, a - 0.2, a + 0.2, 0.08, CAOUTCHOUC);
    for (const y of [h - 0.5, h - 1.1]) {
      c.lumineux.prism(...pt(r, gg, y - 0.2, a - 0.21), 0.22, 0.22, 0.4, 8, 0xff2a1a);
      c.lumineux.halo(...pt(r, gg, y, a - 0.35), 0xff3b30, 2.2);
    }
  }
}

export function portiqueDepartB(c: Calques, x: Contexte, b: Block, q: number) {
  const { r, w, h } = portiqueTreillis(c, x, b, q, METAL);
  // Panneau à diodes « DÉPART » devant la poutre, et les feux de départ (cinq paires de rouges) dessous.
  boiteChanfreinee(c.solide, r, -w + 1.2, w - 1.2, h + 0.1, h + 1.7, -0.75, -0.5, 0.06, METAL_SOMBRE);
  if (!c.aerien) {
    const tex = textureBandeau("DÉPART", { fond: 0x0b0d12, encre: 0xff3b30, diodes: true });
    c.bandeaux.push(bandeau(tex, pt(r, w - 1.4, h + 0.2, -0.76), pt(r, -w + 1.4, h + 0.2, -0.76), pt(r, -w + 1.4, h + 1.6, -0.76), pt(r, w - 1.4, h + 1.6, -0.76)));
    c.bandeaux.push(bandeau(tex, pt(r, -w + 1.4, h + 0.2, 0.52), pt(r, w - 1.4, h + 0.2, 0.52), pt(r, w - 1.4, h + 1.6, 0.52), pt(r, -w + 1.4, h + 1.6, 0.52)));
  }
  feuxDeDepart(c, r, h, -0.45);
  // Au sol : la ligne, la grille (deux cases peintes, numéros simplifiés : des tirets).
  const hw = blockHalfWidth(b, q);
  sol(c.route, r, -hw, hw, -0.3, 0.3, 0.05, 0xf4f4f4);
  const r8 = repereBloc(b, 8);
  for (const s of [-1, 1]) sol(c.route, r8, s * 1.5 - 0.15, s * 1.5 + 0.15, -2.5, 2.8, 0.05, 0xf4f4f4);
  sol(c.route, r8, -1.65, 1.65, 2.6, 2.9, 0.05, 0xf4f4f4);
}

export function arriveeB(c: Calques, x: Contexte, b: Block, q: number) {
  const { r, w, h } = portiqueTreillis(c, x, b, q, METAL);
  if (!c.aerien) {
    const tex = textureBandeau("ARRIVÉE", { fond: 0xf4f4f4, encre: 0x16181f, damier: [0x16181f, 0xf4f4f4] });
    c.bandeaux.push(bandeau(tex, pt(r, w - 1, h + 0.1, -0.56), pt(r, -w + 1, h + 0.1, -0.56), pt(r, -w + 1, h + 1.7, -0.56), pt(r, w - 1, h + 1.7, -0.56)));
    c.bandeaux.push(bandeau(tex, pt(r, -w + 1, h + 0.1, 0.56), pt(r, w - 1, h + 0.1, 0.56), pt(r, w - 1, h + 1.7, 0.56), pt(r, -w + 1, h + 1.7, 0.56)));
  }
  // Drapeaux à damier qui pendent sous la poutre.
  for (let i = -2; i <= 2; i++) {
    const g0 = i * 3 - 0.6;
    for (let a = 0; a < 4; a++) for (let k = 0; k < 3; k++) face(c.solide, r, g0 + a * 0.3, g0 + (a + 1) * 0.3, h - 0.9 + k * 0.3, h - 0.6 + k * 0.3, -0.4, (a + k) % 2 === 0 ? 0x16181f : 0xf4f4f4);
  }
  // La tour de chronométrage, à gauche après la ligne.
  const tour = repereBloc(b, q + 4, w + 3.5);
  boiteChanfreinee(c.solide, tour, -1.2, 1.2, x.floorY - b.y0, 6.5, -1.2, 1.2, 0.2, 0xe9edf2);
  c.affiches.face(tour, -1.1, 1.1, 5.0, 6.1, -1.21, rect("chrono"));
  boite(c.solide, tour, -1.4, 1.4, 6.5, 6.8, -1.4, 1.4, MARQUE.livree);
  const hw = blockHalfWidth(b, q);
  damierSol(c.route, r, hw, 2, 1, 0.05, 0x16181f, 0xf4f4f4);
}

export function porteB(c: Calques, x: Contexte, b: Block) {
  // Arche gonflable : un demi-ovale de boudins, bandes blanches, lestée à ses pieds ; une banderole de sponsor ; deux bornes de chronométrage.
  const q = CELL / 2;
  const r = repereBloc(b, q);
  const w = ecart(b, q) - 0.2;
  const H = 7.5;
  const col = x.pal.checkpoint;
  const n = 16;
  let prev = pt(r, w, 0, 0);
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    const p = pt(r, Math.cos(a) * w, Math.sin(a) * H, 0);
    tube(c.solide, prev, p, 0.85, 8, i % 3 === 0 ? 0xffffff : col);
    prev = p;
  }
  for (const s of [-1, 1]) {
    boiteChanfreinee(c.solide, r, s * w - 1, s * w + 1, 0, 0.6, -1, 1, 0.12, CAOUTCHOUC);
    const borne = repereBloc(b, q - 3, s * (w - 2.2));
    tube(c.solide, pt(borne, 0, 0, 0), pt(borne, 0, 1.0, 0), 0.06, 4, METAL_SOMBRE);
    boiteChanfreinee(c.solide, borne, -0.25, 0.25, 1.0, 1.45, -0.2, 0.2, 0.05, 0x22262e);
    c.lumineux.prism(...pt(borne, 0, 1.12, -0.21), 0.08, 0.08, 0.2, 6, 0xff2a1a);
  }
  const logos = SPONSORS[x.palette];
  c.affiches.face(r, -3, 3, H - 0.4, H + 1.0, -0.86, rect(logos[b.index % logos.length]!));
  c.affiches.quad(pt(r, -3, H - 0.4, 0.86), pt(r, 3, H - 0.4, 0.86), pt(r, 3, H + 1.0, 0.86), pt(r, -3, H + 1.0, 0.86), rect(logos[b.index % logos.length]!));
  for (const s of [-1, 1]) c.lumineux.halo(...pt(r, s * w * 0.7, H * 0.7, 0), col, 6);
  const hw = b.shoulder ? SHOULDER_EDGE : blockHalfWidth(b, q);
  sol(c.lumineux, r, -hw, hw, -0.5, 0.5, 0.05, mix(col, 0xffffff, 0.25));
}

/** Plaque en métal : cadre chanfreiné, rivets, flèches à diodes (lumineuses), aérations sur les bords. */
export function plaqueB(c: Calques, b: Block, fond: number, diodes: number, n: number) {
  const r = repereBloc(b, CELL / 2);
  const ph = blockPadHalfWidth(b);
  const hl = 4;
  for (const [g0, g1, a0, a1] of [[-ph - 0.4, ph + 0.4, -hl - 0.4, -hl], [-ph - 0.4, ph + 0.4, hl, hl + 0.4], [-ph - 0.4, -ph, -hl, hl], [ph, ph + 0.4, -hl, hl]] as const) {
    boiteChanfreinee(c.route, r, g0, g1, 0, 0.07, a0, a1, 0.03, METAL);
  }
  sol(c.route, r, -ph, ph, -hl, hl, 0.04, fond);
  for (let a = -hl - 0.2; a <= hl + 0.2; a += 0.8) for (const g of [-ph - 0.2, ph + 0.2]) c.route.box(...pt(r, g - 0.05, 0.07, a - 0.05), ...pt(r, g + 0.05, 0.1, a + 0.05), METAL_SOMBRE);
  for (const s of [-1, 1]) for (let a = -hl + 0.6; a < hl - 0.4; a += 0.5) sol(c.route, r, s * (ph - 0.9), s * (ph - 0.3), a, a + 0.22, 0.05, shade(fond, 0.6));
  for (let i = 0; i < n; i++) chevronSol(c.lumineux, r, -hl + 2.3 + (i * (2 * hl - 2.6)) / Math.max(1, n - 1), ph - 1.4, 0.55, 0.06, diodes);
  c.lumineux.halo(...pt(r, 0, 0.5, 0), diodes, 6);
}

export function panneauB(c: Calques, _x: Contexte, hote: Block, s: SignSpec) {
  const r0 = repereBloc(hote, s.q, s.side * s.offset);
  const style = signStyleOf(s.kind, s.severity);
  const plaque = style === "red" ? 0xe8283a : style === "orange" ? 0xff8a1a : style === "blue" ? 0x1f6fd0 : 0xffc61a;
  const encre = style === "red" || style === "blue" ? 0xffffff : 0x14161c;
  const half = 1.3;
  const h0 = 2.4;
  // Deux pieds en tube sur leurs semelles boulonnées, une jambe de force, le cadre en métal, la plaque réfléchissante.
  for (const g of [-0.7, 0.7]) {
    tube(c.solide, pt(r0, g, 0, 0.12), pt(r0, g, h0 + half * 2 - 0.2, 0.12), 0.07, 6, METAL);
    boite(c.solide, r0, g - 0.25, g + 0.25, 0, 0.05, -0.13, 0.37, METAL_SOMBRE);
    for (const [dg, da] of [[-0.18, -0.06], [0.18, -0.06], [-0.18, 0.3], [0.18, 0.3]] as const) c.solide.box(...pt(r0, g + dg - 0.03, 0.05, da - 0.03), ...pt(r0, g + dg + 0.03, 0.1, da + 0.03), METAL);
  }
  tube(c.solide, pt(r0, 0.7, 0.9, 0.12), pt(r0, -0.7, h0 + 0.4, 0.12), 0.04, 4, METAL);
  boiteChanfreinee(c.solide, r0, -half - 0.12, half + 0.12, h0 - 0.12, h0 + 2 * half + 0.12, -0.06, 0.06, 0.04, METAL_SOMBRE);
  face(c.lumineux, r0, -half, half, h0, h0 + 2 * half, -0.07, plaque);
  const centre = pt(r0, 0, h0 + half, -0.08);
  const pl = { c: centre, right: [-r0.l[0] * half / 0.9, 0, -r0.l[2] * half / 0.9] as V3, up: [0, half / 0.9, 0] as V3, toward: [-r0.f[0], 0, -r0.f[2]] as V3 };
  drawGlyph(c.lumineux, pl, s.kind, s.severity, s.cuve, 0.01, encre);
  // Panneaux de distance (deux traits, puis un) plantés avant, du même côté, s'il y a la place sur le bloc.
  for (const [dq, logo] of [[-20, "distance2"], [-10, "distance1"]] as const) {
    if (s.q + dq < 2) continue;
    const rd = repereBloc(hote, s.q + dq, s.side * s.offset);
    tube(c.solide, pt(rd, 0, 0, 0.05), pt(rd, 0, 1.2, 0.05), 0.05, 4, METAL);
    c.affiches.face(rd, -0.55, 0.55, 1.2, 2.3, -0.02, rect(logo));
    boite(c.solide, rd, -0.6, 0.6, 1.15, 2.35, 0, 0.04, METAL_SOMBRE);
  }
}

export function rythmeB(c: Calques, x: Contexte, b: Block, rapide: boolean) {
  if (b.kind === "jump" || b.kind === "gap" || b.kind === "kick") return;
  const rail = b.open ? 0 : (x.pal.wallHeight ?? 1.4);
  const hw = (u: number) => (isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, u * CELL));
  // Balises : un poteau blanc à bande noire et catadioptre (ambre, ou orange dans une portion rapide), sur le rebord.
  for (const u of rapide ? [0.125, 0.375, 0.625, 0.875] : [0.25, 0.75]) {
    for (const side of [-1, 1]) {
      const p = onBlock(b, side * (hw(u) + 0.35), u, rail);
      c.solide.prism(p[0], p[1], p[2], 0.13, 0.11, 1.4, 6, 0xf4f4f4, 0xf4f4f4);
      c.solide.box(p[0] - 0.14, p[1] + 0.9, p[2] - 0.14, p[0] + 0.14, p[1] + 1.15, p[2] + 0.14, CAOUTCHOUC);
      c.lumineux.box(p[0] - 0.15, p[1] + 1.0, p[2] - 0.15, p[0] + 0.15, p[1] + 1.08, p[2] + 0.15, rapide ? 0xff6a1a : 0xffb000);
    }
  }
  if (!rapide || b.index % 2 !== 0 || isCurve(b.kind)) return;
  const r = repereBloc(b, CELL / 2);
  const w = blockHalfWidth(b, CELL / 2) + 0.8;
  for (const s of [-1, 1]) treillisVertical(c.solide, r, s * w, 0, rail, rail + 7, 0.6, METAL);
  treillisPoutre(c.solide, r, -w - 0.3, w + 0.3, rail + 7, 0.9, 0.6, METAL);
  const logos = SPONSORS[x.palette];
  c.affiches.face(r, -3, 3, rail + 6.9, rail + 8.1, -0.32, rect(logos[(b.index >> 1) % logos.length]!));
}

// --- Décor : des vignettes qui racontent, par thème ----------------------------------------------------------------------------------

type Recette = (c: Calques, x: Contexte, p: PlaceDecor, rnd: () => number) => void;

const versRoute = (p: PlaceDecor) => Math.atan2(p.versRoute[0], p.versRoute[1]);

export const RECETTES_B: Record<PaletteName, Recette> = {
  stade(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.35) {
      // Tente d'accueil rayée et ses fanions.
      boite(c.decor, r, -3, 3, 0, 2.4, -2.5, 2.5, 0xf4f4f4);
      c.decor.prism(r.o[0], y + 2.4, r.o[2], 4.4, 0.05, 2.2, 4, MARQUE.livree, 0xf4f4f4, Math.PI / 4);
      drapeau(c.decor, ...pt(r, 3.5, 0, -2.5), 5, 0x2e7dff, versRoute(p));
    } else if (k < 0.6) {
      panneauPub(c, r, 3, 1.4, SPONSORS.stade[Math.floor(rnd() * SPONSORS.stade.length)]!);
      pneus(c.decor, ...pt(r, -4, 0, 0.8), 3, 0xf4f4f4);
    } else if (k < 0.85) {
      foule(c.decor, r, 6 + Math.floor(rnd() * 6), 6, rnd);
      boite(c.decor, r, -3.3, 3.3, 0, 1.1, -1.2, -1.1, METAL);
    } else {
      // Poste de commissaire : une cabine, un drapeau jaune.
      boiteChanfreinee(c.decor, r, -1, 1, 0, 2.4, -1, 1, 0.15, 0xf4f4f4, MARQUE.livree);
      drapeau(c.decor, ...pt(r, 1.2, 0, -1), 3.2, 0xffd23f, versRoute(p));
    }
  },
  desert(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.3) {
      // Assistance : une camionnette, des piles de pneus, un auvent.
      camionnette(c.decor, r, [0xe8552d, 0x2e7dff, 0xf4f4f4][Math.floor(rnd() * 3)]!);
      for (let i = 0; i < 3; i++) pneus(c.decor, ...pt(r, 2.2 + i * 0.95, 0, -1), 2 + (i % 2));
      boite(c.decor, r, -4.5, -2, 2.6, 2.7, -2, 2, 0xf2e2c4);
      for (const a of [-1.9, 1.9]) boite(c.decor, r, -4.45, -4.35, 0, 2.6, a - 0.05, a + 0.05, METAL);
    } else if (k < 0.55) {
      cactusB(c.decor, p.x, y, p.z, 3.5 + rnd() * 3, rnd);
      if (rnd() < 0.5) cactusB(c.decor, p.x + 2.5, y, p.z + 1.4, 2 + rnd() * 2, rnd);
    } else if (k < 0.8) {
      rocheB(c.decor, p.x, y, p.z, 1.2 + rnd() * 1.6, mix(0xa86a44, 0xd09a6a, rnd()), rnd);
    } else {
      // Spectateurs sur un rocher, un parasol.
      rocheB(c.decor, p.x, y, p.z, 2.2, 0xb8754a, rnd);
      foule(c.decor, repereSol(p.x, y + 1.4, p.z, versRoute(p)), 4, 2.4, rnd, false);
      tube(c.decor, [p.x + 1.2, y + 1.4, p.z], [p.x + 1.2, y + 3.6, p.z], 0.04, 4, METAL);
      c.decor.prism(p.x + 1.2, y + 3.3, p.z, 1.3, 0.05, 0.5, 8, MARQUE.livree, 0xf4f4f4);
    }
  },
  neige(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (k < 0.55) {
      for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) sapinNeige(c.decor, p.x + (rnd() - 0.5) * 6, y, p.z + (rnd() - 0.5) * 6, 6 + rnd() * 5, 0x1f5a3c, 0xffffff);
    } else if (k < 0.75 && p.anneau === 2) {
      // Cabane de pêche sur la glace, un trou, une luge.
      boiteChanfreinee(c.decor, r, -1.2, 1.2, 0, 2.2, -1.5, 1.5, 0.12, 0xc2401f);
      c.decor.prism(r.o[0], y + 2.2, r.o[2], 2.1, 0.05, 1.0, 4, 0xf4f4f4, 0xf4f4f4, Math.PI / 4);
      sol(c.decor, r, 2, 3, -0.5, 0.5, 0.02, 0x1d3550);
      boite(c.decor, r, -2.5, -1.9, 0, 0.25, -1, 1, BOIS);
    } else if (k < 0.9) {
      c.decor.prism(p.x, y, p.z, 1.8 + rnd() * 2, 0.7, 1.4 + rnd() * 1.8, 6, 0xcfe4f4, 0xffffff, rnd() * 3);
    } else {
      panneauPub(c, r, 2.4, 1.2, "glacier");
    }
  },
  nuit(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 1 && k < 0.5) lampadaireB(c, r, 6.5, 0xffb347);
    else if (k < 0.7 && p.anneau === 2) {
      // Un motel au bord de la route : un volume bas, des fenêtres allumées, son enseigne.
      boite(c.decor, r, -6, 6, 0, 3.2, -2.5, 2.5, 0x2a2f45);
      for (let g = -5; g < 5; g += 2) face(c.decorLumineux, r, g, g + 1.2, 1.0, 2.2, -2.52, rnd() < 0.6 ? 0xffd98a : 0x1d2030);
      c.affiches.face(r, -2, 2, 3.4, 5.4, -1, rect("motel"));
      c.decorLumineux.halo(...pt(r, 0, 4.4, -1.4), 0xff2bd6, 9);
    } else if (k < 0.85) {
      for (let i = 0; i < 4; i++) cone(c.decor, ...pt(r, (i - 1.5) * 1.6, 0, 0));
      camionnette(c.decor, repereSol(p.x + 3, y, p.z, versRoute(p) + 1.4), 0x2a2f45);
    } else sapinNeige(c.decor, p.x, y, p.z, 6 + rnd() * 3, 0x16303a, null);
  },
  campagne(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.3) {
      // Ferme : la grange rouge, le silo, une botte de foin.
      boite(c.decor, r, -4, 4, 0, 4.5, -3, 3, 0xb03a22);
      for (let g = -3.8; g < 4; g += 0.6) face(c.decor, r, g, g + 0.05, 0, 4.5, -3.01, shade(0xb03a22, 0.8));
      c.decor.quad(pt(r, -4.3, 4.5, -3.4), pt(r, 4.3, 4.5, -3.4), pt(r, 4.3, 7.2, 0), pt(r, -4.3, 7.2, 0), 0x4a4440);
      c.decor.quad(pt(r, 4.3, 4.5, 3.4), pt(r, -4.3, 4.5, 3.4), pt(r, -4.3, 7.2, 0), pt(r, 4.3, 7.2, 0), 0x4a4440);
      c.decor.tri(pt(r, -4, 4.5, -3), pt(r, -4, 4.5, 3), pt(r, -4, 7.2, 0), 0xb03a22);
      c.decor.tri(pt(r, 4, 4.5, 3), pt(r, 4, 4.5, -3), pt(r, 4, 7.2, 0), 0xb03a22);
      face(c.decor, r, -1.4, 1.4, 0, 3.2, -3.02, 0xf4f4f4);
      c.decor.prism(...pt(r, 6, 0, 0), 1.6, 1.6, 8, 10, 0xc9ced6, 0xc9ced6);
      c.decor.prism(...pt(r, 6, 8, 0), 1.6, 0.2, 1.2, 10, 0x8a9099);
    } else if (k < 0.55) {
      // Arbre : un tronc, trois boules de feuillage.
      const h = 4 + rnd() * 2.5;
      tube(c.decor, [p.x, y, p.z], [p.x, y + h * 0.6, p.z], 0.28, 6, 0x6a4528, 0.2);
      for (let i = 0; i < 3; i++) {
        const v = mix(0x2f8f3a, 0x5cbb4a, rnd());
        const ox = (rnd() - 0.5) * 2;
        const oz = (rnd() - 0.5) * 2;
        c.decor.prism(p.x + ox, y + h * 0.45 + i * 0.6, p.z + oz, 1.6 + rnd() * 0.5, 0.6, 2.2, 7, v, shade(v, 1.18), rnd());
      }
    } else if (k < 0.8) {
      for (let i = 0; i < 3; i++) {
        const R = 0.8 + rnd() * 0.3;
        tube(c.decor, pt(r, (i - 1) * 2.2, R, -0.8), pt(r, (i - 1) * 2.2, R, 0.8), R, 10, 0xe2bd5c);
      }
    } else {
      // Tracteur : le capot, la cabine, les grandes roues.
      boiteChanfreinee(c.decor, r, -0.8, 0.8, 0.8, 1.9, 0, 2.4, 0.15, 0x21a35a);
      boite(c.decor, r, -0.9, 0.9, 0.8, 3.0, -1.2, 0, 0x21a35a);
      face(c.decor, r, -0.8, 0.8, 2.0, 2.8, 0.01, 0x22303f);
      for (const s of [-1, 1]) {
        tube(c.decor, pt(r, s * 0.9, 0.9, -0.6), pt(r, s * 1.4, 0.9, -0.6), 0.9, 10, CAOUTCHOUC);
        tube(c.decor, pt(r, s * 0.8, 0.5, 1.8), pt(r, s * 1.15, 0.5, 1.8), 0.5, 8, CAOUTCHOUC);
      }
    }
  },
  canyon(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.4) {
      // Mesa à strates, plus découpée.
      const w = 5 + rnd() * 5;
      const h = 12 + rnd() * 14;
      for (let i = 0; i < 5; i++) {
        const s = w * (1 - i * 0.12) + (rnd() - 0.5);
        const c1 = i % 2 === 0 ? 0xa8452a : 0xc9683c;
        boiteChanfreinee(c.decor, repereSol(p.x + (rnd() - 0.5), y + (h * i) / 5, p.z + (rnd() - 0.5), versRoute(p)), -s, s, 0, h / 5, -s * 0.8, s * 0.8, 0.4, c1, shade(c1, 1.1));
      }
    } else if (k < 0.55) citerne(c.decor, p.x, y, p.z);
    else if (k < 0.8) {
      cactusB(c.decor, p.x, y, p.z, 3 + rnd() * 3, rnd);
      rocheB(c.decor, p.x + 2, y, p.z + 1, 1 + rnd(), 0xb86a46, rnd);
    } else panneauPub(c, r, 2.6, 1.3, "rodeo", 1.4);
  },
  alpin(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (k < 0.45) {
      for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) sapinNeige(c.decor, p.x + (rnd() - 0.5) * 7, y, p.z + (rnd() - 0.5) * 7, 7 + rnd() * 5, 0x1f5a3c, 0xffffff);
    } else if (k < 0.7 && p.anneau === 2) chalet(c.decor, r, 3 + rnd());
    else if (k < 0.85 && p.anneau === 2) {
      // Pylône de télésiège et son câble.
      tube(c.decor, [p.x, y, p.z], [p.x, y + 12, p.z], 0.35, 6, METAL);
      boite(c.decor, r, -3, 3, 11.6, 12.1, -0.3, 0.3, METAL_SOMBRE);
      for (const s of [-2.8, 2.8]) tube(c.decor, pt(r, s, 11.6, -30), pt(r, s, 11.6, 30), 0.05, 3, CAOUTCHOUC);
    } else if (k < 0.93) {
      rocheB(c.decor, p.x, y, p.z, 1.5 + rnd() * 2, 0x7d8896, rnd);
    } else panneauPub(c, r, 2.2, 1.1, "col");
  },
  ville(c, x, p, rnd) {
    const y = x.floorY;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    if (p.anneau === 2 || rnd() < 0.35) immeubleB(c, r, 4 + rnd() * 3, 4 + rnd() * 2.5, 12 + rnd() * 22, mix(0xb9bdc4, 0xe0d6c8, rnd()), rnd);
    else if (rnd() < 0.5) {
      lampadaireB(c, r, 6, 0xfff0c8);
      // Abribus : un toit, deux montants, une affiche.
      const ab = repereSol(p.x + 3, y, p.z, versRoute(p));
      boite(c.decor, ab, -2, 2, 2.4, 2.55, -0.8, 0.8, METAL_SOMBRE);
      for (const g of [-1.9, 1.9]) boite(c.decor, ab, g - 0.05, g + 0.05, 0, 2.4, 0.6, 0.7, METAL_SOMBRE);
      c.affiches.face(ab, -1.8, -0.2, 0.4, 2.2, 0.69, rect(SPONSORS.ville[Math.floor(rnd() * SPONSORS.ville.length)]!));
    } else {
      // Feu tricolore et caisses.
      tube(c.decor, [p.x, y, p.z], [p.x, y + 3.2, p.z], 0.08, 6, METAL_SOMBRE);
      c.decor.box(p.x - 0.22, y + 3.2, p.z - 0.18, p.x + 0.22, y + 4.4, p.z + 0.18, CAOUTCHOUC);
      for (const [dy, col] of [[0.25, 0x2fd37b], [0.6, 0x3a2a10], [0.95, 0x3a1010]] as const) c.decorLumineux.box(p.x - 0.12, y + 3.2 + dy - 0.1, p.z - 0.19, p.x + 0.12, y + 3.2 + dy + 0.1, p.z - 0.18, col);
      for (let i = 0; i < 3; i++) boiteChanfreinee(c.decor, repereSol(p.x + 2 + i * 0.3, y + (i === 2 ? 0.9 : 0), p.z + (i === 1 ? 1 : 0), 0.3), -0.45, 0.45, 0, 0.9, -0.45, 0.45, 0.06, BOIS_CLAIR);
    }
  },
  neon(c, x, p, rnd) {
    RECETTES_B.nuit(c, x, p, rnd);
  },
};

/** La tribune du départ (B) : gradins, foule en personnes, toit sur poteaux, sponsors, socle plein jusqu'au sol. */
export function tribuneB(c: Calques, x: Contexte, b: Block, rnd: () => number) {
  const hw = blockHalfWidth(b, CELL / 2);
  const r = repereBloc(b, 16, hw + 4.2);
  boite(c.decor, r, 0, 8.5, x.floorY - b.y0, 0.2, -11, 11, BETON);
  for (let i = 0; i < 3; i++) {
    const g0 = i * 2.4;
    boite(c.decor, r, g0, 8.5, 0, 1 + i * 1.2, -11, 11, shade(BETON, 1 - i * 0.04));
    for (let a = -10.5; a < 10.5; a += 0.75) {
      if (rnd() < 0.15) continue;
      const rr: Repere = { o: pt(r, g0 + 1.2, 1 + i * 1.2, a), f: [-r.l[0], 0, -r.l[2]], l: r.f };
      foule(c.decor, rr, 1, 0.4, rnd, false);
    }
  }
  for (const a of [-10.6, 0, 10.6]) tube(c.decor, pt(r, 8.2, 0, a), pt(r, 8.2, 7.6, a), 0.12, 6, METAL_SOMBRE);
  boiteChanfreinee(c.decor, r, -0.8, 8.6, 7.6, 8.0, -11.4, 11.4, 0.1, MARQUE.livree);
  const logos = SPONSORS[x.palette];
  for (let i = 0; i < 4; i++) c.affiches.quad(pt(r, -0.85, 7.6, -11 + i * 5.5), pt(r, -0.85, 7.6, -11 + (i + 1) * 5.5 - 0.3), pt(r, -0.85, 8.0, -11 + (i + 1) * 5.5 - 0.3), pt(r, -0.85, 8.0, -11 + i * 5.5), rect(logos[i % logos.length]!));
}

function decorB(c: Calques, x: Contexte, rnd: () => number) {
  tribuneB(c, x, x.track.blocks[0]!, rnd);
  const recette = RECETTES_B[x.palette];
  for (const p of placesDeDecor(x.track, rnd, (anneau) => (anneau === 1 ? (rnd() < 0.8 ? 1 : 0) : 1 + (rnd() < 0.5 ? 1 : 0)))) recette(c, x, p, rnd);
}

// IIFE annotée pure : l'empaqueteur peut écarter la direction entière si personne ne la lit (poids par partie, lots de mise en œuvre).
export const DIRECTION_B: Direction = /* @__PURE__ */ (() => ({
  ...ORIGINE,
  id: "B",
  nom: "B — Détaillé",
  materiau: "standard",
  ambiance: (nom, pal, look) => {
    const a = ambianceDOrigine(pal, look);
    return { ...a, silhouettes: { ...a.silhouettes, forme: HORIZONS[nom] } };
  },
  route: routeB,
  atlas: atlasB,
  portiqueDepart: portiqueDepartB,
  arrivee: arriveeB,
  porte: porteB,
  plaque(c, x, b) {
    plaqueB(c, b, x.pal.boost, 0xfff7c0, 3);
  },
  turbo(c, _x, b) {
    plaqueB(c, b, 0xd0202e, 0xffd23f, 3);
  },
  coupure(c, x, b) {
    ORIGINE.coupure(c, x, b);
    // Deux panneaux d'alerte triangulaires, un de chaque côté.
    const q = CELL / 2 - CUT_HALF_LENGTH - 6;
    for (const s of [-1, 1]) {
      const r = repereBloc(b, Math.max(1, q), s * (blockHalfWidth(b, q) + 1.2));
      tube(c.solide, pt(r, 0, 0, 0), pt(r, 0, 2.2, 0), 0.05, 4, METAL);
      c.lumineux.tri(pt(r, -0.8, 2.0, -0.06), pt(r, 0.8, 2.0, -0.06), pt(r, 0, 3.4, -0.06), 0xffd23f);
      c.lumineux.tri(pt(r, -0.15, 2.3, -0.07), pt(r, 0.15, 2.3, -0.07), pt(r, 0, 3.0, -0.07), 0x16181f);
    }
  },
  panneau: panneauB,
  rythme: rythmeB,
  decor: decorB,
}))();
