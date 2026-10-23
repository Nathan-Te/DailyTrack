// Lot 40c — la caisse « tôle » : des sections plus nombreuses, des arêtes **arrondies** là où la tôle se courbe et **vives** là où elle plie (ceinture de caisse,
// bord de capot, pied de vitre), un bout de caisse en plan arrondi (ni face plate ni coin coupé), des encadrements de vitres, et l'ombrage lissé qui en
// découle (groupes de lissage : peinture, vitre, garniture ne se moyennent pas entre eux). Les clés restent celles de `forme.ts` (`cle`, `pont`) : un profil
// à neuf points, ici complété en onze (les encadrements sombres du bas et du haut de la vitre). Rendu seul.
import { interpoler, type Cle } from "./forme";
import type { Fini, Pieces, V3 } from "./pieces";

type Pt = readonly [number, number];

/**
 * Le profil à onze points d'une clé à neuf points (`cle()` de forme.ts) : on y glisse les deux encadrements de la vitre (le bas et le haut du
 * flanc vitré, 8 % chacun). Rangs des tronçons : 0 dessous, 1 seuil, 2 flanc bas, 3 flanc, 4 ceinture (le biseau d'épaule), 5 encadrement bas, 6 vitre,
 * 7 encadrement haut, 8 montant et bord du toit, 9 dessus.
 */
export function profilTole(c: Cle): Cle {
  const p = c.pts;
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { z: c.z, pts: [p[0]!, p[1]!, p[2]!, p[3]!, p[4]!, p[5]!, lerp(p[5]!, p[6]!, 0.08), lerp(p[5]!, p[6]!, 0.92), p[6]!, p[7]!, p[8]!] };
}

/** Les rayons d'arrondi (m) des onze points : 0 = arête vive. Le défaut convient à une compacte ; chaque plan peut donner les siens. */
export const RAYONS_TOLE: readonly number[] = [0, 0.05, 0.03, 0.16, 0, 0, 0, 0, 0.03, 0.07, 0];

/** Le nombre de pas d'un arrondi selon son virage maximal (degrés) et la finesse voulue (degrés par pas). */
const pasDeVirage = (virage: number, finesse: number) => Math.max(1, Math.min(6, Math.ceil(virage / finesse)));

function virageAuPoint(pts: readonly Pt[], k: number): number {
  const a = [pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]];
  const b = [pts[k + 1]![0] - pts[k]![0], pts[k + 1]![1] - pts[k]![1]];
  const la = Math.hypot(a[0]!, a[1]!);
  const lb = Math.hypot(b[0]!, b[1]!);
  if (la < 1e-4 || lb < 1e-4) return 0;
  const c = (a[0]! * b[0]! + a[1]! * b[1]!) / (la * lb);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Le nombre de pas de chaque coin arrondi : le virage le plus grand de ce coin sur toutes les sections (même nombre de sommets partout). */
export function etapesDesCoins(sections: readonly Cle[], rayons: readonly number[], finesse: number): number[] {
  const n = sections[0]!.pts.length;
  const out: number[] = new Array(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    if (!rayons[k]) continue;
    let max = 0;
    for (const s of sections) max = Math.max(max, virageAuPoint(s.pts, k));
    out[k] = pasDeVirage(max, finesse);
  }
  return out;
}

export interface ProfilArrondi {
  pts: [number, number][];
  /** Rang d'origine de chaque tronçon (l'arc d'un coin garde le rang du tronçon d'avant). */
  seg: number[];
}

