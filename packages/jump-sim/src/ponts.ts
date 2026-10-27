import { PALIER_LENGTH } from "./constants";
import { isSolidTile, isSpikeTile, TILE_EMPTY, TILE_SOLID, type Bridge, type Level } from "./level";
import { refugeProblem } from "./lasers";
import { replayAttempt, type JumpReplay } from "./replay";

// Les règles du générateur pour les ponts à interrupteur (lot 26) — ce qu'un morceau ou un niveau du jour doit tenir pour qu'un pont reste lisible et jouable.
// Fonctions pures (le générateur les applique à chaque niveau v10, les tests au catalogue) :
//   1. **Dans son morceau** : l'interrupteur et toutes les tuiles du pont sont dans une seule section, à au moins une colonne de ses bords.
//   2. **Aucun point de passage sur un pont ni sur un interrupteur** : le départ `S` et les points `C` n'ont, sur leur palier (`PALIER_LENGTH` colonnes), ni interrupteur ni tuile de
//      pont. Une reprise remet d'ailleurs tout éteint : on ne repart jamais d'un pont allumé.
//   3. **Un interrupteur où l'on se tient** : un bloc plein avec deux tuiles libres au-dessus (ni plein, ni pic), que rien de mortel ne touche à aucun pas des horloges.
//   4. **Un pont droit reste court** : une suite de tuiles à la même rangée ne dépasse pas `BRIDGE_STRAIGHT_MAX` tuiles (au-delà, une course de plus d'une seconde sans le moindre
//      saut ; plus long, il faut des marches ou un coude). La plus longue course sans saut du niveau (1,3 s en moyenne, 2 s au plus) est de toute façon une règle de `dailyProblems`.
//   5. **La poursuite franche** (`bridgeChaseProblems`) : un joueur qui part de l'interrupteur et suit le pont à pleine vitesse, avec les sauts que le pont exige, arrive au bout avec au
//      moins `BRIDGE_CHASE_MARGIN` pas (0,4 s) d'avance sur l'extinction. Vérifié dans la vraie simulation : la rediffusion de la solution est rejouée sur le même niveau dont les ponts
//      s'éteignent `BRIDGE_CHASE_MARGIN` pas plus tôt ; elle doit arriver au même pas, sans mourir. Si la solution suit le pont, chaque tuile sur laquelle elle s'appuie reste donc
//      pleine au moins 0,4 s après qu'elle l'a quittée.

/** Une suite de tuiles à la même rangée ne dépasse pas ce nombre : 12 tuiles à 11 tuiles/s, soit 1,1 s de course sans saut. */
export const BRIDGE_STRAIGHT_MAX = 12;
/** L'avance exigée sur l'extinction, en pas : 48 pas = 0,4 s. */
export const BRIDGE_CHASE_MARGIN = 48;

const tileOf = (level: Level, col: number, row: number): number => (col < 0 || row < 0 || col >= level.width ? TILE_SOLID : row >= level.height ? TILE_EMPTY : level.tiles[row * level.width + col]!);

/** Les colonnes du pont (l'interrupteur compris) : la première et la dernière. */
function span(b: Bridge): { c0: number; c1: number } {
  let c0 = b.switchCol;
  let c1 = b.switchCol;
  for (const c of b.tiles) {
    if (c.col < c0) c0 = c.col;
    if (c.col > c1) c1 = c.col;
  }
  return { c0, c1 };
}

