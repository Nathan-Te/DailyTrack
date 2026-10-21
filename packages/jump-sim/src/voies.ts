import { ATTEMPT_DEAD, ATTEMPT_FINISHED, stepAttempt, type AttemptState } from "./attempt";
import { tileOf } from "./collide";
import { TICK_RATE, UNITS_PER_TILE } from "./constants";
import { idiv } from "./idiv";
import type { Level } from "./level";
import { RELEASE_MIN, isCleanRun, type Palier } from "./modules";
import { DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./player";

// **Seconde voie sur les portions dures (lot 16, générateur g11).** Sur chaque morceau noté 4/5 ou 5/5 (`SLOW_MIN_EXIGENCE`, la note
// `variantExigence` : la gigue ±3 de ses solutions, la plus haute des deux entrées), le générateur pose une **voie lente** : plus longue, sans
// aucun danger, qui contourne le morceau **par le haut** et rejoint le parcours sur le palier suivant (le point de passage suivant). Elle n'a
// rien qui tourne (ni scie, ni clignotant, ni vent) : la même à toute phase de l'horloge unique (lot 15).
//
// Géométrie (une rangée = une rangée de tuiles, de haut en bas ; E = rangée du sol du palier d'entrée, G = rangée du sol de la galerie) :
//   palier · zone de bifurcation (`SLOW_ZONE_WIDTH` = 6 colonnes) · morceau · palier suivant
//   zone : z0 mur gauche · z0+1 « a » et z0+2 « b » (la cage) · z0+3 mur droit · z0+4..z0+5 un palier standard bis (vide jusqu'en haut du
//   morceau : l'entrée du morceau seul, à l'identique, pour la règle toutes phases).
//   - **la piste rapide** court tout droit sous la cage : sol E, une rangée libre (E−1), toit de la cage en E−2 ;
//   - **l'entrée** : une ouverture dans le mur gauche (rangées E−3 à E−5) au-dessus du toit, où l'on monte d'un saut depuis le palier ;
//   - **la cage** : deux colonnes, des corniches d'une tuile collées aux murs, alternées (a en E−5, b en E−8, a en E−11…), trois rangées
//     d'écart : on saute de l'une à l'autre en tenant la direction de la suivante, le mur arrête la course. Rien au-dessus de la tête plus
//     près que 5 rangées (un saut complet monte de 4,1 tuiles : jamais de plafond touché) ;
//   - **la galerie** : la dernière corniche (b, rangée G) ouvre à droite sur un couloir de 3 rangées au-dessus du morceau (son sol G est
//     au-dessus du haut du morceau), jusqu'au palier suivant ;
//   - **la descente** : au-dessus du palier suivant, le sol de la galerie s'ouvre : on tombe dans le puits du palier et on reprend.
// La voie n'est reliée au reste du niveau que par l'entrée (puits du palier d'entrée) et la descente (puits du palier suivant) :
// `slowShortcutProblems` le vérifie case par case ; elle ne peut servir qu'à aller d'un palier au suivant.
//
// **Coût** (`slowCostMin`) : la voie lente prend au moins max(+50 % du temps de la portion, +3 s) de plus que la voie rapide, mesuré entre
// les deux solutions enregistrées (la preuve de l'auteur et le script de la voie lente, `slowScript`), de l'entrée sur le palier à la sortie
// canonique du palier suivant. Si la cage la plus basse ne coûte pas assez, le générateur la monte de 6 rangées (`SLOW_STEP_ROWS`) et
// recommence.

/** Une portion est « dure » à partir de cette note (1 à 5). */
export const SLOW_MIN_EXIGENCE = 4;
/** Colonnes ajoutées entre le palier et un morceau dur. */
export const SLOW_ZONE_WIDTH = 6;
/** Coût minimal : +50 % du temps de la portion, au moins +3 s. */
export const SLOW_COST_PERCENT = 50;
export const SLOW_COST_MIN_TICKS = 3 * TICK_RATE;
/** Deux corniches (une montée de 6 rangées) de plus quand la voie ne coûte pas assez. */
export const SLOW_STEP_ROWS = 6;
/** Au plus tant de montées supplémentaires (au-delà : pas de voie lente possible, le tirage est refusé). */
export const SLOW_MAX_EXTRA = 3;
/** Rangées que l'on atteint d'un saut depuis le sol d'un palier (tête comprise) : au-delà, une case n'est pas « à portée » du palier. */
export const SLOW_REACH_ROWS = 5;

/** Durée minimale de la voie lente pour une portion de `fast` pas : fast + max(50 %, 3 s). */
export function slowCostMin(fast: number): number {
  const half = idiv(fast * SLOW_COST_PERCENT + 99, 100);
  return half > SLOW_COST_MIN_TICKS ? half : SLOW_COST_MIN_TICKS;
}

/** Rangée du sol de la galerie (relative au haut de la grille du morceau, 0) pour un sol d'entrée `entryRow` et `extra` montées de plus. */
export function slowGalleryRow(entryRow: number, extra: number): number {
  let j = 0;
  while (entryRow - 8 - SLOW_STEP_ROWS * j > -1) j++;
  return entryRow - 8 - SLOW_STEP_ROWS * (j + extra);
}

/** Rangées libres au-dessus du haut du morceau dont la voie a besoin (galerie et son plafond). */
export function slowHeadroom(entryRow: number, extra: number): number {
  return 4 - slowGalleryRow(entryRow, extra);
}

/** Une voie lente posée dans le niveau. */
export interface SlowRoute {
  /** Indice du morceau contourné. */
  piece: number;
  /** Première colonne de la zone de bifurcation. */
  zone: number;
  /** Rangée du sol du palier d'entrée (la piste) et rangée du sol de la galerie. */
  entryRow: number;
  galleryRow: number;
  /** Montées ajoutées pour tenir le coût. */
  extra: number;
  /** Le palier d'entrée (le point de passage avant la portion) et le palier où la voie rejoint le parcours. */
  palierIn: Palier;
  palierOut: Palier;
  /** Les corniches (colonne, rangée), de bas en haut ; la dernière est le sol de la galerie. */
  ledges: { col: number; row: number }[];
  /** Pas de la preuve où la portion commence (le centre entre sur le palier d'entrée) et où elle finit (sortie du palier suivant). */
  fork: number;
  fastTicks: number;
  /** La voie lente, de `fork` à la sortie du palier suivant (pas), et ses commandes (rediffusion de la preuve jusqu'à `fork`, puis elles). */
  slowTicks: number;
  code: string;
}

/** Les corniches d'une voie (colonnes absolues) : a en E−5, b en E−8, … jusqu'à b en G. */
export function slowLedges(zone: number, entryRow: number, galleryRow: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  for (let k = 0; ; k++) {
    const row = entryRow - 5 - 3 * k;
    if (row < galleryRow) break;
    out.push({ col: zone + (k % 2 === 0 ? 1 : 2), row });
  }
  return out;
}

/**
 * Creuse la voie dans la grille (`rows[rangée][colonne]`, des caractères) : entrée, cage, galerie, descente. `roof` : la rangée la plus haute
 * du puits du palier de sortie avant la voie. Rend les cases creusées (elles étaient pleines).
 */
export function carveSlowRoute(rows: string[][], zone: number, entryRow: number, galleryRow: number, out: Palier, roof: number): { col: number; row: number }[] {
  const E = entryRow;
  const G = galleryRow;
  const carved: { col: number; row: number }[] = [];
  const dig = (c: number, r: number) => {
    if (rows[r]![c] === "#") {
      rows[r]![c] = ".";
      carved.push({ col: c, row: r });
    }
  };
  for (let r = E - 5; r <= E - 3; r++) dig(zone, r);
  const ledge = new Set(slowLedges(zone, E, G).map((l) => `${l.col},${l.row}`));
  for (let r = G - 3; r <= E - 3; r++) for (const c of [zone + 1, zone + 2]) if (!ledge.has(`${c},${r}`)) dig(c, r);
  for (let c = zone + 3; c <= out.col1; c++) for (let r = G - 3; r <= G - 1; r++) dig(c, r);
  for (let c = out.col0; c <= out.col1; c++) for (let r = G; r < roof; r++) dig(c, r);
  return carved;
}

/** Pas d'appui de saut tenu pour monter d'une corniche à la suivante (3 rangées ; un saut complet monte de 4,1 tuiles). */
const HOLD = 24;
const QUARTER = idiv(UNITS_PER_TILE, 4);
/** Pas contre le mur après chaque pose, avant le saut suivant (un joueur se pose, puis saute ; la gigue ±3 ne fait plus rater la corniche). */
const SETTLE = 10;
/** Vitesse sous laquelle on part de l'arrêt pour monter sur le toit (unités/pas). */
const RUN_SLOW = 64;
/** Pas au plus du script d'une voie (au-delà : elle n'aboutit pas). */
const SCRIPT_MAX = 40 * TICK_RATE;

/**
 * **La solution enregistrée de la voie lente** : un pilote simple, joué dans la simulation à partir de l'état `start` (le centre vient
 * d'entrer sur le palier d'entrée), dont on garde les commandes. Il monte sur le toit de la cage d'un saut, saute de corniche en corniche en
 * tenant la direction de la suivante (appui de `HOLD` pas, relâché au moins `RELEASE_MIN` pas entre deux : jouable au clavier), suit la
 * galerie, se laisse tomber au milieu du palier suivant et repart jusqu'à sa sortie canonique (le bord droit, en course propre) — ou jusqu'à
 * l'arrivée si le palier suivant est le dernier. Rend les commandes, ou la raison de l'échec.
 */
export function slowScript(level: Level, start: AttemptState, route: Pick<SlowRoute, "zone" | "entryRow" | "galleryRow" | "palierOut">, last: boolean): number[] | string {
  const T = UNITS_PER_TILE;
  const ledges = slowLedges(route.zone, route.entryRow, route.galleryRow);
  const out = route.palierOut;
  const feet = (s: AttemptState) => s.player.y + PLAYER_HEIGHT;
  const center = (s: AttemptState) => s.player.x + idiv(PLAYER_WIDTH, 2);
  const onRow = (s: AttemptState, row: number) => s.player.ground === 1 && feet(s) === row * T;
  const inputs: number[] = [];
  let s = start;
  // Étapes : 0 = monter sur le toit ; 1..n = corniche k ; n+1 = galerie et descente ; n+2 = sortie.
  let stage = 0;
  let press = -1; // pas où l'appui en cours a commencé (−1 : aucun)
  let landed = true; // posé depuis le dernier appui
  let released = RELEASE_MIN;
  let settle = 0; // pas restants contre le mur après une pose, avant de repartir
  let wall = INPUT_RIGHT; // le côté du mur de la dernière pose
  const lane = route.entryRow * T;
  for (let t = 0; t < SCRIPT_MAX; t++) {
    let dir = INPUT_RIGHT;
    let trigger = false;
    if (stage === 0) {
      // On s'arrête sur le palier (gauche tenue tant qu'on avance), puis un saut tenu, droite tenue : il passe l'ouverture et se pose sur le
      // toit de la cage (le mur de droite de la cage l'arrête).
      // Arrivé trop vite, on est passé sous le toit : on revient sur le palier (gauche tenue), puis on freine ce recul (droite tenue).
      const floor = s.player.ground === 1 && feet(s) === lane;
      const under = s.player.x + PLAYER_WIDTH > route.zone * T;
      if (floor && tileOf(center(s)) > route.zone + 1) return "la voie lente : passée sous la cage sans sauter";
      if (press < 0 && landed) {
        dir = onRow(s, route.entryRow - 2) ? INPUT_RIGHT : !floor ? 0 : s.player.vx > 0 || under ? INPUT_LEFT : INPUT_RIGHT;
        trigger = floor && !under && s.player.vx >= 0 && s.player.vx < RUN_SLOW;
      }
    } else if (stage <= ledges.length) {
      // Posé : on reste un moment contre son mur (la corniche fait une tuile), puis on saute vers la suivante en tenant sa direction.
      if (settle > 0) {
        settle--;
        dir = wall;
      } else {
        dir = ledges[stage - 1]!.col === route.zone + 1 ? INPUT_LEFT : INPUT_RIGHT;
        trigger = s.player.ground === 1;
      }
    } else if (stage === ledges.length + 1) {
      // La galerie, puis la descente : centre visé sur la première colonne du palier suivant (de quoi reprendre toute sa vitesse avant son bord).
      const aim = out.col0 * T + idiv(T, 2);
      const c = center(s);
      dir = tileOf(c) < out.col0 || c < aim - QUARTER ? INPUT_RIGHT : c > aim + QUARTER ? INPUT_LEFT : 0;
    }
    // Appui humain : `HOLD` pas (au moins `PRESS_MIN`), relâché au moins `RELEASE_MIN` pas avant le suivant, jamais avant d'être reposé.
    let jump = false;
    if (press >= 0) {
      jump = t - press < HOLD;
      if (!jump) press = -1;
    } else if (trigger && landed && released >= RELEASE_MIN) {
      press = t;
      landed = false;
      jump = true;
    }
    released = jump ? 0 : released + 1;
    const bits = dir | (jump ? INPUT_JUMP : 0);
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    inputs.push(bits);
    if (s.status === ATTEMPT_DEAD) return "la voie lente : mort";
    if (s.status === ATTEMPT_FINISHED) return last ? inputs : "la voie lente : arrivée avant le palier";
    if (press < 0 && s.player.ground === 1) landed = true;
    if (stage === 0 && onRow(s, route.entryRow - 2) && tileOf(center(s)) === route.zone + 2) {
      stage = 1;
      settle = SETTLE;
      wall = INPUT_RIGHT;
    } else if (stage >= 1 && stage <= ledges.length) {
      const target = ledges[stage - 1]!;
      // La dernière corniche est le sol de la galerie : on peut s'y poser plus à droite.
      const col = tileOf(center(s));
      if (onRow(s, target.row) && (col === target.col || (stage === ledges.length && col > target.col))) {
        stage++;
        settle = SETTLE;
        wall = target.col === route.zone + 1 ? INPUT_LEFT : INPUT_RIGHT;
      }
    } else if (stage === ledges.length + 1 && onRow(s, out.row)) stage++;
    else if (stage === ledges.length + 2 && !last && tileOf(center(s)) > out.col1) {
      if (!isCleanRun(s.player)) return "la voie lente : sortie hors de la course propre";
      return inputs;
    }
  }
  return `la voie lente n'aboutit pas (étape ${stage} sur ${ledges.length + 2}, colonne ${tileOf(center(s))}, pieds ${idiv(feet(s), T)}, sol ${s.player.ground})`;
}
