// Lot 43 — la piste du palier 1, **dans le premier chargement** : les couleurs de chaque thème (celles de la direction A), les rebords propres à chaque
// thème (ceux de la direction B), les marquages et les plaques. Déplacés tels quels de `directionA.ts` et `directionB.ts` (lot 38), qui les réexportent :
// le palier 1 du jeu les importe d'ici sans tirer le reste des directions (leur décor, leur atlas, la scène d'origine), qui reste à la vitrine.
import { CELL, blockHalfWidth, blockPadHalfWidth, SHOULDER_EDGE, type Block, type PaletteName } from "@cdj/sim";
import { Builder, shade, type V3 } from "../meshKit";
import { boiteChanfreinee, repereBloc, repereSegment, sol, type Repere } from "./outils";
import { MARQUE, chevronSol } from "./pieces";
import { STYLE_ORIGINE, across, bordureVideOrigine, rowWidth, tiretsCentre, type Row, type StyleRoute, type TronconRebord } from "./route";
import type { Palette } from "../trackMesh";
import type { Calques } from "./types";

// --- Matières (couleurs de base : B varie les matériaux par la couleur et la forme, sur un seul matériau) ----------------------------------

export const METAL = 0x8a9099;
export const METAL_SOMBRE = 0x4a4f58;
export const CAOUTCHOUC = 0x1d1d20;

/** Les couleurs de piste de A pour chaque thème (route, rebords, vibreurs, ciel, sol) : celles du palier 1 (lot 43 ; la lumière de A reste dans `directionA.ts`). */
export interface PisteA {
  route: [number, number];
  rebord: [number, number];
  vibreur: [number, number];
  ciel: [zenith: number, horizon: number];
  sol: [string, string];
}

export const PISTE_A: Record<PaletteName, PisteA> = {
  stade: { route: [0x47464c, 0x434248], rebord: [0x2e7dff, 0xf4f4f4], vibreur: [0xe8283a, 0xf4f4f4], ciel: [0x1f6fd6, 0x9fd3ff], sol: ["#4fae3c", "#47a335"] },
  desert: { route: [0x67655f, 0x615f59], rebord: [0x1e1b19, 0xf4f1e6], vibreur: [0xe8552d, 0xf4f1e6], ciel: [0x2f9ad0, 0xf6c98e], sol: ["#dba65f", "#cf9a52"] },
  neige: { route: [0x5b6676, 0x566171], rebord: [0x2f6fd0, 0xffffff], vibreur: [0xe8283a, 0xffffff], ciel: [0xb7cde3, 0xeef3f7], sol: ["#f6f9fc", "#e6eef5"] },
  nuit: { route: [0x1d2030, 0x1a1d2c], rebord: [0x1e1b19, 0xf2b544], vibreur: [0xf2b544, 0x1e1b19], ciel: [0x02030c, 0x101a48], sol: ["#0b0f22", "#090c1c"] },
  campagne: { route: [0x6d6e72, 0x67686c], rebord: [0x7a5230, 0xd9b27a], vibreur: [0xd9402a, 0xf6f6f0], ciel: [0x4f7fcf, 0xf7c27a], sol: ["#3f7d3a", "#38733a"] }, // lot 48 : sol plus sombre (ΔE > 12 de l'herbe de course et des huit livrées)
  canyon: { route: [0x6a605c, 0x645a56], rebord: [0xa8472a, 0xe0a466], vibreur: [0x1e1b19, 0xf6e6c8], ciel: [0x5a4a9a, 0xf6a35f], sol: ["#d79a52", "#cc8f48"] },
  alpin: { route: [0x55595f, 0x51555b], rebord: [0xe8283a, 0xf6f6f6], vibreur: [0xe8283a, 0xf6f6f6], ciel: [0x1f62c4, 0xc9e4f7], sol: ["#86b56f", "#7dab66"] },
  ville: { route: [0x3c3e44, 0x393b41], rebord: [0xc8cbd1, 0xa9adb4], vibreur: [0xf2b544, 0x1e1b19], ciel: [0x6f9fd2, 0xd2dde8], sol: ["#9a9da4", "#91949b"] },
  neon: { route: [0x2d2250, 0x261c45], rebord: [0xff2bd6, 0x00f0ff], vibreur: [0xff2bd6, 0x00f0ff], ciel: [0x06000f, 0x2a0b55], sol: ["#2a0a4a", "#210840"] },
};

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

