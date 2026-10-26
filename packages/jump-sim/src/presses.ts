import { circleHitsBox } from "./attempt";
import { PALIER_LENGTH, UNITS_PER_TILE } from "./constants";
import { TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_EMPTY, TILE_SOLID, PRESS_HEIGHT_TILES, platformPos, pressBox, sawCenter, type Level, type Press } from "./level";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "./player";

// Les règles du générateur pour les presses (lot 22) — ce qu'un morceau ou un niveau du jour doit tenir pour qu'une presse reste lisible et jouable.
// Fonctions pures (le générateur les applique à chaque niveau v6, les tests au catalogue) :
//   1. **Sol plein** : sous la position basse de chaque presse (la rangée qui suit son bord bas), chaque colonne de la presse repose sur un bloc plein
//      (`TILE_SOLID` : ni friable, ni clignotant, ni tapis, ni glace) ; sa course est vide (déjà exigé par `parseLevel`).
//   2. **Dans son morceau** : la presse reste à au moins une colonne des bords de sa section.
//   3. **Une place sûre pour attendre devant** : à l'approche (à gauche : les niveaux vont de gauche à droite), dans les `PRESS_WAIT_REACH` colonnes qui la
//      précèdent, un bloc plein au niveau du sol de la presse avec deux tuiles libres au-dessus, que ni une scie ni une autre presse ne touche à aucun pas
//      de leurs cycles : on y attend l'ouverture sans rien risquer.
//   4. **Ni vent ni tapis qui pousse dessous sans que le joueur agisse** : aucun tapis dans les colonnes de la course ; un tapis qui porte vers la presse
//      (à gauche et vers la droite, à droite et vers la gauche) s'arrête à plus de `PRESS_BELT_CLEARANCE` colonnes de sa course (au repos, le personnage
//      s'arrête presque tout de suite au bout du tapis, 0,1 tuile) ; aucune zone de vent à moins de `PRESS_WIND_CLEARANCE` colonnes de sa course.
//   5. **Rien d'autre dans sa course** : aucune scie (sur tout son cycle) ni plateforme mobile ne passe dans la boîte de sa course entière.
//   6. **Pas de point de passage sous une presse ni dans sa course** : le départ `S` et les points `C` ne sont jamais dans les colonnes d'une course à
//      hauteur de celle-ci. Que ce point reste **sûr à toute phase** est dans `respawnProblems` (`daily.ts`) et `palierProblems` (`modules.ts`).

const T = UNITS_PER_TILE;

/** Colonnes devant une presse où chercher la place pour attendre. */
export const PRESS_WAIT_REACH = 4;
/** Un tapis qui porte vers une presse finit à plus de ce nombre de colonnes de sa course. */
export const PRESS_BELT_CLEARANCE = 2;
/** Aucune zone de vent à moins de ce nombre de colonnes d'une course de presse. */
export const PRESS_WIND_CLEARANCE = 3;

const tileOf = (level: Level, col: number, row: number): number => (col < 0 || row < 0 || col >= level.width ? TILE_SOLID : row >= level.height ? TILE_EMPTY : level.tiles[row * level.width + col]!);

/** La rangée du bloc sur lequel la presse repose en bas de sa course (la rangée qui suit son bord bas). */
export function pressFloorRow(p: Pick<Press, "row" | "travel">): number {
  return p.row + p.travel + PRESS_HEIGHT_TILES;
}

/** La boîte de toute la course d'une presse (unités) : de sa position haute à sa position basse. */
export function pressCourse(p: Pick<Press, "col" | "row" | "travel" | "width">): { x: number; y: number; w: number; h: number } {
  return { x: p.col * T, y: p.row * T, w: p.width * T, h: (p.travel + PRESS_HEIGHT_TILES) * T };
}

