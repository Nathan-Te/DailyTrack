import { Rng, mixSeed } from "@cdj/core";
import { M, RAYON_ARENE, cm } from "./constantes";
import { distance, idiv, unitaire } from "./maths";
import { REGLAGES_DEFAUT } from "./reglagesSim";
import { COS, DIRECTIONS, SIN } from "./trig";

// Le NIVEAU du jour (lot BR1) : une grille de collision de cases de 2 m (sol, mur bas, vide, pont), une suite de clairières reliées par des chemins ou des ponts, le chemin principal du départ à l'arène du golem,
// des détours vers des camps de monstres, quelques monstres épars. **Tout est entier et ne dépend que de la graine** ; la simulation collisionne contre la grille et le rendu construit le décor à partir d'elle.
// La géométrie du plan se fait en centimètres (les produits restent sous 2^53), la grille et la partie en unités (1 m = 4 096).
// Lot BR1b : un niveau PLUS COMPACT (chemin principal de 70 à 100 m), une rencontre tous les 15 à 20 m (des GROUPES de 2 à 4 monstres à l'alerte large, des OBSTACLES cassables qui barrent le chemin, quelques épars), une règle de
// DENSITÉ (jamais plus de ~4 s de course sans rencontre : `problemesDuNiveau`) et des détours EN BOUCLE (le camp rejoint le chemin principal plus loin au lieu de finir en cul-de-sac).

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
  /** L'indice de la clairière du camp, ou −1 (monstre du chemin principal : épars ou membre d'un groupe). */
  camp: number;
  /** Lot BR1b : l'indice du groupe qui barre le chemin (2 à 4 monstres), ou −1 (camp, épars). */
  groupe: number;
  /** Lot BR1b : son rayon d'alerte en unités (10 à 12 m pour un groupe), ou 0 : celui de son type (`ALERTE_GELEE`, `ALERTE_CHAUVE`). */
  alerte: number;
}
export interface Detour {
  /** La clairière-camp et la clairière d'où part le détour. */
  camp: number;
  hub: number;
  /** Lot BR1b : la clairière du chemin principal où le détour REVIENT, plus loin (une boucle), ou −1 (cul-de-sac). */
  hub2: number;
  /** La distance du camp au chemin principal, en centimètres. */
  distanceCm: number;
}

/** Lot BR1b : un obstacle cassable (ronces : 1 coup, caisses : 2 coups) qui barre une partie du chemin principal. */
export const OBSTACLE_RONCES = 0;
export const OBSTACLE_CAISSES = 1;
export interface ObstacleNiveau {
  genre: number;
  /** Le centre et le rayon (unités) : ce que le coup du chevalier touche. */
  x: number;
  y: number;
  r: number;
  /** Les coups qu'il faut pour le briser (1 ou 2 ; le coup final en vaut 2). */
  coups: number;
  /** Les cases qu'il occupe (elles redeviennent libres quand il cède). */
  cases: number[];
  /** Ce qu'il contient (lot BR2 y mettra des gemmes) : 0, rien. L'emplacement est prévu dans la simulation ; ce lot n'y met rien. */
  butin: number;
  /** Un passage libre (plus étroit) le contourne-t-il ? */
  contournable: boolean;
  /** De combien le contournement allonge le chemin, en centimètres (0 s'il n'y en a pas). */
  surcoutCm: number;
}
/** Lot BR1b : une rencontre du chemin principal, à l'abscisse `s` (centimètres depuis le départ) et de portée `portee` de part et d'autre (l'alerte d'un groupe ou d'un monstre, l'obstacle). */
export interface Rencontre {
  genre: "groupe" | "epars" | "obstacle";
  s: number;
  portee: number;
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
  /** Lot BR1b : les obstacles cassables du chemin principal. */
  obstacles: ObstacleNiveau[];
  /** Lot BR1b : les rencontres du chemin principal, dans l'ordre, et le plus long tronçon sans rencontre (centimètres ; `tempsSansRencontre` le met en secondes de course). */
  rencontres: Rencontre[];
  sansRencontreCm: number;
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
  /** Le chemin principal mesuré sur la grille, du départ au bord de l'arène (lot BR1b : 70 à 100 m ; 120 à 160 m au BR1). */
  longueurMin: 7000,
  longueurMax: 10000,
  detoursMin: 2,
  detoursMax: 4,
  campMin: 8,
  campMax: 11,
  /** Les monstres épars du chemin principal (hors groupes). */
  eparsMin: 0,
  eparsMax: 3,
  /** Les groupes qui barrent le chemin : 2 à 4 groupes de 2 à 4 monstres, l'alerte de 10 à 12 m. */
  groupesMin: 2,
  groupesMax: 4,
  groupeTailleMin: 2,
  groupeTailleMax: 4,
  groupeAlerteMin: 1000,
  groupeAlerteMax: 1200,
  /** Les obstacles cassables du chemin principal. */
  obstaclesMin: 1,
  obstaclesMax: 3,
  /** Un détour : le camp est à 17-85 m du chemin principal (20-40 m au BR1). */
  detourMin: 1700,
  detourMax: 8500,
  /** Aucun monstre du chemin à moins de 16 m du départ. */
  loinDuDepart: 1600,
  /** La règle de densité : au plus 3 000 cm de chemin sans rencontre, soit ~4 s de course (7,49 m/s). */
  sansRencontreMax: 3000,
  /** Au plus autant de monstres dans tout le niveau. */
  monstresMax: 50,
} as const;