/** Arrondit les coins d'un profil : un arc de Bézier quadratique par coin dont le rayon est donné, `etapes` pas. */
export function arrondirProfil(pts: readonly Pt[], rayons: readonly number[], etapes: readonly number[]): ProfilArrondi {
  const out: [number, number][] = [[pts[0]![0], pts[0]![1]]];
  const seg: number[] = [];
  const pousser = (p: [number, number], rang: number) => {
    const d = Math.hypot(p[0] - out[out.length - 1]![0], p[1] - out[out.length - 1]![1]);
    if (d < 1e-6) return;
    out.push(p);
    seg.push(rang);
  };
  for (let k = 1; k < pts.length; k++) {
    const P = pts[k]!;
    const r = rayons[k] ?? 0;
    const m = etapes[k] ?? 0;
    if (k < pts.length - 1 && r > 0 && m > 0) {
      const A = pts[k - 1]!;
      const B = pts[k + 1]!;
      const l0 = Math.hypot(A[0] - P[0], A[1] - P[1]);
      const l1 = Math.hypot(B[0] - P[0], B[1] - P[1]);
      const t = Math.min(r, 0.48 * l0, 0.48 * l1);
      if (t > 1e-4) {
        const a: [number, number] = [P[0] + ((A[0] - P[0]) / l0) * t, P[1] + ((A[1] - P[1]) / l0) * t];
        const b: [number, number] = [P[0] + ((B[0] - P[0]) / l1) * t, P[1] + ((B[1] - P[1]) / l1) * t];
        pousser(a, k - 1);
        for (let j = 1; j <= m; j++) {
          const u = j / m;
          pousser([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * P[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * P[1] + u * u * b[1]], k - 1);
        }
        continue;
      }
    }
    pousser([P[0], P[1]], k - 1);
  }
  return { pts: out, seg };
}

/**
 * Arrondit les deux bouts de la caisse **en plan** : près de l'arrière et de l'avant, les sections se resserrent selon un quart d'ellipse
 * (`rayon` : sa longueur en m ; `reste` : la largeur gardée au tout bout, 0 à 1). Le coin vertical d'une caisse n'est plus une arête.
 */
export function boutsArrondis(sections: readonly Cle[], rayonArriere: number, rayonAvant: number, reste = 0.8, pas = [0, 0.1, 0.28, 0.6]): Cle[] {
  const entre = (a: Cle, b: Cle, z: number): Cle => {
    const t = b.z === a.z ? 0 : (z - a.z) / (b.z - a.z);
    return { z, pts: a.pts.map((p, i) => [p[0] + (b.pts[i]![0] - p[0]) * t, p[1] + (b.pts[i]![1] - p[1]) * t] as Pt) };
  };
  const serrer = (c: Cle, d: number, rayon: number): Cle => {
    const u = Math.min(1, d / rayon);
    const f = reste + (1 - reste) * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    return { z: c.z, pts: c.pts.map((p) => [p[0] * f, p[1]] as Pt) };
  };
  const n = sections.length;
  const out: Cle[] = [];
  // Arrière : des sections à z0 + pas·rayon, tirées des deux premières sections (le profil près du bout varie peu).
  const z0 = sections[0]!.z;
  const zf = sections[n - 1]!.z;
  const milieu = sections.filter((s) => s.z > z0 + rayonArriere * pas[pas.length - 1]! + 1e-6 && s.z < zf - rayonAvant * pas[pas.length - 1]! - 1e-6);
  for (const u of pas) out.push(serrer(entre(sections[0]!, sections[1]!, z0 + u * rayonArriere), u * rayonArriere, rayonArriere));
  out.push(...milieu);
  for (const u of [...pas].reverse()) out.push(serrer(entre(sections[n - 2]!, sections[n - 1]!, zf - u * rayonAvant), u * rayonAvant, rayonAvant));
  return out;
}

/** Ajoute des sections aux `z` donnés (les limites des vitres : un encadrement net, sans bavure sur la section voisine). */
export function coupes(sections: readonly Cle[], zs: readonly number[]): Cle[] {
  const out = [...sections];
  for (const z of zs) {
    const i = out.findIndex((s, k) => k + 1 < out.length && z > s.z + 1e-6 && z < out[k + 1]!.z - 1e-6);
    if (i < 0) continue;
    const a = out[i]!;
    const b = out[i + 1]!;
    const t = (z - a.z) / (b.z - a.z);
    out.splice(i + 1, 0, { z, pts: a.pts.map((p, j) => [p[0] + (b.pts[j]![0] - p[0]) * t, p[1] + (b.pts[j]![1] - p[1]) * t] as Pt) });
  }
  return out;
}

/** Ce que décide la matière d'une face de la caisse : son rang de tronçon et l'avance (z) du milieu de la face. */
export type FiniTole = (rang: number, z: number) => Fini;

/**
 * La caisse lissée : les sections (déjà interpolées, resserrées aux bouts, coupées aux limites des vitres) reliées deux à deux, un demi-profil et son miroir,
 * les coins arrondis ; chaque face prend la matière de `fini` et le groupe de lissage de sa matière (la peinture ne se moyenne pas avec la vitre). Les deux
 * bouts sont fermés d'un éventail, à facettes (la face arrière, le museau : des surfaces presque planes).
 */
export function caisseTole(p: Pieces, sections: readonly Cle[], rayons: readonly number[], finesse: number, fini: FiniTole, bouts?: { arriere: Fini; avant: Fini }): Coque {
  const etapes = etapesDesCoins(sections, rayons, finesse);
  const prof = sections.map((s) => arrondirProfil(s.pts, rayons, etapes));
  const segs = prof[0]!.seg;
  const groupes = new Map<Fini, Fini>();
  const groupeDe = (f: Fini): Fini => {
    let g = groupes.get(f);
    if (!g) groupes.set(f, (g = { ...f, groupe: 2 + groupes.size + 100 }));
    return g;
  };
  for (let s = 0; s + 1 < sections.length; s++) {
    const za = sections[s]!.z;
    const zb = sections[s + 1]!.z;
    const A = prof[s]!.pts;
    const B = prof[s + 1]!.pts;
    for (let i = 0; i + 1 < A.length; i++) {
      const f = groupeDe(fini(segs[i]!, (za + zb) / 2));
      for (const m of [1, -1]) {
        const a: V3 = [A[i]![0] * m, A[i]![1], za];
        const b: V3 = [A[i + 1]![0] * m, A[i + 1]![1], za];
        const c: V3 = [B[i + 1]![0] * m, B[i + 1]![1], zb];
        const d: V3 = [B[i]![0] * m, B[i]![1], zb];
        if (m > 0) p.quad(a, b, c, d, f);
        else p.quad(a, d, c, b, f);
      }
    }
  }
  if (!bouts) return coqueDe(sections, prof);
  const fermer = (k: number, f: Fini, avant: boolean) => {
    const pts = prof[k]!.pts;
    const z = sections[k]!.z;
    const cy = pts.reduce((t, q) => t + q[1], 0) / pts.length;
    const centre: V3 = [0, cy, z];
    for (let i = 0; i + 1 < pts.length; i++) {
      for (const m of [1, -1]) {
        const a: V3 = [pts[i]![0] * m, pts[i]![1], z];
        const b: V3 = [pts[i + 1]![0] * m, pts[i + 1]![1], z];
        if (m > 0 === avant) p.tri(centre, a, b, f);
        else p.tri(centre, b, a, f);
      }
    }
  };
  fermer(0, bouts.arriere, false);
  fermer(sections.length - 1, bouts.avant, true);
  return coqueDe(sections, prof);
}

// --- La coque : de quoi poser des optiques qui épousent le bout de la caisse ----------------------------------------------------------------------

/**
 * Ce qu'on sait de la surface de la caisse (lot 40c) : un **ruban** qui suit le bout de la caisse, à plat sur la face puis autour du coin arrondi. C'est ainsi que
 * les phares et les feux épousent la caisse (au lieu d'être des boîtes qui flottent dans un coin arrondi).
 */
export interface Coque {
  /**
   * Une bande entre les hauteurs `y0` et `y1`, de `x0` (|x|, sur la face plate du bout) jusqu'à `coin` sections de coin plus loin, décollée de `decalage` m ;
   * `bout` : +1 l'avant, −1 l'arrière. Les deux côtés. `largeurMax` ôte ce qui dépasse |x| > largeurMax (la limite de la pièce autour du coin).
   */
  ruban(p: Pieces, bout: 1 | -1, y0: number, y1: number, x0: number, coin: number, decalage: number, f: Fini, largeurMax?: number): void;
  /** La demi-largeur du bout à la hauteur `y` (face plate), et la position z du bout. */
  bout(bout: 1 | -1, y: number): { x: number; z: number };
}

/** La plus grande demi-largeur d'un profil à la hauteur y (la paroi extérieure, montante) ; `NaN` si le profil ne la croise pas. */
function largeurA(pts: readonly Pt[], y: number): number {
  let best = NaN;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [xa, ya] = pts[i]!;
    const [xb, yb] = pts[i + 1]!;
    if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
    const t = (y - ya) / (yb - ya);
    const x = xa + (xb - xa) * t;
    if (!(x <= best)) best = x;
  }
  return best;
}

