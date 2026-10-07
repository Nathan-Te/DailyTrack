import { createApi } from "./api";
import { d1Db, type D1Like } from "./d1";

// Point d'entrée Cloudflare Workers (+ D1). Voir wrangler.toml.
// ⚠ Rejouer une course et générer un circuit demandent plus que les 10 ms de calcul de l'offre gratuite
//   de Workers : il faut l'offre payante (Workers Paid), ou héberger le serveur Node (server.ts).
interface Env {
  DB: D1Like;
  ALLOW_ORIGIN?: string;
  RATE_SALT?: string;
  /** Secret Wrangler (`wrangler secret put ADMIN_TOKEN`) : jamais dans `wrangler.toml`. */
  ADMIN_TOKEN?: string;
}

let api: ReturnType<typeof createApi> | undefined;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    api ??= createApi({ db: d1Db(env.DB), allowOrigin: env.ALLOW_ORIGIN ?? "*", rateSalt: env.RATE_SALT ?? "", adminToken: env.ADMIN_TOKEN });
    return api.handle(request, { clientKey: request.headers.get("CF-Connecting-IP") ?? undefined });
  },
};
