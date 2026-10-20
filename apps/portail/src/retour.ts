// Le retour du profil commun vers le jeu d'où l'on vient (lot I4) : `/profil/?retour=/track/`. Le paramètre est une adresse écrite par n'importe qui (un lien
// piégé en est une) : seul un **chemin du site** est accepté — un `/`, puis des segments de lettres, chiffres, `.`, `_`, `~` et `-` séparés par un seul `/` ; ni
// schéma (`javascript:`, `https:`), ni `//` (adresse sans schéma), ni `\`, ni `..`, ni `%` (encodages qui se décodent en `..` ou `/`), ni requête ni fragment.
// Tout le reste est ignoré : le profil garde son retour par défaut (« ‹ DU JOUR », vers le portail). Pur, testé (test/retour.test.ts).

const CHEMIN = /^\/(?:[A-Za-z0-9._~-]+\/?)*$/;

/** Le chemin du site demandé par `?retour=`, ou `null` s'il n'en est pas un (adresse extérieure, schéma, `//`, `..`, caractères inattendus…). */
export function cheminDuSite(brut: string | null | undefined): string | null {
  if (typeof brut !== "string" || brut.length === 0 || brut.length > 100 || !CHEMIN.test(brut)) return null;
  if (brut.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return brut;
}

/** Le jeu dont le chemin est la page d'accueil (`/track/` → `track`, `/jump/` → `jump`), ou `null` : on n'invente aucun nom. */
export function jeuDuChemin(chemin: string): "track" | "jump" | null {
  const m = /^\/(track|jump)\/?$/.exec(chemin);
  return m ? (m[1] as "track" | "jump") : null;
}

/** Le retour demandé par une adresse (`location.search`) : le chemin et le jeu qu'il désigne, ou `null` (retour par défaut). */
export function lireRetour(search: string): { chemin: string; jeu: "track" | "jump" } | null {
  const chemin = cheminDuSite(new URLSearchParams(search).get("retour"));
  const jeu = chemin ? jeuDuChemin(chemin) : null;
  return chemin && jeu ? { chemin, jeu } : null;
}