/** La vitesse de course du pilote et du joueur par défaut, en cm/s (468 × 1,6) : la règle de densité la lit. */
export const VITESSE_COURSE_CM_S = (REGLAGES_DEFAUT.vitesse * REGLAGES_DEFAUT.courseFacteur) / 100;
/** Le plus long tronçon de chemin sans rencontre d'un niveau, en secondes de course. */
export const tempsSansRencontre = (n: Pick<Niveau, "sansRencontreCm">): number => n.sansRencontreCm / VITESSE_COURSE_CM_S;

const R_ARENE_CM = idiv(RAYON_ARENE * 100, M); // 1 150
const ECART_MIN = 800;
/** L'écart minimal (en directions de 2,8°) entre deux liens d'une même clairière : 56° ; 22° au camp d'une boucle (ses deux liens s'écartent moins). */
const ANGLE_MIN = 20;
const ANGLE_CAMP = 8;
const DEMI_CHEMIN = 320;
const DEMI_PONT = 220;
const SEL_NIVEAU = 0x51ec;
const MAX_ESSAIS = 4000;

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
/** Un détour du plan : la clairière-camp, le départ du détour et, pour une boucle, la clairière du chemin principal où il revient. */
interface DetourPlan {
  camp: number;
  hub: number;
  hub2: number;
}
/** Une rencontre du plan : à l'abscisse `s` du chemin principal (centimètres depuis le centre du départ). `alerte` : le rayon d'alerte d'un groupe (centimètres). */
interface RencontrePlan {
  genre: "groupe" | "epars" | "obstacle";
  s: number;
  alerte: number;
  taille: number;
}
interface Plan {
  cl: Cl[];
  li: Li[];
  detours: DetourPlan[];
  rencontres: RencontrePlan[];
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
function geometrieValide(p: { cl: Cl[]; li: Li[] }): boolean {
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
        if (ecartDir(dirDe(autreL.x - C.x, autreL.y - C.y), dirDe(autreN.x - C.x, autreN.y - C.y)) < (C.genre === "camp" ? ANGLE_CAMP : ANGLE_MIN)) return false;
        continue;
      }
      const C = cl[N.a]!;
      const D = cl[N.b]!;
      if (distSegSeg(A, B, C, D) - L.l - N.l < ECART_MIN) return false;
    }
  }
  return true;
}

/** Le point du chemin principal à l'abscisse `s` (centimètres depuis le centre du départ), l'axe du lien qui le porte (vecteur de 1 024) et le lien (indice dans `li`). */
function pointDuChemin(cl: readonly Cl[], li: readonly Li[], s: number): { x: number; y: number; ux: number; uy: number; lien: number } {
  let reste = s;
  for (let k = 0; k < li.length; k++) {
    const L = li[k]!;
    if (!L.principal) continue;
    const A = cl[L.a]!;
    const B = cl[L.b]!;
    const len = distance(A.x, A.y, B.x, B.y);
    if (reste <= len || k === li.length - 1 || !li[k + 1]!.principal) {
      const [ux, uy] = unitaire(B.x - A.x, B.y - A.y);
      const t = Math.min(Math.max(reste, 0), len);
      return { x: A.x + idiv(ux * t, 1024), y: A.y + idiv(uy * t, 1024), ux, uy, lien: k };
    }
    reste -= len;
  }
  throw new ErreurNiveau("abscisse hors du chemin principal");
}

