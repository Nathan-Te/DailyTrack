// Lot 38 — direction A, « Net et graphique » : des silhouettes franches et peu de pièces, des aplats de couleur, des bandes et des marquages forts,
// une lumière en trois tons nets (matériau « toon ») et un ciel en aplats. C'est la charte « Cartouches » de l'interface (ombres nettes, ni flou ni
// dégradé) traduite en 3D : le portique de départ est une cartouche (panneau crème bordé d'encre, ombre nette décalée, livrée à 115°).
import { CELL, CUT_HALF_LENGTH, SHOULDER_EDGE, blockHalfWidth, blockPadHalfWidth, isCurve, type Block, type PaletteName } from "@cdj/sim";
import { Builder, mix, shade, type V3 } from "../meshKit";
import { drawGlyph, signStyleOf } from "../trackProps";
import { placesDeDecor } from "./composer";
import { boite, face, livree, pt, repereBloc, repereSol, sol, type Repere } from "./outils";
import { MARQUE, bandeau, chevronSol, damierSol, textureBandeau } from "./pieces";
import { STYLE_ORIGINE, across, onBlock, rowWidth, tiretsCentre, type StyleRoute } from "./route";
import { ORIGINE } from "./origine";
import { HORIZONS, type Ambiance, type Calques, type Contexte, type Direction, type PlaceDecor } from "./types";

/** Ce que A change à chaque thème : couleurs (route, rebords, vibreurs, sol, ciel), lumière, brume. Les palettes du document de direction. */
export interface ThemeA {
  route: [number, number];
  rebord: [number, number];
  vibreur: [number, number];
  /** Couleur des structures du thème (tribunes, mâts) et son accent. */
  structure: number;
  accent: number;
  ciel: [zenith: number, horizon: number];
  sol: [string, string];
  soleil: [couleur: number, intensite: number];
  hemi: [ciel: number, sol: number, intensite: number];
  hauteur: number;
  brume: [near: number, far: number];
  exposition: number;
  silhouettes: [corps: number, sommet: number];
  nuit?: boolean;
}

export const THEMES_A: Record<PaletteName, ThemeA> = {
  stade: { route: [0x47464c, 0x434248], rebord: [0x2e7dff, 0xf4f4f4], vibreur: [0xe8283a, 0xf4f4f4], structure: 0xe9edf2, accent: 0xe8283a, ciel: [0x1f6fd6, 0x9fd3ff], sol: ["#4fae3c", "#47a335"], soleil: [0xfff4dc, 2.7], hemi: [0xcfe6ff, 0x4f9a3a, 0.75], hauteur: 0.9, brume: [170, 500], exposition: 1.0, silhouettes: [0x5e8fc4, 0xe6f2fb] },
  desert: { route: [0x67655f, 0x615f59], rebord: [0x1e1b19, 0xf4f1e6], vibreur: [0xe8552d, 0xf4f1e6], structure: 0xf4f1e6, accent: 0xffc21a, ciel: [0x2f9ad0, 0xf6c98e], sol: ["#dba65f", "#cf9a52"], soleil: [0xffe9c2, 2.6], hemi: [0xffe4bd, 0xc8904c, 0.6], hauteur: 0.55, brume: [120, 380], exposition: 1.0, silhouettes: [0xc7794a, 0xeaa36c] },
  neige: { route: [0x5b6676, 0x566171], rebord: [0x2f6fd0, 0xffffff], vibreur: [0xe8283a, 0xffffff], structure: 0xffffff, accent: 0xe8283a, ciel: [0xb7cde3, 0xeef3f7], sol: ["#f6f9fc", "#e6eef5"], soleil: [0xffffff, 1.7], hemi: [0xf0f6ff, 0xdfe8f2, 1.05], hauteur: 0.6, brume: [70, 290], exposition: 1.0, silhouettes: [0xa9bdd3, 0xffffff] },
  nuit: { route: [0x1d2030, 0x1a1d2c], rebord: [0x1e1b19, 0xf2b544], vibreur: [0xf2b544, 0x1e1b19], structure: 0x2a2f45, accent: 0xf2b544, ciel: [0x02030c, 0x101a48], sol: ["#0b0f22", "#090c1c"], soleil: [0x9fb4ff, 0.7], hemi: [0x2a3570, 0x07091a, 0.4], hauteur: 0.5, brume: [60, 250], exposition: 1.05, silhouettes: [0x0f1636, 0x1e2a5a], nuit: true },
  campagne: { route: [0x6d6e72, 0x67686c], rebord: [0x7a5230, 0xd9b27a], vibreur: [0xd9402a, 0xf6f6f0], structure: 0xc2401f, accent: 0xd9402a, ciel: [0x4f7fcf, 0xf7c27a], sol: ["#7fb84a", "#76ad42"], soleil: [0xffc27a, 2.5], hemi: [0xffe0b0, 0x5f8a34, 0.6], hauteur: 0.2, brume: [110, 360], exposition: 1.0, silhouettes: [0x5f9a63, 0x8cc08a] },
  canyon: { route: [0x6a605c, 0x645a56], rebord: [0xa8472a, 0xe0a466], vibreur: [0x1e1b19, 0xf6e6c8], structure: 0xe0a466, accent: 0x2aa8a0, ciel: [0x5a4a9a, 0xf6a35f], sol: ["#d79a52", "#cc8f48"], soleil: [0xff9d52, 2.7], hemi: [0xffcf9e, 0xa8552e, 0.65], hauteur: 0.2, brume: [90, 320], exposition: 1.0, silhouettes: [0xa8452a, 0xe8925a] },
  alpin: { route: [0x55595f, 0x51555b], rebord: [0xe8283a, 0xf6f6f6], vibreur: [0xe8283a, 0xf6f6f6], structure: 0x8a5a36, accent: 0xe8283a, ciel: [0x1f62c4, 0xc9e4f7], sol: ["#86b56f", "#7dab66"], soleil: [0xfff8ea, 2.7], hemi: [0xdcecff, 0x6f9a5a, 0.65], hauteur: 0.55, brume: [150, 460], exposition: 1.0, silhouettes: [0x6c7d93, 0xffffff] },
  ville: { route: [0x3c3e44, 0x393b41], rebord: [0xc8cbd1, 0xa9adb4], vibreur: [0xf2b544, 0x1e1b19], structure: 0xb9bdc4, accent: 0xf2b544, ciel: [0x6f9fd2, 0xd2dde8], sol: ["#9a9da4", "#91949b"], soleil: [0xfff3dc, 2.3], hemi: [0xe8eef8, 0x8c9096, 0.65], hauteur: 0.7, brume: [120, 380], exposition: 1.0, silhouettes: [0x8a95a6, 0xb6c1cf] },
  neon: { route: [0x2d2250, 0x261c45], rebord: [0xff2bd6, 0x00f0ff], vibreur: [0xff2bd6, 0x00f0ff], structure: 0x1a0b36, accent: 0x00f0ff, ciel: [0x06000f, 0x2a0b55], sol: ["#2a0a4a", "#210840"], soleil: [0xff9af0, 0.9], hemi: [0x6a3aa0, 0x14092b, 0.45], hauteur: 0.5, brume: [70, 280], exposition: 1.05, silhouettes: [0x2a0b55, 0x7a2bff], nuit: true },
};

