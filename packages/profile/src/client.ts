// Ce que le profil demande au serveur de la plateforme (lot 30 de DailyTrack, extrait au lot P0 sans changement) : le profil (`GET /api/me`),
// la vérification d'un pseudo (`GET /api/name`), le changement de pseudo (`PUT /api/player`) et « Changer mon code » (`POST /api/me/code`).
// **L'identifiant secret voyage dans l'en-tête `X-Player-Id`**, jamais dans l'adresse (qui finit dans les journaux de l'hébergeur) — sauf
// `PUT /api/player`, qui le porte dans son corps comme avant le lot 30.
//
// Le réseau est injecté (`fetch` par défaut, lu à chaque appel : les tests le remplacent) : le module se teste sans navigateur. Un jeu marche
// sans serveur : un échec est une valeur (`ApiResult`), jamais une exception.

/** Échec d'un appel. `suggestions` : pseudos libres proposés par le serveur quand le pseudo choisi est déjà pris (`name_taken`). */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; status: number; suggestions?: string[] };

/** Ce qu'il faut de `fetch`. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Médaille d'un jour, comme le serveur la calcule. */
type DayMedal = "author" | "gold" | "silver" | "bronze" | null;

/**
 * Le profil vu par le serveur (`GET /api/me`) : le jeu s'y synchronise, son stockage local n'en est qu'un cache. Aujourd'hui ce sont les temps
 * de DailyTrack (le profil par jeu arrive au lot P2).
 */
export interface MeProfile {
  name: string;
  /** Vrai pour un compte renommé par la migration des doublons : on lui propose de choisir un nouveau pseudo. */
  renameRequired: boolean;
  /** Date « aujourd'hui » du serveur (Paris). */
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

export const TIMEOUT_MS = 8000;

/** Un appel à l'API : délai borné, erreurs traduites, suggestions de pseudo gardées. Ne lève jamais. */
export async function call<T>(base: string, method: string, path: string, body?: unknown, timeoutMs = TIMEOUT_MS, headers?: Record<string, string>, fetchImpl?: FetchLike): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      ...(body !== undefined || headers ? { headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers } } : {}),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    const res = await (fetchImpl ? fetchImpl(base + path, init) : fetch(base + path, init));
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

/** Le profil côté serveur : ce que la synchronisation, le pseudo et le code demandent. */
export interface ProfileApi {
  /** Profil du joueur. L'identifiant secret voyage dans un en-tête, jamais dans l'adresse. */
  me(playerId: string): Promise<ApiResult<MeProfile>>;
  /** Le pseudo est-il libre (ou déjà à ce joueur) ? */
  checkName(name: string, playerId: string): Promise<ApiResult<NameCheck>>;
  /** Change le pseudo d'un joueur que le serveur connaît (refus `name_taken` avec suggestions). */
  rename(playerId: string, name: string): Promise<ApiResult<{ name: string }>>;
  /** « Changer mon code » : le profil passe à `newId`, `oldId` est révoqué. */
  rotateCode(oldId: string, newId: string): Promise<ApiResult<{ rotated: true }>>;
}

export class ProfileClient implements ProfileApi {
  constructor(
    protected readonly base: string,
    protected readonly fetchImpl?: FetchLike,
  ) {}

  protected call<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResult<T>> {
    return call<T>(this.base, method, path, body, TIMEOUT_MS, headers, this.fetchImpl);
  }

  me(playerId: string) {
    return this.call<MeProfile>("GET", "/api/me", undefined, { "X-Player-Id": playerId });
  }

  checkName(name: string, playerId: string) {
    return this.call<NameCheck>("GET", `/api/name?name=${encodeURIComponent(name)}`, undefined, { "X-Player-Id": playerId });
  }

  rename(playerId: string, name: string) {
    return this.call<{ name: string }>("PUT", "/api/player", { playerId, name });
  }

  rotateCode(oldId: string, newId: string) {
    return this.call<{ rotated: true }>("POST", "/api/me/code", { newId }, { "X-Player-Id": oldId });
  }
}
