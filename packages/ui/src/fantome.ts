import { el } from "./dom";
import { iconeFantome } from "./icones";

// Lot G1 (charte rév. 12 : le fantôme reste en vue en partie) — dans son propre fichier : le portail n'a pas de bouton fantôme, il ne le paie pas (budget du premier chargement).

export interface OptionsBoutonFantome {
  id?: string;
  /** Classes en plus (la plaque du HUD d'un jeu). */
  classe?: string | readonly (string | false | null | undefined)[];
  /** Appui : le jeu passe au fantôme suivant (Aucun compris) et nomme le bouton avec `aria-label` (« Fantôme : {nom} »). */
  onClick: () => void;
}

/**
 * Lot G1 (charte rév. 12 : le fantôme reste en vue en partie) : le bouton fantôme, icône au trait ; ses 44 px et sa plaque viennent de la classe du jeu (`plaque plaque--bouton` en partie ; dans la vitrine `dj-plein-ecran--icone`). Il ne sait rien des fantômes d'un jeu : il
 * rend l'appui à `onClick` et le jeu met à jour son nom lu (`aria-label`, « Fantôme : {nom} », la clé `fantome.bouton` de son catalogue) à chaque appui. Le focus lui est retiré (un espace ou
 * Entrée ensuite reste une commande de jeu).
 */
export function boutonFantome(o: OptionsBoutonFantome): HTMLButtonElement {
  const b = el("button", { classe: ["dj-fantome", ...(typeof o.classe === "string" ? [o.classe] : (o.classe ?? []))], attrs: { type: "button", id: o.id } }, iconeFantome());
  b.addEventListener("click", () => {
    b.blur();
    o.onClick();
  });
  return b;
}
