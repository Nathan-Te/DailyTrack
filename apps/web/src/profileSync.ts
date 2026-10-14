import { SIM_VERSION } from "@cdj/sim";
import type { ApiResult, LeaderboardSource, MeProfile } from "./api";
import { clearNextId, pendingNextId } from "./identity";
import { rememberRank } from "./profile";
import type { BestRun } from "./records";

// Synchronisation du profil (lot 30) : le serveur fait foi, le stockage du navigateur n'est qu'un cache.
//
//   - au lancement et au retour sur l'accueil, le jeu demande son profil au serveur (`GET /api/me`) et le fusionne avec le cache local ;
//   - fusion : le meilleur temps gagne. Un temps du serveur meilleur que le local le remplace (avec sa rediffusion : le fantôme « ton record » suit),
//     un record local meilleur que celui du serveur (fait hors ligne, jamais envoyé) reste, et le jeu l'envoie au serveur, qui le rejoue ;
//   - le pseudo du serveur remplace le pseudo local ; une place vue plus haute que celles du cache est retenue ;
//   - hors ligne, le cache local sert et le jeu le dit discrètement ; un code révoqué (« Changer mon code » fait ailleurs) est signalé.
// La fusion (`mergeProfile`) est pure : le stockage est injecté, elle se teste sans navigateur.

type Store = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

const BEST = "cdj:best:";
const SUB = "cdj:sub:";
const NAME_KEY = "cdj:name";
const DAY_TRACK = /^jour-\d{4}-\d{2}-\d{2}-g\d{1,3}(-v\d{1,2})?(-[a-z]{3,12})?$/;

export interface MergeResult {
  /** Le pseudo local a changé (changé sur un autre appareil, ou renommé par la migration). */
  nameChanged: boolean;
  /** Le record d'aujourd'hui est maintenant celui du serveur (meilleur que le local, ou le local n'avait pas sa rediffusion). */
  todayChanged: boolean;
  /** Jours passés écrits ou améliorés (médailles des archives). */
  pastChanged: number;
}

function readRecord(storage: Store, trackId: string): BestRun | null {
  try {
    const r = JSON.parse(storage.getItem(BEST + trackId) ?? "null") as BestRun | null;
    return r && typeof r.ms === "number" && Number.isFinite(r.ms) ? r : null;
  } catch {
    return null;
  }
}

/**
 * Fusionne le profil du serveur dans le cache local. Écrit seulement ce qui est meilleur côté serveur ; ne supprime jamais un record local (un temps
 * fait hors ligne attend d'être envoyé). `cdj:sub:<circuit>` (« meilleur temps confirmé par le serveur ») prend la valeur du serveur : tant qu'un record local
 * lui est meilleur, `needsSubmit` reste vrai et le jeu l'envoie.
 */
export function mergeProfile(me: MeProfile, storage: Store): MergeResult {
  const result: MergeResult = { nameChanged: false, todayChanged: false, pastChanged: 0 };
  try {
    if (me.name && storage.getItem(NAME_KEY) !== me.name) {
      storage.setItem(NAME_KEY, me.name);
      result.nameChanged = true;
    }
  } catch {
    /* stockage refusé : le cache ne se remplit pas, le serveur reste la vérité */
  }

  const t = me.best;
  if (t && t.trackId && DAY_TRACK.test(t.trackId) && Number.isFinite(t.ms) && t.ms > 0) {
    try {
      const local = readRecord(storage, t.trackId);
      const usable = t.replay !== undefined && t.simVersion === SIM_VERSION;
      const better = !local || t.ms < local.ms || (t.ms === local.ms && !local.replay && usable);
      if (better && (usable || !local)) {
        const rec: BestRun = { ms: t.ms, splits: t.splits, simVersion: usable ? SIM_VERSION : (t.simVersion ?? 0), medal: t.medal ?? null, ...(usable ? { replay: t.replay } : {}) };
        storage.setItem(BEST + t.trackId, JSON.stringify(rec));
        result.todayChanged = true;
      }
      storage.setItem(SUB + t.trackId, String(t.ms));
    } catch {
      /* tant pis */
    }
  }

  for (const p of me.past) {
    if (!p.trackId || !DAY_TRACK.test(p.trackId) || !Number.isFinite(p.ms) || p.ms <= 0) continue;
    try {
      const local = readRecord(storage, p.trackId);
      if (local && local.ms <= p.ms) continue;
      // Un jour passé : le temps et la médaille suffisent (les archives les montrent) ; pas de rediffusion, donc pas de fantôme « ton record ».
      const rec: BestRun = { ms: p.ms, splits: [], simVersion: SIM_VERSION, medal: p.medal ?? null };
      storage.setItem(BEST + p.trackId, JSON.stringify(rec));
      result.pastChanged++;
    } catch {
      /* tant pis */
    }
  }

  const best = me.stats.bestRank;
  if (best) rememberRank(best.date, { rank: best.rank, participants: best.participants }, storage);
  return result;
}

// --- Le service ---------------------------------------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "ok" | "offline" | "revoked" | "unknown" | "disabled";

