import { Rng, mixSeed } from "@cdj/core";
import { M, RAYON_ARENE, cm } from "./constantes";
import { distance, idiv, unitaire } from "./maths";
import { CHAMAN, CHAUVE, CRACHEUR, GELATON, GELEE, NB_TYPES, PLAFOND_TYPE, PORTE_BOUCLIER, PROG_ELITE, PROG_SOUTIEN, PROG_TANK, TOTEM, poidsAuProgres, poidsEpars } from "./monstres";
import { REGLAGES_DEFAUT } from "./reglagesSim";
import { COS, DIRECTIONS, SIN } from "./trig";

// Le NIVEAU du jour (lot BR1) : une grille de collision de cases de 2 m (sol, mur bas, vide, pont), une suite de clairières reliées par des chemins ou des ponts, le chemin principal du départ à l'arène du golem,
// des détours vers des camps de monstres, quelques monstres épars. **Tout est entier et ne dépend que de la graine** ; la simulation collisionne contre la grille et le rendu construit le décor à partir d'elle.
// La géométrie du plan se fait en centimètres (les produits restent sous 2^53), la grille et la partie en unités (1 m = 4 096).
// Lot BR1b : un niveau PLUS COMPACT (chemin principal de 70 à 100 m), une rencontre tous les 15 à 20 m (des GROUPES de 2 à 4 monstres à l'alerte large, des OBSTACLES cassables qui barrent le chemin, quelques épars), une règle de
// DENSITÉ (jamais plus de ~4 s de course sans rencontre : `problemesDuNiveau`) et des détours EN BOUCLE (le camp rejoint le chemin principal plus loin au lieu de finir en cul-de-sac).
// Lot BR5 : un vrai HACK & SLASH — des camps de 10 à 20 monstres (gélatons, gelées, chauves-souris), plus de groupes sur le chemin dont des MEUTES de 6 à 12 gélatons, et des GROUPES DE VASES (4 à 12 petits cassables) dans les clairières, les couloirs,
// les recoins et autour des camps, à la place des gros obstacles ; le passage du chevalier est validé sur une grille fine (`passageBloque`).
// Lot BR6 : un niveau PLUS GRAND (150 à 190 m de chemin), une COURBE DE DIFFICULTÉ (les types de monstres suivent l'avancée sur le chemin : `monstres.ts`), des ÉLITES (au plus un par camp, dans environ un camp sur deux) et une SALLE D'ÉPREUVE
// obligatoire à mi-parcours (les portes se ferment, trois vagues de horde, les portes se rouvrent).

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
/** Lot BR6 : les portes de la salle d'épreuve (les cases du chemin qui touchent la salle ; elles se ferment pendant l'épreuve). */
export const Z_PORTE_EPREUVE = 6;

export type Genre = "depart" | "etape" | "camp" | "arene" | "epreuve";
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
  /** 0 gelée, 1 chauve-souris, 2 gélaton (lot BR5) — les constantes `GELEE`, `CHAUVE` et `GELATON` de la partie. */
  type: number;
  x: number;
  y: number;
  /** L'indice de la clairière du camp, ou −1 (monstre du chemin principal : épars ou membre d'un groupe). */
  camp: number;
  /** Lot BR1b : l'indice du groupe qui barre le chemin (2 à 4 monstres), ou −1 (camp, épars). */
  groupe: number;
  /** Lot BR1b : son rayon d'alerte en unités (10 à 12 m pour un groupe), ou 0 : celui de son type (`ALERTE_GELEE`, `ALERTE_CHAUVE`). */
  alerte: number;
  /** Lot BR6 : un ÉLITE (taille ×1,5, vie ×5, attaque plus rapide ; ×10 d'XP et un cœur garanti) : au plus un par camp. */
  elite: boolean;
  /** Lot BR6 : l'avancée sur le chemin principal où il se trouve, de 0 à 100 (la courbe de difficulté). */
  prog: number;
}
/** Lot BR6 : un monstre d'une vague de la salle d'épreuve (sa place est tirée à la création du niveau). */
export interface MonstreEpreuve {
  type: number;
  elite: boolean;
  x: number;
  y: number;
}
/** Lot BR6 — LA SALLE D'ÉPREUVE, sur le chemin principal à mi-parcours : un disque (centre, rayon) dont les deux portes (les cases du chemin qui y entrent et en sortent) se ferment dès que le chevalier est entré ; trois vagues de horde se suivent,
 * puis les portes se rouvrent. */
export interface Epreuve {
  x: number;
  y: number;
  r: number;
  /** L'indice de la clairière de la salle. */
  clairiere: number;
  /** Les indices des cases des portes (fermées pendant l'épreuve). */
  portes: number[];
  vagues: MonstreEpreuve[][];
  /** L'avancée sur le chemin (0 à 100). */
  prog: number;
}
export interface Detour {
  /** La clairière-camp et la clairière d'où part le détour. */
  camp: number;
  hub: number;
  /** Lot BR1b : la clairière du chemin principal où le détour REVIENT, plus loin (une boucle), ou −1 (cul-de-sac). */
  hub2: number;
  /** La distance du camp au chemin principal, en centimètres. */
  distanceCm: number;
  /** Lot BR6 : l'avancée du camp sur le chemin principal (0 à 100) : elle règle ses types de monstres et ses élites. */
  prog: number;
}

