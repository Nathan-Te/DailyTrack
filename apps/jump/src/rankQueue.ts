import { parseDay } from "@cdj/core";
import type { JumpMedal } from "@cdj/jump-sim";
import type { KeyValue } from "./memory";
import type { RankEntry } from "./rankApi";
import { storageKey } from "./storage";

// La file d'envois hors ligne du classement (lot P1 de la plateforme), **logique pure** (stockage et horloge injectés, testée sans DOM) :
//   - **un seul envoi en attente par jour, le meilleur** : un nouvel essai ne remplace l'attente que s'il est plus rapide qu'elle, et n'entre que
//     s'il est plus rapide que le dernier temps classé du jour (ce que le serveur a déjà) ;
//   - un échec (réseau coupé, serveur qui ne répond pas, trop de requêtes) **repousse** le prochain essai, avec un délai qui s'allonge
//     (`RETRY_MS`) ; le retour du réseau le relance tout de suite (`Ranking.wake`) ;
//   - **purge** : un jour fini et sa grâce passée (10 min après minuit de Paris, comme le serveur), son attente et son rang connu sont oubliés ;
//   - le **rang connu** du jour (réponse d'un envoi, ou ta ligne du classement) : l'accueil et la ligne à partager le lisent.
// Clés (`jump:` comme tout DailyJump, dans `gameStorage()`) : `jump:classement:attente`, `jump:classement:rangs`. Lectures et écritures
// protégées : sans stockage, la file vit le temps de la page.

export const QUEUE_KEY = storageKey("classement:attente");
export const RANKS_KEY = storageKey("classement:rangs");
/** La grâce du serveur après minuit de Paris (`JUMP_GRACE_MS`, apps/api/src/jump.ts) : un essai de la veille peut encore être classé. */
export const GRACE_MS = 10 * 60_000;
/** Délais avant un nouvel essai, de plus en plus longs (le dernier se répète). */
export const RETRY_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

export interface PendingSubmit extends RankEntry {
  /** Envois déjà tentés, et quand tenter le prochain (ms). */
  tries: number;
  nextAt: number;
}

/** Ton dernier rang connu pour un jour : le temps classé (celui du serveur), le rang et le nombre de classés au moment où on l'a appris. */
export interface KnownRank {
  date: string;
  levelId: string;
  ticks: number;
  rank: number;
  participants: number;
  medal: JumpMedal | null;
}

