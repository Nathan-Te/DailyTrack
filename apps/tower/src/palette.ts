import type { PieceKind, ThemeTower } from "@cdj/tower-sim";
import { valeurJeton } from "@cdj/ui";

// Les couleurs de la SCÈNE de Tower (lots T1 et T3) : le rendu en jeu est procédural, hors des jetons de l'interface (charte § 12) ; il lit pourtant les jetons de la marque pour
// l'encre et le papier, et prend le reste des maquettes (`docs/tower/maquettes/tower-hud-paysage.html`). Aplats seulement, aucun dégradé, aucune image.
//
// Lot T3 — **un thème = une palette** : les pièces, le ciel, le sol (la mer, la glace…), un décor de fond plat (des rectangles semés à la main) et la plateforme. Un thème n'a aucun effet
// physique : seul le rendu le lit. Le port (le thème d'origine) est ici, dans le premier chargement ; les cinq autres sont dans `palettes.ts`, chargé à la demande (`chargerPalette`).
// Les pièces sont des aplats bordés d'encre : `test/palettes.test.ts` vérifie chaque paire pièce / fond (une différence de clarté minimale).
export interface PaletteTheme {
  /** Une couleur par type de pièce (celle de la maquette pour le port). */
  pieces: Record<PieceKind, string>;
  ciel: string;
  /** Le sol : la mer, la glace, le sable… */
  sol: string;
  /** Les petits traits posés sur le sol (vagues). */
  vague: string;
  /** La couleur des formes du décor de fond. */
  decor: string;
  /** Le décor de fond : des rectangles `[x, y, largeur, hauteur]` en mètres, semés tous les 8,5 m de hauteur (aucun hasard). */
  formes: readonly (readonly [number, number, number, number])[];
  plateforme: string;
  plateformeReflet: string;
  pilier: string;
}

/** Des nuages en pixels, comme la maquette (90 × 14 px et 44 × 12 px à 20 px par mètre), semés à la main : aucun hasard. */
function nuages(): [number, number, number, number][] {
  const f: [number, number, number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const y = 4 + i * 8.5 + ((i * 7) % 5);
    const x = ((i * 37) % 47) - 23;
    f.push([x, y, 4.5, 0.7], [x + 1, y + 0.6, 2.2, 0.6]);
  }
  return f;
}

export const PALETTE_PORT: PaletteTheme = {
  pieces: { I: "#F28C38", O: "#FFD23F", T: "#9B6BD6", L: "#F07FB0", J: "#3F7FD9", S: "#5DBB63", Z: "#E5534B" },
  ciel: "#9FD3E6",
  sol: "#2F6F8F",
  vague: "#4A8BAA",
  decor: "#C9E8F2",
  formes: nuages(),
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
