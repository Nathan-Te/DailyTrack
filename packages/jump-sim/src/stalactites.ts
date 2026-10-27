import { ATTEMPT_DEAD, ATTEMPT_RUNNING, DEATH_STALACTITE, initialAttempt, stepAttempt, type AttemptState } from "./attempt";
import { PALIER_LENGTH, UNITS_PER_TILE } from "./constants";
import { STALACTITE_SHAKE_TICKS, STALACTITE_TILES, TILE_EMPTY, TILE_SOLID, isSolidTile, stalactiteBox, stalactiteOffset, type Level, type Stalactite } from "./level";
import { DEFAULT_JUMP_PARAMS, INPUT_RIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./player";

// Les règles du générateur pour les stalactites (lot 24) — ce qu'un morceau ou un niveau du jour doit tenir pour qu'une stalactite reste lisible et équitable.
// Fonctions pures (le générateur les applique à chaque niveau v8, les tests au catalogue) :
//   1. **Dans son morceau** : la zone de déclenchement (colonnes `col − avant` à `col + après`) reste à au moins une colonne des bords de sa section, et ne recouvre jamais
//      un palier de départ, de point de passage ou d'arrivée (`PALIER_LENGTH` colonnes à partir de `S`, `C` et `F`) : **aucun point de passage dans une zone de
//      déclenchement ni sous une chute**, une reprise ne déclenche jamais rien (et la reprise remet de toute façon la stalactite intacte).
//   2. **Elle tombe quelque part où elle se brise** : sous son corps, la tuile est vide (elle peut tomber) et un bloc plein se trouve dans la colonne à moins de
//      `STALACTITE_FALL_ROWS` rangées (on la voit se briser au lieu de disparaître dans un trou).
//   3. **La course franche** (`stalactiteRunProblems`) : un joueur qui continue sa course à pleine vitesse depuis le déclenchement n'est jamais touché. Simulée dans le jeu lui-même
//      depuis l'entrée dans la zone, au sol, à la vitesse de course, droite tenue : si le personnage, encore au sol, est tué par une stalactite, la zone est trop courte, le tremblement
//      trop court ou le plafond trop bas pour la course. Une stalactite punit l'hésitation (s'arrêter, ralentir, repartir en arrière), jamais la course franche.

const T = UNITS_PER_TILE;

/** Rangées sous le corps d'une stalactite où un bloc plein doit la briser. */
export const STALACTITE_FALL_ROWS = 12;
/** Nombre de pas simulés pour la course franche : de quoi traverser la zone, le tremblement et la chute. */
export const STALACTITE_RUN_TICKS = 300;
/** Façons d'entrer dans la zone : la boîte du personnage franchit le bord de la zone à un pas, la position exacte dépend du dernier pas de course (un pas fait 375 unités). */
const ENTRY_OFFSETS = [0, 125, 250, 374] as const;

const tileOf = (level: Level, col: number, row: number): number => (col < 0 || row < 0 || col >= level.width ? TILE_SOLID : row >= level.height ? TILE_EMPTY : level.tiles[row * level.width + col]!);

/** La rangée du premier bloc plein sous le corps d'une stalactite (dans sa colonne), ou −1 s'il n'y en a pas dans `STALACTITE_FALL_ROWS` rangées. */
export function stalactiteFloorRow(level: Level, s: Pick<Stalactite, "col" | "row">): number {
  for (let r = s.row + STALACTITE_TILES; r < level.height && r <= s.row + STALACTITE_TILES + STALACTITE_FALL_ROWS; r++) {
    if (isSolidTile(tileOf(level, s.col, r))) return r;
  }
  return -1;
}

/** Les colonnes d'une zone de déclenchement : `[col − avant, col + après]`. */
export function stalactiteZone(s: Pick<Stalactite, "col" | "before" | "after">): [number, number] {
  return [s.col - s.before, s.col + s.after];
}

/** Ce qui ne va pas dans la pose des stalactites d'un niveau (règles 1 et 2) ; vide : conformes. */
export function stalactiteProblems(level: Level): string[] {
  const out: string[] = [];
  level.stalactites.forEach((s) => {
    const where = `stalactite ${s.id} (${s.col},${s.row})`;
    const [z0, z1] = stalactiteZone(s);
    // 1. Dans son morceau, et loin des paliers.
    const sec = level.sections.find((q) => s.col >= q.c0 && s.col <= q.c1);
    if (sec === undefined) {
      if (level.sections.length > 0) out.push(`${where} : dans aucune section`);
    } else if (z0 < sec.c0 + 1 || z1 > sec.c1 - 1) {
      out.push(`${where} : sa zone (colonnes ${z0}-${z1}) sort de la section ${sec.name} (${sec.c0 + 1}-${sec.c1 - 1} permis)`);
    }
    for (const [name, cell] of [["départ", level.start] as const, ["arrivée", level.finish] as const, ...level.checkpoints.map((c, i) => [`point ${i + 1}`, c] as const)]) {
      if (cell.col <= z1 && cell.col + PALIER_LENGTH - 1 >= z0) out.push(`${where} : le ${name} (${cell.col},${cell.row}) est dans sa zone (colonnes ${z0}-${z1}) ou son palier`);
    }
    // 2. Elle peut tomber, et se brise sur un bloc.
    if (tileOf(level, s.col, s.row + STALACTITE_TILES) !== TILE_EMPTY) out.push(`${where} : rien ne peut tomber, la tuile sous son corps n'est pas vide`);
    else if (stalactiteFloorRow(level, s) < 0) out.push(`${where} : aucun bloc plein dans sa colonne à moins de ${STALACTITE_FALL_ROWS} rangées sous son corps`);
  });
  return out;
}

/** Le premier bloc plein sous le sol de départ de la course franche, dans la colonne `col`, à partir de la rangée `from` : sa rangée, ou −1. */
function floorUnder(level: Level, col: number, from: number): number {
  for (let r = from; r < level.height; r++) if (isSolidTile(tileOf(level, col, r))) return r;
  return -1;
}

/**
 * Règle 3 : la course franche. Pour chaque stalactite, un personnage posé sur le sol au bord gauche de sa zone, lancé à la vitesse de course, droite tenue, joue
 * `STALACTITE_RUN_TICKS` pas dans la vraie simulation (les autres stalactites intactes, comme à l'arrivée d'un joueur qui n'a rien déclenché avant). **Il ne doit jamais être
 * tué par une stalactite tant qu'il est au sol** (une mort après avoir quitté le sol — un puits, un saut — est une affaire de ce puits, pas de la stalactite). Quatre positions
 * d'entrée (la boîte franchit le bord de la zone à des fractions différentes d'un pas). Vide : conforme. Coûteux : calculé une fois par variante (`stalactitePieceProblems`).
 */
export function stalactiteRunProblems(level: Level): string[] {
  const out: string[] = [];
  level.stalactites.forEach((s) => {
    const [z0, z1] = stalactiteZone(s);
    // Le sol sous le bord gauche de la zone (sinon, sous la stalactite) : le personnage s'y pose, centre sur le bord de la zone.
    let col = z0;
    let floor = floorUnder(level, col, s.row + STALACTITE_TILES);
    if (floor < 0) {
      col = s.col;
      floor = floorUnder(level, col, s.row + STALACTITE_TILES);
    }
    if (floor < 0) return;
    for (const dx of ENTRY_OFFSETS) {
      const centre = Math.max(z0, col) * T + dx;
      let state: AttemptState = initialAttempt(level);
      state = { ...state, status: ATTEMPT_RUNNING, player: { ...state.player, x: centre - PLAYER_WIDTH / 2, y: floor * T - PLAYER_HEIGHT, vx: DEFAULT_JUMP_PARAMS.runSpeed, vy: 0, ground: 1, air: 0, held: 1 } };
      for (let t = 0; t < STALACTITE_RUN_TICKS; t++) {
        const grounded = state.player.ground === 1;
        state = stepAttempt(state, INPUT_RIGHT, level, DEFAULT_JUMP_PARAMS);
        if (state.status === ATTEMPT_DEAD) {
          if (state.deathCause === DEATH_STALACTITE && grounded) out.push(`stalactite ${s.id} (${s.col},${s.row}) : touche un joueur qui court à pleine vitesse depuis le bord de sa zone (pas ${t + 1}, entrée +${dx}), zone ${z0}-${z1}`);
          break;
        }
        // Passée (le personnage est entièrement à droite de son corps) : plus rien à craindre d'elle.
        if (state.player.x > stalactiteBox(s, 0).x + stalactiteBox(s, 0).w) break;
      }
    }
  });
  return out;
}

/** Les temps de la stalactite `s` pour un joueur qui reste dessous : pas où elle commence à tomber, et où elle atteint le sol (outils, tests, documentation). */
export function stalactiteTimes(level: Level, s: Stalactite): { fallStart: number; landing: number } {
  const floor = stalactiteFloorRow(level, s);
  const bottomMax = floor * T - (s.row + STALACTITE_TILES) * T;
  let age = 1;
  while (stalactiteOffset(age) < bottomMax && age < 10_000) age++;
  return { fallStart: STALACTITE_SHAKE_TICKS + 1, landing: age };
}
