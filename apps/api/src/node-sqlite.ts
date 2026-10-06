import { DatabaseSync } from "node:sqlite";
import type { SqlDb, SqlValue } from "./db";

/** SQLite embarqué dans Node (`node:sqlite`) : serveur Docker et tests. Même moteur que D1. */
export function openSqlite(path: string): SqlDb & { close(): void } {
  const db = new DatabaseSync(path);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return {
    async run(sql, params = []) {
      db.prepare(sql).run(...(params as SqlValue[]));
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    close() {
      db.close();
    },
  };
}
