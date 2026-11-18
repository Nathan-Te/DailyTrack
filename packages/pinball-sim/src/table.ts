import { AXE, RAYON, LAMPE_DEMI, LAMPE_X, LAMPE_Y, NORME, SAUVEUR_R, SAUVEUR_X, SAUVEUR_Y, TOUR, UNITE } from "./constantes";
import { cosinus, racine, sinus, unitaire, div } from "./entiers";
import { MISSION_DU_THEME, MODULES_DE_MISSION, type Contenu } from "./generateur";
import type { ThemePinball } from "./themes";
import { planDe, type DefAiguillage, type DefMini, type DefPorte, type DefRail } from "./plans";
import type { Reglages } from "./reglages";

// La géométrie de la table (lot PB1), en unités (4 096 par pixel de la maquette). **Le châssis ne change jamais** : le mur gauche, l'arc du haut, le mur droit, le couloir du lanceur, les deux couloirs de retour
// (les guides), les deux lance-pierres, les quatre poteaux des trois couloirs du haut. Le haut est posé module par module (`poser`). Tout est construit une fois par partie, d'après les réglages (les rebonds).

/** Un mur : un segment avec son vecteur unitaire (échelle `NORME`) et sa longueur, le rebond (‰) et le coup (unités/s, 0 : aucun). */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ux: number;
  uy: number;
  len: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  e: number;
  kick: number;
  /** 0 : mur ; 1 : lance-pierre ; 2 : cible (le rang de sa banque est dans `banque`, le sien dans `cible`). */
  type: 0 | 1 | 2;
  banque: number;
  cible: number;
}
export interface Cercle {
  x: number;
  y: number;
  r: number;
  kick: number;
  /** Lot PB3 : un bumper qui se déplace (l'astéroïde de l'espace) va et vient de `amp` unités autour de `x0`, en fonction du seul numéro de pas ; `vx` est sa vitesse (unités/s) à ce pas. */
  mobile?: { x0: number; amp: number };
  vx?: number;
}
export interface Spinner {
  x: number;
  y: number;
  /** La demi-largeur du capteur. */
  l: number;
}
export interface Trou {
  x: number;
  y: number;
  r: number;
}
export interface Voie {
  x: number;
  y: number;
}
/** Un disque (lot PB3) : le manège, le tourbillon, le trou noir (son rayon d'attraction) ou le geyser. */
export interface Zone {
  x: number;
  y: number;
  r: number;
}
/** Un portail : `id` 0 (A) ou 1 (B) ; on entre dans l'un et on sort de l'autre. */
export interface Portail extends Zone {
  id: 0 | 1;
}
/** Le couloir de la coulée : la bille qui y monte (`|x − x0| < l`, `|y − y0| < h`) est accélérée vers le haut. */
export interface Coulee {
  x: number;
  y: number;
  l: number;
  h: number;
}
/** **Un rail** (lot PBG1) : une rampe ou l'orbite, un tracé en segments que la bille suit, au-dessus du plateau (une autre couche : elle ne touche plus rien). `x`, `y` : les sommets (unités) ; `cum` : la longueur cumulée à chaque sommet ; `ux`, `uy` : le vecteur unitaire (`NORME`) de chaque segment, dans le sens de l'entrée vers la sortie ; `len` : la longueur totale. */
export interface Rail {
  genre: "rampe" | "orbite";
  x: number[];
  y: number[];
  cum: number[];
  ux: number[];
  uy: number[];
  len: number;
  /** Au rendu seulement : la hauteur au-dessus du plateau (px). */
  hauteur: number;
}
/** **La bouche d'un rail** : un segment en travers du chemin, que la bille franchit dans le sens `(ux, uy)` (échelle `NORME`). Assez vite (`rampeVitesseMin`), elle est prise ; trop lente, la bouche est un mur et elle redescend. `bout` : 0 l'entrée du rail, 1 sa sortie (l'orbite se prend par les deux bouts). `l` : la demi-largeur (unités). */
export interface Porte {
  rail: number;
  bout: 0 | 1;
  x: number;
  y: number;
  ux: number;
  uy: number;
  l: number;
  seg: Segment;
}
/** Le mini-batteur (lot PBG1), dans le repère du côté gauche : le côté, le pivot et la longueur (unités). Il suit l'angle du batteur du même côté. */
export interface MiniBatteur {
  cote: 0 | 1;
  x: number;
  y: number;
  longueur: number;
}
/**
 * **La porte** (lot PBG3) : un passage incliné fermé par un battant. `x`, `y` : le milieu du battant ; `ux`, `uy` : la direction du passage (de l'entrée vers la sortie, échelle `NORME`) ; `nx`, `ny` : sa perpendiculaire ;
 * `l` : la demi-largeur ; `battant` : le segment qui ferme le passage — **un mur quand la porte est fermée**, rien quand elle est ouverte ; `parBanque` : une banque de cibles complète l'ouvre (sinon, la table n'en ayant
 * pas, c'est l'orbite menée à son bout). Les deux murs du passage sont dans `murs`.
 */
