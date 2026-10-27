import { circleHitsBox } from "./attempt";
import { PALIER_LENGTH, UNITS_PER_TILE } from "./constants";
import { TILE_EMPTY, TILE_SOLID, isSolidTile, laserBarBox, laserBox, platformPos, pressBox, sawCenter, type Level, type Laser, type LaserBar } from "./level";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "./player";

// Les règles du générateur pour les lasers (lot 25) — ce qu'un morceau ou un niveau du jour doit tenir pour qu'un rayon reste lisible et jouable.
// Fonctions pures (le générateur les applique à chaque niveau v9, les tests au catalogue) :
//   1. **Dans son morceau** : le rayon d'un laser fixe, le trajet entier d'une barre, restent à au moins une colonne des bords de leur section (`parseLevel` exige déjà
//      qu'ils soient dans une seule section, sur des tuiles vides, avec des émetteurs sur des pleins pour un laser fixe).
//   2. **Rien d'autre dans la course d'un rayon** : aucune scie (sur tout son cycle), presse (toute sa course), plateforme mobile ni autre rayon ne passe dans la course
//      d'un laser fixe (son rayon) ni dans le trajet d'une barre (la boîte qu'elle balaie).
//   3. **Aucun point de passage dans la course d'un rayon** : le départ `S` et les points `C` ne sont jamais sur les colonnes d'une course, à la hauteur de sa rangée
//      ou à moins de `LASER_PALIER_ROWS` rangées au-dessus ; que ce point reste **sûr à toute phase** est dans `respawnProblems` (`daily.ts`) et `palierProblems` (`modules.ts`).
//   4. **Une place sûre pour attendre devant** : dans les `LASER_WAIT_REACH` colonnes qui précèdent la course (à gauche : les niveaux vont de gauche à droite), un bloc
//      plein avec deux tuiles libres au-dessus, à une hauteur voisine de la course, que **rien ne touche à aucun pas** de son horloge (ni rayon, même allumé, ni scie, ni presse,
//      ni barre) : on y attend l'allumage sans rien risquer. Pour un rayon horizontal fixe (en général dans un puits, entre deux murs), elle peut aussi être au-dessous du rayon, dans ses colonnes.
//   5. **Une barre coulissante ne coince jamais le joueur contre un plein** : dans le sens de son glissement, au-delà de chacune de ses deux positions extrêmes, la
//      tuile qui suit (`LASER_BAR_CLEARANCE`, sur la largeur de son rayon) ne contient aucun plein : le rayon ne touche jamais un mur, un sol ni un plafond sur sa route,
//      il reste toujours une tuile entière entre lui et le plein (un joueur debout, haut de 0,75 tuile, s'y tient sans être touché : le rayon, épais d'un quart de tuile au
//      milieu de sa tuile, ne descend jamais jusqu'à la tête de qui est posé sur un sol), et le joueur a de quoi s'écarter ou la sauter. Sa vitesse de pointe reste sous
//      `MAX_LASER_STEP` (refusé par `parseLevel`), très en dessous de la course : on peut toujours la distancer.

const T = UNITS_PER_TILE;

/** Colonnes devant un rayon où chercher la place pour attendre. */
export const LASER_WAIT_REACH = 5;
/** Rangées au-dessous d'une course où le sol d'une place pour attendre est encore « à la hauteur » du rayon. */
export const LASER_WAIT_ROWS = 12;
/** Rangées au-dessus du sol d'un point de passage où un rayon est « dans sa course ». */
export const LASER_PALIER_ROWS = 3;
/** Une barre n'est jamais contre un plein : il reste ce nombre de tuiles libres au-delà de chacune de ses deux positions extrêmes, dans le sens de son glissement. */
export const LASER_BAR_CLEARANCE = 1;

const tileOf = (level: Level, col: number, row: number): number => (col < 0 || row < 0 || col >= level.width ? TILE_SOLID : row >= level.height ? TILE_EMPTY : level.tiles[row * level.width + col]!);

interface Course {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  section: number;
}

