import { AXE, NORME, UNITE } from "./constantes";
import { racine, unitaire, div } from "./entiers";
import type { Contenu } from "./generateur";
import { EMPLACEMENTS } from "./generateur";
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
export interface Poser {
  type: string;
  emplacement: number;
  x: number;
  y: number;
}
export interface Table {
  murs: Segment[];
  poteaux: Cercle[];
  bumpers: Cercle[];
  spinners: Spinner[];
  trous: Trou[];
  voies: Voie[];
  /** Le nombre de banques de cibles et, pour chacune, les rangs de ses cibles dans `murs`. */
  banques: number[][];
  /** Ce qui est posé à chaque emplacement (rendu, essais). */
  poses: Poser[];
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
  const t: Table = { murs: [], poteaux: [], bumpers: [], spinners: [], trous: [], voies: [], banques: [], poses: [] };
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
  // --- le haut : un module par emplacement
  contenu.modules.forEach((m, i) => poser(t, r, m, i, px(EMPLACEMENTS[i]!.x), px(EMPLACEMENTS[i]!.y)));
  return t;
}

function poser(t: Table, r: Reglages, module: string, emplacement: number, cx: number, cy: number): void {
  t.poses.push({ type: module, emplacement, x: cx, y: cy });
  const mur = (ax: number, ay: number, bx: number, by: number, e: number): void => void t.murs.push(segment(ax, ay, bx, by, e));
  switch (module) {
    case "bumpers":
      for (const [dx, dy] of [[0, -26], [-27, 17], [27, 17]] as const) t.bumpers.push({ x: cx + px(dx), y: cy + px(dy), r: px(17), kick: r.kickBumper * UNITE });
      break;
    case "mini":
      for (const dx of [-24, 24]) t.bumpers.push({ x: cx + px(dx), y: cy, r: px(12), kick: r.kickMini * UNITE });
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
    default:
      throw new Error(`module inconnu : ${module}`);
  }
}