/** Lot BR5 : un VASE — un petit objet cassable d'un coup (jarre, tonneau, petite caisse) posé en groupe de 4 à 12. `tirage` (0 à 99) décide de son contenu à la lecture (gemme, rage ou cœur : `reglages.vaseGemme`, `vaseRage`) ; il vient de la graine du jour. */
export const VASE_JARRE = 0;
export const VASE_TONNEAU = 1;
export const VASE_CAISSE = 2;
export const NB_GENRES_VASE = 3;
/** Le rayon d'un vase (unités) : ce que le coup touche et ce qui bloque le chevalier. */
export const RAYON_VASE: readonly number[] = [cm(30), cm(38), cm(34)];
export interface VaseNiveau {
  genre: number;
  x: number;
  y: number;
  tirage: number;
  /** L'indice du groupe (0 à n − 1). */
  groupe: number;
}
/** Lot BR1b : une rencontre du chemin principal, à l'abscisse `s` (centimètres depuis le départ) et de portée `portee` de part et d'autre (l'alerte d'un groupe ou d'un monstre). Lot BR5 : plus d'obstacle en bloc — les vases ne sont pas une rencontre (rien ne les alerte). */
export interface Rencontre {
  genre: "groupe" | "epars" | "epreuve";
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
  /** Lot BR5 : les vases, par groupes (`VaseNiveau.groupe`). */
  vases: VaseNiveau[];
  /** Lot BR6 : la salle d'épreuve. */
  epreuve: Epreuve;
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

/** Lot BR2 : un camp en boucle est posé de côté à ce pourcentage (+ 0 à 60) de la longueur du lien qu'il double (180 au BR1b : à 22-84 m du chemin). Mesuré : à 60, 18-44 m (médiane 28 m), un détour en boucle coûte ~10 s à ~7,5 m/s. */
export const DECALAGE_CAMP = 150;

// --- Les bornes du plan (centimètres) ----------------------------------------------------------------------------------------------------------------------------------------------------------------
export const BORNES_NIVEAU = {
  /** Le chemin principal mesuré sur la grille, du départ au bord de l'arène (lot BR6 : 150 à 200 m ; lot BR1b : 70 à 100 m). */
  longueurMin: 14000,
  longueurMax: 20500,
  detoursMin: 3,
  detoursMax: 5,
  /** Lot BR5 : un camp de 12 à 22 monstres (8 à 11 au BR1b ; 10 à 20 au premier jet du lot : il faut un peu plus d'unités à faucher pour avoir à farmer). */
  campMin: 13,
  campMax: 22,
  /** Les monstres épars du chemin principal (hors groupes). */
  eparsMin: 0,
  eparsMax: 7,
  /** Les groupes qui barrent le chemin (lot BR5 : 3 à 5, dont au moins une MEUTE de 6 à 12 gélatons ; les autres, de 2 à 4 monstres), l'alerte de 10 à 12 m. */
  groupesMin: 4,
  groupesMax: 9,
  groupeTailleMin: 2,
  groupeTailleMax: 12,
  meuteMin: 6,
  meuteMax: 12,
  groupeAlerteMin: 1000,
  groupeAlerteMax: 1200,
  /** Lot BR5 : les groupes de vases (4 à 12 vases chacun), au moins `vasesGroupesMin` par niveau, 110 vases au plus. */
  vasesGroupesMin: 8,
  vaseGroupeMin: 4,
  vaseGroupeMax: 12,
  vasesMax: 170,
  /** Un détour : le camp est à 17-45 m du chemin principal (17-85 m au BR1b, 20-40 m au BR1). Lot BR2 : des camps plus proches, pour que le détour soit un pari et non une perte sûre (voir `DECALAGE_CAMP`). */
  detourMin: 4000,
  detourMax: 11000,
  /** Aucun monstre du chemin à moins de 16 m du départ. */
  loinDuDepart: 1600,
  /** La règle de densité : au plus 3 000 cm de chemin sans rencontre, soit ~4 s de course (7,49 m/s). */
  sansRencontreMax: 3000,
  /** Au plus autant de monstres dans tout le niveau (lot BR6 : 280 ; lot BR5 : 150 ; 50 au BR1b). */
  monstresMax: 280,
  /** Lot BR6 : la salle d'épreuve : son rayon (cm), trois vagues de 8 à 15 monstres chacune. */
  epreuveRayonMin: 850,
  epreuveRayonMax: 950,
  vagues: 3,
  vagueMin: 8,
  vagueMax: 15,
  /** Lot BR6 : un camp à l'avancée de `PROG_ELITE` ou plus a un élite dans tous les cas (environ un camp sur deux au total). */
  eliteChance: 100,
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
/** Lot BR5 : le rayon d'un camp de gélatons plus serrés (cm) et l'écart minimal entre deux monstres posés d'un camp ou d'un groupe (gélaton ou non). */
const ECART_MONSTRES = 140;
const ECART_GELATONS = 90;
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
  /** Lot BR6 : l'avancée du camp sur le chemin principal (0 à 100). */
  prog: number;
}
/** Une rencontre du plan : à l'abscisse `s` du chemin principal (centimètres depuis le centre du départ). `alerte` : le rayon d'alerte d'un groupe (centimètres). */
interface RencontrePlan {
  genre: "groupe" | "epars";
  s: number;
  alerte: number;
  taille: number;
  /** Lot BR5 : un groupe de gélatons (6 à 12). */
  meute: boolean;
  /** Lot BR6 : l'avancée sur le chemin principal (0 à 100). */
  prog: number;
}
interface Plan {
  cl: Cl[];
  li: Li[];
  detours: DetourPlan[];
  rencontres: RencontrePlan[];
  /** Lot BR6 : l'indice de la clairière de la salle d'épreuve, son avancée sur le chemin (0 à 100) et la longueur du chemin jusqu'à l'arène (cm). */
  mid: number;
  progMid: number;
  fin: number;
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
const PORTEE_EPARS = 850;

/** Le plan : le chemin principal (le départ, trois ou quatre étapes dont la salle d'épreuve à mi-parcours, l'arène), ses rencontres (groupes, épars) et trois à cinq détours vers des camps, de préférence EN BOUCLE ; `null` si les écarts ou la densité ne tiennent pas. */
function tenter(rng: Rng): Plan | null {
  const cl: Cl[] = [];
  const li: Li[] = [];
  const nEtapes = 3 + rng.int(2);
  const nSeg = nEtapes + 1;
  // Lot BR6 : la salle d'épreuve est l'étape du milieu du chemin principal (la deuxième de trois, la troisième de quatre).
  const mid = 1 + Math.floor(nEtapes / 2);
  const total = 15500 + rng.int(3500);
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
    const epreuve = i + 1 === mid;
    cl.push({ x, y, r: arene ? R_ARENE_CM + 100 : epreuve ? BORNES_NIVEAU.epreuveRayonMin + rng.int(BORNES_NIVEAU.epreuveRayonMax - BORNES_NIVEAU.epreuveRayonMin + 1) : 450 + rng.int(250), genre: arene ? "arene" : epreuve ? "epreuve" : "etape" });
    const finale = arene;
    const pont = !finale && rng.chance(30);
    li.push({ a: i, b: i + 1, pont, l: pont ? DEMI_PONT : DEMI_CHEMIN, principal: true });
    // la partie libre entre deux clairières doit permettre un vrai chemin
    if (L - cl[i]!.r - cl[i + 1]!.r < 1000) return null;
  }
  if (!geometrieValide({ cl, li })) return null;