/** Ce qui ne va pas dans les ponts d'un niveau (vide : conformes). */
export function bridgeProblems(level: Level): string[] {
  const out: string[] = [];
  for (const b of level.bridges) {
    const where = `pont ${b.id}`;
    const { c0, c1 } = span(b);
    // 1. Dans son morceau.
    const sec = level.sections.find((q) => b.switchCol >= q.c0 && b.switchCol <= q.c1);
    if (!sec) out.push(`${where} : son interrupteur (colonne ${b.switchCol}) n'est dans aucune section`);
    else if (c0 < sec.c0 + 1 || c1 > sec.c1 - 1) out.push(`${where} : colonnes ${c0}-${c1} hors de la section ${sec.name} (${sec.c0 + 1}-${sec.c1 - 1} permis)`);
    // 2. Aucun point de passage sur un pont ni sur un interrupteur.
    for (const [name, cell] of [["départ", level.start] as const, ...level.checkpoints.map((p, i) => [`point ${i + 1}`, p] as const)]) {
      const on = (c: { col: number; row: number }) => c.col >= cell.col && c.col <= cell.col + PALIER_LENGTH - 1 && c.row >= cell.row - 4 && c.row <= cell.row + 1;
      if (on({ col: b.switchCol, row: b.switchRow }) || b.tiles.some(on)) out.push(`${where} : le ${name} (${cell.col},${cell.row}) est sur son interrupteur ou son pont`);
    }
    // 3. Un interrupteur où l'on se tient.
    const free = (col: number, row: number) => {
      const t = tileOf(level, col, row);
      return !isSolidTile(t) && !isSpikeTile(t);
    };
    if (!free(b.switchCol, b.switchRow - 1) || !free(b.switchCol, b.switchRow - 2)) out.push(`${where} : l'interrupteur (${b.switchCol},${b.switchRow}) n'a pas deux tuiles libres au-dessus`);
    else {
      const bad = refugeProblem(level, b.switchCol, b.switchRow);
      if (bad !== null) out.push(`${where} : l'interrupteur (${b.switchCol},${b.switchRow}) n'est pas sûr : ${bad}`);
    }
    // 4. Un pont droit reste court.
    let run = 1;
    for (let k = 1; k <= b.tiles.length; k++) {
      const a = b.tiles[k - 1]!;
      const c = b.tiles[k];
      if (c && c.row === a.row && Math.abs(c.col - a.col) === 1) run++;
      else {
        if (run > BRIDGE_STRAIGHT_MAX) out.push(`${where} : ${run} tuiles à la même rangée (${a.row}) : au plus ${BRIDGE_STRAIGHT_MAX} sans marche ni coude`);
        run = 1;
      }
    }
  }
  return out;
}

/** Le même niveau dont les ponts s'éteignent `advance` pas plus tôt (le délai de chacun diminue de `advance`) : de quoi rejouer une solution avec de la marge. Hors lecture du texte : pas de délai minimal. */
export function withBridgeAdvance(level: Level, advance: number): Level {
  return { ...level, bridges: level.bridges.map((b) => ({ ...b, delay: b.delay - advance })) };
}

/**
 * La poursuite franche (règle 5) : rejoue `replay` (une solution, du départ à l'arrivée) sur le niveau dont les ponts s'éteignent `BRIDGE_CHASE_MARGIN` pas plus tôt ; elle doit arriver
 * au même pas, sans mourir. Vide : conforme (et pour un niveau sans pont).
 */
export function bridgeChaseProblems(level: Level, replay: JumpReplay, levelId: string, ticks: number): string[] {
  if (level.bridges.length === 0) return [];
  const tight = withBridgeAdvance(level, BRIDGE_CHASE_MARGIN);
  try {
    const r = replayAttempt(tight, replay, levelId);
    if (!r.finished) return [`la solution ne suit pas le pont avec ${BRIDGE_CHASE_MARGIN} pas (${(BRIDGE_CHASE_MARGIN / 120).toFixed(1)} s) d'avance : elle n'arrive pas`];
    if (r.deaths.length > 0) return [`la solution ne suit pas le pont avec ${BRIDGE_CHASE_MARGIN} pas d'avance : elle meurt au pas ${r.deaths[0]!.tick} (${r.deaths[0]!.cause})`];
    if (r.ticks !== ticks) return [`la solution ne suit pas le pont avec ${BRIDGE_CHASE_MARGIN} pas d'avance : elle arrive au pas ${r.ticks} au lieu de ${ticks}`];
  } catch {
    // Une mort sans point de passage termine l'essai (morceau joué seul) : la rediffusion a des pas après sa fin.
    return [`la solution ne suit pas le pont avec ${BRIDGE_CHASE_MARGIN} pas d'avance : elle meurt avant la fin`];
  }
  return [];
}

/**
 * Le pont est nécessaire : la solution rejouée sur le niveau dont **aucun pont ne s'allume** (leurs tuiles restent éteintes) n'arrive pas. Un pont qu'on peut sauter d'un bond n'est
 * qu'un décor. Vide : conforme (et pour un niveau sans pont). Test de la solution gardée ; le chercheur du solveur (`npm run ponts:modules`) vérifie qu'aucune autre n'existe.
 */
export function bridgeNeededProblems(level: Level, replay: JumpReplay, levelId: string): string[] {
  if (level.bridges.length === 0) return [];
  const dark = withBridgeAdvance(level, 100_000);
  try {
    const r = replayAttempt(dark, replay, levelId);
    return r.finished && r.deaths.length === 0 ? ["la solution arrive sans que le pont soit allumé : il ne sert à rien"] : [];
  } catch {
    return [];
  }
}
