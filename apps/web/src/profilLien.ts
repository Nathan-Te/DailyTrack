// Le lien vers le profil commun du portail (lot I4) : « Mon profil Du Jour › » dans les Réglages. Le profil est à la racine du site (`/profil/`), le jeu sous
// `/track/` : l'adresse est relative à la page du jeu (`../profil/`) et porte le chemin de retour (`?retour=/track/`) que le profil lit pour proposer « ‹ Track ».
// La validation du chemin de retour (seulement un chemin du site) est côté portail (`apps/portail/src/retour.ts`) : jamais une adresse extérieure.

/** Le chemin d'une page du jeu, sans `index.html` (`/track/index.html` → `/track/`). */
export function cheminDuJeu(pathname: string): string {
  return pathname.replace(/index\.html$/, "") || "/";
}

/** `../profil/?retour=<chemin de la page du jeu>` : le profil commun, avec le moyen de revenir au jeu. `origine` ne sert pas (le lien est relatif au site). */
export function profilHref(_origine: string, pathname: string): string {
  return `../profil/?retour=${encodeURIComponent(cheminDuJeu(pathname))}`;
}
