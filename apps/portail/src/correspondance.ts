// La correspondance des chemins de l'ancienne adresse (GitHub Pages, `https://nathan-te.github.io/DailyTrack/…`) vers le nouveau domaine
// (lot R4). Pure et testée (`test/correspondance.test.ts`). Les paramètres (`?seed=`, `?watch=`, `?api=`…) sont gardés tels quels.
//   /DailyTrack/            → /track/
//   /DailyTrack/<chemin>    → /track/<chemin>       (admin/, verify.html…)
//   /DailyTrack/jump/<…>    → /jump/<…>
//   /DailyTrack/b/<…>       → une page qui explique que les aperçus ont déménagé (aucune redirection)
//   ailleurs                → le portail (/)

/** Le chemin de l'ancien site sur GitHub Pages (le nom du dépôt). */
export const ANCIENNE_BASE = "/DailyTrack/";

export type Correspondance = { kind: "jeu"; url: string } | { kind: "portail"; url: string } | { kind: "apercu"; url: string };

/** Où envoyer une adresse de l'ancien site. `cible` : l'origine du nouveau domaine (`https://playdujour.com`), sans `/` final. */
export function correspondance(pathname: string, search: string, cible: string, base = ANCIENNE_BASE): Correspondance {
  const origin = cible.replace(/\/+$/, "");
  const query = search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "";
  const root = base.replace(/\/+$/, "");
  if (pathname !== root && !pathname.startsWith(`${root}/`)) return { kind: "portail", url: `${origin}/` };
  const rest = pathname.slice(root.length).replace(/^\/+/, "");
  // Les anciens aperçus de branche : ils ont déménagé (canaux d'aperçu Firebase, lien commenté sur chaque PR).
  if (rest === "b" || rest.startsWith("b/")) return { kind: "apercu", url: `${origin}/` };
  if (rest === "jump" || rest.startsWith("jump/")) return { kind: "jeu", url: `${origin}/jump/${rest.replace(/^jump\/?/, "")}${query}` };
  return { kind: "jeu", url: `${origin}/track/${rest}${query}` };
}
