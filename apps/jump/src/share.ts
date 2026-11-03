import { adresseDePartage, assemblerLigne, textePartage } from "@cdj/kit/partage";
import type { JumpMedal } from "@cdj/jump-sim";
import { MEDAL_ICON } from "./dailyInfo";
import { fNombre, fRang, fTicks, t } from "./i18n";

// La ligne à partager (lot 10), **logique pure** (testée sans DOM), façon Wordle et format du seed (§ 5) :
//   `Du Jour · Jump #12 — 31,402 s — 🥇 — 47 💀 — 3e/128`
// Lot I5 (charte § 2) : le titre est `Du Jour · Jump #12` dans les deux langues (même forme) ; le temps et le rang suivent les formats de la langue
// (`31.402 s`, `3rd/128` en anglais) ; mêmes émojis qu'avant (**ils ne vivent que dans cette ligne**, charte § 6).
// suivie, à la ligne, du lien du jeu. Lot P1 de la plateforme : **le rang du classement du jour s'ajoute à la fin** (`3ᵉ/128`), seulement s'il
// est celui de ce temps (confirmé par le serveur) ; sans rang (hors ligne, pas encore envoyé, archive, pas de serveur) la ligne reste celle du
// lot 10. La série n'y est pas (décision de Nathan).
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
  /** Lot P1 : le rang de ce temps au classement du jour et le nombre de classés, s'il est connu (confirmé par le serveur). */
  rank?: { rank: number; participants: number } | null;
}

/** `Du Jour · Jump #12 — 31,402 s — 🥇 — 47 💀 — 3e/128` (sans médaille ni rang : ces morceaux sont omis). */
export function shareLine(r: ShareResult): string {
  const titre = r.number >= 1 ? t("lignePartage.titre", { numero: r.number }) : t("lignePartage.titreSansNumero", { date: r.date });
  const title = r.kind === "jour" ? titre : `${titre} ${t(r.kind === "archive" ? "lignePartage.archive" : "lignePartage.futur")}`;
  return assemblerLigne([title, fTicks(r.ticks), r.medal && MEDAL_ICON[r.medal], `${fNombre(r.deaths)} 💀`, r.rank && r.kind === "jour" && `${fRang(r.rank.rank)}/${fNombre(r.rank.participants)}`]);
}

/** Adresse à partager : la page courante sans aucun paramètre ; `?seed=` pour un niveau qui n'est pas celui du jour. */
export const shareUrl = (loc: { origin: string; pathname: string }, date: string, kind: ShareKind): string => adresseDePartage(loc, date, kind === "jour");

/** Texte complet : la ligne, puis le lien. */
export const shareText = (r: ShareResult, loc: { origin: string; pathname: string }): string => textePartage(shareLine(r), shareUrl(loc, r.date, r.kind));
