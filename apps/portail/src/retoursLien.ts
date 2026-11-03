import { el } from "@cdj/ui";
import type { Langue } from "@cdj/profile";

// Lot C1, partie A : le lien « Un bug ? Une idée ? » du pied de chaque page du portail. Un bouton d'allure de lien (c'est un dialogue qu'il ouvre) ; **tout le reste est à la demande** : le
// dialogue, son vocabulaire et le client des routes ne sont chargés qu'au toucher (`retoursPortail.ts`). `racine` : le chemin relatif de la racine du site depuis la page (`""` à l'accueil, `"../"` ailleurs).
export function lienRetours(texte: string, langue: Langue, racine = ""): HTMLElement {
  const b = el("button", { classe: "portail-pied__lien portail-pied__bouton", attrs: { id: "retours", type: "button" }, texte });
  b.addEventListener("click", () => void import("./retoursPortail").then((m) => m.ouvrir(langue, racine)));
  return b;
}
