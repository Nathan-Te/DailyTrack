import { formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION } from "@cdj/jump-sim";
import { NAME_TAKEN_MESSAGE, Profile, isValidName, normalizeName, readIdentity, readPlayerId, type Identity, type KeyValueStore, type RenameResult, type SyncView } from "@cdj/profile";
import type { JumpBoard, JumpSubmitResult, RankEntry, RankSource } from "./rankApi";
import type { KnownRank, RankQueue } from "./rankQueue";

// Le classement du jour, côté jeu (lot P1 de la plateforme), **sans DOM** (testé sous Node) : envoi des essais, file hors ligne, pseudo,
// classements lus. Le jeu ne bloque **jamais** sur une requête : tout est asynchrone, un échec est un état (« Classement indisponible, ton temps
// sera envoyé »), et la partie continue.
//
//   - `offer(essai)` : un essai réussi du niveau du jour, meilleur que le meilleur envoyé, entre dans la file (`RankQueue` : un seul envoi en
//     attente par jour, le meilleur) puis part tout de suite (`flush`). Le jeu décide de ce qui peut partir (`mayRank`, main.ts) : jamais une
//     archive, un thème forcé, une partie aux réglages modifiés, un morceau, un scénario ni une lecture.
//   - Échec réseau (ou serveur qui ne répond pas, ou trop de requêtes) : l'envoi reste en attente, nouvel essai plus tard (délai qui s'allonge),
//     et tout de suite au retour du réseau (`wake`, branché sur l'événement `online`). Autre version : « Une nouvelle version du jeu est
//     disponible », l'envoi est oublié (il ne passera jamais). Refus définitif (jour figé, essai refusé) : oublié.
//   - **Premier envoi et pseudo** (le parcours du premier temps classé de DailyTrack, par `@cdj/profile`) : sans pseudo, l'envoi attend
//     (`status: "name"`) ; le joueur en choisit un (`chooseName` : le serveur dit s'il est libre, suggestions sinon), puis l'envoi part avec
//     lui. Une identité de la plateforme déjà créée par DailyTrack dans ce navigateur (`cdj:player`, `cdj:name`) est réutilisée telle quelle :
//     même identifiant, même pseudo. L'identifiant n'est **créé qu'au premier envoi** (jamais à la lecture d'un classement).

/**
 * Un essai peut-il entrer au classement ? Seulement le niveau du jour joué le jour même (la règle de l'historique, `mayRecord`) : jamais une
 * archive, un jour à venir, un thème forcé (`trial`), une partie aux réglages modifiés, une lecture, un carnage de démonstration. Un morceau ou
 * un scénario n'est pas un niveau du jour (`mode` absent).
 */
export function mayRank(o: { mode: "jour" | "archive" | "futur" | "essai" | null; levelDay: number; today: number; watching: boolean; tuned: boolean; trial: boolean; carnageDemo: boolean }): boolean {
  return o.mode === "jour" && o.levelDay === o.today && !o.watching && !o.tuned && !o.trial && !o.carnageDemo;
}

export type RankStatus = "off" | "idle" | "sending" | "ranked" | "offline" | "version" | "name" | "revoked" | "refused";

export interface RankState {
  status: RankStatus;
  /** Le message à montrer (refus, panne), "" sinon. */
  message: string;
  /** Pseudo refusé : des pseudos libres à toucher. */
  suggestions: string[];
}

export interface RankingDeps {
  /** Le classement (serveur ou démonstration), ou `null` : pas de classement, rien n'est envoyé ni lu. */
  source: RankSource | null;
  queue: RankQueue;
  /** L'identité de la plateforme (stockage du jeu, clés `cdj:*`). */
  identity: Identity;
  /** Le stockage de l'identité, pour la lire **sans rien créer** (`readPlayerId`). */
  identityStore: () => KeyValueStore | null;
  /** Aujourd'hui (date de Paris, numéro de jour) et le temps écoulé depuis minuit de Paris : pour la purge de la file. */
  today(): number;
  sinceMidnight(): number;
  /** Minuterie (injectée : les tests avancent l'horloge eux-mêmes). */
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  now(): number;
  /** Lot P2 : la synchronisation du profil DailyJump (ce que le pseudo et le code demandent d'elle) ; sans elle, aucune. */
  sync?: SyncView;
  /**
   * Lot P2 : un envoi vient d'être accepté. Lot P4 : la réponse du serveur est passée (son classement `board` : le jeu n'a rien à relire, sauf
   * le fantôme du premier si le premier a changé).
   */
  onAccepted?(result: JumpSubmitResult): void;
}