/** Dans une boîte de personnage debout sur la tuile `col` (sol à la rangée `floor`), rien ne passe-t-il à aucun pas des cycles ? Rend ce qui y passe, ou null. */
function standingHazard(level: Level, col: number, floor: number): string | null {
  const box = { x: col * T + (T - PLAYER_WIDTH) / 2, y: floor * T - PLAYER_HEIGHT, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
  for (const saw of level.saws) {
    const steps = saw.cycle === 0 ? 1 : saw.cycle;
    for (let t = 0; t < steps; t++) {
      const s = sawCenter(saw, t);
      if (circleHitsBox(s.x, s.y, saw.radius, box)) return `la scie ${saw.id} y passe (pas ${t})`;
    }
  }
  for (const q of level.presses) {
    for (let t = 0; t < q.cycle; t++) {
      const b = pressBox(q, t);
      if (b.x < box.x + box.w && box.x < b.x + b.w && b.y < box.y + box.h && box.y < b.y + b.h) return `la presse ${q.id} y passe (pas ${t})`;
    }
  }
  return null;
}

/** Ce qui ne va pas dans les presses d'un niveau (vide : conformes). */
export function presseProblems(level: Level): string[] {
  const out: string[] = [];
  level.presses.forEach((p) => {
    const where = `presse ${p.id}`;
    const sec = level.sections[p.section]!;
    const c1 = p.col + p.width - 1;
    const floor = pressFloorRow(p);
    // 2. Dans son morceau.
    if (p.col < sec.c0 + 1 || c1 > sec.c1 - 1) out.push(`${where} : sa course (colonnes ${p.col}-${c1}) sort de la section ${sec.name} (${sec.c0 + 1}-${sec.c1 - 1} permis)`);
    // 1. Sol plein sous la position basse.
    for (let c = p.col; c <= c1; c++) {
      if (tileOf(level, c, floor) !== TILE_SOLID) out.push(`${where} : pas de sol plein sous sa position basse (colonne ${c}, rangée ${floor})`);
    }
    // 4. Tapis et vent.
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        const t = level.tiles[r * level.width + c]!;
        if (t !== TILE_BELT_LEFT && t !== TILE_BELT_RIGHT) continue;
        if (c >= p.col && c <= c1) {
          out.push(`${where} : un tapis dans les colonnes de sa course (${c},${r})`);
          continue;
        }
        const toward = (t === TILE_BELT_RIGHT && c < p.col) || (t === TILE_BELT_LEFT && c > c1);
        if (!toward) continue;
        // Le bout du tapis (la dernière tuile de sa rangée, dans son sens) : il doit finir à plus de `PRESS_BELT_CLEARANCE` colonnes de la course.
        const step = t === TILE_BELT_RIGHT ? 1 : -1;
        let e = c;
        while (tileOf(level, e + step, r) === t) e += step;
        if (e !== c) continue; // on ne juge que le dernier de la suite : les autres tuiles de la suite ont le même bout
        const gap = t === TILE_BELT_RIGHT ? p.col - e - 1 : e - c1 - 1;
        if (gap < PRESS_BELT_CLEARANCE) out.push(`${where} : un tapis (${c},${r}) porte vers elle et finit à ${gap} colonne(s) de sa course`);
      }
    }
    for (const w of level.winds) {
      if (w.c0 <= c1 + PRESS_WIND_CLEARANCE && p.col - PRESS_WIND_CLEARANCE <= w.c1) out.push(`${where} : une zone de vent (colonnes ${w.c0}-${w.c1}) à moins de ${PRESS_WIND_CLEARANCE} colonnes de sa course`);
    }
    // 5. Rien d'autre dans sa course : ni scie ni plateforme mobile.
    const course = pressCourse(p);
    for (const saw of level.saws) {
      const steps = saw.cycle === 0 ? 1 : saw.cycle;
      for (let t = 0; t < steps; t++) {
        const s = sawCenter(saw, t);
        if (circleHitsBox(s.x, s.y, saw.radius, course)) {
          out.push(`${where} : la scie ${saw.id} passe dans sa course (pas ${t} de son cycle)`);
          break;
        }
      }
    }
    for (const q of level.platforms) {
      for (let t = 0; t < q.cycle; t++) {
        const at = platformPos(q, t);
        if (at.x < course.x + course.w && course.x < at.x + q.width * T && at.y < course.y + course.h && course.y < at.y + T) {
          out.push(`${where} : la plateforme ${q.id} passe dans sa course (pas ${t} de son cycle)`);
          break;
        }
      }
    }
    // 3. Une place sûre pour attendre devant.
    let spot = false;
    let why = "aucun bloc plein au niveau de sa position basse dans les colonnes qui la précèdent";
    for (let c = p.col - 1; c >= p.col - PRESS_WAIT_REACH && c >= 0 && !spot; c--) {
      if (tileOf(level, c, floor) !== TILE_SOLID || tileOf(level, c, floor - 1) !== TILE_EMPTY || tileOf(level, c, floor - 2) !== TILE_EMPTY) continue;
      const hazard = standingHazard(level, c, floor);
      if (hazard === null) spot = true;
      else why = `la colonne ${c} n'est pas sûre : ${hazard}`;
    }
    if (!spot) out.push(`${where} : pas de place sûre pour attendre devant (${PRESS_WAIT_REACH} colonnes) : ${why}`);
    // 6. Pas de point de passage sous une presse ni dans sa course.
    for (const [name, cell] of [["départ", level.start] as const, ...level.checkpoints.map((c, i) => [`point ${i + 1}`, c] as const)]) {
      if (cell.row >= p.row && cell.col <= c1 && cell.col + PALIER_LENGTH - 1 >= p.col) out.push(`${where} : le ${name} (${cell.col},${cell.row}) est sous elle ou dans sa course`);
    }
  });
  return out;
}
