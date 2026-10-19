import { parseDay } from "@cdj/core";
import type { KeyValue } from "./memory";
import { GRACE_MS, backoff } from "./rankQueue";
import { storageKey } from "./storage";

// La file des vies (lot P3 de la plateforme), **logique pure** (stockage et horloge injectés, testée sans DOM). Les vies du niveau du jour qui
// finissent par une mort partent au serveur, qui les rejoue (carte des morts et carnage de tout le monde). **Décision de Nathan : au plus 30
// morts par joueur et par jour** ; les arrivées et les abandons ne partent pas.
//
//   - **Le choix des 30 morts** (`chooseLives`, pur) : réparties **le long du niveau** — environ 30 ÷ nombre de sections pour chaque section,
//     dans l'ordre d'arrivée ; ce qui reste du quota se remplit ensuite avec les morts suivantes, d'où qu'elles viennent. Le remplissage
//     n'a lieu qu'une fois le niveau fini au moins une fois ce jour-là (`final`) : avant, le joueur n'a pas encore vu les dernières sections
//     et le quota leur reste réservé. Le serveur ne fait pas confiance à ce choix : il rejoue chaque vie et vérifie le plafond.
//   - **Les lots** : un par jour au plus à la fois ; échec (réseau, serveur muet, 429, 5xx) → nouvel essai plus tard (`backoff`, le même que
//     le classement) ; **joueur inconnu du serveur** (pas encore d'essai classé) → les vies attendent (`waiting`) et repartent après la
//     première arrivée acceptée (`wake`) ; autre version, jour figé → oubliées ; une vie écartée par le serveur (invalide, pas une mort, trop
//     longue) ne repart jamais ; plafond atteint → le jour est clos.
//   - **Purge** : un jour fini et sa grâce passée (10 min après minuit de Paris, comme le serveur).
// Clé (`jump:` comme tout DailyJump, dans `gameStorage()`) : `jump:vies:envoi`. Lectures et écritures protégées : sans stockage, la file vit le
// temps de la page.

export const LIVES_QUEUE_KEY = storageKey("vies:envoi");
/** Décision de Nathan : au plus 30 morts par joueur et par jour (le serveur applique le même plafond). */
export const LIVES_PER_DAY = 30;
/** Morts candidates gardées par jour au plus (les premières : le jeu en garde 300, comme ses vies). */
export const LIVES_CANDIDATES = 300;
/** Pendant la partie, un lot toutes les 3 minutes au plus (plus un à l'arrivée et un quand la page se cache). */
export const LIVES_EVERY_MS = 180_000;

/** Une mort candidate : la rediffusion de sa vie et la section où elle meurt (`sectionAt` de `@cdj/jump-sim`). */
export interface LifeCandidate {
  code: string;
  section: number;
}

interface DayLives {
  date: string;
  levelId: string;
  sections: number;
  /** Morts pas encore acceptées, dans l'ordre d'arrivée. */
  candidates: LifeCandidate[];
  /** Morts acceptées par le serveur (ou qu'il avait déjà) : elles comptent dans le plafond. */
  sent: LifeCandidate[];
  /** Vies écartées par le serveur (invalides, pas une mort, trop longues) : jamais reproposées. */
  rejected: string[];
  /** Le niveau a été fini au moins une fois ce jour-là : le quota peut se remplir sans tenir compte des sections. */
  final: boolean;
  /** Plafond atteint (le serveur l'a dit, ou 30 envoyées) : plus rien ne part. */
  full: boolean;
  /** Le serveur ne connaît pas encore le joueur : attendre sa première arrivée acceptée. */
  waiting: boolean;
  tries: number;
  nextAt: number;
}

/**
 * Les morts à envoyer maintenant parmi `candidates` (ordre d'arrivée), quand `sent` sont déjà parties : d'abord **par section**, au plus
 * `max(1, ⌊quota ÷ sections⌋)` par section (celles déjà parties comprises), dans l'ordre d'arrivée ; puis, si `final`, ce qui reste du quota
 * avec les morts suivantes, d'où qu'elles viennent. Jamais plus que `quota − sent`.
 */
