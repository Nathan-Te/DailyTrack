// Retouche 38b — palier 2, pas « géométrie » et « variété » : les pièces qui donnent l'échelle (boulons, haubans, câbles, banderoles, pneus
// empilés, drapeaux) et la variation de chaque instance (teinte, usure, orientation, taille). Tout reste fusionné dans les calques du lot 38 (un
// appel de rendu par calque) ; seuls les drapeaux animés du palier 3 ont leur maillage (`Drapeaux`). Présentation seule : rien ne touche à `sim`.
import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { Builder, mix, shade, type V3 } from "../meshKit";
import { WALL_HEIGHT } from "@cdj/sim";
import { CHAPEAU } from "../decorPose";
import { hasCap, onRim } from "../trackMesh";
import { boite, boiteChanfreinee, pt, repereBloc, tube, type Affiches, type Repere } from "./outils";
import { MARQUE } from "./pieces";
import { CAOUTCHOUC, METAL, METAL_SOMBRE } from "./piste";
import { POSES_RYTHME, VENT } from "./palier1";
import { rectSponsor, sponsorsDuTheme } from "./sponsors";
import type { Calques, FinitionElements } from "./types";

// --- Formes plus fines ---------------------------------------------------------------------------------------------------------------

/**
 * Une colonne aux quatre arêtes verticales chanfreinées de `c` m (section à huit pans) : sur un pilier vu de la caméra de poursuite, ce sont les
 * arêtes verticales qui accrochent la lumière. Dessus plat ; pas de dessous.
 */
export function colonneChanfreinee(g: Builder, r: Repere, g0: number, g1: number, h0: number, h1: number, a0: number, a1: number, c: number, couleur: number, arete = shade(couleur, 1.12)) {
  const s: [number, number][] = [
    [g0 + c, a0],
    [g1 - c, a0],
    [g1, a0 + c],
    [g1, a1 - c],
    [g1 - c, a1],
    [g0 + c, a1],
    [g0, a1 - c],
    [g0, a0 + c],
  ];
  for (let k = 0; k < 8; k++) {
    const [ga, aa] = s[k]!;
    const [gb, ab] = s[(k + 1) % 8]!;
    g.quad(pt(r, gb, h0, ab), pt(r, ga, h0, aa), pt(r, ga, h1, aa), pt(r, gb, h1, ab), k % 2 === 1 ? arete : couleur);
  }
  for (let k = 1; k < 7; k++) g.tri(pt(r, s[0]![0], h1, s[0]![1]), pt(r, s[k]![0], h1, s[k]![1]), pt(r, s[k + 1]![0], h1, s[k + 1]![1]), couleur);
}

// --- Pièces d'échelle -------------------------------------------------------------------------------------------------------------------

/** Des boulons (têtes de 6 cm) aux points `(gauche, avant)` du repère, posés à la hauteur `h`. 12 triangles chacun. */
export function boulons(g: Builder, r: Repere, points: readonly (readonly [number, number])[], h: number, couleur: number) {
  for (const [gg, a] of points) boite(g, r, gg - 0.035, gg + 0.035, h, h + 0.05, a - 0.035, a + 0.035, couleur, shade(couleur, 0.8));
}

/** Les quatre coins d'un rectangle, en retrait de `m` : où poser les boulons d'une semelle. */
export function coins(g0: number, g1: number, a0: number, a1: number, m: number): [number, number][] {
  return [
    [g0 + m, a0 + m],
    [g1 - m, a0 + m],
    [g1 - m, a1 - m],
    [g0 + m, a1 - m],
  ];
}

/** Un hauban tendu de `haut` à `bas` (câble fin, trois pans) et son ancre au sol (un plot). */
export function hauban(g: Builder, haut: V3, bas: V3, couleur: number, ancre: number) {
  tube(g, haut, bas, 0.022, 3, couleur);
  g.box(bas[0] - 0.12, bas[1] - 0.02, bas[2] - 0.12, bas[0] + 0.12, bas[1] + 0.14, bas[2] + 0.12, ancre);
}

