import { RAYON, UNITE } from "./constantes";
import { div, racine } from "./entiers";
import { dailyPinball, type Contenu } from "./generateur";
import { Partie } from "./partie";
import { REGLAGES, type Reglages } from "./reglages";
import type { Table } from "./table";
import { dansLaZoneDeTir, fenetresDeTir, FENETRE_MIN_MS, FENETRE_MIN_PAS, pasEnMs } from "./tir";
import { nomDuModule } from "./validation";
import { ECART_BOUCHE_MAX, POINT_DES_BATTEURS } from "./eventail";

// CONCEVOIR UNE TABLE (lot PBT0) — « une table est dessinée d'un seul tenant ». Retour de Nathan après PBL2 : « La partie du haut est inatteignable : il y a trop de rails, de rochers et d'autres éléments qui bloquent l'accès au
// haut de la table, et la vue. » La cause : chaque table était un empilement (un plan place deux rampes, une orbite, une porte et un aiguillage, puis on tire des modules dans six emplacements, et chaque lot a ajouté sa couche),
// et rien ne pensait la table comme un tout. Ce fichier **garde les règles de conception**, que chaque plan d'essai (`t1` à `t6` et leurs miroirs, `plans-essai.ts`) respecte et que `test/conception.test.ts` vérifie :
//   · **5 à 7 tirs**, chacun avec la fenêtre de tir humaine du lot PBL2 (au moins 30 ms depuis un grand batteur) : `fenetresDeConception` ;
//   · **au plus une rampe et une orbite**, dont les rails **ne se croisent pas** et **ne passent jamais au-dessus d'un objectif, d'un bumper, d'un module ni d'une bouche** (ils longent les bords ou passent au-dessus d'une zone
//     sans objectif) : `railsGenants` ;
//   · **les bumpers sont regroupés dans une poche en haut** et jamais dans la zone de tir : `pocheEnDefaut` ;
//   · **la zone de tir libre du lot PBL2 reste vide** (aucun mur de module : `obstaclesDansLaZone`) ;
//   · **un budget de densité** : la part du haut du plateau que les obstacles et la projection des rails occupent reste sous `DENSITE_MAX` : `densite`.
// Tout est en pixels entiers (le paquet n'a pas un flottant : `test/entiers.test.ts`) ; les distances se comparent au carré. **La visibilité** (aucun objectif ni bumper caché par un rail dans la vue de la caméra) se mesure dans
// le jeu, qui seul connaît la caméra et les maillages des rails : `apps/pinball/test/visibilite.test.ts`.

/** Au moins 5 tirs, au plus 7 : la table se joue sans qu'un tir soit une obligation et sans que le choix se perde. */
export const TIRS_MIN = 5;
export const TIRS_MAX = 7;
/** La largeur d'un rail à plat (px) : celle du rendu (`largeurDuRail` du jeu la lit ici) — un fil fin, pas un ruban. Les rails comptent pour cette largeur dans le budget de densité et dans le dégagement. */
export const LARGEUR_RAIL = 12;
/** Le dégagement d'un rail : la distance minimale (px) entre son axe et le bord d'un obstacle (en plus de sa demi-largeur) — de quoi laisser voir le module en perspective, le rail étant en hauteur. */
export const DEGAGEMENT_RAIL = 14;
/** L'écart minimal (px) entre les axes de deux rails : ils ne se croisent ni ne se frôlent. */
export const ECART_RAILS = 30;
/** La poche des bumpers : tous les bumpers sont au-dessus de cette ligne (px), dans un groupe dont les emplacements ne sont pas à plus de `POCHE_ETENDUE` px l'un de l'autre. */
export const POCHE_Y_MAX = 250;
export const POCHE_ETENDUE = 110;
/** L'écart minimal (px) entre deux obstacles de deux modules différents (le trio et le manège, la porte et les cibles…) et entre un obstacle et un mur du châssis : de quoi laisser voir chacun et passer la bille. */
export const ECART_OBSTACLES = 8;
/**
 * Le budget de densité (‰ du haut du plateau) : **250**. Mesuré (README du lot PBT0, `npm run densites:pinball`) : la table que Nathan a rendue — Volcan × « doublette », rails de 18 px — occupe 336 ‰ (obstacles 100, **rails 254**), les 94 tables du jour
 * 315 ‰ en médiane (248 à 391) ; les plans d'essai de 131 à 231 ‰ (rails de 12 px : 60 à 87 ‰). Le plafond est le pire plan d'essai plus 8 % : il refuse la table de Nathan et la moitié des tables du jour.
 */
