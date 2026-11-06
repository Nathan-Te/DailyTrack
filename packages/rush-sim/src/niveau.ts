import { Rng, mixSeed } from "@cdj/core";
import { M, RAYON_ARENE, cm } from "./constantes";
import { distance, idiv } from "./maths";
import { COS, DIRECTIONS, SIN } from "./trig";

// Le NIVEAU du jour (lot BR1) : une grille de collision de cases de 2 m (sol, mur bas, vide, pont), une suite de clairières reliées par des chemins ou des ponts, le chemin principal du départ à l'arène du golem,
// des détours vers des camps de monstres, quelques monstres épars. **Tout est entier et ne dépend que de la graine** ; la simulation collisionne contre la grille et le rendu construit le décor à partir d'elle.
// La géométrie du plan se fait en centimètres (les produits restent sous 2^53), la grille et la partie en unités (1 m = 4 096).

/** Une case : 2 m. */
export const CASE = 2 * M;
export const SOL = 0;
export const MUR = 1;
export const VIDE = 2;
export const PONT = 3;
/** Les zones (ce que la case EST dans le plan, pour le rendu et les mesures). */
export const Z_VIDE = 0;
export const Z_CLAIRIERE = 1;
export const Z_CHEMIN = 2;
export const Z_PONT = 3;
export const Z_ARENE = 4;
/** La porte de l'arène : les cases du chemin juste devant le bord de l'arène ; la barrière s'y referme. */
export const Z_PORTE = 5;

export type Genre = "depart" | "etape" | "camp" | "arene";
/** Une clairière (petite île ou salle) : centre et rayon en unités. */
export interface Clairiere {
  x: number;
  y: number;
  r: number;
  genre: Genre;
}
/** Un chemin ou un pont entre deux clairières (indices), de demi-largeur `l` (unités). */
export interface Lien {
  a: number;
  b: number;
  pont: boolean;
  l: number;
  /** Vrai pour le chemin principal (du départ à l'arène). */
  principal: boolean;
}
export interface MonstreNiveau {
  /** 0 gelée, 1 chauve-souris (les constantes `GELEE` et `CHAUVE` de la partie). */
  type: number;
  x: number;
  y: number;
  /** L'indice de la clairière du camp, ou −1 (monstre épars sur le chemin principal). */
  camp: number;
}
export interface Detour {
  /** La clairière-camp et la clairière d'où part le détour. */
  camp: number;
  hub: number;
  /** La distance du camp au chemin principal, en centimètres. */
  distanceCm: number;
}

export interface Niveau {
  /** Les cases en largeur et en hauteur ; (ox, oy) : le coin haut gauche de la case (0, 0), en unités. */
  l: number;
  h: number;
  ox: number;
  oy: number;
  /** Le type de chaque case (SOL, MUR, VIDE, PONT), ligne par ligne. */
  cases: Uint8Array;
  /** La zone de chaque case (Z_*). */
  zones: Uint8Array;
  clairieres: Clairiere[];
  liens: Lien[];
  depart: { x: number; y: number; dir: number };
  /** L'arène : son centre, le point où le chemin la touche, la direction (0 à 127) du centre vers l'entrée. */
  arene: { x: number; y: number; ex: number; ey: number; dir: number };
  /** Les indices des cases de la porte (la barrière s'y referme). */
  porte: number[];
  monstres: MonstreNiveau[];
  detours: Detour[];
  /** La longueur du chemin principal, du départ à l'arène, sur la grille (centimètres). */
  longueurCm: number;
  /** Le champ de distance à l'arène (chanfrein 5-7 : 5 par case en ligne, 7 en diagonale) ; 65 535 : inaccessible. */
  dist: Uint16Array;
  /** Les tentatives qu'il a fallu (1 : la première convient). */
  essais: number;
  /** Une empreinte de tout le niveau. */
  empreinte: number;
}

export class ErreurNiveau extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurNiveau";
  }
}

export const INACCESSIBLE = 65535;
/** 1 unité de chanfrein = 2/5 de mètre = 40 cm. */
export const CM_PAR_CHANFREIN = 40;

