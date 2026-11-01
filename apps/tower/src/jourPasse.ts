// Ce que l'accueil et le jeu savent d'une tour PASSÉE (lot T7) — **sans aucun import** : l'accueil, dans le premier chargement, ne tire ni la simulation ni les archives.

/** Ce jour est-il une archive (un jour passé, joué hors classement) ? Le contenu d'un scénario d'essai n'en est jamais une. */
export const estArchive = (jour: number | null, aujourdhui: number): boolean => jour !== null && jour < aujourdhui;


/**
 * L'adresse de l'accueil de Tower depuis une partie (pause, fin) : la page sans ses paramètres d'essai (`?scenario=`, `?effet=` : un outil n'a pas d'accueil), les autres (le jour `?seed=`, `?api=`…) gardés.
 * Un simple changement d'adresse : la partie en cours est abandonnée, **jamais envoyée** (seule la fin d'une partie envoie, `jeu.ts`).
 */
export function adresseAccueil(chemin: string, recherche: string): string {
  const q = new URLSearchParams(recherche);
  q.delete("scenario");
  q.delete("effet");
  const texte = q.toString();
  return texte ? `${chemin}?${texte}` : chemin;
}