export const DENSITE_MAX = 250;
/** Le haut du plateau, où la densité se mesure : au-dessus des lance-pierres (y < 470), à l'intérieur du châssis. */
export const DENSITE_Y_MAX = 470;
const CASE = 4;

/** Une forme posée sur le plateau, en pixels : un disque, ou une capsule (un segment épaissi de `r`). */
export type Forme = { nom: string; genre: "disque"; x: number; y: number; r: number } | { nom: string; genre: "capsule"; ax: number; ay: number; bx: number; by: number; r: number };

const px = (u: number): number => div(u, UNITE);

/** Les rayons de l'empreinte visible de chaque élément d'un thème (px) : le disque que le joueur voit, pas la zone d'attraction du trou noir (95 px, une force sans mur). */
const EMPRISE_ELEMENT: Readonly<Record<string, number>> = { manege: 50, tourbillon: 56, trouNoir: 36, portailA: 16, portailB: 16, geyser: 24, trou: 16 };

/**
 * **Les obstacles d'une table**, en pixels : tout ce que le joueur voit posé sur le plateau — bumpers (l'astéroïde : sa course entière), banques de cibles, spinner, coulée, trou, éléments des thèmes, murs et battant de la porte,
 * mini-batteur (au repos et levé), et les bouches des rails (`bouche:<rail>:<bout>`, un segment). Les murs du châssis n'y sont pas (les rails les longent).
 */
export function formesDeLaTable(table: Table): Forme[] {
  const sortie: Forme[] = [];
  for (const q of table.poses) {
    const nom = nomDuModule(q);
    const cx = px(q.x);
    const cy = px(q.y);
    switch (q.type) {
      case "bumpers":
      case "mini":
      case "asteroide":
        for (let i = q.rang; i < q.rang + q.n; i++) {
          const b = table.bumpers[i]!;
          if (b.mobile) sortie.push({ nom, genre: "capsule", ax: px(b.mobile.x0 - b.mobile.amp), ay: px(b.y), bx: px(b.mobile.x0 + b.mobile.amp), by: px(b.y), r: px(b.r) });
          else sortie.push({ nom, genre: "disque", x: px(b.x), y: px(b.y), r: px(b.r) });
        }
        break;
      case "cibles":
        for (let i = q.m0; i < q.m1; i++) {
          const s = table.murs[i]!;
          sortie.push({ nom, genre: "capsule", ax: px(s.ax), ay: px(s.ay), bx: px(s.bx), by: px(s.by), r: 7 });
        }
        break;
      case "spinner":
        sortie.push({ nom, genre: "capsule", ax: cx, ay: cy - 32, bx: cx, by: cy + 30, r: 24 });
        break;
      case "coulee":
        sortie.push({ nom, genre: "capsule", ax: cx, ay: cy - 50, bx: cx, by: cy + 40, r: 20 });
        break;
      default:
        sortie.push({ nom, genre: "disque", x: cx, y: cy, r: EMPRISE_ELEMENT[q.type] ?? 20 });
    }
  }
  if (table.passage) {
    const p = table.passage;
    sortie.push({ nom: "porte", genre: "capsule", ax: px(p.battant.ax), ay: px(p.battant.ay), bx: px(p.battant.bx), by: px(p.battant.by), r: 6 });
    // ses deux murs : les deux derniers de `murs`
    for (let i = table.murs.length - 2; i < table.murs.length; i++) {
      const s = table.murs[i]!;
      sortie.push({ nom: "porte", genre: "capsule", ax: px(s.ax), ay: px(s.ay), bx: px(s.bx), by: px(s.by), r: 6 });
    }
  }
  if (table.mini) {
    const m = table.mini;
    const x = m.cote === 0 ? px(m.x) : 368 - px(m.x);
    const sens = m.cote === 0 ? 1 : -1;
    const l = px(m.longueur);
    // au repos le batteur descend de 20° vers le centre ; levé, il monte de 30° : l'empreinte est l'éventail des deux
    sortie.push({ nom: "mini-batteur", genre: "capsule", ax: x, ay: px(m.y), bx: x + sens * div(l * 94, 100), by: px(m.y) + div(l * 34, 100), r: 8 });
    sortie.push({ nom: "mini-batteur", genre: "capsule", ax: x, ay: px(m.y), bx: x + sens * div(l * 87, 100), by: px(m.y) - div(l * 50, 100), r: 8 });
  }
  table.portes.forEach((g) => sortie.push({ nom: `bouche:${g.rail}:${g.bout}`, genre: "capsule", ax: px(g.seg.ax), ay: px(g.seg.ay), bx: px(g.seg.bx), by: px(g.seg.by), r: 4 }));
  return sortie;
}

