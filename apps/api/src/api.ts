import {
  GENERATOR_VERSION,
  MAX_VARIANT,
  PREMIER_JOUR,
  ReplayError,
  SIM_VERSION,
  circuitNumber,
  dailyCircuit,
  dailyTrackId,
  decodeReplay,
  formatDay,
  isVariant,
  medalFor,
  medalsFor,
  parseDay,
  parseTrack,
  replayRace,
  themeByName,
  themeForDay,
  type Medal,
  type PaletteName,
  type ThemeName,
  type Track,
} from "@cdj/sim";
import { ensureSchemaOn, schemaVersion, type SqlDb } from "./db";
import { HttpError } from "./errors";
import { createPlayers } from "./players";
import { silentLog, type Logger } from "./log";
import { DEFAULT_SALON_LIMITS, createSalon, salonSessionMs, type SalonLimits } from "./salon";
import { PLAYER_ID } from "./validate";

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
  /**
   * Origines autorisées (CORS), variable d'environnement `ALLOWED_ORIGINS` : l'adresse du jeu (`https://<compte>.github.io`, sans chemin :
   * les aperçus de branche en font partie). Remplace `allowOrigin` : l'origine de la requête est répétée si elle figure dans la liste,
   * sinon aucun en-tête CORS n'est envoyé (le navigateur refuse). `*` autorise tout le monde.
   */
  allowedOrigins?: string[];
  /** Journal structuré (voir `log.ts`) ; silencieux par défaut (tests). */
  log?: Logger;
  /** Identifiant de la version déployée (`GIT_SHA`, `K_REVISION`), répété dans `/api/health`. */
  revision?: string;
  /** Sel pour hacher les adresses IP avant de les compter (on ne stocke jamais d'IP en clair). */
  rateSalt?: string;
  limits?: { windowMs: number; perClient: number; perPlayer: number };
  /**
   * Marque `demo` les joueurs créés par cette instance : réservé au script `history:seed` (lot 11), qui fait courir des
   * pilotes fictifs par le même chemin de validation que les vrais. Le serveur de production ne le règle jamais.
   */
  demoPlayers?: boolean;
  /**
   * Jeton de l'admin (lot 14) : donne accès à `/api/admin/*` (planning des circuits). Variable d'environnement `ADMIN_TOKEN`,
   * jamais dans le dépôt. Absent ou de moins de `ADMIN_TOKEN_MIN` caractères : l'admin est désactivé (les routes n'existent pas).
   */
  adminToken?: string;
  /**
   * Durée d'une session du Salon en minutes (0,5 à 60 ; 10 par défaut). Variable d'environnement `SALON_MINUTES` : **tests et
   * essais locaux seulement**, absente en production (une session n'a pas la même durée pour tous si elle change).
   */
  salonMinutes?: number;
  /** Vrai quand `now` vient de `TEST_CLOCK` (tests seulement) : signalé par /api/health, toujours absent en production. */
  testClock?: boolean;
  /** Limites de débit du Salon (voir `DEFAULT_SALON_LIMITS`). */
  salonLimits?: Partial<SalonLimits>;
}

/** Longueur minimale du jeton d'admin : un jeton court se devine. */
export const ADMIN_TOKEN_MIN = 16;
/** Jours d'avance au plus pour remplacer un circuit. */
export const PLANNING_HORIZON = 60;
/** Mauvais jetons tolérés par fenêtre de débit et par adresse, avant de bloquer (même avec le bon jeton). */
export const ADMIN_MAX_FAILURES = 10;

export interface RequestInfo {
  /** Identifie l'appelant pour la limitation de débit (adresse IP) ; fournie par l'hébergeur. */
  clientKey?: string;
}

interface Circuit {
  day: number;
  trackId: string;
  /** Variante du planning (0 = d'origine) et thème imposé (`null` = celui de la date). */
  variant: number;
  theme: ThemeName | null;
  spec: string;
  authorMs: number;
  attempt: number;
  palette: PaletteName;
  track: Track;
}

