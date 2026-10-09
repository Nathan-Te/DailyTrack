// Accessoires de piste (lot 23) : panneaux de direction, arche de départ et d'arrivée, portes de points de contrôle.
// Présentation seule. Les formes vont dans trois constructeurs : `solid` (éclairé, projette des ombres), `glow` (sans éclairage :
// plaques de panneaux, bandeaux lumineux, toujours lisibles) et `curtain` (voile translucide d'une porte).
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, SRGBColorSpace } from "three";
import { CELL, CUVE_LEFT, CUVE_RIGHT, SHOULDER_EDGE, blockHalfWidth, blockHeight, type Block } from "@cdj/sim";
import { Builder, mix, shade, world, type V3 } from "./meshKit";
import type { SignKind, SignSpec } from "./signage";

export interface Props {
  solid: Builder;
  glow: Builder;
  curtain: Builder;
  /** Bandeaux de texte (départ, arrivée) : un maillage par bandeau, créés à la volée. */
  banners: Mesh[];
  /** Vue aérienne (miniatures) : pas de bandeaux de texte (une texture de plus par arche pour rien). */
  aerial: boolean;
}

export function createProps(aerial = false): Props {
  return { solid: new Builder(), glow: new Builder(), curtain: new Builder(), banners: [], aerial };
}

/** Couleurs de la palette dont les accessoires ont besoin. */
export interface PropColors {
  checkpoint: number;
  finish: number;
  finishDark: number;
  wallA: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

// --- Panneaux ----------------------------------------------------------------------------------------------

interface SignStyle {
  plate: number;
  ink: number;
  border: number;
}

const SIGN_STYLES: Record<string, SignStyle> = {
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

type P2 = [number, number];

/** Pose d'un panneau : centre, et les trois axes du monde (vers la droite du conducteur, vers le haut, vers le conducteur). */
interface Plane {
  c: V3;
  right: V3;
  up: V3;
  toward: V3;
}

function pointOn(pl: Plane, u: number, v: number, depth: number): V3 {
  return [pl.c[0] + pl.right[0] * u + pl.up[0] * v + pl.toward[0] * depth, pl.c[1] + pl.right[1] * u + pl.up[1] * v + pl.toward[1] * depth, pl.c[2] + pl.right[2] * u + pl.up[2] * v + pl.toward[2] * depth];
}

function poly(g: Builder, pl: Plane, pts: P2[], depth: number, color: number) {
  // éventail depuis le premier point (les formes utilisées sont convexes ou découpées avant)
  for (let i = 1; i + 1 < pts.length; i++) g.tri(pointOn(pl, ...pts[0]!, depth), pointOn(pl, ...pts[i]!, depth), pointOn(pl, ...pts[i + 1]!, depth), color);
}

const rect = (u0: number, v0: number, u1: number, v1: number): P2[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

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

/** Plante un panneau : poteau au bord de la route, plaque tournée vers la voiture qui arrive. */
export function addSign(p: Props, host: Block, s: SignSpec) {
  const y = blockHeight(host, s.q);
  const pBase = CELL / 2 + s.side * s.offset;
  const base = world(host, pBase, s.q, y);
  const left = unit(sub(world(host, pBase + 1, s.q, y), base)); // vers les p croissants
  const fwd = unit(sub(world(host, pBase, s.q + 1, y), base));
  const pole = 2.6;
  const half = 1.25;
  const style = SIGN_STYLES[signStyleOf(s.kind, s.severity)]!;
  // Poteau (deux petits montants, le panneau est large) : boîtes alignées sur les axes, assez fines pour qu'on n'y voie rien d'oblique.
  p.solid.box(base[0] - 0.07, y, base[2] - 0.07, base[0] + 0.07, y + pole + half * 2, base[2] + 0.07, 0x4a4f5c);
  const center: V3 = [base[0], y + pole + half, base[2]];
  const pl: Plane = { c: center, right: [-left[0], 0, -left[2]], up: [0, 1, 0], toward: [-fwd[0], 0, -fwd[2]] };
  poly(p.glow, pl, rect(-half - 0.1, -half - 0.1, half + 0.1, half + 0.1), -0.03, style.border); // liseré, légèrement en retrait
  poly(p.glow, pl, rect(-half + 0.06, -half + 0.06, half - 0.06, half - 0.06), -0.015, style.plate);
  drawGlyph(p.glow, pl, s.kind, s.severity, s.cuve, 0.02, style.ink);
  // Dos de la plaque : gris, pour qu'elle ne soit pas vue « de l'autre côté » comme un fantôme jaune.
  poly(p.solid, pl, rect(-half - 0.1, -half - 0.1, half + 0.1, half + 0.1), -0.06, 0x5a606e);
}

// --- Bandeaux de texte --------------------------------------------------------------------------------------

function bannerTexture(text: string, colors: { bg: string; fg: string; checker?: [string, string] }): CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  if (colors.checker) {
    const n = 16;
    const cs = 16;
    for (let i = 0; i < n * 2; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? colors.checker[0] : colors.checker[1];
        ctx.fillRect(i * cs, j * cs, cs, cs);
        ctx.fillRect(i * cs, h - (j + 1) * cs, cs, cs);
      }
    }
  }
  ctx.fillStyle = colors.fg;
  ctx.font = "800 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Un quadrilatère texturé : coins bas-gauche, bas-droite, haut-droite, haut-gauche (du point de vue de qui le lit). `flip` : texte à l'endroit pour l'autre côté. */
function bannerMesh(tex: CanvasTexture, bl: V3, br: V3, tr: V3, tl: V3): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute([...bl, ...br, ...tr, ...tl], 3));
  geo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ map: tex, side: DoubleSide }));
  mesh.userData.banner = true;
  return mesh;
}