/** Un câble qui pend entre `a` et `b` (chaînette approchée en `n` segments), de flèche `f`. */
export function cablePendant(g: Builder, a: V3, b: V3, f: number, couleur: number, n = 8, rayon = 0.035) {
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - f * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    tube(g, prev, p, rayon, 3, couleur);
    prev = p;
  }
}

/** Une pile de `n` pneus (prismes à huit pans), le dernier peint en `haut`. */
export function pneusEmpiles(g: Builder, x: number, y: number, z: number, n: number, haut: number, caoutchouc = 0x1d1d20, r = 0.42) {
  for (let i = 0; i < n; i++) g.prism(x, y + i * 0.3, z, r, r * 0.9, 0.29, 8, i === n - 1 ? haut : caoutchouc, i === n - 1 ? haut : caoutchouc, i * 0.4);
}

/** Banderole de sponsor tendue entre deux points du repère (lue des deux côtés), dans l'atlas des affiches. */
export function banderole(aff: Affiches, r: Repere, g0: number, g1: number, h0: number, h1: number, a: number, rect: readonly [number, number, number, number]) {
  aff.face(r, g0, g1, h0, h1, a - 0.01, rect);
  aff.quad(pt(r, g0, h0, a + 0.01), pt(r, g1, h0, a + 0.01), pt(r, g1, h1, a + 0.01), pt(r, g0, h1, a + 0.01), rect);
}

// --- Drapeaux (palier 2 : figés dans le calque ; palier 3 : animés) -----------------------------------------------------------------

/**
 * Les drapeaux et banderoles souples d'une scène. Chaque sommet porte `flot` (0 à la hampe, 1 au bout libre) et une phase : au palier 3 la carte
 * graphique les fait onduler (`drapeauxAnimes`, `vie.ts` : un seul maillage, un appel de rendu) ; au palier 2 ils sont figés dans leur pose de
 * repos et versés dans le calque `solide` (`verser`) : aucun appel de plus.
 */
export class Drapeaux {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  /** Par sommet : flot (0–1), phase (rad), amplitude (m). */
  readonly flot: number[] = [];
  /** Par sommet : la direction de l'ondulation (perpendiculaire au tissu). */
  readonly ondule: number[] = [];
  private readonly c = new Color();

  private sommet(p: V3, couleur: number, flot: number, phase: number, amp: number, n: V3) {
    this.c.set(couleur);
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(this.c.r, this.c.g, this.c.b);
    this.flot.push(flot, phase, amp);
    this.ondule.push(n[0], n[1], n[2]);
  }

  /**
   * Un drapeau accroché en haut d'une hampe : `mat` = le haut de la hampe, `dir` (x, z) = où flotte le tissu, `l` × `h` m, `n` tranches.
   * `couleurs` : deux bandes (en haut, en bas) ou une couleur.
   */
  drapeau(mat: V3, dir: readonly [number, number], l: number, h: number, couleurs: readonly number[], phase: number, n = 5) {
    const d = Math.hypot(dir[0], dir[1]) || 1;
    const fx = dir[0] / d;
    const fz = dir[1] / d;
    const no: V3 = [-fz, 0, fx];
    const bandes = couleurs.length;
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      for (let k = 0; k < bandes; k++) {
        const y1 = mat[1] - (h * k) / bandes;
        const y0 = mat[1] - (h * (k + 1)) / bandes;
        const P = (u: number, y: number): V3 => [mat[0] + fx * l * u, y - u * 0.12 * h, mat[2] + fz * l * u];
        const couleur = couleurs[k]!;
        const q = [P(u0, y0), P(u1, y0), P(u1, y1), P(u0, y1)] as const;
        const f = [u0, u1, u1, u0];
        for (const j of [0, 1, 2, 0, 2, 3]) this.sommet(q[j]!, couleur, f[j]!, phase + f[j]! * 2.4, 0.22 * l, no);
      }
    }
  }

  /** Une banderole souple tendue de `a` à `b` sur `h` m de haut : elle ondule au milieu, pas aux attaches. */
  banderole(a: V3, b: V3, h: number, couleurs: readonly number[], phase: number, n = 8) {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const d = Math.hypot(dx, dz) || 1;
    const no: V3 = [-dz / d, 0, dx / d];
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const P = (u: number, dy: number): V3 => [a[0] + dx * u, a[1] + (b[1] - a[1]) * u - 0.25 * 4 * u * (1 - u) + dy, a[2] + dz * u];
      const f = (u: number) => Math.sin(Math.PI * u);
      const couleur = couleurs[i % couleurs.length]!;
      const q = [P(u0, -h), P(u1, -h), P(u1, 0), P(u0, 0)] as const;
      const fl = [f(u0), f(u1), f(u1), f(u0)];
      const us = [u0, u1, u1, u0];
      for (const j of [0, 1, 2, 0, 2, 3]) this.sommet(q[j]!, couleur, fl[j]!, phase + us[j]! * 6, 0.12, no);
    }
  }

  get vide(): boolean {
    return this.pos.length === 0;
  }

  /** La géométrie animable (palier 3) : `aFlot` (flot, phase, amplitude) et `aOndule`. */
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.setAttribute("aFlot", new Float32BufferAttribute(this.flot, 3));
    g.setAttribute("aOndule", new Float32BufferAttribute(this.ondule, 3));
    g.computeVertexNormals();
    return g;
  }

  /** Verse les drapeaux, figés dans leur pose de repos (la même formule que l'animation à t = 0), dans un calque ordinaire. */
  verser(g: Builder) {
    for (let i = 0; i + 2 < this.pos.length / 3; i += 3) {
      const p = [0, 1, 2].map((k) => poseRepos(this, i + k));
      const c = this.col;
      const hex = new Color(c[i * 3]!, c[i * 3 + 1]!, c[i * 3 + 2]!).getHex();
      g.tri(p[0]!, p[1]!, p[2]!, hex);
    }
  }
}

