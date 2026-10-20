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

/**
 * Lot R5 : l'**adresse de connexion**, la dernière entrée de `X-Forwarded-For`. Le frontal de Google (Cloud Run) y écrit l'adresse qui lui
 * a ouvert la connexion : l'appelant lui-même pour un appel direct à `run.app`, un relais de Firebase sinon. Elle n'est jamais écrite par le
 * client (ce qu'il envoie se retrouve **avant**). Sans en-tête : l'adresse du socket.
 */
export function peerFromForwarded(header: string | string[] | undefined): string | undefined {
  return clientFromForwarded(header, 1);
}

/**
 * Lot R5 : une adresse IP **publique** (routée sur Internet) ? Une adresse de connexion qui ne l'est pas (`0.0.0.0`, privée, locale,
 * réservée) ne désigne personne : mesuré sur la recette, un appel qui arrive à Cloud Run par le réseau interne de Google y porte `0.0.0.0`,
 * et les appels de Firebase Hosting peuvent arriver ainsi (tous les joueurs auraient alors la même adresse de connexion). Elle n'est pas
 * comptée. Un appel direct depuis Internet porte toujours l'adresse publique de l'appelant.
 */
export function isPublicAddress(ip: string): boolean {
  let a = ip.trim().toLowerCase();
  if (a.startsWith("[") && a.includes("]")) a = a.slice(1, a.indexOf("]"));
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) a = mapped[1]!;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::\d+)?$/.exec(a);
  if (v4) {
    const [x, y] = [Number(v4[1]), Number(v4[2])];
    if ([x, y, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return false;
    if (x === 0 || x === 10 || x === 127 || x >= 224) return false; // « ce réseau », privé, boucle locale, multidiffusion et réservé
    if (x === 100 && y >= 64 && y <= 127) return false; // 100.64.0.0/10 (partagé, opérateurs)
    if (x === 169 && y === 254) return false; // lien local
    if (x === 172 && y >= 16 && y <= 31) return false;
    if (x === 192 && y === 168) return false;
    return true;
  }
  if (!a.includes(":")) return false;
  if (a === "::" || a === "::1") return false;
  if (/^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith("ff")) return false; // privé (fc00::/7), lien local, multidiffusion
  return /^[0-9a-f:]+$/.test(a);
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
      // Lot R5 : avec un proxy de confiance, l'adresse de connexion (dernière entrée, écrite par le proxy) compte aussi dans chaque limite par
      // adresse : avec `TRUST_PROXY` ≥ 2, `clientKey` peut être inventée par un appel direct, pas elle.
      const peer = hops ? (peerFromForwarded(req.headers["x-forwarded-for"]) ?? req.socket.remoteAddress ?? undefined) : undefined;
      const peerKey = peer !== undefined && isPublicAddress(peer) ? peer : undefined;
      const response = await api.handle(toRequest(req), { clientKey, peerKey });
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