function coqueDe(sections: readonly Cle[], prof: readonly ProfilArrondi[]): Coque {
  const n = sections.length;
  const chemin = (bout: 1 | -1, y: number, x0: number, coin: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let j = 0; j <= coin + 0; j++) {
      const k = bout < 0 ? j : n - 1 - j;
      const X = largeurA(prof[k]!.pts, y);
      if (Number.isNaN(X)) continue;
      if (j === 0) {
        out.push([Math.min(x0, X), sections[k]!.z]);
        if (X > x0 + 1e-4) out.push([X, sections[k]!.z]);
      } else out.push([X, sections[k]!.z]);
    }
    return out;
  };
  return {
    bout: (bout, y) => {
      const k = bout < 0 ? 0 : n - 1;
      return { x: largeurA(prof[k]!.pts, y), z: sections[k]!.z };
    },
    ruban(p, bout, y0, y1, x0, coin, decalage, f, largeurMax = Infinity) {
      const A = chemin(bout, y0, x0, coin);
      const B = chemin(bout, y1, x0, coin);
      const m = Math.min(A.length, B.length);
      // La normale sortante de chaque point (dans le plan x, z) : la perpendiculaire de la tangente, du côté qui s'éloigne de l'intérieur de la voiture
      // (un point à 0,6 m en retrait du bout, sur l'axe).
      const zRef = A[0]![1] - bout * 0.6;
      const normale = (L: [number, number][], i: number): [number, number] => {
        const a = L[Math.max(0, i - 1)]!;
        const b = L[Math.min(L.length - 1, i + 1)]!;
        let nx = -(b[1] - a[1]);
        let nz = b[0] - a[0];
        const l = Math.hypot(nx, nz) || 1;
        nx /= l;
        nz /= l;
        if (nx * L[i]![0] + nz * (L[i]![1] - zRef) < 0) {
          nx = -nx;
          nz = -nz;
        }
        return [nx, nz];
      };
      for (const s of [1, -1]) {
        const pt = (L: [number, number][], k: number, y: number): V3 => {
          const [nx, nz] = normale(L, k);
          return [(L[k]![0] + nx * decalage) * s, y, L[k]![1] + nz * decalage];
        };
        for (let i = 0; i + 1 < m; i++) {
          if (Math.max(A[i]![0], A[i + 1]![0]) > largeurMax + 1e-6) continue;
          const a = pt(A, i, y0), b = pt(A, i + 1, y0), c = pt(B, i + 1, y1), d = pt(B, i, y1);
          // Face vers l'extérieur : sa normale ((b − a) × (d − a)) a une composante positive le long de la sortie moyenne (plan x, z).
          const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
          const nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
          const mx = (a[0] + b[0]) / 2;
          const mz = (a[2] + b[2]) / 2 - zRef;
          if (nx * mx + nz * mz >= 0) p.quad(a, b, c, d, f);
          else p.quad(a, d, c, b, f);
        }
      }
    },
  };
}

