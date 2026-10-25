/**
 * Lot R7 (audit de sécurité) — `?api=` ne doit pas pouvoir envoyer l'identifiant secret du joueur à un serveur étranger.
 *
 * Les deux jeux lisent l'adresse de leur serveur dans `?api=…` (essais, aperçus, recette). Sur le site de **production**, un lien piégé
 * (`https://playdujour.com/track/?api=https://pirate.example`) ferait envoyer `X-Player-Id` (le secret qui désigne le joueur) et la
 * rediffusion à l'adresse du pirate, qui pourrait alors jouer sous son nom. Une construction de production (`restricted`, `VITE_PRODUCTION=1`)
 * n'accepte donc comme `?api=` que : `/` (le serveur de la même origine), `demo` (jeu de données statique, sans réseau), l'origine de la page
 * elle-même, ou une adresse de la machine locale (développement, tests). Les autres constructions (recette, aperçus, développement : des
 * origines à part, sans vraie identité) gardent le comportement d'avant.
 *
 * Pure : l'origine de la page est donnée par l'appelant (ce module ne touche ni `location` ni le réseau).
 */
export function apiFromAddress(raw: string | null | undefined, restricted: boolean, origin?: string): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (!restricted) return value;
  if (value === "/" || value === "demo") return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") return value;
  if (origin && url.origin === origin.replace(/\/+$/, "")) return value;
  return null;
}
