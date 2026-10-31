import { ATTEMPT_DEAD, ATTEMPT_FINISHED, ATTEMPT_RUNNING, checkpointAttempt, initialAttempt, stepAttempt, type AttemptState } from "./attempt";
import { SINGLE_CLOCK_VERSION } from "./constants";
import type { DailyLevel } from "./daily";
import type { DemoReprise } from "./demo";
import { idiv } from "./idiv";
import { hasLegacyCatalog } from "./legacyRegistry";
import { cycleMod, sectionPeriod, type Level } from "./level";
import { buildModule, centerCol, isCleanRun, moduleSolutions, moduleStart, soloLevel } from "./modules";
import { DEFAULT_JUMP_PARAMS, INPUT_RIGHT } from "./player";
import { decodeReplay, fromRuns } from "./replay";

// Lot 21 — **les joueurs fictifs qui reprennent bien** (`demoAttempts(…, { reprise: repriseParPhase(niveau) })`). Dans un niveau à une seule horloge (v4, v5),
// la preuve de l'auteur franchit chaque morceau en courant, à l'instant exact où son horloge le veut ; un joueur fictif tué sur un point de passage repart, lui, de
// l'**arrêt**, sur le palier : lui rejouer les commandes de la preuve (même alignées sur l'horloge) échouait presque toujours au morceau suivant, à chaque vie, jusqu'à
// l'abandon. Il fait donc ce que fait un joueur qui regarde les scies :
//   1. il **attend sur le palier** (sûr à toute phase, règle `respawnProblems`) que l'horloge du morceau soit à la phase de la solution de ce morceau ;
//   2. il **joue la solution du morceau** depuis l'arrêt (celle du catalogue, `moduleSolutions(id, variante).arret`, qui sort au bord du palier suivant en course
//      propre) — l'horloge d'un morceau seul démarrait à l'entrée du personnage dans la section : l'attente est celle qui remet la même rencontre (c'est le « premier
//      candidat » de `phases:modules`, qui garde l'équivalent pour chaque phase) ; les morceaux à plateformes (v5) suivent le même principe, leurs plateformes sont
//      sur l'horloge de leur section ;
//   3. il **choisit son attente** pour que, à sa sortie, l'horloge des morceaux suivants soit aussi dans la phase où la preuve les rencontre (jusqu'à
//      `ALIGN_MAX` pas de plus petit commun multiple, comme `alignWait` de `demo.ts`) : il reprend alors la preuve, pas pour pas, au pas où elle sortait de ce
//      morceau.
//   Devant une **portion dure** (voie lente, lot 16) le palier est suivi d'une zone de six colonnes : le joueur y prend son élan, droite tenue, sous la cage, et
//   arrive au morceau en course propre — il joue alors la solution **en élan** du morceau (de son entrée à sa sortie), l'horloge se réglant sur son arrivée.
// Chaque reprise est **vérifiée dans la simulation** avant d'être choisie (le morceau est joué jusqu'à sa sortie canonique sans mourir) ; sinon `null` : la reprise
// d'avant (rejouer la preuve). Ce fichier importe le catalogue des morceaux : il n'est jamais dans le premier chargement du jeu (serveur, outils, tests, et
// `?carnage=demo` à la demande).

/** Plus grand commun multiple des périodes des morceaux suivants visé (comme `alignWait` : au-delà, seulement les premiers morceaux). */
const ALIGN_MAX = 2400;
/** Attente la plus longue sur le palier avant de rejouer (pas) : 40 s. */
const WAIT_MAX = 4800;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Ce qu'un joueur fictif joue pour franchir un morceau depuis le point de passage qui le précède, et le moment où l'horloge du morceau doit valoir 0. */
interface Restart {
  inputs: readonly number[];
  /** Nombre de pas, depuis le premier, au bout desquels le personnage entre dans la section du morceau : l'horloge du morceau, seul, valait 0 à cet instant. */
  clockStart: number;
}

/** Le morceau `k` du niveau, repris depuis son point de passage : la solution « arrêt » du morceau seul, ou, devant une portion dure, l'élan dans la zone puis la solution « élan ». */
function restartOf(daily: DailyLevel, k: number): Restart | null {
  const piece = daily.pieces[k]!;
  const level = daily.level;
  const legacy = level.minHold === 0;
  // Lot 30 : un niveau d'avant la version 13 (jour figé) se reprend avec les solutions d'avant, que le jeu n'embarque pas (`src/legacy/`, chargé par les tests et les outils) : sans elles, le joueur fictif n'a pas de reprise.
  if (legacy && !hasLegacyCatalog()) return null;
  const solutions = moduleSolutions(piece.id, piece.variant, legacy);
  if (!solutions) return null;
  const hard = daily.slowRoutes.some((r) => r.piece === k);
  if (hard) {
    const solution = solutions.elan;
    if (!solution) return null;
    // L'élan : droite tenue depuis le point de passage jusqu'à l'entrée du morceau, en course propre (la zone de six colonnes est faite pour ça).
    let s = checkpointAttempt(level, { ...initialAttempt(level), checkpoint: k - 1 });
    let run = 0;
    while (!(isCleanRun(s.player) && centerCol(s.player) >= piece.col0)) {
      s = stepAttempt(s, INPUT_RIGHT, level, DEFAULT_JUMP_PARAMS);
      if (s.status !== ATTEMPT_RUNNING || ++run > 240) return null;
    }
    const all = fromRuns(decodeReplay(solution.code).runs);
    return { inputs: [...new Array<number>(run).fill(INPUT_RIGHT), ...all.slice(solution.entryTick, solution.exitTick)], clockStart: run };
  }
  const solution = solutions.arret;
  if (!solution) return null;
  const inputs = fromRuns(decodeReplay(solution.code).runs).slice(0, solution.exitTick);
  const built = buildModule(piece.id, piece.variant);
  let s = moduleStart({ ...built, level: soloLevel(built, legacy) }, "arret");
  let clockStart = -1;
  for (const bits of inputs) {
    s = stepAttempt(s, bits, soloLevel(built, legacy), DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) return null;
    if (clockStart < 0 && (s.sections[0] ?? -1) >= 0) clockStart = s.sections[0]!;
  }
  // Un morceau sans horloge (rien ne tourne) n'a pas de section démarrée qui compte : la phase n'importe pas.
  return { inputs, clockStart: Math.max(0, clockStart) };
}