  // --- Les rencontres du chemin principal (lot BR5 : un GROUPE par lien, trois au moins ; un second dans les liens longs, quelques épars dans les étapes).
  const cum: number[] = [0];
  for (let i = 0; i < nSeg; i++) cum.push(cum[i]! + distance(cl[i]!.x, cl[i]!.y, cl[i + 1]!.x, cl[i + 1]!.y));
  const fin = cum[nSeg]! - R_ARENE_CM;
  const progDe = (s: number): number => Math.max(0, Math.min(100, idiv(s * 100, fin)));
  const loin = BORNES_NIVEAU.loinDuDepart + 150;
  const B = BORNES_NIVEAU;
  const rencontres: RencontrePlan[] = [];
  const alerteGroupe = (): number => B.groupeAlerteMin + rng.int(B.groupeAlerteMax - B.groupeAlerteMin + 1);
  // une meute de gélatons (6 à 12) un groupe sur trois ; sinon 2 à 4 monstres
  const groupe = (s: number): RencontrePlan => {
    const meute = rng.chance(35);
    return { genre: "groupe", s, alerte: alerteGroupe(), taille: meute ? B.meuteMin + rng.int(B.meuteMax - B.meuteMin + 1) : 2 + rng.int(3), meute, prog: progDe(s) };
  };
  const epars1 = (s: number): RencontrePlan => ({ genre: "epars", s, alerte: 0, taille: 1, meute: false, prog: progDe(s) });
  for (let k = 0; k < nSeg; k++) {
    const lo = Math.max(cum[k]! + cl[k]!.r + 100, loin);
    const hi = cum[k + 1]! - cl[k + 1]!.r - 100;
    if (hi - lo < 500) return null;
    const deux = hi - lo > 2600 && rng.chance(40);
    const place = deux ? [25 + rng.int(11), 65 + rng.int(11)] : [38 + rng.int(25)];
    place.forEach((u, q) => {
      const s = lo + idiv((hi - lo) * u, 100);
      const nGroupes = rencontres.filter((r) => r.genre === "groupe").length;
      if (q === 0 || (rng.chance(70) && nGroupes < B.groupesMax)) rencontres.push(nGroupes >= B.groupesMax ? epars1(s) : groupe(s));
      else rencontres.push(epars1(s));
    });
  }
  // au moins une meute de gélatons dans le niveau
  if (!rencontres.some((r) => r.meute)) {
    const g = rencontres.find((r) => r.genre === "groupe");
    if (g) {
      g.meute = true;
      g.taille = B.meuteMin + rng.int(B.meuteMax - B.meuteMin + 1);
    }
  }
  // des épars dans les étapes (au plus quatre en tout)
  const etapes = rng.shuffle(Array.from({ length: nEtapes }, (_, i) => i + 1));
  let aPoser = 1 + rng.int(4);
  for (const e of etapes) {
    if (aPoser === 0) break;
    if (e === mid) continue;
    const sEtape = cum[e]! + rng.int(401) - 200;
    if (sEtape < loin || rencontres.some((r) => Math.abs(r.s - sEtape) < 800)) continue;
    rencontres.push(epars1(sEtape));
    aPoser--;
  }
  // la règle de densité : on ajoute un monstre épars au milieu du plus long tronçon tant qu'il dépasse 4 s de course (la salle d'épreuve compte : on ne la traverse pas en courant)
  const zonesDe = (): { s: number; portee: number }[] => [...rencontres.map((r) => ({ s: r.s, portee: r.genre === "groupe" ? r.alerte : PORTEE_EPARS })), { s: cum[mid]!, portee: cl[mid]!.r + 300 }];
  for (let essai = 0; essai < 8; essai++) {
    const t = plusLongTroncon(zonesDe(), fin);
    if (t.max <= B.sansRencontreMax - 200) break;
    if (t.milieu < loin || rencontres.some((r) => Math.abs(r.s - t.milieu) < 800) || Math.abs(cum[mid]! - t.milieu) < cl[mid]!.r + 600) return null;
    rencontres.push(epars1(t.milieu));
  }
  const epars = rencontres.filter((r) => r.genre === "epars").length;
  const groupes = rencontres.filter((r) => r.genre === "groupe").length;
  if (epars > B.eparsMax || groupes < B.groupesMin || groupes > B.groupesMax) return null;