export interface SyncState {
  status: SyncStatus;
  /** Heure de la dernière synchronisation réussie (ms), ou `null`. */
  at: number | null;
  /** Le serveur connaît ce profil (vrai), ne le connaît pas encore (faux : jamais classé), ou on ne sait pas (`null`). */
  known: boolean | null;
  /** Compte renommé par la migration des doublons : proposer un nouveau pseudo. */
  renameRequired: boolean;
  /** Statistiques vues par le serveur (le cache n'en a qu'une partie). */
  stats: MeProfile["stats"] | null;
  /** Un envoi fait en arrière-plan a été refusé parce que le pseudo est déjà pris : la carte du profil propose d'en choisir un autre ou de charger son code. */
  nameProblem: { message: string; suggestions: string[] } | null;
  /** Pourquoi la dernière synchronisation a échoué (« 0:timeout », « 500:internal »…), pour le diagnostic ; jamais montré au joueur. */
  error: string | null;
}

export interface SyncDeps {
  /** L'API du classement, ou `null` (aucun serveur, démonstration) : rien n'est alors synchronisé. */
  api: () => LeaderboardSource | null;
  playerId: () => string;
  /** Adopte un autre identifiant (un « Changer mon code » dont la réponse s'était perdue). */
  adopt: (id: string) => void;
  storage: Store;
  now?: () => number;
  /** Écart minimal entre deux synchronisations (30 s) : revenir dix fois à l'accueil ne fait pas dix requêtes. */
  minGapMs?: number;
}

export interface SyncOutcome {
  status: SyncStatus;
  /** `null` si rien n'a été fusionné (hors ligne, code révoqué, trop tôt…). */
  merged: MergeResult | null;
  /** Une synchronisation a eu lieu (sinon l'écart minimal n'était pas écoulé). */
  ran: boolean;
}

export const SYNC_GAP_MS = 30_000;

export class ProfileSync {
  state: SyncState = { status: "idle", at: null, known: null, renameRequired: false, stats: null, nameProblem: null, error: null };
  private readonly listeners = new Set<() => void>();
  private inflight: Promise<SyncOutcome> | null = null;
  private lastTry = Number.NEGATIVE_INFINITY;

  constructor(private readonly deps: SyncDeps) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Oublie ce qu'on savait (identité changée : le prochain `run` repart de zéro). */
  reset(): void {
    this.lastTry = Number.NEGATIVE_INFINITY;
    this.set({ status: "idle", at: null, known: null, renameRequired: false, stats: null, nameProblem: null, error: null });
  }

  /** Marque le profil comme connu du serveur (une course vient d'être classée) ou comme renommé (le pseudo a été choisi). */
  noteServerKnows(known = true): void {
    this.set({ known });
  }

  noteRenamed(): void {
    this.set({ renameRequired: false, nameProblem: null });
  }

  noteNameProblem(problem: SyncState["nameProblem"]): void {
    this.set({ nameProblem: problem });
  }

  /** Synchronise (au plus une fois par `minGapMs`, sauf `force`). Plusieurs appels simultanés n'en font qu'un. */
  run(options: { force?: boolean } = {}): Promise<SyncOutcome> {
    if (this.inflight) return this.inflight;
    const now = (this.deps.now ?? Date.now)();
    const api = this.deps.api();
    if (!api) return Promise.resolve({ status: "disabled", merged: null, ran: false });
    if (!options.force && now - this.lastTry < (this.deps.minGapMs ?? SYNC_GAP_MS)) return Promise.resolve({ status: this.state.status, merged: null, ran: false });
    this.lastTry = now;
    this.set({ status: "syncing" });
    this.inflight = this.go(api, now).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async go(api: LeaderboardSource, now: number): Promise<SyncOutcome> {
    let r: ApiResult<MeProfile> = await api.me(this.deps.playerId());
    if (!r.ok && r.code === "code_revoked") {
      // Notre propre « Changer mon code » a peut-être réussi sans que la réponse nous parvienne : le nouvel identifiant est gardé exactement pour ce cas.
      const next = pendingNextId();
      if (next) {
        const again = await api.me(next);
        if (again.ok) {
          this.deps.adopt(next);
          clearNextId();
          r = again;
        }
      }
    }
    if (r.ok) {
      const merged = mergeProfile(r.data, this.deps.storage);
      this.set({ status: "ok", at: now, known: true, renameRequired: r.data.renameRequired, stats: r.data.stats, error: null });
      return { status: "ok", merged, ran: true };
    }
    if (r.code === "code_revoked") {
      this.set({ status: "revoked", known: null });
      return { status: "revoked", merged: null, ran: true };
    }
    if (r.code === "unknown_player") {
      this.set({ status: "unknown", known: false, renameRequired: false, stats: null });
      return { status: "unknown", merged: null, ran: true };
    }
    // Réseau, délai dépassé, serveur en panne : le cache local sert, sans bruit.
    this.set({ status: "offline", error: `${r.status}:${r.code}` });
    return { status: "offline", merged: null, ran: true };
  }
}
