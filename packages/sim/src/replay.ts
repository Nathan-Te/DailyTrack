import { TICK_RATE, SIM_VERSION } from "./constants";
import { AXIS_MAX, NO_INPUT, copyCar, createCar, type CarInput, type CarState } from "./car";
import { createRace, stepRace } from "./race";
import type { Track } from "./track";

// Une course est entièrement décrite par la suite des commandes du joueur (une par pas de simulation).
// On les stocke en « séries » (nombre de pas consécutifs avec la même commande), puis en octets, puis en
// texte base64url : de quoi tenir dans le navigateur (localStorage) et dans une requête vers le serveur.

/** Durée maximale acceptée d'une rediffusion (10 minutes) : protège le serveur des rediffusions démesurées. */
export const MAX_REPLAY_TICKS = TICK_RATE * 600;

const FORMAT = 1;
const RESPAWN_BIT = 0x80;

export interface ReplayRun {
  /** Nombre de pas consécutifs avec cette commande (≥ 1). */
  count: number;
  steer: number;
  throttle: number;
  brake: number;
  respawn: number;
}

export interface Replay {
  simVersion: number;
  trackId: string;
  runs: ReplayRun[];
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

export function replayTicks(replay: Replay): number {
  let n = 0;
  for (const r of replay.runs) n += r.count;
  return n;
}

/** Enregistre les commandes appliquées, pas après pas. */
export class ReplayRecorder {
  private runs: ReplayRun[] = [];
  private total = 0;

  get ticks(): number {
    return this.total;
  }

  reset(): void {
    this.runs = [];
    this.total = 0;
  }

  record(input: CarInput): void {
    const last = this.runs[this.runs.length - 1];
    if (
      last &&
      last.steer === input.steer &&
      last.throttle === input.throttle &&
      last.brake === input.brake &&
      last.respawn === input.respawn
    ) {
      last.count += 1;
    } else {
      this.runs.push({ count: 1, steer: input.steer, throttle: input.throttle, brake: input.brake, respawn: input.respawn });
    }
    this.total += 1;
  }

  toReplay(trackId: string): Replay {
    return { simVersion: SIM_VERSION, trackId, runs: this.runs.map((r) => ({ ...r })) };
  }
}

/** Relit des commandes dans l'ordre, un pas à la fois. Une fois épuisée, ne donne plus aucune commande. */
export class ReplayPlayer {
  private run = 0;
  private left: number;
  private readonly out: CarInput = { steer: 0, throttle: 0, brake: 0, respawn: 0 };

  constructor(readonly replay: Replay) {
    this.left = replay.runs[0]?.count ?? 0;
  }

  get done(): boolean {
    return this.run >= this.replay.runs.length;
  }

  /** Commande du pas suivant (objet réutilisé à chaque appel). `NO_INPUT` quand la rediffusion est finie. */
  next(): CarInput {
    const r = this.replay.runs[this.run];
    if (!r) return NO_INPUT;
    this.out.steer = r.steer;
    this.out.throttle = r.throttle;
    this.out.brake = r.brake;
    this.out.respawn = r.respawn;
    this.left -= 1;
    if (this.left === 0) {
      this.run += 1;
      this.left = this.replay.runs[this.run]?.count ?? 0;
    }
    return this.out;
  }
}

// --- Encodage ---------------------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2]!;
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) out += B64[c & 63]!;
  }
  return out;
}

function fromBase64Url(text: string): number[] {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    const v = B64.indexOf(text[i]!);
    if (v < 0) throw new ReplayError("Rediffusion illisible (caractère invalide)");
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  if (bits >= 6) throw new ReplayError("Rediffusion illisible (longueur invalide)");
  return bytes;
}

const ID_OK = /^[a-z0-9_-]{1,32}$/;