/** Le plus long tronçon sans rencontre (centimètres) : les zones des rencontres (abscisse ± portée) triées, le départ à 0 et le bord de l'arène à `fin`. */
function plusLongTroncon(zones: readonly { s: number; portee: number }[], fin: number): { max: number; milieu: number } {
  const tri = [...zones].sort((a, b) => a.s - a.portee - (b.s - b.portee));
  let bout = 0;
  let max = 0;
  let milieu = 0;
  for (const z of tri) {
    const debut = z.s - z.portee;
    if (debut - bout > max) {
      max = debut - bout;
      milieu = bout + idiv(debut - bout, 2);
    }
    bout = Math.max(bout, z.s + z.portee);
  }
  if (fin - bout > max) {
    max = fin - bout;
    milieu = bout + idiv(fin - bout, 2);
  }
  return { max, milieu };
}
const PORTEE_OBSTACLE = 250;
const PORTEE_EPARS = 850;

/** Le plan : le chemin principal (le départ, deux ou trois étapes, l'arène), ses rencontres (groupes, obstacles, épars) et deux à quatre détours vers des camps, de préférence EN BOUCLE ; `null` si les écarts ou la densité ne tiennent pas. */
function tenter(rng: Rng): Plan | null {
  const cl: Cl[] = [];
  const li: Li[] = [];
  const nEtapes = 2 + rng.int(2);
  const nSeg = nEtapes + 1;
  const total = 7900 + rng.int(1700);
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
    cl.push({ x, y, r: arene ? R_ARENE_CM + 100 : 450 + rng.int(250), genre: arene ? "arene" : "etape" });
    const finale = arene;
    const pont = !finale && rng.chance(30);
    li.push({ a: i, b: i + 1, pont, l: pont ? DEMI_PONT : DEMI_CHEMIN, principal: true });
    // la partie libre entre deux clairières doit permettre un vrai chemin
    if (L - cl[i]!.r - cl[i + 1]!.r < 1000) return null;
  }
  if (!geometrieValide({ cl, li })) return null;

  // --- Les rencontres du chemin principal : une par lien (deux groupes et un obstacle au moins), un second dans les liens longs, quelques épars dans les étapes.
  const cum: number[] = [0];
  for (let i = 0; i < nSeg; i++) cum.push(cum[i]! + distance(cl[i]!.x, cl[i]!.y, cl[i + 1]!.x, cl[i + 1]!.y));
  const fin = cum[nSeg]! - R_ARENE_CM;
  const loin = BORNES_NIVEAU.loinDuDepart + 150;
  const B = BORNES_NIVEAU;
  const genres: ("groupe" | "obstacle")[] = rng.shuffle(nSeg === 3 ? ["groupe", "groupe", "obstacle"] : (["groupe", "groupe", "obstacle", rng.chance(50) ? "groupe" : "obstacle"] as ("groupe" | "obstacle")[]));
  // un obstacle ne barre pas un pont : il passe à un lien de chemin
  for (let k = 0; k < nSeg; k++) {
    if (genres[k] === "obstacle" && li[k]!.pont) {
      const j = genres.findIndex((g, q) => g === "groupe" && !li[q]!.pont);
      if (j < 0) {
        genres[k] = "groupe";
      } else {
        genres[j] = "obstacle";
        genres[k] = "groupe";
      }
    }
  }
  const rencontres: RencontrePlan[] = [];
  const alerteGroupe = (): number => B.groupeAlerteMin + rng.int(B.groupeAlerteMax - B.groupeAlerteMin + 1);
  const groupeTaille = (): number => B.groupeTailleMin + rng.int(B.groupeTailleMax - B.groupeTailleMin + 1);
  for (let k = 0; k < nSeg; k++) {
    const lo = Math.max(cum[k]! + cl[k]!.r + 100, genres[k] === "groupe" ? loin : 0);
    const hi = cum[k + 1]! - cl[k + 1]!.r - 100;
    if (hi - lo < 500) {
      if (genres[k] === "groupe") return null;
      continue;
    }
    const deux = hi - lo > 2200 && rng.chance(30);
    const place = deux ? [25 + rng.int(11), 65 + rng.int(11)] : [38 + rng.int(25)];
    place.forEach((u, q) => {
      const genre = q === 0 ? genres[k]! : rng.pick<"groupe" | "obstacle" | "epars">(["groupe", "obstacle", "epars"]);
      const nGroupes = rencontres.filter((r) => r.genre === "groupe").length;
      const g = genre === "groupe" && nGroupes >= B.groupesMax ? "epars" : genre;
      if (g === "obstacle" && li[k]!.pont) return;
      rencontres.push({ genre: g, s: lo + idiv((hi - lo) * u, 100), alerte: g === "groupe" ? alerteGroupe() : 0, taille: g === "groupe" ? groupeTaille() : 1 });
    });
  }
  // des épars dans les étapes (au plus trois en tout)
  const etapes = rng.shuffle(Array.from({ length: nEtapes }, (_, i) => i + 1));
  let aPoser = rng.int(2);
  for (const e of etapes) {
    if (aPoser === 0) break;
    const sEtape = cum[e]! + rng.int(401) - 200;
    if (sEtape < loin || rencontres.some((r) => Math.abs(r.s - sEtape) < 800)) continue;
    rencontres.push({ genre: "epars", s: sEtape, alerte: 0, taille: 1 });
    aPoser--;
  }
  // la règle de densité : on ajoute un monstre épars au milieu du plus long tronçon tant qu'il dépasse 4 s de course
  for (let essai = 0; essai < 4; essai++) {
    const t = plusLongTroncon(rencontres.map((r) => ({ s: r.s, portee: r.genre === "groupe" ? r.alerte : r.genre === "obstacle" ? PORTEE_OBSTACLE : PORTEE_EPARS })), fin);
    if (t.max <= B.sansRencontreMax - 200) break;
    if (t.milieu < loin || rencontres.some((r) => Math.abs(r.s - t.milieu) < 800)) return null;
    rencontres.push({ genre: "epars", s: t.milieu, alerte: 0, taille: 1 });
  }
  const epars = rencontres.filter((r) => r.genre === "epars").length;
  const groupes = rencontres.filter((r) => r.genre === "groupe").length;
  const obstacles = rencontres.filter((r) => r.genre === "obstacle").length;
  if (epars > B.eparsMax || groupes < B.groupesMin || groupes > B.groupesMax || obstacles < B.obstaclesMin || obstacles > B.obstaclesMax) return null;

  // --- Les détours : EN BOUCLE de préférence (le camp est entre deux clairières consécutives du chemin et rejoint la seconde), sinon en cul-de-sac.
  const spine = li.length;
  const nb = new Array<number>(nSeg).fill(0);
  const voulus = rng.int(100) < 20 ? 2 : 3 + rng.int(2);
  const detours: DetourPlan[] = [];
  const dMinChemin = (camp: Cl): number => {
    let dMin = Infinity;
    for (let k = 0; k < spine; k++) dMin = Math.min(dMin, distPtSeg(camp.x, camp.y, cl[li[k]!.a]!.x, cl[li[k]!.a]!.y, cl[li[k]!.b]!.x, cl[li[k]!.b]!.y));
    return dMin;
  };
  for (let d = 0; d < voulus; d++) {
    let place = false;
    for (let essai = 0; essai < 76 && !place; essai++) {
      const boucle = essai < 60;
      const r = 550 + rng.int(300);
      let hub: number;
      let hub2 = -1;
      let camp: Cl;
      if (boucle) {
        hub = rng.int(nEtapes); // le lien (hub, hub + 1) : de la clairière de départ à l'avant-dernière étape
        hub2 = hub + 1;
        if (nb[hub]! >= 3 || nb[hub2]! >= 3) continue;
        const A = cl[hub]!;
        const Bc = cl[hub2]!;
        const longueur = distance(A.x, A.y, Bc.x, Bc.y);
        const u = 44 + rng.int(13);
        const [ux, uy] = unitaire(Bc.x - A.x, Bc.y - A.y);
        const s = rng.int(2) === 0 ? 1 : -1;
        const D = idiv(longueur * (180 + rng.int(61)), 100);
        camp = { x: A.x + idiv(ux * idiv(longueur * u, 100), 1024) + idiv(-uy * s * D, 1024), y: A.y + idiv(uy * idiv(longueur * u, 100), 1024) + idiv(ux * s * D, 1024), r, genre: "camp" };
      } else {
        hub = rng.int(nSeg);
        if (nb[hub]! >= 3) continue;
        const s = rng.int(2) === 0 ? 1 : -1;
        const angle = mod128(dirsSortie[hub]! + s * (24 + rng.int(24)));
        const D = 2300 + rng.int(1100);
        const H = cl[hub]!;
        camp = { x: H.x + idiv(COS[angle]! * D, 1024), y: H.y + idiv(SIN[angle]! * D, 1024), r, genre: "camp" };
      }
      const pont = rng.chance(boucle ? 25 : 40);
      const pont2 = rng.chance(25);
      cl.push(camp);
      const ci = cl.length - 1;
      li.push({ a: hub, b: ci, pont, l: pont ? DEMI_PONT : DEMI_CHEMIN, principal: false });
      if (boucle) li.push({ a: hub2, b: ci, pont: pont2, l: pont2 ? DEMI_PONT : DEMI_CHEMIN, principal: false });
      const dMin = dMinChemin(camp);
      if (dMin >= B.detourMin && dMin <= B.detourMax && geometrieValide({ cl, li })) {
        place = true;
        nb[hub]!++;
        if (boucle) nb[hub2]!++;
        detours.push({ camp: ci, hub, hub2 });
      } else {
        cl.pop();
        li.pop();
        if (boucle) li.pop();
      }
    }
  }
  if (detours.length < B.detoursMin) return null;
  // au moins la moitié des détours rejoignent le chemin principal
  if (detours.filter((q) => q.hub2 >= 0).length * 2 < detours.length) return null;
  return { cl, li, detours, rencontres };
}