/** La pose de repos d'un sommet (t = 0) : `déplacement = ondule × sin(phase) × amplitude × flot`, comme le nuanceur de `vie.ts`. */
function poseRepos(d: Drapeaux, i: number): V3 {
  const f = d.flot[i * 3]!;
  const ph = d.flot[i * 3 + 1]!;
  const amp = d.flot[i * 3 + 2]!;
  const k = Math.sin(ph) * amp * f;
  return [d.pos[i * 3]! + d.ondule[i * 3]! * k, d.pos[i * 3 + 1]!, d.pos[i * 3 + 2]! + d.ondule[i * 3 + 2]! * k];
}

// --- Variété ------------------------------------------------------------------------------------------------------------------------

/** Où en sont les calques avant une instance (longueurs des tableaux) : la variété ne touche que ce que l'instance vient d'ajouter. */
export interface Marque {
  decor: number;
  decorLumineux: number;
  dense: number;
  affiches: number;
  halos: number;
}

export function marque(c: Calques): Marque {
  return { decor: c.decor.pos.length, decorLumineux: c.decorLumineux.pos.length, dense: c.dense.pos.length, affiches: c.affiches.pos.length, halos: c.decor.halos.length + c.decorLumineux.halos.length };
}

/** Couleur d'usure : la poussière qui ternit (mêlée à la teinte d'une instance usée). */
const USURE = 0x7a6a58;

/**
 * Fait varier une instance de décor (ce qui a été ajouté depuis `m`) : un quart de tour au plus autour de sa verticale, une taille de 0,88 à 1,12
 * (depuis son pied, qui reste au sol), une teinte ± 8 % et, une fois sur quatre, de l'usure. `rnd` est **une autre suite** que celle du décor : le
 * décor reste à la même place quand on allume ou coupe la variété.
 */
