import type { PieceKind, ThemeTower } from "@cdj/tower-sim";
import { valeurJeton } from "@cdj/ui";

// Les couleurs de la SCÈNE de Tower (lots T1 et T3) : le rendu en jeu est procédural, hors des jetons de l'interface (charte § 12) ; il lit pourtant les jetons de la marque pour
// l'encre et le papier, et prend le reste des maquettes (`docs/tower/maquettes/tower-hud-paysage.html`). Aplats seulement, aucun dégradé, aucune image.
//
// Lot T3 — **un thème = une palette** : les pièces, le ciel, le sol (la mer, la glace…) et la plateforme. Un thème n'a aucun effet physique : seul le rendu le lit. Le port (le thème d'origine) est ici, dans
// le premier chargement ; les cinq autres sont dans `palettes.ts`, chargé à la demande (`chargerPalette`). **Lot T9 : le décor de fond (trois plans, le registre d'altitude) n'est plus dans la palette** : il vit
// dans un module par thème chargé à la demande (`decors.ts`) ; sous le voile, avant qu'il arrive, le ciel et la mer d'un thème suffisent.
// Les pièces sont des aplats bordés d'encre : `test/palettes.test.ts` vérifie chaque paire pièce / fond (une différence de clarté minimale), sur tous les plans de chaque décor.
export interface PaletteTheme {
  /** Une couleur par type de pièce (celle de la maquette pour le port). */
  pieces: Record<PieceKind, string>;
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

let courante: PaletteTheme = PALETTE_PORT;
/** La palette de la partie en cours (le port tant qu'aucune autre n'est posée). */
export const paletteCourante = (): PaletteTheme => courante;
export function poserPalette(p: PaletteTheme): void {
  courante = p;
}

/** La palette d'un thème : le port tout de suite, les autres par un fichier à part (chargé à la demande). */
export async function chargerPalette(theme: ThemeTower): Promise<PaletteTheme> {
  if (theme === "port") return PALETTE_PORT;
  return (await import("./palettes")).PALETTES[theme];
}

export const SCENE = {
  encre: valeurJeton("dj-encre"),
  papier: valeurJeton("dj-papier"),
} as const;

/** Le halo d'une pièce qui porte un effet de palier (lot T2) : un liseré de couleur sous la bordure d'encre. Aplats, aucun dégradé ; le soin viendra au lot T5. */
export const EFFET_HALO = {
  lierre: "#5DBB63",
  figee: "#7C8FA6",
  glissante: "#9ED9BE",
} as const;