// --- La grille ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const RANG: readonly number[] = [0, 3, 2, 1, 4, 5]; // la priorité d'une zone qui en recouvre une autre (indexée par Z_*)

function construire(plan: Plan, graine: number, rng: Rng, essais: number): Niveau | null {
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
  // Le départ, l'arène et le champ de distance (les obstacles et les rencontres s'y mesurent).
  const departC = cl[0]!;
  const arIdx = cl.indexOf(ar);
  const dernier = li.find((k) => k.b === arIdx)!;
  const avant = cl[dernier.a]!;
  const dirEntree = dirDe(avant.x - ar.x, avant.y - ar.y);
  const arene = { x: ar.x, y: ar.y, ex: ar.x + idiv(COS[dirEntree]! * RAYON_ARENE, 1024), ey: ar.y + idiv(SIN[dirEntree]! * RAYON_ARENE, 1024), dir: dirEntree };
  const premier = li.find((k) => k.a === 0 && k.principal)!;
  const depart = { x: departC.x, y: departC.y, dir: dirDe(cl[premier.b]!.x - departC.x, cl[premier.b]!.y - departC.y) };
  const sources: number[] = [];
  for (let k = 0; k < zones.length; k++) if (zones[k] === Z_ARENE) sources.push(k);
  const dist = champDeDistance({ l, h, cases } as Pick<Niveau, "l" | "h" | "cases">, sources);
  const si = Math.floor((depart.x - ox) / CASE);
  const sj = Math.floor((depart.y - oy) / CASE);
  const dd = dist[sj * l + si]!;
  const B = BORNES_NIVEAU;

  // Les cases prises par un obstacle : aucun monstre n'y est posé.
  const occupe = new Set<number>();
  const solLibre = (x: number, y: number): boolean => {
    const i = Math.floor((x - ox) / CASE);
    const j = Math.floor((y - oy) / CASE);
    if (i < 0 || j < 0 || i >= l || j >= h) return false;
    const k = j * l + i;
    return (cases[k] === SOL || cases[k] === PONT) && !occupe.has(k) && zones[k] !== Z_ARENE && zones[k] !== Z_PORTE;
  };
  /** Un disque de rayon `r` tient en (x, y) : les quatre coins de son carré sont sur du sol libre. */
  const tient = (x: number, y: number, r: number): boolean => solLibre(x - r, y - r) && solLibre(x + r, y - r) && solLibre(x - r, y + r) && solLibre(x + r, y + r);

  // Les obstacles cassables du chemin principal (lot BR1b) : un disque de cases du chemin, centré sur l'axe (il barre tout) ou décalé (un passage plus étroit, et plus long, reste d'un côté).
  const obstacles: ObstacleNiveau[] = [];
  const obstacleEn = (px: number, py: number, ux: number, uy: number, lw: number, partiel: boolean): ObstacleNiveau | null => {
    const nx = -uy;
    const ny = ux;
    for (let essai = 0; essai < 9; essai++) {
      const part = partiel && essai < 6;
      const e = part ? (rng.int(2) === 0 ? 1 : -1) * cm(50 + rng.int(110)) : 0;
      const rho = part ? cm(230 + rng.int(70)) : lw + cm(100 + 60 * (essai - (partiel ? 6 : 0)));
      const cx = px + idiv(nx * e, 1024);
      const cy = py + idiv(ny * e, 1024);
      const idxs: number[] = [];
      const [i0, j0, i1, j1] = bornes(cx - rho, cy - rho, cx + rho, cy + rho);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (zones[j * l + i] === Z_CHEMIN && cases[j * l + i] === SOL && !occupe.has(j * l + i) && distance(centre(i), centreY(j), cx, cy) <= rho) idxs.push(j * l + i);
      if (idxs.length < 2) continue;
      const bloque = new Uint8Array(cases);
      for (const k of idxs) bloque[k] = MUR;
      const v = champDeDistance({ l, h, cases: bloque } as Pick<Niveau, "l" | "h" | "cases">, sources)[sj * l + si]!;
      const passe = v !== INACCESSIBLE;
      const surcout = passe ? (v - dd) * CM_PAR_CHANFREIN : 0;
      if (passe && surcout < 120) continue; // un passage trop facile n'est pas un obstacle
      for (const k of idxs) occupe.add(k);
      const ronces = rng.int(100) < 45;
      return { genre: ronces ? OBSTACLE_RONCES : OBSTACLE_CAISSES, x: cx, y: cy, r: rho + cm(80), coups: ronces ? 1 : 2, cases: idxs, butin: 0, contournable: passe, surcoutCm: surcout };
    }
    return null;
  };
  for (const r of plan.rencontres) {
    if (r.genre !== "obstacle") continue;
    const P = pointDuChemin(plan.cl, plan.li, r.s);
    const lien = li[P.lien]!;
    const o = obstacleEn(cm(P.x), cm(P.y), P.ux, P.uy, lien.l, rng.chance(50));
    if (!o) return null;
    obstacles.push(o);
  }

  // Les monstres : les camps d'abord, puis les groupes qui barrent le chemin, puis les épars.
  const monstres: MonstreNiveau[] = [];
  const libreAutour = (i: number, j: number): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (cases[(j + dj) * l + i + di] !== SOL || occupe.has((j + dj) * l + i + di)) return false;
    return true;
  };
  const place = (x: number, y: number): boolean => {
    const i = Math.floor((x - ox) / CASE);
    const j = Math.floor((y - oy) / CASE);
    return i > 0 && j > 0 && i < l - 1 && j < h - 1 && libreAutour(i, j) && zones[j * l + i] !== Z_ARENE && zones[j * l + i] !== Z_PORTE;
  };
  const loin = (x: number, y: number, d: number): boolean => monstres.every((m) => distance(m.x, m.y, x, y) >= d);
  const loinDuDepart = (x: number, y: number): boolean => distance(x, y, departC.x, departC.y) >= cm(B.loinDuDepart);
  plan.detours.forEach((dt) => {
    const c = cl[dt.camp]!;
    const n = B.campMin + rng.int(B.campMax - B.campMin + 1);
    let mis = 0;
    for (let t = 0; t < 300 && mis < n; t++) {
      const a = rng.int(DIRECTIONS);
      const r = rng.int(idiv(c.r * 7, 10));
      const x = c.x + idiv(COS[a]! * r, 1024);
      const y = c.y + idiv(SIN[a]! * r, 1024);
      if (!place(x, y) || !loin(x, y, cm(140))) continue;
      monstres.push({ type: rng.int(100) < 62 ? 0 : 1, x, y, camp: dt.camp, groupe: -1, alerte: 0 });
      mis++;
    }
  });
  // Les groupes : 2 à 4 monstres en travers du chemin, là où il est étroit, avec une alerte large (10 à 12 m).
  let groupe = 0;
  for (const r of plan.rencontres) {
    if (r.genre !== "groupe") continue;
    const P = pointDuChemin(plan.cl, plan.li, r.s);
    const px = cm(P.x);
    const py = cm(P.y);
    let mis = 0;
    for (let i = 0; i < r.taille; i++) {
      for (let t = 0; t < 14; t++) {
        const q = idiv((2 * i - (r.taille - 1)) * cm(160), 2) + (t === 0 ? 0 : rng.int(cm(110)) - cm(55));
        const a = t === 0 ? 0 : rng.int(cm(240)) - cm(120);
        const x = px + idiv(-P.uy * q, 1024) + idiv(P.ux * a, 1024);
        const y = py + idiv(P.ux * q, 1024) + idiv(P.uy * a, 1024);
        if (!tient(x, y, cm(60)) || !loin(x, y, cm(120)) || !loinDuDepart(x, y)) continue;
        monstres.push({ type: rng.int(100) < 70 ? 0 : 1, x, y, camp: -1, groupe, alerte: cm(r.alerte) });
        mis++;
        break;
      }
    }
    if (mis < B.groupeTailleMin) return null;
    groupe++;
  }
  // Les épars : un monstre seul, sur le chemin ou dans une étape.
  for (const r of plan.rencontres) {
    if (r.genre !== "epars") continue;
    const P = pointDuChemin(plan.cl, plan.li, r.s);
    for (let t = 0; t < 14; t++) {
      const q = rng.int(cm(300)) - cm(150);
      const a = rng.int(cm(300)) - cm(150);
      const x = cm(P.x) + idiv(-P.uy * q, 1024) + idiv(P.ux * a, 1024);
      const y = cm(P.y) + idiv(P.ux * q, 1024) + idiv(P.uy * a, 1024);
      if (!tient(x, y, cm(80)) || !loin(x, y, cm(300)) || !loinDuDepart(x, y) || distance(x, y, ar.x, ar.y) < cm(1900)) continue;
      monstres.push({ type: rng.int(100) < 70 ? 0 : 1, x, y, camp: -1, groupe: -1, alerte: 0 });
      break;
    }
  }
  // Les détours : la distance de chaque camp au chemin principal.
  const principaux = li.filter((k) => k.principal);
  const detours: Detour[] = plan.detours.map((dt) => {
    const c = cl[dt.camp]!;
    let dMin = Infinity;
    for (const k of principaux) dMin = Math.min(dMin, distPtSegU(c.x, c.y, cl[k.a]!.x, cl[k.a]!.y, cl[k.b]!.x, cl[k.b]!.y));
    return { camp: dt.camp, hub: dt.hub, hub2: dt.hub2, distanceCm: idiv(dMin * 100, M) };
  });
  const n: Niveau = { l, h, ox, oy, cases, zones, clairieres: cl, liens: li, depart, arene, porte, monstres, detours, obstacles, rencontres: [], sansRencontreCm: 0, longueurCm: dd === INACCESSIBLE ? 0 : dd * CM_PAR_CHANFREIN, dist, essais, empreinte: 0 };
  const r = rencontresDuChemin(n);
  n.rencontres = r.rencontres;
  n.sansRencontreCm = r.sansRencontreCm;
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
  for (const m of n.monstres) for (const v of [m.type, m.x, m.y, m.camp, m.groupe, m.alerte]) nombre(v);
  for (const o of n.obstacles) for (const v of [o.genre, o.x, o.y, o.r, o.coups, o.cases.length, o.butin]) nombre(v);
  for (const d of n.detours) for (const v of [d.camp, d.hub, d.hub2]) nombre(v);
  return h;
}