  // --- Les détours : EN BOUCLE de préférence (le camp est entre deux clairières consécutives du chemin et rejoint la seconde), sinon en cul-de-sac. La salle d'épreuve n'est jamais le départ ni le retour d'un détour (ses portes sont fermées pendant l'épreuve).
  const spine = li.length;
  const nb = new Array<number>(nSeg).fill(0);
  const voulus = 3 + rng.int(3);
  const detours: DetourPlan[] = [];
  const dMinChemin = (camp: Cl): number => {
    let dMin = Infinity;
    for (let k = 0; k < spine; k++) dMin = Math.min(dMin, distPtSeg(camp.x, camp.y, cl[li[k]!.a]!.x, cl[li[k]!.a]!.y, cl[li[k]!.b]!.x, cl[li[k]!.b]!.y));
    return dMin;
  };
  for (let d = 0; d < voulus; d++) {
    let place = false;
    for (let essai = 0; essai < 76 && !place; essai++) {
      // les deux premiers détours sont des camps de la SECONDE moitié du niveau (après la salle d'épreuve) : c'est là que viennent les types de la fin et les élites
      const tard = d < 2;
      const boucle = !tard && essai < 60;
      const r = 650 + rng.int(250); // lot BR5 : un camp de 10 à 20 monstres a besoin de place
      let hub: number;
      let hub2 = -1;
      let camp: Cl;
      let sCamp: number;
      if (boucle) {
        hub = rng.int(nEtapes); // le lien (hub, hub + 1) : de la clairière de départ à l'avant-dernière étape
        hub2 = hub + 1;
        if (hub === mid || hub2 === mid || nb[hub]! >= 3 || nb[hub2]! >= 3) continue;
        const A = cl[hub]!;
        const Bc = cl[hub2]!;
        const longueur = distance(A.x, A.y, Bc.x, Bc.y);
        const u = 44 + rng.int(13);
        const [ux, uy] = unitaire(Bc.x - A.x, Bc.y - A.y);
        const s = rng.int(2) === 0 ? 1 : -1;
        const D = idiv(longueur * (DECALAGE_CAMP + rng.int(61)), 100);
        camp = { x: A.x + idiv(ux * idiv(longueur * u, 100), 1024) + idiv(-uy * s * D, 1024), y: A.y + idiv(uy * idiv(longueur * u, 100), 1024) + idiv(ux * s * D, 1024), r, genre: "camp" };
        sCamp = cum[hub]! + idiv((cum[hub2]! - cum[hub]!) * u, 100);
      } else {
        hub = tard ? mid + 1 + rng.int(nEtapes - mid) : rng.int(nSeg);
        if (hub === mid || nb[hub]! >= 3) continue;
        const s = rng.int(2) === 0 ? 1 : -1;
        const angle = mod128(dirsSortie[hub]! + s * (24 + rng.int(24)));
        const D = 3600 + rng.int(3600);
        const H = cl[hub]!;
        camp = { x: H.x + idiv(COS[angle]! * D, 1024), y: H.y + idiv(SIN[angle]! * D, 1024), r, genre: "camp" };
        sCamp = cum[hub]!;
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
        detours.push({ camp: ci, hub, hub2, prog: progDe(sCamp) });
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
  return { cl, li, detours, rencontres, mid, progMid: progDe(cum[mid]!), fin };
}

// --- La grille ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const RANG: readonly number[] = [0, 3, 2, 1, 4, 5, 6]; // la priorité d'une zone qui en recouvre une autre (indexée par Z_*)

function construire(plan: Plan, graine: number, rng: Rng, essais: number): Niveau | null {
  const B = BORNES_NIVEAU;
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
  // Lot BR6 — les portes de la salle d'épreuve : les cases des deux liens du chemin principal qui touchent la salle, sur deux cases d'épaisseur au-delà de son bord (une case diagonale ne laisse rien passer).
  const ep = plan.mid;
  const E = cl[ep]!;
  const portesEpreuve: number[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < l; i++) {
      const idx = j * l + i;
      if (zones[idx] !== Z_CHEMIN && zones[idx] !== Z_PONT) continue;
      const d = distance(centre(i), centreY(j), E.x, E.y);
      if (d <= E.r || d > E.r + 2 * CASE) continue;
      if (li.some((k) => k.principal && (k.a === ep || k.b === ep) && distPtSegU(centre(i), centreY(j), cl[k.a]!.x, cl[k.a]!.y, cl[k.b]!.x, cl[k.b]!.y) <= k.l)) {
        zones[idx] = Z_PORTE_EPREUVE;
        portesEpreuve.push(idx);
      }
    }
  }
  const marchableZ = (z: number): boolean => z === Z_CLAIRIERE || z === Z_CHEMIN || z === Z_ARENE || z === Z_PORTE || z === Z_PORTE_EPREUVE || z === Z_PONT;
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
    if (c.genre === "arene" || c.genre === "epreuve") return;
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

  const solLibre = (x: number, y: number): boolean => {
    const i = Math.floor((x - ox) / CASE);
    const j = Math.floor((y - oy) / CASE);
    if (i < 0 || j < 0 || i >= l || j >= h) return false;
    const k = j * l + i;
    return (cases[k] === SOL || cases[k] === PONT) && zones[k] !== Z_ARENE && zones[k] !== Z_PORTE && zones[k] !== Z_PORTE_EPREUVE;
  };
  /** Un disque de rayon `r` tient en (x, y) : les quatre coins de son carré sont sur du sol libre. */
  const tient = (x: number, y: number, r: number): boolean => solLibre(x - r, y - r) && solLibre(x + r, y - r) && solLibre(x - r, y + r) && solLibre(x + r, y + r);

  // Les monstres : les camps d'abord, puis les groupes qui barrent le chemin, puis les épars. Lot BR6 : leurs TYPES suivent l'avancée sur le chemin (`poidsAuProgres`), avec des plafonds par camp ou par groupe.
  const monstres: MonstreNiveau[] = [];
  const libreAutour = (i: number, j: number): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (cases[(j + dj) * l + i + di] !== SOL) return false;
    return true;
  };
  const place = (x: number, y: number): boolean => {
    const i = Math.floor((x - ox) / CASE);
    const j = Math.floor((y - oy) / CASE);
    return i > 0 && j > 0 && i < l - 1 && j < h - 1 && libreAutour(i, j) && zones[j * l + i] !== Z_ARENE && zones[j * l + i] !== Z_PORTE && zones[j * l + i] !== Z_PORTE_EPREUVE;
  };
  /** Un monstre de ce type en (x, y) est à l'écart des autres : 1,4 m, 0,9 m entre deux gélatons (lot BR5). */
  const loin = (x: number, y: number, type: number): boolean => monstres.every((m) => distance(m.x, m.y, x, y) >= cm(type === GELATON && m.type === GELATON ? ECART_GELATONS : ECART_MONSTRES));
  const loinDuDepart = (x: number, y: number): boolean => distance(x, y, departC.x, departC.y) >= cm(B.loinDuDepart);
  /** Hors de la salle d'épreuve (et de ses abords) : rien n'y dort. */
  const horsEpreuve = (x: number, y: number): boolean => distance(x, y, E.x, E.y) >= E.r + cm(500);
  /** Un type tiré selon les poids de l'avancée `prog`, sans dépasser les plafonds de `comptes` (le camp, le groupe ou la vague en cours). */
  const tirerType = (poids: readonly number[], comptes: number[]): number => {
    let total = 0;
    for (const w of poids) total += w;
    for (let essai = 0; essai < 8; essai++) {
      let r = rng.int(total);
      let t = 0;
      for (; t < NB_TYPES - 1; t++) {
        r -= poids[t]!;
        if (r < 0) break;
      }
      if (comptes[t]! < PLAFOND_TYPE[t]!) return t;
    }
    return GELATON;
  };
  plan.detours.forEach((dt) => {
    const c = cl[dt.camp]!;
    const n = B.campMin + rng.int(B.campMax - B.campMin + 1);
    const comptes = new Array<number>(NB_TYPES).fill(0);
    const debut = monstres.length;
    let mis = 0;
    for (let t = 0; t < 600 && mis < n; t++) {
      const a = rng.int(DIRECTIONS);
      const type = tirerType(poidsAuProgres(dt.prog, true), comptes);
      const r = type === TOTEM ? rng.int(idiv(c.r * 3, 10) + 1) : rng.int(idiv(c.r * 8, 10));
      const x = c.x + idiv(COS[a]! * r, 1024);
      const y = c.y + idiv(SIN[a]! * r, 1024);
      if (!place(x, y) || !loin(x, y, type)) continue;
      monstres.push({ type, x, y, camp: dt.camp, groupe: -1, alerte: 0, elite: false, prog: dt.prog });
      comptes[type]!++;
      mis++;
    }
    // Un élite par camp au plus, dans environ un camp sur deux : ceux qui sont à mi-parcours ou après.
    if (mis > 0 && dt.prog >= PROG_ELITE && rng.int(100) < B.eliteChance) monstres[debut + rng.int(mis)]!.elite = true;
  });
  // Les groupes : 2 à 4 monstres (une MEUTE : 6 à 12 gélatons, lot BR5) en travers du chemin, là où il est étroit, avec une alerte large (10 à 12 m).
  let groupe = 0;
  for (const r of plan.rencontres) {
    if (r.genre !== "groupe") continue;
    const P = pointDuChemin(plan.cl, plan.li, r.s);
    const px = cm(P.x);
    const py = cm(P.y);
    let mis = 0;
    const colonnes = r.meute ? 4 : r.taille;
    const comptes = new Array<number>(NB_TYPES).fill(0);
    for (let i = 0; i < r.taille; i++) {
      const type = r.meute ? GELATON : tirerType(poidsAuProgres(r.prog, false), comptes);
      for (let t = 0; t < 18; t++) {
        // une meute se range en rangées de quatre (1 m entre deux gélatons) ; un groupe se range en travers du chemin
        const rang = r.meute ? Math.floor(i / colonnes) : 0;
        const col = r.meute ? i % colonnes : i;
        const q = idiv((2 * col - (colonnes - 1)) * cm(r.meute ? 105 : 160), 2) + (t === 0 ? 0 : rng.int(cm(110)) - cm(55));
        const a = (r.meute ? (rang - 1) * cm(105) : 0) + (t === 0 ? 0 : rng.int(cm(240)) - cm(120));
        const x = px + idiv(-P.uy * q, 1024) + idiv(P.ux * a, 1024);
        const y = py + idiv(P.ux * q, 1024) + idiv(P.uy * a, 1024);
        if (!tient(x, y, cm(type === GELATON ? 40 : 60)) || !loin(x, y, type) || !loinDuDepart(x, y) || !horsEpreuve(x, y)) continue;
        monstres.push({ type, x, y, camp: -1, groupe, alerte: cm(r.alerte), elite: false, prog: r.prog });
        comptes[type]!++;
        mis++;
        break;
      }
    }
    if (mis < (r.meute ? B.meuteMin : B.groupeTailleMin)) return null;
    groupe++;
  }
  // Les épars : un monstre seul, sur le chemin ou dans une étape (ni gélaton, ni chaman, ni totem : un seul n'aurait pas de sens).
  for (const r of plan.rencontres) {
    if (r.genre !== "epars") continue;
    const P = pointDuChemin(plan.cl, plan.li, r.s);
    for (let t = 0; t < 14; t++) {
      const q = rng.int(cm(300)) - cm(150);
      const a = rng.int(cm(300)) - cm(150);
      const x = cm(P.x) + idiv(-P.uy * q, 1024) + idiv(P.ux * a, 1024);
      const y = cm(P.y) + idiv(P.ux * q, 1024) + idiv(P.uy * a, 1024);
      const type = tirerType(poidsEpars(r.prog), new Array<number>(NB_TYPES).fill(0));
      if (!tient(x, y, cm(80)) || !loin(x, y, type) || !loinDuDepart(x, y) || !horsEpreuve(x, y) || distance(x, y, ar.x, ar.y) < cm(1900)) continue;
      monstres.push({ type, x, y, camp: -1, groupe: -1, alerte: 0, elite: false, prog: r.prog });
      break;
    }
  }

  // --- Les VASES (lot BR5) : des groupes de 4 à 12 petits cassables, dans les clairières, le long des chemins (jamais sur l'axe), dans les recoins contre un mur et autour des camps. Jamais près d'un monstre, du départ, de l'arène ni sur un pont ;
  // leur contenu est tiré de la graine (`tirage`). `passageBloque` valide ensuite que le chevalier passe toujours.
  const vases: VaseNiveau[] = [];
  const axes = li.map((k) => ({ ax: cl[k.a]!.x, ay: cl[k.a]!.y, bx: cl[k.b]!.x, by: cl[k.b]!.y }));
  const ECART_VASE = cm(86);
  const LARGEUR_AXE = cm(175);
  const vaseOk = (x: number, y: number, rv: number): boolean => {
    if (!tient(x, y, rv + cm(4))) return false;
    const i = Math.floor((x - ox) / CASE);
    const j = Math.floor((y - oy) / CASE);
    if (cases[j * l + i] !== SOL) return false; // pas sur un pont
    if (distance(x, y, departC.x, departC.y) < cm(450)) return false;
    if (distance(x, y, ar.x, ar.y) < RAYON_ARENE + cm(450)) return false;
    if (distance(x, y, E.x, E.y) < E.r + cm(300)) return false; // lot BR6 : la salle d'épreuve est vide de vases (les vagues y manœuvrent)
    for (const q of axes) if (distPtSegU(x, y, q.ax, q.ay, q.bx, q.by) < LARGEUR_AXE) return false;
    for (const m of monstres) if (distance(m.x, m.y, x, y) < cm(m.type === 2 ? 120 : 150)) return false;
    for (const v of vases) if (distance(v.x, v.y, x, y) < ECART_VASE) return false;
    return true;
  };
  let nGroupesVases = 0;
  /** Un groupe de `n` vases autour de (cx, cy), à `etalement` au plus du centre : rend combien en sont posés (le groupe n'est gardé qu'à 4 au moins). */
  const groupeDeVases = (cx: number, cy: number, n: number, etalement: number): number => {
    if (vases.length + n > B.vasesMax) return 0;
    const avant = vases.length;
    for (let t = 0; t < 40 && vases.length - avant < n; t++) {
      const a = rng.int(DIRECTIONS);
      const r = rng.int(etalement + 1);
      const x = cx + idiv(COS[a]! * r, 1024);
      const y = cy + idiv(SIN[a]! * r, 1024);
      const genre = rng.int(NB_GENRES_VASE);
      if (!vaseOk(x, y, RAYON_VASE[genre]!)) continue;
      vases.push({ genre, x, y, tirage: rng.int(100), groupe: nGroupesVases });
    }
    if (vases.length - avant < B.vaseGroupeMin) {
      vases.length = avant;
      return 0;
    }
    nGroupesVases++;
    return vases.length - avant;
  };
  const tailleVases = (): number => B.vaseGroupeMin + rng.int(B.vaseGroupeMax - B.vaseGroupeMin + 1);
  // Les clairières (hors l'arène) : un groupe, parfois deux ; les camps : un anneau de vases autour des monstres.
  cl.forEach((c, ci) => {
    if (c.genre === "arene" || c.genre === "epreuve") return;
    const nb = c.genre === "camp" ? 2 : rng.chance(50) ? 2 : 1;
    for (let k = 0; k < nb; k++) {
      for (let t = 0; t < 8; t++) {
        const a = rng.int(DIRECTIONS);
        const r = idiv(c.r * (c.genre === "camp" ? 78 : 55), 100);
        if (groupeDeVases(c.x + idiv(COS[a]! * r, 1024), c.y + idiv(SIN[a]! * r, 1024), tailleVases(), cm(c.genre === "camp" ? 150 : 170)) > 0) break;
      }
    }
    void ci;
  });
  // Les couloirs : le long des liens, à 2 m de l'axe au moins (jamais sur le passage).
  for (const k of li) {
    const A = cl[k.a]!;
    const Bc = cl[k.b]!;
    if (k.pont) continue;
    const [ux, uy] = unitaire(Bc.x - A.x, Bc.y - A.y);
    const len = distance(A.x, A.y, Bc.x, Bc.y);
    for (let essai = 0; essai < 3; essai++) {
      const t = A.r + cm(150) + rng.int(Math.max(1, len - A.r - Bc.r - cm(300)));
      const cote = rng.int(2) === 0 ? 1 : -1;
      const lat = cm(235);
      const x = A.x + idiv(ux * t, 1024) + idiv(-uy * cote * lat, 1024);
      const y = A.y + idiv(uy * t, 1024) + idiv(ux * cote * lat, 1024);
      if (rng.chance(40) && groupeDeVases(x, y, tailleVases(), cm(130)) > 0) break;
    }
  }
  // Les recoins : des cases de clairière contre un mur (un groupe contre la haie).
  const recoins: number[] = [];
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < l - 1; i++) {
      if (zones[j * l + i] !== Z_CLAIRIERE || cases[j * l + i] !== SOL) continue;
      let mur = false;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (cases[(j + dj) * l + i + di] === MUR) mur = true;
      if (mur) recoins.push(j * l + i);
    }
  }
  for (let essai = 0; essai < 14 && nGroupesVases < 14 && recoins.length > 0; essai++) {
    const idx = recoins[rng.int(recoins.length)]!;
    const i = idx % l;
    const j = (idx - i) / l;
    if (rng.chance(45)) groupeDeVases(ox + i * CASE + CASE / 2, oy + j * CASE + CASE / 2, tailleVases(), cm(140));
  }
  // Les détours : la distance de chaque camp au chemin principal.
  const principaux = li.filter((k) => k.principal);
  const detours: Detour[] = plan.detours.map((dt) => {
    const c = cl[dt.camp]!;
    let dMin = Infinity;
    for (const k of principaux) dMin = Math.min(dMin, distPtSegU(c.x, c.y, cl[k.a]!.x, cl[k.a]!.y, cl[k.b]!.x, cl[k.b]!.y));
    return { camp: dt.camp, hub: dt.hub, hub2: dt.hub2, distanceCm: idiv(dMin * 100, M), prog: dt.prog };
  });