// --- Les bornes du plan (centimètres) ----------------------------------------------------------------------------------------------------------------------------------------------------------------
export const BORNES_NIVEAU = {
  /** Le chemin principal mesuré sur la grille, du départ au bord de l'arène. */
  longueurMin: 12000,
  longueurMax: 16000,
  detoursMin: 2,
  detoursMax: 4,
  campMin: 4,
  campMax: 8,
  eparsMin: 3,
  eparsMax: 5,
  /** Un détour : le camp est à 20-40 m du chemin principal. */
  detourMin: 2000,
  detourMax: 4000,
  /** Aucun monstre à moins de 22 m du départ. */
  loinDuDepart: 2200,
} as const;

const R_ARENE_CM = idiv(RAYON_ARENE * 100, M); // 1 150
const ECART_MIN = 800;
const DEMI_CHEMIN = 320;
const DEMI_PONT = 220;
const SEL_NIVEAU = 0x51ec;
const MAX_ESSAIS = 400;

const mod128 = (k: number): number => ((k % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
const ecartDir = (a: number, b: number): number => Math.min(mod128(a - b), mod128(b - a));
const dirDe = (dx: number, dy: number): number => {
  let m = 0;
  let max = -Infinity;
  for (let k = 0; k < DIRECTIONS; k++) {
    const p = dx * COS[k]! + dy * SIN[k]!;
    if (p > max) {
      max = p;
      m = k;
    }
  }
  return m;
};

// --- La géométrie du plan (centimètres) --------------------------------------------------------------------------------------------------------------------------------------------------------------
interface Pt {
  x: number;
  y: number;
}
interface Cl {
  x: number;
  y: number;
  r: number;
  genre: Genre;
}
interface Li {
  a: number;
  b: number;
  pont: boolean;
  l: number;
  principal: boolean;
}
interface Plan {
  cl: Cl[];
  li: Li[];
}

function distPtSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const tn = (px - ax) * dx + (py - ay) * dy;
  if (tn <= 0 || l2 === 0) return distance(px, py, ax, ay);
  if (tn >= l2) return distance(px, py, bx, by);
  return distance(px, py, ax + idiv(dx * tn, l2), ay + idiv(dy * tn, l2));
}
const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
function distSegSeg(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (orient(a.x, a.y, b.x, b.y, c.x, c.y) !== orient(a.x, a.y, b.x, b.y, d.x, d.y) && orient(c.x, c.y, d.x, d.y, a.x, a.y) !== orient(c.x, c.y, d.x, d.y, b.x, b.y)) return 0;
  return Math.min(distPtSeg(a.x, a.y, c.x, c.y, d.x, d.y), distPtSeg(b.x, b.y, c.x, c.y, d.x, d.y), distPtSeg(c.x, c.y, a.x, a.y, b.x, b.y), distPtSeg(d.x, d.y, a.x, a.y, b.x, b.y));
}

/** Le plan respecte les écarts : deux éléments qui ne se touchent pas sont à ECART_MIN au moins l'un de l'autre, et deux liens qui partent d'une même clairière s'écartent d'au moins 56°. */
function geometrieValide(p: Plan): boolean {
  const { cl, li } = p;
  for (let i = 0; i < cl.length; i++) {
    for (let j = i + 1; j < cl.length; j++) {
      if (li.some((k) => (k.a === i && k.b === j) || (k.a === j && k.b === i))) continue;
      if (distance(cl[i]!.x, cl[i]!.y, cl[j]!.x, cl[j]!.y) - cl[i]!.r - cl[j]!.r < ECART_MIN) return false;
    }
  }
  for (let k = 0; k < li.length; k++) {
    const L = li[k]!;
    const A = cl[L.a]!;
    const B = cl[L.b]!;
    for (let i = 0; i < cl.length; i++) {
      if (i === L.a || i === L.b) continue;
      if (distPtSeg(cl[i]!.x, cl[i]!.y, A.x, A.y, B.x, B.y) - cl[i]!.r - L.l < ECART_MIN) return false;
    }
    for (let m = k + 1; m < li.length; m++) {
      const N = li[m]!;
      const partage = N.a === L.a || N.a === L.b ? N.a : N.b === L.a || N.b === L.b ? N.b : -1;
      if (partage >= 0) {
        const C = cl[partage]!;
        const autreL = cl[partage === L.a ? L.b : L.a]!;
        const autreN = cl[partage === N.a ? N.b : N.a]!;
        if (ecartDir(dirDe(autreL.x - C.x, autreL.y - C.y), dirDe(autreN.x - C.x, autreN.y - C.y)) < 20) return false;
        continue;
      }
      const C = cl[N.a]!;
      const D = cl[N.b]!;
      if (distSegSeg(A, B, C, D) - L.l - N.l < ECART_MIN) return false;
    }
  }
  return true;
}

/** Le plan : le chemin principal (le départ, deux ou trois étapes, l'arène) et deux à quatre détours vers des camps ; `null` si les écarts ne tiennent pas. */
function tenter(rng: Rng): Plan | null {
  const cl: Cl[] = [];
  const li: Li[] = [];
  const nEtapes = 2 + rng.int(2);
  const nSeg = nEtapes + 1;
  const total = 13800 + rng.int(3000);
  const poids = Array.from({ length: nSeg }, () => 80 + rng.int(60));
  const somme = poids.reduce((a, b) => a + b, 0);
  let h = 96 + rng.int(41) - 20; // vers le haut de l'écran (le nord), à ±56°
  let signe = rng.int(2) === 0 ? 1 : -1;
  let x = 0;
  let y = 0;
  cl.push({ x, y, r: 600 + rng.int(130), genre: "depart" });
  const dirsSortie: number[] = [];
  for (let i = 0; i < nSeg; i++) {
    if (i > 0) {
      if (rng.chance(65)) signe = -signe;
      h += signe * (8 + rng.int(17));
    }
    const L = idiv(total * poids[i]!, somme);
    x += idiv(COS[mod128(h)]! * L, 1024);
    y += idiv(SIN[mod128(h)]! * L, 1024);
    dirsSortie.push(mod128(h));
    const arene = i === nSeg - 1;
    cl.push({ x, y, r: arene ? R_ARENE_CM + 100 : 500 + rng.int(300), genre: arene ? "arene" : "etape" });
    const finale = arene;
    const pont = !finale && rng.chance(35);
    li.push({ a: i, b: i + 1, pont, l: pont ? DEMI_PONT : DEMI_CHEMIN, principal: true });
    // la partie libre entre deux clairières doit permettre un vrai chemin
    if (L - cl[i]!.r - cl[i + 1]!.r < 1000) return null;
  }
  if (!geometrieValide({ cl, li })) return null;

  // Les détours : depuis une clairière du chemin principal (au plus deux chacune), sur un côté, vers un camp à 24-40 m.
  const spine = li.length;
  const hubs = Array.from({ length: nSeg }, (_, i) => i); // le départ et les étapes (pas l'arène)
  const nb = new Array<number>(hubs.length).fill(0);
  const voulus = 2 + rng.int(3);
  const detours: { camp: number; hub: number }[] = [];
  for (let d = 0; d < voulus; d++) {
    let place = false;
    for (let essai = 0; essai < 30 && !place; essai++) {
      const hub = rng.pick(hubs);
      if (nb[hub]! >= 2) continue;
      const s = rng.int(2) === 0 ? 1 : -1;
      const angle = mod128(dirsSortie[hub]! + s * (24 + rng.int(24)));
      const D = 2400 + rng.int(1600);
      const H = cl[hub]!;
      const camp: Cl = { x: H.x + idiv(COS[angle]! * D, 1024), y: H.y + idiv(SIN[angle]! * D, 1024), r: 600 + rng.int(300), genre: "camp" };
      const pont = rng.chance(40);
      cl.push(camp);
      li.push({ a: hub, b: cl.length - 1, pont, l: pont ? DEMI_PONT : DEMI_CHEMIN, principal: false });
      let dMin = Infinity;
      for (let k = 0; k < spine; k++) dMin = Math.min(dMin, distPtSeg(camp.x, camp.y, cl[li[k]!.a]!.x, cl[li[k]!.a]!.y, cl[li[k]!.b]!.x, cl[li[k]!.b]!.y));
      if (dMin >= BORNES_NIVEAU.detourMin && dMin <= BORNES_NIVEAU.detourMax && geometrieValide({ cl, li })) {
        place = true;
        nb[hub]!++;
        detours.push({ camp: cl.length - 1, hub });
      } else {
        cl.pop();
        li.pop();
      }
    }
  }
  if (detours.length < BORNES_NIVEAU.detoursMin) return null;
  return { cl, li };
}

// --- La grille ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const RANG: readonly number[] = [0, 3, 2, 1, 4, 5]; // la priorité d'une zone qui en recouvre une autre (indexée par Z_*)

function construire(plan: Plan, graine: number, rng: Rng, essais: number): Niveau {
  const cl: Clairiere[] = plan.cl.map((c) => ({ x: cm(c.x), y: cm(c.y), r: cm(c.r), genre: c.genre }));
  const li: Lien[] = plan.li.map((k) => ({ a: k.a, b: k.b, pont: k.pont, l: cm(k.l), principal: k.principal }));
  const ar = cl.find((c) => c.genre === "arene")!;
  // L'origine de la grille : l'arène est centrée sur une case, pour que sa taille en cases soit toujours la même.
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const c of cl) {
    minx = Math.min(minx, c.x - c.r);
    miny = Math.min(miny, c.y - c.r);
    maxx = Math.max(maxx, c.x + c.r);
    maxy = Math.max(maxy, c.y + c.r);
  }
  const kx = Math.ceil((ar.x - CASE / 2 - (minx - 4 * CASE)) / CASE);
  const ky = Math.ceil((ar.y - CASE / 2 - (miny - 4 * CASE)) / CASE);
  const ox = ar.x - CASE / 2 - kx * CASE;
  const oy = ar.y - CASE / 2 - ky * CASE;
  const l = Math.ceil((maxx + 4 * CASE - ox) / CASE);
  const h = Math.ceil((maxy + 4 * CASE - oy) / CASE);
  const zones = new Uint8Array(l * h);
  const centre = (i: number): number => ox + i * CASE + CASE / 2;
  const centreY = (j: number): number => oy + j * CASE + CASE / 2;
  const poser = (idx: number, z: number): void => {
    if (RANG[z]! > RANG[zones[idx]!]!) zones[idx] = z;
  };
  const bornes = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => [
    Math.max(0, Math.floor((x0 - ox) / CASE)),
    Math.max(0, Math.floor((y0 - oy) / CASE)),
    Math.min(l - 1, Math.floor((x1 - ox) / CASE)),
    Math.min(h - 1, Math.floor((y1 - oy) / CASE)),
  ];
  for (const k of li) {
    const A = cl[k.a]!;
    const B = cl[k.b]!;
    const [i0, j0, i1, j1] = bornes(Math.min(A.x, B.x) - k.l, Math.min(A.y, B.y) - k.l, Math.max(A.x, B.x) + k.l, Math.max(A.y, B.y) + k.l);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (distPtSegU(centre(i), centreY(j), A.x, A.y, B.x, B.y) <= k.l) poser(j * l + i, k.pont ? Z_PONT : Z_CHEMIN);
  }
  for (const c of cl) {
    const r = c.genre === "arene" ? RAYON_ARENE : c.r;
    const [i0, j0, i1, j1] = bornes(c.x - r, c.y - r, c.x + r, c.y + r);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (distance(centre(i), centreY(j), c.x, c.y) <= r) poser(j * l + i, c.genre === "arene" ? Z_ARENE : Z_CLAIRIERE);
      }
    }
  }
  // La porte : les cases du dernier lien du chemin principal juste au-delà du bord de l'arène.
  const porte: number[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < l; i++) {
      const idx = j * l + i;
      if (zones[idx] !== Z_CHEMIN) continue;
      const d = distance(centre(i), centreY(j), ar.x, ar.y);
      if (d > RAYON_ARENE && d <= RAYON_ARENE + CASE) {
        // seulement les cases du lien qui entre dans l'arène
        const dernier = li.find((k) => k.b === cl.indexOf(ar))!;
        const A = cl[dernier.a]!;
        if (distPtSegU(centre(i), centreY(j), A.x, A.y, ar.x, ar.y) <= dernier.l) {
          zones[idx] = Z_PORTE;
          porte.push(idx);
        }
      }
    }
  }
  const marchableZ = (z: number): boolean => z === Z_CLAIRIERE || z === Z_CHEMIN || z === Z_ARENE || z === Z_PORTE || z === Z_PONT;
  const cases = new Uint8Array(l * h).fill(VIDE);
  for (let k = 0; k < cases.length; k++) if (marchableZ(zones[k]!)) cases[k] = zones[k] === Z_PONT ? PONT : SOL;
  // Les bords : un mur bas (haie, rochers, muret) le long des chemins et de l'arène, un bord d'île (vide) le long des ponts, un mélange autour des clairières.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < l; i++) {
      if (cases[j * l + i] !== VIDE) continue;
      let pont = false;
      let mur = false;
      let clair = false;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= l || jj >= h) continue;
          const z = zones[jj * l + ii]!;
          if (z === Z_PONT) pont = true;
          else if (z === Z_CHEMIN || z === Z_ARENE || z === Z_PORTE) mur = true;
          else if (z === Z_CLAIRIERE) clair = true;
        }
      }
      if (pont) continue;
      if (mur) cases[j * l + i] = MUR;
      else if (clair && mixSeed((i >> 1) * 977 + (j >> 1), graine) % 100 < 45) cases[j * l + i] = MUR;
    }
  }
  // Des rochers isolés dans les clairières (jamais contre un chemin ni contre un autre rocher : le passage reste libre).
  const libres8 = (i: number, j: number): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (zones[(j + dj) * l + i + di] !== Z_CLAIRIERE || cases[(j + dj) * l + i + di] !== SOL) return false;
    return true;
  };
  cl.forEach((c, ci) => {
    if (c.genre === "arene") return;
    const cand: number[] = [];
    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < l - 1; i++) {
        if (zones[j * l + i] === Z_CLAIRIERE && distance(centre(i), centreY(j), c.x, c.y) <= c.r && distance(centre(i), centreY(j), c.x, c.y) >= CASE * 1.2 && libres8(i, j) && nearestClair(cl, centre(i), centreY(j)) === ci) cand.push(j * l + i);
      }
    }
    const n = c.genre === "camp" ? 1 + rng.int(3) : rng.int(3);
    for (let t = 0; t < n && cand.length > 0; t++) {
      const p = rng.int(cand.length);
      const idx = cand[p]!;
      cand.splice(p, 1);
      if (libres8(idx % l, Math.floor(idx / l))) cases[idx] = MUR;
    }
  });
  // Les monstres.
  const monstres: MonstreNiveau[] = [];
  const departC = cl[0]!;
  const libreAutour = (i: number, j: number): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (cases[(j + dj) * l + i + di] !== SOL) return false;
    return true;
  };
  const place = (x: number, y: number): boolean => {
    const i = Math.floor((x - ox) / CASE);
    const j = Math.floor((y - oy) / CASE);
    return i > 0 && j > 0 && i < l - 1 && j < h - 1 && libreAutour(i, j) && zones[j * l + i] !== Z_ARENE && zones[j * l + i] !== Z_PORTE;
  };
  const loin = (x: number, y: number, d: number): boolean => monstres.every((m) => distance(m.x, m.y, x, y) >= d);
  cl.forEach((c, ci) => {
    if (c.genre !== "camp") return;
    const n = BORNES_NIVEAU.campMin + rng.int(BORNES_NIVEAU.campMax - BORNES_NIVEAU.campMin + 1);
    let mis = 0;
    for (let t = 0; t < 300 && mis < n; t++) {
      const a = rng.int(DIRECTIONS);
      const r = rng.int(idiv(c.r * 7, 10));
      const x = c.x + idiv(COS[a]! * r, 1024);
      const y = c.y + idiv(SIN[a]! * r, 1024);
      if (!place(x, y) || !loin(x, y, cm(140))) continue;
      monstres.push({ type: rng.int(100) < 60 ? 0 : 1, x, y, camp: ci });
      mis++;
    }
  });
  const nEpars = BORNES_NIVEAU.eparsMin + rng.int(BORNES_NIVEAU.eparsMax - BORNES_NIVEAU.eparsMin + 1);
  const principaux = li.filter((k) => k.principal);
  for (let t = 0, mis = 0; t < 600 && mis < nEpars; t++) {
    // sur un lien du chemin principal ou dans une étape
    let x: number;
    let y: number;
    if (rng.int(100) < 55) {
      const k = principaux[rng.int(principaux.length)]!;
      const A = cl[k.a]!;
      const B = cl[k.b]!;
      const u = 15 + rng.int(71);
      const [nx, ny] = [-(B.y - A.y), B.x - A.x];
      const nl = Math.max(1, distance(0, 0, nx, ny));
      const dec = rng.int(2 * k.l - cm(250)) - k.l + cm(125);
      x = A.x + idiv((B.x - A.x) * u, 100) + idiv(nx * dec, nl);
      y = A.y + idiv((B.y - A.y) * u, 100) + idiv(ny * dec, nl);
    } else {
      const etapes = cl.filter((c) => c.genre === "etape");
      const c = etapes[rng.int(etapes.length)]!;
      const a = rng.int(DIRECTIONS);
      const r = rng.int(idiv(c.r * 6, 10));
      x = c.x + idiv(COS[a]! * r, 1024);
      y = c.y + idiv(SIN[a]! * r, 1024);
    }
    if (!place(x, y) || !loin(x, y, cm(600))) continue;
    if (distance(x, y, departC.x, departC.y) < cm(BORNES_NIVEAU.loinDuDepart)) continue;
    if (distance(x, y, ar.x, ar.y) < cm(1900)) continue;
    monstres.push({ type: rng.int(100) < 70 ? 0 : 1, x, y, camp: -1 });
    mis++;
  }
  // L'entrée de l'arène : le point où l'axe du dernier lien touche le bord.
  const arIdx = cl.indexOf(ar);
  const dernier = li.find((k) => k.b === arIdx)!;
  const avant = cl[dernier.a]!;
  const dirEntree = dirDe(avant.x - ar.x, avant.y - ar.y);
  const arene = { x: ar.x, y: ar.y, ex: ar.x + idiv(COS[dirEntree]! * RAYON_ARENE, 1024), ey: ar.y + idiv(SIN[dirEntree]! * RAYON_ARENE, 1024), dir: dirEntree };
  const premier = li.find((k) => k.a === 0 && k.principal)!;
  const depart = { x: departC.x, y: departC.y, dir: dirDe(cl[premier.b]!.x - departC.x, cl[premier.b]!.y - departC.y) };
  // Le champ de distance à l'arène.
  const sources: number[] = [];
  for (let k = 0; k < zones.length; k++) if (zones[k] === Z_ARENE) sources.push(k);
  const dist = champDeDistance({ l, h, cases } as Pick<Niveau, "l" | "h" | "cases">, sources);
  const si = Math.floor((depart.x - ox) / CASE);
  const sj = Math.floor((depart.y - oy) / CASE);
  const dd = dist[sj * l + si]!;
  // Les détours : la distance de chaque camp au chemin principal.
  const detours: Detour[] = [];
  cl.forEach((c, ci) => {
    if (c.genre !== "camp") return;
    const lien = li.find((k) => k.b === ci)!;
    let dMin = Infinity;
    for (const k of principaux) dMin = Math.min(dMin, distPtSegU(c.x, c.y, cl[k.a]!.x, cl[k.a]!.y, cl[k.b]!.x, cl[k.b]!.y));
    detours.push({ camp: ci, hub: lien.a, distanceCm: idiv(dMin * 100, M) });
  });
  const n: Niveau = { l, h, ox, oy, cases, zones, clairieres: cl, liens: li, depart, arene, porte, monstres, detours, longueurCm: dd === INACCESSIBLE ? 0 : dd * CM_PAR_CHANFREIN, dist, essais, empreinte: 0 };
  n.empreinte = empreinteNiveau(n);
  return n;
}

