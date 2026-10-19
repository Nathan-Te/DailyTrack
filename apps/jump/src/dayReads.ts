import type { ApiResult } from "@cdj/profile";
import type { FirstGhostData } from "./firstGhost";
import type { JumpMe } from "./jumpProfile";
import type { DeathMapData, JumpBoard, RankSource } from "./rankApi";

// Les lectures du jour, côté jeu (lot P4 de la plateforme), **sans DOM** (testé sous Node) : moins de requêtes. Le classement, le fantôme du
// premier et la carte des morts arrivent ensemble, en **une** requête (`GET /api/jump/day/<date>/bundle`) — avec le profil DailyJump du jour
// quand une identité existe — au lieu de quatre. Cloud Run facture les requêtes (2 M par mois gratuites, partagées avec DailyTrack), pré-vols
// CORS compris : une seule adresse personnelle par jour, un seul pré-vol (OPTIONS) par 2 heures.
//
//   - **Jamais deux lectures du même jour en moins de 30 s** (`READ_FRESH_MS`) : la réponse gardée sert (le profil aussi, pour la
//     synchronisation, `profile`). Une lecture en cours est partagée par tous ceux qui la demandent.
//   - **À l'arrivée**, relu seulement si la dernière lecture a plus de 3 minutes (`ARRIVAL_REFRESH_MS` : la carte n'est pas recalculée plus
//     souvent par le serveur) ; ton rang, lui, vient de la réponse de ton envoi (`board`) : rien à relire après un envoi.
//   - `force` : une lecture voulue malgré tout (le premier a changé d'après la réponse d'un envoi) ; le navigateur revalide (`no-cache`).
//   - Un serveur d'avant le lot P4 (404 `not_found` sur `bundle`) : les routes séparées, comme avant.
//   - Un échec est une valeur, jamais une exception, et n'est pas gardé : le jeu ne bloque jamais, la prochaine occasion réessaie.
// Chaque lecture réussie est annoncée (`onLoad`) : le classement, le fantôme du premier et les taches de tout le monde se mettent à jour,
// quelle que soit la raison de la lecture.

/** Écart minimal entre deux lectures d'un même jour (ms). */
export const READ_FRESH_MS = 30_000;
/** À l'arrivée : relire seulement si la dernière lecture a plus de 3 minutes (le rythme de la carte des morts côté serveur). */
export const ARRIVAL_REFRESH_MS = 3 * 60_000;

/** `GET /api/jump/day/<date>/bundle` : classement, fantôme du premier (`null` sans classé), carte des morts, et le profil (jour en cours, identifiant). */
export interface DayBundle {
  date: string;
  open: boolean;
  board: JumpBoard;
  ghost: FirstGhostData | null;
  deaths: DeathMapData;
  /** Le profil DailyJump (jour en cours, avec un identifiant), ou `null` avec sa raison (`unknown_player`, `code_revoked`). */
  profile?: JumpMe | null;
  profileError?: string;
}

export interface LoadOptions {
  /** Âge maximal de la lecture gardée (défaut : `READ_FRESH_MS`). */
  maxAgeMs?: number;
  /** Relire malgré une lecture récente (le navigateur revalide). */
  force?: boolean;
}

interface Kept {
  at: number;
  playerId: string | null;
  data: DayBundle;
}

const fail = <T>(status: number, code: string, message: string): ApiResult<T> => ({ ok: false, status, code, message });

export class DayReads {
  private readonly kept = new Map<string, Kept>();
  private readonly inflight = new Map<string, { playerId: string | null; promise: Promise<ApiResult<DayBundle>> }>();
  private readonly listeners = new Set<(b: DayBundle) => void>();
  /** Le jour dont le profil a été demandé (repli sur les routes séparées seulement : la lecture regroupée le rend d'elle-même). */
  private profileDate: string | null = null;
  /** Requêtes parties (une lecture regroupée = 1 ; repli sur les routes séparées = 3 ou 4) et lectures servies sans réseau. */
  readonly stats = { requests: 0, bundles: 0, served: 0, fallbacks: 0 };

  constructor(private readonly deps: { source: RankSource | null; now(): number }) {}

  get enabled(): boolean {
    return this.deps.source !== null;
  }

