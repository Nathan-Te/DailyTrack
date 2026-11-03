import { bouton, el } from "@cdj/ui";
import type { Langue } from "@cdj/profile";

// Lot C1, partie A : le lien « Un bug ? Une idée ? » du pied de chaque page du portail. Un bouton d'allure de lien (c'est un dialogue qu'il ouvre) ; **tout le reste est à la demande** : le
// dialogue, son vocabulaire et le client des routes ne sont chargés qu'au toucher (`retoursPortail.ts`). `racine` : le chemin relatif de la racine du site depuis la page (`""` à l'accueil, `"../"` ailleurs).
export function lienRetours(texte: string, langue: Langue, racine = ""): HTMLElement {
  const b = el("button", { classe: "portail-pied__lien portail-pied__bouton", attrs: { id: "retours", type: "button" }, texte });
  b.addEventListener("click", () => void import("./retoursPortail").then((m) => m.ouvrir(langue, racine)));
  return b;
}

/** Le même dialogue, en **bouton visible** (accueil : sous « Partager ma journée », là où un retour se remarque). Même identifiant `#retours` que le lien du pied : l'accueil n'a que l'un des deux. */
export function boutonRetours(texte: string, langue: Langue, racine = ""): HTMLElement {
  const b = bouton({ texte, variante: "secondaire", pleineLargeur: true, onClick: () => void import("./retoursPortail").then((m) => m.ouvrir(langue, racine)) });
  b.id = "retours";
  b.setAttribute("data-cle", "retours");
  return el("section", { classe: "portail-retours" }, b);
}