/** Les couloirs du haut (quatre poteaux, trois lampes : le châssis, fixes) : rien ne se pose dessus, aucun rail ne passe dessus. */
const VOIES: Forme = { nom: "voies", genre: "capsule", ax: 132, ay: 100, bx: 252, by: 104, r: 12 };

/** L'axe d'un rail en pixels : la liste de ses sommets. */
export const axeDuRail = (table: Table, i: number): [number, number][] => {
  const r = table.rails[i]!;
  return r.x.map((x, k) => [px(x), px(r.y[k]!)]);
};

// --- la géométrie entière : distances au carré

const carre = (n: number): number => n * n;
/** Le carré (entier) de la distance du point (x, y) au segment [a, b]. */
export function d2PointSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = (x - ax) * dx + (y - ay) * dy;
  if (l2 === 0 || t <= 0) return carre(x - ax) + carre(y - ay);
  if (t >= l2) return carre(x - bx) + carre(y - by);
  const croix = (x - ax) * dy - (y - ay) * dx;
  return div(croix * croix, l2);
}
const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
};
const secants = (a: readonly number[], b: readonly number[]): boolean => {
  const [ax, ay, bx, by] = a as [number, number, number, number];
  const [cx, cy, dx, dy] = b as [number, number, number, number];
  return orient(ax, ay, bx, by, cx, cy) * orient(ax, ay, bx, by, dx, dy) < 0 && orient(cx, cy, dx, dy, ax, ay) * orient(cx, cy, dx, dy, bx, by) < 0;
};
/** Le carré de la distance entre deux segments (0 s'ils se croisent). */
export function d2SegmentSegment(a: readonly number[], b: readonly number[]): number {
  if (secants(a, b)) return 0;
  const [ax, ay, bx, by] = a as [number, number, number, number];
  const [cx, cy, dx, dy] = b as [number, number, number, number];
  return Math.min(d2PointSegment(ax, ay, cx, cy, dx, dy), d2PointSegment(bx, by, cx, cy, dx, dy), d2PointSegment(cx, cy, ax, ay, bx, by), d2PointSegment(dx, dy, ax, ay, bx, by));
}
/** Le carré de la distance minimale entre deux lignes brisées. */
export function d2Lignes(a: readonly (readonly [number, number])[], b: readonly (readonly [number, number])[]): number {
  let m = Infinity;
  for (let i = 0; i < a.length - 1; i++) for (let j = 0; j < b.length - 1; j++) m = Math.min(m, d2SegmentSegment([a[i]![0], a[i]![1], a[i + 1]![0], a[i + 1]![1]], [b[j]![0], b[j]![1], b[j + 1]![0], b[j + 1]![1]]));
  return m;
}
/** Le carré de la distance de la ligne brisée `axe` à la forme `f`, moins son rayon : négatif ou nul s'il la touche (la comparaison se fait avec `d2 ≤ (r + marge)²`, donc ici on rend la distance entre les axes). */
function d2LigneForme(axe: readonly (readonly [number, number])[], f: Forme): number {
  let m = Infinity;
  for (let i = 0; i < axe.length - 1; i++) {
    const [ax, ay] = axe[i]!;
    const [bx, by] = axe[i + 1]!;
    m = Math.min(m, f.genre === "disque" ? d2PointSegment(f.x, f.y, ax, ay, bx, by) : d2SegmentSegment([ax, ay, bx, by], [f.ax, f.ay, f.bx, f.by]));
  }
  return m;
}

/** Un rail qui gêne : son nom, ce qu'il gêne et de combien il manque (px, au dixième). */
export interface RailGenant {
  rail: string;
  avec: string;
  /** La distance entre les axes, arrondie vers le bas, et celle qu'il fallait. */
  distance: number;
  requis: number;
}

