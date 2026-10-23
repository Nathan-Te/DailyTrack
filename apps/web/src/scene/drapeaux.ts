// Retouche 38b — les drapeaux souples d'une scène (palier 2 : figés dans un calque ; palier 3 : animés, `vie.ts`). Lot 46 : sortis de
// `finition.ts` dans leur propre module, pour que le morceau « vie » du jeu (`vieJeu.ts`, à la demande) les ait sans tirer toute la finition.
import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { Builder, V3 } from "../meshKit";

// --- Drapeaux (palier 2 : figés dans le calque ; palier 3 : animés) -----------------------------------------------------------------

/**
 * Les drapeaux souples d'une scène (lot 46 : la banderole souple, que rien ne posait, est retirée). Chaque sommet porte `flot` (0 à la hampe, 1 au bout libre) et une phase : au palier 3 la carte
 * graphique les fait onduler (`drapeauxAnimes`, `vie.ts` : un seul maillage, un appel de rendu) ; au palier 2 ils sont figés dans leur pose de
 * repos et versés dans le calque `solide` (`verserDrapeaux`) : aucun appel de plus.
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
}

/** La pose de repos d'un sommet (t = 0) : `déplacement = ondule × sin(phase) × amplitude × flot`, comme le nuanceur de `vie.ts`. */
function poseRepos(d: Drapeaux, i: number): V3 {
  const f = d.flot[i * 3]!;
  const ph = d.flot[i * 3 + 1]!;
  const amp = d.flot[i * 3 + 2]!;
  const k = Math.sin(ph) * amp * f;
  return [d.pos[i * 3]! + d.ondule[i * 3]! * k, d.pos[i * 3 + 1]!, d.pos[i * 3 + 2]! + d.ondule[i * 3 + 2]! * k];
}

/**
 * Verse les drapeaux, figés dans leur pose de repos (la même formule que l'animation à t = 0), dans un calque ordinaire (palier 2). Lot 46 : une fonction
 * plutôt qu'une méthode, pour que le pas « vie » du jeu (qui les anime) ne l'embarque pas.
 */
export function verserDrapeaux(d: Drapeaux, g: Builder) {
  for (let i = 0; i + 2 < d.pos.length / 3; i += 3) {
    const p = [0, 1, 2].map((k) => poseRepos(d, i + k));
    const c = d.col;
    const hex = new Color(c[i * 3]!, c[i * 3 + 1]!, c[i * 3 + 2]!).getHex();
    g.tri(p[0]!, p[1]!, p[2]!, hex);
  }
}