function nearestClair(cl: readonly Clairiere[], x: number, y: number): number {
  let m = -1;
  let dm = Infinity;
  cl.forEach((c, i) => {
    const d = distance(x, y, c.x, c.y);
    if (d < dm) {
      dm = d;
      m = i;
    }
  });
  return m;
}

/** Distance d'un point à un segment, en unités (les produits de 1e6 unités dépassent 2^53 : on projette en deux temps). */
function distPtSegU(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return distance(px, py, ax, ay);
  const tn = (px - ax) * dx + (py - ay) * dy; // < 1e12 : exact
  if (tn <= 0) return distance(px, py, ax, ay);
  if (tn >= l2) return distance(px, py, bx, by);
  // t = tn / l2 en millionièmes (entier), puis la projection : tous les produits restent sous 2^53
  const t = idiv(tn * 1024, l2);
  return distance(px, py, ax + idiv(dx * t, 1024), ay + idiv(dy * t, 1024));
}

// --- Le champ de distance ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const marchable = (c: number): boolean => c === SOL || c === PONT;

/** Le champ de distance (chanfrein 5-7) des cases `sources` (distance 0) vers toutes les cases marchables ; une diagonale ne coupe jamais un angle de mur. */
export function champDeDistance(n: Pick<Niveau, "l" | "h" | "cases">, sources: readonly number[]): Uint16Array {
  const { l, h, cases } = n;
  const d = new Uint16Array(l * h).fill(INACCESSIBLE);
  const seaux: number[][] = [];
  const mettre = (idx: number, v: number): void => {
    (seaux[v] ??= []).push(idx);
  };
  for (const s of sources) {
    d[s] = 0;
    mettre(s, 0);
  }
  for (let v = 0; v < seaux.length; v++) {
    const seau = seaux[v];
    if (!seau) continue;
    for (let q = 0; q < seau.length; q++) {
      const idx = seau[q]!;
      if (d[idx] !== v) continue;
      const i = idx % l;
      const j = (idx - i) / l;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= l || jj >= h) continue;
          const k = jj * l + ii;
          if (!marchable(cases[k]!)) continue;
          if (di !== 0 && dj !== 0 && (!marchable(cases[j * l + ii]!) || !marchable(cases[jj * l + i]!))) continue;
          const nv = v + (di !== 0 && dj !== 0 ? 7 : 5);
          if (nv < d[k]!) {
            d[k] = nv;
            mettre(k, nv);
          }
        }
      }
    }
  }
  return d;
}