const th = (x: Contexte) => THEMES_A[x.palette];

// --- Route : rebords en blocs à bandes longues, ombre nette au pied, vibreurs en dents, lignes épaisses ---------------------------------

/** Longueur d'une bande de rebord (m) : deux fois celle de l'existant, plus lisible à 200 km/h. */
const BANDE = 8;

function morceaux(t: { a: V3; b: V3; s: number; longueur: number }, pas: number, f: (u0: number, u1: number, n: number) => void) {
  // Découpe le tronçon aux frontières des bandes (alignées sur la distance parcourue).
  let u = 0;
  while (u < 1 - 1e-6) {
    const s = t.s + u * t.longueur;
    const n = Math.floor(s / pas + 1e-6);
    const fin = Math.min(1, ((n + 1) * pas - t.s) / t.longueur);
    f(u, fin, n);
    u = fin;
  }
}

export function routeA(nom: PaletteName): StyleRoute {
  const theme = THEMES_A[nom];
  return {
  ...STYLE_ORIGINE,
  rebord(g, t, pal) {
    const e = 0.5; // épaisseur du bloc
    const ox = t.dehors[0];
    const oz = t.dehors[1];
    const at = (u: number, up: number, out: number): V3 => [t.a[0] + (t.b[0] - t.a[0]) * u + ox * out, t.a[1] + (t.b[1] - t.a[1]) * u + up, t.a[2] + (t.b[2] - t.a[2]) * u + oz * out];
    const h = t.hauteur;
    morceaux(t, BANDE, (u0, u1, n) => {
      const c = t.couleurs[n % 2]!;
      g.quad(at(u0, 0, 0), at(u1, 0, 0), at(u1, h, 0), at(u0, h, 0), c); // face intérieure
      g.quad(at(u0, h, 0), at(u1, h, 0), at(u1, h, e), at(u0, h, e), shade(c, 1.08)); // dessus
      g.quad(at(u0, h, e), at(u1, h, e), at(u1, -0.6, e), at(u0, -0.6, e), shade(c, 0.8)); // face extérieure
    });
    // Liseré d'encre sur l'arête (le trait de la charte) et ombre nette au pied, sur la route.
    g.quad(at(0, h - 0.14, -0.01), at(1, h - 0.14, -0.01), at(1, h, -0.01), at(0, h, -0.01), MARQUE.encre);
    if (!t.bande) g.quad(at(0, 0.025, 0), at(1, 0.025, 0), at(1, 0.025, -0.45), at(0, 0.025, -0.45), shade(pal.road[0], 0.62));
  },
  bordureVide(g, lum, t, pal, milieu) {
    // Bord du vide : un liseré crème épais, puis des blocs bas encre et accent (une bordure qu'on lit, pas un mur) ; néon à la nuit.
    const len = Math.hypot(milieu[0] - t.a[0], milieu[2] - t.a[2]) || 1;
    const ix = (milieu[0] - t.a[0]) / len;
    const iz = (milieu[2] - t.a[2]) / len;
    const at = (u: number, inward: number, up: number): V3 => [t.a[0] + (t.b[0] - t.a[0]) * u + ix * inward, t.a[1] + (t.b[1] - t.a[1]) * u + up, t.a[2] + (t.b[2] - t.a[2]) * u + iz * inward];
    const nuit = pal.neon !== undefined;
    g.quad(at(0, 0.6, 0.05), at(1, 0.6, 0.05), at(1, 1.0, 0.05), at(0, 1.0, 0.05), nuit ? MARQUE.asphalte : MARQUE.creme);
    morceaux(t, 4, (u0, u1, n) => {
      const c = n % 2 === 0 ? MARQUE.encre : pal.neon ? pal.neon[t.cote === "left" ? 0 : 1] : MARQUE.livree;
      const cible = pal.neon && n % 2 === 1 ? lum : g;
      cible.quad(at(u0, 0, 0.18), at(u1, 0, 0.18), at(u1, 0.55, 0.18), at(u0, 0.55, 0.18), c);
      cible.quad(at(u0, 0.55, 0.18), at(u1, 0.55, 0.18), at(u1, 0.55, 0), at(u0, 0.55, 0), c);
      if (pal.neon && n % 2 === 1) {
        const m = at((u0 + u1) / 2, 0.3, 0.3);
        lum.halo(m[0], m[1], m[2], c, 3);
      }
    });
  },
  vibreurs(g, rows) {
    // Dents de scie relevées : 3 m par couleur, une lèvre d'encre côté route (on les voit de loin et de face).
    let s = 0;
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i]!;
      const b = rows[i + 1]!;
      const ma = across(a, 0.5, 0);
      const mb = across(b, 0.5, 0);
      const c = theme.vibreur[Math.floor(s / 3) % 2]!;
      s += Math.hypot(ma[0] - mb[0], ma[2] - mb[2]);
      const fa = 1.8 / rowWidth(a);
      const fb = 1.8 / rowWidth(b);
      g.quad(across(a, 0, 0.12), across(a, fa, 0.12), across(b, fb, 0.12), across(b, 0, 0.12), c);
      g.quad(across(a, 1 - fa, 0.12), across(a, 1, 0.12), across(b, 1, 0.12), across(b, 1 - fb, 0.12), c);
      g.quad(across(a, fa, 0), across(b, fb, 0), across(b, fb, 0.12), across(a, fa, 0.12), MARQUE.encre);
      g.quad(across(a, 1 - fa, 0), across(b, 1 - fb, 0), across(b, 1 - fb, 0.12), across(a, 1 - fa, 0.12), MARQUE.encre);
    }
  },
  rives(g, a, b, _color, pal) {
    // Lignes de rive épaisses (0,35 m), pas de sillons : la route est un aplat.
    const wa = rowWidth(a);
    const wb = rowWidth(b);
    for (const [d0, d1] of [[0.5, 0.85], [-0.85, -0.5]] as const) {
      const fa = (d: number) => (d >= 0 ? d / wa : 1 + d / wa);
      const fb = (d: number) => (d >= 0 ? d / wb : 1 + d / wb);
      g.quad(across(a, fa(d0), 0.03), across(a, fa(d1), 0.03), across(b, fb(d1), 0.03), across(b, fb(d0), 0.03), pal.dash);
    }
  },
  tirets(g, b, pal) {
    tiretsCentre(g, b, pal.dash, 0.4, 5);
  },
  cuve(pal) {
    return [pal.wallA, pal.wallB];
  },
  };
}

