import type { Effet } from "@cdj/tower-sim";
import { svg } from "@cdj/ui";

// Les six icônes d'effet (lot T5), **au trait** (charte § 6 : 2 à 2,5 px, extrémités carrées, `currentColor`, aucun émoji) : la plaque « Suivante » montre celle de l'effet qui attend la prochaine pièce.
// Une icône décorative est `aria-hidden` ; la plaque porte le texte (`hud.suivante.effet.aria`).
const TRAITS: Readonly<Record<Effet, readonly string[]>> = {
  // Une feuille et sa nervure : le lierre.
  lierre: ["M4 16C4 9 9 5 16 4c0 7-4 12-11 12", "M4 16l7-7"],
  // Lot T9 : un écrou (un hexagone et son trou) : la pièce figée, boulonnée sur place.
  figee: ["M10 2l6.5 4v8L10 18l-6.5-4V6z", "M8 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0z"],
  // Un petit carré entre des angles qui se resserrent : la petite pièce.
  petite: ["M7.5 7.5h5v5h-5z", "M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4"],
  // Un grand carré, des flèches qui s'écartent : la pièce géante.
  geante: ["M6 6h8v8H6z", "M3 7V3h4M3 3l4 4M17 7V3h-4M17 3l-4 4M3 13v4h4M3 17l4-4M17 13v4h-4M17 17l-4-4"],
  // Des souffles qui s'enroulent : le coup de vent.
  vent: ["M2 7h10a3 3 0 1 0-3-3", "M2 12h14a3 3 0 1 1-3 3", "M2 17h6"],
  // Lot T9 : un flocon : la pièce glissante, prise dans le verglas.
  glissante: ["M10 2v16M2 10h16M4.5 4.5l11 11M15.5 4.5l-11 11"],
};

/** L'icône au trait d'un effet (20 × 20, `currentColor`). */
export function iconeEffet(effet: Effet): SVGSVGElement {
  return svg("svg", { classe: "effet-icone", attrs: { "aria-hidden": "true", viewBox: "0 0 20 20", width: 20, height: 20 } }, ...TRAITS[effet].map((d) => svg("path", { attrs: { d } }))) as SVGSVGElement;
}