/** L'indice de la case qui contient le point, ou −1 hors de la grille. */
export function caseDe(n: Pick<Niveau, "l" | "h" | "ox" | "oy">, x: number, y: number): number {
  const i = Math.floor((x - n.ox) / CASE);
  const j = Math.floor((y - n.oy) / CASE);
  return i < 0 || j < 0 || i >= n.l || j >= n.h ? -1 : j * n.l + i;
}
/** Le centre d'une case, en unités. */
export function centreDeCase(n: Pick<Niveau, "l" | "ox" | "oy">, idx: number): [number, number] {
  const i = idx % n.l;
  return [n.ox + i * CASE + CASE / 2, n.oy + ((idx - i) / n.l) * CASE + CASE / 2];
}

/** La case voisine qui descend le champ `champ` le plus vite depuis la case `idx` (la diagonale ne coupe jamais un angle de mur), ou −1 si on y est déjà. */
export function descendre(n: Pick<Niveau, "l" | "h" | "cases">, champ: Uint16Array, idx: number): number {
  const { l, h, cases } = n;
  const i = idx % l;
  const j = (idx - i) / l;
  let meilleur = -1;
  let mv = champ[idx]!;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      if (di === 0 && dj === 0) continue;
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= l || jj >= h) continue;
      const k = jj * l + ii;
      if (!marchable(cases[k]!)) continue;
      if (di !== 0 && dj !== 0 && (!marchable(cases[j * l + ii]!) || !marchable(cases[jj * l + i]!))) continue;
      if (champ[k]! < mv) {
        mv = champ[k]!;
        meilleur = k;
      }
    }
  }
  return meilleur;
}

