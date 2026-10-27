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
  coderVoiture,
  decoderVoiture,
  type Track,
  type VoitureDeCourse,
} from "@cdj/sim";
import type { SqlDb } from "./db";
import { replayUnits } from "./replayCost";
import { HttpError } from "./errors";
import type { Logger } from "./log";
import type { Players } from "./players";

// Le Salon côté serveur (lot 27) : il sert le contrat `SalonApi` du jeu (`apps/web/src/salonApi.ts`).
//
//   GET  /api/salon/now                                    heure du serveur, session en cours, présents
//   GET  /api/salon/<session>/board?since=<v>              classement de la session (`unchanged` si la version est la même)
//   GET  /api/salon/<session>/ghosts?refs=a,b              rediffusions demandées par référence publique
//   POST /api/salon/<session>/submit { playerId, name, replay, voiture? }   (lot 51 : la voiture de la course, gardée avec elle, rendue avec le fantôme)
//
// **Une session finie est oubliée** (lot 27b) : une fois le circuit changé (fin de session + minute de grâce), ses courses, son classement
// et son circuit sont effacés, sans podium gardé ni route d'historique. Le nettoyage se fait **à la demande** (la première requête qui voit une
// session terminée), jamais par une tâche de fond : sur Cloud Run, le service peut être éteint. Le podium de fin que le jeu affiche se
// calcule sur le classement encore servi pendant la grâce.
//
// Comme pour le classement du jour : **le serveur ne fait jamais confiance à un temps annoncé**. Il rejoue la rediffusion sur
// `salonCircuit(session)` (même code de simulation que le jeu) et n'enregistre que son propre résultat. Un joueur n'est jamais
// désigné par son identifiant secret mais par une référence publique propre à la session.

/**
 * Un envoi est accepté jusqu'à **3 s** après la fin de la session (lot 31, avant : 60 s). Au jeu, la course en cours est coupée à l'heure
 * pile et ne compte pas : seule une course terminée *avant* `fin` peut arriver après, le temps de la réponse. Marge = l'aller du réseau
 * (une requête de 10 à 300 ms sur une bonne ligne, un réveil de Cloud Run de 0,4 s, un mobile lent 1 à 2 s) + l'écart de l'horloge du
 * joueur, recalée sur `now` à ± la moitié de l'aller-retour. Au-delà, c'est trop tard : le circuit a changé pour tout le monde.
 */
export const SALON_GRACE_MS = 3_000;
/**
 * Une session finie reste *lue* (classement final, fantômes) 20 s après sa fin : le podium du jeu s'affiche à l'heure pile avec le dernier
 * classement connu, puis le rafraîchit une fois les envois clos (`fin + 3 s`). Le podium dure 10 s. Ensuite elle est oubliée (27b).
 */
export const SALON_SERVE_MS = 20_000;
/**
 * Présence (lot 27b) : au plus **une écriture par joueur et par 30 s** (`PRESENCE_WRITE_MS`) ; la dernière visite enregistrée peut donc
 * avoir jusqu'à 30 s de retard, d'où une fenêtre de 60 s : est présent un joueur dont la dernière écriture date de moins de 60 s
 * (un joueur qui lit en continu l'est toujours ; un joueur parti compte au plus 90 s).
 */
export const PRESENCE_WRITE_MS = 30_000;
export const PRESENCE_MS = 60_000;
/** Lot R5 : une présence (empreinte) plus vieille que ceci est effacée au passage (page « Mentions légales et confidentialité »). */
export const PRESENCE_KEEP_MS = 10 * PRESENCE_MS;
/** Lot R5 : le délai d'envoi d'un joueur (empreinte) plus vieux que ceci est effacé au passage. */
export const THROTTLE_KEEP_MS = 3_600_000;
/** Le circuit de la session suivante est préparé dans les deux dernières minutes de la session en cours. */
export const PREPARE_AHEAD_MS = 120_000;
/** Lignes du classement servies (les premiers), plus le voisin de devant et celui de derrière du joueur. */
export const BOARD_ROWS = 15;
/** Références demandées au plus dans une requête de fantômes (le jeu en demande six au plus). */
export const MAX_GHOST_REFS = 8;