/** Le nom d'un rail dans les rapports : `rampe` ou `orbite`. */
const nomRail = (table: Table, i: number): string => table.rails[i]!.genre;

/**
 * **Les rails qui gênent** : un rail ne passe jamais au-dessus d'un obstacle (bumper, module, objectif, porte, bouche d'un autre rail : `formesDeLaTable`) à moins de `DEGAGEMENT_RAIL` px de son bord (en plus de sa demi-largeur),
 * et deux rails sont à `ECART_RAILS` px l'un de l'autre au moins. Les bouches d'un rail sont à lui, il les quitte : seules celles des autres comptent. Vide si la table respecte la règle.
 */
export function railsGenants(table: Table): RailGenant[] {
  const sortie: RailGenant[] = [];
  const formes = [...formesDeLaTable(table), VOIES];
  const demi = div(LARGEUR_RAIL, 2);
  table.rails.forEach((_, i) => {
    const axe = axeDuRail(table, i);
    for (const f of formes) {
      // les bouches d'un rail sont à lui, et la porte est celle de son orbite (le battant est à 26 px de la bouche) : il les quitte
      if (f.nom.startsWith(`bouche:${i}:`) || (f.nom === "porte" && table.rails[i]!.genre === "orbite")) continue;
      const requis = f.r + demi + DEGAGEMENT_RAIL;
      const d2 = d2LigneForme(axe, f);
      if (d2 < requis * requis) sortie.push({ rail: nomRail(table, i), avec: f.nom, distance: racine(d2), requis });
    }
    for (let j = i + 1; j < table.rails.length; j++) {
      const d2 = d2Lignes(axe, axeDuRail(table, j));
      if (d2 < ECART_RAILS * ECART_RAILS) sortie.push({ rail: nomRail(table, i), avec: nomRail(table, j), distance: racine(d2), requis: ECART_RAILS });
    }
  });
  return sortie;
}

/** Une forme est-elle dans le châssis, à `ECART_OBSTACLES` du mur ? (l'arc : centre (196, 205), rayon 176 ; le mur gauche à x = 20, le couloir du lanceur à x = 348) */
function dansLesMurs(f: Forme): boolean {
  const pts: [number, number][] = f.genre === "disque" ? [[f.x, f.y]] : [[f.ax, f.ay], [f.bx, f.by]];
  const m = f.r + ECART_OBSTACLES;
  for (const [x, y] of pts) {
    if (x - m < 20 || x + m > 348) return false;
    if (y < 205 && carre(x - 196) + carre(y - 205) > carre(176 - m)) return false;
  }
  return true;
}

/**
 * **Les obstacles qui se touchent** : deux obstacles de deux modules différents à moins de `ECART_OBSTACLES` px l'un de l'autre (bords), les couloirs du haut du châssis, ou un obstacle trop près d'un mur. Chaque module reste
 * lisible : rien n'est posé contre un autre. Vide si la table est claire.
 */
export function obstaclesQuiSeTouchent(table: Table): string[] {
  const sortie: string[] = [];
  const formes = [...formesDeLaTable(table).filter((f) => !f.nom.startsWith("bouche:")), VOIES];
  const coeur = (f: Forme): number[] => (f.genre === "disque" ? [f.x, f.y, f.x, f.y] : [f.ax, f.ay, f.bx, f.by]);
  for (const f of formes) if (f.nom !== "voies" && !dansLesMurs(f)) sortie.push(`${f.nom} est trop près d'un mur`);
  for (let i = 0; i < formes.length; i++) {
    for (let j = i + 1; j < formes.length; j++) {
      const a = formes[i]!;
      const b = formes[j]!;
      if (a.nom === b.nom) continue;
      const requis = a.r + b.r + ECART_OBSTACLES;
      if (d2SegmentSegment(coeur(a), coeur(b)) < requis * requis) sortie.push(`${a.nom} et ${b.nom} se touchent`);
    }
  }
  return [...new Set(sortie)];
}

/** Les bouts des deux grands batteurs (px), d'où se mesure ce qu'une bouche voit. */
const BOUTS_DES_BATTEURS: readonly (readonly [number, number])[] = [[172, 655], [196, 655]];
/** La tangente de `ECART_BOUCHE_MAX` (25°), en dix-millièmes : 0,4663. */
const TANGENTE_ECART = 4663;
/** Le haut réservé à la poche des bumpers et aux couloirs du haut : aucun autre obstacle n'y monte (px). */
export const HAUT_RESERVE_Y = 205;

