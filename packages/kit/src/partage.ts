// La ligne à partager (lot K3), le gabarit commun des trois jeux (`Du Jour · {nom} #{n} — {score} — {médaille} — {extras} — {rang}`). **Les émojis ne vivent que dans cette ligne** (charte § 6) ; ils
// sont écrits par le jeu qui les choisit. Les morceaux qu'on ne connaît pas (pas de médaille, pas de classement) sont simplement omis.

/** Assemble les morceaux de la ligne (les vides sont omis) avec le séparateur de la plateforme. */
export function assemblerLigne(morceaux: readonly (string | null | undefined | false)[]): string {
  return morceaux.filter(Boolean).join(" — ");
}

/** Texte complet à coller : la ligne, puis l'adresse du jeu. */
export function textePartage(ligne: string, adresse: string): string {
  return `${ligne}\n${adresse}`;
}

/** Adresse à partager : la page courante sans aucun paramètre ; `?seed=<date>` pour un jour qui n'est pas celui d'aujourd'hui (`date` absente : toujours la page). */
export function adresseDePartage(lieu: { origin: string; pathname: string }, date?: string, estAujourdhui = true): string {
  const base = lieu.origin + lieu.pathname;
  return estAujourdhui || date === undefined ? base : `${base}?seed=${date}`;
}

export interface LigneParDefaut {
  /** Le nom du jeu (la fiche : `nom`). */
  nom: string;
  /** Le numéro du jour pour ce jeu ; ≤ 0 ou absent avant son premier jour : on écrit alors la date. */
  numero?: number | null;
  date: string;
  /** Le score déjà formaté dans la langue. */
  score: string;
  medaille?: string | null;
  /** Ce que le jeu ajoute (morts, vies…), déjà formaté. */
  extras?: readonly string[];
  /** « 3e/128 », déjà formaté. */
  rang?: string | null;
}

/** La ligne telle qu'un jeu neuf l'obtient sans rien écrire : `Du Jour · Cibles #12 — 17 — 🥇 — 3e/128`. */
export function ligneParDefaut(d: LigneParDefaut): string {
  const titre = d.numero !== undefined && d.numero !== null && d.numero >= 1 ? `Du Jour · ${d.nom} #${d.numero}` : `Du Jour · ${d.nom} (${d.date})`;
  return assemblerLigne([titre, d.score, d.medaille, ...(d.extras ?? []), d.rang]);
}
