import {
  ReplayError,
  SIM_VERSION,
  decodeReplay,
  parseTrack,
  replayRace,
  salonCircuit,
  salonSessionAt,
  salonSessionEnd,
  salonSessionStart,
  salonTrackId,
  type Track,
} from "@cdj/sim";
import type { SqlDb } from "./db";
import { HttpError } from "./errors";
import { cleanName } from "./validate";

// Le Salon côté serveur (lot 27) : il sert le contrat `SalonApi` du jeu (`apps/web/src/salonApi.ts`).
//
//   GET  /api/salon/now?player=<id>                        heure du serveur, session en cours, présents
//   GET  /api/salon/<session>/board?player=<id>&since=<v>  classement de la session (`unchanged` si la version est la même)
//   GET  /api/salon/<session>/ghosts?refs=a,b              rediffusions demandées par référence publique
//   POST /api/salon/<session>/submit { playerId, name, replay }
//   GET  /api/salon/podiums?limit=N                        (en plus du contrat) les podiums gardés des dernières sessions
//
// Comme pour le classement du jour : **le serveur ne fait jamais confiance à un temps annoncé**. Il rejoue la rediffusion sur
// `salonCircuit(session)` (même code de simulation que le jeu) et n'enregistre que son propre résultat. Un joueur n'est jamais
// désigné par son identifiant secret mais par une référence publique propre à la session.

/** Un envoi est accepté jusqu'à 60 s après la fin de la session (une course commencée avant la fin peut se terminer). */
export const SALON_GRACE_MS = 60_000;
/** Présent = a interrogé le Salon dans les 30 dernières secondes. */
export const PRESENCE_MS = 30_000;
/** Les courses (et leurs rediffusions) sont gardées 48 h ; les podiums, 30 jours. */
export const SALON_RETENTION_MS = 48 * 3_600_000;
export const PODIUM_KEEP_MS = 30 * 86_400_000;
/** Le circuit de la session suivante est préparé dans les deux dernières minutes de la session en cours. */
export const PREPARE_AHEAD_MS = 120_000;
/** Lignes du classement servies (les premiers), plus le voisin de devant et celui de derrière du joueur. */
export const BOARD_ROWS = 15;
/** Références demandées au plus dans une requête de fantômes (le jeu en demande six au plus). */
export const MAX_GHOST_REFS = 8;
/** Entretien (purge, podiums) au plus une fois par minute. */
const MAINTENANCE_EVERY_MS = 60_000;

export const MIN_SALON_MINUTES = 0.5;
export const MAX_SALON_MINUTES = 60;

/** Durée d'une session en ms pour `SALON_MINUTES` (tests et essais locaux seulement) ; `undefined` : dix minutes. */
export function salonSessionMs(minutes: number | undefined): number | undefined {
  if (minutes === undefined) return undefined;
  if (!Number.isFinite(minutes) || minutes < MIN_SALON_MINUTES || minutes > MAX_SALON_MINUTES) {
    throw new Error(`SALON_MINUTES doit valoir entre ${MIN_SALON_MINUTES} et ${MAX_SALON_MINUTES} (reçu : ${minutes})`);
  }
  return Math.round(minutes * 60_000);
}

export interface SalonLimits {
  /** Lectures (now, board, ghosts) par adresse et par fenêtre de débit. Un jeu ouvert en lit ≈ 130 par 10 minutes. */
  readsPerClient: number;
  /** Envois par adresse et par fenêtre de débit, comptés avant tout rejeu. */
  submitsPerClient: number;
  /** Délai minimal entre deux envois du même joueur. */
  submitGapMs: number;
}

export const DEFAULT_SALON_LIMITS: SalonLimits = { readsPerClient: 600, submitsPerClient: 60, submitGapMs: 5000 };