// --- Arches et portes ---------------------------------------------------------------------------------------

/** Demi-écartement des poteaux d'une arche ou d'une porte : le bord de la route, ou de la bande avec des bas-côtés. */
function postSpan(b: Block, q: number): number {
  return b.shoulder ? SHOULDER_EDGE - 0.6 : blockHalfWidth(b, q) + 1.2;
}

/** Arche du départ : deux poteaux, une poutre rouge et blanche portant « DÉPART ». */
export function addStartArch(p: Props, pal: PropColors, b: Block, q = 26) {
  buildArch(p, pal, b, q, "DÉPART", { bg: "#c8202f", fg: "#ffffff" }, pal.wallA, 0xf4f4f4, 9, false);
}

/** Arche d'arrivée : poutre à damier portant « ARRIVÉE », plus haute que les portes de contrôle. */
export function addFinishArch(p: Props, pal: PropColors, b: Block, q = CELL / 2) {
  buildArch(p, pal, b, q, "ARRIVÉE", { bg: "#f4f4f4", fg: "#14161c", checker: ["#14161c", "#f4f4f4"] }, pal.finishDark, pal.finish, 9, true);
}

function buildArch(p: Props, pal: PropColors, b: Block, q: number, text: string, tex: { bg: string; fg: string; checker?: [string, string] }, postA: number, postB: number, h: number, finish: boolean) {
  const y = blockHeight(b, q);
  const span = postSpan(b, q);
  const beam = 2.4;
  for (const side of [-1, 1]) {
    const c = world(b, CELL / 2 + side * span, q, y);
    // Poteaux rayés, plus épais en bas (empattement) : on les repère de loin.
    const seg = 1.5;
    for (let k = 0, yy = y; yy < y + h; k++, yy += seg) {
      const top = Math.min(y + h, yy + seg);
      p.solid.box(c[0] - 0.55, yy, c[2] - 0.55, c[0] + 0.55, top, c[2] + 0.55, k % 2 === 0 ? postA : postB);
    }
    p.solid.box(c[0] - 0.9, y, c[2] - 0.9, c[0] + 0.9, y + 0.5, c[2] + 0.9, shade(postA, 0.8));
    p.glow.halo(c[0], y + h + 0.3, c[2], finish ? 0xffffff : 0xff6a5a, 5);
  }
  const l = world(b, CELL / 2 + span, q, y + h);
  const r = world(b, CELL / 2 - span, q, y + h);
  p.solid.box(Math.min(l[0], r[0]) - 0.6, y + h - 0.4, Math.min(l[2], r[2]) - 0.6, Math.max(l[0], r[0]) + 0.6, y + h + beam, Math.max(l[2], r[2]) + 0.6, shade(postA, 0.7));
  // Bandeau de texte sur les deux faces de la poutre (l'avant lit « DÉPART », l'arrière aussi).
  const t = p.aerial ? null : bannerTexture(text, tex);
  const fwd = unit(sub(world(b, CELL / 2, q + 1, y), world(b, CELL / 2, q, y)));
  const off = 0.75;
  const f = (pt: V3, k: number): V3 => [pt[0] + fwd[0] * k, pt[1], pt[2] + fwd[2] * k];
  const lo = y + h - 0.1;
  const hi = y + h + beam - 0.2;
  const L = (yy: number): V3 => [l[0], yy, l[2]];
  const R = (yy: number): V3 => [r[0], yy, r[2]];
  // Face avant (vue par qui arrive) : gauche du conducteur = côté p croissant.
  if (t) {
    p.banners.push(bannerMesh(t, f(L(lo), -off), f(R(lo), -off), f(R(hi), -off), f(L(hi), -off)));
    p.banners.push(bannerMesh(t, f(R(lo), off), f(L(lo), off), f(L(hi), off), f(R(hi), off)));
  }
  // Damier au sol (arrivée) ou trait blanc (départ), sur toute la largeur.
  const hw = blockHalfWidth(b, q);
  if (finish) {
    const cols = Math.round(hw * 2);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        const col = (i + j) % 2 === 0 ? pal.finish : pal.finishDark;
        const p0 = CELL / 2 - hw + i;
        const q0 = q - 1 + j;
        p.solid.quad(world(b, p0, q0, y + 0.04), world(b, p0 + 1, q0, y + 0.04), world(b, p0 + 1, q0 + 1, y + 0.04), world(b, p0, q0 + 1, y + 0.04), col);
      }
    }
  } else {
    p.solid.quad(world(b, CELL / 2 - hw, q - 0.3, y + 0.04), world(b, CELL / 2 + hw, q - 0.3, y + 0.04), world(b, CELL / 2 + hw, q + 0.3, y + 0.04), world(b, CELL / 2 - hw, q + 0.3, y + 0.04), 0xf4f4f4);
  }
}

