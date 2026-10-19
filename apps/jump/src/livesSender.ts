import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION } from "@cdj/jump-sim";
import type { LifeCandidate, LivesQueue } from "./livesQueue";
import type { LivesResult, RankSource } from "./rankApi";

// L'envoi des vies (lot P3 de la plateforme), **sans DOM** (testé sous Node) : prend les lots de la file (`LivesQueue`) et les envoie au serveur
// (`POST /api/jump/lives`). **Le jeu ne bloque jamais** : tout est asynchrone, un échec est un état ; le jeu appelle `flush` à l'arrivée,
// toutes les 3 minutes pendant la partie, et quand la page se cache (`keepalive`). L'identifiant n'est jamais créé ici (on le lit) : un
// joueur sans identité, ou que le serveur ne connaît pas encore, garde ses vies jusqu'à sa première arrivée acceptée (`wake`).

export type LivesStatus = "off" | "idle" | "sending" | "sent" | "offline" | "waiting" | "version" | "closed";

export interface LivesSenderDeps {
  /** Le serveur ; `null` (aucune adresse, démonstration) : rien ne part. */
  source: RankSource | null;
  queue: LivesQueue;
  /** L'identifiant de la plateforme s'il existe déjà (jamais créé pour envoyer des vies). */
  playerId(): string | null;
  today(): number;
  sinceMidnight(): number;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export class LivesSender {
  status: LivesStatus;
  /** La dernière réponse du serveur (`__jump.lives`). */
  last: LivesResult | null = null;
  /** Lots envoyés depuis le chargement (contrôle). */
  lots = 0;
  private inflight: Promise<void> | null = null;
  private timer: unknown = null;

  constructor(private readonly deps: LivesSenderDeps) {
    this.status = deps.source?.sendLives ? "idle" : "off";
    deps.queue.purge(deps.today(), deps.sinceMidnight());
  }

  get enabled(): boolean {
    return !!this.deps.source?.sendLives;
  }

  /** Envoie ce qui est dû, un lot à la fois. `keepalive` : la page se cache (l'envoi doit survivre à sa fermeture). Ne lève jamais. */
  flush(options: { keepalive?: boolean } = {}): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    if (this.inflight) return this.inflight;
    this.inflight = this.drain(options.keepalive ?? false).finally(() => {
      this.inflight = null;
      this.schedule();
    });
    return this.inflight;
  }

  /**
   * De nouvelles morts du niveau du jour (le jeu a vérifié qu'elles peuvent partir : jamais une archive, un thème forcé, des réglages
   * modifiés, un morceau ni un scénario). `finished` : le niveau a été fini (le quota peut se remplir). Rien ne part ici : `flush` les envoie.
   */
  offer(date: string, levelId: string, sections: number, lives: readonly LifeCandidate[], finished: boolean): void {
    if (!this.enabled) return;
    if (lives.length) this.deps.queue.add(date, levelId, sections, lives);
    if (finished) this.deps.queue.markFinal(date);
  }

  /** `__jump.lives` (outils de test). */
  debug(date: string): unknown {
    const d = this.deps.queue.day(date);
    return {
      enabled: this.enabled,
      status: this.status,
      lots: this.lots,
      day: d ? { candidates: d.candidates.length, sent: d.sent.length, final: d.final, full: d.full, waiting: d.waiting, tries: d.tries } : null,
      last: this.last,
    };
  }

  /** Le joueur est maintenant connu du serveur (essai accepté), ou le réseau revient : ce qui attend repart tout de suite. */
  wake(): void {
    if (!this.enabled) return;
    this.deps.queue.wake();
    void this.flush();
  }

  private schedule(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
    const at = this.deps.queue.nextAt();
    if (at === null) return;
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, Math.max(0, at - this.deps.now()));
  }

  private async drain(keepalive: boolean): Promise<void> {
    const source = this.deps.source!;
    const queue = this.deps.queue;
    queue.purge(this.deps.today(), this.deps.sinceMidnight());
    for (let lot = queue.due(); lot; lot = queue.due()) {
      const id = this.deps.playerId();
      if (!id) {
        // Pas encore d'identité (premier essai pas encore envoyé) : on attend, sans rien créer.
        queue.waitForPlayer(lot.date);
        this.status = "waiting";
        continue;
      }
      this.status = "sending";
      const r = await source.sendLives!(id, { levelId: lot.levelId, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: lot.lives.map((l) => l.code) }, { keepalive });
      this.lots++;
      if (r.ok) {
        this.last = r.data;
        queue.confirm(lot.date, lot.lives, r.data.results, r.data.dayCount, r.data.cap);
        this.status = "sent";
        continue;
      }
      if (r.status === 0 || r.status === 429 || r.status >= 500) {
        queue.failed(lot.date);
        this.status = "offline";
        return;
      }
      if (r.code === "unknown_player" || r.code === "code_revoked") {
        queue.waitForPlayer(lot.date);
        this.status = "waiting";
        continue;
      }
      // Autre version, jour figé, thème forcé… : ces vies ne passeront jamais.
      queue.drop(lot.date);
      this.status = r.code === "version" ? "version" : "closed";
    }
  }
}