export interface SalonKit {
  db: SqlDb;
  now: () => number;
  /** Durée d'une session (ms). */
  sessionMs: number;
  /** Empreinte salée (`prefix:16 hexadécimaux`) : on ne stocke jamais d'identifiant ni d'adresse en clair. */
  hashKey: (prefix: string, value: string) => Promise<string>;
  /** Compte un appel dans la fenêtre de débit de la clé ; lève 429 au-delà de `limit`. */
  hit: (key: string, limit: number) => Promise<void>;
  readJson: (req: Request) => Promise<Record<string, unknown>>;
  playerIdOf: (value: unknown) => string;
  limits: SalonLimits;
  /** Marque `demo` les joueurs créés (jamais réglé par le serveur de production). */
  demoPlayers: boolean;
}

export interface SalonRequestInfo {
  clientKey?: string;
}

export interface SalonTrack {
  trackId: string;
  track: Track;
}

export interface SalonRow {
  rank: number;
  ref: string;
  name: string;
  ms: number;
  gap: number;
  mine?: boolean;
}

export interface SalonBoard {
  session: number;
  version: number;
  participants: number;
  players: number;
  rows: SalonRow[];
  me: SalonRow | null;
  unchanged?: boolean;
}

const REF = /^[0-9a-f]{16}$/;
const ORDER = "ms ASC, submitted_at ASC, ref ASC";

