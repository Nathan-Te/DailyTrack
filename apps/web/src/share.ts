import type { Medal } from "@cdj/sim";
import { fNombre, fRang, fTemps, t } from "./i18n";

// La ligne à partager (lot 6, repris au lot I4) : façon Wordle, dans la langue du joueur. **Les émojis ne vivent que dans ce texte à coller** (charte § 6),
// jamais dans l'interface. Les mots viennent du catalogue (`partage.*`), le temps et le rang des formats du socle.

export const MEDAL_ICON: Record<Medal, string> = { author: "💎", gold: "🥇", silver: "🥈", bronze: "🥉" };

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
 * La ligne à partager, façon Wordle : `Du Jour · Track #142 — 47,312 s — 🥇 — 23e/812` (`Du Jour · Track #142 — 47.312 s — 🥇 — 23rd/812` : même forme dans les deux langues, charte § 2).
 * Les morceaux qu'on ne connaît pas (pas de médaille, pas de classement) sont simplement omis.
 */
export function shareLine(r: ShareResult): string {
  const parts = [r.number >= 1 ? t("lignePartage.titre", { numero: r.number }) : t("lignePartage.titreSansNumero", { date: r.date }), fTemps(r.ms)];
  if (r.medal) parts.push(MEDAL_ICON[r.medal]);
  if (r.rank && r.participants) parts.push(`${fRang(r.rank)}/${fNombre(r.participants)}`);
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