// --- Éléments ---------------------------------------------------------------------------------------------------------------------

/** Demi-écartement des piliers d'un portique (comme `postSpan`) : le bord de la route, ou de la bande. */
function ecart(b: Block, q: number): number {
  return b.shoulder ? SHOULDER_EDGE - 0.6 : blockHalfWidth(b, q) + 1.4;
}

/**
 * Un portique « cartouche » : deux piliers plats, une poutre-panneau bordée d'encre avec son ombre nette décalée (comme l'ombre `4px 4px 0` de la
 * charte), un bandeau de texte sur les deux faces, la livrée en haut. Rend le repère et la hauteur de la poutre.
 */
function portiqueCartouche(c: Calques, b: Block, q: number, texte: string, opts: { pilier: number; bande: [number, number]; fond: number; encre: number; damier?: boolean; livree?: boolean }) {
  const r = repereBloc(b, q);
  const w = ecart(b, q);
  const h = 8.6;
  const haut = 3.0;
  // Socles et piliers (plats : 1,4 m en travers, 0,9 m le long), bande verticale de couleur sur la face intérieure.
  for (const s of [-1, 1]) {
    const g0 = s * w - 0.7;
    const g1 = s * w + 0.7;
    boite(c.solide, r, s * w - 1.1, s * w + 1.1, -0.1, 0.7, -0.9, 0.9, MARQUE.encre);
    boite(c.solide, r, g0, g1, 0.7, h + haut, -0.45, 0.45, opts.pilier);
    const inner = s > 0 ? g0 - 0.01 : g1 + 0.01;
    c.solide.quad(pt(r, inner, 0.7, -0.46), pt(r, inner, 0.7, 0.46), pt(r, inner, h, 0.46), pt(r, inner, h, -0.46), opts.bande[0]);
    livree(c.solide, r, g0, g1, h - 3.2, h - 0.6, -0.46, 0.35, opts.bande[0], opts.bande[1]);
  }
  // Poutre : le panneau, et derrière lui son ombre nette (encre), décalée vers le bas et vers la droite du conducteur, comme l'ombre `4px 4px 0`
  // des cartouches de l'interface.
  boite(c.solide, r, -w - 1.05, w + 0.35, h - 0.4, h + haut - 0.4, 0.35, 0.8, MARQUE.encre);
  boite(c.solide, r, -w - 0.7, w + 0.7, h, h + haut, -0.6, 0.35, opts.fond, MARQUE.encre);
  if (opts.livree) livree(c.solide, r, -w - 0.7, w + 0.7, h + haut - 0.55, h + haut, -0.61, 0.5, MARQUE.livree, MARQUE.asphalte);
  if (!c.aerien) {
    const tex = textureBandeau(texte, { fond: opts.fond, encre: opts.encre, ...(opts.damier ? { damier: [MARQUE.encre, MARQUE.creme] as [number, number] } : {}), cadre: [10, MARQUE.encre] });
    const g = w + 0.4;
    const h0 = h + 0.2;
    const h1 = h + haut - (opts.livree ? 0.6 : 0.2);
    c.bandeaux.push(bandeau(tex, pt(r, g, h0, -0.62), pt(r, -g, h0, -0.62), pt(r, -g, h1, -0.62), pt(r, g, h1, -0.62)));
    c.bandeaux.push(bandeau(tex, pt(r, -g, h0 - 0.4, 0.82), pt(r, g, h0 - 0.4, 0.82), pt(r, g, h1 - 0.4, 0.82), pt(r, -g, h1 - 0.4, 0.82)));
  }
  return { r, w, h };
}

