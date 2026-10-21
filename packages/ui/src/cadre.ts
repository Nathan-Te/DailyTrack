import { suivreDialogue } from "./dialogue";
import { el } from "./dom";

// Le cadre d'un écran de jeu posé sur sa scène (lot I4b, charte rév. 8 § 9 : « quand on entre dans un jeu, on y reste tant qu'on ne choisit pas de
// le quitter »). Né dans Jump au lot I5 (`creerCadre({ scene: true })`), remonté ici pour Track et Jump : un voile à rayures sur la scène du jeu, la
// barre des jeux en plaque crème, puis ce qui défile — l'étiquette du jeu (le jeu peut la poser dans sa coque) et, dessous, le pied (« Jeu suivant du
// jour »). Feuille : `cadre.css` (à part de `styles.css` : le portail ne la charge pas). Le jeu donne sa barre (`barreJeu` avec son retour), le nom de
// l'écran, les classes de son étiquette et sa couleur de voile (`--cadre-voile`) ; il rappelle `majBarre()` au changement de langue et de jour.

export interface OptionsCadre {
  /** L'élément déjà dans la page (`#home`…) ; sinon un nouvel élément, caché, ajouté à `document.body`. */
  racine?: HTMLElement;
  id?: string;
  /** Les classes de l'étiquette du jeu (`etiquette dj-sombre` pour Track…). */
  etiquette: string;
  /** Un sous-écran (réglages, archives…) : au-dessus des autres, qui s'effacent tant qu'il est ouvert (un seul voile). */
  haut?: boolean;
  /** La barre des jeux telle qu'elle doit être maintenant : relue à chaque `majBarre()`. */
  barre(): HTMLElement;
  /** Le nom de l'écran pour les lecteurs d'écran, déjà traduit : relu à chaque `majBarre()`. */
  aria(): string;
}

export interface Cadre {
  racine: HTMLElement;
  etiquette: HTMLElement;
  /** Le corps de l'étiquette : l'écran y pose ses éléments. */
  corps: HTMLElement;
  /** Sous l'étiquette, sur une plaque crème (caché tant qu'il est vide). */
  pied: HTMLElement;
  /** Ce qui défile (l'étiquette et le pied) : `defile.scrollTop = 0` remonte en haut de l'écran. */
  defile: HTMLElement;
  /** Redessine la barre et le nom de l'écran (langue, jour). */
  majBarre(): void;
}

export function creerCadre(o: OptionsCadre): Cadre {
  const racine = o.racine ?? el("div", { attrs: { hidden: true } });
  if (o.id) racine.id = o.id;
  racine.classList.add("cadre");
  if (o.haut) racine.classList.add("cadre--haut");
  racine.setAttribute("role", "dialog");
  racine.setAttribute("aria-modal", "true");
  const corps = el("div", { classe: "etiquette__corps" });
  const etiquette = el("main", { classe: o.etiquette }, corps);
  const pied = el("div", { classe: "cadre__pied" });
  let barre: HTMLElement | null = null;
  const majBarre = () => {
    racine.setAttribute("aria-label", o.aria());
    const nouvelle = o.barre();
    if (barre) barre.replaceWith(nouvelle);
    else racine.prepend(nouvelle);
    barre = nouvelle;
  };
  majBarre();
  const defile = el("div", { classe: "cadre__defile" }, etiquette, pied);
  racine.append(defile);
  if (!racine.isConnected) document.body.append(racine);
  suivreDialogue(racine); // lot I6 : le focus entre à l'ouverture, revient à la fermeture
  return { racine, etiquette, corps, pied, defile, majBarre };
}
