import { SALON_SESSION_MS, salonSessionEnd, salonSessionStart } from "@cdj/sim";
import { formatTime } from "./format";
import { ordinal } from "./share";
import type { SalonBoard, SalonRow } from "./salonApi";

// Le Salon (lot 26) : logique pure (horloge, déroulé d'une session, choix des fantômes, ligne à partager). Aucun DOM, aucun
// rendu : testée par Vitest. `main.ts` et `salonMode.ts` l'utilisent.

/** Bandeau « dernier essai » : les 30 dernières secondes de la session. */
export const LAST_TRY_MS = 30_000;
/** Le circuit suivant se prépare (fil de travail) pendant les deux dernières minutes. */
export const PREPARE_MS = 120_000;
/** Une course commencée avant la fin se termine : l'envoi est accepté jusqu'à 60 s après la fin. */
export const SUBMIT_GRACE_MS = 60_000;
/** Durée du podium avant le circuit suivant. */
export const PODIUM_MS = 10_000;
export const BOARD_POLL_MS = 5000;
export const NOW_POLL_MS = 10_000;
/** Fantômes des autres joueurs affichés en même temps (plus le tien). */
export const MAX_GHOSTS = 5;

/** Durée d'une session d'après `?salonMinutes=N` (essais et démo seulement) ; la durée normale sinon. */
export function sessionMsFromParams(search: string): number {
  const raw = new URLSearchParams(search).get("salonMinutes");
  const minutes = raw === null ? NaN : Number(raw);
  return Number.isFinite(minutes) && minutes >= 0.5 && minutes <= 60 ? Math.round(minutes * 60_000) : SALON_SESSION_MS;
}

/**
 * Horloge du Salon : l'heure du serveur, déduite de l'heure locale et d'un décalage mesuré. Le décalage vient d'une réponse `now` :
 * l'heure annoncée date de la moitié de l'aller-retour. Sans serveur (démo), le décalage est nul : l'horloge locale.
 */
export class SalonClock {
  private offset = 0;
  constructor(private readonly local: () => number = Date.now) {}

  now(): number {
    return this.local() + this.offset;
  }

  /** Recale sur une réponse du serveur : `sentAt` et `receivedAt` sont des heures locales. */
  sync(serverMs: number, sentAt: number, receivedAt: number): void {
    this.offset = serverMs + (receivedAt - sentAt) / 2 - receivedAt;
  }

  /** Outil de test : fait valoir `ms` comme heure actuelle (l'horloge continue ensuite à avancer). */
  set(ms: number): void {
    this.offset = ms - this.local();
  }

  get skew(): number {
    return this.offset;
  }
}