/**
 * **Une bouche est libre** (lot PBT0b) : la ligne entre chaque bout de batteur et chaque bouche de rail ne touche aucun obstacle (à une bille de distance, plus 2 px). « Plus jamais de mur devant une rampe » : retour de Nathan sur le lot PBT0.
 * La porte d'une orbite ferme exprès sa bouche : elle n'est pas un obstacle pour les bouches de cette orbite (sa fenêtre de tir est mesurée à part). Vide si toutes les bouches sont libres.
 */
export function bouchesBloquees(table: Table): string[] {
  const sortie: string[] = [];
  const formes = formesDeLaTable(table).filter((f) => !f.nom.startsWith("bouche:"));
  for (const g of table.portes) {
    const mx = px(g.x);
    const my = px(g.y);
    const orbiteLe = table.rails[g.rail]!.genre === "orbite";
    for (const [bx, by] of BOUTS_DES_BATTEURS) {
      for (const f of formes) {
        if (f.nom === "porte" && orbiteLe) continue;
        const cur = f.genre === "disque" ? [f.x, f.y, f.x, f.y] : [f.ax, f.ay, f.bx, f.by];
        const requis = f.r + RAYON + 2;
        if (d2SegmentSegment(cur, [bx, by, mx, my]) < requis * requis) sortie.push(`la bouche du rail ${table.rails[g.rail]!.genre} (${mx}, ${my}) n'est pas libre : ${f.nom} est sur la ligne des batteurs`);
      }
    }
  }
  return [...new Set(sortie)];
}

/** **Une bouche regarde les batteurs** : son axe d'entrée est tourné vers le point entre les batteurs, à `ECART_BOUCHE_MAX` degrés près (tangente de 25° : 4663 dix-millièmes). */
export function bouchesDeTravers(table: Table): string[] {
  const sortie: string[] = [];
  for (const g of table.portes) {
    const vx = px(g.x) - POINT_DES_BATTEURS.x;
    const vy = px(g.y) - POINT_DES_BATTEURS.y;
    const dot = g.ux * vx + g.uy * vy;
    const croix = Math.abs(g.ux * vy - g.uy * vx);
    if (dot <= 0 || croix * 10000 > dot * TANGENTE_ECART) sortie.push(`la bouche du rail ${table.rails[g.rail]!.genre} (${px(g.x)}, ${px(g.y)}) ne regarde pas les batteurs (plus de ${ECART_BOUCHE_MAX}°)`);
  }
  return sortie;
}

/** **Le haut est réservé** à la poche des bumpers et aux couloirs du haut : tout autre obstacle commence sous `HAUT_RESERVE_Y`. */
export function hautOccupe(table: Table): string[] {
  const sortie: string[] = [];
  for (const f of formesDeLaTable(table)) {
    if (f.nom.startsWith("bouche:") || MODULES_DE_BUMPERS.some((m) => f.nom.endsWith(`:${m}`))) continue;
    const haut = (f.genre === "disque" ? f.y : Math.min(f.ay, f.by)) - f.r;
    if (haut < HAUT_RESERVE_Y) sortie.push(`${f.nom} monte dans le haut réservé aux bumpers (y = ${haut})`);
  }
  return sortie;
}

/** Les modules de bumpers d'une table (le trio, la paire, l'astéroïde) : la poche. */
export const MODULES_DE_BUMPERS: readonly string[] = ["bumpers", "mini", "asteroide"];

/** La poche des bumpers en défaut : ce qui sort de `POCHE_Y_MAX`, de `POCHE_ETENDUE`, ou entre dans la zone de tir. Vide si la poche est bonne. */
export function pocheEnDefaut(table: Table): string[] {
  const sortie: string[] = [];
  const poche = table.poses.filter((q) => MODULES_DE_BUMPERS.includes(q.type));
  for (const q of poche) {
    if (px(q.y) > POCHE_Y_MAX) sortie.push(`${nomDuModule(q)} est trop bas (${px(q.y)} > ${POCHE_Y_MAX})`);
  }
  for (let i = 0; i < poche.length; i++) {
    for (let j = i + 1; j < poche.length; j++) {
      const d2 = carre(px(poche[i]!.x) - px(poche[j]!.x)) + carre(px(poche[i]!.y) - px(poche[j]!.y));
      if (d2 > POCHE_ETENDUE * POCHE_ETENDUE) sortie.push(`${nomDuModule(poche[i]!)} et ${nomDuModule(poche[j]!)} ne sont pas dans la même poche`);
    }
  }
  for (const f of formesDeLaTable(table)) {
    if (!MODULES_DE_BUMPERS.some((m) => f.nom.endsWith(`:${m}`))) continue;
    if (formeDansLaZone(f)) sortie.push(`${f.nom} est dans la zone de tir`);
  }
  return sortie;
}