/** Sans synchronisation du profil (tests, démonstration) : le pseudo ne passe que par la vérification « libre ou non ». */
const NO_SYNC: SyncView = {
  state: { known: null },
  noteRenamed() {},
  noteServerKnows() {},
  reset() {},
};

export class Ranking {
  state: RankState;
  /** Le dernier classement lu par jour (AAAA-MM-JJ), et son état de lecture. */
  readonly boards = new Map<string, { status: "loading" | "ok" | "offline" | "error"; board: JumpBoard | null; message: string }>();
  /** Le dernier envoi accepté (réponse du serveur), pour les tests et `__jump.rank`. */
  lastResult: { date: string; ticks: number; deaths: number; rank: number; participants: number } | null = null;
  private inflight: Promise<void> | null = null;
  private timer: unknown = null;
  private readonly listeners = new Set<() => void>();
  readonly profile: Profile;

  constructor(private readonly deps: RankingDeps) {
    this.state = { status: deps.source ? "idle" : "off", message: "", suggestions: [] };
    this.profile = new Profile({ api: deps.source, demo: false, identity: deps.identity, sync: deps.sync ?? NO_SYNC });
    deps.queue.purge(deps.today(), deps.sinceMidnight());
  }

  get enabled(): boolean {
    return this.deps.source !== null;
  }

  /** Le pseudo de la plateforme (celui de DailyTrack s'il existe), sans rien créer. */
  get name(): string | null {
    return readIdentity(this.deps.identityStore()).name;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(next: Partial<RankState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  /** Le rang connu d'un jour (dernier envoi accepté ou dernière lecture du classement), ou `null`. */
  known(date: string): KnownRank | null {
    return this.deps.queue.known(date);
  }

  /** L'envoi en attente d'un jour (AAAA-MM-JJ), ou `null`. */
  pendingFor(date: string): { ticks: number; tries: number } | null {
    return this.deps.queue.pendingFor(date);
  }

  /** Le rang à mettre dans la ligne à partager : seulement s'il est celui de ce temps-là (un temps meilleur pas encore envoyé n'a pas de rang). */
  shareRank(date: string, ticks: number): { rank: number; participants: number } | null {
    const k = this.known(date);
    return k && k.ticks === ticks ? { rank: k.rank, participants: k.participants } : null;
  }

  /** Un essai réussi du niveau du jour (le jeu a vérifié qu'il peut être classé). Ne bloque jamais : l'envoi part en arrière-plan. */
  offer(entry: RankEntry): void {
    if (!this.enabled) return;
    if (this.deps.queue.offer(entry)) void this.flush();
  }

  /** Le réseau est revenu (événement `online`), ou la page redevient visible : ce qui attend repart tout de suite. */
  wake(): void {
    if (!this.enabled || this.deps.queue.pending.length === 0) return;
    this.deps.queue.retryNow();
    void this.flush();
  }

  /** Envoie ce qui est dû, un envoi à la fois ; reprogramme la minuterie pour le suivant. */
  flush(): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    if (this.inflight) return this.inflight;
    this.inflight = this.drain().finally(() => {
      this.inflight = null;
      this.schedule();
    });
    return this.inflight;
  }

  private schedule(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
    const at = this.deps.queue.nextAt();
    if (at === null || this.state.status === "name" || this.state.status === "revoked") return;
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, Math.max(0, at - this.deps.now()));
  }

  private async drain(): Promise<void> {
    const source = this.deps.source!;
    const queue = this.deps.queue;
    queue.purge(this.deps.today(), this.deps.sinceMidnight());
    for (let p = queue.due(); p; p = queue.due()) {
      const name = this.name;
      // Premier envoi sans pseudo : on attend que le joueur en choisisse un (l'envoi reste dans la file).
      if (!name && readPlayerId(this.deps.identityStore() ?? { getItem: () => null }) === null) {
        this.set({ status: "name", message: "", suggestions: [] });
        return;
      }
      this.set({ status: "sending", message: "", suggestions: [] });
      const playerId = this.deps.identity.getPlayerId(); // créé ici, au premier envoi, s'il n'existait pas
      const r = await source.submit(playerId, name, p, { simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION });
      if (r.ok) {
        const d = r.data;
        queue.confirm(p, { date: p.date, levelId: d.levelId, ticks: d.bestTicks, rank: d.rank, participants: d.participants, medal: d.medal });
        this.lastResult = { date: d.date, ticks: d.ticks, deaths: d.deaths, rank: d.rank, participants: d.participants };
        this.set({ status: "ranked", message: "", suggestions: [] });
        this.deps.sync?.noteServerKnows(true);
        // Lot P4 : le classement d'après l'envoi est dans la réponse : pas de relecture (un serveur plus ancien : `/board`, comme avant).
        if (d.board) this.noteBoard(p.date, d.board);
        else void this.loadBoard(p.date);
        this.deps.onAccepted?.(d);
        continue;
      }
      if (r.status === 0 || r.status === 429 || r.status >= 500 || r.code === "not_found") {
        queue.failed(p.date);
        const message = r.status === 429 ? "Trop d'envois : nouvel essai dans un moment." : "Classement indisponible, ton temps sera envoyé.";
        this.set({ status: "offline", message, suggestions: [] });
        return;
      }
      if (r.code === "version") {
        queue.drop(p.date);
        this.set({ status: "version", message: "Une nouvelle version du jeu est disponible : recharge la page pour être classé.", suggestions: [] });
        continue;
      }
      if (r.code === "name_taken" || r.code === "name_required" || r.code === "invalid_name" || r.code === "name_forbidden") {
        this.set({ status: "name", message: r.code === "name_required" ? "" : r.message, suggestions: r.suggestions ?? [] });
        return;
      }
      if (r.code === "code_revoked") {
        this.set({ status: "revoked", message: r.message, suggestions: [] });
        return;
      }
      // Refus définitif (jour figé, essai refusé par le rejeu…) : l'envoi ne passera jamais.
      queue.drop(p.date);
      this.set({ status: "refused", message: r.message, suggestions: [] });
    }
  }

