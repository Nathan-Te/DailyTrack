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

/** Échec d'un appel. `suggestions` : pseudos libres proposés par le serveur quand le pseudo choisi est déjà pris (`name_taken`). */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; status: number; suggestions?: string[] };

/** Médaille d'un jour, comme le serveur la calcule. */
type DayMedal = BoardRow["medal"];

/** Le profil vu par le serveur (`GET /api/me`) : le jeu s'y synchronise, son stockage local n'en est qu'un cache. */
export interface MeProfile {
  name: string;
  /** Vrai pour un compte renommé par la migration des doublons : on lui propose de choisir un nouveau pseudo. */
  renameRequired: boolean;
  /** Date « aujourd'hui » du serveur (UTC). */
  today: string;
  simVersion: number;
  stats: {
    days: number;
    medals: { author: number; gold: number; silver: number; bronze: number };
    bestRank: { date: string; rank: number; participants: number } | null;
    streak: number;
  };
  /** Meilleur temps d'aujourd'hui avec sa rediffusion (fantôme « ton record »), ou `null`. */
  best: { date: string; trackId: string | null; ms: number; medal: DayMedal; splits: number[]; replay?: string; simVersion?: number } | null;
  /** Meilleur temps de chaque jour passé (médailles des archives). */
  past: { date: string; trackId: string | null; ms: number; medal: DayMedal }[];
}

export type NameCheck = { available: true } | { available: false; suggestions: string[] };

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

async function call<T>(base: string, method: string, path: string, body?: unknown, timeoutMs = TIMEOUT_MS, headers?: Record<string, string>): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(base + path, {
      method,
      signal: controller.signal,
      ...(body !== undefined || headers ? { headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers } } : {}),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string; suggestions?: unknown } | null;
    // Corps vide sur un 200 : la page se décharge (la lecture est coupée) ou un intermédiaire a avalé la réponse. Pas une réponse : une panne réseau.
    if (res.ok) return json === null ? { ok: false, status: 0, code: "network", message: "Réponse illisible du serveur" } : { ok: true, data: json as T };
    const suggestions = Array.isArray(json?.suggestions) ? json!.suggestions.filter((x): x is string => typeof x === "string") : [];
    return { ok: false, status: res.status, code: json?.error ?? "http_error", message: json?.message ?? `Erreur ${res.status}`, ...(suggestions.length ? { suggestions } : {}) };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return { ok: false, status: 0, code: aborted ? "timeout" : "network", message: aborted ? "Le serveur ne répond pas" : "Classement injoignable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Appel brut à l'API (planning, admin) : même gestion des erreurs et du délai que les routes du classement. */
export const apiCall = call;

/** Ce que le jeu demande à un classement : l'API réelle (`LeaderboardApi`) ou le jeu de données statique du mode démo. */
export interface LeaderboardSource {
  submit(playerId: string, name: string | null, date: string, replay: string): Promise<ApiResult<SubmitResult>>;
  rename(playerId: string, name: string): Promise<ApiResult<{ name: string }>>;
  leaderboard(date: string, playerId: string, limit?: number): Promise<ApiResult<Leaderboard>>;
  ghost(date: string, kind: "first" | "ahead", playerId: string): Promise<ApiResult<GhostData>>;
  /** Profil du joueur (lot 30). L'identifiant secret voyage dans un en-tête, jamais dans l'adresse. */
  me(playerId: string): Promise<ApiResult<MeProfile>>;
  /** Le pseudo est-il libre (ou déjà à ce joueur) ? */
  checkName(name: string, playerId: string): Promise<ApiResult<NameCheck>>;
  /** « Changer mon code » : le profil passe à `newId`, `oldId` est révoqué. */
  rotateCode(oldId: string, newId: string): Promise<ApiResult<{ rotated: true }>>;
}

/** `?api=demo` : le jeu lit le jeu de données statique de `public/demo/` au lieu d'une API (voir `demo.ts`). */
export const DEMO_BASE = "demo";

export class LeaderboardApi implements LeaderboardSource {
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

  me(playerId: string) {
    return call<MeProfile>(this.base, "GET", "/api/me", undefined, TIMEOUT_MS, { "X-Player-Id": playerId });
  }

  checkName(name: string, playerId: string) {
    return call<NameCheck>(this.base, "GET", `/api/name?name=${encodeURIComponent(name)}`, undefined, TIMEOUT_MS, { "X-Player-Id": playerId });
  }

  rotateCode(oldId: string, newId: string) {
    return call<{ rotated: true }>(this.base, "POST", "/api/me/code", { newId }, TIMEOUT_MS, { "X-Player-Id": oldId });
  }
}
