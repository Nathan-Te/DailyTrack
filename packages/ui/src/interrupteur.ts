import "./interrupteur.css";
import { CATALOGUE_INTERRUPTEUR } from "./catalogue.interrupteur";

// Lot P (plateforme) — les deux écrans de l'interrupteur des jeux : « Bientôt » (le jeu n'est pas ouvert : `off`, ou `preview` sans clé) et le bandeau d'un jeu ouvert par une clé d'aperçu ou un aperçu de PR.
// **À la demande, et sans rien importer du reste du socle** (même règle que `aideIphone.ts` : un module à la demande qui importe un module du premier chargement le fait éclater en fichiers de plus) ;
// il ne touche ni au stockage ni au réseau. La langue est celle de la page (`<html lang>`). Aucun HTML venu d'ailleurs : le nom du jeu est un texte.

type Langue = "fr" | "en";
type Cle = keyof typeof CATALOGUE_INTERRUPTEUR.fr;

function texte(cle: Cle, nom?: string): string {
  const langue: Langue = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "fr";
  return (CATALOGUE_INTERRUPTEUR[langue][cle] as string).replace("{nom}", nom ?? "");
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, contenu?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = classe;
  if (contenu !== undefined) e.textContent = contenu;
  return e;
}

/** La page d'un jeu qui n'est pas ouvert : « Bientôt » plein écran, le nom du jeu, un lien vers le portail (`portail` : son adresse relative depuis la page du jeu, `../`). */
export function ecranBientot(o: { nom: string; portail: string }): HTMLElement {
  const retour = h("a", "dj-bouton dj-bientot__retour", texte("bientot.retour"));
  retour.href = o.portail;
  const racine = h("main", "dj-bientot");
  racine.append(h("h1", "dj-bientot__titre", texte("bientot.titre")), h("p", "dj-bientot__texte", texte("bientot.texte", o.nom)), retour);
  return racine;
}

/** Le bandeau « Aperçu — pas encore public » (clé d'aperçu) ou le badge « Brouillon » (aperçu de PR) : une étiquette en haut de page, qui ne prend jamais le focus. */
export function bandeauApercu(o: { brouillon: boolean }): HTMLElement {
  const e = h("div", o.brouillon ? "dj-apercu dj-apercu--brouillon" : "dj-apercu", texte(o.brouillon ? "apercu.brouillon" : "apercu.bandeau"));
  e.setAttribute("role", "status");
  e.setAttribute("data-apercu", o.brouillon ? "brouillon" : "cle");
  return e;
}