/** Le point à ~`pas` cases devant, le long du chemin le plus court vers la source du champ (la flèche « BOSS → » du HUD le lit). */
export function pointDevant(n: Pick<Niveau, "l" | "h" | "cases" | "ox" | "oy">, champ: Uint16Array, x: number, y: number, pas: number): [number, number] | null {
  let idx = caseDe(n, x, y);
  if (idx < 0) return null;
  for (let k = 0; k < pas; k++) {
    const s = descendre(n, champ, idx);
    if (s < 0) break;
    idx = s;
  }
  return centreDeCase(n, idx);
}

export function empreinteNiveau(n: Niveau): number {
  let h = 0x811c9dc5;
  const octet = (b: number): void => {
    h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0;
  };
  const nombre = (v: number): void => {
    octet(v);
    octet(v >> 8);
    octet(v >> 16);
    octet(v >> 24);
  };
  for (const v of [n.l, n.h, n.ox, n.oy, n.depart.x, n.depart.y, n.arene.x, n.arene.y]) nombre(v);
  for (const c of n.cases) octet(c);
  for (const m of n.monstres) for (const v of [m.type, m.x, m.y, m.camp]) nombre(v);
  return h;
}

/** Le nombre de cases de l'arène (toujours le même : l'arène est centrée sur une case). */
export function casesDeLArene(n: Pick<Niveau, "zones">): number {
  let k = 0;
  for (const z of n.zones) if (z === Z_ARENE) k++;
  return k;
}