export function createSalon(kit: SalonKit) {
  const { db, now, sessionMs, limits } = kit;
  const circuits = new Map<number, SalonTrack>();
  const generating = new Map<number, Promise<SalonTrack>>();
  let lastMaintenance = 0;
  /** Sessions gardées en mémoire et en base : 48 h de courses, plus la session en cours et la suivante. */
  const keepSessions = Math.ceil(SALON_RETENTION_MS / sessionMs) + 1;

  const current = () => salonSessionAt(now(), sessionMs);

  /** Numéro de session d'une adresse : un entier raisonnable, entre la plus ancienne gardée et la prochaine. */
  function sessionOf(raw: string): number {
    const n = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n)) throw new HttpError(400, "invalid_session", "Numéro de session invalide");
    const here = current();
    if (n > here + 1 || n < here - keepSessions) throw new HttpError(404, "unknown_session", "Cette session n'existe pas (ou plus)");
    return n;
  }

  // --- Circuits (le générateur est coûteux : un par session, préparé à l'avance, puis figé) --------------------------
  function circuitFor(session: number): Promise<SalonTrack> {
    const id = salonTrackId(session);
    const memo = circuits.get(session);
    if (memo && memo.trackId === id) return Promise.resolve(memo);
    let pending = generating.get(session);
    if (pending) return pending;
    pending = (async () => {
      const row = await db.first<{ track_id: string; spec: string }>("SELECT track_id, spec FROM salon_circuits WHERE session = ?", [session]);
      let found: SalonTrack;
      if (row && row.track_id === id) {
        found = { trackId: id, track: parseTrack(id, row.spec) };
      } else {
        // Absent (ou d'une autre version du générateur : jamais rejouer sur un circuit périmé) : on le génère et on le garde.
        const generated = salonCircuit(session);
        if (generated.fallback) throw new HttpError(503, "circuit_unavailable", "Circuit du Salon indisponible, réessaie plus tard");
        await db.run("INSERT OR REPLACE INTO salon_circuits (session, track_id, spec, created_at) VALUES (?, ?, ?, ?)", [session, generated.id, generated.spec, now()]);
        found = { trackId: generated.id, track: generated.track };
      }
      circuits.set(session, found);
      while (circuits.size > 4) circuits.delete(Math.min(...circuits.keys()));
      return found;
    })().finally(() => generating.delete(session));
    generating.set(session, pending);
    return pending;
  }

  // --- Présence et débit ---------------------------------------------------------------------------------------------
  async function touch(playerId: string): Promise<void> {
    const key = await kit.hashKey("pr", playerId);
    await db.run("INSERT INTO salon_presence (key, seen_at) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET seen_at = excluded.seen_at", [key, now()]);
  }

  async function present(): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_presence WHERE seen_at >= ?", [now() - PRESENCE_MS]))?.n ?? 0;
  }

  async function limitReads(info: SalonRequestInfo): Promise<void> {
    if (info.clientKey) await kit.hit(await kit.hashKey("srd", info.clientKey), limits.readsPerClient);
  }

  /** Au plus un envoi toutes les `submitGapMs` par joueur : un seul UPDATE atomique (pas de lecture puis écriture). */
  async function throttleSubmit(playerId: string): Promise<void> {
    const key = await kit.hashKey("sgp", playerId);
    const t = now();
    const ok = await db.first<{ at: number }>(
      "INSERT INTO salon_throttle (key, at) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET at = excluded.at WHERE salon_throttle.at <= excluded.at - ? RETURNING at",
      [key, t, limits.submitGapMs],
    );
    if (!ok) {
      const last = (await db.first<{ at: number }>("SELECT at FROM salon_throttle WHERE key = ?", [key]))?.at ?? t;
      const retry = Math.max(1, Math.ceil((last + limits.submitGapMs - t) / 1000));
      throw new HttpError(429, "too_fast", "Un envoi toutes les 5 secondes au plus", { "Retry-After": String(retry) });
    }
  }

  // --- Classement ----------------------------------------------------------------------------------------------------
  const refOf = async (session: number, playerId: string) => (await kit.hashKey("ref", `${session}|${playerId}`)).slice(4);

  async function versionOf(session: number): Promise<number> {
    return (await db.first<{ version: number }>("SELECT version FROM salon_sessions WHERE session = ?", [session]))?.version ?? 0;
  }

  const bump = (session: number) =>
    db.run("INSERT INTO salon_sessions (session, version) VALUES (?, 1) ON CONFLICT (session) DO UPDATE SET version = version + 1", [session]);

  async function participants(session: number): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs WHERE session = ?", [session]))?.n ?? 0;
  }

  /** Place d'un temps : devant lui, ceux qui sont plus rapides, ou aussi rapides mais arrivés avant (puis, à égalité, par référence). */
  async function rankOf(session: number, ms: number, at: number, ref: string): Promise<number> {
    const row = await db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM salon_runs WHERE session = ? AND (ms < ? OR (ms = ? AND (submitted_at < ? OR (submitted_at = ? AND ref < ?))))",
      [session, ms, ms, at, at, ref],
    );
    return (row?.n ?? 0) + 1;
  }

  async function myRow(session: number, playerId: string, firstMs?: number): Promise<SalonRow | null> {
    const own = await db.first<{ ref: string; name: string; ms: number; submitted_at: number }>(
      "SELECT ref, name, ms, submitted_at FROM salon_runs WHERE session = ? AND player_id = ?",
      [session, playerId],
    );
    if (!own) return null;
    const first = firstMs ?? (await db.first<{ ms: number }>(`SELECT ms FROM salon_runs WHERE session = ? ORDER BY ${ORDER} LIMIT 1`, [session]))?.ms ?? own.ms;
    return { rank: await rankOf(session, own.ms, own.submitted_at, own.ref), ref: own.ref, name: own.name, ms: own.ms, gap: own.ms - first, mine: true };
  }

  /** Le classement de la session : les premiers, plus le voisin de devant et celui de derrière du joueur (le jeu en tire ses fantômes). */
  async function board(session: number, playerId: string | null, since?: number): Promise<SalonBoard> {
    const version = await versionOf(session);
    const players = await present();
    const count = await participants(session);
    if (since !== undefined && since === version) {
      const me = playerId ? await myRow(session, playerId) : null;
      return { session, version, participants: count, players, rows: [], me, unchanged: true };
    }
    const top = await db.all<{ ref: string; name: string; ms: number }>(`SELECT ref, name, ms FROM salon_runs WHERE session = ? ORDER BY ${ORDER} LIMIT ?`, [session, BOARD_ROWS]);
    const firstMs = top[0]?.ms ?? 0;
    const me = playerId ? await myRow(session, playerId, firstMs) : null;
    const rows: SalonRow[] = top.map((r, i) => ({ rank: i + 1, ref: r.ref, name: r.name, ms: r.ms, gap: r.ms - firstMs, ...(me && r.ref === me.ref ? { mine: true } : {}) }));
    if (me && me.rank > BOARD_ROWS) {
      for (const rank of [me.rank - 1, me.rank + 1]) {
        if (rank <= BOARD_ROWS || rank > count) continue;
        const r = await db.first<{ ref: string; name: string; ms: number }>(`SELECT ref, name, ms FROM salon_runs WHERE session = ? ORDER BY ${ORDER} LIMIT 1 OFFSET ?`, [session, rank - 1]);
        if (r) rows.push({ rank, ref: r.ref, name: r.name, ms: r.ms, gap: r.ms - firstMs });
      }
      rows.push(me);
      rows.sort((a, b) => a.rank - b.rank);
    }
    return { session, version, participants: count, players, rows, me };
  }

  // --- Routes ----------------------------------------------------------------------------------------------------------
  async function nowRoute(url: URL, info: SalonRequestInfo): Promise<unknown> {
    const playerParam = url.searchParams.get("player");
    const me = playerParam === null ? null : kit.playerIdOf(playerParam);
    await limitReads(info);
    if (me) await touch(me);
    const serverMs = now();
    const session = salonSessionAt(serverMs, sessionMs);
    return {
      serverMs,
      session,
      startMs: salonSessionStart(session, sessionMs),
      endMs: salonSessionEnd(session, sessionMs),
      trackId: salonTrackId(session),
      players: await present(),
    };
  }

  async function boardRoute(sessionRaw: string, url: URL, info: SalonRequestInfo): Promise<unknown> {
    const session = sessionOf(sessionRaw);
    const playerParam = url.searchParams.get("player");
    const me = playerParam === null ? null : kit.playerIdOf(playerParam);
    const sinceParam = url.searchParams.get("since");
    let since: number | undefined;
    if (sinceParam !== null) {
      since = /^\d{1,12}$/.test(sinceParam) ? Number(sinceParam) : NaN;
      if (!Number.isInteger(since)) throw new HttpError(400, "invalid_since", "since doit être un entier");
    }
    await limitReads(info);
    if (me) await touch(me);
    return board(session, me, since);
  }

  async function ghostsRoute(sessionRaw: string, url: URL, info: SalonRequestInfo): Promise<unknown> {
    const session = sessionOf(sessionRaw);
    const refs = [...new Set((url.searchParams.get("refs") ?? "").split(",").filter((r) => r !== ""))];
    if (refs.length > MAX_GHOST_REFS) throw new HttpError(400, "too_many_refs", `Au plus ${MAX_GHOST_REFS} fantômes à la fois`);
    if (refs.some((r) => !REF.test(r))) throw new HttpError(400, "invalid_ref", "Référence de joueur invalide");
    await limitReads(info);
    const ghosts = [];
    for (const ref of refs) {
      const row = await db.first<{ name: string; ms: number; splits: string; replay: string; submitted_at: number }>(
        "SELECT name, ms, splits, replay, submitted_at FROM salon_runs WHERE session = ? AND ref = ?",
        [session, ref],
      );
      if (!row) continue; // inconnue (purgée, ou d'une autre session) : le jeu s'en passe
      ghosts.push({
        ref,
        name: row.name,
        rank: await rankOf(session, row.ms, row.submitted_at, ref),
        ms: row.ms,
        splits: JSON.parse(row.splits) as number[],
        replay: row.replay,
        simVersion: SIM_VERSION,
      });
    }
    return { ghosts };
  }

  async function submitRoute(sessionRaw: string, req: Request, info: SalonRequestInfo): Promise<unknown> {
    const body = await kit.readJson(req);
    const playerId = kit.playerIdOf(body.playerId);
    if (typeof body.replay !== "string" || body.replay.length === 0) throw new HttpError(400, "invalid_replay", "Rediffusion manquante");
    const suppliedName = body.name === undefined ? null : cleanName(body.name);
    if (body.name !== undefined && suppliedName === null) throw new HttpError(400, "invalid_name", "Pseudo invalide (1 à 20 caractères : lettres, chiffres, espace . _ ' -)");

    // Vérifications sans état d'abord (une session qui n'est pas ouverte ne coûte rien à refuser).
    const t = now();
    if (!/^\d{1,9}$/.test(sessionRaw)) throw new HttpError(400, "invalid_session", "Numéro de session invalide");
    const session = Number(sessionRaw);
    if (t < salonSessionStart(session, sessionMs)) throw new HttpError(409, "session_future", "Cette session n'a pas commencé");
    if (t > salonSessionEnd(session, sessionMs) + SALON_GRACE_MS) throw new HttpError(409, "session_closed", "Trop tard : cette session est terminée");

    // Débit : par adresse (avant tout rejeu), puis par joueur.
    if (info.clientKey) await kit.hit(await kit.hashKey("ssb", info.clientKey), limits.submitsPerClient);
    const known = await db.first<{ name: string }>("SELECT name FROM players WHERE id = ?", [playerId]);
    if (!suppliedName && !known) throw new HttpError(400, "name_required", "Choisis un pseudo pour entrer au classement");
    const name = suppliedName ?? known!.name;
    await throttleSubmit(playerId); // un oubli de pseudo ne coûte pas le délai : il se corrige tout de suite

    let replay;
    try {
      replay = decodeReplay(body.replay);
    } catch (e) {
      throw new HttpError(400, "invalid_replay", e instanceof ReplayError ? e.message : "Rediffusion illisible");
    }
    if (replay.simVersion !== SIM_VERSION) {
      const why = replay.simVersion < SIM_VERSION ? "une ancienne version du jeu" : "une version du jeu plus récente que le serveur";
      throw new HttpError(409, "sim_version", `Course enregistrée avec ${why} (simulation v${replay.simVersion}, serveur v${SIM_VERSION}) : recharge la page et refais un temps`);
    }
    if (replay.trackId !== salonTrackId(session)) throw new HttpError(409, "track_mismatch", "Cette rediffusion n'est pas celle du circuit de cette session");

    const circuit = await circuitFor(session);
    const result = replayRace(circuit.track, replay); // la seule source du temps
    if (!result.finished) throw new HttpError(422, "not_finished", "Cette rediffusion ne franchit pas la ligne d'arrivée");

    const at = now();
    // Le joueur n'existe qu'après une course valide ; son pseudo est celui du classement du jour (même identité).
    await db.run(
      "INSERT INTO players (id, name, created_at, updated_at, demo) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at",
      [playerId, name, at, at, kit.demoPlayers ? 1 : 0],
    );
    const ref = await refOf(session, playerId);
    const previous = await db.first<{ ms: number; name: string }>("SELECT ms, name FROM salon_runs WHERE session = ? AND player_id = ?", [session, playerId]);
    const improved = !previous || result.finishMs < previous.ms;
    if (improved) {
      await db.run(
        `INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session, player_id) DO UPDATE SET name = excluded.name, ms = excluded.ms, splits = excluded.splits,
           replay = excluded.replay, submitted_at = excluded.submitted_at WHERE excluded.ms < salon_runs.ms`,
        [session, playerId, ref, name, result.finishMs, JSON.stringify(result.splits), body.replay, at],
      );
      await bump(session);
    } else if (previous.name !== name) {
      await db.run("UPDATE salon_runs SET name = ? WHERE session = ? AND player_id = ?", [name, session, playerId]);
      await bump(session);
    }
    await touch(playerId);
    const fresh = await board(session, playerId);
    const me = fresh.me!;
    return { accepted: true, improved, ms: result.finishMs, bestMs: me.ms, rank: me.rank, participants: fresh.participants, board: fresh };
  }

  async function podiumsRoute(url: URL, info: SalonRequestInfo): Promise<unknown> {
    const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 10)) || 10));
    await limitReads(info);
    await finalizePodiums();
    const rows = await db.all<{ session: number; rank: number; name: string; ms: number; participants: number }>(
      "SELECT session, rank, name, ms, participants FROM salon_podiums WHERE session IN (SELECT session FROM salon_podiums GROUP BY session ORDER BY session DESC LIMIT ?) ORDER BY session DESC, rank ASC",
      [limit],
    );
    const bySession = new Map<number, { session: number; startMs: number; participants: number; top: { rank: number; name: string; ms: number }[] }>();
    for (const r of rows) {
      let p = bySession.get(r.session);
      if (!p) bySession.set(r.session, (p = { session: r.session, startMs: salonSessionStart(r.session, sessionMs), participants: r.participants, top: [] }));
      p.top.push({ rank: r.rank, name: r.name, ms: r.ms });
    }
    return { podiums: [...bySession.values()] };
  }

  // --- Entretien : podiums, purge, circuit de la session suivante -------------------------------------------------------
  /** Fige le podium (trois premiers) de chaque session terminée (envois clos) qui n'en a pas encore : à faire avant toute purge. */
  async function finalizePodiums(): Promise<void> {
    const closed = salonSessionAt(now() - SALON_GRACE_MS, sessionMs) - 1; // dernière session dont l'envoi est clos
    const todo = await db.all<{ session: number }>(
      "SELECT DISTINCT session FROM salon_runs WHERE session <= ? AND session NOT IN (SELECT session FROM salon_podiums) ORDER BY session LIMIT 200",
      [closed],
    );
    for (const { session } of todo) {
      const count = await participants(session);
      const top = await db.all<{ name: string; ms: number }>(`SELECT name, ms FROM salon_runs WHERE session = ? ORDER BY ${ORDER} LIMIT 3`, [session]);
      let rank = 1;
      for (const r of top) {
        await db.run("INSERT OR IGNORE INTO salon_podiums (session, rank, name, ms, participants, created_at) VALUES (?, ?, ?, ?, ?, ?)", [session, rank++, r.name, r.ms, count, now()]);
      }
    }
  }

  /** Purge : courses de plus de 48 h (après avoir figé leurs podiums), podiums de plus de 30 jours, restes de présence et de débit. */
  async function maintain(force = false): Promise<void> {
    const t = now();
    if (!force && t - lastMaintenance < MAINTENANCE_EVERY_MS) return;
    lastMaintenance = t;
    await finalizePodiums();
    const cutoff = t - SALON_RETENTION_MS;
    await db.run("DELETE FROM salon_runs WHERE submitted_at < ?", [cutoff]);
    const oldest = salonSessionAt(cutoff, sessionMs);
    await db.run("DELETE FROM salon_sessions WHERE session < ?", [oldest]);
    await db.run("DELETE FROM salon_circuits WHERE session < ?", [oldest]);
    await db.run("DELETE FROM salon_podiums WHERE created_at < ?", [t - PODIUM_KEEP_MS]);
    await db.run("DELETE FROM salon_presence WHERE seen_at < ?", [t - 10 * PRESENCE_MS]);
    await db.run("DELETE FROM salon_throttle WHERE at < ?", [t - 3_600_000]);
  }

  /**
   * Tâche périodique (le serveur Node l'appelle toutes les quelques secondes) : garde le circuit de la session en cours et, dans
   * les deux dernières minutes, prépare celui de la suivante, pour qu'aucun pic de calcul ne tombe au changement de session.
   * Les erreurs sont journalisées, jamais propagées (la tâche se réessaie au prochain passage).
   */
  async function tick(): Promise<void> {
    try {
      const t = now();
      const session = salonSessionAt(t, sessionMs);
      await circuitFor(session);
      if (t >= salonSessionEnd(session, sessionMs) - PREPARE_AHEAD_MS) await circuitFor(session + 1);
      await maintain();
    } catch (e) {
      console.error("Salon : entretien impossible :", e);
    }
  }

  return {
    sessionMs,
    nowRoute,
    boardRoute,
    ghostsRoute,
    submitRoute,
    podiumsRoute,
    tick,
    maintain,
    circuitFor,
  };
}

export type Salon = ReturnType<typeof createSalon>;