/** Fenêtre du débit des lectures (10 minutes). */
const READ_WINDOW_MS = 600_000;

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
  /** Lot R5 : la limite par adresse d'un envoi (adresse du joueur en base, adresse de connexion en mémoire : `Platform.hitAddress`). */
  hitAddress: (info: SalonRequestInfo, prefix: string, limit: number) => Promise<void>;
  /** Lot R5 : l'adresse de connexion seule, en mémoire (`Platform.peerHit`). */
  peerHit: (info: SalonRequestInfo, prefix: string, limit: number) => Promise<void>;
  /** Lot R5 : le plafond global de rejeux de l'instance (`Platform.spendReplays`). */
  spendReplays: (units?: number) => void;
  readJson: (req: Request) => Promise<Record<string, unknown>>;
  playerIdOf: (value: unknown) => string;
  /** Lot 32 : le joueur qui interroge une lecture (en-tête `X-Player-Id`, sinon l'ancien `?player=` pendant la transition), ou `null` (`cdj.ts`). */
  playerOf: (req: Request, url: URL, route: string) => string | null;
  /** Joueurs (lot 30) : pseudos réservés et codes révoqués, mêmes règles que le classement du jour. */
  players: Players;
  /** Lot 51 : la voiture à garder avec une course — celle qu'annonce le jeu si elle est débloquée pour ce joueur, sinon la Sparrow en orange (`cdj.ts`). */
  voitureDe: (playerId: string, annoncee: unknown) => Promise<VoitureDeCourse>;
  limits: SalonLimits;
  /** Marque `demo` les joueurs créés (jamais réglé par le serveur de production). */
  demoPlayers: boolean;
  /** Journal structuré (silencieux par défaut). */
  log?: Logger;
}

export interface SalonRequestInfo {
  clientKey?: string;
  /** Lot R5 : l'adresse de connexion (voir `RequestInfo.peerKey`, `games.ts`). */
  peerKey?: string;
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
  /** Dernière session oubliée *par cette instance* (le nettoyage ne se refait qu'au changement de session). */
  let forgotten = Number.NEGATIVE_INFINITY;
  /** Dernière écriture de présence de chaque joueur (empreinte) vue par cette instance : évite même la requête. */
  const presenceWritten = new Map<string, number>();
  /** Débit des lectures (en mémoire, par instance) : une lecture ne coûte aucune écriture en base. */
  const readBuckets = new Map<string, { bucket: number; count: number }>();

  const current = () => salonSessionAt(now(), sessionMs);
  /** Plus ancienne session encore servie : celle dont la fenêtre de lecture du podium (`SALON_SERVE_MS`) n'est pas écoulée (le podium de fin en a besoin). */
  const oldestServed = () => salonSessionAt(now() - SALON_SERVE_MS, sessionMs);

