import type { JumpMedal } from "@cdj/jump-sim";
import { MEDAL_ICON } from "./dailyInfo";
import { formatTicks } from "./session";

// La ligne à partager (lot 10), **logique pure** (testée sans DOM), façon Wordle et format du seed (§ 5) :
//   `DailyJump #12 — 31,402 s — 🥇 — 47 💀`
// suivie, à la ligne, du lien du jeu. Le rang s'ajoutera avec le classement (phase 2) ; la série n'y est pas (décision de Nathan).
// Un niveau d'archive porte la mention « (archive) » et son lien `?seed=` ; un niveau à venir (aperçu seulement) « (à venir) ».
// Le lien est **construit depuis l'adresse courante** (jamais écrit en dur) : un aperçu de branche partage un lien d'aperçu.

/** D'où vient le niveau partagé : celui du jour, une archive, ou un jour à venir (aperçu seulement). */
export type ShareKind = "jour" | "archive" | "futur";

export interface ShareResult {
  /** Numéro du niveau (`levelNumber`) ; ≤ 0 avant le premier jour : on écrit alors la date. */
  number: number;
  /** AAAA-MM-JJ. */
  date: string;
  /** Meilleur temps (pas), celui que le rejeu a recalculé. */
  ticks: number;
  medal: JumpMedal | null;
  /** Morts du jour sur ce niveau. */
  deaths: number;
  kind: ShareKind;
}

const TAG: Record<ShareKind, string> = { jour: "", archive: " (archive)", futur: " (à venir)" };

/** `DailyJump #12 — 31,402 s — 🥇 — 47 💀` (sans médaille : le morceau est omis). */
export function shareLine(r: ShareResult): string {
  const title = `${r.number >= 1 ? `DailyJump #${r.number}` : `DailyJump ${r.date}`}${TAG[r.kind]}`;
  const parts = [title, formatTicks(r.ticks)];
  if (r.medal) parts.push(MEDAL_ICON[r.medal]);
  parts.push(`${r.deaths} 💀`);
  return parts.join(" — ");
}

/** Adresse à partager : la page courante sans aucun paramètre ; `?seed=` pour un niveau qui n'est pas celui du jour. */
export function shareUrl(loc: { origin: string; pathname: string }, date: string, kind: ShareKind): string {
  const base = loc.origin + loc.pathname;
  return kind === "jour" ? base : `${base}?seed=${date}`;
}

/** Texte complet : la ligne, puis le lien. */
export function shareText(r: ShareResult, loc: { origin: string; pathname: string }): string {
  return `${shareLine(r)}\n${shareUrl(loc, r.date, r.kind)}`;
}
