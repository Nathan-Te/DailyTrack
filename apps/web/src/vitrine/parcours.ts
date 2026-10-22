// Retouche 38b — la course enregistrée de la vue en mouvement : le pilote automatique fait le tour (dans un fil de travail, `piloteWorker.ts`),
// la course est rejouée pas à pas (`stepRace`, les mêmes commandes) et chaque pas devient une pose : position, cap, tangage, roulis, normale,
// braquage, vitesses, frein. La vitrine rejoue en boucle **un bout** de ce tour (`fenetre`), vu depuis la caméra de poursuite. Lecture seule : la
// simulation n'est jamais modifiée.
import { CELL, ReplayPlayer, cellKey, createRace, forwardSpeed, isCurve, stepRace, type Replay, type Track } from "@cdj/sim";

/** Valeurs par pas, dans cet ordre (un `Float32Array` de `CHAMPS` × pas). */
export const CHAMPS = 14;
export const C = { x: 0, y: 1, z: 2, yaw: 3, pitch: 4, roll: 5, nx: 6, ny: 7, nz: 8, steer: 9, avant: 10, vx: 11, vz: 12, frein: 13 } as const;
export type Champ = (typeof C)[keyof typeof C];

/** Rejoue `replay` et rend une pose par pas (le départ compris), jusqu'à l'arrivée. */
export function enregistrer(track: Track, replay: Replay): Float32Array {
  const race = createRace(track);
  const player = new ReplayPlayer(replay);
  const poses: number[] = [];
  const pose = (frein: number) => {
    const c = race.car;
    poses.push(c.x, c.y, c.z, c.yaw, c.pitch, c.roll, c.nx, c.ny, c.nz, c.steer, forwardSpeed(c), c.vx, c.vz, frein);
  };
  pose(0);
  for (let i = 0; i < 120 * 300 && race.finishMs < 0 && !player.done; i++) {
    const input = player.next();
    stepRace(race, input);
    pose(input.brake > 0 ? 1 : 0);
  }
  return Float32Array.from(poses);
}

export type Bout = "depart" | "course";

/**
 * Le bout du tour qu'on rejoue en boucle (pas de début et de fin) : « départ » = les 12 premières secondes (le portique, la tribune) ;
 * « course » = de 2 s avant l'entrée du premier virage (après les trois premiers blocs) à 12 s plus tard.
 */
export function fenetre(track: Track, poses: Float32Array, bout: Bout, secondes = 12): [number, number] {
  const n = Math.floor(poses.length / CHAMPS);
  const duree = Math.round(secondes * 120);
  if (bout === "depart" || n <= duree) return [0, Math.min(n - 1, duree)];
  const virage = track.blocks.find((b) => b.index > 2 && isCurve(b.kind));
  let entree = -1;
  if (virage) {
    for (let i = 0; i < n; i++) {
      const b = track.cells.get(cellKey(Math.floor(poses[i * CHAMPS + C.x]! / CELL), Math.floor(poses[i * CHAMPS + C.z]! / CELL)));
      if (b && b.index === virage.index) {
        entree = i;
        break;
      }
    }
  }
  const debut = Math.max(0, Math.min(n - 1 - duree, (entree < 0 ? Math.round(n / 3) : entree) - 240));
  return [debut, debut + duree];
}

/** Une valeur d'une pose interpolée entre deux pas (`f` ∈ [0, 1]) ; les angles passent par le plus court chemin. */
export function lire(poses: Float32Array, pas: number, f: number, champ: Champ): number {
  const a = poses[pas * CHAMPS + champ]!;
  const b = poses[(pas + 1) * CHAMPS + champ] ?? a;
  if (champ === C.yaw) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * f;
  }
  return a + (b - a) * f;
}