export interface Passage {
  x: number;
  y: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  l: number;
  battant: Segment;
  parBanque: boolean;
  /** Les deux bouts du battant, pour le rendu. */
  bouts: [[number, number], [number, number]];
  /** La longueur du passage (unités). */
  profondeur: number;
}
/** **Le poteau sauveur** (lot PBG3) : entre les batteurs, il sort quand les deux lampes des couloirs de retour sont allumées. Un cercle (`x`, `y`, `r`) ; `lampes` : la ligne que la bille franchit dans chaque couloir (le centre `x`, la hauteur `y`, la demi-largeur `l`). */
export interface Sauveur {
  x: number;
  y: number;
  r: number;
  lampes: { x: number; y: number; l: number }[];
}
/** Où l'aiguillage envoie la bille : un point d'arrivée et le nombre de pas du trajet ; `sortie` : où la bille ressort (l'élément du thème). */
export interface Arrivee {
  x: number;
  y: number;
  pas: number;
}
/**
 * **L'aiguillage** (lot PBG3) : sur une rampe, au point `(x, y)` de son abscisse `s`. Par défaut la rampe va jusqu'au bout ; **le verrou allumé**, il envoie la bille au verrou (`versVerrou`) ; **pendant la multibille**, à
 * l'élément du thème (`versElement`, la plongée dans l'élément rapporte un jackpot ; `type` : le module visé, `r` : son rayon).
 */
export interface Aiguillage {
  rail: number;
  s: number;
  x: number;
  y: number;
  versVerrou: Arrivee | null;
  versElement: (Arrivee & { type: string; r: number }) | null;
}

export interface Poser {
  type: string;
  emplacement: number;
  x: number;
  y: number;
  /** Lot PB4 : où sont les éléments de ce module dans les tableaux de la table, pour la validation et le rapport : le rang du premier (dans `bumpers`, `banques`, `spinners`, `trous`, `plateaux`, `tourbillons`, `trousNoirs`, `portails`, `geysers` ou `coulees`, selon le module) et leur nombre. */
  rang: number;
  n: number;
}
export interface Table {
  murs: Segment[];
  poteaux: Cercle[];
  bumpers: Cercle[];
  spinners: Spinner[];
  trous: Trou[];
  voies: Voie[];
  /** Lot PB3 : les éléments des thèmes. */
  plateaux: Zone[];
  tourbillons: Zone[];
  trousNoirs: Zone[];
  portails: Portail[];
  geysers: Zone[];
  coulees: Coulee[];
  /** Le nombre de banques de cibles et, pour chacune, les rangs de ses cibles dans `murs`. */
  banques: number[][];
  /** Ce qui est posé à chaque emplacement (rendu, essais). */
  poses: Poser[];
  /** Lot PBG1 : le plan du jour — ses rails (les rampes, puis l'orbite en dernier), leurs bouches, le mini-batteur s'il y en a un. */
  plan: string;
  rails: Rail[];
  portes: Porte[];
  mini: MiniBatteur | null;
  /** Lot PBG2 : le rang (dans `trous`) du trou qui sert de verrou — celui du deuxième emplacement du plan — ou −1 (le plan d'essai : pas de verrou, la mission ne se joue qu'une fois). */
  verrou: number;
  /** Lot PBG3 : la porte, le poteau sauveur et l'aiguillage (`null` sur le plan d'essai pour la porte et l'aiguillage ; le poteau est partout). */
  passage: Passage | null;
  sauveur: Sauveur;
  aiguillage: Aiguillage | null;
  /** Lot PBR1 : **la grille des murs** — pour chaque case de 16 px (`caseDe`), les murs (hors cibles) qui peuvent toucher une bille qui s'y trouve, dans l'ordre de `murs`. Les mêmes collisions dans le même ordre, sans essayer les 70 murs à chaque pas. */
  grille: Segment[][];
  /** Lot PBR1 : la bande de y (unités) hors de laquelle une bille ne peut toucher ni un poteau ni un capteur de voie : `[bas, haut]`, bornes exclues. */
  bandePoteaux: [number, number];
  bandeVoies: [number, number];
}

