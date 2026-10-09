import { SIM_VERSION, decodeReplay, mixSeed, replayRace, salonSessionAt, salonSessionEnd, salonSessionStart, salonTrackId } from "@cdj/sim";
import type { ApiResult } from "./api";
import type { SalonApi, SalonBoard, SalonGhost, SalonNow, SalonRow, SalonSubmitResult } from "./salonApi";
import type { LoadedSalonCircuit, SalonEngine } from "./salonEngine";
import type { PilotRunData } from "./salonJobs";
import { demoPlan, plannedRuns, type PilotPlan } from "./salonPlan";
import { SUBMIT_GRACE_MS, type SalonClock } from "./salon";

// Salon de démonstration (`?mode=salon&api=demo`, lot 26) : le navigateur joue le rôle du serveur. Il tient les classements de session,
// valide les courses du joueur **par rejeu** (comme le futur serveur : le temps annoncé ne compte pas) et fait arriver des joueurs
// fictifs au fil de la session. Rien n'est envoyé nulle part, rien n'est conservé au-delà de la page, et rien ne touche aux records
// ni au classement du circuit du jour. Les mêmes routes que `HttpSalonApi` : le jeu ne sait pas à qui il parle.

const BOARD_ROWS = 15;
const fail = <T>(status: number, code: string, message: string): ApiResult<T> => ({ ok: false, status, code, message });

interface Entry {
  ref: string;
  name: string;
  ms: number;
  splits: number[];
  replay: string;
  /** Instant de l'envoi (ms depuis le début de la session) : départage deux temps égaux. */
  at: number;
}

interface SessionData {
  plan: PilotPlan[];
  /** Courses des pilotes fictifs déjà calculées (clé `pilote:essai`). */
  computed: Map<string, PilotRunData>;
  mine: Map<string, Entry>; // par référence (un seul joueur en démo, mais la forme est celle du serveur)
  version: number;
  signature: string;
  pumping: boolean;
}

/** Empreinte rapide d'un texte (FNV-1a) : référence publique d'un joueur dans une session. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export const myRef = (session: number, playerId: string): string => `m${mixSeed(hash(playerId), session).toString(16).padStart(8, "0")}`;

export interface DemoSalonOptions {
  clock: SalonClock;
  sessionMs: number;
  engine: SalonEngine;
  /** Circuit d'une session (mis en cache par l'appelant) : c'est lui qui rejoue les courses du joueur. */
  circuit(session: number): Promise<LoadedSalonCircuit | null>;
}

export class DemoSalonApi implements SalonApi {
  private readonly sessions = new Map<number, SessionData>();

  constructor(private readonly o: DemoSalonOptions) {}

  private data(session: number): SessionData {
    let d = this.sessions.get(session);
    if (!d) {
      d = { plan: demoPlan(session, this.o.sessionMs), computed: new Map(), mine: new Map(), version: 1, signature: "", pumping: false };
      this.sessions.set(session, d);
      while (this.sessions.size > 4) this.sessions.delete(Math.min(...this.sessions.keys()));
      void this.pump(session, d);
    }
    return d;
  }

  /** Calcule, une course à la fois et dans l'ordre des envois prévus, les courses des pilotes fictifs. */
  private async pump(session: number, d: SessionData): Promise<void> {
    if (d.pumping) return;
    d.pumping = true;
    for (const run of plannedRuns(d.plan)) {
      if (this.o.clock.now() > salonSessionEnd(session, this.o.sessionMs) + SUBMIT_GRACE_MS) break; // session close : inutile
      const r = await this.o.engine.pilotRun(session, this.o.sessionMs, run.pilot, run.attempt).catch(() => null);
      if (r) d.computed.set(`${run.pilot}:${run.attempt}`, r);
    }
  }

  /** Meilleur temps de chaque joueur arrivé à l'instant `now`, classé. */
  private entries(session: number, d: SessionData): Entry[] {
    const elapsed = this.o.clock.now() - salonSessionStart(session, this.o.sessionMs);
    const best = new Map<string, Entry>();
    const consider = (e: Entry) => {
      const known = best.get(e.ref);
      if (!known || e.ms < known.ms) best.set(e.ref, e);
    };
    for (const r of d.computed.values()) if (r.at <= elapsed) consider({ ref: r.ref, name: r.name, ms: r.ms, splits: r.splits, replay: r.replay, at: r.at });
    for (const e of d.mine.values()) consider(e);
    const list = [...best.values()].sort((a, b) => a.ms - b.ms || a.at - b.at || (a.ref < b.ref ? -1 : 1));
    const signature = list.map((e) => `${e.ref}:${e.ms}`).join(",");
    if (signature !== d.signature) {
      d.signature = signature;
      d.version++;
    }
    return list;
  }

