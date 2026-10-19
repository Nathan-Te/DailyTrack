import { parisDay, parisDayStart } from "@cdj/clock";
import { ensureSchemaOn, schemaVersion, type SqlDb } from "./db";
import { HttpError } from "./errors";
import type { Platform, Statement } from "./games";
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

export interface PlatformOptions {
  db: SqlDb;
  now: () => number;
  log: Logger;
  environment: string;
  limits: { windowMs: number; perClient: number; perPlayer: number };
  rateSalt?: string;
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
    if (count === 1) await db.run("DELETE FROM rate WHERE bucket < ?", [bucket - 3]); // ménage au passage
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

  return { db, now, log, environment: options.environment, limits, today, sinceMidnight, players, hashKey, hit, readHit, readJson, playerIdOf, ensureSchema };
}
