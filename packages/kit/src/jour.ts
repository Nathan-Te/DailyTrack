// La lecture d'un fichier de jour figé (lot K3 ; avant : `lireFichier` de `jour.ts` de Tower et `browserFrozen` de `dailyLoader.ts` de Jump) : la même requête, le même délai, les mêmes refus.
// Ce que le fichier contient (et comment le valider : `lireJour`, `thawLevel`) reste au jeu, qui passe sa propre vérification.

/** Les dates figées qui se demandent au réseau : en production la liste écrite à la construction décide (aucune requête pour un jour qui n'est pas figé) ; ailleurs on essaie toujours. */
export function dateDemandable(date: string, production: boolean, figees: readonly string[]): boolean {
  return !production || figees.includes(date);
}

/**
 * Lit un fichier JSON à côté de la page (`<dossier>/<date>.json`) : `null` s'il manque, n'est pas du JSON ou tarde plus que `delai` (ms). Le contenu n'est PAS validé ici : l'appelant le relit.
 * `no-cache` : un jour figé par la mise en production doit se voir tout de suite.
 */
export async function lireFichierDeJour(dossier: string, date: string, base: string, delai: number): Promise<unknown> {
  const ctrl = typeof AbortController === "undefined" ? null : new AbortController();
  const minuteur = ctrl ? setTimeout(() => ctrl.abort(), delai) : null;
  try {
    const r = await fetch(new URL(`${dossier}/${date}.json`, base), { signal: ctrl?.signal, cache: "no-cache" });
    if (!r.ok) return null;
    return (await r.json()) as unknown;
  } catch {
    return null;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}
