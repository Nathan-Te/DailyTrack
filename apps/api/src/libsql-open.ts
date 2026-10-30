import { libsqlDb, type LibsqlClientLike } from "./libsql";
import { avecComptage, type ClientCompte } from "./comptage";
import { refusDistantEnTest } from "./distant";

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
export async function openLibsql(config: LibsqlConfig & { comptage?: false }): Promise<ReturnType<typeof libsqlDb>>;
/** Lot R14 : `comptage: true` (base **locale** seulement) compte les lignes lues et écrites par requête (`comptage.ts`) ; `compte` est alors le client compté. */
export async function openLibsql(config: LibsqlConfig & { comptage: true }): Promise<ReturnType<typeof libsqlDb> & { compte: ClientCompte }>;
export async function openLibsql(config: LibsqlConfig & { comptage?: boolean }) {
  const local = config.url.startsWith("file:") || config.url === ":memory:";
  // Lot R14 : un test (Vitest pose `VITEST`) n'ouvre jamais une base distante — ni Turso, ni aucun hôte hors de la machine.
  const refus = process.env.VITEST ? refusDistantEnTest(config.url) : null;
  if (refus) throw new Error(refus);
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
  if (config.comptage) {
    if (!local) throw new Error("comptage : base locale (file:) seulement — le client HTTP de Turso n'a pas de compteurs.");
    const compte = avecComptage(client);
    return Object.assign(libsqlDb(compte), { compte });
  }
  return libsqlDb(client);
}