/** Le nombre de cases de l'arène (toujours le même : l'arène est centrée sur une case). */
export function casesDeLArene(n: Pick<Niveau, "zones">): number {
  let k = 0;
  for (const z of n.zones) if (z === Z_ARENE) k++;
  return k;
}

/**
 * Les rencontres du chemin principal, mesurées SUR LA GRILLE (le champ de distance à l'arène donne l'abscisse de chaque chose : combien de centimètres du départ), et le plus long tronçon sans rencontre.
 * Une rencontre a une portée : l'alerte d'un groupe (10 à 12 m) ou d'un monstre, la taille d'un obstacle ; le tronçon se compte entre la fin d'une portée et le début de la suivante, du départ jusqu'au bord de l'arène.
 */
export function rencontresDuChemin(n: Pick<Niveau, "l" | "h" | "ox" | "oy" | "dist" | "depart" | "monstres" | "obstacles" | "longueurCm">): { rencontres: Rencontre[]; sansRencontreCm: number } {
  const d0 = n.dist[caseDe(n, n.depart.x, n.depart.y)]!;
  const sDe = (x: number, y: number): number => {
    const k = caseDe(n, x, y);
    const v = k < 0 ? INACCESSIBLE : n.dist[k]!;
    return v === INACCESSIBLE ? -1 : Math.max(0, (d0 - v) * CM_PAR_CHANFREIN);
  };
  const cmDe = (u: number): number => idiv(u * 100, M);
  const rencontres: Rencontre[] = [];
  const groupes = new Map<number, { somme: number; k: number; alerte: number }>();
  for (const m of n.monstres) {
    if (m.camp >= 0) continue;
    const s = sDe(m.x, m.y);
    if (m.groupe >= 0) {
      const g = groupes.get(m.groupe) ?? { somme: 0, k: 0, alerte: cmDe(m.alerte) };
      g.somme += s;
      g.k++;
      groupes.set(m.groupe, g);
    } else rencontres.push({ genre: "epars", s, portee: m.type === 1 ? cmDe(ALERTE_CHAUVE_NIVEAU) : cmDe(ALERTE_GELEE_NIVEAU) });
  }
  for (const g of groupes.values()) rencontres.push({ genre: "groupe", s: idiv(g.somme, g.k), portee: g.alerte });
  for (const o of n.obstacles) rencontres.push({ genre: "obstacle", s: sDe(o.x, o.y), portee: PORTEE_OBSTACLE });
  rencontres.sort((a, b) => a.s - b.s);
  return { rencontres, sansRencontreCm: plusLongTroncon(rencontres, n.longueurCm).max };
}
/** Les rayons d'alerte d'un monstre seul (ceux de la partie : `ALERTE_GELEE` 7 m, `ALERTE_CHAUVE` 10 m). */
const ALERTE_GELEE_NIVEAU = cm(700);
const ALERTE_CHAUVE_NIVEAU = cm(1000);

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
  // Lot BR1b : au moins la moitié des détours reviennent au chemin principal plus loin (une boucle) au lieu de finir en cul-de-sac.
  if (n.detours.filter((d) => d.hub2 >= 0).length * 2 < n.detours.length) p.push("moins de la moitié des détours sont des boucles");
  const epars = n.monstres.filter((m) => m.camp < 0 && m.groupe < 0).length;
  if (epars < B.eparsMin || epars > B.eparsMax) p.push(`${epars} monstres épars`);
  const nGroupes = new Set(n.monstres.filter((m) => m.groupe >= 0).map((m) => m.groupe)).size;
  if (nGroupes < B.groupesMin || nGroupes > B.groupesMax) p.push(`${nGroupes} groupes`);
  for (let g = 0; g < nGroupes; g++) {
    const k = n.monstres.filter((m) => m.groupe === g);
    if (k.length < B.groupeTailleMin || k.length > B.groupeTailleMax) p.push(`groupe de ${k.length} monstres`);
    if (k.some((m) => m.alerte < cm(B.groupeAlerteMin) || m.alerte > cm(B.groupeAlerteMax))) p.push("alerte d'un groupe hors des bornes");
  }
  if (n.obstacles.length < B.obstaclesMin || n.obstacles.length > B.obstaclesMax) p.push(`${n.obstacles.length} obstacles`);
  for (const o of n.obstacles) {
    if (o.coups < 1 || o.coups > 2) p.push("un obstacle doit céder en 1 ou 2 coups");
    if (o.cases.some((k) => n.zones[k] !== Z_CHEMIN || n.cases[k] !== SOL)) p.push("obstacle hors du chemin");
    if (o.contournable && o.surcoutCm < 120) p.push("passage trop facile autour d'un obstacle");
  }
  if (n.monstres.length > B.monstresMax) p.push("trop de monstres");
  // Lot BR1b : la règle de densité — jamais plus de ~4 s de course sans rencontre sur le chemin principal.
  if (n.sansRencontreCm > B.sansRencontreMax) p.push(`${n.sansRencontreCm} cm de chemin sans rencontre`);
  for (let k = 0; k < n.cases.length; k++) if (marchable(n.cases[k]!) && n.dist[k] === INACCESSIBLE) p.push("case accessible isolée");
  const loin = cm(B.loinDuDepart);
  const pris = new Set<number>();
  for (const o of n.obstacles) for (const k of o.cases) pris.add(k);
  for (const m of n.monstres) {
    const c = caseDe(n, m.x, m.y);
    if (c < 0 || n.cases[c] !== SOL) p.push("monstre hors du sol");
    if (c >= 0 && pris.has(c)) p.push("monstre dans un obstacle");
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
    if (n && problemesDuNiveau(n).length === 0) return n;
  }
  throw new ErreurNiveau(`aucun niveau valide pour la graine ${graine}`);
}
