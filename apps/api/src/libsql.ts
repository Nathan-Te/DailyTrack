import type { SqlDb, SqlValue } from "./db";

/** Le sous-ensemble du client `@libsql/client` dont on se sert (le client lui-même est chargé à la demande : voir `libsql-open.ts`). */
export interface LibsqlClientLike {
  execute(stmt: { sql: string; args: SqlValue[] }): Promise<{ columns: string[]; rows: ArrayLike<unknown>[]; rowsAffected: number }>;
  batch(stmts: { sql: string; args: SqlValue[] }[], mode?: "write" | "read" | "deferred"): Promise<unknown>;
  close(): void;
}

/** Compteurs de la base (script de mesure du budget : une instruction = un aller-retour réseau vers Turso). */
export interface LibsqlStats {
  statements: number;
  /** Lignes touchées par les écritures (`rowsAffected`) : le minimum facturé par Turso (les index peuvent en ajouter). */
  rowsWritten: number;
  /** Aller-retour réseau : une instruction seule ou un lot complet. */
  roundTrips: number;
}

/**
 * `SqlDb` sur libSQL : Turso en production (HTTP, sans connexion qui dure), un fichier libSQL en local et dans les tests. Mêmes
 * requêtes que SQLite et D1 (libSQL est un SQLite) : le cœur de l'API n'en sait rien.
 */
export function libsqlDb(client: LibsqlClientLike): SqlDb & { close(): void; stats: LibsqlStats } {
  const stats: LibsqlStats = { statements: 0, rowsWritten: 0, roundTrips: 0 };

  async function query(sql: string, params: SqlValue[]) {
    stats.statements++;
    stats.roundTrips++;
    let res;
    try {
      res = await client.execute({ sql, args: params });
    } catch (e) {
      // Une lecture se rejoue sans danger après une coupure réseau passagère ; une écriture, jamais à l'aveugle.
      if (!/^\s*select\b/i.test(sql) || !isNetworkError(e)) throw e;
      res = await client.execute({ sql, args: params });
    }
    stats.rowsWritten += res.rowsAffected;
    return res;
  }

  return {
    stats,
    async run(sql, params = []) {
      await query(sql, params);
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      const res = await query(sql, params);
      return res.rows.length ? (named(res.columns, res.rows[0]!) as T) : null;
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const res = await query(sql, params);
      return res.rows.map((r) => named(res.columns, r) as T);
    },
    async batch(statements) {
      stats.statements += statements.length;
      stats.roundTrips++;
      await client.batch(
        statements.map((s) => ({ sql: s.sql, args: s.params ?? [] })),
        "write",
      );
    },
    close() {
      client.close();
    },
  };
}

/** Une ligne libSQL est indexée par position *et* par nom ; on rend un objet simple, comme `node:sqlite` et D1. */
function named(columns: string[], row: ArrayLike<unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) out[columns[i]!] = row[i];
  return out;
}

function isNetworkError(e: unknown): boolean {
  const text = `${(e as { code?: string })?.code ?? ""} ${(e as Error)?.message ?? ""} ${((e as Error)?.cause as Error | undefined)?.message ?? ""}`;
  return /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket hang up|network/i.test(text);
}