  private present(session: number, d: SessionData): number {
    const elapsed = this.o.clock.now() - salonSessionStart(session, this.o.sessionMs);
    return 1 + d.plan.filter((p) => p.joinAt <= elapsed && elapsed <= p.attempts[p.attempts.length - 1]!.at + 60_000).length;
  }

  private build(session: number, d: SessionData, mine: string): SalonBoard {
    const list = this.entries(session, d);
    const first = list[0]?.ms ?? 0;
    const row = (e: Entry, i: number): SalonRow => ({ rank: i + 1, ref: e.ref, name: e.name, ms: e.ms, gap: e.ms - first, ...(e.ref === mine ? { mine: true } : {}) });
    const all = list.map(row);
    const me = all.find((r) => r.mine) ?? null;
    // Les premiers, plus ceux qui entourent le joueur (le jeu choisit son voisin de devant et de derrière parmi ces lignes).
    const rows = all.filter((r) => r.rank <= BOARD_ROWS || (me !== null && Math.abs(r.rank - me.rank) <= 1));
    return { session, version: d.version, participants: all.length, players: this.present(session, d), rows, me };
  }

  async now(_playerId: string): Promise<ApiResult<SalonNow>> {
    const serverMs = this.o.clock.now();
    const session = salonSessionAt(serverMs, this.o.sessionMs);
    this.data(session);
    return { ok: true, data: { serverMs, session, startMs: salonSessionStart(session, this.o.sessionMs), endMs: salonSessionEnd(session, this.o.sessionMs), trackId: salonTrackId(session), players: this.present(session, this.data(session)) } };
  }

  async board(session: number, playerId: string, since?: number): Promise<ApiResult<SalonBoard>> {
    const d = this.data(session);
    const board = this.build(session, d, myRef(session, playerId));
    if (since !== undefined && since === board.version) return { ok: true, data: { session, version: board.version, participants: board.participants, players: board.players, rows: [], me: board.me, unchanged: true } };
    return { ok: true, data: board };
  }

  async ghosts(session: number, refs: string[]): Promise<ApiResult<{ ghosts: SalonGhost[] }>> {
    const d = this.data(session);
    const list = this.entries(session, d);
    const ghosts: SalonGhost[] = [];
    list.forEach((e, i) => {
      if (refs.includes(e.ref)) ghosts.push({ ref: e.ref, name: e.name, rank: i + 1, ms: e.ms, splits: e.splits, replay: e.replay, simVersion: SIM_VERSION });
    });
    return { ok: true, data: { ghosts } };
  }

  async submit(session: number, playerId: string, name: string, replay: string): Promise<ApiResult<SalonSubmitResult>> {
    const now = this.o.clock.now();
    if (now > salonSessionEnd(session, this.o.sessionMs) + SUBMIT_GRACE_MS) return fail(409, "session_closed", "Trop tard : cette session est terminée");
    if (now < salonSessionStart(session, this.o.sessionMs)) return fail(409, "session_future", "Cette session n'a pas commencé");
    const circuit = await this.o.circuit(session);
    if (!circuit) return fail(503, "no_circuit", "Circuit de la session indisponible");
    let verdict;
    try {
      const decoded = decodeReplay(replay);
      verdict = replayRace(circuit.track, decoded); // le temps annoncé ne compte pas : seul ce rejeu fait foi
    } catch (e) {
      return fail(400, "bad_replay", e instanceof Error ? e.message : "Rediffusion illisible");
    }
    if (!verdict.finished) return fail(422, "unfinished", "La rediffusion ne finit pas le circuit");
    const d = this.data(session);
    const ref = myRef(session, playerId);
    const known = d.mine.get(ref);
    const improved = !known || verdict.finishMs < known.ms;
    if (improved) d.mine.set(ref, { ref, name, ms: verdict.finishMs, splits: verdict.splits, replay, at: now - salonSessionStart(session, this.o.sessionMs) });
    else if (known.name !== name) known.name = name;
    const board = this.build(session, d, ref);
    const me = board.me!;
    return { ok: true, data: { accepted: true, improved, ms: verdict.finishMs, bestMs: me.ms, rank: me.rank, participants: board.participants, board } };
  }
}