export function chooseLives(candidates: readonly LifeCandidate[], sent: readonly LifeCandidate[], sections: number, final: boolean, quota = LIVES_PER_DAY): LifeCandidate[] {
  const n = Math.max(1, sections);
  const perSection = Math.max(1, Math.floor(quota / n));
  const room = quota - sent.length;
  if (room <= 0) return [];
  const count = new Array<number>(n).fill(0);
  const sectionOf = (c: LifeCandidate) => Math.min(n - 1, Math.max(0, c.section | 0));
  for (const s of sent) count[sectionOf(s)]!++;
  const picked = new Set<number>();
  for (let i = 0; i < candidates.length && picked.size < room; i++) {
    const s = sectionOf(candidates[i]!);
    if (count[s]! < perSection) {
      count[s]!++;
      picked.add(i);
    }
  }
  if (final) for (let i = 0; i < candidates.length && picked.size < room; i++) picked.add(i);
  return [...picked].sort((a, b) => a - b).map((i) => candidates[i]!);
}

/** Le sort d'une vie dans la réponse du serveur. */
export type LifeVerdict = "ok" | "duplicate" | "invalid" | "not_death" | "over_cap" | "too_long";

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isCandidate = (v: unknown): v is LifeCandidate => !!v && typeof (v as LifeCandidate).code === "string" && isInt((v as LifeCandidate).section);

function isDay(v: unknown): v is DayLives {
  const d = v as Partial<DayLives> | null;
  return !!d && typeof d.date === "string" && typeof d.levelId === "string" && isInt(d.sections) && Array.isArray(d.candidates) && Array.isArray(d.sent) && isInt(d.tries) && typeof d.nextAt === "number";
}

export class LivesQueue {
  private days: Record<string, DayLives> = {};

  constructor(
    private readonly store: KeyValue | null,
    private readonly now: () => number,
  ) {
    try {
      const raw = this.store?.getItem(LIVES_QUEUE_KEY);
      const obj = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      for (const [date, v] of Object.entries(obj ?? {})) {
        if (parseDay(date) === null || !isDay(v)) continue;
        const rejected = Array.isArray(v.rejected) ? v.rejected.filter((c): c is string => typeof c === "string") : [];
        this.days[date] = { ...v, candidates: v.candidates.filter(isCandidate), sent: v.sent.filter(isCandidate), rejected, final: !!v.final, full: !!v.full, waiting: !!v.waiting };
      }
    } catch {
      this.days = {};
    }
  }

  private save(): void {
    try {
      this.store?.setItem(LIVES_QUEUE_KEY, JSON.stringify(this.days));
    } catch {
      /* stockage plein ou bloqué : la file vit en mémoire le temps de la page */
    }
  }

  /** L'état d'un jour (tests, `__jump.lives`). */
  day(date: string): Readonly<DayLives> | null {
    return this.days[date] ?? null;
  }

  get dates(): string[] {
    return Object.keys(this.days).sort();
  }

  /** De nouvelles morts du niveau du jour (dans l'ordre d'arrivée). Rend vrai s'il y a quelque chose à envoyer. */
  add(date: string, levelId: string, sections: number, lives: readonly LifeCandidate[]): boolean {
    let d = this.days[date];
    if (!d || d.levelId !== levelId) d = this.days[date] = { date, levelId, sections, candidates: [], sent: [], rejected: [], final: false, full: false, waiting: false, tries: 0, nextAt: this.now() };
    if (d.full) return false;
    const known = new Set([...d.candidates, ...d.sent].map((c) => c.code).concat(d.rejected));
    let added = 0;
    for (const l of lives) {
      if (d.candidates.length + d.sent.length + d.rejected.length >= LIVES_CANDIDATES) break;
      if (known.has(l.code)) continue;
      known.add(l.code);
      d.candidates.push({ code: l.code, section: l.section });
      added++;
    }
    if (added) this.save();
    return added > 0;
  }