export function backoff(tries: number): number {
  return RETRY_MS[Math.min(RETRY_MS.length - 1, Math.max(0, tries - 1))]!;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function isPending(v: unknown): v is PendingSubmit {
  const p = v as Partial<PendingSubmit> | null;
  return !!p && typeof p.date === "string" && typeof p.levelId === "string" && typeof p.replay === "string" && isInt(p.ticks) && isInt(p.deaths) && isInt(p.tries) && typeof p.nextAt === "number";
}

function isKnown(v: unknown): v is KnownRank {
  const k = v as Partial<KnownRank> | null;
  return !!k && typeof k.date === "string" && typeof k.levelId === "string" && isInt(k.ticks) && isInt(k.rank) && isInt(k.participants);
}

export class RankQueue {
  private memory: { pending: Record<string, PendingSubmit>; ranks: Record<string, KnownRank> } = { pending: {}, ranks: {} };

  constructor(
    private readonly store: KeyValue | null,
    private readonly now: () => number,
  ) {
    this.memory.pending = this.read(QUEUE_KEY, isPending);
    this.memory.ranks = this.read(RANKS_KEY, isKnown);
  }

  private read<T>(key: string, ok: (v: unknown) => v is T): Record<string, T> {
    try {
      const raw = this.store?.getItem(key);
      if (!raw) return {};
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, T> = {};
      for (const [date, v] of Object.entries(obj ?? {})) if (parseDay(date) !== null && ok(v)) out[date] = v;
      return out;
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      this.store?.setItem(QUEUE_KEY, JSON.stringify(this.memory.pending));
      this.store?.setItem(RANKS_KEY, JSON.stringify(this.memory.ranks));
    } catch {
      /* stockage plein ou bloqué : la file vit en mémoire le temps de la page */
    }
  }

  /** Les envois en attente, du plus ancien jour au plus récent. */
  get pending(): PendingSubmit[] {
    return Object.keys(this.memory.pending)
      .sort()
      .map((d) => this.memory.pending[d]!);
  }

  pendingFor(date: string): PendingSubmit | null {
    return this.memory.pending[date] ?? null;
  }

  known(date: string): KnownRank | null {
    return this.memory.ranks[date] ?? null;
  }

  /**
   * Un essai réussi du niveau du jour : il entre dans la file s'il bat l'attente du jour et le dernier temps classé. Rend vrai s'il y est entré
   * (il partira au prochain `flush`, tout de suite).
   */
  offer(entry: RankEntry): boolean {
    const pending = this.memory.pending[entry.date];
    const known = this.memory.ranks[entry.date];
    if (pending && pending.levelId === entry.levelId && pending.ticks <= entry.ticks) return false;
    if (known && known.levelId === entry.levelId && known.ticks <= entry.ticks) return false;
    this.memory.pending[entry.date] = { ...entry, tries: 0, nextAt: this.now() };
    this.save();
    return true;
  }

  /** Le prochain envoi à tenter maintenant (le plus ancien jour d'abord), ou `null`. */
  due(): PendingSubmit | null {
    const t = this.now();
    return this.pending.find((p) => p.nextAt <= t) ?? null;
  }

  /** Le prochain instant où un envoi sera dû (ms), ou `null` s'il n'y a rien en attente. */
  nextAt(): number | null {
    const all = this.pending;
    return all.length ? Math.min(...all.map((p) => p.nextAt)) : null;
  }

  /** L'envoi a échoué (réseau, serveur) : un nouvel essai plus tard, de plus en plus tard. */
  failed(date: string): void {
    const p = this.memory.pending[date];
    if (!p) return;
    p.tries++;
    p.nextAt = this.now() + backoff(p.tries);
    this.save();
  }

  /** Tout ce qui attend peut repartir tout de suite (le réseau est revenu). */
  retryNow(): void {
    const t = this.now();
    for (const p of Object.values(this.memory.pending)) p.nextAt = Math.min(p.nextAt, t);
    this.save();
  }

  /** L'envoi ne passera jamais (autre version, jour figé, essai refusé) : on l'oublie. */
  drop(date: string): void {
    delete this.memory.pending[date];
    this.save();
  }

  /**
   * Le serveur a classé l'envoi de `sent` (sa rediffusion) : son rang est retenu ; l'attente du jour est retirée si c'est bien elle (un essai
   * plus rapide arrivé pendant l'envoi reste en attente).
   */
  confirm(sent: RankEntry, rank: KnownRank): void {
    const p = this.memory.pending[sent.date];
    if (p && p.replay === sent.replay) delete this.memory.pending[sent.date];
    this.memory.ranks[sent.date] = rank;
    this.save();
  }

  /** Ta ligne du classement lue sur le serveur : le rang connu suit (les autres joueurs ont pu passer devant). */
  noteBoard(date: string, levelId: string | null, me: { rank: number; ticks: number; medal: JumpMedal | null } | null, participants: number): void {
    if (!me || !levelId) return;
    this.memory.ranks[date] = { date, levelId, ticks: me.ticks, rank: me.rank, participants, medal: me.medal };
    this.save();
  }

  /**
   * Oublie les jours finis : tout jour avant hier, et hier une fois la grâce passée (`sinceMidnight` = ms depuis minuit de Paris). Rend le
   * nombre d'entrées retirées.
   */
  purge(today: number, sinceMidnight: number): number {
    let n = 0;
    const stale = (date: string) => {
      const d = parseDay(date);
      return d === null || d < today - 1 || (d === today - 1 && sinceMidnight >= GRACE_MS);
    };
    for (const date of Object.keys(this.memory.pending)) if (stale(date)) (delete this.memory.pending[date], n++);
    for (const date of Object.keys(this.memory.ranks)) if (stale(date)) (delete this.memory.ranks[date], n++);
    if (n) this.save();
    return n;
  }
}