/** Les rebords de A : blocs à bandes de 8 m, liseré d'encre sur l'arête, ombre nette au pied (la direction A ; pas le palier 1, qui prend ceux de B). */
function rebordA(g: Builder, t: TronconRebord, pal: Palette) {
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
}

/** Le bord du vide de A : un liseré crème épais, des blocs bas encre et livrée ; néon la nuit. */
function bordureVideA(g: Builder, lum: Builder, t: TronconRebord, pal: Palette, milieu: V3) {
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
}

/**
 * Les vibreurs de A (dents relevées de 1,8 m, 3 m par couleur, lèvre d'encre côté route), aux couleurs données (lot 43 : celles du palier 1). `levre` faux
 * (palier 1) : des dents peintes à 7 cm, sans lèvre (deux fois moins de triangles dans les virages, comme les vibreurs de l'existant).
 */
export function vibreursA(vibreur: readonly [number, number], levre = true): StyleRoute["vibreurs"] {
  const y = levre ? 0.12 : 0.07;
  return (g, rows) => {
    // Dents de scie relevées : 3 m par couleur, une lèvre d'encre côté route (on les voit de loin et de face).
    let s = 0;
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i]!;
      const b = rows[i + 1]!;
      const ma = across(a, 0.5, 0);
      const mb = across(b, 0.5, 0);
      const c = vibreur[Math.floor(s / 3) % 2]!;
      s += Math.hypot(ma[0] - mb[0], ma[2] - mb[2]);
      const fa = 1.8 / rowWidth(a);
      const fb = 1.8 / rowWidth(b);
      g.quad(across(a, 0, y), across(a, fa, y), across(b, fb, y), across(b, 0, y), c);
      g.quad(across(a, 1 - fa, y), across(a, 1, y), across(b, 1, y), across(b, 1 - fb, y), c);
      if (!levre) continue;
      g.quad(across(a, fa, 0), across(b, fb, 0), across(b, fb, 0.12), across(a, fa, 0.12), MARQUE.encre);
      g.quad(across(a, 1 - fa, 0), across(b, 1 - fb, 0), across(b, 1 - fb, 0.12), across(a, 1 - fa, 0.12), MARQUE.encre);
    }
  };
}

/** Lignes de rive de A : épaisses (0,35 m), pas de sillons ; la route est un aplat. */
export function rivesA(g: Builder, a: Row, b: Row, _color: number, pal: Palette) {
  // Lignes de rive épaisses (0,35 m), pas de sillons : la route est un aplat.
  const wa = rowWidth(a);
  const wb = rowWidth(b);
  for (const [d0, d1] of [[0.5, 0.85], [-0.85, -0.5]] as const) {
    const fa = (d: number) => (d >= 0 ? d / wa : 1 + d / wa);
    const fb = (d: number) => (d >= 0 ? d / wb : 1 + d / wb);
    g.quad(across(a, fa(d0), 0.03), across(a, fa(d1), 0.03), across(b, fb(d1), 0.03), across(b, fb(d0), 0.03), pal.dash);
  }
}

/** Tirets de A : 0,8 × 5 m au centre. */
export function tiretsA(g: Builder, b: Block, pal: Palette) {
  tiretsCentre(g, b, pal.dash, 0.4, 5);
}

/** Les bandes d'une cuve : les couleurs des rebords du thème. */
export const cuveA = (pal: Palette): [number, number] => [pal.wallA, pal.wallB];

/** Le style de route de A pour un thème ; `vibreur` (lot 43) remplace ses couleurs de vibreurs (l'orange est à la voiture : `palier1.ts`). */
export function routeA(nom: PaletteName, vibreur: readonly [number, number] = PISTE_A[nom].vibreur): StyleRoute {
  return { ...STYLE_ORIGINE, rebord: rebordA, bordureVide: bordureVideA, vibreurs: vibreursA(vibreur), rives: rivesA, tirets: tiretsA, cuve: cuveA };
}

