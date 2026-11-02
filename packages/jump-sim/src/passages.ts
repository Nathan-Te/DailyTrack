import { PALIER_HEADROOM_ROWS, PASSAGE_ZONE_COLS, PASSAGE_ZONE_ROWS } from "./constants";
import { TILE_SOLID, isSpikeTile, type Cell, type Level } from "./level";
import type { Palier } from "./modules";

// **Aucun raccourci par point de passage (lot 32, générateur g26).** Un point de passage est posé au début d'un palier, et depuis la version 14 de la simulation il ne se valide que sur ce palier
// (`passageZoneAt` : le centre dans les deux colonnes du palier, les pieds à moins de 3 rangées du sol). Reste à garantir qu'on ne rejoint pas ce palier sans faire la portion qui le précède :
//   - le palier est une **pièce fermée** : du sol, `PALIER_HEADROOM_ROWS` rangées libres (de quoi sauter à pleine hauteur), puis du plein. L'assemblage de la version 14 ferme le puits à cette hauteur
//     (avant, il montait jusqu'en haut du plus haut des deux morceaux voisins : le 02/11/2026, « Jump n° 18 », on franchissait le puits à pics du premier morceau par le haut, puis on tombait dans le
//     puits du palier) ;
//   - on n'y entre que par **trois accès** : le côté gauche (la fin de la portion, au ras du sol : `PALIER_HEADROOM_ROWS` rangées), le côté droit (le morceau suivant), et la descente de la voie
//     lente de la portion (par le haut, creusée dans le plein) — dont l'entrée, la cage, est l'autre accès légitime de la portion.
// La règle (`checkpointShortcutProblems`) le vérifie **case par case sur le niveau assemblé** : une propagation à travers les cases libres (4 voisins, optimiste : elle ignore la physique) part du palier
// d'avant (ou du départ) et ne doit pas atteindre la zone du palier quand on lui ferme les deux accès légitimes (le côté gauche, l'entrée de la voie lente). Ce qu'elle atteint est un raccourci
// possible ; `tools/raccourcis.ts` le confirme par le solveur (appuis humains) pour les mesures, `test/passages.test.ts` pour les tests.


/**
 * La zone d'un point de passage (l'endroit où il se valide) vue comme des cases : les colonnes du palier, de la rangée du fanion (le sol est celle d'en dessous) vers le haut
 * sur `PASSAGE_ZONE_ROWS` rangées.
 */
export function passageZoneCells(palier: Palier): Cell[] {
  const out: Cell[] = [];
  for (let c = palier.col0; c < palier.col0 + PASSAGE_ZONE_COLS; c++) for (let r = palier.row - PASSAGE_ZONE_ROWS; r <= palier.row - 1; r++) out.push({ col: c, row: r });
  return out;
}

/**
 * Les cases par lesquelles on arrive légitimement au palier depuis la gauche : la colonne qui touche le palier, sur les `PALIER_HEADROOM_ROWS` rangées au ras du sol (la fin de la portion qui le
 * précède). Les fermer, c'est demander s'il y a un autre chemin.
 */
export function leftJointCells(palier: Palier): Cell[] {
  const out: Cell[] = [];
  for (let r = palier.row - PALIER_HEADROOM_ROWS; r <= palier.row - 1; r++) out.push({ col: palier.col0 - 1, row: r });
  return out;
}

/** L'entrée de la cage d'une voie lente (l'ouverture du mur gauche, `slowShortcutProblems`) : la colonne `zone`, rangées E−5 à E−3. */
export function cageEntranceCells(route: { zone: number; entryRow: number }): Cell[] {
  const out: Cell[] = [];
  for (let r = route.entryRow - 5; r <= route.entryRow - 3; r++) out.push({ col: route.zone, row: r });
  return out;
}

/** Les cases libres du niveau (ni plein, ni pic) vues par une propagation à 4 voisins : un bloc qui clignote, qui alterne ou qui se brise est tantôt là, tantôt non, donc il laisse passer (recherche optimiste). */
function openCells(level: Level): Uint8Array {
  const open = new Uint8Array(level.width * level.height);
  for (let i = 0; i < open.length; i++) {
    const t = level.tiles[i]!;
    open[i] = t === TILE_SOLID || isSpikeTile(t) ? 0 : 1;
  }
  return open;
}

