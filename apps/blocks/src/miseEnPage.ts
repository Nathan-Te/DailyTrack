import { COLONNES } from "@cdj/blocks-sim";

// La MISE EN PAGE de la scène (pure, testée) : la grille de 8 × 8 en pleine largeur en portrait, à gauche en paysage ou au bureau ; la pièce du moment dans une grande zone de saisie, la pièce suivante petite et
// à part. Les pièces ont au plus 5 cases de long : leurs tailles en main sont bornées pour qu'aucune ne dépasse la zone.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Disposition {
  portrait: boolean;
  /** Le côté d'une case de la grille, en pixels. */
  cote: number;
  grille: Rect;
  /** La zone de saisie : on prend la pièce du moment n'importe où dedans. */
  main: Rect;
  /** Le côté d'une case de la pièce du moment dans la zone de saisie (elle grossit à `cote` quand on la saisit). */
  coteMain: number;
  /** Le centre où la pièce du moment est posée dans la zone. */
  centreMain: { x: number; y: number };
  coteSuivante: number;
  centreSuivante: { x: number; y: number };
}

const ECART = 12;

export function disposer(largeur: number, hauteur: number): Disposition {
  const portrait = hauteur >= largeur * 0.95;
  let cote: number;
  let grille: Rect;
  let main: Rect;
  if (portrait) {
    cote = Math.max(1, Math.floor(Math.min(largeur / COLONNES, (hauteur - ECART - Math.max(110, hauteur * 0.26)) / COLONNES)));
    const g = cote * COLONNES;
    grille = { x: Math.floor((largeur - g) / 2), y: 0, w: g, h: g };
    main = { x: 0, y: g + ECART, w: largeur, h: Math.max(1, hauteur - g - ECART) };
  } else {
    cote = Math.max(1, Math.floor(Math.min(hauteur / COLONNES, (largeur * 0.6) / COLONNES)));
    const g = cote * COLONNES;
    grille = { x: Math.max(0, Math.floor((largeur * 0.62 - g) / 2)), y: Math.floor((hauteur - g) / 2), w: g, h: g };
    const x = grille.x + g + ECART;
    main = { x, y: 0, w: Math.max(1, largeur - x), h: hauteur };
  }
  const coteMain = Math.max(1, Math.min(cote * 0.8, (main.w * 0.7) / 5, (main.h * 0.7) / 5));
  const coteSuivante = Math.max(1, coteMain * 0.5);
  return {
    portrait,
    cote,
    grille,
    main,
    coteMain,
    centreMain: { x: main.x + main.w * 0.45, y: main.y + main.h * 0.58 },
    coteSuivante,
    centreSuivante: { x: main.x + main.w - 3 * coteSuivante - 4, y: main.y + 3 * coteSuivante + 4 },
  };
}

export const dans = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
