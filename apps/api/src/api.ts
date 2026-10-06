import {
  GENERATOR_VERSION,
  LAUNCH_DAY,
  ReplayError,
  SIM_VERSION,
  circuitNumber,
  dailyCircuit,
  decodeReplay,
  formatDay,
  medalFor,
  medalsFor,
  parseDay,
  parseTrack,
  replayRace,
  type Medal,
  type PaletteName,
  type Track,
} from "@cdj/sim";
import { SCHEMA, type SqlDb } from "./db";
import { PLAYER_ID, cleanName } from "./validate";

// API du classement. Elle ne fait confiance à aucun temps annoncé : elle reçoit la rediffusion (la suite des
// commandes du joueur), la rejoue avec le même code de simulation que le jeu, et n'enregistre que le temps
// qu'elle a elle-même recalculé.
//
// Elle ne dépend que de l'API Web standard (Request/Response) et de `SqlDb` : elle tourne telle quelle sur
// Cloudflare Workers (+ D1) et sur Node (+ SQLite).

const DAY_MS = 86_400_000;
/** Taille maximale du corps d'une requête (une rediffusion complète fait ~6 ko ; le pire cas décodable ~300 ko). */
export const MAX_BODY_BYTES = 400_000;
/** Un joueur qui passe la ligne juste après minuit UTC peut encore classer sa course du jour précédent. */
export const GRACE_MS = 10 * 60_000;

export interface ApiOptions {
  db: SqlDb;
  now?: () => number;
  /** Valeur de `Access-Control-Allow-Origin` (« * » par défaut : aucune session, l'identité est dans le corps). */
  allowOrigin?: string;
  /** Sel pour hacher les adresses IP avant de les compter (on ne stocke jamais d'IP en clair). */
  rateSalt?: string;
  limits?: { windowMs: number; perClient: number; perPlayer: number };
}

export interface RequestInfo {
  /** Identifie l'appelant pour la limitation de débit (adresse IP) ; fournie par l'hébergeur. */
  clientKey?: string;
}