export function portiqueDepart(c: Calques, x: Contexte, b: Block, q: number) {
  const { r } = portiqueCartouche(c, b, q, "DÉPART", { pilier: MARQUE.asphalte, bande: [MARQUE.livree, MARQUE.asphalte], fond: MARQUE.creme, encre: MARQUE.asphalte, livree: true });
  // Ligne de départ : livrée et crème, puis les deux cases de la grille (crochets) autour de la place de départ (q = 8).
  const hw = blockHalfWidth(b, q);
  sol(c.route, r, -hw, hw, -0.5, 0.5, 0.05, MARQUE.creme);
  sol(c.route, r, -hw, hw, 0.5, 1.3, 0.05, MARQUE.livree);
  const r8 = repereBloc(b, 8);
  for (const s of [-1, 1]) {
    sol(c.route, r8, s * 1.4 - 0.2, s * 1.4 + 0.2, -2.4, 3.2, 0.05, MARQUE.creme);
  }
  sol(c.route, r8, -1.6, 1.6, 3.0, 3.4, 0.05, MARQUE.creme);
  void x;
}

export function arrivee(c: Calques, x: Contexte, b: Block, q: number) {
  const { r } = portiqueCartouche(c, b, q, "ARRIVÉE", { pilier: MARQUE.encre, bande: [MARQUE.creme, MARQUE.encre], fond: MARQUE.creme, encre: MARQUE.encre, damier: true });
  const hw = blockHalfWidth(b, q);
  damierSol(c.route, r, hw, 2, 2, 0.05, MARQUE.encre, MARQUE.creme);
  void x;
}

export function porte(c: Calques, x: Contexte, b: Block) {
  const q = CELL / 2;
  const r = repereBloc(b, q);
  const w = ecart(b, q);
  const h = 7;
  const col = x.pal.checkpoint;
  for (const s of [-1, 1]) {
    boite(c.solide, r, s * w - 0.45, s * w + 0.45, 0, h, -0.3, 0.3, col);
    livree(c.solide, r, s * w - 0.45, s * w + 0.45, 0.4, h - 0.4, -0.31, 0.35, col, MARQUE.creme);
    c.lumineux.halo(...pt(r, s * w, h + 0.4, 0), col, 6);
  }
  boite(c.solide, r, -w - 0.45, w + 0.45, h, h + 0.9, -0.3, 0.3, shade(col, 0.6), MARQUE.encre);
  // Bande lumineuse (sans éclairage) sur la poutre, des deux côtés.
  for (const a of [-0.32, 0.32]) face(c.lumineux, r, -w, w, h + 0.25, h + 0.65, a, mix(col, 0xffffff, 0.3));
  // Au sol : une large bande de la couleur du contrôle et trois chevrons crème vers l'avant.
  const hw = b.shoulder ? SHOULDER_EDGE : blockHalfWidth(b, q);
  sol(c.lumineux, r, -hw, hw, -0.9, 0.9, 0.05, col);
  for (const a of [-5, -2.5]) chevronSol(c.route, r, a, 3.2, 0.9, 0.05, MARQUE.creme);
}

/** Une plaque au sol bordée d'encre, et ses chevrons. */
export function plaqueA(c: Calques, b: Block, fond: number, chevron: number, bord: number, n: number) {
  const r = repereBloc(b, CELL / 2);
  const ph = blockPadHalfWidth(b);
  const hl = 4;
  sol(c.route, r, -ph - 0.35, ph + 0.35, -hl - 0.35, hl + 0.35, 0.035, bord);
  sol(c.route, r, -ph, ph, -hl, hl, 0.045, fond);
  for (let i = 0; i < n; i++) chevronSol(c.route, r, -hl + 2.4 + (i * (2 * hl - 2.8)) / Math.max(1, n - 1), ph - 0.6, 0.9, 0.06, chevron);
}

