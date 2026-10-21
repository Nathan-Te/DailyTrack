// Le lien vers le profil commun du portail (lot I5, comme Track au lot I4 : apps/web/src/profilLien.ts) : « Mon profil Du Jour › » dans les Réglages et sur
// l'accueil. Le profil est à la racine du site (`/profil/`), le jeu sous `/jump/` : l'adresse est relative à la page du jeu (`../profil/`) et porte le chemin
// de retour (`?retour=/jump/`) que le profil lit pour proposer « ‹ JUMP ». La validation du chemin de retour (seulement un chemin du site vers un jeu) est
// côté portail (`apps/portail/src/retour.ts`) : jamais une adresse extérieure. **Plus de profil dans le jeu** (pseudo, code : au portail).

/** Le chemin d'une page du jeu, sans `index.html` (`/jump/index.html` → `/jump/`). */
export function cheminDuJeu(pathname: string): string {
  return pathname.replace(/index\.html$/, "") || "/";
}

/** `../profil/?retour=<chemin de la page du jeu>` : le profil commun, avec le moyen de revenir au jeu. */
export function profilHref(pathname: string): string {
  return `../profil/?retour=${encodeURIComponent(cheminDuJeu(pathname))}`;
}
