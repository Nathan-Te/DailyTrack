import { parisDay, parisDayStart } from "@cdj/clock";
import { ensureSchemaOn, schemaVersion, type SqlDb } from "./db";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";
import type { Logger } from "./log";
import { createPlayers } from "./players";
import { PLAYER_ID } from "./validate";

// La plateforme (lot P0) : ce qui est commun à tous les jeux, écrit une fois. Joueurs et pseudos (`players.ts`, `pseudos.ts`), limitation de
// débit (en base pour les envois, en mémoire pour les lectures), lecture des corps de requête, schéma (empreinte dans `meta`), « aujourd'hui »
// à Paris. Les routes communes (pseudo, profil, code) sont dans `identity.ts` ; la configuration dans `config.ts`, les journaux dans `log.ts`.
// Ce code vient d'`api.ts` (lots 5, 27, 30, 31), déplacé tel quel.

/** Taille maximale du corps d'une requête (une rediffusion complète fait ~6 ko ; le pire cas décodable ~300 ko). */
export const MAX_BODY_BYTES = 400_000;

export const DEFAULT_LIMITS = { windowMs: 10 * 60_000, perClient: 60, perPlayer: 30 };

/**
 * Lot R5 : les compteurs de débit en base (`rate` : empreintes salées des adresses et des identifiants, jamais en clair) gardent la fenêtre en
 * cours et les `RATE_KEEP_WINDOWS` précédentes, puis sont effacés au passage (au premier compteur d'une nouvelle fenêtre). Durée affichée
 * par la page « Mentions légales et confidentialité » : `(RATE_KEEP_WINDOWS + 1) × windowMs` (testé).
 */
export const RATE_KEEP_WINDOWS = 3;

/**
 * Lot R5 : une limite par adresse compte aussi l'**adresse de connexion** (`RequestInfo.peerKey`, écrite par le frontal de Google), à `limite ×
 * PEER_FACTOR`, en mémoire par instance. Un appel direct à `run.app` qui invente une adresse différente à chaque fois reste borné par son
 * adresse réelle ; par Firebase, l'adresse de connexion est un relais partagé par des joueurs, d'où la marge (mesurée au lot R5 : voir le
 * README du lot et `apps/api/CLAUDE.md`, « Adresse du client »).
 */
export const PEER_FACTOR = 10;

/**
 * Lot R5 : plafond global de rejeux par minute et **par instance** (`server.ts` le règle ; `createApi` sans réglage : aucun plafond, pour les
 * outils qui rejouent en masse en mémoire, `history:seed`, `jump:seed`, `recette:seed`). Un rejeu coûte ≈ 20 à 30 ms : 600 par minute ≈ 10
 * par seconde, un quart à la moitié d'un vCPU. Au-delà : 503 `busy` (propre, avec `Retry-After`), jamais une file qui s'allonge.
 */
export const REPLAYS_PER_MINUTE = 600;

/**
 * Lot R8 : la **génération de données** — un nombre qui ne change que lorsque la remise à zéro du lancement vide la base (`meta.generation`,
 * l'instant de la remise à zéro en millisecondes : croissant, donc un navigateur ne « revient » jamais à une génération plus ancienne). Absent
 * (base jamais remise à zéro) : 0. Lue au plus toutes les `GENERATION_TTL_MS` par instance (une ligne), et rendue par `GET /api/portail/jour`,
 * la lecture regroupée de DailyJump et `GET /api/day/<date>` de DailyTrack : un navigateur qui en garde une plus ancienne efface ses données
 * de jeu (`packages/profile/src/generation.ts`).
 */
export const GENERATION_KEY = "generation";
export const GENERATION_TTL_MS = 30_000;

export interface PlatformOptions {
  db: SqlDb;
  now: () => number;
  log: Logger;
  environment: string;
  limits: { windowMs: number; perClient: number; perPlayer: number };
  rateSalt?: string;
  /** Lot R5 : plafond de rejeux par minute de cette instance (`REPLAYS_PER_MINUTE` en production ; absent : aucun). */
  replaysPerMinute?: number;
  /** Lot R5 : multiple des limites par adresse pour l'adresse de connexion (`PEER_FACTOR` par défaut ; 0 : coupé). */
  peerFactor?: number;
  demoPlayers: boolean;
  /** Les lignes des jeux qui suivent un « Changer mon code » (dans la même transaction que la plateforme). */
  rotateStatements: (oldId: string, newId: string) => Statement[];
}

export type PlatformKit = Platform & { ensureSchema(): Promise<void> };

