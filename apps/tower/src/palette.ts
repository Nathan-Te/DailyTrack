import type { ThemeTower } from "@cdj/tower-sim";
import { valeurJeton } from "@cdj/ui";
import { PALETTE_PORT, type PaletteTheme } from "@cdj/visuels/blocs";

// Les couleurs de la SCÈNE de Tower (lots T1 et T3) : le rendu en jeu est procédural, hors des jetons de l'interface (charte § 12) ; il lit pourtant les jetons de la marque pour
// l'encre et le papier, et prend le reste des maquettes (`docs/tower/maquettes/tower-hud-paysage.html`). Aplats seulement, aucun dégradé, aucune image.
//
// Lot T3 — **un thème = une palette** : les pièces, le ciel, le sol (la mer, la glace…) et la plateforme. Un thème n'a aucun effet physique : seul le rendu le lit. Le port (le thème d'origine) est ici, dans
// le premier chargement ; les cinq autres sont dans `@cdj/visuels/blocs/themes`, chargé à la demande (`chargerPalette`). **Lot T9 : le décor de fond (trois plans, le registre d'altitude) n'est plus dans la palette** : il vit
// dans un module par thème chargé à la demande (`decors.ts`) ; sous le voile, avant qu'il arrive, le ciel et la mer d'un thème suffisent.
// Les pièces sont des aplats bordés d'encre : `test/palettes.test.ts` vérifie chaque paire pièce / fond (une différence de clarté minimale), sur tous les plans de chaque décor.
// Lot DA1 : la palette d'un thème (`PaletteTheme`, `PALETTE_PORT`, les cinq autres dans `@cdj/visuels/blocs/themes`) est celle du MODULE COMMUN des blocs ; ce fichier garde ce qui est propre à la scène de Tower : la palette de la partie
// en cours, l'encre et le papier lus dans les jetons, le halo d'un effet de palier.
let courante: PaletteTheme = PALETTE_PORT;
/** La palette de la partie en cours (le port tant qu'aucune autre n'est posée). */
export const paletteCourante = (): PaletteTheme => courante;
export function poserPalette(p: PaletteTheme): void {
  courante = p;
}

/** La palette d'un thème : le port tout de suite, les autres par un fichier à part (chargé à la demande). */
export async function chargerPalette(theme: ThemeTower): Promise<PaletteTheme> {
  if (theme === "port") return PALETTE_PORT;
  return (await import("@cdj/visuels/blocs/themes")).PALETTES[theme];
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