/**
 * Propage depuis `from` à travers les cases libres `open` de `level` sans entrer dans `closed` ; rend vrai si une case de `goal` est atteinte. Optimiste (pas de physique : un chemin qui n'existe pas ici
 * n'existe pas non plus pour le personnage), donc ce qu'elle trouve est un raccourci *possible*. `open` n'est pas modifié (les cases fermées sont remises avant de rendre la main).
 */
function reachableIn(level: Level, open: Uint8Array, from: readonly Cell[], goal: readonly Cell[], closed: readonly Cell[]): boolean {
  const W = level.width;
  const H = level.height;
  const shut: number[] = [];
  for (const c of closed) {
    if (c.col < 0 || c.row < 0 || c.col >= W || c.row >= H) continue;
    const i = c.row * W + c.col;
    if (open[i]) {
      open[i] = 0;
      shut.push(i);
    }
  }
  const target = new Set(goal.map((c) => c.row * W + c.col));
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let tail = 0;
  for (const c of from) {
    const i = c.row * W + c.col;
    if (open[i] && !seen[i]) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  }
  let found = false;
  for (let q = 0; q < tail && !found; q++) {
    const i = queue[q]!;
    if (target.has(i)) {
      found = true;
      break;
    }
    const col = i % W;
    const row = (i - col) / W;
    if (col > 0 && open[i - 1] && !seen[i - 1]) (seen[i - 1] = 1, (queue[tail++] = i - 1));
    if (col < W - 1 && open[i + 1] && !seen[i + 1]) (seen[i + 1] = 1, (queue[tail++] = i + 1));
    if (row > 0 && open[i - W] && !seen[i - W]) (seen[i - W] = 1, (queue[tail++] = i - W));
    if (row < H - 1 && open[i + W] && !seen[i + W]) (seen[i + W] = 1, (queue[tail++] = i + W));
  }
  for (const i of shut) open[i] = 1;
  return found;
}

/** Une propagation isolée (tests, outils) : voir `reachableIn`. */
export function reachable(level: Level, from: readonly Cell[], goal: readonly Cell[], closed: readonly Cell[]): boolean {
  return reachableIn(level, openCells(level), from, goal, closed);
}

/** Ce que la règle lit d'un niveau assemblé (`Assembled` de `daily.ts`, sans l'importer). */
export interface PassageLayout {
  level: Level;
  paliers: readonly Palier[];
  slow: readonly { piece: number; zone: number; entryRow: number }[];
}

/**
 * Les points de passage d'un niveau, un par palier de raccord (le palier `k`, de 1 à `paliers.length − 2`) : `from` est la zone du palier d'avant (le départ pour le premier), `goal` la zone du palier.
 * Rend, pour chaque point, ce que la propagation trouve.
 */
export function passageAccess(layout: PassageLayout): { index: number; open: boolean }[] {
  const { level, paliers, slow } = layout;
  const out: { index: number; open: boolean }[] = [];
  const free = openCells(level);
  for (let k = 1; k <= paliers.length - 2; k++) {
    const from = k === 1 ? [level.start] : passageZoneCells(paliers[k - 1]!);
    const closed = [...leftJointCells(paliers[k]!)];
    const route = slow.find((r) => r.piece === k - 1);
    if (route) closed.push(...cageEntranceCells(route));
    out.push({ index: k, open: reachableIn(level, free, from, passageZoneCells(paliers[k]!), closed) });
  }
  return out;
}

/**
 * Lot 32 — **aucun raccourci par point de passage** (règle du générateur g26, comme `slowShortcutProblems` au lot 16 : case par case sur le niveau assemblé). Le palier d'un point de passage ne
 * s'atteint que par la portion qui le précède (son côté gauche, au ras du sol) ou par la voie lente de cette portion (sa cage) : fermés ces deux accès, aucune case libre ne relie la zone du palier au
 * point de passage d'avant (ou au départ). Rend ce qui ne va pas.
 */
export function checkpointShortcutProblems(layout: PassageLayout): string[] {
  return passageAccess(layout)
    .filter((a) => a.open)
    .map((a) => `point de passage ${a.index} : un chemin libre le relie au point d'avant sans la portion ni sa voie lente`);
}