/** Joue `wait` pas sans commande puis `inputs` depuis `from` : vivant, et à la sortie canonique (en course propre, au bord droit du palier de sortie) au dernier pas — ou, pour le dernier morceau, arrivé ? */
function exitsCleanly(level: Level, from: Readonly<AttemptState>, wait: number, inputs: readonly number[], exitCol: number, last: boolean): boolean {
  let s: AttemptState = from;
  for (let i = 0; i < wait; i++) s = stepAttempt(s, 0, level, DEFAULT_JUMP_PARAMS);
  for (const bits of inputs) {
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    // Le dernier morceau finit à la ligne d'arrivée, un peu avant la sortie canonique du palier : arriver, c'est réussir.
    if (s.status === ATTEMPT_FINISHED) return last;
    if (s.status !== ATTEMPT_RUNNING) return false;
  }
  return last ? true : isCleanRun(s.player) && centerCol(s.player) >= exitCol;
}

/** Les joueurs fictifs d'un niveau du jour qui reprennent bien après une mort (voir l'en-tête de ce fichier). */
export function repriseParPhase(daily: DailyLevel): DemoReprise {
  const level = daily.level;
  const restarts = new Map<number, Restart | null>();
  const restartFor = (k: number): Restart | null => {
    if (!restarts.has(k)) {
      restarts.set(k, restartOf(daily, k));
    }
    return restarts.get(k)!;
  };
  /** La section (indice du niveau) de chaque morceau : celle qui commence à sa première colonne. */
  const sectionOf = daily.pieces.map((p) => level.sections.findIndex((s) => s.c0 === p.col0));

  return {
    resume(forLevel, state) {
      if (forLevel !== level || level.simVersion < SINGLE_CLOCK_VERSION || state.checkpoint < 0) return null;
      // Le point de passage est au début du palier qui précède le morceau k ; le premier morceau n'a que le départ (reprise : la preuve, depuis son premier pas).
      const cell = level.checkpoints[state.checkpoint];
      const k = cell ? daily.paliers.findIndex((p, i) => i > 0 && i < daily.pieces.length && p.col0 === cell.col) : -1;
      if (k < 1) return null;
      const restart = restartFor(k);
      const section = sectionOf[k]!;
      if (!restart || section < 0) return null;
      const period = sectionPeriod(level, section);
      const phase = level.sections[section]!.phase;
      const exitCol = daily.paliers[k + 1]!.col1 + 1;
      // Attente 1 : l'horloge du morceau à 0 quand le personnage y entre, comme seul (la période d'un morceau sans horloge : 1, toute attente convient).
      const unit = period > 0 ? period : 1;
      const first = period > 0 ? cycleMod(-restart.clockStart - phase - state.time, period) : 0;
      // Attente 2 : à la sortie, les morceaux suivants dans la phase où la preuve les rencontre (de plus en plus loin tant que le plus petit commun multiple
      // reste raisonnable ; sinon, les premiers seulement).
      const ahead: number[] = [];
      for (let j = k + 1; j < daily.pieces.length; j++) {
        const sj = sectionOf[j]!;
        const pj = sj >= 0 ? sectionPeriod(level, sj) : 0;
        if (pj > 0) ahead.push(pj);
      }
      // Vérifié une fois : toute attente de même reste modulo la période met le morceau dans la même phase, donc donne la même sortie.
      if (!exitsCleanly(level, state, first, restart.inputs, exitCol, k === daily.pieces.length - 1)) return null;
      const exitAt = state.time + restart.inputs.length; // chrono à la sortie si l'attente est nulle
      const proofExit = daily.pieces[k]!.end; // le pas de la preuve où elle sort de ce morceau
      for (let take = ahead.length; take >= 0; take--) {
        let l = 1;
        let fits = true;
        for (let i = 0; i < take; i++) {
          l = idiv(l * ahead[i]!, gcd(l, ahead[i]!));
          if (l > ALIGN_MAX && i > 0) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        for (let wait = first; wait <= WAIT_MAX; wait += unit) if (cycleMod(exitAt + wait - proofExit, l) === 0) return { wait, inputs: restart.inputs, cursor: proofExit };
      }
      return { wait: first, inputs: restart.inputs, cursor: proofExit };
    },
  };
}
