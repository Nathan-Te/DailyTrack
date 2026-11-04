import { type Forme } from "./formes";

// Les PALETTES par thème du jour. Aplats seulement, aucun dégradé, aucune image. Un thème = une palette : les pièces (une couleur par forme), le ciel, le sol (la mer, la glace, le sable…), les petits traits
// posés sur le sol (vagues) et la plateforme. Un thème n'a aucun effet de jeu : seul le rendu le lit.
// **Chargement** : le port (le thème d'origine) est ici, dans `@cdj/visuels/blocs` ; les cinq autres sont dans `@cdj/visuels/blocs/themes`, que le jeu charge à la demande.
export const THEMES_BLOCS = ["port", "chantier", "canyon", "banquise", "jungle", "nuit"] as const;
export type ThemeBloc = (typeof THEMES_BLOCS)[number];

export interface PaletteTheme {
  /** Une couleur par forme (celle de la maquette pour le port). */
  pieces: Record<Forme, string>;
  ciel: string;
  /** Le sol : la mer, la glace, le sable… */
  sol: string;
  /** Les petits traits posés sur le sol (vagues). */
  vague: string;
  plateforme: string;
  plateformeReflet: string;
  pilier: string;
}

export const PALETTE_PORT: PaletteTheme = {
  pieces: { I: "#F28C38", O: "#FFD23F", T: "#9B6BD6", L: "#F07FB0", J: "#3F7FD9", S: "#5DBB63", Z: "#E5534B" },
  ciel: "#9FD3E6",
  sol: "#2F6F8F",
  vague: "#4A8BAA",
  plateforme: "#6B5847",
  plateformeReflet: "#8C7660",
  pilier: "#5A4A3C",
};