/** Les sections d'une caisse tôle à un palier : interpolées (`n` par clé), bouts arrondis, limites des vitres coupées. */
export function sectionsTole(cles: readonly Cle[], n: number, o: { arriere: number; avant: number; coupes: readonly number[] }): Cle[] {
  const base = interpoler(cles.map(profilTole), n);
  return coupes(boutsArrondis(base, o.arriere, o.avant), o.coupes);
}

// --- Des formes arrondies ----------------------------------------------------------------------------------------------------------------

/** Un ellipsoïde (rétroviseur, poignée, optique bombée) : `nu` segments autour de l'axe y, `nv` anneaux ; lissé dans son propre groupe. */
export function ellipsoide(p: Pieces, c: V3, r: V3, nu: number, nv: number, f: Fini, o: { demi?: "haut" | "bas" | "arriere" | "avant" | "dessus" } = {}): void {
  const g: Fini = { ...f, groupe: p.nouveauGroupe() };
  const P = (a: number, b: number): V3 => {
    // a : longitude (0 à 2π), b : latitude (-π/2 à π/2)
    const cb = Math.cos(b);
    return [c[0] + Math.cos(a) * cb * r[0], c[1] + Math.sin(b) * r[1], c[2] + Math.sin(a) * cb * r[2]];
  };
  for (let j = 0; j < nv; j++) {
    const b0 = -Math.PI / 2 + (j / nv) * Math.PI;
    const b1 = -Math.PI / 2 + ((j + 1) / nv) * Math.PI;
    if (o.demi === "bas" && b0 > 1e-6) continue;
    if (o.demi === "haut" && b1 < -1e-6) continue;
    for (let i = 0; i < nu; i++) {
      const a0 = (i / nu) * Math.PI * 2;
      const a1 = ((i + 1) / nu) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      if (o.demi === "arriere" && Math.sin(mid) > 0) continue; // le côté z < c
      if (o.demi === "avant" && Math.sin(mid) < 0) continue;
      if (o.demi === "dessus" && Math.cos(mid) < 0) continue;
      p.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), g);
    }
  }
}