/** Une forme touche-t-elle la zone de tir (les cases de 4 px des trajectoires du geste de référence) ? */
export function formeDansLaZone(f: Forme): boolean {
  const x0 = f.genre === "disque" ? f.x : Math.min(f.ax, f.bx);
  const x1 = f.genre === "disque" ? f.x : Math.max(f.ax, f.bx);
  const y0 = f.genre === "disque" ? f.y : Math.min(f.ay, f.by);
  const y1 = f.genre === "disque" ? f.y : Math.max(f.ay, f.by);
  for (let y = y0 - f.r; y <= y1 + f.r; y += CASE) {
    for (let x = x0 - f.r; x <= x1 + f.r; x += CASE) {
      const d2 = f.genre === "disque" ? carre(x - f.x) + carre(y - f.y) : d2PointSegment(x, y, f.ax, f.ay, f.bx, f.by);
      if (d2 <= f.r * f.r && dansLaZoneDeTir(x, y)) return true;
    }
  }
  return false;
}

/** Une case du haut du plateau est-elle dans le châssis ? (l'arc : centre (196, 205), rayon 176 ; en dessous de y = 205, entre le mur gauche et le couloir du lanceur) */
const dansLeChassis = (x: number, y: number): boolean => (y < 205 ? carre(x - 196) + carre(y - 205) <= 176 * 176 : x >= 20 && x <= 348);

/** Ce que la densité mesure et en combien de cases : le rapport. */
export interface Densite {
  /** Les obstacles seuls, les rails seuls et les deux ensemble : ‰ du haut du plateau (au-dessus de `DENSITE_Y_MAX`). */
  obstacles: number;
  rails: number;
  total: number;
}

/**
 * **Le budget de densité** : la part du haut du plateau (le châssis au-dessus de y = 470, en cases de 4 px) que couvrent les obstacles (`formesDeLaTable`, sans les bouches : elles sont des rails) et **la projection à plat
 * des rails** (leur axe épaissi de `LARGEUR_RAIL`), en ‰. Sous `DENSITE_MAX`. Le contre-exemple chiffré : la table que Nathan a rendue (Volcan, plan « doublette » après le lot PBL2, rails de 18 px) : voir le README du lot PBT0.
 */
export function densite(table: Table, largeurRail: number = LARGEUR_RAIL): Densite {
  const formes = formesDeLaTable(table).filter((f) => !f.nom.startsWith("bouche:"));
  const axes = table.rails.map((_, i) => axeDuRail(table, i));
  const demi = div(largeurRail, 2);
  let champ = 0;
  let o = 0;
  let r = 0;
  let t = 0;
  for (let y = CASE; y < DENSITE_Y_MAX; y += CASE) {
    for (let x = 20 + div(CASE, 2); x < 348; x += CASE) {
      if (!dansLeChassis(x, y)) continue;
      champ++;
      const sousObstacle = formes.some((f) => (f.genre === "disque" ? carre(x - f.x) + carre(y - f.y) <= f.r * f.r : d2PointSegment(x, y, f.ax, f.ay, f.bx, f.by) <= f.r * f.r));
      let sousRail = false;
      for (const a of axes) {
        for (let i = 0; i < a.length - 1 && !sousRail; i++) if (d2PointSegment(x, y, a[i]![0], a[i]![1], a[i + 1]![0], a[i + 1]![1]) <= demi * demi) sousRail = true;
        if (sousRail) break;
      }
      if (sousObstacle) o++;
      if (sousRail) r++;
      if (sousObstacle || sousRail) t++;
    }
  }
  return { obstacles: div(o * 1000, champ), rails: div(r * 1000, champ), total: div(t * 1000, champ) };
}

// --- Les tirs : 5 à 7, chacun avec sa fenêtre