interface Circuit {
  day: number;
  trackId: string;
  spec: string;
  authorMs: number;
  attempt: number;
  palette: PaletteName;
  track: Track;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

const DEFAULT_LIMITS = { windowMs: 10 * 60_000, perClient: 60, perPlayer: 30 };

export function createApi(options: ApiOptions) {
  const { db } = options;
  const now = options.now ?? Date.now;
  const allowOrigin = options.allowOrigin ?? "*";
  const limits = options.limits ?? DEFAULT_LIMITS;
  const circuits = new Map<number, Circuit>();
  let schemaReady: Promise<void> | null = null;

  const ensureSchema = () => (schemaReady ??= (async () => {
    for (const sql of SCHEMA) await db.run(sql);
  })());

  const today = () => Math.floor(now() / DAY_MS);

  // --- Circuit du jour (cache : le générateur est coûteux, le résultat est figé) ----------------------------
  async function getCircuit(day: number): Promise<Circuit> {
    const memo = circuits.get(day);
    if (memo) return memo;
    const row = await db.first<{ track_id: string; spec: string; author_ms: number; attempt: number; palette: string }>(
      "SELECT track_id, spec, author_ms, attempt, palette FROM circuits WHERE day = ?",
      [day],
    );
    let circuit: Circuit;
    if (row) {
      circuit = {
        day,
        trackId: row.track_id,
        spec: row.spec,
        authorMs: row.author_ms,
        attempt: row.attempt,
        palette: row.palette as PaletteName,
        track: parseTrack(row.track_id, row.spec),
      };
    } else {
      const c = dailyCircuit(day);
      if (c.fallback) throw new HttpError(503, "circuit_unavailable", "Circuit indisponible, réessaie plus tard");
      circuit = { day, trackId: c.track.id, spec: c.spec, authorMs: c.authorMs, attempt: c.attempt, palette: c.palette, track: c.track };
      await db.run(
        "INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [day, circuit.trackId, circuit.spec, circuit.authorMs, circuit.attempt, circuit.palette, now()],
      );
    }
    circuits.set(day, circuit);
    return circuit;
  }

  // --- Limitation de débit ----------------------------------------------------------------------------------
  async function hashKey(prefix: string, value: string): Promise<string> {
    const data = new TextEncoder().encode(`${options.rateSalt ?? ""}|${value}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${prefix}:${hex}`;
  }

  async function hit(key: string, limit: number): Promise<void> {
    const bucket = Math.floor(now() / limits.windowMs);
    const row = await db.first<{ count: number }>(
      "INSERT INTO rate (key, bucket, count) VALUES (?, ?, 1) ON CONFLICT (key, bucket) DO UPDATE SET count = count + 1 RETURNING count",
      [key, bucket],
    );
    const count = row?.count ?? 1;
    if (count === 1) await db.run("DELETE FROM rate WHERE bucket < ?", [bucket - 3]); // ménage au passage
    if (count > limit) {
      const retry = Math.max(1, Math.ceil(((bucket + 1) * limits.windowMs - now()) / 1000));
      throw new HttpError(429, "rate_limited", "Trop de requêtes, réessaie dans un moment", { "Retry-After": String(retry) });
    }
  }

  // --- Entrées ----------------------------------------------------------------------------------------------
  async function readJson(req: Request): Promise<Record<string, unknown>> {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) throw new HttpError(413, "too_large", "Requête trop volumineuse");
    let text = "";
    if (req.body) {
      const reader = req.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new HttpError(413, "too_large", "Requête trop volumineuse");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    }
    try {
      const body: unknown = JSON.parse(text);
      if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
    } catch {
      /* tombe sur l'erreur ci-dessous */
    }
    throw new HttpError(400, "invalid_json", "Corps JSON attendu (un objet)");
  }

  function playerIdOf(value: unknown): string {
    if (typeof value !== "string" || !PLAYER_ID.test(value)) throw new HttpError(400, "invalid_player", "Identifiant de joueur invalide");
    return value;
  }

  function dayOf(date: unknown, mustBeOpen = false): number {
    const day = typeof date === "string" ? parseDay(date) : null;
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day < LAUNCH_DAY || day > today()) throw new HttpError(404, "unknown_day", "Ce jour n'a pas (encore) de circuit");
    if (mustBeOpen) {
      const sinceMidnight = now() - today() * DAY_MS;
      const open = day === today() || (day === today() - 1 && sinceMidnight < GRACE_MS);
      if (!open) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé");
    }
    return day;
  }

  async function playerName(id: string): Promise<string | null> {
    const row = await db.first<{ name: string }>("SELECT name FROM players WHERE id = ?", [id]);
    return row?.name ?? null;
  }