export function createPlatform(options: PlatformOptions): PlatformKit {
  const { db, now, log, limits } = options;
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

  /**
   * Lot R8 : la génération de données (voir `GENERATION_KEY`), gardée `GENERATION_TTL_MS` par instance ; un seul appel en vol à la fois. **Quand elle
   * change** (la remise à zéro du lancement a vidé la base), l'instance **oublie tout ce qu'elle garde en mémoire** (`onGenerationChange` : classements
   * gardés, premier d'un jour fermé, cartes des morts…) : aucun redémarrage de révision n'est nécessaire. `api.ts` appelle `generation()` au début de
   * chaque requête (une lecture d'une ligne par instance et par délai).
   */
  let generationMemo: { at: number; value: Promise<number> } | null = null;
  let generationVue: number | null = null;
  const generationListeners = new Set<() => void>();
  const generation = (): Promise<number> => {
    if (generationMemo && now() - generationMemo.at < GENERATION_TTL_MS) return generationMemo.value;
    const value = db
      .first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [GENERATION_KEY])
      .then((row) => {
        const n = row ? Number(row.value) : 0;
        const g = Number.isSafeInteger(n) && n > 0 ? n : 0;
        if (generationVue !== null && g !== generationVue) {
          log("INFO", "génération de données changée : mémoire de l'instance oubliée", { generation: g });
          for (const fn of generationListeners) fn();
        }
        generationVue = g;
        return g;
      });
    const entry = { at: now(), value };
    generationMemo = entry;
    value.catch(() => {
      if (generationMemo === entry) generationMemo = null; // un échec n'est pas gardé
    });
    return value;
  };

  const today = () => parisDay(now()); // la date à Paris (lot 31), jamais le jour UTC
  /** Temps écoulé depuis minuit de Paris (le jour dure 23 h, 24 h ou 25 h selon l'heure d'été). */
  const sinceMidnight = () => now() - parisDayStart(today());

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
    if (count === 1) await db.run("DELETE FROM rate WHERE bucket < ?", [bucket - RATE_KEEP_WINDOWS]); // ménage au passage
    if (count > limit) {
      const retry = Math.max(1, Math.ceil(((bucket + 1) * limits.windowMs - now()) / 1000));
      throw new HttpError(429, "rate_limited", "Trop de requêtes, réessaie dans un moment", { "Retry-After": String(retry) });
    }
  }

  /**
   * Débit des lectures **en mémoire** (par instance, même fenêtre que `hit`) : une lecture ne doit rien écrire (Turso facture les lignes
   * écrites, voir le Salon au lot 27b). Avec deux instances la limite réelle est au plus doublée ; les envois, eux, sont comptés en base.
   */
  const readBuckets = new Map<string, { bucket: number; count: number }>();
  function readHit(key: string, limit: number): void {
    const bucket = Math.floor(now() / limits.windowMs);
    let entry = readBuckets.get(key);
    if (!entry || entry.bucket !== bucket) {
      if (readBuckets.size > 5000) for (const [k, e] of readBuckets) if (e.bucket !== bucket) readBuckets.delete(k);
      readBuckets.set(key, (entry = { bucket, count: 0 }));
    }
    if (++entry.count > limit) {
      const retry = Math.max(1, Math.ceil(((bucket + 1) * limits.windowMs - now()) / 1000));
      throw new HttpError(429, "rate_limited", "Trop de requêtes, réessaie dans un moment", { "Retry-After": String(retry) });
    }
  }

  // --- Lot R5 : adresse de connexion et plafond de rejeux ---------------------------------------------------
  async function peerHit(info: RequestInfo, prefix: string, limit: number): Promise<void> {
    const factor = options.peerFactor ?? PEER_FACTOR;
    if (!info.peerKey || info.peerKey === info.clientKey || factor <= 0) return;
    try {
      readHit(await hashKey(`${prefix}~c`, info.peerKey), limit * factor);
    } catch (e) {
      log("WARNING", "débit : limite de l'adresse de connexion", { prefix }); // jamais l'adresse
      throw e;
    }
  }

  async function hitAddress(info: RequestInfo, prefix: string, limit: number): Promise<void> {
    if (info.clientKey) await hit(await hashKey(prefix, info.clientKey), limit);
    await peerHit(info, prefix, limit);
  }

  async function readHitAddress(info: RequestInfo, prefix: string, limit: number): Promise<void> {
    if (info.clientKey) readHit(await hashKey(prefix, info.clientKey), limit);
    await peerHit(info, prefix, limit);
  }

  let replayMinute = -1;
  let replaysThisMinute = 0;
  function spendReplays(units = 1): void {
    const cap = options.replaysPerMinute;
    if (cap === undefined || !Number.isFinite(cap)) return;
    const minute = Math.floor(now() / 60_000);
    if (minute !== replayMinute) {
      replayMinute = minute;
      replaysThisMinute = 0;
    }
    if (replaysThisMinute + units > cap) {
      log("WARNING", "plafond de rejeux atteint", { cap });
      const retry = Math.max(1, Math.ceil(((minute + 1) * 60_000 - now()) / 1000));
      throw new HttpError(503, "busy", "Le serveur est très demandé : réessaie dans une minute", { "Retry-After": String(retry) });
    }
    replaysThisMinute += units;
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

  const players = createPlayers({ db, now, demoPlayers: options.demoPlayers, rotateStatements: options.rotateStatements });

  return {
    db,
    now,
    log,
    environment: options.environment,
    limits,
    today,
    sinceMidnight,
    generation,
    onGenerationChange: (fn) => {
      generationListeners.add(fn);
    },
    players,
    hashKey,
    hit,
    readHit,
    hitAddress,
    readHitAddress,
    peerHit,
    spendReplays,
    readJson,
    playerIdOf,
    ensureSchema,
  };
}
