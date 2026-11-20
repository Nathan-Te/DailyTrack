import { el } from "@cdj/ui";

// Lot N3 (plateforme) — l'habillage commun des pages du panneau : un titre, un sous-titre et, à droite, les outils de la page (recherche, filtres, boutons). Chaque vue le pose en tête de son contenu ;
// son contenu et ses actions ne changent pas. Tout texte est posé en `textContent` (le titre d'une page ne vient jamais du serveur, mais l'habitude reste la règle).

/** Le titre de la page (`h1`), son sous-titre et ses outils (à droite sur ordinateur, dessous sur téléphone). `id` : l'ancre du titre, si une zone a besoin de le désigner. */
export function entetePage(o: { titre: string; sousTitre?: string; outils?: readonly Node[]; id?: string; /** Un élément posé dans le titre, après le texte (la pastille « Masqué » d'une fiche). */ dans?: Node | null }): HTMLElement {
  return el(
    "header",
    { classe: "admin-entete" },
    el(
      "div",
      { classe: "admin-entete__texte" },
      el("h1", { classe: "admin-titre-section admin-entete__titre", attrs: { id: o.id } }, o.titre, o.dans),
      o.sousTitre ? el("p", { classe: "admin-aide admin-entete__sous-titre", texte: o.sousTitre }) : null,
    ),
    o.outils?.length ? el("div", { classe: "admin-entete__outils" }, ...o.outils) : null,
  );
}