/** Ce qui ne va pas dans un niveau (liste vide : il est valide). Les mêmes règles servent au générateur (il retente) et aux tests (365 graines). */
export function problemesDuNiveau(n: Niveau): string[] {
  const p: string[] = [];
  const B = BORNES_NIVEAU;
  const si = caseDe(n, n.depart.x, n.depart.y);
  if (si < 0 || n.dist[si] === INACCESSIBLE) p.push("le chemin du départ à l'arène n'existe pas");
  else if (n.longueurCm < B.longueurMin || n.longueurCm > B.longueurMax) p.push(`chemin principal de ${n.longueurCm} cm`);
  if (n.detours.length < B.detoursMin || n.detours.length > B.detoursMax) p.push(`${n.detours.length} détours`);
  for (const d of n.detours) {
    if (d.distanceCm < B.detourMin || d.distanceCm > B.detourMax) p.push(`détour à ${d.distanceCm} cm du chemin`);
    const k = n.monstres.filter((m) => m.camp === d.camp).length;
    if (k < B.campMin || k > B.campMax) p.push(`camp de ${k} monstres`);
  }
  const epars = n.monstres.filter((m) => m.camp < 0).length;
  if (epars < B.eparsMin || epars > B.eparsMax) p.push(`${epars} monstres épars`);
  if (n.monstres.length > 40) p.push("trop de monstres");
  for (let k = 0; k < n.cases.length; k++) if (marchable(n.cases[k]!) && n.dist[k] === INACCESSIBLE) p.push("case accessible isolée");
  const loin = cm(B.loinDuDepart);
  for (const m of n.monstres) {
    const c = caseDe(n, m.x, m.y);
    if (c < 0 || n.cases[c] !== SOL) p.push("monstre hors du sol");
    if (m.camp < 0 && distance(m.x, m.y, n.depart.x, n.depart.y) < loin) p.push("monstre près du départ");
    if (distance(m.x, m.y, n.depart.x, n.depart.y) < cm(1500)) p.push("monstre trop près du départ");
  }
  if (n.porte.length < 2) p.push("porte trop étroite");
  return [...new Set(p)];
}

/** Le niveau d'une graine : tente des plans jusqu'à en trouver un valide (les tentatives sont tirées de la graine : même résultat partout). */
export function genererNiveau(graine: number): Niveau {
  for (let essai = 0; essai < MAX_ESSAIS; essai++) {
    const rng = new Rng(mixSeed(graine, SEL_NIVEAU + essai));
    const plan = tenter(rng);
    if (!plan) continue;
    const n = construire(plan, graine, rng, essai + 1);
    if (problemesDuNiveau(n).length === 0) return n;
  }
  throw new ErreurNiveau(`aucun niveau valide pour la graine ${graine}`);
}
