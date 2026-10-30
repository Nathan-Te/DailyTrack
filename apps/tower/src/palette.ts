import type { PieceKind } from "@cdj/tower-sim";
import { valeurJeton } from "@cdj/ui";

// Les couleurs de la SCÈNE de Tower (lot T1) : le rendu en jeu est procédural, hors des jetons de l'interface (charte § 12) ; il lit pourtant les jetons de la marque pour
// l'encre et le papier, et prend le reste des maquettes (`docs/tower/maquettes/tower-hud-paysage.html`). Une couleur par type de pièce (celle de la maquette) ; aucun dégradé.
export const PIECE_COULEUR: Record<PieceKind, string> = {
  I: "#F28C38",
  O: "#FFD23F",
  T: "#9B6BD6",
  L: "#F07FB0",
  J: "#3F7FD9",
  S: "#5DBB63",
  Z: "#E5534B",
};

export const SCENE = {
  ciel: "#9FD3E6",
  nuage: "#C9E8F2",
  mer: "#2F6F8F",
  vague: "#4A8BAA",
  plateforme: "#6B5847",
  plateformeReflet: "#8C7660",
  pilier: "#5A4A3C",
  encre: valeurJeton("dj-encre"),
  papier: valeurJeton("dj-papier"),
} as const;

/** Le halo d'une pièce qui porte un effet de palier (lot T2) : un liseré de couleur sous la bordure d'encre. Aplats, aucun dégradé ; le soin viendra au lot T5. */
export const EFFET_HALO = {
  lierre: "#5DBB63",
  figee: "#7C8FA6",
  glissante: "#9ED9BE",
} as const;