  // --- Lot BR6 : les trois vagues de la salle d'épreuve. La courbe de difficulté s'y retrouve (la première un cran avant l'avancée de la salle, la dernière un cran après), jamais plus de 15 monstres par vague, au moins trois gélatons (c'est une horde),
  // loin de l'entrée par où le chevalier arrive.
  const precedente = cl[li.find((k) => k.principal && k.b === ep)!.a]!;
  const [ex, ey] = unitaire(precedente.x - E.x, precedente.y - E.y);
  const entree = { x: E.x + idiv(ex * E.r, 1024), y: E.y + idiv(ey * E.r, 1024) };
  const vagues: MonstreEpreuve[][] = [];
  for (let v = 0; v < B.vagues; v++) {
    const prog = Math.max(0, Math.min(100, plan.progMid + (v - 1) * 12));
    const taille = B.vagueMin + 1 + 2 * v + rng.int(3);
    const comptes = new Array<number>(NB_TYPES).fill(0);
    const vague: MonstreEpreuve[] = [];
    for (let t = 0; t < 400 && vague.length < taille; t++) {
      // les trois premiers sont des gélatons : une vague est une horde
      const type = vague.length < 3 ? GELATON : tirerType(poidsAuProgres(prog, v === B.vagues - 1), comptes);
      const a = rng.int(DIRECTIONS);
      const r = idiv(E.r * (42 + rng.int(36)), 100);
      const x = E.x + idiv(COS[a]! * r, 1024);
      const y = E.y + idiv(SIN[a]! * r, 1024);
      if (!tient(x, y, cm(type === GELATON ? 40 : 70)) || distance(x, y, entree.x, entree.y) < cm(500) || vague.some((q) => distance(q.x, q.y, x, y) < cm(type === GELATON ? 90 : 140))) continue;
      vague.push({ type, elite: false, x, y });
      comptes[type]!++;
    }
    if (vague.length < B.vagueMin) return null;
    vagues.push(vague);
  }
  const epreuve: Epreuve = { x: E.x, y: E.y, r: E.r, clairiere: ep, portes: portesEpreuve, vagues, prog: plan.progMid };
  const n: Niveau = { l, h, ox, oy, cases, zones, clairieres: cl, liens: li, depart, arene, porte, monstres, detours, vases, epreuve, rencontres: [], sansRencontreCm: 0, longueurCm: dd === INACCESSIBLE ? 0 : dd * CM_PAR_CHANFREIN, dist, essais, empreinte: 0 };
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
  for (const m of n.monstres) for (const v of [m.type, m.x, m.y, m.camp, m.groupe, m.alerte, m.prog]) nombre(v);
  for (const o of n.vases) for (const v of [o.genre, o.x, o.y, o.tirage, o.groupe]) nombre(v);
  for (const d of n.detours) for (const v of [d.camp, d.hub, d.hub2, d.prog]) nombre(v);
  for (const m of n.monstres) nombre(m.elite ? 1 : 0);
  const e = n.epreuve;
  for (const v of [e.x, e.y, e.r, e.clairiere, ...e.portes]) nombre(v);
  for (const vague of e.vagues) for (const q of vague) for (const v of [q.type, q.x, q.y, q.elite ? 1 : 0]) nombre(v);
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
 * Une rencontre a une portée : l'alerte d'un groupe (10 à 12 m) ou d'un monstre ; le tronçon se compte entre la fin d'une portée et le début de la suivante, du départ jusqu'au bord de l'arène.
 */
export function rencontresDuChemin(n: Pick<Niveau, "l" | "h" | "ox" | "oy" | "dist" | "depart" | "monstres" | "longueurCm" | "epreuve">): { rencontres: Rencontre[]; sansRencontreCm: number } {
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
  // Lot BR6 : la salle d'épreuve est une rencontre (on ne la traverse pas en courant) : elle s'étend du bord où l'on entre au bord où l'on sort, plus une marge.
  rencontres.push({ genre: "epreuve", s: sDe(n.epreuve.x, n.epreuve.y), portee: idiv(n.epreuve.r * 100, M) + 300 });
  rencontres.sort((a, b) => a.s - b.s);
  return { rencontres, sansRencontreCm: plusLongTroncon(rencontres, n.longueurCm).max };
}
/** Les rayons d'alerte d'un monstre seul (ceux de la partie : `ALERTE_GELEE` 7 m, `ALERTE_CHAUVE` 10 m). */
const ALERTE_GELEE_NIVEAU = cm(700);
const ALERTE_CHAUVE_NIVEAU = cm(1000);

/**
 * Lot BR5 — « rien ne bloque le chemin » : sur une grille fine (50 cm), le chevalier (corps de 42 cm) part du départ et doit rejoindre l'arène, la porte et CHAQUE monstre, avec les vases comme des disques pleins. Une case de la grille fine est libre
 * quand le chevalier y tient (les quatre coins de son carré sur du sol marchable, comme la simulation) et qu'aucun vase n'est à moins de la somme des deux rayons. Rend la raison du blocage, ou `null`.
 */
export function passageBloque(n: Pick<Niveau, "l" | "h" | "ox" | "oy" | "cases" | "depart" | "arene" | "monstres" | "vases" | "porte">): string | null {
  const SUB = 4;
  const W = n.l * SUB;
  const H = n.h * SUB;
  const PAS = CASE / SUB;
  const rc = RAYON_CHEVALIER_NIVEAU;
  const marche = (x: number, y: number): boolean => {
    const i = Math.floor((x - n.ox) / CASE);
    const j = Math.floor((y - n.oy) / CASE);
    if (i < 0 || j < 0 || i >= n.l || j >= n.h) return false;
    const c = n.cases[j * n.l + i];
    return c === SOL || c === PONT;
  };
  const libre = (x: number, y: number): boolean => marche(x - rc, y - rc) && marche(x + rc, y - rc) && marche(x - rc, y + rc) && marche(x + rc, y + rc);
  const bloquee = new Uint8Array(W * H);
  for (const v of n.vases) {
    const r = RAYON_VASE[v.genre]! + rc;
    const i0 = Math.max(0, Math.floor((v.x - r - n.ox) / PAS));
    const i1 = Math.min(W - 1, Math.floor((v.x + r - n.ox) / PAS));
    const j0 = Math.max(0, Math.floor((v.y - r - n.oy) / PAS));
    const j1 = Math.min(H - 1, Math.floor((v.y + r - n.oy) / PAS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (distance(n.ox + i * PAS + PAS / 2, n.oy + j * PAS + PAS / 2, v.x, v.y) < r) bloquee[j * W + i] = 1;
  }
  const vu = new Uint8Array(W * H);
  const cible = (x: number, y: number): number => Math.floor((y - n.oy) / PAS) * W + Math.floor((x - n.ox) / PAS);
  const file: number[] = [];
  const dep = cible(n.depart.x, n.depart.y);
  vu[dep] = 1;
  file.push(dep);
  for (let q = 0; q < file.length; q++) {
    const k = file[q]!;
    const i = k % W;
    const j = (k - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const kk = jj * W + ii;
      if (vu[kk] === 1 || bloquee[kk] === 1 || !libre(n.ox + ii * PAS + PAS / 2, n.oy + jj * PAS + PAS / 2)) continue;
      vu[kk] = 1;
      file.push(kk);
    }
  }
  const atteint = (x: number, y: number): boolean => {
    const k = cible(x, y);
    return k >= 0 && k < vu.length && vu[k] === 1;
  };
  if (!atteint(n.arene.ex, n.arene.ey) && !atteint(n.arene.x, n.arene.y)) return "des vases bloquent le chemin de l'arène";
  for (const m of n.monstres) if (!atteint(m.x, m.y)) return "des vases bloquent le chemin d'un monstre";
  return null;
}
/** Le rayon du chevalier (unités), recopié ici pour ne pas importer la partie. */
const RAYON_CHEVALIER_NIVEAU = cm(42);

/** Lot BR6 : la salle d'épreuve, portes fermées, est close : en partant de son centre on n'atteint ni le départ, ni l'arène, ni aucun monstre du niveau. */
export function epreuveEtanche(n: Pick<Niveau, "l" | "h" | "ox" | "oy" | "cases" | "epreuve" | "depart" | "arene" | "monstres">): boolean {
  const { l, h, cases } = n;
  const fermee = new Set(n.epreuve.portes);
  const vu = new Uint8Array(l * h);
  const debut = caseDe(n, n.epreuve.x, n.epreuve.y);
  if (debut < 0) return false;
  const file = [debut];
  vu[debut] = 1;
  const ok = (k: number): boolean => marchable(cases[k]!) && !fermee.has(k);
  for (let q = 0; q < file.length; q++) {
    const idx = file[q]!;
    const i = idx % l;
    const j = (idx - i) / l;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= l || jj >= h) continue;
        const k = jj * l + ii;
        if (vu[k] === 1 || !ok(k)) continue;
        if (di !== 0 && dj !== 0 && (!ok(j * l + ii) || !ok(jj * l + i))) continue;
        vu[k] = 1;
        file.push(k);
      }
    }
  }
  const atteint = (x: number, y: number): boolean => {
    const k = caseDe(n, x, y);
    return k >= 0 && vu[k] === 1;
  };
  return !atteint(n.depart.x, n.depart.y) && !atteint(n.arene.x, n.arene.y) && !n.monstres.some((m) => atteint(m.x, m.y));
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
  // Lot BR1b : au moins la moitié des détours reviennent au chemin principal plus loin (une boucle) au lieu de finir en cul-de-sac.
  if (n.detours.filter((d) => d.hub2 >= 0).length * 2 < n.detours.length) p.push("moins de la moitié des détours sont des boucles");
  const epars = n.monstres.filter((m) => m.camp < 0 && m.groupe < 0).length;
  if (epars < B.eparsMin || epars > B.eparsMax) p.push(`${epars} monstres épars`);
  const nGroupes = new Set(n.monstres.filter((m) => m.groupe >= 0).map((m) => m.groupe)).size;
  if (nGroupes < B.groupesMin || nGroupes > B.groupesMax) p.push(`${nGroupes} groupes`);
  for (let g = 0; g < nGroupes; g++) {
    const k = n.monstres.filter((m) => m.groupe === g);
    if (k.length < B.groupeTailleMin || k.length > B.groupeTailleMax) p.push(`groupe de ${k.length} monstres`);
    if (k.length > 4 && k.some((m) => m.type !== 2)) p.push("un grand groupe doit être une meute de gélatons");
    if (k.some((m) => m.alerte < cm(B.groupeAlerteMin) || m.alerte > cm(B.groupeAlerteMax))) p.push("alerte d'un groupe hors des bornes");
  }
  // Lot BR5 : au moins une meute de gélatons ; les vases par groupes de 4 à 12, assez de groupes, et le passage du chevalier jamais bloqué.
  const meutes = new Set(n.monstres.filter((m) => m.groupe >= 0 && m.type === 2).map((m) => m.groupe));
  if (![...meutes].some((g) => n.monstres.filter((m) => m.groupe === g).length >= B.meuteMin)) p.push("aucune meute de gélatons");
  const groupesVases = new Set(n.vases.map((v) => v.groupe));
  if (groupesVases.size < B.vasesGroupesMin) p.push(`${groupesVases.size} groupes de vases`);
  for (const g of groupesVases) {
    const k = n.vases.filter((v) => v.groupe === g).length;
    if (k < B.vaseGroupeMin || k > B.vaseGroupeMax) p.push(`groupe de ${k} vases`);
  }
  if (n.vases.length > B.vasesMax) p.push("trop de vases");
  if (n.monstres.length > B.monstresMax) p.push("trop de monstres");
  // Lot BR1b : la règle de densité — jamais plus de ~4 s de course sans rencontre sur le chemin principal.
  if (n.sansRencontreCm > B.sansRencontreMax) p.push(`${n.sansRencontreCm} cm de chemin sans rencontre`);
  for (let k = 0; k < n.cases.length; k++) if (marchable(n.cases[k]!) && n.dist[k] === INACCESSIBLE) p.push("case accessible isolée");
  const loin = cm(B.loinDuDepart);
  for (const m of n.monstres) {
    const c = caseDe(n, m.x, m.y);
    if (c < 0 || n.cases[c] !== SOL) p.push("monstre hors du sol");
    if (m.camp < 0 && distance(m.x, m.y, n.depart.x, n.depart.y) < loin) p.push("monstre près du départ");
    if (distance(m.x, m.y, n.depart.x, n.depart.y) < cm(1500)) p.push("monstre trop près du départ");
  }
  if (n.porte.length < 2) p.push("porte trop étroite");
  // Lot BR6 : la salle d'épreuve (portes, trois vagues, étanchéité), les élites (un par camp au plus, jamais avant le milieu) et la courbe de difficulté (les types suivent l'avancée sur le chemin).
  const e = n.epreuve;
  if (e.portes.length < 4) p.push("portes de l'épreuve trop étroites");
  if (e.vagues.length !== B.vagues || e.vagues.some((v) => v.length < B.vagueMin || v.length > B.vagueMax)) p.push("vagues de l'épreuve hors des bornes");
  if (!epreuveEtanche(n)) p.push("la salle d'épreuve n'est pas étanche");
  for (const d of n.detours) {
    const elites = n.monstres.filter((m) => m.camp === d.camp && m.elite).length;
    if (elites > 1) p.push("plus d'un élite dans un camp");
    if (elites > 0 && d.prog < PROG_ELITE) p.push("un élite avant le milieu du niveau");
  }
  if (n.monstres.some((m) => m.elite && m.camp < 0)) p.push("un élite hors d'un camp");
  for (const m of n.monstres) {
    if ((m.type === CRACHEUR || m.type === CHAMAN) && m.prog < PROG_SOUTIEN) p.push("un soutien ou un tireur avant son tiers du niveau");
    if ((m.type === PORTE_BOUCLIER || m.type === TOTEM) && m.prog < PROG_TANK) p.push("un tank ou un totem avant ses deux tiers du niveau");
    if (m.type === TOTEM && m.camp < 0) p.push("un totem hors d'un camp");
  }
  // le plus coûteux en dernier, et seulement si le reste tient : le chevalier rejoint l'arène et chaque monstre (grille fine)
  if (p.length === 0) {
    const bloque = passageBloque(n);
    if (bloque) p.push(bloque);
  }
  return [...new Set(p)];
}

