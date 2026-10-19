import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, JumpReplayError, decodeReplay, encodeReplay, replayAttempt, type JumpReplay, type Level } from "@cdj/jump-sim";

// Le fantôme du premier (lot P2 de la plateforme), **logique seule** (testée sous Node) : ce que le serveur rend
// (`GET /api/jump/day/<date>/ghost/first`), sa validation à la lecture, la règle « pas de doublon » et les couleurs des deux fantômes.
//
//   - **Validation à la lecture** (comme le meilleur essai du lot 3) : une rediffusion d'une autre version (simulation, générateur), d'un autre
//     niveau, qui ne part pas du départ ou qui n'arrive pas est **ignorée** ; le temps et les morts affichés sont ceux **du rejeu du jeu**,
//     jamais ceux annoncés.
//   - **Pas de doublon** : si le premier, c'est toi (le serveur le dit : `mine`, ou la rediffusion est la tienne, ou ton meilleur essai du jour
//     est déjà plus rapide que le sien), le fantôme du premier n'est pas montré : ton fantôme est celui du premier.
//   - **Deux couleurs** : le tien (cyan clair) et celui du premier (mauve), ni l'une ni l'autre près du rouge des dangers ni du jaune du
//     personnage (règle du lot 9 : teintes à ≥ 30° de chacun), et assez loin l'une de l'autre (≥ 60°) ; contrastes testés dans
//     `test/fantomes.test.ts` contre le ciel et chaque plan de chaque thème.

/** Ton fantôme (le meilleur essai du jour) : cyan clair, teinte ≈ 196°. Avant le lot P2, il avait le jaune du personnage. */
export const OWN_GHOST_COLOR = 0x7fdcff;
/** Le fantôme du premier, et son pseudo : mauve, teinte ≈ 292°. */
export const FIRST_GHOST_COLOR = 0xf08cff;

/** Ce que rend `GET /api/jump/day/<date>/ghost/first` (et la démonstration). */
export interface FirstGhostData {
  date: string;
  levelId: string;
  name: string;
  ticks: number;
  deaths: number;
  replay: string;
  simVersion: number;
  generatorVersion: number;
  /** Le premier, c'est toi (le serveur l'a reconnu par ton identifiant). */
  mine: boolean;
}

/** Un fantôme du premier accepté : sa rediffusion, et ce que **le jeu** en a rejoué. */
export interface FirstGhost {
  name: string;
  replay: JumpReplay;
  /** La rediffusion telle que reçue (base64url), pour la reconnaître si c'est la tienne. */
  code: string;
  ticks: number;
  deaths: number;
  mine: boolean;
}

/**
 * Vérifie une réponse du serveur (rien n'est pris sur parole) : forme, versions de la simulation et du générateur, identifiant du niveau, départ
 * du niveau, puis **le rejeu** sur le niveau ouvert : l'essai doit arriver. Rend le fantôme, ou la raison du refus (il est alors ignoré).
 */
export function checkFirstGhost(data: unknown, level: Level, levelId: string): { ok: true; ghost: FirstGhost } | { ok: false; reason: string } {
  if (typeof data !== "object" || data === null) return { ok: false, reason: "réponse illisible" };
  const d = data as Partial<FirstGhostData>;
  if (typeof d.replay !== "string" || typeof d.name !== "string") return { ok: false, reason: "réponse incomplète" };
  if (d.simVersion !== JUMP_SIM_VERSION || d.generatorVersion !== JUMP_GENERATOR_VERSION) return { ok: false, reason: "autre version du jeu" };
  if (d.levelId !== levelId) return { ok: false, reason: "autre niveau" };
  let replay: JumpReplay;
  try {
    replay = decodeReplay(d.replay);
  } catch (e) {
    return { ok: false, reason: e instanceof JumpReplayError ? e.message : "rediffusion illisible" };
  }
  if (replay.simVersion !== JUMP_SIM_VERSION) return { ok: false, reason: "rediffusion d'une autre version" };
  if (replay.levelId !== levelId) return { ok: false, reason: "rediffusion d'un autre niveau" };
  if (replay.start.checkpoint !== -1 || replay.start.time !== 0) return { ok: false, reason: "la rediffusion ne part pas du départ" };
  let r;
  try {
    r = replayAttempt(level, replay, levelId);
  } catch (e) {
    return { ok: false, reason: e instanceof JumpReplayError ? e.message : "rediffusion illisible" };
  }
  if (!r.finished) return { ok: false, reason: "la rediffusion n'arrive pas" };
  return { ok: true, ghost: { name: d.name, replay, code: encodeReplay(replay), ticks: r.time, deaths: r.deaths.length, mine: d.mine === true } };
}

/**
 * Faut-il montrer le fantôme du premier à côté du tien ? Non s'il n'y en a pas, ou si le premier, c'est toi : le serveur le dit (`mine`), la
 * rediffusion est celle de ton meilleur essai, ou ton meilleur essai du jour est déjà plus rapide (pas encore classé : tu es le premier). À temps
 * égal, le premier envoyé reste devant : son fantôme reste.
 */
export function showFirstGhost(first: Pick<FirstGhost, "mine" | "ticks" | "code"> | null, own: { ticks: number; code: string } | null): boolean {
  if (!first || first.mine) return false;
  if (own && (own.code === first.code || own.ticks < first.ticks)) return false;
  return true;
}

/** L'étiquette au-dessus du fantôme du premier : son pseudo. */
export function firstGhostLabel(name: string): string {
  return `${name} · 1ᵉʳ`;
}