export function panneau(c: Calques, x: Contexte, hote: Block, s: import("../signage").SignSpec) {
  const r0 = repereBloc(hote, s.q, s.side * s.offset);
  // Un panneau large (4,2 × 1,6 m) sur deux pieds, tourné vers qui arrive ; son ombre nette (encre) derrière, décalée.
  const style = signStyleOf(s.kind, s.severity);
  const plaque = style === "red" ? 0xe8283a : style === "orange" ? 0xff8a1a : style === "blue" ? 0x1f6fd0 : 0xffc61a;
  const encre = style === "red" || style === "blue" ? MARQUE.papier : MARQUE.encre;
  const large = s.kind === "left" || s.kind === "right" ? 2.1 : 1.3;
  const h0 = 1.6;
  const h1 = h0 + 1.7;
  for (const g of [-large * 0.6, large * 0.6]) boite(c.solide, r0, g - 0.08, g + 0.08, 0, h0 + 0.2, 0.15, 0.35, MARQUE.encre);
  boite(c.solide, r0, -large + 0.25, large + 0.25, h0 - 0.25, h1 - 0.25, 0.12, 0.3, MARQUE.encre);
  boite(c.solide, r0, -large, large, h0, h1, -0.12, 0.1, encre === MARQUE.encre ? MARQUE.encre : MARQUE.papier);
  face(c.lumineux, r0, -large + 0.12, large - 0.12, h0 + 0.12, h1 - 0.12, -0.13, plaque);
  // Glyphe : chevrons, rampe ou cuve, comme l'existant (même lecture), dans le calque sans éclairage.
  const centre = pt(r0, 0, (h0 + h1) / 2, -0.13);
  const pl = { c: centre, right: [-r0.l[0], 0, -r0.l[2]] as V3, up: [0, 1, 0] as V3, toward: [-r0.f[0], 0, -r0.f[2]] as V3 };
  const sc = (h1 - h0 - 0.3) / 1.8;
  const scaled = { ...pl, right: pl.right.map((v) => v * sc) as V3, up: pl.up.map((v) => v * sc) as V3 };
  if (s.kind === "left" || s.kind === "right") {
    // Chevrons étalés sur la largeur du panneau.
    const dir = s.kind === "right" ? 1 : -1;
    for (let i = 0; i < s.severity; i++) {
      const u = (i - (s.severity - 1) / 2) * 1.1 * dir;
      drawGlyph(c.lumineux, { ...scaled, c: [centre[0] + pl.right[0] * u, centre[1], centre[2] + pl.right[2] * u] }, s.kind, 1, 0, 0.01, encre);
    }
  } else drawGlyph(c.lumineux, scaled, s.kind, s.severity, s.cuve, 0.01, encre);
}

export function rythme(c: Calques, x: Contexte, b: Block, rapide: boolean) {
  if (b.kind === "jump" || b.kind === "gap" || b.kind === "kick") return;
  const t = th(x);
  const rail = b.open ? 0 : (x.pal.wallHeight ?? 1.4);
  const hw = (u: number) => (isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, u * CELL));
  // Repères plats tous les 16 m (8 m dans une portion rapide), encre et crème, sur le dessus du rebord.
  for (const u of rapide ? [0.125, 0.375, 0.625, 0.875] : [0.25, 0.75]) {
    for (const side of [-1, 1]) {
      const p = onBlock(b, side * (hw(u) + 0.25), u, rail);
      const top = rapide ? 2.6 : 1.8;
      const coul = rapide ? MARQUE.livree : MARQUE.creme;
      c.solide.box(p[0] - 0.12, p[1], p[2] - 0.12, p[0] + 0.12, p[1] + top, p[2] + 0.12, MARQUE.encre);
      c.solide.box(p[0] - 0.14, p[1] + top - 0.7, p[2] - 0.14, p[0] + 0.14, p[1] + top, p[2] + 0.14, coul);
    }
  }
  if (!rapide || b.index % 2 !== 0 || isCurve(b.kind)) return;
  // Portion rapide : une arche plate, la livrée sur la poutre.
  const r = repereBloc(b, CELL / 2);
  const w = blockHalfWidth(b, CELL / 2) + 0.6;
  for (const s of [-1, 1]) boite(c.solide, r, s * w - 0.3, s * w + 0.3, rail, rail + 7, -0.3, 0.3, MARQUE.asphalte);
  boite(c.solide, r, -w - 0.3, w + 0.3, rail + 6.2, rail + 7.4, -0.3, 0.3, MARQUE.asphalte);
  livree(c.solide, r, -w, w, rail + 6.3, rail + 7.3, -0.31, 0.6, MARQUE.livree, MARQUE.asphalte);
  void t;
}

// --- Décor : peu de pièces, des silhouettes franches -------------------------------------------------------------------------------

/** Un pic plat à quatre faces (sapin, aiguille de roche) : `etages` cônes empilés. */
function sapin(g: Builder, x: number, y: number, z: number, h: number, couleur: number, neige: number | null) {
  g.box(x - 0.25, y, z - 0.25, x + 0.25, y + h * 0.18, z + 0.25, 0x4a3426);
  for (let i = 0; i < 3; i++) {
    const r = (1 - i * 0.28) * h * 0.26;
    g.prism(x, y + h * (0.15 + i * 0.25), z, r, 0.02, h * 0.42, 4, couleur, neige ?? couleur, Math.PI / 4);
  }
}

function rocher(g: Builder, x: number, y: number, z: number, r: number, couleur: number, rnd: () => number) {
  g.prism(x, y, z, r, r * 0.55, r * 0.9, 5, couleur, shade(couleur, 1.15), rnd() * 3);
}