/** Rediffusion → texte base64url. Format : [format, version sim, longueur id, id…] puis, par série : [nombre (varint), steer (int8), throttle, brake | bit 7 = respawn]. */
export function encodeReplay(replay: Replay): string {
  if (!ID_OK.test(replay.trackId)) throw new ReplayError("Identifiant de circuit invalide");
  const bytes: number[] = [FORMAT, replay.simVersion, replay.trackId.length];
  for (let i = 0; i < replay.trackId.length; i++) bytes.push(replay.trackId.charCodeAt(i));
  for (const r of replay.runs) {
    let n = r.count;
    while (n >= 0x80) {
      bytes.push((n & 0x7f) | 0x80);
      n >>= 7;
    }
    bytes.push(n);
    bytes.push(r.steer & 0xff, r.throttle, r.brake | (r.respawn ? RESPAWN_BIT : 0));
  }
  return toBase64Url(bytes);
}

/** Texte → rediffusion. Refuse tout ce qui est mal formé ou hors limites (le texte vient du réseau). */
export function decodeReplay(code: string): Replay {
  const bytes = fromBase64Url(code);
  let pos = 0;
  const byte = (): number => {
    const b = bytes[pos++];
    if (b === undefined) throw new ReplayError("Rediffusion tronquée");
    return b;
  };
  if (byte() !== FORMAT) throw new ReplayError("Format de rediffusion inconnu");
  const simVersion = byte();
  const idLen = byte();
  if (idLen < 1 || idLen > 32) throw new ReplayError("Identifiant de circuit invalide");
  let trackId = "";
  for (let i = 0; i < idLen; i++) trackId += String.fromCharCode(byte());
  if (!ID_OK.test(trackId)) throw new ReplayError("Identifiant de circuit invalide");

  const runs: ReplayRun[] = [];
  let total = 0;
  while (pos < bytes.length) {
    let count = 0;
    let shift = 0;
    for (;;) {
      const b = byte();
      count += (b & 0x7f) * (1 << shift);
      if ((b & 0x80) === 0) break;
      shift += 7;
      if (shift > 21) throw new ReplayError("Série trop longue");
    }
    if (count < 1) throw new ReplayError("Série vide");
    const raw = byte();
    const steer = raw >= 0x80 ? raw - 0x100 : raw;
    const throttle = byte();
    const last = byte();
    const respawn = last & RESPAWN_BIT ? 1 : 0;
    const brake = last & ~RESPAWN_BIT;
    if (steer < -AXIS_MAX || steer > AXIS_MAX || throttle > AXIS_MAX || brake > AXIS_MAX) {
      throw new ReplayError("Commande hors limites");
    }
    total += count;
    if (total > MAX_REPLAY_TICKS) throw new ReplayError("Rediffusion trop longue");
    runs.push({ count, steer, throttle, brake, respawn });
  }
  return { simVersion, trackId, runs };
}

// --- Rejeu ------------------------------------------------------------------------------------

export interface ReplayResult {
  finished: boolean;
  /** Temps final en ms recalculé par la simulation, ou -1 si la rediffusion ne franchit pas l'arrivée. */
  finishMs: number;
  splits: number[];
  respawns: number;
  /** Nombre de pas rejoués. */
  ticks: number;
  finalCar: CarState;
}

/**
 * Rejoue une rediffusion avec le même code de simulation que le jeu et renvoie ce que la simulation a
 * recalculé. C'est ce résultat — jamais un temps annoncé par le joueur — qui fait foi pour le classement.
 */
export function replayRace(track: Track, replay: Replay): ReplayResult {
  if (replay.simVersion !== SIM_VERSION) throw new ReplayError("Version de simulation différente");
  if (replay.trackId !== track.id) throw new ReplayError("Rediffusion d'un autre circuit");
  const race = createRace(track);
  const player = new ReplayPlayer(replay);
  let ticks = 0;
  while (!player.done && race.finishMs < 0) {
    stepRace(race, player.next());
    ticks += 1;
  }
  const finalCar = createCar();
  copyCar(race.car, finalCar);
  return {
    finished: race.finishMs >= 0,
    finishMs: race.finishMs,
    splits: [...race.splits],
    respawns: race.respawns,
    ticks,
    finalCar,
  };
}