/** « 07:42 » : temps restant (arrondi à la seconde supérieure, jamais négatif). */
export function countdownText(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** « 14:20 » : l'heure UTC du début de la session (la même pour tout le monde, d'où l'UTC). */
export function sessionLabel(session: number, sessionMs: number = SALON_SESSION_MS): string {
  const start = salonSessionStart(session, sessionMs);
  const minutes = Math.floor(start / 60_000);
  const h = Math.floor(minutes / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** La ligne à partager : `Salon 14:20 — 31,402 s — 3e/17`. Les morceaux inconnus sont omis. */
export function salonShareLine(label: string, ms: number, rank?: number | null, participants?: number | null): string {
  const parts = [`Salon ${label}`, formatTime(ms)];
  if (rank && participants) parts.push(`${ordinal(rank)}/${participants}`);
  return parts.join(" — ");
}

export interface SessionClock {
  remainingMs: number;
  /** Les 30 dernières secondes. */
  lastTry: boolean;
  /** Les deux dernières minutes : le circuit suivant se prépare. */
  preparing: boolean;
  /** La session est terminée. */
  ended: boolean;
  /** Plus aucun envoi n'est accepté (60 s après la fin). */
  closed: boolean;
}

export function sessionClock(nowMs: number, session: number, sessionMs: number = SALON_SESSION_MS): SessionClock {
  const end = salonSessionEnd(session, sessionMs);
  const remainingMs = end - nowMs;
  return { remainingMs, lastTry: remainingMs > 0 && remainingMs <= LAST_TRY_MS, preparing: remainingMs <= PREPARE_MS, ended: remainingMs <= 0, closed: nowMs > end + SUBMIT_GRACE_MS };
}

/** Un envoi daté de `nowMs` pour cette session serait-il accepté ? (le serveur décide ; le jeu évite un envoi perdu d'avance) */
export const submitOpen = (nowMs: number, session: number, sessionMs: number = SALON_SESSION_MS): boolean => !sessionClock(nowMs, session, sessionMs).closed;

/** Couleurs des fantômes des autres joueurs (une chacun, bien distinctes du bleu de ton propre fantôme du jour et de l'orange de la voiture). */
export const GHOST_COLORS = [0xff4fa3, 0x3ddc84, 0xffd22e, 0xb084ff, 0x2ee6d6, 0xff8a3d] as const;
/** Ton propre meilleur tour de la session. */
export const MY_GHOST_COLOR = 0x57b4ff;

/**
 * Les joueurs dont on charge le fantôme : les trois premiers, celui juste devant toi et celui juste derrière (jamais toi), au plus
 * `max`. Sans temps à toi : les premiers du classement.
 */
export function pickGhostRefs(board: Pick<SalonBoard, "rows" | "me">, max: number = MAX_GHOSTS): SalonRow[] {
  const rows = board.rows;
  const mine = board.me?.ref;
  const chosen: SalonRow[] = [];
  const take = (r: SalonRow | undefined) => {
    if (r && r.ref !== mine && !chosen.some((c) => c.ref === r.ref)) chosen.push(r);
  };
  for (const r of rows.slice(0, 3)) take(r);
  if (board.me) {
    take(rows.find((r) => r.rank === board.me!.rank - 1));
    take(rows.find((r) => r.rank === board.me!.rank + 1));
  } else {
    for (const r of rows.slice(3)) take(r);
  }
  return chosen.sort((a, b) => a.rank - b.rank).slice(0, max);
}

/** Qui t'a dépassé entre deux classements ? Le nom du premier joueur passé devant toi, ou `null`. */
export function overtakenBy(before: Pick<SalonBoard, "rows" | "me"> | null, after: Pick<SalonBoard, "rows" | "me">): string | null {
  if (!before?.me || !after.me) return null;
  const me = after.me.ref;
  const ahead = new Set(before.rows.filter((r) => r.rank < before.me!.rank).map((r) => r.ref));
  for (const r of after.rows) {
    if (r.rank >= after.me.rank) break;
    if (r.ref !== me && !ahead.has(r.ref)) return r.name;
  }
  return null;
}

/** Fantômes affichés (touche G) : tous, les premiers seulement (les trois premières places), aucun. */
export type SalonGhostMode = "all" | "top" | "off";
export const SALON_GHOST_MODES: readonly SalonGhostMode[] = ["all", "top", "off"];
export const SALON_GHOST_LABEL: Record<SalonGhostMode, string> = { all: "tous les fantômes", top: "les premiers seulement", off: "aucun fantôme" };

export function nextSalonGhostMode(mode: SalonGhostMode): SalonGhostMode {
  return SALON_GHOST_MODES[(SALON_GHOST_MODES.indexOf(mode) + 1) % SALON_GHOST_MODES.length]!;
}

/** Ce fantôme est-il visible dans ce mode ? `rank` : sa place (`null` : ton propre tour). */
export function ghostShown(mode: SalonGhostMode, rank: number | null): boolean {
  if (mode === "off") return false;
  if (mode === "all") return true;
  return rank !== null && rank <= 3;
}

/** Trois premiers du classement figé, pour le podium. */
export function podiumRows(board: Pick<SalonBoard, "rows">): SalonRow[] {
  return board.rows.slice(0, 3);
}

/**
 * Adresse pour passer au Salon (`salon = true`) ou revenir au circuit du jour : on garde les réglages d'affichage et de test (`api`,
 * `debug`, `touch`, `quality`, `salonMinutes`…), jamais le choix d'un circuit (date, thème, scénario).
 */
export function modeHref(search: string, salon: boolean): string {
  const p = new URLSearchParams(search);
  for (const k of ["mode", "scenario", "seed", "day", "theme", "variant", "spec", "f", "v", "m", "today", "salonAt"]) p.delete(k);
  if (salon) p.set("mode", "salon");
  const q = p.toString().replace(/=(?=&|$)/g, "");
  return q ? `?${q}` : "?";
}