/** La course d'un laser fixe : les tuiles de son rayon (colonnes et rangées, bornes comprises). */
export function laserCourse(l: Pick<Laser, "axis" | "col" | "row" | "length">): { c0: number; c1: number; r0: number; r1: number } {
  return { c0: l.col, c1: l.axis === "h" ? l.col + l.length - 1 : l.col, r0: l.row, r1: l.axis === "v" ? l.row + l.length - 1 : l.row };
}

/** La course d'une barre : la boîte de tuiles qu'elle balaie, de sa position `a` à sa position `b`. */
export function barCourse(b: Pick<LaserBar, "axis" | "a" | "b" | "length">): { c0: number; c1: number; r0: number; r1: number } {
  return {
    c0: Math.min(b.a.col, b.b.col),
    c1: Math.max(b.a.col, b.b.col) + (b.axis === "h" ? b.length - 1 : 0),
    r0: Math.min(b.a.row, b.b.row),
    r1: Math.max(b.a.row, b.b.row) + (b.axis === "v" ? b.length - 1 : 0),
  };
}

const courseBox = (c: { c0: number; c1: number; r0: number; r1: number }) => ({ x: c.c0 * T, y: c.r0 * T, w: (c.c1 - c.c0 + 1) * T, h: (c.r1 - c.r0 + 1) * T });
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Tous les rayons du niveau comme des courses (lasers fixes, puis barres) : `{ id, kind, c0, c1, r0, r1, section }`. */
function courses(level: Level): (Course & { id: string; kind: "laser" | "barre" })[] {
  return [
    ...level.lasers.map((l) => ({ id: l.id, kind: "laser" as const, section: l.section, ...laserCourse(l) })),
    ...level.laserBars.map((b) => ({ id: b.id, kind: "barre" as const, section: b.section, ...barCourse(b) })),
  ];
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
    for (let t = 0; t < q.cycle; t++) if (overlaps(box, pressBox(q, t))) return `la presse ${q.id} y passe (pas ${t})`;
  }
  for (const l of level.lasers) if (overlaps(box, laserBox(l))) return `le laser ${l.id} y passe`;
  for (const b of level.laserBars) {
    for (let t = 0; t < b.cycle; t++) if (overlaps(box, laserBarBox(b, t))) return `la barre ${b.id} y passe (pas ${t})`;
  }
  return null;
}

/** Une place pour attendre : un plein avec deux tuiles libres au-dessus et rien de mortel à aucun pas. Rend `null` si sûre, sinon pourquoi pas. */
function refugeProblem(level: Level, col: number, floor: number): string | null {
  if (!isSolidTile(tileOf(level, col, floor)) || tileOf(level, col, floor - 1) !== TILE_EMPTY || tileOf(level, col, floor - 2) !== TILE_EMPTY) return "ce n'est pas un sol dégagé";
  return standingHazard(level, col, floor);
}