export function varierInstance(c: Calques, m: Marque, cx: number, sol: number, cz: number, rnd: () => number, force = 1) {
  const a = (rnd() - 0.5) * 0.5 * force;
  const s = 1 + (rnd() - 0.5) * 0.24 * force;
  const teinte = 1 + (rnd() - 0.5) * 0.16 * force;
  const use = rnd() < 0.25 ? 0.12 + rnd() * 0.18 : 0;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const bouge = (pos: number[], depuis: number) => {
    for (let i = depuis; i + 2 < pos.length; i += 3) {
      const x = (pos[i]! - cx) * s;
      const z = (pos[i + 2]! - cz) * s;
      pos[i] = cx + x * cs - z * sn;
      pos[i + 1] = sol + (pos[i + 1]! - sol) * s;
      pos[i + 2] = cz + x * sn + z * cs;
    }
  };
  bouge(c.decor.pos, m.decor);
  bouge(c.decorLumineux.pos, m.decorLumineux);
  bouge(c.dense.pos, m.dense);
  bouge(c.affiches.pos, m.affiches);
  const halos = [...c.decor.halos, ...c.decorLumineux.halos];
  for (const h of halos.slice(m.halos)) {
    const x = (h.x - cx) * s;
    const z = (h.z - cz) * s;
    h.x = cx + x * cs - z * sn;
    h.y = sol + (h.y - sol) * s;
    h.z = cz + x * sn + z * cs;
  }
  // Teinte et usure : sur le décor éclairé seulement (les fenêtres et lampes gardent leur couleur).
  const ur = ((USURE >> 16) & 255) / 255;
  const ug = ((USURE >> 8) & 255) / 255;
  const ub = (USURE & 255) / 255;
  const col = c.decor.col;
  for (let i = m.decor; i + 2 < col.length; i += 3) {
    col[i] = Math.min(1, (col[i]! * (1 - use) + ur * use) * teinte);
    col[i + 1] = Math.min(1, (col[i + 1]! * (1 - use) + ug * use) * teinte);
    col[i + 2] = Math.min(1, (col[i + 2]! * (1 - use) + ub * use) * teinte);
  }
}