const DEFAULT_LIMITS = { windowMs: 10 * 60_000, perClient: 60, perPlayer: 30 };

export function createApi(options: ApiOptions) {
  const { db } = options;
  const now = options.now ?? Date.now;
  const allowOrigin = options.allowOrigin ?? "*";
  const allowedOrigins = options.allowedOrigins?.map((o) => o.trim().replace(/\/+$/, "").toLowerCase()).filter(Boolean);
  const log = options.log ?? silentLog;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const circuits = new Map<number, Circuit>();
  /** Circuits en cours de calcul (jour + identifiant) : deux requêtes simultanées n'en font qu'un (le générateur coûte ≈ 0,2–0,5 s de calcul). */
  const generating = new Map<string, Promise<Circuit>>();
  const sessionMs = salonSessionMs(options.salonMinutes) ?? 600_000;
  let schemaReady: Promise<void> | null = null;

  /** Schéma créé ou mis à jour une fois par instance (une seule lecture quand la base est déjà à jour). Un échec n'est pas gardé en mémoire. */
  const ensureSchema = () =>
    (schemaReady ??= (async () => {
      const started = performance.now();
      const upToDate = await ensureSchemaOn(db);
      log("INFO", upToDate ? "schéma à jour" : "schéma appliqué", { ms: Math.round(performance.now() - started), schema: schemaVersion() });
    })().catch((e) => {
      schemaReady = null;
      throw e;
    }));

  const today = () => Math.floor(now() / DAY_MS);

  // --- Planning et circuit du jour (cache : le générateur est coûteux, le résultat est figé) -----------------
  /** Variante et thème imposé du planning pour un jour (`{ 0, null }` : le circuit d'origine). */
  async function planOf(day: number): Promise<{ variant: number; theme: ThemeName | null }> {
    const row = await db.first<{ variant: number; theme: string | null }>("SELECT variant, theme FROM planning WHERE day = ?", [day]);
    if (!row) return { variant: 0, theme: null };
    return { variant: isVariant(row.variant) ? row.variant : 0, theme: themeByName(row.theme)?.name ?? null };
  }

  /**
   * Le circuit en vigueur ce jour-là : celui du planning s'il y en a un, sinon l'original. Toujours celui-là qui sert au
   * rejeu : une ligne ou une mémoire d'une autre variante (ou d'une autre version du générateur) est ignorée.
   */
  async function getCircuit(day: number): Promise<Circuit> {
    const { variant, theme } = await planOf(day);
    const expected = dailyTrackId(day, theme, variant);
    const memo = circuits.get(day);
    if (memo && memo.trackId === expected) return memo;
    const key = `${day}|${expected}`;
    let pending = generating.get(key);
    if (!pending) {
      pending = loadCircuit(day, variant, theme, expected).finally(() => generating.delete(key));
      generating.set(key, pending);
    }
    return pending;
  }

  /**
   * Lit le circuit en base, ou le génère et le garde. Avec plusieurs instances, deux d'entre elles peuvent le calculer en même temps :
   * le résultat est le même (déterministe) et l'écriture identique, donc sans conséquence.
   */
  async function loadCircuit(day: number, variant: number, theme: ThemeName | null, expected: string): Promise<Circuit> {
    const row = await db.first<{ track_id: string; spec: string; author_ms: number; attempt: number; palette: string }>(
      "SELECT track_id, spec, author_ms, attempt, palette FROM circuits WHERE day = ?",
      [day],
    );
    let circuit: Circuit;
    if (row && row.track_id === expected) {
      circuit = {
        day,
        trackId: row.track_id,
        variant,
        theme,
        spec: row.spec,
        authorMs: row.author_ms,
        attempt: row.attempt,
        palette: row.palette as PaletteName,
        track: parseTrack(row.track_id, row.spec),
      };
    } else {
      const started = performance.now();
      circuit = generate(day, variant, theme);
      await storeCircuit(circuit);
      log("INFO", "circuit du jour généré", { day: formatDay(day), trackId: circuit.trackId, attempt: circuit.attempt, ms: Math.round(performance.now() - started) });
    }
    circuits.set(day, circuit);
    return circuit;
  }

  function generate(day: number, variant: number, theme: ThemeName | null): Circuit {
    const c = dailyCircuit(day, variant, theme);
    if (c.fallback) throw new HttpError(503, "circuit_unavailable", "Circuit indisponible, réessaie plus tard");
    return { day, trackId: c.track.id, variant, theme, spec: c.spec, authorMs: c.authorMs, attempt: c.attempt, palette: c.palette, track: c.track };
  }

  const storeCircuit = (c: Circuit) =>
    db.run("INSERT OR REPLACE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      c.day,
      c.trackId,
      c.spec,
      c.authorMs,
      c.attempt,
      c.palette,
      now(),
    ]);

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
    if (day < PREMIER_JOUR || day > today()) throw new HttpError(404, "unknown_day", "Ce jour n'a pas (encore) de circuit");
    if (mustBeOpen) {
      const sinceMidnight = now() - today() * DAY_MS;
      const open = day === today() || (day === today() - 1 && sinceMidnight < GRACE_MS);
      if (!open) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé");
    }
    return day;
  }

  // --- Le Salon (lot 27) : voir salon.ts ------------------------------------------------------------------------------
  const players = createPlayers({ db, now, demoPlayers: options.demoPlayers === true });
  const salon = createSalon({
    db,
    players,
    now,
    sessionMs,
    hashKey,
    hit,
    readJson,
    playerIdOf,
    limits: { ...DEFAULT_SALON_LIMITS, ...options.salonLimits },
    demoPlayers: options.demoPlayers === true,
    log,
  });

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
    if (info.clientKey) await hit(await hashKey("ip", info.clientKey), limits.perClient);
    await hit(await hashKey("p", playerId), limits.perPlayer);

    // Pseudo (lot 30) : réservé à son premier propriétaire, vérifié avant le rejeu (bon marché) et garanti par la base à l'écriture.
    await players.assertActive(playerId);
    const known = await players.find(playerId);
    const name = await players.resolveName(playerId, body.name, known);

    // Vérifications bon marché d'abord, rejeu (coûteux) ensuite.
    let replay;
    try {
      replay = decodeReplay(body.replay);
    } catch (e) {
      throw new HttpError(400, "invalid_replay", e instanceof ReplayError ? e.message : "Rediffusion illisible");
    }
    if (replay.simVersion !== SIM_VERSION) {
      // Course enregistrée avec une autre physique (jeu resté ouvert pendant une mise à jour, vieux record) : elle
      // ne donnerait pas le même temps ici. Pas de migration : on la refuse en disant pourquoi.
      const why = replay.simVersion < SIM_VERSION ? "une ancienne version du jeu" : "une version du jeu plus récente que le serveur";
      throw new HttpError(409, "sim_version", `Course enregistrée avec ${why} (simulation v${replay.simVersion}, serveur v${SIM_VERSION}) : recharge la page et refais un temps`);
    }
    const circuit = await getCircuit(day);
    if (replay.trackId !== circuit.trackId) throw new HttpError(409, "track_mismatch", "Cette rediffusion n'est pas celle du circuit de ce jour");

    const result = replayRace(circuit.track, replay); // la seule source du temps
    if (!result.finished) throw new HttpError(422, "not_finished", "Cette rediffusion ne franchit pas la ligne d'arrivée");

    const t = now();
    await players.save(playerId, name, known);
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
    log("INFO", "temps du jour", { day: formatDay(day), ms: result.finishMs, improved });
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
    players.checkForm(body.name); // forme et mots refusés d'abord : aucune base ni débit consommé pour un pseudo qui ne passera jamais
    if (info.clientKey) await hit(await hashKey("ip", info.clientKey), limits.perClient);
    await hit(await hashKey("p", playerId), limits.perPlayer);
    await players.assertActive(playerId);
    // On ne crée jamais de joueur ici : un joueur n'existe qu'après avoir envoyé une course valide (sinon, n'importe
    // qui pourrait remplir la base de pseudos sans jouer).
    const known = await players.find(playerId);
    if (!known) throw new HttpError(404, "unknown_player", "Ce joueur n'a pas encore de temps enregistré");
    const name = await players.resolveName(playerId, body.name, known);
    await players.save(playerId, name, known);
    await db.run("UPDATE salon_runs SET name = ? WHERE player_id = ? AND name <> ?", [name, playerId, name]); // le Salon en cours montre le même pseudo
    return { name };
  }

  // --- Pseudos et profil (lot 30) ---------------------------------------------------------------------------------
  /** Vérifications de pseudo par adresse et par fenêtre de débit : assez pour un formulaire, trop peu pour balayer des pseudos. */
  const NAME_CHECKS_PER_WINDOW = 40;
  /** Lectures du profil par joueur / par adresse et par fenêtre de débit (le jeu se synchronise au plus toutes les 30 s). */
  const ME_PER_PLAYER = 60;
  const ME_PER_CLIENT = 200;
  /** Changements de code par joueur et par fenêtre de débit. */
  const ROTATIONS_PER_WINDOW = 3;

  /** L'identifiant secret du joueur, lu dans l'en-tête `X-Player-Id` (jamais dans l'adresse, qui finit dans les journaux de l'hébergeur). */
  function secretOf(req: Request): string {
    return playerIdOf(req.headers.get("x-player-id"));
  }

  async function nameCheck(req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (info.clientKey) await hit(await hashKey("nm", info.clientKey), NAME_CHECKS_PER_WINDOW);
    const header = req.headers.get("x-player-id");
    return players.check(url.searchParams.get("name"), header === null ? null : playerIdOf(header));
  }

  /** Le profil du joueur, tel que le serveur le connaît : le jeu s'y synchronise, son stockage local n'en est qu'un cache. */
  async function myProfile(req: Request, info: RequestInfo): Promise<unknown> {
    const id = secretOf(req);
    if (info.clientKey) await hit(await hashKey("meip", info.clientKey), ME_PER_CLIENT);
    await hit(await hashKey("me", id), ME_PER_PLAYER);
    await players.assertActive(id);
    const row = await players.find(id);
    if (!row) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue un tour pour l'ouvrir");

    const t = today();
    const rows = await db.all<{ day: number; ms: number; submitted_at: number; track_id: string | null; author_ms: number | null; final_rank: number | null; final_total: number | null }>(
      `SELECT r.day AS day, r.ms AS ms, r.submitted_at AS submitted_at, c.track_id AS track_id, c.author_ms AS author_ms, r.final_rank AS final_rank, r.final_total AS final_total
       FROM results r LEFT JOIN circuits c ON c.day = r.day WHERE r.player_id = ? ORDER BY r.day DESC`,
      [id],
    );
    // Un jour est fermé (sa place ne bougera plus) une fois passée la minute de grâce qui suit minuit : sa place est calculée une fois, puis gardée.
    const closedBefore = now() - t * DAY_MS >= GRACE_MS ? t : t - 1;
    if (rows.some((r) => r.final_rank === null && r.day < closedBefore)) {
      const done = await db.all<{ day: number; final_rank: number; final_total: number }>(
        `UPDATE results SET
           final_rank = (SELECT COUNT(*) FROM results x WHERE x.day = results.day AND (x.ms < results.ms OR (x.ms = results.ms AND x.submitted_at < results.submitted_at))) + 1,
           final_total = (SELECT COUNT(*) FROM results x WHERE x.day = results.day)
         WHERE player_id = ? AND final_rank IS NULL AND day < ? RETURNING day, final_rank, final_total`,
        [id, closedBefore],
      );
      const byDay = new Map(done.map((d) => [d.day, d]));
      for (const r of rows) {
        const d = byDay.get(r.day);
        if (d) {
          r.final_rank = d.final_rank;
          r.final_total = d.final_total;
        }
      }
    }
    const counts: Record<Medal, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
    let bestRank: { date: string; rank: number; participants: number } | null = null;
    const played = new Set<number>();
    const past: { date: string; trackId: string | null; ms: number; medal: Medal | null }[] = [];
    let todayRow: (typeof rows)[number] | null = null;
    for (const r of rows) {
      played.add(r.day);
      const medal = r.author_ms === null ? null : (medalFor(r.ms, medalsFor(r.author_ms)) as Medal | null);
      if (medal) counts[medal]++;
      // Jours fermés : place gardée. Aujourd'hui (et hier, pendant la grâce) : place du moment.
      const rank = r.final_rank ?? (await rankOf(r.day, r.ms, r.submitted_at));
      const total = r.final_total ?? (await participants(r.day));
      if (!bestRank || rank < bestRank.rank || (rank === bestRank.rank && total > bestRank.participants)) bestRank = { date: formatDay(r.day), rank, participants: total };
      if (r.day === t) todayRow = r;
      else past.push({ date: formatDay(r.day), trackId: r.track_id, ms: r.ms, medal });
    }
    let streak = 0;
    for (let d = played.has(t) ? t : t - 1; played.has(d); d--) streak++;

    let best: unknown = null;
    if (todayRow) {
      const full = await db.first<{ splits: string; replay: string }>("SELECT splits, replay FROM results WHERE day = ? AND player_id = ?", [t, id]);
      let simVersion: number | null = null;
      try {
        simVersion = full ? decodeReplay(full.replay).simVersion : null;
      } catch {
        /* rediffusion illisible : le temps reste, pas le fantôme */
      }
      best = {
        date: formatDay(t),
        trackId: todayRow.track_id,
        ms: todayRow.ms,
        medal: todayRow.author_ms === null ? null : medalFor(todayRow.ms, medalsFor(todayRow.author_ms)),
        splits: full ? (JSON.parse(full.splits) as number[]) : [],
        ...(full && simVersion !== null ? { replay: full.replay, simVersion } : {}),
      };
    }
    return {
      name: row.name,
      renameRequired: row.rename_required === 1,
      today: formatDay(t),
      simVersion: SIM_VERSION,
      stats: { days: rows.length, medals: counts, bestRank, streak },
      best,
      past,
    };
  }

  /** « Changer mon code » : le serveur associe le profil au nouvel identifiant `newId` (tiré par le jeu), l'ancien ne vaut plus rien. */
  async function rotateCode(req: Request, info: RequestInfo): Promise<unknown> {
    const oldId = secretOf(req);
    const body = await readJson(req);
    const newId = playerIdOf(body.newId);
    if (newId === oldId) throw new HttpError(400, "invalid_player", "Le nouvel identifiant doit être différent de l'ancien");
    if (info.clientKey) await hit(await hashKey("ip", info.clientKey), limits.perClient);
    await hit(await hashKey("rot", oldId), ROTATIONS_PER_WINDOW);
    const { replayed } = await players.rotate(oldId, newId);
    log("INFO", "code de joueur remplacé", { replayed });
    return { rotated: true };
  }

  async function dayInfo(date: string): Promise<unknown> {
    const day = dayOf(date);
    const c = await getCircuit(day);
    return {
      date: formatDay(day),
      number: circuitNumber(day),
      trackId: c.trackId,
      variant: c.variant,
      theme: c.theme,
      authorMs: c.authorMs,
      attempt: c.attempt,
      palette: c.palette,
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
    };
  }

  /** Public : les jours (jusqu'à aujourd'hui) dont le circuit n'est pas l'original. Les jours à venir ne sont pas révélés. */
  async function publicPlanning(): Promise<unknown> {
    const rows = await db.all<{ day: number; variant: number; theme: string | null }>("SELECT day, variant, theme FROM planning WHERE day <= ? ORDER BY day", [today()]);
    return { today: formatDay(today()), days: rows.map((r) => ({ date: formatDay(r.day), variant: r.variant, theme: themeByName(r.theme)?.name ?? null })) };
  }

  // --- Admin (jeton) ------------------------------------------------------------------------------------------
  const adminToken = options.adminToken && options.adminToken.length >= ADMIN_TOKEN_MIN ? options.adminToken : null;

  /** Comparaison à temps constant : on compare les empreintes SHA-256 (de longueur fixe), octet par octet sans s'arrêter. */
  async function sameToken(given: string, expected: string): Promise<boolean> {
    const enc = new TextEncoder();
    const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
    const a = new Uint8Array(x);
    const b = new Uint8Array(y);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
    return diff === 0;
  }

  async function requireAdmin(req: Request, info: RequestInfo): Promise<void> {
    if (!adminToken) throw new HttpError(404, "not_found", "Route inconnue"); // admin désactivé : la route n'existe pas
    const key = await hashKey("adm", info.clientKey ?? "inconnu");
    const bucket = Math.floor(now() / limits.windowMs);
    const failures = (await db.first<{ count: number }>("SELECT count FROM rate WHERE key = ? AND bucket = ?", [key, bucket]))?.count ?? 0;
    if (failures >= ADMIN_MAX_FAILURES) {
      const retry = Math.max(1, Math.ceil(((bucket + 1) * limits.windowMs - now()) / 1000));
      throw new HttpError(429, "rate_limited", "Trop d'essais de jeton, réessaie plus tard", { "Retry-After": String(retry) });
    }
    const header = req.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!(await sameToken(given, adminToken))) {
      await hit(key, ADMIN_MAX_FAILURES); // compte l'échec (et refuse net au-delà de la limite)
      throw new HttpError(401, "unauthorized", "Jeton d'admin manquant ou incorrect");
    }
  }

  /** Vue d'ensemble pour le panneau : planning, quatorze jours passés (joueurs, meilleur temps) et temps du jour. */
  async function adminOverview(): Promise<unknown> {
    const t = today();
    const first = Math.max(PREMIER_JOUR, t - 14); // aujourd'hui et les quatorze jours passés
    const plan = await db.all<{ day: number; variant: number; theme: string | null; chosen_at: number }>("SELECT day, variant, theme, chosen_at FROM planning ORDER BY day");
    const stats = await db.all<{ day: number; n: number; best: number }>("SELECT day, COUNT(*) AS n, MIN(ms) AS best FROM results WHERE day >= ? AND day <= ? GROUP BY day", [first, t]);
    const known = await db.all<{ day: number; track_id: string; author_ms: number }>("SELECT day, track_id, author_ms FROM circuits WHERE day >= ? AND day <= ?", [first, t]);
    const times = await db.all<{ ms: number }>("SELECT ms FROM results WHERE day = ? ORDER BY ms ASC LIMIT 5000", [t]);
    const planBy = new Map(plan.map((r) => [r.day, r]));
    const days = [];
    for (let day = t; day >= first; day--) {
      const s = stats.find((r) => r.day === day);
      const c = known.find((r) => r.day === day);
      const p = planBy.get(day);
      days.push({
        date: formatDay(day),
        number: circuitNumber(day),
        participants: s?.n ?? 0,
        bestMs: s?.best ?? null,
        authorMs: c?.author_ms ?? null,
        trackId: c?.track_id ?? null,
        variant: p?.variant ?? 0,
        theme: themeByName(p?.theme)?.name ?? null,
      });
    }
    return {
      today: formatDay(t),
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
      plan: plan.map((r) => ({ date: formatDay(r.day), variant: r.variant, theme: themeByName(r.theme)?.name ?? null, chosenAt: r.chosen_at })),
      days,
      times: times.map((r) => r.ms),
    };
  }

  /** Le jour doit être strictement dans le futur (UTC) : un jour commencé est figé, ses joueurs ont déjà couru dessus. */
  function plannableDay(date: string): number {
    const day = parseDay(date);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day <= today()) throw new HttpError(409, "day_started", "Ce jour a déjà commencé : son circuit est figé");
    if (day > today() + PLANNING_HORIZON) throw new HttpError(400, "too_far", `Pas plus de ${PLANNING_HORIZON} jours à l'avance`);
    return day;
  }

  async function replaceCircuit(req: Request, date: string): Promise<unknown> {
    const day = plannableDay(date);
    const body = await readJson(req);
    if (!isVariant(body.variant)) throw new HttpError(400, "invalid_variant", `Variante attendue : un entier de 0 à ${MAX_VARIANT}`);
    let theme: ThemeName | null = null;
    if (body.theme !== undefined && body.theme !== null) {
      const t = typeof body.theme === "string" ? themeByName(body.theme) : null;
      if (!t) throw new HttpError(400, "invalid_theme", "Thème inconnu");
      theme = t.name;
    }
    if (theme === themeForDay(day).name) theme = null; // le thème de la date n'est pas « imposé »
    if (body.variant === 0 && theme === null) return revertCircuit(date);
    // Le circuit doit exister : le pilote doit le finir dans la fenêtre. Sinon la course du jour n'aurait pas de circuit.
    const circuit = generate(day, body.variant, theme);
    const chosenAt = now();
    await db.run(
      "INSERT INTO planning (day, variant, theme, chosen_at) VALUES (?, ?, ?, ?) ON CONFLICT (day) DO UPDATE SET variant = excluded.variant, theme = excluded.theme, chosen_at = excluded.chosen_at",
      [day, body.variant, theme, chosenAt],
    );
    await storeCircuit(circuit);
    circuits.delete(day);
    return { date: formatDay(day), variant: body.variant, theme, chosenAt, trackId: circuit.trackId, authorMs: circuit.authorMs };
  }

  async function revertCircuit(date: string): Promise<unknown> {
    const day = plannableDay(date);
    await db.run("DELETE FROM planning WHERE day = ?", [day]);
    await db.run("DELETE FROM circuits WHERE day = ?", [day]); // régénéré à la demande, avec le circuit d'origine
    circuits.delete(day);
    return { date: formatDay(day), variant: 0, theme: null, chosenAt: null };
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
  /** En-têtes CORS d'une requête : liste d'origines (`ALLOWED_ORIGINS`) ou, à défaut, la valeur unique `allowOrigin`. */
  function corsFor(req: Request): Record<string, string> {
    const common = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Player-Id",
      "Access-Control-Max-Age": "86400",
    };
    if (!allowedOrigins) return { "Access-Control-Allow-Origin": allowOrigin, ...common };
    if (allowedOrigins.includes("*")) return { "Access-Control-Allow-Origin": "*", ...common };
    const origin = req.headers.get("origin");
    const ok = origin !== null && allowedOrigins.includes(origin.trim().replace(/\/+$/, "").toLowerCase());
    return { ...(ok ? { "Access-Control-Allow-Origin": origin } : {}), Vary: "Origin", ...common };
  }
  const replier = (req: Request) => {
    const cors = corsFor(req);
    return (status: number, body: unknown, extra: Record<string, string> = {}) =>
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
      });
  };

  /** Santé : version, base joignable, durée du Salon. Toujours en 200 si la base répond, en 503 sinon (la sonde de Cloud Run et la CI s'y fient). */
  async function health(reply: ReturnType<typeof replier>): Promise<Response> {
    const body = {
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
      today: formatDay(today()),
      salonMinutes: sessionMs / 60_000,
      /** Vrai si `SALON_MINUTES` est réglée (essais locaux seulement) : doit toujours être faux en production. */
      salonOverride: options.salonMinutes !== undefined,
      ...(options.testClock ? { testClock: true } : {}),
      ...(options.revision ? { revision: options.revision } : {}),
    };
    try {
      await ensureSchema();
      await db.first("SELECT 1 AS ok");
      return reply(200, { ok: true, db: "ok", ...body });
    } catch (e) {
      log("ERROR", "santé : base injoignable", { error: e instanceof Error ? e.message.slice(0, 200) : "inconnue" });
      return reply(503, { ok: false, db: "error", ...body });
    }
  }

  async function handle(req: Request, info: RequestInfo = {}): Promise<Response> {
    const reply = replier(req);
    try {
      if (req.method === "OPTIONS") return reply(204, null);
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "");
      if (path === "/api/health" && req.method === "GET") return await health(reply);
      await ensureSchema();

      if (path === "/api/submit") {
        if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
        return reply(200, await submit(req, info));
      }
      if (path === "/api/player") {
        if (req.method !== "PUT") throw new HttpError(405, "method_not_allowed", "PUT attendu");
        return reply(200, await renamePlayer(req, info));
      }
      if (path === "/api/name") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return reply(200, await nameCheck(req, url, info));
      }
      if (path === "/api/me") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return reply(200, await myProfile(req, info));
      }
      if (path === "/api/me/code") {
        if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
        return reply(200, await rotateCode(req, info));
      }
      if (path === "/api/planning") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return reply(200, await publicPlanning());
      }
      if (path.startsWith("/api/admin/")) {
        await requireAdmin(req, info);
        if (path === "/api/admin/overview") {
          if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
          return reply(200, await adminOverview());
        }
        const pm = /^\/api\/admin\/planning\/([^/]+)$/.exec(path);
        if (pm) {
          const date = decodeURIComponent(pm[1]!);
          if (req.method === "PUT") return reply(200, await replaceCircuit(req, date));
          if (req.method === "DELETE") return reply(200, await revertCircuit(date));
          throw new HttpError(405, "method_not_allowed", "PUT ou DELETE attendu");
        }
        throw new HttpError(404, "not_found", "Route inconnue");
      }
      const sm = /^\/api\/salon\/([^/]+)(?:\/(board|ghosts|submit))?$/.exec(path);
      if (sm) {
        const what = sm[2];
        let key: string;
        try {
          key = decodeURIComponent(sm[1]!);
        } catch {
          throw new HttpError(400, "invalid_session", "Adresse invalide");
        }
        if (!what && key === "now") {
          if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
          return reply(200, await salon.nowRoute(url, info));
        }
        if (what === "submit") {
          if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
          return reply(200, await salon.submitRoute(key, req, info));
        }
        if (what === "board" || what === "ghosts") {
          if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
          return reply(200, what === "board" ? await salon.boardRoute(key, url, info) : await salon.ghostsRoute(key, url, info));
        }
        throw new HttpError(404, "not_found", "Route inconnue");
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
      if (e instanceof HttpError) {
        if (e.status === 429 || e.status >= 500) log(e.status >= 500 ? "ERROR" : "WARNING", "refus", { status: e.status, code: e.code });
        return reply(e.status, { error: e.code, message: e.message, ...e.details }, e.headers);
      }
      log("ERROR", "erreur interne", { error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "inconnue" });
      return reply(500, { error: "internal", message: "Erreur interne" });
    }
  }

  /**
   * Tâche périodique du serveur (Node : toutes les 15 s) : prépare à l'avance le circuit du Salon. Facultative : sans elle, le
   * circuit se génère à la première requête qui en a besoin (l'oubli des sessions finies se fait de toute façon à la demande).
   */
  async function tick(): Promise<void> {
    try {
      await ensureSchema();
      await salon.tick();
    } catch (e) {
      log("ERROR", "tâche périodique du Salon", { error: e instanceof Error ? e.message.slice(0, 200) : "inconnue" }); // réessayée au prochain passage ; ne doit jamais arrêter le serveur
    }
  }

  return { handle, tick, salon };
}