  /** Numéro de session d'une adresse : un entier raisonnable, entre la plus ancienne servie et la prochaine. */
  function sessionOf(raw: string): number {
    const n = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n)) throw new HttpError(400, "invalid_session", "Numéro de session invalide");
    if (n > current() + 1 || n < oldestServed()) throw new HttpError(404, "unknown_session", "Cette session n'existe pas (ou plus)");
    return n;
  }

  // --- L'oubli : à la demande, jamais par une tâche de fond -----------------------------------------------------------
  /**
   * Efface tout ce qui reste des sessions terminées (fin + grâce) : courses, version du classement, circuit ; et, au passage, les restes
   * de présence et de débit d'envoi. Appelée au début de chaque route : une comparaison d'entiers tant que la session n'a pas changé,
   * quelques DELETE (sans effet s'il n'y a rien) à la première requête qui voit une session terminée. Une instance qui démarre refait
   * le nettoyage une fois, ce qui rattrape un arrêt prolongé du service.
   */
  async function forget(): Promise<void> {
    const closed = oldestServed() - 1;
    if (closed <= forgotten) return;
    const before = forgotten;
    forgotten = closed; // avant tout await : les requêtes simultanées ne le font pas deux fois
    try {
      await db.run("DELETE FROM salon_runs WHERE session <= ?", [closed]);
      await db.run("DELETE FROM salon_sessions WHERE session <= ?", [closed]);
      await db.run("DELETE FROM salon_circuits WHERE session <= ?", [closed]);
      await db.run("DELETE FROM salon_presence WHERE seen_at < ?", [now() - PRESENCE_KEEP_MS]);
      await db.run("DELETE FROM salon_throttle WHERE at < ?", [now() - THROTTLE_KEEP_MS]);
    } catch (e) {
      forgotten = before; // réessayé à la prochaine requête
      kit.log?.("ERROR", "salon : oubli impossible", { error: e instanceof Error ? e.message.slice(0, 200) : "inconnue" });
      return;
    }
    for (const session of [...circuits.keys()]) if (session <= closed) circuits.delete(session);
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
  /**
   * Note la visite d'un joueur, **au plus une écriture par `PRESENCE_WRITE_MS`** : l'instance se souvient de sa dernière écriture (aucune
   * requête dans l'intervalle), et l'upsert est conditionnel (il ne change aucune ligne si une autre instance a écrit il y a moins de
   * 30 s) : le plafond tient aussi avec plusieurs instances.
   */
  async function touch(playerId: string): Promise<void> {
    const key = await kit.hashKey("pr", playerId);
    const t = now();
    const last = presenceWritten.get(key);
    if (last !== undefined && t - last < PRESENCE_WRITE_MS) return;
    if (presenceWritten.size > 5000) for (const [k, at] of presenceWritten) if (t - at >= PRESENCE_WRITE_MS) presenceWritten.delete(k);
    presenceWritten.set(key, t);
    await db.run(
      "INSERT INTO salon_presence (key, seen_at) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET seen_at = excluded.seen_at WHERE salon_presence.seen_at <= excluded.seen_at - ?",
      [key, t, PRESENCE_WRITE_MS],
    );
  }

  async function present(): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_presence WHERE seen_at >= ?", [now() - PRESENCE_MS]))?.n ?? 0;
  }

  /**
   * Débit des lectures, **en mémoire** (par instance, fenêtre de 10 minutes comme `limits.windowMs` du reste de l'API) : une lecture
   * d'un jeu ouvert arrive toutes les 5 s, et un compteur en base coûtait une écriture par lecture (le premier poste d'écritures du
   * lot 27). Une lecture est de toute façon peu coûteuse (< 1 ms) ; avec deux instances la limite réelle est au plus doublée. Les
   * envois, eux, gardent leur compteur en base (exact, et c'est lui qui protège le rejeu).
   */
  async function limitReads(info: SalonRequestInfo): Promise<void> {
    await kit.peerHit(info, "srd", limits.readsPerClient); // lot R5 : l'adresse de connexion aussi (une adresse inventée ne remet pas à zéro)
    if (!info.clientKey) return;
    const key = await kit.hashKey("srd", info.clientKey);
    const bucket = Math.floor(now() / READ_WINDOW_MS);
    let entry = readBuckets.get(key);
    if (!entry || entry.bucket !== bucket) {
      if (readBuckets.size > 5000) for (const [k, e] of readBuckets) if (e.bucket !== bucket) readBuckets.delete(k);
      readBuckets.set(key, (entry = { bucket, count: 0 }));
    }
    if (++entry.count > limits.readsPerClient) {
      const retry = Math.max(1, Math.ceil(((bucket + 1) * READ_WINDOW_MS - now()) / 1000));
      throw new HttpError(429, "rate_limited", "Trop de requêtes, réessaie dans un moment", { "Retry-After": String(retry) });
    }
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
    // Trois lectures indépendantes : en parallèle (sur Turso chaque lecture est un aller-retour réseau, de l'ordre de la dizaine de ms).
    const [version, players, count] = await Promise.all([versionOf(session), present(), participants(session)]);
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
  async function nowRoute(req: Request, url: URL, info: SalonRequestInfo): Promise<unknown> {
    const me = kit.playerOf(req, url, "salon/now");
    await limitReads(info);
    await forget();
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

  async function boardRoute(sessionRaw: string, req: Request, url: URL, info: SalonRequestInfo): Promise<unknown> {
    await forget();
    const session = sessionOf(sessionRaw);
    const me = kit.playerOf(req, url, "salon/board");
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
    await forget();
    const session = sessionOf(sessionRaw);
    const refs = [...new Set((url.searchParams.get("refs") ?? "").split(",").filter((r) => r !== ""))];
    if (refs.length > MAX_GHOST_REFS) throw new HttpError(400, "too_many_refs", `Au plus ${MAX_GHOST_REFS} fantômes à la fois`);
    if (refs.some((r) => !REF.test(r))) throw new HttpError(400, "invalid_ref", "Référence de joueur invalide");
    await limitReads(info);
    const ghosts = [];
    for (const ref of refs) {
      const row = await db.first<{ name: string; ms: number; splits: string; replay: string; submitted_at: number; car: string | null }>(
        "SELECT name, ms, splits, replay, submitted_at, car FROM salon_runs WHERE session = ? AND ref = ?",
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
        voiture: decoderVoiture(row.car), // lot 51 : la voiture de cette course (la Sparrow en orange pour une course d'avant)
      });
    }
    return { ghosts };
  }

  async function submitRoute(sessionRaw: string, req: Request, info: SalonRequestInfo): Promise<unknown> {
    const body = await kit.readJson(req);
    const playerId = kit.playerIdOf(req.headers.get("x-player-id") ?? body.playerId); // lot 32 : l'en-tête d'abord ; le corps n'est jamais dans une adresse
    if (typeof body.replay !== "string" || body.replay.length === 0) throw new HttpError(400, "invalid_replay", "Rediffusion manquante");

    // Vérifications sans état d'abord (une session qui n'est pas ouverte ne coûte rien à refuser).
    const t = now();
    await forget();
    if (!/^\d{1,9}$/.test(sessionRaw)) throw new HttpError(400, "invalid_session", "Numéro de session invalide");
    const session = Number(sessionRaw);
    if (t < salonSessionStart(session, sessionMs)) throw new HttpError(409, "session_future", "Cette session n'a pas commencé");
    if (t > salonSessionEnd(session, sessionMs) + SALON_GRACE_MS) throw new HttpError(409, "session_closed", "Trop tard : cette session est terminée");

    // Débit : par adresse (avant tout rejeu), puis par joueur.
    await kit.hitAddress(info, "ssb", limits.submitsPerClient);
    await kit.players.assertActive(playerId);
    const known = await kit.players.find(playerId);
    const name = await kit.players.resolveName(playerId, body.name, known); // pseudo réservé à son premier propriétaire (lot 30)
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
    kit.spendReplays(replayUnits(replay.runs)); // lots R5 et R7 : plafond global de rejeux de l'instance, proportionnel à la durée (503 au-delà)
    const result = replayRace(circuit.track, replay); // la seule source du temps
    if (!result.finished) throw new HttpError(422, "not_finished", "Cette rediffusion ne franchit pas la ligne d'arrivée");

    const at = now();
    // Lot 51 : la voiture de la course — celle que le jeu annonce si elle est débloquée pour ce joueur, sinon la Sparrow en orange. Une donnée à part, jamais dans la rediffusion.
    const car = coderVoiture(await kit.voitureDe(playerId, body.voiture));
    // Le joueur n'existe qu'après une course valide ; son pseudo est celui du classement du jour (même identité).
    await kit.players.save(playerId, name, known);
    const ref = await refOf(session, playerId);
    const previous = await db.first<{ ms: number; name: string }>("SELECT ms, name FROM salon_runs WHERE session = ? AND player_id = ?", [session, playerId]);
    const improved = !previous || result.finishMs < previous.ms;
    if (improved) {
      await db.run(
        `INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at, car) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session, player_id) DO UPDATE SET name = excluded.name, ms = excluded.ms, splits = excluded.splits,
           replay = excluded.replay, submitted_at = excluded.submitted_at, car = excluded.car WHERE excluded.ms < salon_runs.ms`,
        [session, playerId, ref, name, result.finishMs, JSON.stringify(result.splits), body.replay, at, car],
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

  // --- Circuit de la session suivante ---------------------------------------------------------------------------------
  /**
   * Tâche périodique (le serveur Node l'appelle toutes les quelques secondes ; facultative, rien d'autre n'en dépend : l'oubli se
   * fait à la demande) : garde le circuit de la session en cours et, dans les deux dernières minutes, prépare celui de la suivante,
   * pour qu'aucun pic de calcul ne tombe au changement de session.
   * Les erreurs sont journalisées, jamais propagées (la tâche se réessaie au prochain passage).
   */
  async function tick(): Promise<void> {
    try {
      const t = now();
      const session = salonSessionAt(t, sessionMs);
      await circuitFor(session);
      if (t >= salonSessionEnd(session, sessionMs) - PREPARE_AHEAD_MS) await circuitFor(session + 1);
    } catch (e) {
      kit.log?.("ERROR", "salon : entretien impossible", { error: e instanceof Error ? e.message.slice(0, 200) : "inconnue" });
    }
  }

  return {
    sessionMs,
    nowRoute,
    boardRoute,
    ghostsRoute,
    submitRoute,
    tick,
    forget,
    circuitFor,
  };
}

export type Salon = ReturnType<typeof createSalon>;