/** Porte d'un point de contrôle : poteaux à bandes, poutre lumineuse, voile translucide sous la poutre, halo aux deux coins. */
export function addCheckpointGate(p: Props, pal: PropColors, b: Block) {
  const q = CELL / 2;
  const y = blockHeight(b, q);
  const span = postSpan(b, q);
  const h = 7.5;
  const color = pal.checkpoint;
  for (const side of [-1, 1]) {
    const c = world(b, CELL / 2 + side * span, q, y);
    const seg = 1.25;
    for (let k = 0, yy = y; yy < y + h; k++, yy += seg) p.solid.box(c[0] - 0.5, yy, c[2] - 0.5, c[0] + 0.5, Math.min(y + h, yy + seg), c[2] + 0.5, k % 2 === 0 ? color : 0xf4f4f4);
    p.glow.halo(c[0], y + h, c[2], color, 7);
  }
  const l = world(b, CELL / 2 + span, q, y + h);
  const r = world(b, CELL / 2 - span, q, y + h);
  const x0 = Math.min(l[0], r[0]);
  const x1 = Math.max(l[0], r[0]);
  const z0 = Math.min(l[2], r[2]);
  const z1 = Math.max(l[2], r[2]);
  p.solid.box(x0 - 0.5, y + h - 0.9, z0 - 0.5, x1 + 0.5, y + h + 0.3, z1 + 0.5, shade(color, 0.55));
  // Bande lumineuse sur la poutre (sans éclairage : elle s'allume la nuit) et voile translucide qui pend dessous.
  p.glow.box(x0 - 0.52, y + h - 0.55, z0 - 0.52, x1 + 0.52, y + h - 0.2, z1 + 0.52, mix(color, 0xffffff, 0.35));
  const top = y + h - 0.9;
  const drop = 2.6;
  p.curtain.quad(world(b, CELL / 2 + span, q, top), world(b, CELL / 2 - span, q, top), world(b, CELL / 2 - span, q, top - drop), world(b, CELL / 2 + span, q, top - drop), color);
  // Bande au sol, plus large et plus claire qu'avant.
  const hw = blockHalfWidth(b, q);
  p.glow.quad(world(b, CELL / 2 - hw, q - 0.5, y + 0.05), world(b, CELL / 2 + hw, q - 0.5, y + 0.05), world(b, CELL / 2 + hw, q + 0.5, y + 0.05), world(b, CELL / 2 - hw, q + 0.5, y + 0.05), mix(color, 0xffffff, 0.25));
}