/** Lot BR6 : les derniers niveaux générés, par graine (un niveau est immuable : la partie, le pilote et le rendu le lisent seulement). Générer un niveau coûte ~100 ms (le tirage retente jusqu'à en trouver un valide) : le serveur, le pilote qui joue trois parties du même jour et les tests le redemandent sans cesse. */
const gardes = new Map<number, Niveau>();
const GARDES_MAX = 64;

/** Le niveau d'une graine : tente des plans jusqu'à en trouver un valide (les tentatives sont tirées de la graine : même résultat partout). */
export function genererNiveau(graine: number): Niveau {
  const deja = gardes.get(graine);
  if (deja) return deja;
  const n = genererSansCache(graine);
  gardes.set(graine, n);
  if (gardes.size > GARDES_MAX) gardes.delete(gardes.keys().next().value!);
  return n;
}

function genererSansCache(graine: number): Niveau {
  for (let essai = 0; essai < MAX_ESSAIS; essai++) {
    const rng = new Rng(mixSeed(graine, SEL_NIVEAU + essai));
    const plan = tenter(rng);
    if (!plan) continue;
    const n = construire(plan, graine, rng, essai + 1);
    if (n && problemesDuNiveau(n).length === 0) return n;
  }
  throw new ErreurNiveau(`aucun niveau valide pour la graine ${graine}`);
}
