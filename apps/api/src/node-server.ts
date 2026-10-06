import { createServer, type IncomingMessage, type Server } from "node:http";
import { Readable } from "node:stream";
import type { createApi } from "./api";

export interface NodeServerOptions {
  /** Derrière un proxy (nginx, Caddy, Cloudflare Tunnel…) : prendre l'adresse du client dans `X-Forwarded-For`. */
  trustProxy?: boolean;
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
      const forwarded = options.trustProxy ? req.headers["x-forwarded-for"] : undefined;
      const clientKey = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ?? req.socket.remoteAddress ?? undefined;
      const response = await api.handle(toRequest(req), { clientKey });
      const headers = Object.fromEntries(response.headers);
      // Corps refusé sans avoir été lu en entier : on ferme la connexion plutôt que de la réutiliser.
      if (response.status === 413) headers["connection"] = "close";
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      console.error("Erreur serveur :", e);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal", message: "Erreur interne" }));
    }
  });
}