/** Une mesa à strates : trois aplats empilés, de plus en plus étroits. */
function mesa(g: Builder, x: number, y: number, z: number, w: number, h: number, c1: number, c2: number) {
  for (let i = 0; i < 3; i++) {
    const s = w * (1 - i * 0.18);
    g.box(x - s, y + (h * i) / 3, z - s * 0.8, x + s, y + (h * (i + 1)) / 3, z + s * 0.8, i % 2 === 0 ? c1 : c2);
  }
}

function cactus(g: Builder, x: number, y: number, z: number, h: number, couleur: number) {
  g.box(x - 0.35, y, z - 0.35, x + 0.35, y + h, z + 0.35, couleur);
  g.box(x + 0.35, y + h * 0.4, z - 0.25, x + 1.1, y + h * 0.4 + 0.5, z + 0.25, couleur);
  g.box(x + 0.7, y + h * 0.4, z - 0.25, x + 1.1, y + h * 0.75, z + 0.25, couleur);
  g.box(x - 1.0, y + h * 0.55, z - 0.25, x - 0.35, y + h * 0.55 + 0.5, z + 0.25, couleur);
  g.box(x - 1.0, y + h * 0.55, z - 0.25, x - 0.6, y + h * 0.85, z + 0.25, couleur);
}

/** Un immeuble plat : un volume, des bandes de fenêtres horizontales (deux faces visibles suffisent : elles tournent vers la route). */
function immeuble(g: Builder, lum: Builder, r: Repere, w: number, d: number, h: number, mur: number, fenetre: number, nuit: boolean) {
  boite(g, r, -w, w, 0, h, -d, d, mur, shade(mur, 0.9));
  boite(g, r, -w - 0.2, w + 0.2, h, h + 0.6, -d - 0.2, d + 0.2, shade(mur, 0.75));
  const cible = nuit ? lum : g;
  for (let y = 3; y < h - 1.5; y += 3.4) {
    face(cible, r, -w + 0.8, w - 0.8, y, y + 1.5, -d - 0.02, fenetre);
  }
}

function lampadaire(c: Calques, x: number, y: number, z: number, a: number, h: number, sodium: number) {
  const r = repereSol(x, y, z, a);
  boite(c.decor, r, -0.12, 0.12, 0, h, -0.12, 0.12, MARQUE.asphalte);
  boite(c.decor, r, -0.12, 0.12, h - 0.15, h, 0, 1.6, MARQUE.asphalte);
  boite(c.decorLumineux, r, -0.25, 0.25, h - 0.3, h - 0.15, 0.9, 1.6, sodium);
  // Flaque de lumière au sol : un aplat de la couleur de la lampe (A : la lumière se dessine, elle ne se calcule pas).
  const p = pt(r, 0, 0.06, 1.3);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2;
    const t1 = ((i + 1) / n) * Math.PI * 2;
    const R = h * 0.55;
    c.decorLumineux.tri(p, [p[0] + Math.cos(t1) * R, p[1], p[2] + Math.sin(t1) * R], [p[0] + Math.cos(t0) * R, p[1], p[2] + Math.sin(t0) * R], shade(sodium, 0.32));
  }
  c.decorLumineux.halo(...pt(r, 0, h - 0.3, 1.25), sodium, 6);
}

/** La tribune du départ (tous les thèmes) : un socle plein jusqu'au sol (rien en l'air), trois gradins, la foule en bandes de couleur, un toit plat. */
export function tribune(c: Calques, x: Contexte, b: Block) {
  const t = th(x);
  const side = 1;
  const hw = blockHalfWidth(b, CELL / 2);
  const r = repereBloc(b, 16, side * (hw + 4));
  const y0 = 0;
  const bas = x.floorY - b.y0;
  boite(c.decor, r, 0, 8, bas, y0 + 0.2, -11, 11, shade(t.structure, 0.8));
  const foule = [MARQUE.livree, MARQUE.moutarde, 0x2e7dff, MARQUE.creme, 0x2e9e5b];
  for (let i = 0; i < 3; i++) {
    const g0 = i * 2.3;
    boite(c.decor, r, g0, 8, y0, y0 + 1 + i * 1.2, -11, 11, t.structure);
    // La foule : une bande colorée par gradin (des aplats, pas des individus).
    face(c.decor, r, g0 + 0.2, g0 + 2.1, y0 + 1 + i * 1.2, y0 + 1.7 + i * 1.2, 0, foule[i % foule.length]!);
    boite(c.decor, r, g0 + 0.3, g0 + 2.0, y0 + 1 + i * 1.2, y0 + 1.6 + i * 1.2, -10.6, 10.6, foule[(i + 2) % foule.length]!);
  }
  for (const a of [-10.6, 10.6]) boite(c.decor, r, 7.4, 7.9, y0 + 1, y0 + 7.2, a - 0.25, a + 0.25, MARQUE.asphalte);
  boite(c.decor, r, -0.6, 8.2, y0 + 7.2, y0 + 7.7, -11.4, 11.4, t.accent);
}

type Recette = (c: Calques, x: Contexte, p: PlaceDecor, rnd: () => number) => void;