/** Un tube creux le long de z (échappement) : un tube extérieur, l'intérieur sombre et le fond en retrait. `sens` : +1 pour une sortie vers +z, −1 vers −z. */
export function echappement(p: Pieces, x: number, y: number, z: number, r: number, longueur: number, n: number, dehors: Fini, dedans: Fini, sens: number): void {
  const g: Fini = { ...dehors, groupe: p.nouveauGroupe() };
  const z1 = z + sens * longueur;
  const P = (zz: number, rr: number, t: number): V3 => [x + Math.cos(t) * rr, y + Math.sin(t) * rr, zz];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    const q = (A: V3, B: V3, C: V3, D: V3, f: Fini) => (sens > 0 ? p.quad(A, B, C, D, f) : p.quad(A, D, C, B, f));
    q(P(z, r, a), P(z, r, b), P(z1, r, b), P(z1, r, a), g); // l'extérieur
    q(P(z1, r, a), P(z1, r, b), P(z1, r * 0.78, b), P(z1, r * 0.78, a), g); // la lèvre
    q(P(z1, r * 0.78, a), P(z1, r * 0.78, b), P(z1 - sens * 0.05, r * 0.72, b), P(z1 - sens * 0.05, r * 0.72, a), dedans); // l'intérieur
    if (sens > 0) p.tri([x, y, z1 - sens * 0.05], P(z1 - sens * 0.05, r * 0.72, a), P(z1 - sens * 0.05, r * 0.72, b), dedans);
    else p.tri([x, y, z1 - sens * 0.05], P(z1 - sens * 0.05, r * 0.72, b), P(z1 - sens * 0.05, r * 0.72, a), dedans);
  }
}