/** Ce qui ne va pas dans les lasers et les barres d'un niveau (vide : conformes). */
export function laserProblems(level: Level): string[] {
  const out: string[] = [];
  if (level.lasers.length === 0 && level.laserBars.length === 0) return out;
  const all = courses(level);
  for (const c of all) {
    const where = `${c.kind === "laser" ? "laser" : "barre"} ${c.id}`;
    const sec = level.sections[c.section]!;
    // 1. Dans son morceau.
    if (c.c0 < sec.c0 + 1 || c.c1 > sec.c1 - 1) out.push(`${where} : sa course (colonnes ${c.c0}-${c.c1}) sort de la section ${sec.name} (${sec.c0 + 1}-${sec.c1 - 1} permis)`);
    // 2. Rien d'autre dans sa course.
    const box = courseBox(c);
    for (const saw of level.saws) {
      const steps = saw.cycle === 0 ? 1 : saw.cycle;
      for (let t = 0; t < steps; t++) {
        const s = sawCenter(saw, t);
        if (circleHitsBox(s.x, s.y, saw.radius, box)) {
          out.push(`${where} : la scie ${saw.id} passe dans sa course (pas ${t} de son cycle)`);
          break;
        }
      }
    }
    for (const q of level.presses) {
      if (overlaps(box, { x: q.col * T, y: q.row * T, w: q.width * T, h: (q.travel + 2) * T })) out.push(`${where} : la course de la presse ${q.id} recoupe la sienne`);
    }
    for (const q of level.platforms) {
      for (let t = 0; t < q.cycle; t++) {
        const at = platformPos(q, t);
        if (overlaps(box, { x: at.x, y: at.y, w: q.width * T, h: T })) {
          out.push(`${where} : la plateforme ${q.id} passe dans sa course (pas ${t} de son cycle)`);
          break;
        }
      }
    }
    for (const o of all) {
      if (o.kind === c.kind && o.id === c.id) continue;
      if (overlaps(box, courseBox(o)) && (o.kind < c.kind || (o.kind === c.kind && o.id < c.id))) out.push(`${where} : sa course recoupe celle de ${o.kind} ${o.id}`);
    }
    // 3. Pas de point de passage dans sa course.
    for (const [name, cell] of [["départ", level.start] as const, ...level.checkpoints.map((p, i) => [`point ${i + 1}`, p] as const)]) {
      if (cell.col <= c.c1 && cell.col + PALIER_LENGTH - 1 >= c.c0 && c.r1 >= cell.row - LASER_PALIER_ROWS && c.r0 <= cell.row + 1) out.push(`${where} : le ${name} (${cell.col},${cell.row}) est dans sa course`);
    }
    // 4. Une place sûre pour attendre devant.
    let spot = false;
    let why = "aucun sol dégagé devant";
    const horizontal = c.kind === "laser" && level.lasers.find((l) => l.id === c.id)!.axis === "h";
    // Les colonnes devant la course (à gauche, hors de l'émetteur) à une hauteur voisine de la sienne ; pour un rayon horizontal fixe (un puits entre deux murs), aussi
    // les colonnes de son rayon, au-dessous de lui.
    const spots: { col: number; from: number }[] = [];
    for (let col = c.c0 - 2; col >= c.c0 - 1 - LASER_WAIT_REACH && col >= 0; col--) spots.push({ col, from: c.r0 });
    if (horizontal) for (let col = c.c0; col <= c.c1; col++) spots.push({ col, from: c.r1 + 2 });
    for (const { col, from } of spots) {
      for (let floor = from; floor <= c.r1 + LASER_WAIT_ROWS && floor < level.height && !spot; floor++) {
        const bad = refugeProblem(level, col, floor);
        if (bad === null) spot = true;
        else if (bad !== "ce n'est pas un sol dégagé") why = `la colonne ${col} n'est pas sûre : ${bad}`;
      }
      if (spot) break;
    }
    if (!spot) out.push(`${where} : pas de place sûre pour attendre devant (${LASER_WAIT_REACH} colonnes) : ${why}`);
  }
  // 5. Une barre n'approche jamais un plein dans le sens de son glissement.
  for (const b of level.laserBars) {
    const where = `barre ${b.id}`;
    const c = barCourse(b);
    // Le rayon couvre `length` tuiles perpendiculaires à son glissement : la bande à surveiller au-delà de chaque extrémité.
    for (let k = 1; k <= LASER_BAR_CLEARANCE; k++) {
      if (b.axis === "h") {
        const lo = c.r0 - k;
        const hi = c.r1 + k;
        for (let col = c.c0; col <= c.c1; col++) {
          if (isSolidTile(tileOf(level, col, lo))) out.push(`${where} : un plein à ${k} tuile(s) au-dessus de sa position haute (${col},${lo})`);
          if (isSolidTile(tileOf(level, col, hi))) out.push(`${where} : un plein à ${k} tuile(s) au-dessous de sa position basse (${col},${hi})`);
        }
      } else {
        const lo = c.c0 - k;
        const hi = c.c1 + k;
        for (let row = c.r0; row <= c.r1; row++) {
          if (isSolidTile(tileOf(level, lo, row))) out.push(`${where} : un plein à ${k} tuile(s) à gauche de sa position gauche (${lo},${row})`);
          if (isSolidTile(tileOf(level, hi, row))) out.push(`${where} : un plein à ${k} tuile(s) à droite de sa position droite (${hi},${row})`);
        }
      }
    }
  }
  return out;
}