/** La grille des murs (lot PBR1) : des cases de 2^16 unités (16 px), `COLONNES` × `LIGNES` ; une bille hors de la table est rangée dans la case du bord. */
export const CASE_BITS = 16;
export const COLONNES = 24;
export const LIGNES = 48;
/**
 * **La marge de la grille** : un mur est rangé dans une case s'il est à moins de `RAYON + MARGE_GRILLE` de la case. Pendant le pas d'une bille, un mur qui la touche la pousse (de 9 px au plus) avant que le suivant soit
 * essayé : la poussée d'un pas ne dépasse pas 2,5 px (la bille avance de 2,5 px au plus, elle ne pénètre donc un mur que de cela : 2,3 px mesurés sur des parties entières du robot) ; la marge de 32 px couvre plus de dix poussées
 * à la suite, plus qu'aucun coin de la table n'en peut faire (`test/grille.test.ts`).
 */
export const MARGE_GRILLE = 32 * UNITE;
const LOIN = 2 ** 40;
export const caseDe = (x: number, y: number): number => {
  const cx = x >> CASE_BITS;
  const cy = y >> CASE_BITS;
  return (cy < 0 ? 0 : cy >= LIGNES ? LIGNES - 1 : cy) * COLONNES + (cx < 0 ? 0 : cx >= COLONNES ? COLONNES - 1 : cx);
};
/** Les murs de chaque case : ceux dont la boîte, élargie du rayon de la bille et de la marge, touche la case (ceux d'une case du bord, la zone au-delà aussi). Pas les cibles (jouées par leur banque). */
export function grilleDe(murs: readonly Segment[], rayon: number): Segment[][] {
  const taille = 1 << CASE_BITS;
  const marge = rayon + MARGE_GRILLE;
  const g: Segment[][] = [];
  for (let k = 0; k < COLONNES * LIGNES; k++) {
    const cx = k % COLONNES;
    const cy = Math.trunc(k / COLONNES);
    // une case du bord couvre aussi tout ce qui est au-delà
    const x0 = cx === 0 ? -LOIN : cx * taille;
    const x1 = cx === COLONNES - 1 ? LOIN : (cx + 1) * taille;
    const y0 = cy === 0 ? -LOIN : cy * taille;
    const y1 = cy === LIGNES - 1 ? LOIN : (cy + 1) * taille;
    g.push(murs.filter((s) => s.type !== 2 && s.x1 + marge >= x0 && s.x0 - marge <= x1 && s.y1 + marge >= y0 && s.y0 - marge <= y1));
  }
  return g;
}

/** Les points de l'arc du haut (centre 196,25 × 205, rayon 176,25 : 31 points de la maquette), en unités. Calculés hors ligne, entiers. */
const ARC: readonly (readonly [number, number])[] = [
  [81920, 839680], [85875, 764219], [97696, 689584], [117253, 616594], [144333, 546049], [178639, 478720], [219794, 415346], [267349, 356621], [320781, 303189], [379506, 255634], [442880, 214479], [510209, 180173],
  [580754, 153093], [653744, 133536], [728379, 121715], [803840, 117760], [879301, 121715], [953936, 133536], [1026926, 153093], [1097471, 180173], [1164800, 214479], [1228174, 255634], [1286899, 303189],
  [1340331, 356621], [1387886, 415346], [1429041, 478720], [1463347, 546049], [1490427, 616594], [1509984, 689584], [1521805, 764219], [1525760, 839680],
];

