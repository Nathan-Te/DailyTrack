// Lot R9 (plateforme) : le refus des copies. Un classement du jour (DailyTrack, DailyJump) **refuse une rediffusion dont les entrées sont identiques**
// à la rediffusion de l'auteur du niveau (le pilote de Track, la preuve de Jump) **ou** à une rediffusion déjà classée d'un autre joueur ce jour-là :
// la renvoyer telle quelle donnerait le même temps que le premier sans avoir joué (audit S-08 / S-16). 409 `replay_copy`.
//
// L'empreinte porte sur **les entrées effectivement jouées**, pas sur le texte de la rediffusion : les séries sont recollées (deux séries voisines de la
// même commande n'en font qu'une : le codage d'octets n'est pas unique), et pour Track les pas après l'arrivée sont ignorés (le rejeu s'arrête à la
// ligne). Sans cela, ajouter un pas inutile à la fin ou recouper une série ferait passer une copie. **Ce que cela ne fait pas** : une rediffusion
// *modifiée* (une commande changée à un endroit sans effet) a une autre empreinte ; la plausibilité des entrées est le lot suivant (L-ROB).
//
// L'empreinte est un SHA-256 des entrées (non salé : elle ne révèle rien qu'on ne puisse déjà lire dans le fantôme du premier) ; elle est gardée avec
// chaque résultat (`results.inputs_hash`, `jump_results.inputs_hash`) et pour l'auteur du jour (`circuits.author_hash`, `jump_levels.author_hash`).
import { sha256Hex } from "./players";

interface TrackRunLike {
  count: number;
  steer: number;
  throttle: number;
  brake: number;
  respawn: number;
}

interface JumpRunLike {
  count: number;
  bits: number;
}

/** Les entrées de Track jusqu'à `ticks` pas (le pas de l'arrivée : `replayRace(...).ticks`), séries recollées. */
export function trackInputs(runs: readonly TrackRunLike[], ticks: number): string {
  const out: string[] = [];
  let left = ticks;
  let last = "";
  let count = 0;
  const flush = () => {
    if (count > 0) out.push(`${count}x${last}`);
  };
  for (const r of runs) {
    if (left <= 0) break;
    const n = Math.min(r.count, left);
    left -= n;
    const key = `${r.steer},${r.throttle},${r.brake},${r.respawn}`;
    if (count > 0 && key === last) count += n;
    else {
      flush();
      last = key;
      count = n;
    }
  }
  flush();
  return `track|${out.join(";")}`;
}

/** Les entrées d'un essai de Jump (toutes ses séries : un pas après la fin est refusé par le rejeu), séries recollées. */
export function jumpInputs(runs: readonly JumpRunLike[]): string {
  const out: string[] = [];
  let last = -1;
  let count = 0;
  for (const r of runs) {
    if (count > 0 && r.bits === last) count += r.count;
    else {
      if (count > 0) out.push(`${count}x${last}`);
      last = r.bits;
      count = r.count;
    }
  }
  if (count > 0) out.push(`${count}x${last}`);
  return `jump|${out.join(";")}`;
}

/** L'empreinte (SHA-256, hexadécimal) d'une suite d'entrées (`trackInputs`, `jumpInputs`). */
export const inputsHash = (inputs: string): Promise<string> => sha256Hex(inputs);