export const RECETTES: Record<PaletteName, Recette> = {
  stade(c, x, p, rnd) {
    const y = x.floorY;
    const a = Math.atan2(p.versRoute[0], p.versRoute[1]);
    const r = repereSol(p.x, y, p.z, a);
    if (p.anneau === 2 && rnd() < 0.5) {
      // Mât d'éclairage : un fût, un panneau de projecteurs (lumineux).
      boite(c.decor, r, -0.3, 0.3, 0, 22, -0.3, 0.3, MARQUE.creme);
      boite(c.decor, r, -2.2, 2.2, 20, 23, 0.3, 0.6, MARQUE.asphalte);
      face(c.decorLumineux, r, -2, 2, 20.3, 22.7, 0.61, 0xfffbe8);
    } else if (rnd() < 0.55) {
      // Panneau publicitaire tourné vers la route : un aplat de couleur et une bande blanche.
      const col = [MARQUE.livree, 0x2e7dff, MARQUE.moutarde, 0x2e9e5b][Math.floor(rnd() * 4)]!;
      boite(c.decor, r, -4, 4, 0, 2.4, -0.2, 0.2, col);
      face(c.decor, r, -3.4, 3.4, 0.9, 1.5, -0.21, MARQUE.creme);
    } else {
      boite(c.decor, r, -3, 3, 0, 1.4, -0.7, 0.7, mix(0x2f8a3a, 0x3fa646, rnd()));
    }
  },
  desert(c, x, p, rnd) {
    const y = x.floorY;
    if (p.anneau === 2 && rnd() < 0.6) mesa(c.decor, p.x, y, p.z, 5 + rnd() * 5, 8 + rnd() * 10, 0xc7794a, 0xe0a066);
    else if (rnd() < 0.6) cactus(c.decor, p.x, y, p.z, 3.5 + rnd() * 2.5, 0x3f8a3a);
    else rocher(c.decor, p.x, y, p.z, 1 + rnd() * 1.4, 0xb8754a, rnd);
  },
  neige(c, x, p, rnd) {
    const y = x.floorY;
    if (rnd() < 0.7) sapin(c.decor, p.x, y, p.z, 7 + rnd() * 5, 0x1f5a3c, 0xffffff);
    else c.decor.prism(p.x, y, p.z, 1.8 + rnd() * 1.5, 0.6, 1.6 + rnd() * 2, 5, 0xcfe4f4, 0xffffff, rnd() * 3);
  },
  nuit(c, x, p, rnd) {
    const y = x.floorY;
    if (p.anneau === 1 && rnd() < 0.65) lampadaire(c, p.x, y, p.z, Math.atan2(p.versRoute[0], p.versRoute[1]), 6, 0xffb347);
    else sapin(c.decor, p.x, y, p.z, 6 + rnd() * 4, 0x101a30, null);
  },
  campagne(c, x, p, rnd) {
    const y = x.floorY;
    const k = rnd();
    if (k < 0.55) {
      // Arbre « sucette » : un tronc et une couronne à huit faces, deux tons nets.
      const h = 4 + rnd() * 2;
      c.decor.box(p.x - 0.3, y, p.z - 0.3, p.x + 0.3, y + h * 0.5, p.z + 0.3, 0x6a4528);
      c.decor.prism(p.x, y + h * 0.4, p.z, 2.4, 2.4, h * 0.35, 8, 0x3f9a3a, 0x3f9a3a, rnd());
      c.decor.prism(p.x, y + h * 0.75, p.z, 2.4, 0.4, h * 0.4, 8, 0x58b44a, 0x58b44a, rnd());
    } else if (k < 0.85) {
      const R = 0.9 + rnd() * 0.4;
      c.decor.prism(p.x, y, p.z, R, R, R * 1.2, 8, 0xe2bd5c, 0xf0d27c);
    } else if (p.anneau === 2) {
      // Grange : un volume rouge et un toit à deux pans.
      const r = repereSol(p.x, y, p.z, Math.atan2(p.versRoute[0], p.versRoute[1]));
      boite(c.decor, r, -4, 4, 0, 4.5, -3, 3, 0xc2401f);
      c.decor.quad(pt(r, -4.3, 4.5, -3.3), pt(r, 4.3, 4.5, -3.3), pt(r, 4.3, 7, 0), pt(r, -4.3, 7, 0), MARQUE.asphalte);
      c.decor.quad(pt(r, 4.3, 4.5, 3.3), pt(r, -4.3, 4.5, 3.3), pt(r, -4.3, 7, 0), pt(r, 4.3, 7, 0), MARQUE.asphalte);
      c.decor.tri(pt(r, -4, 4.5, -3), pt(r, -4, 4.5, 3), pt(r, -4, 7, 0), 0xc2401f);
      c.decor.tri(pt(r, 4, 4.5, 3), pt(r, 4, 4.5, -3), pt(r, 4, 7, 0), 0xc2401f);
    }
  },
  canyon(c, x, p, rnd) {
    const y = x.floorY;
    if (p.anneau === 2 && rnd() < 0.7) mesa(c.decor, p.x, y, p.z, 6 + rnd() * 6, 12 + rnd() * 14, 0xa8452a, 0xd2733e);
    else if (rnd() < 0.5) c.decor.prism(p.x, y, p.z, 1.6, 0.8, 9 + rnd() * 6, 4, 0xb85a32, 0xe0925a, rnd() * 3);
    else cactus(c.decor, p.x, y, p.z, 3 + rnd() * 2, 0x4f8a3a);
  },
  alpin(c, x, p, rnd) {
    const y = x.floorY;
    if (rnd() < 0.65) sapin(c.decor, p.x, y, p.z, 8 + rnd() * 5, 0x1f5a3c, 0xffffff);
    else if (p.anneau === 2 && rnd() < 0.5) {
      const r = repereSol(p.x, y, p.z, Math.atan2(p.versRoute[0], p.versRoute[1]));
      boite(c.decor, r, -3, 3, 0, 3, -2.5, 2.5, 0x8a5a36);
      c.decor.quad(pt(r, -3.6, 3, -3), pt(r, 3.6, 3, -3), pt(r, 3.6, 5, 0), pt(r, -3.6, 5, 0), 0xffffff);
      c.decor.quad(pt(r, 3.6, 3, 3), pt(r, -3.6, 3, 3), pt(r, -3.6, 5, 0), pt(r, 3.6, 5, 0), 0xffffff);
    } else rocher(c.decor, p.x, y, p.z, 1.4 + rnd() * 2, 0x7d8896, rnd);
  },
  ville(c, x, p, rnd) {
    const y = x.floorY;
    const a = Math.atan2(p.versRoute[0], p.versRoute[1]);
    if (p.anneau === 2 || rnd() < 0.4) {
      const r = repereSol(p.x, y, p.z, a);
      immeuble(c.decor, c.decorLumineux, r, 4 + rnd() * 3, 4 + rnd() * 3, 12 + rnd() * 22, mix(0xb9bdc4, 0xd6d9de, rnd()), 0x35506b, false);
    } else lampadaire(c, p.x, y, p.z, a, 6, 0xfff0c8);
  },
  neon(c, x, p, rnd) {
    RECETTES.nuit(c, x, p, rnd);
  },
};