  async function rankOf(day: number, ms: number, submittedAt: number): Promise<number> {
    const row = await db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM results WHERE day = ? AND (ms < ? OR (ms = ? AND submitted_at < ?))",
      [day, ms, ms, submittedAt],
    );
    return (row?.n ?? 0) + 1;
  }

  async function participants(day: number): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE day = ?", [day]))?.n ?? 0;
  }

  // --- Routes -----------------------------------------------------------------------------------------------
  async function submit(req: Request, info: RequestInfo): Promise<unknown> {
    const body = await readJson(req);
    const playerId = playerIdOf(body.playerId);
    const day = dayOf(body.date, true);
    if (typeof body.replay !== "string" || body.replay.length === 0) throw new HttpError(400, "invalid_replay", "Rediffusion manquante");
    const suppliedName = body.name === undefined ? null : cleanName(body.name);
    if (body.name !== undefined && suppliedName === null) throw new HttpError(400, "invalid_name", "Pseudo invalide (1 à 20 caractères : lettres, chiffres, espace . _ ' -)");
    if (info.clientKey) await hit(await hashKey("ip", info.clientKey), limits.perClient);
    await hit(await hashKey("p", playerId), limits.perPlayer);

    const knownName = await playerName(playerId);
    if (!suppliedName && !knownName) throw new HttpError(400, "name_required", "Choisis un pseudo pour entrer au classement");

    // Vérifications bon marché d'abord, rejeu (coûteux) ensuite.
    let replay;
    try {
      replay = decodeReplay(body.replay);
    } catch (e) {
      throw new HttpError(400, "invalid_replay", e instanceof ReplayError ? e.message : "Rediffusion illisible");
    }
    if (replay.simVersion !== SIM_VERSION) throw new HttpError(409, "sim_version", "Version de la simulation différente : recharge le jeu");
    const circuit = await getCircuit(day);
    if (replay.trackId !== circuit.trackId) throw new HttpError(409, "track_mismatch", "Cette rediffusion n'est pas celle du circuit de ce jour");

    const result = replayRace(circuit.track, replay); // la seule source du temps
    if (!result.finished) throw new HttpError(422, "not_finished", "Cette rediffusion ne franchit pas la ligne d'arrivée");

    const t = now();
    if (suppliedName) {
      await db.run(
        "INSERT INTO players (id, name, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at",
        [playerId, suppliedName, t, t],
      );
    }
    const previous = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, playerId]);
    const improved = !previous || result.finishMs < previous.ms;
    if (improved) {
      await db.run(
        `INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (day, player_id) DO UPDATE SET ms = excluded.ms, splits = excluded.splits, replay = excluded.replay,
           respawns = excluded.respawns, submitted_at = excluded.submitted_at WHERE excluded.ms < results.ms`,
        [day, playerId, result.finishMs, JSON.stringify(result.splits), body.replay, result.respawns, t],
      );
    }
    const bestMs = improved ? result.finishMs : previous!.ms;
    const bestAt = improved ? t : previous!.submitted_at;
    const medals = medalsFor(circuit.authorMs);
    return {
      accepted: true,
      improved,
      ms: result.finishMs,
      splits: result.splits,
      respawns: result.respawns,
      bestMs,
      rank: await rankOf(day, bestMs, bestAt),
      participants: await participants(day),
      medal: medalFor(result.finishMs, medals) as Medal | null,
    };
  }

  async function renamePlayer(req: Request, info: RequestInfo): Promise<unknown> {
    const body = await readJson(req);
    const playerId = playerIdOf(body.playerId);
    const name = cleanName(body.name);
    if (!name) throw new HttpError(400, "invalid_name", "Pseudo invalide (1 à 20 caractères : lettres, chiffres, espace . _ ' -)");
    if (info.clientKey) await hit(await hashKey("ip", info.clientKey), limits.perClient);
    await hit(await hashKey("p", playerId), limits.perPlayer);
    // On ne crée jamais de joueur ici : un joueur n'existe qu'après avoir envoyé une course valide (sinon, n'importe
    // qui pourrait remplir la base de pseudos sans jouer).
    const row = await db.first<{ id: string }>("UPDATE players SET name = ?, updated_at = ? WHERE id = ? RETURNING id", [name, now(), playerId]);
    if (!row) throw new HttpError(404, "unknown_player", "Ce joueur n'a pas encore de temps enregistré");
    return { name };
  }

  async function dayInfo(date: string): Promise<unknown> {
    const day = dayOf(date);
    const c = await getCircuit(day);
    return { date: formatDay(day), number: circuitNumber(day), trackId: c.trackId, authorMs: c.authorMs, attempt: c.attempt, palette: c.palette, simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION };
  }

  async function leaderboard(date: string, url: URL): Promise<unknown> {
    const day = dayOf(date);
    const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 10)) || 10));
    const playerParam = url.searchParams.get("player");
    const me = playerParam === null ? null : playerIdOf(playerParam);
    const count = await participants(day);
    if (count === 0) return { date: formatDay(day), participants: 0, top: [], me: null };

    const medals = medalsFor((await getCircuit(day)).authorMs);
    const rows = await db.all<{ ms: number; name: string }>(
      "SELECT r.ms AS ms, p.name AS name FROM results r JOIN players p ON p.id = r.player_id WHERE r.day = ? ORDER BY r.ms ASC, r.submitted_at ASC LIMIT ?",
      [day, limit],
    );
    const top = rows.map((r, i) => ({ rank: i + 1, name: r.name, ms: r.ms, medal: medalFor(r.ms, medals) }));
    let mine: { rank: number; name: string; ms: number; medal: Medal | null } | null = null;
    if (me) {
      const own = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, me]);
      if (own) mine = { rank: await rankOf(day, own.ms, own.submitted_at), name: (await playerName(me)) ?? "", ms: own.ms, medal: medalFor(own.ms, medals) };
    }
    return { date: formatDay(day), participants: count, top, me: mine };
  }

  async function ghost(date: string, url: URL): Promise<unknown> {
    const day = dayOf(date);
    const kind = url.searchParams.get("kind");
    if (kind !== "first" && kind !== "ahead") throw new HttpError(400, "invalid_kind", "kind doit valoir first ou ahead");
    let offset = 0;
    if (kind === "ahead") {
      const me = playerIdOf(url.searchParams.get("player"));
      const own = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, me]);
      if (!own) throw new HttpError(404, "no_ghost", "Pas encore de temps pour ce joueur");
      const rank = await rankOf(day, own.ms, own.submitted_at);
      if (rank <= 1) throw new HttpError(404, "no_ghost", "Personne devant toi : tu es premier");
      offset = rank - 2;
    }
    const row = await db.first<{ ms: number; splits: string; replay: string; name: string }>(
      "SELECT r.ms AS ms, r.splits AS splits, r.replay AS replay, p.name AS name FROM results r JOIN players p ON p.id = r.player_id WHERE r.day = ? ORDER BY r.ms ASC, r.submitted_at ASC LIMIT 1 OFFSET ?",
      [day, offset],
    );
    if (!row) throw new HttpError(404, "no_ghost", "Aucun temps enregistré pour ce jour");
    return { name: row.name, rank: offset + 1, ms: row.ms, splits: JSON.parse(row.splits) as number[], replay: row.replay, simVersion: SIM_VERSION };
  }

  // --- Entrée -----------------------------------------------------------------------------------------------
  const cors = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
    });

  async function handle(req: Request, info: RequestInfo = {}): Promise<Response> {
    try {
      if (req.method === "OPTIONS") return reply(204, null);
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "");
      await ensureSchema();

      if (path === "/api/health" && req.method === "GET") {
        return reply(200, { ok: true, simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, today: formatDay(today()) });
      }
      if (path === "/api/submit") {
        if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
        return reply(200, await submit(req, info));
      }
      if (path === "/api/player") {
        if (req.method !== "PUT") throw new HttpError(405, "method_not_allowed", "PUT attendu");
        return reply(200, await renamePlayer(req, info));
      }
      const m = /^\/api\/day\/([^/]+)(?:\/(leaderboard|ghost))?$/.exec(path);
      if (m) {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        const date = decodeURIComponent(m[1]!);
        if (m[2] === "leaderboard") return reply(200, await leaderboard(date, url));
        if (m[2] === "ghost") return reply(200, await ghost(date, url));
        return reply(200, await dayInfo(date));
      }
      throw new HttpError(404, "not_found", "Route inconnue");
    } catch (e) {
      if (e instanceof HttpError) return reply(e.status, { error: e.code, message: e.message }, e.headers);
      console.error("Erreur interne :", e);
      return reply(500, { error: "internal", message: "Erreur interne" });
    }
  }

  return { handle };
}