/** Hachage entier de trois coordonnées de cellule : la même variation pour tout le monde. */
function hache(x: number, y: number, z: number, graine: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(graine, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Variation par morceau (rebords, portiques, panneaux) : chaque triangle prend la teinte de la cellule de `pas` m où tombe son centre — une bande
 * de rebord un peu plus claire, la suivante un peu passée, une sur sept salie. `force` ≈ 0,06 : on la sent, on ne la voit pas.
 */
export function varierParPosition(g: Builder, pas: number, force: number, graine: number) {
  const p = g.pos;
  const c = g.col;
  const ur = ((USURE >> 16) & 255) / 255;
  const ug = ((USURE >> 8) & 255) / 255;
  const ub = (USURE & 255) / 255;
  for (let i = 0; i + 8 < p.length; i += 9) {
    const x = (p[i]! + p[i + 3]! + p[i + 6]!) / 3;
    const y = (p[i + 1]! + p[i + 4]! + p[i + 7]!) / 3;
    const z = (p[i + 2]! + p[i + 5]! + p[i + 8]!) / 3;
    const h = hache(Math.floor(x / pas), Math.floor(y / 3), Math.floor(z / pas), graine);
    const k = 1 + (h - 0.5) * 2 * force;
    const sale = h > 0.86 ? 0.18 : 0;
    for (let j = i; j < i + 9; j += 3) {
      c[j] = Math.min(1, (c[j]! * (1 - sale) + ur * sale) * k);
      c[j + 1] = Math.min(1, (c[j + 1]! * (1 - sale) + ug * sale) * k);
      c[j + 2] = Math.min(1, (c[j + 2]! * (1 - sale) + ub * sale) * k);
    }
  }
}

/** Une teinte voisine de `c` (± `force`), tirée de `rnd` : panneaux, piles, bandes. */
export function teinteVoisine(c: number, rnd: () => number, force = 0.08): number {
  const k = 1 + (rnd() - 0.5) * 2 * force;
  return rnd() < 0.2 ? mix(shade(c, k), USURE, 0.15) : shade(c, k);
}

// --- Lot 43 : le pas « géométrie » sur les éléments de course du palier 1 -------------------------------------------------------------

/**
 * Ce que la géométrie (palier 2) ajoute aux éléments du palier 1 (`palier1.ts`), qui sont dans le premier chargement du jeu et n'importent pas ce
 * module : le compositeur qui a chargé `finition.ts` les passe dans le contexte (`Contexte.finition`). Déplacé tel quel de `palier1.ts` (retouche 38b).
 */
export const FINITION_ELEMENTS: FinitionElements = {
  portique(c, x, b, q, w, drapeau) {
    const r = repereBloc(b, q);
    for (const s of [-1, 1]) {
      // Un socle prolongé vers qui arrive, protégé par deux piles de pneus (une sur deux au haut blanc) ; ses boulons.
      boiteChanfreinee(c.solide, r, s * w - 1.1, s * w + 1.1, -0.1, 0.7, -2.6, -0.9, 0.08, MARQUE.encre, shade(MARQUE.encre, 1.3));
      const bas = x.floorY - b.y0;
      if (bas < -0.5) boite(c.solide, r, s * w - 1.0, s * w + 1.0, bas, 0, -2.5, -0.8, shade(0xb9bbbe, 0.85), shade(0xb9bbbe, 0.8));
      for (const [k, dg] of [-0.45, 0.45].entries()) pneusEmpiles(c.solide, ...pt(r, s * w + dg, 0.7, -1.75), 3, k === 0 ? 0xf4f4f4 : CAOUTCHOUC);
      boulons(c.solide, r, coins(s * w - 1.1, s * w + 1.1, -0.9, 0.9, 0.14), 0.7, METAL);
      // Le câble d'alimentation qui descend de la poutre le long du pilier.
      cablePendant(c.solide, pt(r, s * (w - 0.75), 8.4, 0.3), pt(r, s * (w - 0.75), 0.72, 0.6), 0.25, CAOUTCHOUC, 6);
      // Banderole de sponsor sur le devant du socle prolongé.
      const logos = sponsorsDuTheme(x.palette);
      banderole(c.affiches, r, s * w - 1.05, s * w + 1.05, 0.08, 0.66, -2.62, rectSponsor(logos[(s + 1) / 2]!));
    }
    // Un drapeau en haut de chaque pilier (hampe : un tube), qui flotte dans le vent de la scène : dès qu'il y a des drapeaux (palier 2 :
    // figés ; palier 3 : animés).
    if (!c.drapeaux) return;
    for (const s of [-1, 1]) {
      const haut = pt(r, s * (w + 0.4), 11.6, 0);
      c.solide.box(haut[0] - 0.05, haut[1], haut[2] - 0.05, haut[0] + 0.05, haut[1] + 2.6, haut[2] + 0.05, METAL);
      c.drapeaux.drapeau([haut[0], haut[1] + 2.55, haut[2]], VENT, 1.7, 1.05, drapeau, s * 1.3 + b.index);
    }
  },
  panneau(c, _x, _hote, r0, large) {
    for (const g of [-large * 0.6, large * 0.6]) {
      boite(c.solide, r0, g - 0.22, g + 0.22, 0, 0.04, 0.03, 0.47, METAL_SOMBRE);
      boulons(c.solide, r0, coins(g - 0.22, g + 0.22, 0.03, 0.47, 0.06), 0.04, METAL);
    }
    // Jambe de force entre les deux pieds, en diagonale (la structure qui tient le panneau au vent).
    const a = pt(r0, -large * 0.6, 0.3, 0.25);
    const d = pt(r0, large * 0.6, 1.5, 0.25);
    c.solide.box(Math.min(a[0], d[0]) - 0.03, a[1], Math.min(a[2], d[2]) - 0.03, Math.max(a[0], d[0]) + 0.03, a[1] + 0.06, Math.max(a[2], d[2]) + 0.03, METAL_SOMBRE);
    boite(c.solide, r0, -large * 0.6, large * 0.6, 0.9, 0.96, 0.22, 0.28, METAL_SOMBRE);
  },
  rythme(c, x, b, rapide) {
    // Un catadioptre ambre sur chaque repère de vitesse (ils ne sont posés que dans les portions rapides, sur le chapeau des rebords).
    if (!rapide || !hasCap(b)) return;
    const cap = x.pal.wallHeight ?? WALL_HEIGHT;
    for (const u of POSES_RYTHME) {
      for (const side of [-1, 1] as const) {
        const p = onRim(b, u, side, CHAPEAU / 2, cap);
        c.lumineux.box(p[0] - 0.13, p[1] + 1.4, p[2] - 0.13, p[0] + 0.13, p[1] + 1.52, p[2] + 0.13, 0xffb000);
      }
    }
  },
  colonne: colonneChanfreinee,
};