  /**
   * Le premier pseudo (ou un autre, après un refus) : le serveur dit s'il est libre (réservé à son premier propriétaire), puis l'envoi en
   * attente part avec lui. Hors ligne, le pseudo est gardé et vérifié à l'envoi.
   */
  async chooseName(raw: string): Promise<RenameResult> {
    const name = normalizeName(raw);
    if (!isValidName(name)) return { ok: false, code: "invalid_name", message: "1 à 20 caractères : lettres, chiffres, espace . _ ' -" };
    const r = await this.profile.rename(name, { viaSubmit: true });
    if (!r.ok) {
      this.set({ status: "name", message: r.code === "name_taken" ? NAME_TAKEN_MESSAGE : r.message, suggestions: r.suggestions ?? [] });
      return r;
    }
    this.set({ status: "idle", message: "", suggestions: [] });
    await this.flush();
    return r;
  }

  /**
   * Lot P4 : un classement lu ailleurs (la lecture regroupée du jour, la réponse d'un envoi) : gardé comme une lecture de `/board` (rang connu
   * compris), sans requête.
   */
  noteBoard(date: string, board: JumpBoard): void {
    if (!this.enabled) return;
    this.boards.set(date, { status: "ok", board, message: "" });
    this.deps.queue.noteBoard(date, board.levelId, board.me, board.participants);
    this.changed();
  }

  /** Un classement attendu d'une lecture en cours (la lecture regroupée) : « chargement » si rien n'est encore connu ; un échec le dit. */
  noteBoardLoading(date: string): void {
    if (!this.enabled || this.boards.get(date)?.board) return;
    this.boards.set(date, { status: "loading", board: null, message: "" });
    this.changed();
  }

  noteBoardFailed(date: string, offline: boolean, message: string): void {
    if (!this.enabled) return;
    const prev = this.boards.get(date);
    this.boards.set(date, { status: offline ? "offline" : "error", board: prev?.board ?? null, message: offline ? "Classement indisponible" : message });
    this.changed();
  }

  /** Lit le classement d'un jour (ta ligne si tu as une identité, jamais créée ici). Ne lève jamais. */
  async loadBoard(date: string): Promise<void> {
    if (!this.enabled) return;
    const prev = this.boards.get(date);
    this.boards.set(date, { status: "loading", board: prev?.board ?? null, message: "" });
    this.changed();
    const id = readPlayerId(this.deps.identityStore() ?? { getItem: () => null });
    const r = await this.deps.source!.board(date, id);
    if (r.ok) {
      this.boards.set(date, { status: "ok", board: r.data, message: "" });
      this.deps.queue.noteBoard(date, r.data.levelId, r.data.me, r.data.participants);
    } else {
      this.boards.set(date, { status: r.status === 0 ? "offline" : "error", board: prev?.board ?? null, message: r.status === 0 ? "Classement indisponible" : r.message });
    }
    this.changed();
  }

  /** `__jump.rank` (outils de test). */
  debug(today: number): unknown {
    const date = formatDay(today);
    return {
      enabled: this.enabled,
      state: { ...this.state },
      pending: this.deps.queue.pending.map((p) => ({ date: p.date, levelId: p.levelId, ticks: p.ticks, tries: p.tries, nextAt: p.nextAt })),
      known: this.known(date),
      board: this.boards.get(date) ?? null,
      lastResult: this.lastResult,
    };
  }
}