export function decor(c: Calques, x: Contexte, rnd: () => number) {
  tribune(c, x, x.track.blocks[0]!);
  const recette = RECETTES[x.palette];
  // Peu de pièces : une place sur deux près de la piste, une par cellule plus loin.
  for (const p of placesDeDecor(x.track, rnd, (anneau) => (anneau === 1 ? (rnd() < 0.55 ? 1 : 0) : 1))) recette(c, x, p, rnd);
}

export function ambianceA(nom: PaletteName, look: Ambiance["look"]): Ambiance {
  const t = THEMES_A[nom];
  return {
    look: { ...look, exposure: t.exposition, haze: 1, shadow: t.nuit ? 0.6 : 1, halo: t.nuit ? 1.2 : 0, headlights: t.nuit ? 1.2 : 0 },
    ciel: { zenith: t.ciel[0], horizon: t.ciel[1], bandes: true },
    disque: { couleur: t.nuit ? 0xe6ecff : 0xfffbe8, taille: t.nuit ? 46 : 60, net: true },
    etoiles: t.nuit ? 120 : 0,
    hemi: t.hemi,
    ambiante: [t.hemi[0], t.nuit ? 0.12 : 0.2],
    soleil: t.soleil,
    hauteurSoleil: t.hauteur,
    brume: { couleur: t.ciel[1], near: t.brume[0], far: t.brume[1] },
    silhouettes: { corps: t.silhouettes[0], sommet: t.silhouettes[1], plates: true, forme: HORIZONS[nom] },
  };
}

// IIFE annotée pure : l'empaqueteur peut écarter la direction entière si personne ne la lit (poids par partie, lots de mise en œuvre).
export const DIRECTION_A: Direction = /* @__PURE__ */ (() => ({
  ...ORIGINE,
  id: "A",
  nom: "A — Net et graphique",
  materiau: "toon",
  palette(nom, base) {
    const t = THEMES_A[nom];
    return { ...base, road: t.route, wallA: t.rebord[0], wallB: t.rebord[1], floorA: t.sol[0], floorB: t.sol[1], sky: t.ciel[1], zenith: t.ciel[0] };
  },
  ambiance: (nom, _pal, look) => ambianceA(nom, look),
  route: routeA,
  portiqueDepart,
  arrivee,
  porte,
  plaque(c, x, b) {
    plaqueA(c, b, x.pal.boost, MARQUE.encre, MARQUE.encre, 3);
    c.lumineux.halo(...pt(repereBloc(b, CELL / 2), 0, 0.6, 0), x.pal.boost, 7);
  },
  turbo(c, _x, b) {
    plaqueA(c, b, 0xe8283a, 0xffd23f, MARQUE.encre, 3);
    c.lumineux.halo(...pt(repereBloc(b, CELL / 2), 0, 0.6, 0), 0xe8283a, 9);
  },
  coupure(c, _x, b) {
    // Moteur coupé : des rayures d'alerte à 45°, encre et jaune, sur toute la largeur.
    const r = repereBloc(b, CELL / 2);
    const hw = blockHalfWidth(b, CELL / 2);
    const L = CUT_HALF_LENGTH;
    sol(c.route, r, -hw, hw, -L, L, 0.04, 0xffd23f);
    for (let g = -hw - 2 * L; g < hw; g += 2.4) {
      const P = (gg: number, a: number) => pt(r, Math.max(-hw, Math.min(hw, gg)), 0.05, a);
      c.route.quad(P(g, -L), P(g + 1.2, -L), P(g + 1.2 + 2 * L, L), P(g + 2 * L, L), MARQUE.encre);
    }
  },
  panneau,
  rythme,
  decor,
}))();