  onLoad(fn: (b: DayBundle) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** La dernière lecture réussie d'un jour (et son heure), ou `null`. */
  last(date: string): { at: number; data: DayBundle } | null {
    const k = this.kept.get(date);
    return k ? { at: k.at, data: k.data } : null;
  }

  /** Lit le jour (classement, fantôme, carte ; le profil du jour en cours avec un identifiant), sauf si une lecture assez récente suffit. Ne lève jamais. */
  load(date: string, playerId: string | null, o: LoadOptions = {}): Promise<ApiResult<DayBundle>> {
    const source = this.deps.source;
    if (!source) return Promise.resolve(fail(0, "disabled", "Pas de serveur"));
    const running = this.inflight.get(date);
    if (running && running.playerId === playerId && !o.force) return running.promise;
    const k = this.kept.get(date);
    if (!o.force && k && k.playerId === playerId && this.deps.now() - k.at < (o.maxAgeMs ?? READ_FRESH_MS)) {
      this.stats.served++;
      return Promise.resolve({ ok: true, data: k.data });
    }
    const promise = this.fetch(source, date, playerId, !!o.force).finally(() => {
      if (this.inflight.get(date)?.promise === promise) this.inflight.delete(date);
    });
    this.inflight.set(date, { playerId, promise });
    return promise;
  }

  /**
   * Le profil DailyJump du joueur, pour la synchronisation (`ProfileSync`) : celui de la dernière lecture du jour s'il est assez récent et à cet
   * identifiant, sinon une lecture regroupée avec le profil. Mêmes refus que `GET /api/jump/me` (404 `unknown_player`, 410 `code_revoked`).
   */
  async profile(date: string, playerId: string, o: { force?: boolean } = {}): Promise<ApiResult<JumpMe>> {
    this.profileDate = date;
    const r = await this.load(date, playerId, { force: o.force });
    if (!r.ok) return r;
    if (r.data.profile) return { ok: true, data: r.data.profile };
    if (r.data.profileError === "code_revoked") return fail(410, "code_revoked", "Ce code n'est plus valide : charge le nouveau (Réglages › Profil).");
    if (r.data.profileError === "unknown_player") return fail(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    return fail(0, "no_profile", "Profil absent de la réponse");
  }

  private async fetch(source: RankSource, date: string, playerId: string | null, fresh: boolean): Promise<ApiResult<DayBundle>> {
    let r: ApiResult<DayBundle> | null = null;
    if (source.bundle) {
      this.stats.requests++;
      this.stats.bundles++;
      r = await source.bundle(date, playerId, { fresh });
      // Un serveur d'avant le lot P4 ne connaît pas la route : les routes séparées.
      if (!r.ok && r.status === 404 && r.code === "not_found") r = null;
    }
    r ??= await this.separate(source, date, playerId);
    if (r.ok) {
      this.kept.set(date, { at: this.deps.now(), playerId, data: r.data });
      for (const fn of this.listeners) fn(r.data);
    }
    return r;
  }

  /** Les routes séparées (serveur d'avant le lot P4) : le même contenu, en trois ou quatre requêtes. */
  private async separate(source: RankSource, date: string, playerId: string | null): Promise<ApiResult<DayBundle>> {
    // Le profil, comme la lecture regroupée : avec un identifiant ; le jeu ne le demande que pour le jour en cours (`profile`).
    const withProfile = playerId !== null && this.profileDate === date;
    this.stats.fallbacks++;
    const count = (n: number) => (this.stats.requests += n);
    count(1 + (source.firstGhost ? 1 : 0) + (source.deaths ? 1 : 0) + (withProfile && source.jumpMe ? 1 : 0));
    const [board, ghost, deaths, me] = await Promise.all([
      source.board(date, playerId),
      source.firstGhost ? source.firstGhost(date, playerId) : Promise.resolve(fail<FirstGhostData>(404, "no_ghost", "")),
      source.deaths ? source.deaths(date) : Promise.resolve(null),
      withProfile && playerId && source.jumpMe ? source.jumpMe(playerId) : Promise.resolve(null),
    ]);
    if (!board.ok) return board;
    if (!ghost.ok && ghost.code !== "no_ghost") return ghost;
    if (deaths && !deaths.ok) return deaths;
    if (me && !me.ok && me.code !== "unknown_player" && me.code !== "code_revoked") return me;
    const data: DayBundle = {
      date,
      open: board.data.open,
      board: board.data,
      ghost: ghost.ok ? ghost.data : null,
      deaths: deaths?.ok ? deaths.data : { date, levelId: null, open: board.data.open, players: 0, deaths: 0, tiles: [] },
      ...(me ? (me.ok ? { profile: me.data } : { profile: null, profileError: me.code }) : {}),
    };
    return { ok: true, data };
  }

  /** `__jump.reads` (outils de test). */
  debug(): unknown {
    return { ...this.stats, days: [...this.kept.entries()].map(([date, k]) => ({ date, at: k.at, profile: k.data.profile !== undefined })) };
  }
}
