import { createServer, type IncomingMessage, type Server } from "node:http";
import { Readable } from "node:stream";
import type { createApi } from "./api";
import { consoleLog } from "./log";

export interface NodeServerOptions {
  /**
   * Derrière un ou plusieurs proxys (Cloud Run, nginx, Caddy, Cloudflare Tunnel…) : l'adresse du client est lue dans `X-Forwarded-For`.
   * Nombre de proxys de confiance (`true` = 1). Chaque proxy **ajoute** l'adresse qu'il a vue à la fin de la liste : seule la fin est
   * fiable (le début est ce que le client a écrit lui-même, donc falsifiable : il ferait tomber la limite de débit). On compte donc
   * `trustProxy` entrées depuis la droite.
   */
  trustProxy?: boolean | number;
}

/** Adresse du client d'après `X-Forwarded-For`, en comptant `hops` proxys de confiance depuis la droite. */
export function clientFromForwarded(header: string | string[] | undefined, hops: number): string | undefined {
  const text = Array.isArray(header) ? header.join(",") : header;
  const parts = text?.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts?.length || hops < 1) return undefined;
  return parts[Math.max(0, parts.length - hops)];
}

function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://${host}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream, duplex: "half" } : {}),
  } as RequestInit);
}

/** Serveur HTTP Node autour du cœur de l'API : convertit les requêtes Node en `Request` standard. */
export function createNodeServer(api: ReturnType<typeof createApi>, options: NodeServerOptions = {}): Server {
  return createServer(async (req, res) => {
    try {
      const hops = options.trustProxy === true ? 1 : options.trustProxy || 0;
      const clientKey = (hops ? clientFromForwarded(req.headers["x-forwarded-for"], hops) : undefined) ?? req.socket.remoteAddress ?? undefined;
      const response = await api.handle(toRequest(req), { clientKey });
      const headers = Object.fromEntries(response.headers);
      // Corps refusé sans avoir été lu en entier : on ferme la connexion plutôt que de la réutiliser.
      if (response.status === 413) headers["connection"] = "close";
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      consoleLog("ERROR", "erreur serveur", { error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "inconnue" });
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal", message: "Erreur interne" }));
    }
  });
}