/**
 * Les tirs d'une table et leur fenêtre (ms, depuis le meilleur batteur) : `mission`, `verrou`, `rampe1`, `orbite`, `porte`, une ligne par banque de cibles (`S4:cibles`) et, **seulement quand elle atteint le seuil, la poche** des
 * bumpers (`poche` : nourrie par l'orbite et les couloirs du haut, elle n'est pas un tir obligatoire).
 */
export interface TirsDeConception {
  ms: Record<string, number>;
  /** Les tirs sous le seuil humain (30 ms). */
  manquants: string[];
  /** **Le nombre de tirs du plan** (une propriété du plan, la même dans les quatre thèmes) : la mission, le verrou, chaque rail, la porte et chaque banque de cibles — l'Espace remplace une banque par un portail, qui reste un tir (c'est un de ses deux portails de la mission). */
  nombre: number;
  /** La fenêtre (ms) d'un tir direct sur la poche, à titre indicatif : elle ne compte parmi les tirs que si elle atteint le seuil. */
  pocheMs: number;
}

/** La plus longue série d'étiquettes consécutives qui sont dans `noms` (pas). */
function serieDans(etiquettes: readonly string[], noms: ReadonlySet<string>): number {
  let pire = 0;
  let serie = 0;
  for (const e of etiquettes) {
    serie = noms.has(e) ? serie + 1 : 0;
    if (serie > pire) pire = serie;
  }
  return pire;
}

/** Le nombre de tirs d'un plan, lu sur sa table du thème « foire » (qui n'échange aucune banque contre un portail). */
export function nombreDeTirs(plan: string): number {
  const t = new Partie(dailyPinball(0, undefined, "foire", plan)).table;
  return 2 + t.rails.length + (t.passage ? 1 : 0) + t.poses.filter((q) => q.type === "cibles").length;
}

/** Les tirs d'une table : les objectifs du lot PBL2 (`fenetresDeTir`), plus chaque banque de cibles et, si elle se vise, la poche de bumpers. */
export function tirsDeConception(contenu: Contenu, reglages: Reglages = REGLAGES): TirsDeConception {
  const f = fenetresDeTir(contenu, reglages);
  const table = new Partie(contenu, reglages).table;
  const ms: Record<string, number> = { ...f.ms };
  const manquants = [...f.manquants];
  const meilleure = (noms: ReadonlySet<string>): number => Math.max(serieDans(f.fermee[0], noms), serieDans(f.fermee[1], noms));
  for (const q of table.poses.filter((q) => q.type === "cibles")) {
    const pas = meilleure(new Set([nomDuModule(q)]));
    ms[nomDuModule(q)] = pasEnMs(pas);
    if (pas < FENETRE_MIN_PAS) manquants.push(nomDuModule(q));
  }
  const poche = new Set(table.poses.filter((q) => MODULES_DE_BUMPERS.includes(q.type)).map((q) => nomDuModule(q)));
  const pocheMs = pasEnMs(meilleure(poche));
  if (poche.size > 0 && pocheMs >= FENETRE_MIN_MS) ms["poche"] = pocheMs;
  return { ms, manquants, nombre: nombreDeTirs(contenu.plan), pocheMs };
}

/** Un rapport complet des règles **sans simulation** : les rails, la poche, les obstacles de la zone de tir et la densité. Vide si la table est bonne ; chaque ligne dit ce qui ne va pas. */
export function defautsDeConception(table: Table, densiteMax: number = DENSITE_MAX): string[] {
  const sortie: string[] = [];
  const rampes = table.rails.filter((r) => r.genre === "rampe").length;
  const orbites = table.rails.filter((r) => r.genre === "orbite").length;
  if (rampes > 1) sortie.push(`${rampes} rampes (une au plus)`);
  if (orbites > 1) sortie.push(`${orbites} orbites (une au plus)`);
  for (const g of railsGenants(table)) sortie.push(`le rail ${g.rail} gêne ${g.avec} (${g.distance} px, il en faut ${g.requis})`);
  sortie.push(...obstaclesQuiSeTouchent(table));
  sortie.push(...bouchesBloquees(table), ...bouchesDeTravers(table), ...hautOccupe(table));
  sortie.push(...pocheEnDefaut(table));
  const d = densite(table);
  if (d.total > densiteMax) sortie.push(`densité ${d.total} ‰ (obstacles ${d.obstacles}, rails ${d.rails}) : plafond ${densiteMax} ‰`);
  return sortie;
}
