import { libsqlDb, type LibsqlClientLike } from "./libsql";

export interface LibsqlConfig {
  /** `libsql://….turso.io` ou `https://…` (Turso, sqld), `file:chemin` ou `:memory:` (local, tests). */
  url: string;
  authToken?: string;
}

/**
 * Ouvre la base libSQL.
 * - **Distante** (Turso) : client HTTP pur JavaScript, sans connexion qui dure (adapté à un conteneur qui s'éteint et se réveille).
 *   `libsql://` est lu comme `https://` pour cette raison. Il est embarqué dans le paquet du serveur.
 * - **Locale** (`file:`) : client natif de `@libsql/client`, chargé à la demande (développement et tests ; absent de l'image Docker).
 */
export async function openLibsql(config: LibsqlConfig) {
  const local = config.url.startsWith("file:") || config.url === ":memory:";
  let client: LibsqlClientLike;
  if (local) {
    const name = "@libsql/client"; // spécificateur non littéral : esbuild ne l'embarque pas (module natif)
    const mod = (await import(/* @vite-ignore */ name)) as { createClient(c: unknown): LibsqlClientLike };
    client = mod.createClient({ url: config.url });
  } else {
    const { createClient } = await import("@libsql/client/http");
    const url = config.url.replace(/^libsql:/, "https:");
    client = createClient({ url, authToken: config.authToken || undefined }) as unknown as LibsqlClientLike;
  }
  return libsqlDb(client);
}