/** Demi-écartement des piliers d'un portique (comme `postSpan`) : le bord de la route, ou de la bande. */
export function ecart(b: Block, q: number): number {
  return b.shoulder ? SHOULDER_EDGE - 0.6 : blockHalfWidth(b, q) + 1.4;
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

// --- Rebords propres à chaque thème ---------------------------------------------------------------------------------------------------

export type Profil = [dehors: number, haut: number][];

/** Un profil extrudé le long du tronçon, par morceaux de `pas` m (bandes de couleur alignées sur la distance parcourue). */
export function extruder(g: Builder, t: TronconRebord, profil: Profil, pas: number, couleur: (n: number, k: number) => number) {
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
export function jalons(t: TronconRebord, pas: number, decal = 0): { p: V3; n: number }[] {
  const out: { p: V3; n: number }[] = [];
  const debut = Math.ceil((t.s - decal) / pas) * pas + decal;
  for (let s = debut; s < t.s + t.longueur; s += pas) {
    const u = (s - t.s) / t.longueur;
    out.push({ p: [t.a[0] + (t.b[0] - t.a[0]) * u, t.a[1] + (t.b[1] - t.a[1]) * u, t.a[2] + (t.b[2] - t.a[2]) * u], n: Math.round((s - decal) / pas) });
  }
  return out;
}


export type RebordB = "beton" | "pneus" | "bois" | "roche" | "glissiere" | "neige";
export const REBORDS_B: Record<PaletteName, RebordB> = { stade: "beton", nuit: "beton", ville: "beton", neon: "beton", desert: "pneus", campagne: "bois", canyon: "roche", alpin: "glissiere", neige: "neige" };


/**
 * Les rebords du palier 1 (lot 43) : le profil du thème (béton en « J », mur de pneus, clôture de bois, blocs de roche, glissière) **en peu de faces**, vues
 * de la route — ≈ 0,8 à 3 triangles par mètre (le lot 38 en dessinait 3 à 14 : le mur de pneus du Rallye et la glissière du Col doublaient les triangles
 * de la scène). Bandes de couleur de 8 m (A : deux fois celles de l'existant, plus lisibles à 200 km/h) ; catadioptres ambre tous les 8 m.
 */
function rebordLeger(g: Builder, t: TronconRebord, sorte: RebordB, lum?: Builder) {
  const h = t.hauteur;
  const ox = t.dehors[0];
  const oz = t.dehors[1];
  const r = repereSegment(t.a, t.b);
  const coul = (n: number) => t.couleurs[n % 2]!;
  // Un panneau vertical tourné vers la route, centré en `p`, large de `l` m le long du rebord, à `out` m au-delà du bord, de `y0` à `y1`.
  const plaque = (cible: Builder, p: V3, l: number, out: number, y0: number, y1: number, c: number) => {
    const a: V3 = [p[0] + ox * out - r.f[0] * l, p[1], p[2] + oz * out - r.f[2] * l];
    const b: V3 = [p[0] + ox * out + r.f[0] * l, p[1], p[2] + oz * out + r.f[2] * l];
    cible.quad([a[0], a[1] + y0, a[2]], [b[0], b[1] + y0, b[2]], [b[0], b[1] + y1, b[2]], [a[0], a[1] + y1, a[2]], c);
  };
  const catadioptres = (out: number, y: number) => {
    if (lum) for (const { p, n } of jalons(t, 8, 2)) if (n % 2 === 0) plaque(lum, p, 0.15, out - 0.01, y - 0.08, y + 0.08, 0xffb000);
  };
  if (sorte === "beton") {
    // Béton en « J » : la face inclinée, le dessus, la face extérieure (trois pans par bande de 8 m).
    extruder(g, t, [[0, 0], [0.3, h], [0.55, h], [0.6, -0.6]], 8, (n, k) => (k === 2 ? shade(coul(n), 0.85) : coul(n)));
    catadioptres(0.16, h * 0.55);
  } else if (sorte === "pneus") {
    // Mur de pneus : des piles de 2,2 m (deux noirs alternés), une sur deux au haut peint (une bande posée devant), un dessus commun.
    extruder(g, t, [[0.05, 0], [0.05, h]], 2.2, (n) => (n % 2 === 0 ? CAOUTCHOUC : shade(CAOUTCHOUC, 1.35)));
    for (const { p, n } of jalons(t, 4.4, 1.1)) if (n % 2 === 0) plaque(g, p, 1.08, 0.04, h - 0.45, h, t.couleurs[1]);
    extruder(g, t, [[0.05, h], [0.95, h]], 8.8, () => 0x2a2a30);
  } else if (sorte === "bois") {
    // Clôture de bois : un poteau tous les 4 m, deux lisses et une planche basse.
    for (const { p } of jalons(t, 4)) plaque(g, p, 0.09, 0.15, -0.3, h + 0.1, t.couleurs[0]);
    for (const y of [0.55, 1.15]) extruder(g, t, [[0.08, y], [0.08, y + 0.16]], 12, (n) => (n % 2 === 0 ? t.couleurs[1] : shade(t.couleurs[1], 0.92)));
    extruder(g, t, [[0.06, 0], [0.06, 0.3]], 12, () => shade(t.couleurs[0], 0.9));
  } else if (sorte === "roche") {
    // Blocs de roche : une face et un dessus par bloc de 4,4 m, hauteurs et retraits tirés de la distance (le même mur pour tout le monde).
    morceaux(t, 4.4, (u0, u1, n) => {
      const k = ((n * 2654435761) >>> 0) / 4294967296;
      const hh = h * (0.9 + k * 0.45);
      const o = 0.05 + k * 0.2;
      const c = k < 0.5 ? t.couleurs[0] : t.couleurs[1];
      const at = (u: number, out: number, up: number): V3 => [t.a[0] + (t.b[0] - t.a[0]) * u + ox * out, t.a[1] + (t.b[1] - t.a[1]) * u + up, t.a[2] + (t.b[2] - t.a[2]) * u + oz * out];
      g.quad(at(u0, o, -0.6), at(u1, o, -0.6), at(u1, o, hh), at(u0, o, hh), c);
      g.quad(at(u0, o, hh), at(u1, o, hh), at(u1, 1.25, hh), at(u0, 1.25, hh), shade(c, 1.12));
    });
  } else {
    // Glissière double : un poteau tous les 4 m, deux lisses (une face, aux couleurs du thème) ; catadioptres.
    for (const { p } of jalons(t, 4)) plaque(g, p, 0.07, 0.35, -0.4, h, METAL_SOMBRE);
    for (const y of [0.55, 1.05]) extruder(g, t, [[0.25, y - 0.18], [0.25, y + 0.18]], 8, (n) => coul(n));
    catadioptres(0.24, h - 0.15);
  }
}

/** Le rebord léger d'un profil (palier 1, premier chargement : sans le code des profils complets du palier 2). */
export const rebordLegerDe = (sorte: RebordB) => (g: Builder, t: TronconRebord, lum?: Builder) => rebordLeger(g, t, sorte, lum);


/**
 * Le bord du vide du palier 1 (lot 43) : la bordure de l'existant et une balise réfléchissante tous les 8 m, en deux faces tournées vers la route (un plot
 * blanc et son catadioptre ambre) — les plots en boîtes de B coûtaient 36 triangles chacun.
 */
export function bordureVideP1(g: Builder, l: Builder, t: TronconRebord, pal: Palette, milieu: V3) {
  bordureVideOrigine(g, l, t, pal, milieu);
  const len = Math.hypot(milieu[0] - t.a[0], milieu[2] - t.a[2]) || 1;
  const ix = (milieu[0] - t.a[0]) / len;
  const iz = (milieu[2] - t.a[2]) / len;
  const f = repereSegment(t.a, t.b).f;
  for (const { p } of jalons(t, 8)) {
    const q = (s: number, y: number): V3 => [p[0] - ix * 0.1 + f[0] * s, p[1] + y, p[2] - iz * 0.1 + f[2] * s];
    g.quad(q(-0.09, 0), q(0.09, 0), q(0.09, 1.0), q(-0.09, 1.0), 0xf4f4f4);
    l.quad(q(-0.1, 0.84), q(0.1, 0.84), q(0.1, 0.96), q(-0.1, 0.96), 0xffb000);
  }
}