const px = (n: number): number => n * UNITE;
/** Un demi-pixel : 372,5 s'écrit `demi(745)`. */
const demi = (n: number): number => div(n * UNITE, 2);

function segment(ax: number, ay: number, bx: number, by: number, e: number, kick = 0, type: 0 | 1 | 2 = 0): Segment {
  const len = racine((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
  return { ax, ay, bx, by, ux: unitaire(bx - ax, len), uy: unitaire(by - ay, len), len, x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by), e, kick, type, banque: -1, cible: -1 };
}

/** La table du jour : le châssis, puis les six emplacements. */
export function construireTable(contenu: Contenu, r: Reglages): Table {
  const plan = planDe(contenu.plan);
  const t: Table = { murs: [], poteaux: [], bumpers: [], spinners: [], trous: [], voies: [], plateaux: [], tourbillons: [], trousNoirs: [], portails: [], geysers: [], coulees: [], banques: [], poses: [], plan: plan.id, rails: [], portes: [], mini: null, verrou: -1, passage: null, sauveur: sauveurDe(), aiguillage: null, grille: [], bandePoteaux: [0, 0], bandeVoies: [0, 0] };
  const mur = (ax: number, ay: number, bx: number, by: number, e: number, kick = 0, type: 0 | 1 = 0): void => void t.murs.push(segment(ax, ay, bx, by, e, kick, type));
  // --- le châssis
  mur(px(20), px(560), px(20), px(205), r.rebondMur);
  for (let i = 0; i < ARC.length - 1; i++) mur(ARC[i]![0], ARC[i]![1], ARC[i + 1]![0], ARC[i + 1]![1], r.rebondMur);
  mur(demi(745), px(205), demi(745), px(718), r.rebondMur); // le mur droit : 372,5
  mur(px(348), px(255), px(348), px(718), r.rebondMur); // le couloir du lanceur
  mur(px(348), px(718), demi(745), px(718), r.rebondFond);
  mur(px(20), px(560), px(118), px(634), r.rebondGuide); // les couloirs de retour : le guide finit sur le batteur, la bille y roule
  mur(px(348), px(560), px(2 * AXE - 118), px(634), r.rebondGuide);
  for (const s of [1, -1]) {
    const x = (v: number): number => px(s > 0 ? v : 2 * AXE - v);
    mur(x(42), px(468), x(42), px(546), 400);
    mur(x(42), px(546), x(92), px(574), 400);
    mur(x(42), px(468), x(92), px(574), 500, r.kickSling * UNITE, 1); // le lance-pierre
  }
  // --- les couloirs du haut : quatre poteaux, trois lampes
  for (const x of [132, 172, 212, 252]) t.poteaux.push({ x: px(x), y: px(100), r: px(5), kick: 0 });
  for (const x of [152, 192, 232]) t.voies.push({ x: px(x), y: px(104) });
  // --- le haut : les rails du plan, son mini-batteur, puis un module par emplacement
  for (const def of plan.orbite ? [...plan.rampes, plan.orbite] : plan.rampes) poserRail(t, def, r);
  if (plan.mini) t.mini = miniDe(plan.mini);
  contenu.modules.forEach((m, i) => poser(t, r, contenu.theme, m, i, px(plan.emplacements[i]!.x), px(plan.emplacements[i]!.y)));
  // lot PBG2 : le verrou est le trou du deuxième emplacement (celui de tous les plans du jour ; le plan d'essai n'en a pas)
  t.verrou = t.poses.find((q) => q.emplacement === 1 && q.type === "trou")?.rang ?? -1;
  // lot PBG3 : la porte (ses murs et son battant), puis l'aiguillage d'une rampe
  if (plan.porte) t.passage = poserPassage(t, plan.porte, r);
  if (plan.aiguillage) t.aiguillage = poserAiguillage(t, plan.aiguillage, contenu, r);
  t.grille = grilleDe(t.murs, RAYON * UNITE);
  t.bandePoteaux = [Math.min(...t.poteaux.map((q) => q.y - q.r - RAYON * UNITE)), Math.max(...t.poteaux.map((q) => q.y + q.r + RAYON * UNITE))];
  t.bandeVoies = [Math.min(...t.voies.map((q) => q.y - 10 * UNITE)), Math.max(...t.voies.map((q) => q.y + 10 * UNITE))];
  return t;
}

/** Le poteau sauveur : au milieu des batteurs (le bas de la table ne change pas : il n'existe que sorti), et la ligne que la bille franchit dans chaque couloir de retour, pour allumer sa lampe. */
const sauveurDe = (): Sauveur => ({
  x: px(SAUVEUR_X),
  y: px(SAUVEUR_Y),
  r: px(SAUVEUR_R),
  lampes: [LAMPE_X, 2 * AXE - LAMPE_X].map((x) => ({ x: px(x), y: px(LAMPE_Y), l: px(LAMPE_DEMI) })),
});

/** **La porte** : deux murs parallèles de `profondeur` px, le battant à leur bout. Tout en entiers (`sinus`, `cosinus`). */
function poserPassage(t: Table, d: DefPorte, r: Reglages): Passage {
  const a = div(d.angle * TOUR, 360);
  const ux = sinus(a); // la direction du passage : (sin a, −cos a) — 0° vers le haut, négatif vers le haut et la gauche
  const uy = -cosinus(a);
  const nx = cosinus(a); // la perpendiculaire (−uy, ux)
  const ny = sinus(a);
  const cx = px(d.x);
  const cy = px(d.y);
  const l = px(d.largeur) / 2;
  const prof = px(d.profondeur);
  const bout = (k: 1 | -1): [number, number] => [cx + div(k * nx * l, NORME), cy + div(k * ny * l, NORME)];
  const [ax, ay] = bout(-1);
  const [bx, by] = bout(1);
  const fond = (x: number, y: number): [number, number] => [x - div(ux * prof, NORME), y - div(uy * prof, NORME)];
  for (const [x, y] of [[ax, ay], [bx, by]] as const) {
    const [fx, fy] = fond(x, y);
    t.murs.push(segment(x, y, fx, fy, 400));
  }
  return { x: cx, y: cy, ux, uy, nx, ny, l, battant: segment(ax, ay, bx, by, r.rebondMur), parBanque: t.banques.length > 0, bouts: [[ax, ay], [bx, by]], profondeur: prof };
}

/** Le rayon de l'élément d'une mission (le disque que la bille quitte en ressortant). */
const RAYON_ELEMENT: Readonly<Record<string, number>> = { manege: 50, tourbillon: 56, portailA: 14, portailB: 14, geyser: 22 };

/** **L'aiguillage** : le point de la rampe à `partie` ‰ de sa longueur, le trajet vers le verrou et celui vers l'élément de la mission du thème. */
function poserAiguillage(t: Table, d: DefAiguillage, contenu: Contenu, r: Reglages): Aiguillage {
  const rail = t.rails[d.rampe]!;
  const s = div(rail.len * d.partie, 1000);
  let k = 0;
  while (k < rail.ux.length - 1 && rail.cum[k + 1]! <= s) k++;
  const x = rail.x[k]! + div(rail.ux[k]! * (s - rail.cum[k]!), NORME);
  const y = rail.y[k]! + div(rail.uy[k]! * (s - rail.cum[k]!), NORME);
  const vers = (ax: number, ay: number): Arrivee => {
    const dist = racine((ax - x) * (ax - x) + (ay - y) * (ay - y));
    return { x: ax, y: ay, pas: Math.max(30, div(dist * 600, Math.max(1, r.aiguillageVitesse) * UNITE)) };
  };
  const trou = t.verrou >= 0 ? t.trous[t.verrou]! : null;
  const cible = t.poses.find((q) => (MODULES_DE_MISSION[MISSION_DU_THEME[contenu.theme]] as readonly string[]).includes(q.type));
  return {
    rail: d.rampe,
    s,
    x,
    y,
    versVerrou: trou ? vers(trou.x, trou.y) : null,
    versElement: cible ? { ...vers(cible.x, cible.y), type: cible.type, r: px(RAYON_ELEMENT[cible.type] ?? 20) } : null,
  };
}

const miniDe = (d: DefMini): MiniBatteur => ({ cote: d.cote, x: px(d.x), y: px(d.y), longueur: px(d.longueur) });

/** Les points de contrôle d'un rail en une courbe lisse : des arcs quadratiques de milieu en milieu (le tracé commence au premier point et finit au dernier, tangent à leur premier et dernier côté), `k` sommets par arc. Entier. */
export function lisser(pts: readonly (readonly [number, number])[], k = 4): [number, number][] {
  const n = pts.length;
  const mil = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [div(a[0] + b[0], 2), div(a[1] + b[1], 2)];
  const sortie: [number, number][] = [[pts[0]![0], pts[0]![1]]];
  for (let i = 1; i < n - 1; i++) {
    const a = i === 1 ? pts[0]! : mil(pts[i - 1]!, pts[i]!);
    const b = i === n - 2 ? pts[n - 1]! : mil(pts[i]!, pts[i + 1]!);
    const c = pts[i]!;
    for (let j = 1; j <= k; j++) {
      const u = k - j;
      sortie.push([div(u * u * a[0] + 2 * u * j * c[0] + j * j * b[0], k * k), div(u * u * a[1] + 2 * u * j * c[1] + j * j * b[1], k * k)]);
    }
  }
  if (n === 2) sortie.push([pts[1]![0], pts[1]![1]]);
  return sortie;
}

/** Un rail et ses bouches : une rampe n'a de bouche qu'à son entrée, l'orbite en a une à chaque bout. */
function poserRail(t: Table, def: DefRail, r: Reglages): void {
  void r;
  const pts = lisser(def.points.map(([x, y]) => [px(x), px(y)] as const));
  const rail: Rail = { genre: def.genre, x: [], y: [], cum: [], ux: [], uy: [], len: 0, hauteur: def.hauteur };
  let cum = 0;
  pts.forEach(([x, y], i) => {
    rail.x.push(x);
    rail.y.push(y);
    rail.cum.push(cum);
    if (i === pts.length - 1) return;
    const [bx, by] = pts[i + 1]!;
    const len = racine((bx - x) * (bx - x) + (by - y) * (by - y));
    rail.ux.push(unitaire(bx - x, len));
    rail.uy.push(unitaire(by - y, len));
    cum += len;
  });
  rail.len = cum;
  const id = t.rails.length;
  t.rails.push(rail);
  const l = px(def.demiPorte);
  const porte = (bout: 0 | 1): void => {
    const i = bout === 0 ? 0 : pts.length - 1;
    // la direction d'entrée : celle du premier segment, ou le contraire de celle du dernier pour la sortie d'une orbite
    const ux = bout === 0 ? rail.ux[0]! : -rail.ux[rail.ux.length - 1]!;
    const uy = bout === 0 ? rail.uy[0]! : -rail.uy[rail.uy.length - 1]!;
    const cx = rail.x[i]!;
    const cy = rail.y[i]!;
    const lx = div(-uy * l, NORME);
    const ly = div(ux * l, NORME);
    t.portes.push({ rail: id, bout, x: cx, y: cy, ux, uy, l, seg: segment(cx - lx, cy - ly, cx + lx, cy + ly, r.rebondGuide) });
  };
  porte(0);
  if (def.genre === "orbite") porte(1);
}

function poser(t: Table, r: Reglages, theme: ThemePinball, module: string, emplacement: number, cx: number, cy: number): void {
  const rangs: Record<string, readonly unknown[]> = { bumpers: t.bumpers, mini: t.bumpers, asteroide: t.bumpers, cibles: t.banques, spinner: t.spinners, trou: t.trous, manege: t.plateaux, tourbillon: t.tourbillons, trouNoir: t.trousNoirs, portailA: t.portails, portailB: t.portails, geyser: t.geysers, coulee: t.coulees };
  const pose: Poser = { type: module, emplacement, x: cx, y: cy, rang: rangs[module]?.length ?? 0, n: 0 };
  t.poses.push(pose);
  const mur = (ax: number, ay: number, bx: number, by: number, e: number): void => void t.murs.push(segment(ax, ay, bx, by, e));
  switch (module) {
    case "bumpers":
      for (const [dx, dy] of [[0, -26], [-27, 17], [27, 17]] as const) t.bumpers.push({ x: cx + px(dx), y: cy + px(dy), r: px(17), kick: (theme === "ocean" ? r.kickBulles : r.kickBumper) * UNITE }); // les Bulles de l'océan sont plus douces
      break;
    case "mini":
      for (const dx of [-24, 24]) t.bumpers.push({ x: cx + px(dx), y: cy, r: px(12), kick: (theme === "ocean" ? r.kickMiniBulles : r.kickMini) * UNITE });
      break;
    case "cibles": {
      // trois cibles posées en travers, face aux batteurs, devant un mur de fond
      const dx = px(AXE) - cx;
      const dy = px(640) - cy;
      const d = racine(dx * dx + dy * dy);
      const ux = unitaire(dx, d);
      const uy = unitaire(dy, d);
      const px_ = -uy; // la perpendiculaire (−dy, dx)
      const py_ = ux;
      const au = (o: number, vx: number, vy: number): [number, number] => [cx + div(vx * px(o), NORME), cy + div(vy * px(o), NORME)];
      const banque: number[] = [];
      [-26, 0, 26].forEach((o, k) => {
        const [ax, ay] = au(o - 10, px_, py_);
        const [bx, by] = au(o + 10, px_, py_);
        const s = segment(ax, ay, bx, by, r.rebondCible, 0, 2);
        s.banque = t.banques.length;
        s.cible = k;
        banque.push(t.murs.length);
        t.murs.push(s);
      });
      t.banques.push(banque);
      const fond = (o: number): [number, number] => {
        const [x, y] = au(o, px_, py_);
        return [x - div(ux * px(9), NORME), y - div(uy * px(9), NORME)];
      };
      const [fax, fay] = fond(-36);
      const [fbx, fby] = fond(36);
      mur(fax, fay, fbx, fby, 300);
      break;
    }
    case "spinner":
      mur(cx - px(24), cy - px(32), cx - px(24), cy + px(30), 400);
      mur(cx + px(24), cy - px(32), cx + px(24), cy + px(30), 400);
      t.spinners.push({ x: cx, y: cy, l: px(22) });
      break;
    case "trou":
      t.trous.push({ x: cx, y: cy, r: px(13) });
      break;
    // --- lot PB3 : les éléments des thèmes (rayons et formes de la maquette)
    case "manege":
      t.plateaux.push({ x: cx, y: cy, r: px(50) });
      break;
    case "tourbillon":
      t.tourbillons.push({ x: cx, y: cy, r: px(56) });
      break;
    case "trouNoir":
      t.trousNoirs.push({ x: cx, y: cy, r: px(95) });
      break;
    case "portailA":
    case "portailB":
      t.portails.push({ x: cx, y: cy, r: px(14), id: module === "portailA" ? 0 : 1 });
      break;
    case "asteroide":
      // le bumper qui se déplace (amplitude 46 px) et, près de lui, un petit bumper qui ne bouge pas
      t.bumpers.push({ x: cx, y: cy, r: px(16), kick: r.kickBumper * UNITE, mobile: { x0: cx, amp: px(46) }, vx: 0 });
      t.bumpers.push({ x: cx - px(30), y: cy + px(34), r: px(12), kick: r.kickMini * UNITE });
      break;
    case "geyser":
      t.geysers.push({ x: cx, y: cy, r: px(22) });
      break;
    case "coulee":
      mur(cx - px(20), cy - px(50), cx - px(20), cy + px(40), 400);
      mur(cx + px(20), cy - px(50), cx + px(20), cy + px(40), 400);
      t.coulees.push({ x: cx, y: cy, l: px(18), h: px(45) });
      break;
    default:
      throw new Error(`module inconnu : ${module}`);
  }
  pose.n = (rangs[module]?.length ?? 0) - pose.rang;
}

