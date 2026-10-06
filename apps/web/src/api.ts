// Client de l'API du classement. Le jeu fonctionne sans elle : si elle n'est pas configurée ou injoignable,
// on le dit poliment et on continue (le classement est un plus, pas un prérequis).

export interface BoardRow {
  rank: number;
  name: string;
  ms: number;
  medal: "author" | "gold" | "silver" | "bronze" | null;
}

export interface Leaderboard {
  date: string;
  participants: number;
  top: BoardRow[];
  me: BoardRow | null;
}

export interface SubmitResult {
  accepted: true;
  improved: boolean;
  ms: number;
  splits: number[];
  respawns: number;
  bestMs: number;
  rank: number;
  participants: number;
  medal: BoardRow["medal"];
}

export interface GhostData {
  name: string;
  rank: number;
  ms: number;
  splits: number[];
  replay: string;
  simVersion: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; status: number };

/**
 * Adresse de l'API : `?api=https://…` (essais), sinon `VITE_API_URL` (fixée à la construction du jeu), sinon
 * rien : le classement est alors désactivé.
 */
export function apiBase(search = location.search, env = import.meta.env.VITE_API_URL as string | undefined): string | null {
  const fromUrl = new URLSearchParams(search).get("api");
  const base = fromUrl || env || "";
  return base ? base.replace(/\/+$/, "") : null;
}

const TIMEOUT_MS = 8000;

async function call<T>(base: string, method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(base + path, {
      method,
      signal: controller.signal,
      ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (res.ok) return { ok: true, data: json as T };
    return { ok: false, status: res.status, code: json?.error ?? "http_error", message: json?.message ?? `Erreur ${res.status}` };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return { ok: false, status: 0, code: aborted ? "timeout" : "network", message: aborted ? "Le serveur ne répond pas" : "Classement injoignable" };
  } finally {
    clearTimeout(timer);
  }
}

export class LeaderboardApi {
  constructor(private readonly base: string) {}

  submit(playerId: string, name: string | null, date: string, replay: string) {
    return call<SubmitResult>(this.base, "POST", "/api/submit", { playerId, ...(name ? { name } : {}), date, replay });
  }

  rename(playerId: string, name: string) {
    return call<{ name: string }>(this.base, "PUT", "/api/player", { playerId, name });
  }

  leaderboard(date: string, playerId: string, limit = 10) {
    return call<Leaderboard>(this.base, "GET", `/api/day/${date}/leaderboard?limit=${limit}&player=${playerId}`);
  }

  ghost(date: string, kind: "first" | "ahead", playerId: string) {
    return call<GhostData>(this.base, "GET", `/api/day/${date}/ghost?kind=${kind}&player=${playerId}`);
  }
}
