import type { Medal } from "@cdj/sim";
import { formatTime } from "./format";

export const MEDAL_ICON: Record<Medal, string> = { author: "🏆", gold: "🥇", silver: "🥈", bronze: "🥉" };

/** 1 → « 1er », 2 → « 2e », 23 → « 23e » (rang à la française). */
export function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}

export interface ShareResult {
  /** Numéro du circuit (« #142 ») ; ≤ 0 avant le lancement : on affiche alors la date. */
  number: number;
  date: string;
  ms: number;
  medal: Medal | null;
  rank?: number | null;
  participants?: number | null;
}

/**
 * La ligne à partager, façon Wordle : `Circuit du Jour #142 — 47,312 s — 🥇 — 23e/812`.
 * Les morceaux qu'on ne connaît pas (pas de médaille, pas de classement) sont simplement omis.
 */
export function shareLine(r: ShareResult): string {
  const parts = [r.number >= 1 ? `Circuit du Jour #${r.number}` : `Circuit du Jour ${r.date}`, formatTime(r.ms)];
  if (r.medal) parts.push(MEDAL_ICON[r.medal]);
  if (r.rank && r.participants) parts.push(`${ordinal(r.rank)}/${r.participants}`);
  return parts.join(" — ");
}

/** Texte complet à coller : la ligne, puis l'adresse du jeu (avec la date pour un circuit d'archive). */
export function shareText(r: ShareResult, url: string): string {
  return `${shareLine(r)}\n${url}`;
}

/** Adresse à partager : le jeu sans réglages de test ; `?seed=` seulement pour un jour qui n'est pas aujourd'hui. */
export function shareUrl(location: Pick<Location, "origin" | "pathname">, date: string, isToday: boolean): string {
  const base = location.origin + location.pathname;
  return isToday ? base : `${base}?seed=${date}`;
}