  /** Le niveau a été fini ce jour-là : le reste du quota peut se remplir (morts suivantes, toutes sections). */
  markFinal(date: string): void {
    const d = this.days[date];
    if (d && !d.final) {
      d.final = true;
      this.save();
    }
  }

  /** Le prochain lot à envoyer maintenant (un jour à la fois, le plus ancien d'abord), ou `null`. */
  due(): { date: string; levelId: string; lives: LifeCandidate[] } | null {
    const t = this.now();
    for (const date of this.dates) {
      const d = this.days[date]!;
      if (d.full || d.waiting || d.nextAt > t) continue;
      const lives = chooseLives(d.candidates, d.sent, d.sections, d.final);
      if (lives.length) return { date, levelId: d.levelId, lives };
    }
    return null;
  }

  /** Le prochain instant où un lot sera dû (ms), ou `null`. */
  nextAt(): number | null {
    let at: number | null = null;
    for (const d of Object.values(this.days)) {
      if (d.full || d.waiting || chooseLives(d.candidates, d.sent, d.sections, d.final).length === 0) continue;
      at = at === null ? d.nextAt : Math.min(at, d.nextAt);
    }
    return at;
  }

  /** La réponse du serveur à un lot (le sort de chaque vie, dans l'ordre) : acceptées → parties ; écartées → oubliées ; plafond → jour clos. */
  confirm(date: string, lives: readonly LifeCandidate[], verdicts: readonly LifeVerdict[], dayCount: number, cap = LIVES_PER_DAY): void {
    const d = this.days[date];
    if (!d) return;
    const gone = new Set<string>();
    lives.forEach((l, i) => {
      const v = verdicts[i] ?? "invalid";
      gone.add(l.code);
      if (v === "ok" || v === "duplicate") d.sent.push(l);
      else if (v === "over_cap") d.full = true;
      // invalide, pas une mort, trop longue : écartée par le serveur, elle ne repart jamais.
      else d.rejected.push(l.code);
    });
    d.candidates = d.candidates.filter((c) => !gone.has(c.code));
    if (dayCount >= cap || d.sent.length >= cap) d.full = true;
    if (d.full) d.candidates = [];
    d.tries = 0;
    d.nextAt = this.now();
    this.save();
  }

  /** Échec réseau ou serveur : un nouvel essai plus tard, de plus en plus tard. */
  failed(date: string): void {
    const d = this.days[date];
    if (!d) return;
    d.tries++;
    d.nextAt = this.now() + backoff(d.tries);
    this.save();
  }

  /** Le serveur ne connaît pas encore le joueur : ses vies attendent sa première arrivée acceptée. */
  waitForPlayer(date: string): void {
    const d = this.days[date];
    if (!d) return;
    d.waiting = true;
    this.save();
  }

  /** Le joueur est connu (essai accepté), ou le réseau revient : tout repart tout de suite. */
  wake(): void {
    const t = this.now();
    for (const d of Object.values(this.days)) {
      d.waiting = false;
      d.nextAt = Math.min(d.nextAt, t);
    }
    this.save();
  }

  /** Le jour ne prendra plus de vies (autre version, jour figé) : on l'oublie. */
  drop(date: string): void {
    delete this.days[date];
    this.save();
  }

  /** Oublie les jours finis : tout jour avant hier, et hier une fois la grâce passée. Rend le nombre de jours retirés. */
  purge(today: number, sinceMidnight: number): number {
    let n = 0;
    for (const date of Object.keys(this.days)) {
      const d = parseDay(date);
      if (d === null || d < today - 1 || (d === today - 1 && sinceMidnight >= GRACE_MS)) {
        delete this.days[date];
        n++;
      }
    }
    if (n) this.save();
    return n;
  }
}
