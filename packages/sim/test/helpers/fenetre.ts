import { CELL, NO_GROUND, blockCells, blockPoint, createRace, createSurface, curveCenter, dirX, dirZ, isCurve, makeInput, roadHeightAt, stepRace, trackJumps, type Track } from "../../src/index";

// Lot 57 : la fenêtre d'un saut, par la simulation. On lance la voiture `LEAD` m avant le bord de l'appel, sur l'axe (ou décalée de `lat` m),
// cap de l'axe tourné de `angle` radians, à la vitesse `v`, accélérateur appuyé, sans braquer ; en l'air elle fige la caisse (frein) comme le
// ferait un joueur correct ; au sol elle freine. On note la vitesse au bord et si elle se pose sur la route (aucune chute dans les 2 s qui suivent).

const LEAD = 10;

export interface Essai {
  /** Vitesse au bord de l'appel (m/s), 0 si la voiture n'y est pas arrivée. */
  lip: number;
  /** Vrai si la voiture a quitté le sol puis s'est reposée sans tomber. */
  ok: boolean;
}

/** Point, cap (unitaire) et hauteur de la route `LEAD` m avant le bord de l'appel du saut `j`, sur l'axe. */
function depart(track: Track, j: number) {
  const jump = trackJumps(track)[j]!;
  const b = track.blocks[jump.kick]!;
  const pt = { x: 0, z: 0 };
  if (isCurve(b.kind)) {
    // Virage-tremplin : sur l'arc, à `LEAD` m de la sortie ; cap = la tangente de l'arc.
    const { cp, r } = curveCenter(b.kind);
    const side = cp > CELL / 2 ? -1 : 1;
    const a = Math.PI / 2 - LEAD / r;
    const p = cp + side * r * Math.cos(a);
    const q = r * Math.sin(a);
    blockPoint(b, p, q, pt);
    const ahead = { x: 0, z: 0 };
    const a2 = a + 0.01;
    blockPoint(b, cp + side * r * Math.cos(a2), r * Math.sin(a2), ahead);
    const dx = ahead.x - pt.x;
    const dz = ahead.z - pt.z;
    const n = Math.hypot(dx, dz);
    const lipDir = blockCells(b.cx, b.cz, b.dir, b.kind).next.dir;
    const lip = { x: 0, z: 0 };
    blockPoint(b, cp, r, lip);
    return { x: pt.x, z: pt.z, y: roadHeightAt(b, p, q), fx: dx / n, fz: dz / n, lip, lfx: dirX(lipDir), lfz: dirZ(lipDir), jump };
  }
  blockPoint(b, CELL / 2, CELL - LEAD, pt);
  const lip = { x: 0, z: 0 };
  blockPoint(b, CELL / 2, CELL, lip);
  return { x: pt.x, z: pt.z, y: roadHeightAt(b, CELL / 2, CELL - LEAD), fx: dirX(b.dir), fz: dirZ(b.dir), lip, lfx: dirX(b.dir), lfz: dirZ(b.dir), jump };
}

export function essai(track: Track, j: number, v: number, angle: number, lat: number): Essai {
  const d = depart(track, j);
  const race = createRace(track);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const fx = d.fx * c + d.fz * s;
  const fz = -d.fx * s + d.fz * c;
  // Gauche = (fz, −fx) dans le repère du jeu (cap 0 = +z, positif vers la gauche).
  const car = race.car;
  car.x = d.x + lat * d.fz;
  car.z = d.z - lat * d.fx;
  car.y = d.y;
  car.yaw = Math.atan2(fx, fz);
  car.vx = fx * v;
  car.vz = fz * v;
  let lip = 0;
  let flown = 0;
  let landed = -1;
  const surf = createSurface();
  for (let t = 0; t < 600; t++) {
    const input = car.grounded ? (flown > 30 ? makeInput(0, 0, 1) : makeInput(0, 1, 0)) : makeInput(0, 0, 1);
    stepRace(race, input);
    if (race.fallTicks > 0) return { lip, ok: false };
    if (!lip) {
      const dx = car.x - d.lip.x;
      const dz = car.z - d.lip.z;
      if (dx * d.lfx + dz * d.lfz >= 0) lip = Math.hypot(car.vx, car.vz);
    }
    if (!car.grounded) flown++;
    else if (flown > 30 && landed < 0) {
      landed = t;
      race.world.sample(car.x, car.z, surf);
      if (surf.height === NO_GROUND) return { lip, ok: false };
    }
    if (landed >= 0 && t - landed > 240) return { lip, ok: true };
  }
  return { lip, ok: landed >= 0 };
}
