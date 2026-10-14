import type { SqlDb, SqlValue } from "./db";

/** Le sous-ensemble de l'API D1 de Cloudflare dont on se sert (évite de dépendre de `@cloudflare/workers-types`). */
export interface D1Like {
  batch?(statements: unknown[]): Promise<unknown>;
  prepare(sql: string): {
    bind(...values: SqlValue[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

export function d1Db(d1: D1Like): SqlDb {
  return {
    async run(sql, params = []) {
      await d1.prepare(sql).bind(...params).run();
    },
    first<T>(sql: string, params: SqlValue[] = []) {
      return d1.prepare(sql).bind(...params).first<T>();
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return (await d1.prepare(sql).bind(...params).all<T>()).results;
    },
    ...(d1.batch ? { batch: async (statements: { sql: string; params?: SqlValue[] }[]) => void (await d1.batch!(statements.map((s) => d1.prepare(s.sql).bind(...(s.params ?? []))))) } : {}),
  };
}
