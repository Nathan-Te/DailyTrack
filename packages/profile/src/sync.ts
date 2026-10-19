import type { ApiResult, MeProfile } from "./client";
import { NAME_KEY, type Identity, type KeyValueStore } from "./identity";

// Synchronisation du profil (lot 30 de DailyTrack, extraite au lot P0 sans changement) : le serveur fait foi, le stockage du navigateur n'est
// qu'un cache.
//
//   - au lancement et au retour sur l'accueil, le jeu demande son profil au serveur (`GET /api/me`) et le fusionne avec le cache local ;
//   - fusion « le meilleur gagne » : le pseudo du serveur remplace le local (`mergeName`, commun à la plateforme) ; les temps sont propres à
//     chaque jeu, qui donne sa fusion (`merge` : DailyTrack, `mergeProfile` d'`apps/web/src/profileSync.ts`) ;
//   - hors ligne, le cache local sert et le jeu le dit discrètement ; un code révoqué (« Changer mon code » fait ailleurs) est signalé ;
//   - notre propre « Changer mon code » dont la réponse s'est perdue : l'identifiant gardé (`cdj:player:next`) est adopté.
// Stockage, réseau, identité et horloge sont injectés : le service se teste sans navigateur.

/**
 * La part commune de la fusion : le pseudo du serveur remplace le pseudo local (changé sur un autre appareil, ou renommé par la migration).
 * Rend vrai s'il a changé. Un stockage qui refuse l'écriture ne casse rien (le serveur reste la vérité).
 */
export function mergeName(me: Pick<MeProfile, "name">, storage: KeyValueStore): boolean {
  try {
    if (me.name && storage.getItem(NAME_KEY) !== me.name) {
      storage.setItem(NAME_KEY, me.name);
      return true;
    }
  } catch {
    /* stockage refusé : le cache ne se remplit pas, le serveur reste la vérité */
  }
  return false;
}

export type SyncStatus = "idle" | "syncing" | "ok" | "offline" | "revoked" | "unknown" | "disabled";

/**
 * Ce qu'un profil du serveur doit au moins contenir pour être synchronisé : le pseudo, le drapeau « à renommer » et des statistiques (celles du
 * jeu). Lot P2 : un profil par jeu — `MeProfile` (`GET /api/me`, DailyTrack, le défaut) ou celui d'un autre jeu (`GET /api/jump/me`).
 */
export interface SyncedProfile {
  name: string;
  renameRequired: boolean;
  stats: unknown;
}

export interface SyncState<P extends SyncedProfile = MeProfile> {
  status: SyncStatus;
  /** Heure de la dernière synchronisation réussie (ms), ou `null`. */
  at: number | null;
  /** Le serveur connaît ce profil (vrai), ne le connaît pas encore (faux : jamais classé), ou on ne sait pas (`null`). */
  known: boolean | null;
  /** Compte renommé par la migration des doublons : proposer un nouveau pseudo. */
  renameRequired: boolean;
  /** Statistiques vues par le serveur (le cache n'en a qu'une partie). */
  stats: P["stats"] | null;
  /** Un envoi fait en arrière-plan a été refusé parce que le pseudo est déjà pris : la carte du profil propose d'en choisir un autre ou de charger son code. */
  nameProblem: { message: string; suggestions: string[] } | null;
  /** Pourquoi la dernière synchronisation a échoué (« 0:timeout », « 500:internal »…), pour le diagnostic ; jamais montré au joueur. */
  error: string | null;
}

export interface SyncDeps<M, S extends KeyValueStore = KeyValueStore, P extends SyncedProfile = MeProfile> {
  /** L'API du profil (celle du jeu : `GET /api/me` pour DailyTrack), ou `null` (aucun serveur, démonstration) : rien n'est alors synchronisé. */
  api: () => { me(playerId: string): Promise<ApiResult<P>> } | null;
  playerId: () => string;
  /** Adopte un autre identifiant (un « Changer mon code » dont la réponse s'était perdue). */
  adopt: (id: string) => void;
  storage: S;
  /** La fusion du jeu (le meilleur gagne) ; son résultat est rendu tel quel. */
  merge: (me: P, storage: S) => M;
  /** Le « Changer mon code » en cours (`cdj:player:next`). */
  identity: Pick<Identity, "pendingNextId" | "clearNextId">;
  now?: () => number;
  /** Écart minimal entre deux synchronisations (30 s) : revenir dix fois à l'accueil ne fait pas dix requêtes. */
  minGapMs?: number;
}

export interface SyncOutcome<M> {
  status: SyncStatus;
  /** `null` si rien n'a été fusionné (hors ligne, code révoqué, trop tôt…). */
  merged: M | null;
  /** Une synchronisation a eu lieu (sinon l'écart minimal n'était pas écoulé). */
  ran: boolean;
}

export const SYNC_GAP_MS = 30_000;

export class ProfileSync<M, S extends KeyValueStore = KeyValueStore, P extends SyncedProfile = MeProfile> {
  state: SyncState<P> = { status: "idle", at: null, known: null, renameRequired: false, stats: null, nameProblem: null, error: null };
  private readonly listeners = new Set<() => void>();
  private inflight: Promise<SyncOutcome<M>> | null = null;
  private lastTry = Number.NEGATIVE_INFINITY;

  constructor(private readonly deps: SyncDeps<M, S, P>) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncState<P>>): void {
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

  noteNameProblem(problem: SyncState<P>["nameProblem"]): void {
    this.set({ nameProblem: problem });
  }

  /** Synchronise (au plus une fois par `minGapMs`, sauf `force`). Plusieurs appels simultanés n'en font qu'un. */
  run(options: { force?: boolean } = {}): Promise<SyncOutcome<M>> {
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

  private async go(api: { me(playerId: string): Promise<ApiResult<P>> }, now: number): Promise<SyncOutcome<M>> {
    let r: ApiResult<P> = await api.me(this.deps.playerId());
    if (!r.ok && r.code === "code_revoked") {
      // Notre propre « Changer mon code » a peut-être réussi sans que la réponse nous parvienne : le nouvel identifiant est gardé exactement pour ce cas.
      const next = this.deps.identity.pendingNextId();
      if (next) {
        const again = await api.me(next);
        if (again.ok) {
          this.deps.adopt(next);
          this.deps.identity.clearNextId();
          r = again;
        }
      }
    }
    if (r.ok) {
      const merged = this.deps.merge(r.data, this.deps.storage);
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
